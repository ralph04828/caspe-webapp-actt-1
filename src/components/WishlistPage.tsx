import React, { useMemo, useState } from 'react';
import { CLOTHING_CATEGORIES, Visibility, WishlistItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { useWardrobe } from '../context/WardrobeContext';
import { preparePreviewDataUrl, uploadImageAsset } from '../services/storageService';
import { dedupeStyleTags } from '../utils/styleTags';
import { GarmentImage } from './GarmentImage';
import { VisibilityBadge } from './VisibilityBadge';
import { PhotoCropState, PhotoEditorModal, createDefaultCropState } from './PhotoEditorModal';
import { PhotoPickerButton } from './PhotoPickerButton';
import { StyleTagSelector } from './StyleTagSelector';
import { DiscardDraftDialog } from './DiscardDraftDialog';
import { ErrorBoundary } from './ErrorBoundary';
import { AlertCircle, Plus, CheckCircle2, Trash2, ArrowRightCircle, X, Crop, Lock } from 'lucide-react';

interface WishlistPageProps {
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const WishlistPage: React.FC<WishlistPageProps> = ({ onToast }) => {
  const { userProfile, isDemoMode } = useAuth();
  const { wishlist, addWishlist, editWishlist, removeWishlist, markWishlistGotItAndMove } = useWardrobe();

  const [filterStatus, setFilterStatus] = useState<'all' | 'wanted' | 'got_it'>('all');
  const [modalOpen, setModalOpen] = useState(false);

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('Sneakers');
  const [colorInput, setColorInput] = useState('Charcoal');
  const [styleTags, setStyleTags] = useState<string[]>(['Streetwear']);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [notes, setNotes] = useState('');
  const [rawPhotoUrl, setRawPhotoUrl] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [cropState, setCropState] = useState<PhotoCropState | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [selectedWishId, setSelectedWishId] = useState<string | null>(null);

  const filtered = wishlist.filter((w) => (filterStatus === 'all' ? true : w.status === filterStatus));
  const selectedWish = useMemo(
    () => wishlist.find((w) => w.id === selectedWishId) || null,
    [wishlist, selectedWishId]
  );

  const hasUnsavedDraft = useMemo(
    () => Boolean(name.trim() || brand.trim() || notes.trim() || photoDataUrl || rawPhotoUrl),
    [name, brand, notes, photoDataUrl, rawPhotoUrl]
  );

  const resetModal = () => {
    setName('');
    setBrand('');
    setNotes('');
    setRawPhotoUrl(null);
    setPhotoDataUrl(null);
    setCropState(null);
    setCropModalOpen(false);
    setModalError(null);
    setDiscardOpen(false);
    setModalOpen(false);
  };

  const attemptCloseModal = () => {
    if (saving) return;
    if (hasUnsavedDraft) {
      setDiscardOpen(true);
      return;
    }
    resetModal();
  };

  const handleFile = async (file: File) => {
    setModalError(null);
    const compressedDataUrl = await preparePreviewDataUrl(file);
    setRawPhotoUrl(compressedDataUrl);
    setCropState(createDefaultCropState('1:1'));
    setCropModalOpen(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !name.trim() || saving) return;
    setSaving(true);
    setModalError(null);
    try {
      let imageUrl: string | undefined;
      let thumbUrl: string | undefined;
      let mediaId: string | undefined;
      const activePhoto = photoDataUrl || rawPhotoUrl;
      if (activePhoto) {
        const uploaded = await uploadImageAsset(activePhoto, userProfile.uid, visibility, isDemoMode);
        imageUrl = uploaded.imageUrl;
        thumbUrl = uploaded.thumbUrl;
        mediaId = uploaded.mediaId;
      }

      await addWishlist({
        name: name.trim(),
        brand: brand.trim() || 'Label',
        category,
        colorTags: colorInput
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
        styleTags: dedupeStyleTags(styleTags, userProfile.customStyles, 5),
        priority,
        status: 'wanted',
        visibility,
        notes: notes.trim(),
        imageUrl,
        thumbUrl,
        mediaId,
      });

      resetModal();
      onToast('Added to Wishlist.');
    } catch (err: any) {
      const msg = err?.message || 'Could not add wishlist item.';
      console.error('Wishlist save failed:', err);
      setModalError(msg);
      onToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Style Wishlist</h1>
          <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
            Track silhouettes and pieces on your radar—private by default, zero prices or store links.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-5 py-2.5 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Piece Idea</span>
        </button>
      </div>

      <div className="flex gap-1.5">
        {(
          [
            { id: 'all', label: `All (${wishlist.length})` },
            { id: 'wanted', label: 'Wanted' },
            { id: 'got_it', label: 'Got it' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterStatus(tab.id)}
            className={`px-3.5 py-1.5 rounded-chip text-xs font-semibold border cursor-pointer ${
              filterStatus === tab.id
                ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                : 'border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-center space-y-2">
          <p className="font-display font-bold text-base">Your wishlist is clear</p>
          <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
            Save inspiration pieces and move them to My Wardrobe once you own them.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-3">
          {filtered.map((item: WishlistItem) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedWishId(item.id)}
              className="group relative aspect-square rounded-control sm:rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-[#eae7e0] dark:bg-[#1e1e1e] overflow-hidden text-left cursor-pointer"
            >
              <GarmentImage
                src={item.thumbUrl || item.imageUrl}
                mediaId={item.mediaId}
                alt={item.name}
                fallbackLabel={item.name}
                className="w-full h-full object-cover object-center transition-transform duration-200 group-hover:scale-[1.03]"
              />
              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-chip text-[9px] font-mono-num uppercase bg-black/70 text-white">
                {item.priority}
              </span>
              {item.visibility === 'private' && (
                <span
                  aria-label="Private wishlist piece"
                  className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/65 text-white flex items-center justify-center"
                >
                  <Lock className="w-2.5 h-2.5" />
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 p-1.5 sm:p-2.5 bg-gradient-to-t from-black/80 via-black/35 to-transparent text-white">
                <p className="text-[11px] sm:text-xs font-semibold truncate">{item.name}</p>
                <p className="text-[9px] sm:text-[10px] opacity-80 truncate">
                  {item.brand} · {item.status === 'got_it' ? 'In Wardrobe' : item.category}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Wishlist Detail Modal */}
      {selectedWish && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wish-detail-title"
          onClick={() => setSelectedWishId(null)}
        >
          <div
            className="w-full max-w-md rounded-modal bg-[#f5f4f0] dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] overflow-hidden shadow-2xl max-h-[88vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-64 bg-[#eae7e0] dark:bg-[#171717] shrink-0">
              <GarmentImage
                src={selectedWish.thumbUrl || selectedWish.imageUrl}
                mediaId={selectedWish.mediaId}
                alt={selectedWish.name}
                fallbackLabel={selectedWish.name}
              />
              <button
                type="button"
                onClick={() => setSelectedWishId(null)}
                aria-label="Close wishlist item"
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/70 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute top-3 left-3">
                <span className="px-2.5 py-1 rounded-chip text-[10px] font-mono-num uppercase bg-black/75 text-white">
                  {selectedWish.priority} priority
                </span>
              </div>
            </div>

            <div className="p-5 overflow-y-auto space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                    {selectedWish.brand} · {selectedWish.category}
                  </p>
                  <h2 id="wish-detail-title" className="font-display font-bold text-lg mt-0.5">
                    {selectedWish.name}
                  </h2>
                </div>
                <VisibilityBadge
                  visibility={selectedWish.visibility || 'private'}
                  onClick={() => {
                    const nextVis =
                      selectedWish.visibility === 'private'
                        ? 'public'
                        : selectedWish.visibility === 'public'
                        ? 'followers'
                        : 'private';
                    editWishlist(selectedWish.id, { visibility: nextVis });
                  }}
                />
              </div>

              {selectedWish.notes && (
                <p className="text-xs leading-relaxed text-[#4e4c46] dark:text-[#c2bfb8]">
                  {selectedWish.notes}
                </p>
              )}

              {(selectedWish.colorTags?.length > 0 || selectedWish.styleTags?.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedWish.colorTags?.map((c) => (
                    <span
                      key={c}
                      className="px-2 py-0.5 rounded-chip text-[11px] bg-[#eae7e0] dark:bg-[#303030]"
                    >
                      {c}
                    </span>
                  ))}
                  {dedupeStyleTags(selectedWish.styleTags || []).map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-chip text-[11px] border border-[#d4cfc5] dark:border-[#404040]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-[#d4cfc5]/70 dark:border-[#404040]/70 flex items-center justify-between gap-2">
                {selectedWish.status === 'wanted' ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await markWishlistGotItAndMove(selectedWish);
                      onToast(`Moved "${selectedWish.name}" to My Wardrobe!`);
                      setSelectedWishId(null);
                    }}
                    className="px-4 py-2 min-h-[40px] rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowRightCircle className="w-3.5 h-3.5" />
                    <span>Got it → Wardrobe</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>In Wardrobe</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    await removeWishlist(selectedWish);
                    setSelectedWishId(null);
                    onToast('Removed from Wishlist.');
                  }}
                  aria-label={`Delete ${selectedWish.name}`}
                  className="px-3 py-2 min-h-[40px] rounded-control border border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wishlist-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) attemptCloseModal();
          }}
        >
          <div className="w-full max-w-md rounded-modal bg-[#f5f4f0] dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] p-6 space-y-4 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 id="wishlist-modal-title" className="font-display font-bold text-lg">
                Add to Wishlist
              </h2>
              <button
                type="button"
                onClick={attemptCloseModal}
                aria-label="Close modal"
                className="p-2 rounded-control hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ErrorBoundary title="Wishlist editor ran into an issue" onReset={() => setModalError(null)}>
              <form onSubmit={handleAdd} className="space-y-3.5">
                {modalError && (
                  <div
                    role="alert"
                    className="p-3 rounded-control border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{modalError}</span>
                  </div>
                )}

                {(photoDataUrl || rawPhotoUrl) ? (
                  <div className="relative h-36 rounded-card overflow-hidden border border-[#d4cfc5] dark:border-[#404040]">
                    <GarmentImage src={photoDataUrl || rawPhotoUrl || ''} alt="Wishlist preview" />
                    {rawPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setCropModalOpen(true)}
                        className="absolute bottom-2 left-2 px-2.5 py-1 rounded-chip bg-black/75 text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer hover:bg-black"
                      >
                        <Crop className="w-3 h-3" />
                        <span>Edit Crop</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setRawPhotoUrl(null);
                        setPhotoDataUrl(null);
                        setCropState(null);
                      }}
                      aria-label="Remove reference photo"
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/70 text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <PhotoPickerButton
                    label="Choose reference photo (optional)"
                    busyLabel="Preparing photo..."
                    className="w-full flex items-center justify-center gap-2 p-3.5 rounded-control border border-dashed border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#171717] text-xs font-semibold cursor-pointer"
                    onFileSelected={handleFile}
                    onError={(msg) => {
                      setModalError(msg);
                      onToast(msg, 'error');
                    }}
                  />
                )}

                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Piece name (e.g., Pleated Wide Wool Trousers)"
                  className="w-full px-3 py-2 rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                />

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Brand / Studio"
                    className="w-full px-3 py-2 rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                  />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                  >
                    {CLOTHING_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={colorInput}
                    onChange={(e) => setColorInput(e.target.value)}
                    placeholder="Colors (Charcoal, Bone)"
                    className="w-full px-3 py-2 rounded-control text-xs bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                  />
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-control text-xs bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                  >
                    <option value="high">High priority</option>
                    <option value="medium">Medium priority</option>
                    <option value="low">Low priority</option>
                  </select>
                </div>

                <StyleTagSelector
                  label="Style Tags"
                  selected={styleTags}
                  onChange={setStyleTags}
                  onError={(msg) => {
                    setModalError(msg);
                    onToast(msg, 'error');
                  }}
                />

                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as Visibility)}
                  className="w-full px-3 py-2 rounded-control text-xs bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                >
                  <option value="private">Private (Default — only visible to you)</option>
                  <option value="followers">Followers</option>
                  <option value="public">Public</option>
                </select>

                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="How this fits into your rotation..."
                  className="w-full px-3 py-2 rounded-control text-xs bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                />

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2.5 px-4 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save to Wishlist'}
                </button>
              </form>
            </ErrorBoundary>
          </div>
        </div>
      )}

      <PhotoEditorModal
        open={cropModalOpen && Boolean(rawPhotoUrl)}
        sourceUrl={rawPhotoUrl || ''}
        initialCrop={cropState}
        defaultAspect="1:1"
        allowAspectSwitch={true}
        title="Crop Wishlist Photo"
        subtitle="Frame your inspiration piece, then tap Done to keep it in your item."
        doneLabel="Done"
        onCancel={() => setCropModalOpen(false)}
        onChangePhotoFile={async (file) => {
          const compressed = await preparePreviewDataUrl(file);
          setRawPhotoUrl(compressed);
          setCropState(createDefaultCropState('1:1'));
        }}
        onDone={({ croppedDataUrl, cropState: nextCrop }) => {
          setPhotoDataUrl(croppedDataUrl);
          setCropState(nextCrop);
          setCropModalOpen(false);
        }}
      />

      <DiscardDraftDialog
        open={discardOpen}
        title="Discard wishlist item?"
        description="You have unsaved wishlist details or photos. Discarding will clear your draft."
        onKeep={() => setDiscardOpen(false)}
        onDiscard={resetModal}
      />
    </div>
  );
};
