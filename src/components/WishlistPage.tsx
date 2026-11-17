import React, { useState } from 'react';
import { CLOTHING_CATEGORIES, STYLE_CATEGORIES, Visibility, WishlistItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { useWardrobe } from '../context/WardrobeContext';
import { uploadImageAsset } from '../services/storageService';
import { GarmentImage } from './GarmentImage';
import { VisibilityBadge } from './VisibilityBadge';
import { Plus, CheckCircle2, Trash2, ArrowRightCircle, Upload, X } from 'lucide-react';

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
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = wishlist.filter((w) => (filterStatus === 'all' ? true : w.status === filterStatus));

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !name.trim()) return;
    setSaving(true);
    try {
      let imageUrl: string | undefined;
      let thumbUrl: string | undefined;
      let mediaId: string | undefined;
      if (photoDataUrl) {
        const uploaded = await uploadImageAsset(photoDataUrl, userProfile.uid, visibility, isDemoMode);
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
        styleTags,
        priority,
        status: 'wanted',
        visibility,
        notes: notes.trim(),
        imageUrl,
        thumbUrl,
        mediaId,
      });

      setName('');
      setBrand('');
      setNotes('');
      setPhotoDataUrl(null);
      setModalOpen(false);
      onToast('Added to Wishlist.');
    } catch (err: any) {
      onToast(err?.message || 'Could not add wishlist item.', 'error');
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item: WishlistItem) => {
            const nextVis =
              item.visibility === 'private'
                ? 'public'
                : item.visibility === 'public'
                ? 'followers'
                : 'private';

            return (
              <article
                key={item.id}
                className="rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] overflow-hidden flex flex-col shadow-sm"
              >
                <div className="relative h-48 bg-[#eae7e0] dark:bg-[#171717]">
                  <GarmentImage
                    src={item.thumbUrl || item.imageUrl}
                    alt={item.name}
                    fallbackLabel={item.name}
                  />
                  <div className="absolute top-2.5 left-2.5">
                    <span className="px-2 py-1 rounded-chip text-[10px] font-mono-num uppercase tracking-wider bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]">
                      {item.priority} priority
                    </span>
                  </div>
                  <div className="absolute top-2.5 right-2.5">
                    <VisibilityBadge
                      visibility={item.visibility || 'private'}
                      onClick={() => editWishlist(item.id, { visibility: nextVis })}
                    />
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-[#4e4c46] dark:text-[#c2bfb8]">
                      <span className="font-semibold uppercase tracking-wider">{item.brand}</span>
                      <span>{item.category}</span>
                    </div>
                    <h3 className="font-display font-bold text-base">{item.name}</h3>
                    {item.notes && (
                      <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8] line-clamp-2">
                        {item.notes}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {item.colorTags?.map((c) => (
                        <span
                          key={c}
                          className="px-2 py-0.5 rounded-chip text-[10px] bg-[#eae7e0] dark:bg-[#303030]"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#d4cfc5]/70 dark:border-[#404040]/70 flex items-center justify-between gap-2">
                    {item.status === 'wanted' ? (
                      <button
                        type="button"
                        onClick={async () => {
                          await markWishlistGotItAndMove(item);
                          onToast(`Moved "${item.name}" to My Wardrobe!`);
                        }}
                        className="px-3 py-1.5 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
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
                        await removeWishlist(item);
                        onToast('Removed from Wishlist.');
                      }}
                      aria-label={`Delete ${item.name}`}
                      className="p-2 rounded-control hover:bg-red-500/15 text-red-600 dark:text-red-400 cursor-pointer"
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

      {/* Add Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wishlist-modal-title"
        >
          <div className="w-full max-w-md rounded-modal bg-[#f5f4f0] dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 id="wishlist-modal-title" className="font-display font-bold text-lg">
                Add to Wishlist
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
                className="p-2 rounded-control hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-3.5">
              {photoDataUrl ? (
                <div className="relative h-36 rounded-card overflow-hidden border border-[#d4cfc5] dark:border-[#404040]">
                  <GarmentImage src={photoDataUrl} alt="Wishlist preview" />
                  <button
                    type="button"
                    onClick={() => setPhotoDataUrl(null)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/70 text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 p-3.5 rounded-control border border-dashed border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#171717] text-xs cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>Upload reference photo (optional)</span>
                  <input type="file" accept="image/*" onChange={handleFile} className="sr-only" />
                </label>
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

              <div className="flex flex-wrap gap-1">
                {STYLE_CATEGORIES.slice(0, 5).map((tag) => {
                  const active = styleTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setStyleTags((prev) =>
                          prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]
                        )
                      }
                      className={`px-2 py-1 rounded-chip text-[11px] border cursor-pointer ${
                        active
                          ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                          : 'border-[#d4cfc5] dark:border-[#404040]'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

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
          </div>
        </div>
      )}
    </div>
  );
};
