import React, { useMemo, useState } from 'react';
import { CLOTHING_CATEGORIES, WishlistItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { useWardrobe } from '../context/WardrobeContext';
import { uploadImageAsset } from '../services/storageService';
import { formatCurrency } from '../utils/formatters';
import { GarmentImage } from './GarmentImage';
import { Plus, Upload, Check, Pencil, Trash2, ExternalLink, X } from 'lucide-react';

interface WishlistPageProps {
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const WishlistPage: React.FC<WishlistPageProps> = ({ onToast }) => {
  const { userProfile, isDemoMode } = useAuth();
  const { wishlist, addWishlist, editWishlist, removeWishlist, togglePurchasedWishlist } =
    useWardrobe();

  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'purchased'>('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('Sneakers');
  const [price, setPrice] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [storagePath, setStoragePath] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const filteredItems = useMemo(() => {
    return wishlist.filter((item) => {
      if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
      if (statusFilter === 'pending' && item.isPurchased) return false;
      if (statusFilter === 'purchased' && !item.isPurchased) return false;
      return true;
    });
  }, [wishlist, categoryFilter, statusFilter]);

  const unpurchasedTotal = useMemo(
    () => wishlist.filter((w) => !w.isPurchased).reduce((sum, w) => sum + (w.price || 0), 0),
    [wishlist]
  );

  const openCreate = () => {
    setEditingItem(null);
    setName('');
    setBrand('');
    setCategory('Sneakers');
    setPrice('');
    setProductUrl('');
    setNotes('');
    setImageUrl('');
    setStoragePath('');
    setFormOpen(true);
  };

  const openEdit = (item: WishlistItem) => {
    setEditingItem(item);
    setName(item.name);
    setBrand(item.brand);
    setCategory(item.category);
    setPrice(String(item.price));
    setProductUrl(item.productUrl || '');
    setNotes(item.notes || '');
    setImageUrl(item.imageUrl || '');
    setStoragePath(item.storagePath || '');
    setFormOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile) return;
    setUploading(true);
    try {
      const uploaded = await uploadImageAsset(file, userProfile.uid, 'wishlist', isDemoMode);
      setImageUrl(uploaded.imageUrl);
      setStoragePath(uploaded.storagePath);
      onToast('Product image uploaded.');
    } catch (err: any) {
      onToast(err.message || 'Image upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onToast('Product name is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        brand: brand.trim() || 'Independent',
        category,
        price: Number(price) || 0,
        productUrl: productUrl.trim(),
        notes: notes.trim(),
        imageUrl,
        storagePath,
      };
      if (editingItem) {
        await editWishlist(editingItem.id, payload);
        onToast(`Updated "${payload.name}".`);
      } else {
        await addWishlist({
          ...payload,
          isPurchased: false,
        });
        onToast(`Added "${payload.name}" to Wishlist.`);
      }
      setFormOpen(false);
    } catch (err: any) {
      onToast(err.message || 'Could not save wishlist item.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#d8d4ca] dark:border-[#404040]">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#5c5a54] dark:text-[#b0b0b0]">
            Acquisition Targets
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight mt-1">
            Wishlist
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0]">
              Estimated Unpurchased Cost
            </p>
            <p className="font-mono-num text-xl font-bold">{formatCurrency(unpurchasedTotal)}</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2.5 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-semibold flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-[#eae7e0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]">
          {(['all', 'pending', 'purchased'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors cursor-pointer ${
                statusFilter === status
                  ? 'bg-white dark:bg-[#171717] text-[#171717] dark:text-[#e5e1da]'
                  : 'text-[#5c5a54] dark:text-[#b0b0b0]'
              }`}
            >
              {status === 'pending' ? 'To Buy' : status}
            </button>
          ))}
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040]"
        >
          <option value="All">All Categories</option>
          {CLOTHING_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {wishlist.length === 0 ? (
        <div className="p-14 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] text-center space-y-3">
          <h3 className="font-display text-xl font-bold">Your wishlist is clear</h3>
          <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0] max-w-md mx-auto">
            Track upcoming footwear, jackets, and archive pieces with estimated prices and store links.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="px-5 py-2.5 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-semibold cursor-pointer"
          >
            Add Wishlist Piece
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-10 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] text-center text-xs text-[#5c5a54] dark:text-[#b0b0b0]">
          No wishlist items match this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => (
            <article
              key={item.id}
              className={`bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] flex flex-col justify-between ${
                item.isPurchased ? 'opacity-65' : ''
              }`}
            >
              <div>
                <div className="aspect-[4/3] bg-[#eae7e0] dark:bg-[#303030] overflow-hidden">
                  <GarmentImage src={item.imageUrl} alt={item.name} />
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] text-[#5c5a54] dark:text-[#b0b0b0]">
                        {item.brand} · {item.category}
                        {item.isPurchased ? ' · Purchased' : ''}
                      </p>
                      <h3 className="font-semibold text-sm truncate mt-0.5">{item.name}</h3>
                    </div>
                    <span className="font-mono-num text-sm font-bold shrink-0">
                      {formatCurrency(item.price)}
                    </span>
                  </div>
                  {item.notes && (
                    <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0] line-clamp-2">
                      {item.notes}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-4 pt-3 border-t border-[#d8d4ca] dark:border-[#404040] flex items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => togglePurchasedWishlist(item)}
                  className={`px-2.5 py-1.5 border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                    item.isPurchased
                      ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-[#171717] dark:border-[#e5e1da]'
                      : 'border-[#d8d4ca] dark:border-[#404040] hover:border-[#171717] dark:hover:border-[#e5e1da]'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{item.isPurchased ? 'Purchased' : 'Mark Purchased'}</span>
                </button>

                <div className="flex items-center gap-1.5">
                  {item.productUrl && (
                    <a
                      href={item.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open Store Link"
                      className="p-1.5 border border-[#d8d4ca] dark:border-[#404040] hover:border-[#171717] dark:hover:border-[#e5e1da]"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    title="Edit item"
                    className="p-1.5 border border-[#d8d4ca] dark:border-[#404040] hover:border-[#171717] dark:hover:border-[#e5e1da] cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeWishlist(item).then(() => onToast(`Deleted "${item.name}".`))}
                    title="Delete item"
                    className="p-1.5 border border-[#d8d4ca] dark:border-[#404040] text-red-600 dark:text-red-400 hover:border-red-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#d8d4ca] dark:border-[#404040]">
              <h2 className="font-display text-lg font-bold">
                {editingItem ? 'Edit Wishlist Item' : 'Add Wishlist Item'}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-1 text-[#5c5a54] dark:text-[#b0b0b0] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 shrink-0 bg-[#eae7e0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040] overflow-hidden">
                  <GarmentImage src={imageUrl} alt={name || 'Product'} />
                </div>
                <label className="inline-flex items-center gap-2 px-3.5 py-2 border border-[#d8d4ca] dark:border-[#404040] text-xs font-medium cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Uploading...' : 'Upload Product Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                  >
                    {CLOTHING_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                    Store Link (Optional)
                  </label>
                  <input
                    type="url"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#d8d4ca] dark:border-[#404040]">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 text-xs font-medium border border-[#d8d4ca] dark:border-[#404040] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="px-5 py-2 text-xs font-semibold bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] cursor-pointer"
                >
                  {saving ? 'Saving...' : editingItem ? 'Update Item' : 'Add to Wishlist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
