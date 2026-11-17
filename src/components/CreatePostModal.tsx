import React, { useEffect, useState } from 'react';
import { CommentPolicy, PostType, Visibility } from '../types';
import { useAuth } from '../context/AuthContext';
import { useWardrobe } from '../context/WardrobeContext';
import { useSocial } from '../context/SocialContext';
import { uploadImageAsset } from '../services/storageService';
import { removeBackgroundClient } from '../utils/bgRemoval';
import { GarmentImage } from './GarmentImage';
import {
  X,
  Upload,
  Sparkles,
  Scissors,
  Globe,
  Users,
  Lock,
  Repeat,
  Loader2,
} from 'lucide-react';

interface CreatePostModalProps {
  open: boolean;
  initialOutfitId?: string;
  initialItemId?: string;
  onClose: () => void;
  onPublished: (message: string) => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  open,
  initialOutfitId,
  initialItemId,
  onClose,
  onPublished,
}) => {
  const { userProfile, isDemoMode } = useAuth();
  const { wardrobe, outfits } = useWardrobe();
  const { publishPost } = useSocial();

  const [postType, setPostType] = useState<PostType>(
    initialOutfitId ? 'outfit' : initialItemId ? 'piece' : 'outfit'
  );
  const [selectedOutfitId, setSelectedOutfitId] = useState(initialOutfitId || outfits[0]?.id || '');
  const [selectedItemId, setSelectedItemId] = useState(initialItemId || wardrobe[0]?.id || '');
  const [caption, setCaption] = useState('');
  const [occasion, setOccasion] = useState('');
  const [visibility, setVisibility] = useState<Visibility>(userProfile?.defaultOutfitVisibility || 'public');
  const [allowRemix, setAllowRemix] = useState(true);
  const [commentPolicy, setCommentPolicy] = useState<CommentPolicy>('everyone');

  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [cutoutDataUrl, setCutoutDataUrl] = useState<string | null>(null);
  const [useCutout, setUseCutout] = useState(false);
  const [bgProcessing, setBgProcessing] = useState(false);
  const [altText, setAltText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialOutfitId) {
      setPostType('outfit');
      setSelectedOutfitId(initialOutfitId);
    } else if (initialItemId) {
      setPostType('piece');
      setSelectedItemId(initialItemId);
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, initialOutfitId, initialItemId, onClose]);

  if (!open) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setCutoutDataUrl(null);
    setUseCutout(false);
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleRemoveBackground = async () => {
    if (!photoDataUrl) return;
    setBgProcessing(true);
    setError(null);
    try {
      const res = await removeBackgroundClient(photoDataUrl, 36);
      setCutoutDataUrl(res.cutoutDataUrl);
      setUseCutout(true);
    } catch (err: any) {
      setError(err?.message || 'Background removal unavailable for this image; keeping original.');
    } finally {
      setBgProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setError(null);

    if (!caption.trim()) {
      setError('Add a caption or #hashtags to share your post.');
      return;
    }

    const chosenOutfit = postType === 'outfit' ? outfits.find((o) => o.id === selectedOutfitId) : undefined;
    const chosenItem = postType === 'piece' ? wardrobe.find((w) => w.id === selectedItemId) : undefined;

    if (postType === 'outfit' && !chosenOutfit && !photoDataUrl) {
      setError('Select an outfit from My Lookbook or upload a photo.');
      return;
    }
    if (postType === 'piece' && !chosenItem) {
      setError('Select a wardrobe piece to highlight.');
      return;
    }
    if (postType === 'ootd' && !photoDataUrl) {
      setError('Upload a photo for your Outfit of the Day post.');
      return;
    }

    setSubmitting(true);
    try {
      let uploaded: { imageUrl: string; thumbUrl: string; mediaId: string } | undefined;
      const activeDataUrl = useCutout && cutoutDataUrl ? cutoutDataUrl : photoDataUrl;
      if (activeDataUrl) {
        uploaded = await uploadImageAsset(activeDataUrl, userProfile.uid, visibility, isDemoMode);
      }

      await publishPost({
        postType,
        caption,
        visibility,
        allowRemix,
        commentPolicy,
        outfit: chosenOutfit,
        item: chosenItem,
        wardrobe,
        mediaUrl: uploaded?.imageUrl,
        thumbUrl: uploaded?.thumbUrl,
        mediaId: uploaded?.mediaId,
        altText: altText.trim() || undefined,
        occasion: occasion.trim() || undefined,
        styleTags: chosenOutfit
          ? [chosenOutfit.styleCategory, ...(chosenOutfit.tags || []).slice(0, 2)]
          : chosenItem?.styleTags || ['Streetwear'],
      });

      setCaption('');
      setPhotoDataUrl(null);
      setCutoutDataUrl(null);
      setAltText('');
      onPublished('Shared to the SWOOOSH feed.');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not publish post.');
    } finally {
      setSubmitting(false);
    }
  };

  const previewDataUrl = useCutout && cutoutDataUrl ? cutoutDataUrl : photoDataUrl;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-post-title"
    >
      <div className="w-full max-w-lg rounded-modal bg-[#f5f4f0] dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] shadow-2xl overflow-hidden my-auto">
        <div className="px-6 py-4 border-b border-[#d4cfc5] dark:border-[#404040] flex items-center justify-between">
          <div>
            <h2 id="create-post-title" className="font-display font-bold text-lg">
              Share Your Fit
            </h2>
            <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
              Post an outfit, wardrobe piece, or daily fit photo.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close create post dialog"
            className="p-2 rounded-control hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div role="alert" className="p-3 rounded-control border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs">
              {error}
            </div>
          )}

          {/* Post Type Tabs */}
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'outfit', label: 'Outfit' },
                { id: 'piece', label: 'Piece' },
                { id: 'ootd', label: 'OOTD Photo' },
              ] as { id: PostType; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPostType(tab.id)}
                className={`py-2 px-3 rounded-control text-xs font-semibold border transition-colors cursor-pointer ${
                  postType === tab.id
                    ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                    : 'border-[#d4cfc5] dark:border-[#404040] hover:bg-[#eae7e0] dark:hover:bg-[#303030]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {postType === 'outfit' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                Choose from My Lookbook
              </label>
              <select
                value={selectedOutfitId}
                onChange={(e) => setSelectedOutfitId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
              >
                {outfits.length === 0 && <option value="">No saved outfits yet</option>}
                {outfits.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.styleCategory})
                  </option>
                ))}
              </select>
            </div>
          )}

          {postType === 'piece' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                Choose from My Wardrobe
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
              >
                {wardrobe.length === 0 && <option value="">No wardrobe items yet</option>}
                {wardrobe.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {item.brand} ({item.color})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Optional or OOTD Photo Upload */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                {postType === 'ootd' ? 'OOTD Photo (Required)' : 'Cover Photo (Optional)'}
              </label>
              {photoDataUrl && (
                <button
                  type="button"
                  onClick={handleRemoveBackground}
                  disabled={bgProcessing}
                  className="text-[11px] font-medium inline-flex items-center gap-1 px-2 py-1 rounded-chip border border-[#d4cfc5] dark:border-[#404040] hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
                >
                  {bgProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Scissors className="w-3 h-3" />}
                  <span>{bgProcessing ? 'Processing...' : 'Remove background'}</span>
                </button>
              )}
            </div>

            {previewDataUrl ? (
              <div className="space-y-2">
                <div className="relative h-48 rounded-card overflow-hidden border border-[#d4cfc5] dark:border-[#404040] bg-[#eae7e0] dark:bg-[#171717]">
                  <GarmentImage src={previewDataUrl} alt="Upload preview" isCutout={useCutout} />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoDataUrl(null);
                      setCutoutDataUrl(null);
                    }}
                    aria-label="Remove photo"
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {cutoutDataUrl && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setUseCutout(false)}
                      className={`px-3 py-1 rounded-chip border cursor-pointer ${
                        !useCutout
                          ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                          : 'border-[#d4cfc5] dark:border-[#404040]'
                      }`}
                    >
                      Keep Original
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseCutout(true)}
                      className={`px-3 py-1 rounded-chip border cursor-pointer ${
                        useCutout
                          ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                          : 'border-[#d4cfc5] dark:border-[#404040]'
                      }`}
                    >
                      Use Cutout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-5 rounded-card border border-dashed border-[#d4cfc5] dark:border-[#404040] bg-white/60 dark:bg-[#171717]/60 hover:bg-white dark:hover:bg-[#171717] transition-colors cursor-pointer">
                <Upload className="w-5 h-5 mb-1.5 opacity-70" />
                <span className="text-xs font-medium">Upload photo (compressed automatically)</span>
                <input type="file" accept="image/*" onChange={handleFileChange} className="sr-only" />
              </label>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
              Caption (#hashtags & @mentions supported)
            </label>
            <textarea
              rows={3}
              required
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Rainy morning studio layers. #streetwear #monochrome"
              className="w-full px-3.5 py-2.5 rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                Occasion
              </label>
              <input
                type="text"
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                placeholder="Studio, Coffee, Gallery"
                className="w-full px-3 py-2 rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                Image Alt Text (Accessibility)
              </label>
              <input
                type="text"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Describe the outfit photo"
                className="w-full px-3 py-2 rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
              />
            </div>
          </div>

          {/* Visibility & Comment Policy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                Who can see this
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'public', label: 'Public', Icon: Globe },
                    { id: 'followers', label: 'Followers', Icon: Users },
                    { id: 'private', label: 'Private', Icon: Lock },
                  ] as { id: Visibility; label: string; Icon: any }[]
                ).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setVisibility(id)}
                    className={`py-2 px-2 rounded-control text-[11px] font-medium border flex items-center justify-center gap-1 cursor-pointer ${
                      visibility === id
                        ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                        : 'border-[#d4cfc5] dark:border-[#404040]'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                Who can comment
              </label>
              <select
                value={commentPolicy}
                onChange={(e) => setCommentPolicy(e.target.value as CommentPolicy)}
                className="w-full px-3 py-2 rounded-control text-xs bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
              >
                <option value="everyone">Everyone</option>
                <option value="followers">Followers only</option>
                <option value="off">Comments off</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-xs text-[#4e4c46] dark:text-[#c2bfb8] cursor-pointer">
            <input
              type="checkbox"
              checked={allowRemix}
              onChange={(e) => setAllowRemix(e.target.checked)}
              className="w-4 h-4 accent-[#171717] dark:accent-[#e5e1da]"
            />
            <Repeat className="w-3.5 h-3.5" />
            <span>Allow others to remix this fit with pieces from their wardrobe</span>
          </label>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-control text-xs font-semibold border border-[#d4cfc5] dark:border-[#404040] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center gap-2 hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{submitting ? 'Sharing...' : 'Publish Post'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
