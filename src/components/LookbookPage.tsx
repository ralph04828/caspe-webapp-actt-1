import React, { useMemo, useState } from 'react';
import { ClothingItem, NavSection, Outfit, STYLE_CATEGORIES } from '../types';
import { useWardrobe } from '../context/WardrobeContext';
import { formatShortDate } from '../utils/formatters';
import { GarmentImage } from './GarmentImage';
import { Heart, Search, Plus, Pencil, Trash2, X, Layers } from 'lucide-react';

interface LookbookPageProps {
  onNavigate: (section: NavSection) => void;
  onEditInBuilder: (outfit: Outfit) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const LookbookPage: React.FC<LookbookPageProps> = ({
  onNavigate,
  onEditInBuilder,
  onToast,
}) => {
  const { outfits, wardrobe, toggleFavoriteOutfit, editOutfit, removeOutfit } = useWardrobe();

  const [searchQuery, setSearchQuery] = useState('');
  const [styleFilter, setStyleFilter] = useState<string>('All');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const [viewingOutfit, setViewingOutfit] = useState<Outfit | null>(null);
  const [editingDetails, setEditingDetails] = useState<Outfit | null>(null);
  const [editName, setEditName] = useState('');
  const [editStyle, setEditStyle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const filteredOutfits = useMemo(() => {
    return outfits.filter((o) => {
      if (favoritesOnly && !o.isFavorite) return false;
      if (styleFilter !== 'All' && o.styleCategory !== styleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !o.name.toLowerCase().includes(q) &&
          !(o.description || '').toLowerCase().includes(q) &&
          !o.styleCategory.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [outfits, favoritesOnly, styleFilter, searchQuery]);

  const resolvePieces = (outfit: Outfit): ClothingItem[] => {
    const ids = [
      outfit.topId,
      outfit.bottomId,
      outfit.shoesId,
      ...(outfit.accessoryIds || []),
    ].filter(Boolean) as string[];
    return ids.map((id) => wardrobe.find((w) => w.id === id)).filter(Boolean) as ClothingItem[];
  };

  const openDetailsEdit = (outfit: Outfit) => {
    setEditingDetails(outfit);
    setEditName(outfit.name);
    setEditStyle(outfit.styleCategory);
    setEditDesc(outfit.description || '');
    setViewingOutfit(null);
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDetails || !editName.trim()) return;
    try {
      await editOutfit(editingDetails.id, {
        name: editName.trim(),
        styleCategory: editStyle,
        description: editDesc.trim(),
      });
      onToast(`Updated "${editName.trim()}".`);
      setEditingDetails(null);
    } catch (err: any) {
      onToast(err.message || 'Could not update outfit.', 'error');
    }
  };

  const handleDelete = async (outfit: Outfit) => {
    try {
      await removeOutfit(outfit);
      setViewingOutfit(null);
      onToast(`Removed "${outfit.name}" from Lookbook.`);
    } catch (err: any) {
      onToast(err.message || 'Could not delete outfit.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#d8d4ca] dark:border-[#404040]">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#5c5a54] dark:text-[#b0b0b0]">
            Editorial Outfit Archive
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight mt-1">
            My Lookbook
          </h1>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('builder')}
          className="px-4 py-2.5 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-semibold flex items-center gap-2 self-start cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Create in Fit Builder</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#5c5a54] dark:text-[#b0b0b0] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved outfits..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040]"
          />
        </div>

        <select
          value={styleFilter}
          onChange={(e) => setStyleFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040]"
        >
          <option value="All">All Styles</option>
          {STYLE_CATEGORIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setFavoritesOnly((prev) => !prev)}
          className={`px-3.5 py-2 text-xs font-medium border flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
            favoritesOnly
              ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-[#171717] dark:border-[#e5e1da]'
              : 'bg-white dark:bg-[#242424] border-[#d8d4ca] dark:border-[#404040]'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-current' : ''}`} />
          <span>Favorites Only</span>
        </button>
      </div>

      {/* Gallery */}
      {outfits.length === 0 ? (
        <div className="p-14 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] text-center space-y-3">
          <h3 className="font-display text-xl font-bold">No looks saved yet</h3>
          <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0] max-w-md mx-auto">
            Assemble combinations from your wardrobe in Fit Builder or generate looks with SWOOOSH AI.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('builder')}
            className="px-5 py-2.5 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-semibold cursor-pointer"
          >
            Open Fit Builder
          </button>
        </div>
      ) : filteredOutfits.length === 0 ? (
        <div className="p-12 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] text-center text-xs text-[#5c5a54] dark:text-[#b0b0b0]">
          No outfits match your current filter criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredOutfits.map((outfit) => {
            const pieces = resolvePieces(outfit);
            return (
              <article
                key={outfit.id}
                className="bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] hover:border-[#171717] dark:hover:border-[#e5e1da] transition-colors flex flex-col justify-between"
              >
                {/* Composed Outfit Collage */}
                <div
                  onClick={() => setViewingOutfit(outfit)}
                  className="grid grid-cols-2 gap-px bg-[#d8d4ca] dark:bg-[#404040] aspect-[4/3] cursor-pointer overflow-hidden"
                >
                  {pieces.length > 0 ? (
                    pieces.slice(0, 4).map((piece, idx) => (
                      <div
                        key={`${outfit.id}_${piece.id}_${idx}`}
                        className={`bg-[#eae7e0] dark:bg-[#303030] overflow-hidden ${
                          pieces.length === 1 ? 'col-span-2 row-span-2' : pieces.length === 2 ? 'row-span-2' : ''
                        }`}
                      >
                        <GarmentImage src={piece.imageUrl} alt={piece.name} />
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 flex items-center justify-center bg-[#eae7e0] dark:bg-[#303030] text-xs text-[#5c5a54] dark:text-[#b0b0b0]">
                      Empty Composition
                    </div>
                  )}
                </div>

                {/* Metadata & Actions */}
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      onClick={() => setViewingOutfit(outfit)}
                      className="cursor-pointer min-w-0"
                    >
                      <p className="text-[11px] text-[#5c5a54] dark:text-[#b0b0b0]">
                        {outfit.styleCategory} · {formatShortDate(outfit.createdAt)}
                        {outfit.source === 'ai' ? ' · SWOOOSH AI' : ''}
                      </p>
                      <h3 className="font-display text-lg font-bold truncate mt-0.5">
                        {outfit.name}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleFavoriteOutfit(outfit)}
                      aria-label={outfit.isFavorite ? 'Remove favorite' : 'Mark favorite'}
                      className="p-1.5 text-[#5c5a54] dark:text-[#b0b0b0] hover:text-[#171717] dark:hover:text-[#e5e1da] cursor-pointer"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          outfit.isFavorite
                            ? 'fill-[#171717] text-[#171717] dark:fill-[#e5e1da] dark:text-[#e5e1da]'
                            : ''
                        }`}
                      />
                    </button>
                  </div>

                  {outfit.description && (
                    <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0] line-clamp-2">
                      {outfit.description}
                    </p>
                  )}

                  <div className="pt-3 border-t border-[#d8d4ca] dark:border-[#404040] flex items-center justify-between text-xs">
                    <span className="font-mono-num text-[#5c5a54] dark:text-[#b0b0b0]">
                      {pieces.length} pieces
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setViewingOutfit(outfit)}
                        className="font-medium underline underline-offset-4 hover:opacity-75 cursor-pointer"
                      >
                        Inspect
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditInBuilder(outfit)}
                        className="font-medium underline underline-offset-4 hover:opacity-75 cursor-pointer"
                      >
                        Rebuild
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Inspect Outfit Modal */}
      {viewingOutfit && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#d8d4ca] dark:border-[#404040]">
              <div>
                <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0]">
                  {viewingOutfit.styleCategory} · Created {formatShortDate(viewingOutfit.createdAt)}
                </p>
                <h2 className="font-display text-2xl font-bold mt-1">{viewingOutfit.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setViewingOutfit(null)}
                className="p-1 text-[#5c5a54] dark:text-[#b0b0b0] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {viewingOutfit.description && (
              <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0] leading-relaxed">
                {viewingOutfit.description}
              </p>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0]">
                Included Garments
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {resolvePieces(viewingOutfit).map((piece) => (
                  <div
                    key={piece.id}
                    className="flex items-center gap-3 p-2.5 border border-[#d8d4ca] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#303030]"
                  >
                    <div className="w-14 h-14 shrink-0 overflow-hidden">
                      <GarmentImage src={piece.imageUrl} alt={piece.name} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{piece.name}</p>
                      <p className="text-[11px] text-[#5c5a54] dark:text-[#b0b0b0] truncate">
                        {piece.brand} · {piece.category} · {piece.color}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-[#d8d4ca] dark:border-[#404040] flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleDelete(viewingOutfit)}
                className="px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-500/10 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Outfit</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openDetailsEdit(viewingOutfit)}
                  className="px-3.5 py-2 text-xs font-medium border border-[#d8d4ca] dark:border-[#404040] flex items-center gap-1.5 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Info</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onEditInBuilder(viewingOutfit);
                    setViewingOutfit(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] flex items-center gap-1.5 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Edit in Fit Builder</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Outfit Metadata Modal */}
      {editingDetails && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#d8d4ca] dark:border-[#404040]">
              <h2 className="font-display text-lg font-bold">Edit Outfit Details</h2>
              <button
                type="button"
                onClick={() => setEditingDetails(null)}
                className="p-1 text-[#5c5a54] dark:text-[#b0b0b0] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveDetails} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                  Outfit Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                  Style Category
                </label>
                <select
                  value={editStyle}
                  onChange={(e) => setEditStyle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                >
                  {STYLE_CATEGORIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDetails(null)}
                  className="px-4 py-2 text-xs font-medium border border-[#d8d4ca] dark:border-[#404040] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
