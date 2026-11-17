import React, { useEffect, useState } from 'react';
import {
  AIColorMatchResponse,
  AIMissingPiecesResponse,
  AIOutfitFeedbackResponse,
  AIOutfitGeneratorResponse,
  AIQuotaStatus,
  AIStyleRecommendationResponse,
  NavSection,
  STYLE_CATEGORIES,
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
import { getCachedWeather } from '../services/weatherService';
import { GarmentImage } from './GarmentImage';
import {
  Sparkles,
  Palette,
  Camera,
  MessageSquare,
  Layers,
  Compass,
  Loader2,
  Plus,
  Send,
  ShieldCheck,
} from 'lucide-react';

interface SwoooshAIPageProps {
  onNavigate: (section: NavSection) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

type AITab = 'generator' | 'style' | 'color' | 'feedback' | 'chat' | 'gaps';

export const SwoooshAIPage: React.FC<SwoooshAIPageProps> = ({ onNavigate, onToast }) => {
  const { wardrobe, addOutfit } = useWardrobe();

  const [tab, setTab] = useState<AITab>('generator');
  const [quota, setQuota] = useState<AIQuotaStatus | null>(null);
  const [busy, setBusy] = useState(false);

  // A. Generator state
  const cachedW = getCachedWeather();
  const [occasion, setOccasion] = useState('Studio / Daily');
  const [style, setStyle] = useState('Streetwear');
  const [colors, setColors] = useState('Charcoal, Bone, Neutral');
  const [weatherText, setWeatherText] = useState(
    cachedW ? `${cachedW.currentTempC}°C, ${cachedW.conditionLabel}` : 'Mild 20°C'
  );
  const [notes, setNotes] = useState('');
  const [cleanOnly, setCleanOnly] = useState(true);
  const [genResult, setGenResult] = useState<AIOutfitGeneratorResponse | null>(null);

  // B. Style Recommendations
  const [aesthetic, setAesthetic] = useState<string>('Streetwear');
  const [styleResult, setStyleResult] = useState<AIStyleRecommendationResponse | null>(null);

  // C. Color Match
  const [targetId, setTargetId] = useState(wardrobe[0]?.id || '');
  const [colorResult, setColorResult] = useState<AIColorMatchResponse | null>(null);

  // D. Outfit Feedback (private photo, processed & discarded)
  const [feedbackImg, setFeedbackImg] = useState<string | null>(null);
  const [feedbackMime, setFeedbackMime] = useState('image/jpeg');
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [feedbackResult, setFeedbackResult] = useState<AIOutfitFeedbackResponse | null>(null);

  // E. Fashion Chat
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    {
      role: 'assistant',
      content: 'Ask SWOOOSH AI about proportions, layering, or pairing pieces from your real wardrobe.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');

  // F. Missing Pieces
  const [gapsResult, setGapsResult] = useState<AIMissingPiecesResponse | null>(null);

  useEffect(() => {
    checkAIStatus().then(setQuota).catch(() => {});
  }, []);

  const findItem = (id?: string) => wardrobe.find((w) => w.id === id);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await generateAIOutfit(wardrobe, {
        occasion,
        style,
        colors,
        weather: weatherText,
        notes,
        cleanOnly,
      });
      setGenResult(res);
      if (res.quota) setQuota(res.quota);
    } catch (err: any) {
      onToast(err?.message || 'AI request failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleStyleRecs = async () => {
    setBusy(true);
    try {
      const res = await getAIStyleRecommendations(wardrobe, aesthetic);
      setStyleResult(res);
      if (res.quota) setQuota(res.quota);
    } catch (err: any) {
      onToast(err?.message || 'Style analysis failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleColorMatch = async () => {
    const target = findItem(targetId) || wardrobe[0];
    if (!target) {
      onToast('Add at least 1 piece to My Wardrobe first.', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await getAIColorMatch(target, wardrobe);
      setColorResult(res);
      if (res.quota) setQuota(res.quota);
    } catch (err: any) {
      onToast(err?.message || 'Color matching failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleFeedbackUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedbackMime(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = () => setFeedbackImg(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleRunFeedback = async () => {
    if (!feedbackImg) return;
    setBusy(true);
    try {
      const res = await getAIOutfitFeedback(feedbackImg, feedbackMime, feedbackNotes);
      setFeedbackResult(res);
      if (res.quota) setQuota(res.quota);
    } catch (err: any) {
      onToast(err?.message || 'Outfit feedback failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const next = [...chatHistory, { role: 'user' as const, content: chatInput.trim() }];
    setChatHistory(next);
    setChatInput('');
    setBusy(true);
    try {
      const res = await sendAIFashionChat(next, wardrobe);
      setChatHistory([...next, { role: 'assistant', content: res.reply }]);
      if (res.quota) setQuota(res.quota);
    } catch (err: any) {
      onToast(err?.message || 'Chat failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleMissingPieces = async () => {
    setBusy(true);
    try {
      const res = await getAIMissingPieces(wardrobe);
      setGapsResult(res);
      if (res.quota) setQuota(res.quota);
    } catch (err: any) {
      onToast(err?.message || 'Gap audit failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight">SWOOOSH AI</h1>
            <span className="px-2 py-0.5 rounded-chip text-[10px] font-mono-num uppercase tracking-wider border border-[#d4cfc5] dark:border-[#404040]">
              Private Stylist
            </span>
          </div>
          <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
            YOUR PERSONAL AI FASHION STYLIST. Styled strictly from your real wardrobe.
          </p>
        </div>

        {quota && (
          <div className="px-3.5 py-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-xs font-mono-num">
            {quota.remaining} of {quota.limit} AI requests left today
          </div>
        )}
      </div>

      {/* Feature Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { id: 'generator', label: 'Outfit Generator', Icon: Sparkles },
            { id: 'style', label: 'Aesthetic Guide', Icon: Compass },
            { id: 'color', label: 'Color Match', Icon: Palette },
            { id: 'feedback', label: 'Outfit Check (Photo)', Icon: Camera },
            { id: 'chat', label: 'Stylist Chat', Icon: MessageSquare },
            { id: 'gaps', label: 'Wardrobe Gaps', Icon: Layers },
          ] as { id: AITab; label: string; Icon: any }[]
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-3.5 py-2 rounded-control text-xs font-semibold border flex items-center gap-1.5 cursor-pointer ${
              tab === id
                ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                : 'border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab A: Outfit Generator */}
      {tab === 'generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleGenerate}
            className="lg:col-span-5 p-5 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-3.5"
          >
            <h2 className="font-display font-bold text-base">Generate From My Wardrobe</h2>
            <input
              type="text"
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              placeholder="Occasion (e.g., Gallery, Coffee)"
              className="w-full px-3 py-2 rounded-control text-sm bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
            />
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full px-3 py-2 rounded-control text-sm bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
            >
              {STYLE_CATEGORIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={colors}
              onChange={(e) => setColors(e.target.value)}
              placeholder="Color palette"
              className="w-full px-3 py-2 rounded-control text-sm bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
            />
            <input
              type="text"
              value={weatherText}
              onChange={(e) => setWeatherText(e.target.value)}
              placeholder="Weather"
              className="w-full px-3 py-2 rounded-control text-sm bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
            />
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any specific pieces or silhouettes?"
              className="w-full px-3 py-2 rounded-control text-xs bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
            />
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={cleanOnly}
                onChange={(e) => setCleanOnly(e.target.checked)}
                className="accent-[#171717] dark:accent-[#e5e1da]"
              />
              <span>Prefer Clean items only</span>
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 px-4 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{busy ? 'Styling...' : 'Generate Fits'}</span>
            </button>
          </form>

          <div className="lg:col-span-7 space-y-4">
            {!genResult ? (
              <div className="p-8 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-center text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
                Set your occasion & weather to build outfits strictly from the garments you own.
              </div>
            ) : (
              genResult.outfits.map((fit, idx) => {
                const items = [findItem(fit.topId), findItem(fit.bottomId), findItem(fit.shoesId)].filter(
                  Boolean
                );
                return (
                  <div
                    key={idx}
                    className="p-5 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display font-bold text-lg">{fit.outfitName}</h3>
                      <button
                        type="button"
                        onClick={async () => {
                          await addOutfit({
                            name: fit.outfitName,
                            styleCategory: style,
                            occasion: fit.occasion,
                            seasons: ['All-Season'],
                            tags: ['ai-styled'],
                            description: fit.explanation,
                            topId: fit.topId || undefined,
                            bottomId: fit.bottomId || undefined,
                            shoesId: fit.shoesId || undefined,
                            accessoryIds: fit.accessoryIds || [],
                            visibility: 'public',
                            allowRemix: true,
                            isFavorite: false,
                            source: 'ai',
                          });
                          onToast('Saved AI outfit to My Lookbook!');
                          onNavigate('lookbook');
                        }}
                        className="px-3 py-1.5 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Save to Lookbook</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {items.map((item) => (
                        <div
                          key={item!.id}
                          className="rounded-control border border-[#d4cfc5] dark:border-[#404040] overflow-hidden bg-[#f5f4f0] dark:bg-[#171717]"
                        >
                          <div className="aspect-square">
                            <GarmentImage src={item!.thumbUrl || item!.imageUrl} alt={item!.name} />
                          </div>
                          <p className="p-1.5 text-[11px] font-semibold truncate">{item!.name}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs leading-relaxed">{fit.explanation}</p>
                    <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
                      <strong>Styling tip:</strong> {fit.stylingTips}
                    </p>
                    {fit.missingNote && (
                      <p className="text-xs text-amber-700 dark:text-amber-300">{fit.missingNote}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab B: Style Aesthetic */}
      {tab === 'style' && (
        <div className="p-5 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {STYLE_CATEGORIES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setAesthetic(s)}
                className={`px-3 py-1.5 rounded-chip text-xs border cursor-pointer ${
                  aesthetic === s
                    ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                    : 'border-[#d4cfc5] dark:border-[#404040]'
                }`}
              >
                {s}
              </button>
            ))}
            <button
              type="button"
              onClick={handleStyleRecs}
              disabled={busy}
              className="ml-auto px-4 py-2 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold cursor-pointer"
            >
              {busy ? 'Analyzing...' : `Style ${aesthetic}`}
            </button>
          </div>
          {styleResult && (
            <div className="space-y-3 pt-2">
              <p className="text-sm">{styleResult.aestheticSummary}</p>
              {styleResult.combinations.map((c, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-control bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040] space-y-1"
                >
                  <p className="font-semibold text-sm">{c.title}</p>
                  <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">{c.howToWear}</p>
                </div>
              ))}
              {styleResult.gapsToConsider && (
                <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">{styleResult.gapsToConsider}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab C: Color Matching */}
      {tab === 'color' && (
        <div className="p-5 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="flex-1 px-3 py-2 rounded-control text-sm bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
            >
              {wardrobe.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.color})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleColorMatch}
              disabled={busy}
              className="px-5 py-2 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold cursor-pointer"
            >
              {busy ? 'Matching...' : 'Find Matches'}
            </button>
          </div>
          {colorResult && (
            <div className="space-y-3">
              <p className="text-sm">{colorResult.colorTheoryNote}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {colorResult.ownedMatches.map((m) => {
                  const piece = findItem(m.itemId);
                  return (
                    <div
                      key={m.itemId}
                      className="p-3 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717]"
                    >
                      <p className="text-xs font-bold">{piece?.name || m.itemId}</p>
                      <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8] mt-1">{m.reason}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab D: Outfit Photo Feedback (Processed & Discarded) */}
      {tab === 'feedback' && (
        <div className="p-5 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-4">
          <div className="flex items-center gap-2 text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>
              Private check (counts as 2 AI requests). Your photo is processed for styling notes only and never stored or shared.
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-start">
            <label className="px-4 py-2.5 rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold cursor-pointer">
              <span>{feedbackImg ? 'Change Fit Photo' : 'Upload Fit Photo'}</span>
              <input type="file" accept="image/*" onChange={handleFeedbackUpload} className="sr-only" />
            </label>
            <input
              type="text"
              value={feedbackNotes}
              onChange={(e) => setFeedbackNotes(e.target.value)}
              placeholder="Occasion or question (optional)"
              className="flex-1 px-3 py-2 rounded-control text-sm bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
            />
            <button
              type="button"
              onClick={handleRunFeedback}
              disabled={busy || !feedbackImg}
              className="px-5 py-2.5 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold cursor-pointer disabled:opacity-40"
            >
              {busy ? 'Analyzing...' : 'Analyze Fit'}
            </button>
          </div>

          {feedbackResult && (
            <div className="space-y-2.5 pt-2 text-xs leading-relaxed">
              <p className="text-sm font-semibold">{feedbackResult.overallImpression}</p>
              <p><strong>Color coordination:</strong> {feedbackResult.colorCoordination}</p>
              <p><strong>Proportions:</strong> {feedbackResult.proportionsAndSilhouette}</p>
              <p><strong>Balance:</strong> {feedbackResult.outfitBalance}</p>
              <ul className="list-disc pl-5 space-y-1">
                {feedbackResult.improvements.map((imp, idx) => (
                  <li key={idx}>{imp}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tab E: Stylist Chat */}
      {tab === 'chat' && (
        <div className="rounded-modal border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] overflow-hidden flex flex-col h-[500px]">
          <div className="flex-1 p-4 space-y-3 overflow-y-auto">
            {chatHistory.map((m, idx) => (
              <div
                key={idx}
                className={`max-w-[82%] p-3.5 rounded-card text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'ml-auto bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                    : 'bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]'
                }`}
              >
                {m.content}
              </div>
            ))}
          </div>
          <form
            onSubmit={handleSendChat}
            className="p-3 border-t border-[#d4cfc5] dark:border-[#404040] flex gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about proportions, layering, or pairing your items..."
              className="flex-1 px-3.5 py-2.5 rounded-control text-sm bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
            />
            <button
              type="submit"
              disabled={busy || !chatInput.trim()}
              aria-label="Send message"
              className="px-4 py-2.5 rounded-control bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] cursor-pointer disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Tab F: Wardrobe Gaps */}
      {tab === 'gaps' && (
        <div className="p-5 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-bold text-base">Silhouette & Category Audit</h2>
              <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
                Finds high-versatility piece types to unlock new combinations (no prices or shopping links).
              </p>
            </div>
            <button
              type="button"
              onClick={handleMissingPieces}
              disabled={busy}
              className="px-4 py-2 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold cursor-pointer"
            >
              {busy ? 'Auditing...' : 'Audit Wardrobe'}
            </button>
          </div>
          {gapsResult && (
            <div className="space-y-3">
              <p className="text-sm">{gapsResult.wardrobeSummary}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {gapsResult.suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-control bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040] space-y-1"
                  >
                    <p className="text-xs font-bold">
                      {s.pieceName} · {s.recommendedColor}
                    </p>
                    <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8]">{s.category}</p>
                    <p className="text-xs mt-1">{s.impactReason}</p>
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
