import React, { useState } from 'react';
import { NavSection, Outfit, ShareLink, ShareVisibility } from '../types';
import { useWardrobe } from '../context/WardrobeContext';
import { useSocial } from '../context/SocialContext';
import { GarmentImage } from './GarmentImage';
import { VisibilityBadge } from './VisibilityBadge';
import {
  Heart,
  Edit3,
  Trash2,
  Share2,
  Link2,
  Copy,
  RefreshCw,
  ShieldOff,
  Repeat,
  Plus,
  X,
} from 'lucide-react';

interface LookbookPageProps {
  onNavigate: (section: NavSection) => void;
  onEditInBuilder: (outfit: Outfit) => void;
  onShareOutfitToFeed: (outfit: Outfit) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const LookbookPage: React.FC<LookbookPageProps> = ({
  onNavigate,
  onEditInBuilder,
  onShareOutfitToFeed,
  onToast,
}) => {
  const { outfits, wardrobe, toggleFavoriteOutfit, removeOutfit, editOutfit } = useWardrobe();
  const { shareLinks, createOrUpdateShareLink, revokeShareLink } = useSocial();

  const [filterFav, setFilterFav] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTargetOutfit, setShareTargetOutfit] = useState<Outfit | null>(null);
  const [shareVisibility, setShareVisibility] = useState<ShareVisibility>('unlisted');
  const [creatingLink, setCreatingLink] = useState(false);

  const visibleOutfits = filterFav ? outfits.filter((o) => o.isFavorite) : outfits;

  const resolvePiece = (id?: string) => wardrobe.find((w) => w.id === id);

  const handleOpenShareDialog = (outfit?: Outfit) => {
    setShareTargetOutfit(outfit || null);
    setShareModalOpen(true);
  };

  const handleCreateLink = async () => {
    setCreatingLink(true);
    try {
      const targetOutfits = shareTargetOutfit ? [shareTargetOutfit] : outfits;
      const link = await createOrUpdateShareLink({
        targetType: shareTargetOutfit ? 'outfit' : 'lookbook',
        targetId: shareTargetOutfit?.id,
        title: shareTargetOutfit ? shareTargetOutfit.name : 'My SWOOOSH Lookbook',
        description: shareTargetOutfit?.description || 'Curated outfits & style rotation on SWOOOSH.',
        visibility: shareVisibility,
        outfits: targetOutfits,
        wardrobe,
      });
      const shareUrl = `${window.location.origin}/?share=${link.token}`;
      await navigator.clipboard?.writeText(shareUrl).catch(() => {});
      onToast('Share link created & copied to clipboard!');
    } catch (err: any) {
      onToast(err?.message || 'Could not create share link.', 'error');
    } finally {
      setCreatingLink(false);
    }
  };

  const activeLinks = shareLinks.filter((l) => l.visibility !== 'revoked');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">My Lookbook</h1>
          <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
            Saved outfit combinations, style tags, remix controls, and shareable links.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterFav((prev) => !prev)}
            className={`px-3.5 py-2 rounded-control border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
              filterFav
                ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                : 'border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424]'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${filterFav ? 'fill-current' : ''}`} />
            <span>Favorites</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenShareDialog()}
            className="px-3.5 py-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Share Lookbook Link</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('builder')}
            className="px-4 py-2 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Fit</span>
          </button>
        </div>
      </div>

      {visibleOutfits.length === 0 ? (
        <div className="p-10 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-center space-y-2">
          <p className="font-display font-bold text-base">No saved outfits yet</p>
          <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
            Build your first combination in Fit Builder or ask SWOOOSH AI.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {visibleOutfits.map((outfit) => {
            const pieces = [
              resolvePiece(outfit.topId),
              resolvePiece(outfit.bottomId),
              resolvePiece(outfit.shoesId),
            ].filter(Boolean);

            const hasPrivatePiece = pieces.some((p) => p!.visibility === 'private');
            const cycleVis =
              outfit.visibility === 'public'
                ? 'followers'
                : outfit.visibility === 'followers'
                ? 'private'
                : 'public';

            return (
              <article
                key={outfit.id}
                className="rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] overflow-hidden flex flex-col shadow-sm"
              >
                <div className="p-3 bg-[#eae7e0] dark:bg-[#171717] grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((idx) => {
                    const p = pieces[idx];
                    return (
                      <div
                        key={idx}
                        className="aspect-square rounded-control overflow-hidden bg-white dark:bg-[#242424] border border-[#d4cfc5]/70 dark:border-[#404040]"
                      >
                        <GarmentImage
                          src={p?.thumbUrl || p?.imageUrl}
                          mediaId={p?.mediaId}
                          alt={p?.altText || 'Outfit piece'}
                          fallbackLabel={p?.name || 'Empty'}
                          isCutout={p?.isCutout}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded-chip text-[10px] font-mono-num uppercase tracking-wider bg-[#eae7e0] dark:bg-[#303030]">
                        {outfit.styleCategory}
                      </span>
                      <VisibilityBadge
                        visibility={outfit.visibility || 'public'}
                        onClick={() => editOutfit(outfit.id, { visibility: cycleVis })}
                      />
                    </div>
                    <h3 className="font-display font-bold text-base">{outfit.name}</h3>
                    {outfit.occasion && (
                      <p className="text-xs font-medium text-[#4e4c46] dark:text-[#c2bfb8]">
                        Occasion: {outfit.occasion}
                      </p>
                    )}
                    {outfit.description && (
                      <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8] line-clamp-2">
                        {outfit.description}
                      </p>
                    )}
                    {hasPrivatePiece && outfit.visibility !== 'private' && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        Includes a private wardrobe piece (hidden as &ldquo;Private piece&rdquo; for viewers).
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#d4cfc5]/70 dark:border-[#404040]/70 flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => toggleFavoriteOutfit(outfit)}
                      aria-label="Toggle favorite"
                      className="p-2 rounded-control hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
                    >
                      <Heart className={`w-4 h-4 ${outfit.isFavorite ? 'fill-current' : ''}`} />
                    </button>

                    <button
                      type="button"
                      onClick={() => onShareOutfitToFeed(outfit)}
                      title="Post outfit to social feed"
                      className="px-2.5 py-1.5 rounded-control hover:bg-[#eae7e0] dark:hover:bg-[#303030] text-xs font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Post</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenShareDialog(outfit)}
                      title="Get unlisted or public link"
                      className="p-2 rounded-control hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onEditInBuilder(outfit)}
                      title="Edit or swap one piece"
                      className="px-2.5 py-1.5 rounded-control hover:bg-[#eae7e0] dark:hover:bg-[#303030] text-xs font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Repeat className="w-3.5 h-3.5" />
                      <span>Remix</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        await removeOutfit(outfit);
                        onToast('Outfit deleted.');
                      }}
                      aria-label={`Delete ${outfit.name}`}
                      className="p-2 rounded-control hover:bg-red-500/15 text-red-600 dark:text-red-400 cursor-pointer ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Share Link Modal */}
      {shareModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-link-title"
        >
          <div className="w-full max-w-md rounded-modal bg-[#f5f4f0] dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 id="share-link-title" className="font-display font-bold text-lg">
                {shareTargetOutfit ? `Share "${shareTargetOutfit.name}"` : 'Share My Lookbook'}
              </h2>
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                aria-label="Close share dialog"
                className="p-2 rounded-control hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
              Generate a read-only link for anyone to view this outfit or lookbook. Private wardrobe items automatically display as &ldquo;Private piece&rdquo;.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {(['unlisted', 'public'] as ShareVisibility[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setShareVisibility(v)}
                  className={`py-2 px-3 rounded-control text-xs font-semibold border capitalize cursor-pointer ${
                    shareVisibility === v
                      ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                      : 'border-[#d4cfc5] dark:border-[#404040]'
                  }`}
                >
                  {v} Link
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleCreateLink}
              disabled={creatingLink}
              className="w-full py-2.5 px-4 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{creatingLink ? 'Generating...' : 'Generate & Copy Link'}</span>
            </button>

            {activeLinks.length > 0 && (
              <div className="pt-3 border-t border-[#d4cfc5] dark:border-[#404040] space-y-2 max-h-48 overflow-y-auto">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                  Active Share Links
                </p>
                {activeLinks.map((link: ShareLink) => {
                  const fullUrl = `${window.location.origin}/?share=${link.token}`;
                  return (
                    <div
                      key={link.token}
                      className="p-2.5 rounded-control bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040] flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{link.title}</p>
                        <p className="text-[10px] text-[#4e4c46] dark:text-[#c2bfb8] truncate">
                          {link.visibility} · {fullUrl}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(fullUrl);
                            onToast('Copied share link.');
                          }}
                          aria-label="Copy share URL"
                          className="p-1.5 rounded-control hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await revokeShareLink(link.token);
                            onToast('Share link revoked.');
                          }}
                          aria-label="Revoke share link"
                          className="p-1.5 rounded-control hover:bg-red-500/15 text-red-600 dark:text-red-400 cursor-pointer"
                        >
                          <ShieldOff className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
