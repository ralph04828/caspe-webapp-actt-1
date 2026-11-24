import React, { useMemo, useState } from 'react';
import { ClothingItem, NavSection, Outfit, ShareLink, ShareVisibility } from '../types';
import { useWardrobe } from '../context/WardrobeContext';
import { useSocial } from '../context/SocialContext';
import {
  getOutfitAccessoryIds,
  getOutfitAllItemIds,
  getOutfitTopIds,
  getTopLayerLabels,
} from '../utils/outfitLayers';
import { GarmentImage } from './GarmentImage';
import { OutfitCollageThumb } from './OutfitCollageThumb';
import { VisibilityBadge } from './VisibilityBadge';
import {
  Heart,
  Trash2,
  Share2,
  Link2,
  Copy,
  RefreshCw,
  ShieldOff,
  Repeat,
  Plus,
  X,
  Lock,
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
  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTargetOutfit, setShareTargetOutfit] = useState<Outfit | null>(null);
  const [shareVisibility, setShareVisibility] = useState<ShareVisibility>('unlisted');
  const [creatingLink, setCreatingLink] = useState(false);

  const visibleOutfits = filterFav ? outfits.filter((o) => o.isFavorite) : outfits;
  const detailOutfit = useMemo(
    () => outfits.find((o) => o.id === selectedOutfitId) || null,
    [outfits, selectedOutfitId]
  );

  const resolvePiece = (id?: string) => wardrobe.find((w) => w.id === id);

  const getOutfitPiecesDetailed = (outfit: Outfit) => {
    const topIds = getOutfitTopIds(outfit);
    const topLabels = getTopLayerLabels(topIds.length);
    const rows: { label: string; item: ClothingItem }[] = [];
    topIds.forEach((id, idx) => {
      const item = resolvePiece(id);
      if (item) rows.push({ label: topLabels[idx] || 'Top', item });
    });
    const bottom = resolvePiece(outfit.bottomId);
    if (bottom) rows.push({ label: 'Bottom', item: bottom });
    const shoes = resolvePiece(outfit.shoesId);
    if (shoes) rows.push({ label: 'Footwear', item: shoes });
    getOutfitAccessoryIds(outfit).forEach((id) => {
      const acc = resolvePiece(id);
      if (acc) rows.push({ label: 'Accessory', item: acc });
    });
    return rows;
  };

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
            Saved outfit combinations, layered silhouettes, remix controls, and shareable links.
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
            Build your first combination in Fit Builder or remix a community fit.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-3">
          {visibleOutfits.map((outfit) => {
            const totalPieces = getOutfitAllItemIds(outfit).length;
            return (
              <button
                key={outfit.id}
                type="button"
                onClick={() => setSelectedOutfitId(outfit.id)}
                className="group relative rounded-sm sm:rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] overflow-hidden text-left shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#171717] dark:focus-visible:ring-[#e5e1da]"
              >
                <div className="relative aspect-square overflow-hidden">
                  <OutfitCollageThumb outfit={outfit} wardrobe={wardrobe} />
                  {outfit.isFavorite && (
                    <span
                      aria-label="Favorite outfit"
                      className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/65 text-white flex items-center justify-center"
                    >
                      <Heart className="w-3 h-3 fill-current" />
                    </span>
                  )}
                  {outfit.visibility === 'private' && (
                    <span
                      aria-label="Private outfit"
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/65 text-white flex items-center justify-center"
                    >
                      <Lock className="w-3 h-3" />
                    </span>
                  )}
                </div>
                <div className="p-2 sm:p-3 space-y-0.5">
                  <p className="text-[11px] sm:text-xs font-display font-bold truncate">
                    {outfit.name}
                  </p>
                  <p className="text-[10px] text-[#4e4c46] dark:text-[#c2bfb8] truncate">
                    {outfit.styleCategory} · {totalPieces} {totalPieces === 1 ? 'piece' : 'pieces'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Outfit Detail Modal */}
      {detailOutfit && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lookbook-detail-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedOutfitId(null);
          }}
        >
          {(() => {
            const detailedPieces = getOutfitPiecesDetailed(detailOutfit);
            const hasPrivatePiece = detailedPieces.some((p) => p.item.visibility === 'private');
            const cycleVis =
              detailOutfit.visibility === 'public'
                ? 'friends'
                : detailOutfit.visibility === 'friends'
                ? 'followers'
                : detailOutfit.visibility === 'followers'
                ? 'private'
                : 'public';

            return (
              <div className="w-full max-w-lg rounded-modal bg-[#f5f4f0] dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] shadow-2xl overflow-hidden my-auto">
                <div className="px-5 py-4 border-b border-[#d4cfc5] dark:border-[#404040] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-chip text-[10px] font-mono-num uppercase tracking-wider bg-[#eae7e0] dark:bg-[#303030]">
                        {detailOutfit.styleCategory}
                      </span>
                      <VisibilityBadge
                        visibility={detailOutfit.visibility || 'public'}
                        onClick={() => editOutfit(detailOutfit.id, { visibility: cycleVis })}
                      />
                    </div>
                    <h2 id="lookbook-detail-title" className="font-display font-bold text-lg truncate mt-1">
                      {detailOutfit.name}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedOutfitId(null)}
                    aria-label="Close outfit details"
                    className="w-10 h-10 rounded-control flex items-center justify-center hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                  {detailOutfit.occasion && (
                    <p className="text-xs font-medium text-[#4e4c46] dark:text-[#c2bfb8]">
                      Occasion: {detailOutfit.occasion}
                    </p>
                  )}
                  {detailOutfit.description && (
                    <p className="text-xs leading-relaxed text-[#4e4c46] dark:text-[#c2bfb8]">
                      {detailOutfit.description}
                    </p>
                  )}
                  {hasPrivatePiece && detailOutfit.visibility !== 'private' && (
                    <p className="text-[11px] p-2.5 rounded-control bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300">
                      Includes a private wardrobe piece (shown as &ldquo;Private piece&rdquo; for viewers).
                    </p>
                  )}

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                      All Pieces ({detailedPieces.length})
                    </p>
                    {detailedPieces.length === 0 ? (
                      <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">No pieces attached.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {detailedPieces.map(({ label, item }, idx) => (
                          <div
                            key={`${item.id}_${idx}`}
                            className="rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#171717] overflow-hidden"
                          >
                            <div className="aspect-square bg-[#eae7e0] dark:bg-[#242424]">
                              <GarmentImage
                                src={item.thumbUrl || item.imageUrl}
                                mediaId={item.mediaId}
                                alt={item.altText || item.name}
                                isCutout={item.isCutout}
                              />
                            </div>
                            <div className="p-2">
                              <p className="text-[10px] font-mono-num uppercase text-[#4e4c46] dark:text-[#b0b0b0]">
                                {label}
                              </p>
                              <p className="text-xs font-semibold truncate">{item.name}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#d4cfc5] dark:border-[#404040] flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleFavoriteOutfit(detailOutfit)}
                      className="px-3 py-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#171717] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Heart className={`w-3.5 h-3.5 ${detailOutfit.isFavorite ? 'fill-current' : ''}`} />
                      <span>{detailOutfit.isFavorite ? 'Favorited' : 'Favorite'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOutfitId(null);
                        onShareOutfitToFeed(detailOutfit);
                      }}
                      className="px-3.5 py-2 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Post to feed</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOutfitId(null);
                        handleOpenShareDialog(detailOutfit);
                      }}
                      className="px-3 py-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#171717] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Share link</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOutfitId(null);
                        onEditInBuilder(detailOutfit);
                      }}
                      className="px-3 py-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#171717] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Repeat className="w-3.5 h-3.5" />
                      <span>Edit / Remix</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        await removeOutfit(detailOutfit);
                        setSelectedOutfitId(null);
                        onToast('Outfit deleted.');
                      }}
                      aria-label={`Delete ${detailOutfit.name}`}
                      className="px-3 py-2 rounded-control border border-red-500/40 text-red-600 dark:text-red-400 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
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
