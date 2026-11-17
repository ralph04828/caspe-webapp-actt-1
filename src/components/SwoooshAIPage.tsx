import React, { useEffect, useState } from 'react';
import {
  AIColorMatchResponse,
  AIMissingPiecesResponse,
  AIOutfitFeedbackResponse,
  AIOutfitGeneratorResponse,
  AIStyleRecommendationResponse,
  ClothingItem,
  NavSection,
} from '../types';
import { useWardrobe } from '../context/WardrobeContext';
import {
  checkAIStatus,
  generateAIOutfit,
  getAIColorMatch,
  getAIMissingPieces,
  getAIOutfitFeedback,
  getAIStyleRecommendations,
  sendAIFashionChat,
} from '../services/aiService';
import { fileToCompressedDataUrl, validateImageFile } from '../services/storageService';
import { GarmentImage } from './GarmentImage';
import {
  Sparkles,
  Layers,
  Palette,
  Camera,
  MessageSquare,
  SearchCheck,
  BookmarkPlus,
  Send,
  Upload,
  AlertTriangle,
} from 'lucide-react';

interface SwoooshAIPageProps {
  onNavigate: (section: NavSection) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

type AITab = 'generator' | 'style' | 'color' | 'feedback' | 'chat' | 'missing';

export const SwoooshAIPage: React.FC<SwoooshAIPageProps> = ({ onNavigate, onToast }) => {
  const { wardrobe, addOutfit } = useWardrobe();

  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<AITab>('generator');

  useEffect(() => {
    checkAIStatus().then((res) => setAiConfigured(res.configured));
  }, []);

  // A. AI Outfit Generator state
  const [occasion, setOccasion] = useState('Casual day');
  const [stylePref, setStylePref] = useState('Streetwear');
  const [colorPref, setColorPref] = useState('No preference');
  const [weather, setWeather] = useState('');
  const [genNotes, setGenNotes] = useState('');
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<AIOutfitGeneratorResponse | null>(null);

  // B. AI Style Recommendations state
  const [aesthetic, setAesthetic] = useState('Streetwear');
  const [styleLoading, setStyleLoading] = useState(false);
  const [styleError, setStyleError] = useState<string | null>(null);
  const [styleResult, setStyleResult] = useState<AIStyleRecommendationResponse | null>(null);

  // C. AI Color Matching state
  const [selectedColorItemId, setSelectedColorItemId] = useState(wardrobe[0]?.id || '');
  const [colorLoading, setColorLoading] = useState(false);
  const [colorError, setColorError] = useState<string | null>(null);
  const [colorResult, setColorResult] = useState<AIColorMatchResponse | null>(null);

  // D. AI Outfit Feedback state
  const [feedbackPhoto, setFeedbackPhoto] = useState('');
  const [feedbackMime, setFeedbackMime] = useState('image/jpeg');
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackResult, setFeedbackResult] = useState<AIOutfitFeedbackResponse | null>(null);

  // E. AI Fashion Chat state
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // F. AI Missing Pieces state
  const [missingLoading, setMissingLoading] = useState(false);
  const [missingError, setMissingError] = useState<string | null>(null);
  const [missingResult, setMissingResult] = useState<AIMissingPiecesResponse | null>(null);

  useEffect(() => {
    if (!selectedColorItemId && wardrobe.length > 0) {
      setSelectedColorItemId(wardrobe[0].id);
    }
  }, [wardrobe, selectedColorItemId]);

  const findItem = (id?: string): ClothingItem | undefined =>
    id ? wardrobe.find((w) => w.id === id) : undefined;

  // Handlers
  const handleGenerateOutfits = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenError(null);
    setGenLoading(true);
    try {
      const res = await generateAIOutfit(wardrobe, {
        occasion,
        style: stylePref,
        colors: colorPref,
        weather,
        notes: genNotes,
      });
      setGenResult(res);
    } catch (err: any) {
      setGenError(err.message);
    } finally {
      setGenLoading(false);
    }
  };

  const handleSaveGeneratedToLookbook = async (outfit: AIOutfitGeneratorResponse['outfits'][number]) => {
    try {
      await addOutfit({
        name: outfit.outfitName,
        styleCategory: stylePref,
        description: `${outfit.explanation} (${outfit.occasion})`,
        topId: outfit.topId || undefined,
        bottomId: outfit.bottomId || undefined,
        shoesId: outfit.shoesId || undefined,
        accessoryIds: outfit.accessoryIds || [],
        isFavorite: false,
        source: 'ai',
      });
      onToast(`Saved "${outfit.outfitName}" to My Lookbook.`);
    } catch (err: any) {
      onToast(err.message || 'Could not save outfit.', 'error');
    }
  };

  const handleStyleRecs = async (e: React.FormEvent) => {
    e.preventDefault();
    setStyleError(null);
    setStyleLoading(true);
    try {
      const res = await getAIStyleRecommendations(wardrobe, aesthetic);
      setStyleResult(res);
    } catch (err: any) {
      setStyleError(err.message);
    } finally {
      setStyleLoading(false);
    }
  };

  const handleColorMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = findItem(selectedColorItemId);
    if (!target) {
      setColorError('Please select a clothing item from your wardrobe first.');
      return;
    }
    setColorError(null);
    setColorLoading(true);
    try {
      const res = await getAIColorMatch(target, wardrobe);
      setColorResult(res);
    } catch (err: any) {
      setColorError(err.message);
    } finally {
      setColorLoading(false);
    }
  };

  const handleFeedbackFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      setFeedbackError(err);
      return;
    }
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 1024, 0.85);
      setFeedbackPhoto(dataUrl);
      setFeedbackMime('image/jpeg');
      setFeedbackError(null);
    } catch (e: any) {
      setFeedbackError(e.message || 'Could not read image.');
    }
  };

  const handleAnalyzeOutfitPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackPhoto) {
      setFeedbackError('Upload an outfit photo to analyze.');
      return;
    }
    setFeedbackError(null);
    setFeedbackLoading(true);
    try {
      const res = await getAIOutfitFeedback(feedbackPhoto, feedbackMime, feedbackNotes);
      setFeedbackResult(res);
    } catch (err: any) {
      setFeedbackError(err.message);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleSendChat = async (questionText?: string) => {
    const text = (questionText ?? chatInput).trim();
    if (!text || chatLoading) return;
    const nextMessages = [...chatMessages, { role: 'user' as const, content: text }];
    setChatMessages(nextMessages);
    if (!questionText) setChatInput('');
    setChatError(null);
    setChatLoading(true);
    try {
      const res = await sendAIFashionChat(nextMessages, wardrobe);
      setChatMessages([...nextMessages, { role: 'assistant', content: res.reply }]);
    } catch (err: any) {
      setChatError(err.message);
    } finally {
      setChatLoading(false);
    }
  };

  const handleMissingPieces = async () => {
    setMissingError(null);
    setMissingLoading(true);
    try {
      const res = await getAIMissingPieces(wardrobe);
      setMissingResult(res);
    } catch (err: any) {
      setMissingError(err.message);
    } finally {
      setMissingLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-5 border-b border-[#d8d4ca] dark:border-[#404040] flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#5c5a54] dark:text-[#b0b0b0]">
            SWOOOSH AI · YOUR PERSONAL AI FASHION STYLIST.
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-1">
            SWOOOSH AI
          </h1>
          <p className="text-sm text-[#5c5a54] dark:text-[#b0b0b0] mt-1.5">
            Your wardrobe has more possibilities than you think. Let SWOOOSH AI find them.
          </p>
        </div>
        <div className="text-xs font-mono-num text-[#5c5a54] dark:text-[#b0b0b0]">
          Connected Wardrobe: {wardrobe.length} garments
        </div>
      </div>

      {/* Missing Configuration Alert */}
      {aiConfigured === false && (
        <div className="p-4 border border-amber-500/50 bg-amber-500/10 text-xs flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-semibold">Gemini API Key Setup Required</p>
            <p className="text-[#5c5a54] dark:text-[#b0b0b0]">
              SWOOOSH AI uses Google Gemini on the server. Add your <code className="font-mono-num">GEMINI_API_KEY</code> in the environment Secrets panel to activate live AI recommendations.
            </p>
          </div>
        </div>
      )}

      {/* Feature Mode Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-[#eae7e0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]">
        {(
          [
            { id: 'generator', label: 'Outfit Generator', icon: Sparkles },
            { id: 'style', label: 'Style Explorer', icon: Layers },
            { id: 'color', label: 'Color Matching', icon: Palette },
            { id: 'feedback', label: 'Outfit Feedback', icon: Camera },
            { id: 'chat', label: 'Fashion Chat', icon: MessageSquare },
            { id: 'missing', label: 'Missing Pieces', icon: SearchCheck },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                  : 'text-[#5c5a54] dark:text-[#b0b0b0] hover:text-[#171717] dark:hover:text-[#e5e1da]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* A. AI OUTFIT GENERATOR */}
      {activeTab === 'generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleGenerateOutfits}
            className="lg:col-span-4 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] p-5 space-y-4"
          >
            <h2 className="font-display text-lg font-bold">Outfit Parameters</h2>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                Occasion
              </label>
              <select
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
              >
                {['School', 'Casual day', 'Date', 'Hangout', 'Party', 'Formal event'].map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                Preferred Style
              </label>
              <select
                value={stylePref}
                onChange={(e) => setStylePref(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
              >
                {['Streetwear', 'Minimalist', 'Casual', 'Vintage', 'Oversized', 'Smart casual'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                Preferred Colors
              </label>
              <select
                value={colorPref}
                onChange={(e) => setColorPref(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
              >
                {['No preference', 'Black', 'White', 'Gray', 'Neutral', 'Earth tones'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                Weather / Temp (Optional)
              </label>
              <input
                type="text"
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                placeholder="e.g. Cool 15°C evening, light rain"
                className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                Styling Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={genNotes}
                onChange={(e) => setGenNotes(e.target.value)}
                placeholder="Focus on layered proportions..."
                className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
              />
            </div>

            <button
              type="submit"
              disabled={genLoading}
              className="w-full py-2.5 px-4 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{genLoading ? 'Styling From Your Closet...' : 'Generate AI Outfits'}</span>
            </button>
          </form>

          <div className="lg:col-span-8 space-y-4">
            {genError && (
              <div className="p-4 border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs">
                {genError}
              </div>
            )}

            {genLoading && (
              <div className="p-12 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] text-center text-xs text-[#5c5a54] dark:text-[#b0b0b0]">
                SWOOOSH AI is analyzing your {wardrobe.length} wardrobe items...
              </div>
            )}

            {!genLoading && !genResult && (
              <div className="p-12 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] text-center space-y-2">
                <h3 className="font-display text-lg font-bold">Ready to style your collection</h3>
                <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0] max-w-md mx-auto">
                  Select an occasion and aesthetic on the left. SWOOOSH AI only recommends pieces actually stored in your wardrobe.
                </p>
              </div>
            )}

            {!genLoading && genResult && (
              <div className="space-y-5">
                {genResult.wardrobeReadinessNote && (
                  <div className="p-4 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] text-xs">
                    {genResult.wardrobeReadinessNote}
                  </div>
                )}

                {genResult.outfits.map((outfit, idx) => {
                  const top = findItem(outfit.topId);
                  const bottom = findItem(outfit.bottomId);
                  const shoes = findItem(outfit.shoesId);
                  const accs = (outfit.accessoryIds || [])
                    .map((id) => findItem(id))
                    .filter(Boolean) as ClothingItem[];
                  const allPieces = [top, bottom, shoes, ...accs].filter(Boolean) as ClothingItem[];

                  return (
                    <div
                      key={`${outfit.outfitName}_${idx}`}
                      className="bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] p-5 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-[#d8d4ca] dark:border-[#404040]">
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0]">
                            {outfit.occasion}
                          </p>
                          <h3 className="font-display text-xl font-bold mt-0.5">
                            {outfit.outfitName}
                          </h3>
                        </div>
                        {allPieces.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleSaveGeneratedToLookbook(outfit)}
                            className="px-3.5 py-2 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-semibold flex items-center gap-1.5 self-start cursor-pointer whitespace-nowrap"
                          >
                            <BookmarkPlus className="w-3.5 h-3.5" />
                            <span>Save to My Lookbook</span>
                          </button>
                        )}
                      </div>

                      {allPieces.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {allPieces.map((piece) => (
                            <div
                              key={piece.id}
                              className="border border-[#d8d4ca] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#303030]"
                            >
                              <div className="aspect-square overflow-hidden">
                                <GarmentImage src={piece.imageUrl} alt={piece.name} />
                              </div>
                              <div className="p-2">
                                <p className="text-[11px] font-semibold truncate">{piece.name}</p>
                                <p className="text-[10px] text-[#5c5a54] dark:text-[#b0b0b0] truncate">
                                  {piece.brand} · {piece.category}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2 text-xs">
                        <p>
                          <strong>Why it works:</strong> {outfit.explanation}
                        </p>
                        <p className="text-[#5c5a54] dark:text-[#b0b0b0]">
                          <strong>Styling tips:</strong> {outfit.stylingTips}
                        </p>
                        {outfit.missingNote && (
                          <p className="p-3 bg-[#eae7e0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]">
                            <strong>Wardrobe note:</strong> {outfit.missingNote}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* B. AI STYLE RECOMMENDATIONS */}
      {activeTab === 'style' && (
        <div className="space-y-5">
          <form
            onSubmit={handleStyleRecs}
            className="bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] p-5 flex flex-col sm:flex-row items-stretch sm:items-end gap-3"
          >
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1.5">
                Target Fashion Aesthetic
              </label>
              <input
                type="text"
                value={aesthetic}
                onChange={(e) => setAesthetic(e.target.value)}
                placeholder="Streetwear, Minimalist, Old money, Vintage, Oversized..."
                className="w-full px-3.5 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['Streetwear', 'Minimalist', 'Old money', 'Vintage', 'Oversized streetwear'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAesthetic(preset)}
                  className="px-2.5 py-2 text-xs border border-[#d8d4ca] dark:border-[#404040] hover:border-[#171717] dark:hover:border-[#e5e1da] cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={styleLoading}
              className="px-5 py-2.5 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              {styleLoading ? 'Analyzing...' : 'Get Recommendations'}
            </button>
          </form>

          {styleError && (
            <div className="p-4 border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs">
              {styleError}
            </div>
          )}

          {styleResult && (
            <div className="space-y-4">
              <div className="p-5 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] text-sm leading-relaxed">
                {styleResult.aestheticSummary}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {styleResult.combinations.map((combo, i) => {
                  const pieces = combo.itemIds.map((id) => findItem(id)).filter(Boolean) as ClothingItem[];
                  return (
                    <div
                      key={i}
                      className="bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] p-5 space-y-3"
                    >
                      <h3 className="font-display text-lg font-bold">{combo.title}</h3>
                      {pieces.length > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                          {pieces.map((p) => (
                            <div key={p.id} className="border border-[#d8d4ca] dark:border-[#404040]">
                              <div className="aspect-square">
                                <GarmentImage src={p.imageUrl} alt={p.name} />
                              </div>
                              <p className="p-1.5 text-[10px] font-medium truncate">{p.name}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0] leading-relaxed">
                        {combo.howToWear}
                      </p>
                    </div>
                  );
                })}
              </div>

              {styleResult.gapsToConsider && (
                <div className="p-4 bg-[#eae7e0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040] text-xs">
                  <strong>To push this aesthetic further:</strong> {styleResult.gapsToConsider}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* C. AI COLOR MATCHING */}
      {activeTab === 'color' && (
        <div className="space-y-5">
          {wardrobe.length === 0 ? (
            <div className="p-10 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] text-center space-y-3">
              <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0]">
                Add clothing items to My Wardrobe to run color matching analysis.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('wardrobe')}
                className="px-4 py-2 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-semibold cursor-pointer"
              >
                Add Clothing
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleColorMatch}
              className="bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] p-5 flex flex-col sm:flex-row items-stretch sm:items-end gap-4"
            >
              <div className="flex-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1.5">
                  Select Garment to Match
                </label>
                <select
                  value={selectedColorItemId}
                  onChange={(e) => setSelectedColorItemId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                >
                  {wardrobe.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {item.color} ({item.category})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={colorLoading}
                className="px-5 py-2.5 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                {colorLoading ? 'Matching Colors...' : 'Find Matches'}
              </button>
            </form>
          )}

          {colorError && (
            <div className="p-4 border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs">
              {colorError}
            </div>
          )}

          {colorResult && (
            <div className="space-y-5">
              <div className="p-5 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] text-xs leading-relaxed">
                <strong>Color Theory & Palette:</strong> {colorResult.colorTheoryNote}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] p-5 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0]">
                    Owned Wardrobe Matches
                  </h3>
                  {colorResult.ownedMatches.length === 0 ? (
                    <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0]">
                      No direct wardrobe matches found yet — review the complementary category suggestions on the right.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {colorResult.ownedMatches.map((m) => {
                        const piece = findItem(m.itemId);
                        if (!piece) return null;
                        return (
                          <div
                            key={m.itemId}
                            className="flex items-start gap-3 p-2.5 border border-[#d8d4ca] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#303030]"
                          >
                            <div className="w-14 h-14 shrink-0 overflow-hidden">
                              <GarmentImage src={piece.imageUrl} alt={piece.name} />
                            </div>
                            <div className="text-xs space-y-1">
                              <p className="font-semibold">
                                {piece.name} · {piece.color}
                              </p>
                              <p className="text-[#5c5a54] dark:text-[#b0b0b0]">{m.reason}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] p-5 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0]">
                    Complementary Pairings
                  </h3>
                  <div className="space-y-3">
                    {colorResult.complementaryIdeas.map((idea, idx) => (
                      <div
                        key={idx}
                        className="p-3 border border-[#d8d4ca] dark:border-[#404040] text-xs space-y-1"
                      >
                        <p className="font-semibold">
                          {idea.color} {idea.category}
                        </p>
                        <p className="text-[#5c5a54] dark:text-[#b0b0b0]">{idea.pairingAdvice}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* D. AI OUTFIT FEEDBACK */}
      {activeTab === 'feedback' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleAnalyzeOutfitPhoto}
            className="lg:col-span-5 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] p-5 space-y-4"
          >
            <h2 className="font-display text-lg font-bold">Upload Outfit Photo</h2>
            <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0]">
              Upload a mirror fit check or flat-lay. SWOOOSH AI evaluates color coordination, proportions, balance, and style consistency.
            </p>

            <div className="aspect-[4/3] bg-[#eae7e0] dark:bg-[#303030] border border-dashed border-[#d8d4ca] dark:border-[#404040] overflow-hidden flex items-center justify-center">
              {feedbackPhoto ? (
                <img
                  src={feedbackPhoto}
                  alt="Outfit to analyze"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-xs text-[#5c5a54] dark:text-[#b0b0b0]">
                  No outfit photo selected
                </span>
              )}
            </div>

            <label className="w-full py-2.5 px-4 border border-[#d8d4ca] dark:border-[#404040] hover:border-[#171717] dark:hover:border-[#e5e1da] text-xs font-medium flex items-center justify-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>{feedbackPhoto ? 'Choose Different Photo' : 'Select Outfit Photo'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFeedbackFileChange}
                className="hidden"
              />
            </label>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                Context / Occasion (Optional)
              </label>
              <input
                type="text"
                value={feedbackNotes}
                onChange={(e) => setFeedbackNotes(e.target.value)}
                placeholder="e.g. Wearing this to a creative agency interview"
                className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
              />
            </div>

            <button
              type="submit"
              disabled={feedbackLoading || !feedbackPhoto}
              className="w-full py-2.5 px-4 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-semibold disabled:opacity-50 cursor-pointer"
            >
              {feedbackLoading ? 'Analyzing Outfit...' : 'Analyze Outfit'}
            </button>
          </form>

          <div className="lg:col-span-7 space-y-4">
            {feedbackError && (
              <div className="p-4 border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs">
                {feedbackError}
              </div>
            )}

            {!feedbackLoading && !feedbackResult && (
              <div className="p-12 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] text-center text-xs text-[#5c5a54] dark:text-[#b0b0b0]">
                Upload a photo and run analysis to receive constructive styling critique.
              </div>
            )}

            {feedbackLoading && (
              <div className="p-12 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] text-center text-xs text-[#5c5a54] dark:text-[#b0b0b0]">
                Evaluating proportions, color balance, and styling details...
              </div>
            )}

            {feedbackResult && !feedbackLoading && (
              <div className="bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] p-6 space-y-4 text-xs">
                <div className="pb-3 border-b border-[#d8d4ca] dark:border-[#404040]">
                  <p className="uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] text-[11px]">
                    Overall Impression
                  </p>
                  <p className="text-sm font-medium mt-1 leading-relaxed">
                    {feedbackResult.overallImpression}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]">
                    <p className="font-semibold mb-1">Color Coordination</p>
                    <p className="text-[#5c5a54] dark:text-[#b0b0b0] leading-relaxed">
                      {feedbackResult.colorCoordination}
                    </p>
                  </div>
                  <div className="p-3 bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]">
                    <p className="font-semibold mb-1">Proportions & Silhouette</p>
                    <p className="text-[#5c5a54] dark:text-[#b0b0b0] leading-relaxed">
                      {feedbackResult.proportionsAndSilhouette}
                    </p>
                  </div>
                  <div className="p-3 bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]">
                    <p className="font-semibold mb-1">Outfit Balance</p>
                    <p className="text-[#5c5a54] dark:text-[#b0b0b0] leading-relaxed">
                      {feedbackResult.outfitBalance}
                    </p>
                  </div>
                  <div className="p-3 bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]">
                    <p className="font-semibold mb-1">Style Consistency</p>
                    <p className="text-[#5c5a54] dark:text-[#b0b0b0] leading-relaxed">
                      {feedbackResult.styleConsistency}
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <p className="font-semibold mb-2">Suggested Refinements</p>
                  <ul className="space-y-1.5 text-[#5c5a54] dark:text-[#b0b0b0]">
                    {feedbackResult.improvements.map((tip, i) => (
                      <li key={i}>· {tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* E. AI FASHION CHAT */}
      {activeTab === 'chat' && (
        <div className="bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] flex flex-col h-[540px]">
          <div className="p-4 border-b border-[#d8d4ca] dark:border-[#404040] flex flex-wrap gap-2">
            {[
              'What should I wear today?',
              'How can I style my black cargo pants?',
              'Give me three streetwear combinations.',
              'How can I make my outfit look more minimalist?',
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleSendChat(q)}
                className="px-2.5 py-1.5 text-[11px] border border-[#d8d4ca] dark:border-[#404040] hover:border-[#171717] dark:hover:border-[#e5e1da] cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-xs text-[#5c5a54] dark:text-[#b0b0b0] max-w-md mx-auto">
                <p className="font-semibold text-sm text-[#171717] dark:text-[#e5e1da] mb-1">
                  Ask SWOOOSH AI anything about styling
                </p>
                <p>
                  Your questions are answered using your actual {wardrobe.length} saved wardrobe pieces.
                </p>
              </div>
            ) : (
              chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3.5 text-xs leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                        : 'bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {chatLoading && (
              <div className="text-xs text-[#5c5a54] dark:text-[#b0b0b0]">
                SWOOOSH AI is thinking...
              </div>
            )}
            {chatError && (
              <div className="p-3 border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs">
                {chatError}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChat();
            }}
            className="p-4 border-t border-[#d8d4ca] dark:border-[#404040] flex gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about outfit pairings, layering, or shoes..."
              className="flex-1 px-3.5 py-2.5 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              className="px-4 py-2.5 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>
      )}

      {/* F. AI MISSING PIECE SUGGESTIONS */}
      {activeTab === 'missing' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-bold">Wardrobe Gap Audit</h2>
              <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0] mt-1">
                Identify high-leverage categories or garments that expand outfit combinations with pieces you already own.
              </p>
            </div>
            <button
              type="button"
              onClick={handleMissingPieces}
              disabled={missingLoading}
              className="px-5 py-2.5 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              {missingLoading ? 'Auditing Wardrobe...' : 'Analyze Missing Pieces'}
            </button>
          </div>

          {missingError && (
            <div className="p-4 border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs">
              {missingError}
            </div>
          )}

          {missingResult && (
            <div className="space-y-4">
              <div className="p-5 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] text-xs leading-relaxed">
                {missingResult.wardrobeSummary}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {missingResult.suggestions.map((sug, i) => (
                  <div
                    key={i}
                    className="bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] p-5 space-y-2"
                  >
                    <p className="text-[11px] text-[#5c5a54] dark:text-[#b0b0b0]">
                      {sug.category} · {sug.recommendedColor}
                    </p>
                    <h3 className="font-display text-lg font-bold">{sug.pieceName}</h3>
                    <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0] leading-relaxed">
                      {sug.impactReason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
