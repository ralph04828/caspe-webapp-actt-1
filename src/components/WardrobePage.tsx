import React, { useMemo, useState } from 'react';
import { CLOTHING_CATEGORIES, ClothingCategory, ClothingItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { useWardrobe } from '../context/WardrobeContext';
import { uploadImageAsset } from '../services/storageService';
import { calculateCostPerWear, formatCurrency, formatShortDate } from '../utils/formatters';
import { GarmentImage } from './GarmentImage';
import { Plus, Search, X, Upload, Pencil, Trash2, Check } from 'lucide-react';

interface WardrobePageProps {
  openAddModalOnMount?: boolean;
  onConsumedOpenAdd?: () => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

type SortOrder = 'newest' | 'oldest' | 'name';

export const WardrobePage: React.FC<WardrobePageProps> = ({
  openAddModalOnMount,
  onConsumedOpenAdd,
  onToast,
}) => {
  const { userProfile, isDemoMode } = useAuth();
  const { wardrobe, addClothing, editClothing, removeClothing, logWear } = useWardrobe();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [colorFilter, setColorFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortOrder>('newest');

  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  const [formOpen, setFormOpen] = useState(Boolean(openAddModalOnMount));
  const [editingItem, setEditingItem] = useState<ClothingItem | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ClothingCategory>('T-shirts');
  const [brand, setBrand] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [price, setPrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [storagePath, setStoragePath] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (openAddModalOnMount) {
      openCreateForm();
      onConsumedOpenAdd?.();
    }
  }, [openAddModalOnMount]);

  const availableColors = useMemo(() => {
    const set = new Set<string>();
    wardrobe.forEach((item) => {
      if (item.color?.trim()) set.add(item.color.trim());
    });
    return ['All', ...Array.from(set).sort()];
  }, [wardrobe]);

  const filteredItems = useMemo(() => {
    let list = [...wardrobe];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.brand.toLowerCase().includes(q) ||
          i.color.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== 'All') {
      list = list.filter((i) => i.category === categoryFilter);
    }
    if (colorFilter !== 'All') {
      list = list.filter((i) => i.color.trim() === colorFilter);
    }
    list.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [wardrobe, searchQuery, categoryFilter, colorFilter, sortBy]);

  const openCreateForm = () => {
    setEditingItem(null);
    setName('');
    setCategory('T-shirts');
    setBrand('');
    setColor('');
    setSize('M');
    setPrice('');
    setPurchaseDate('');
    setDescription('');
    setImageUrl('');
    setStoragePath('');
    setFormOpen(true);
  };

  const openEditForm = (item: ClothingItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setBrand(item.brand);
    setColor(item.color);
    setSize(item.size);
    setPrice(String(item.price));
    setPurchaseDate(item.purchaseDate || '');
    setDescription(item.description || '');
    setImageUrl(item.imageUrl || '');
    setStoragePath(item.storagePath || '');
    setSelectedItem(null);
    setFormOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile) return;
    setUploadingImage(true);
    try {
      const uploaded = await uploadImageAsset(file, userProfile.uid, 'wardrobe', isDemoMode);
      setImageUrl(uploaded.imageUrl);
      setStoragePath(uploaded.storagePath);
      onToast('Photo uploaded successfully.');
    } catch (err: any) {
      onToast(err.message || 'Image upload failed.', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onToast('Item name is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        brand: brand.trim() || 'Unbranded',
        color: color.trim() || 'Black',
        size: size.trim() || 'OS',
        price: Number(price) || 0,
        purchaseDate: purchaseDate.trim(),
        description: description.trim(),
        imageUrl,
        storagePath,
      };

      if (editingItem) {
        await editClothing(editingItem.id, payload);
        onToast(`Updated "${payload.name}".`);
      } else {
        await addClothing({
          ...payload,
          wearCount: 0,
        });
        onToast(`Added "${payload.name}" to My Wardrobe.`);
      }
      setFormOpen(false);
    } catch (err: any) {
      onToast(err.message || 'Could not save clothing item.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: ClothingItem) => {
    try {
      await removeClothing(item);
      setSelectedItem(null);
      onToast(`Deleted "${item.name}".`);
    } catch (err: any) {
      onToast(err.message || 'Could not delete item.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#d8d4ca] dark:border-[#404040]">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#5c5a54] dark:text-[#b0b0b0]">
            Driplog Catalog
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight mt-1">
            My Wardrobe
          </h1>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="px-4 py-2.5 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity self-start cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Add Clothing</span>
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#5c5a54] dark:text-[#b0b0b0] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items or brands..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] focus:outline-none focus:border-[#171717] dark:focus:border-[#e5e1da]"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by category"
          className="px-3 py-2 text-xs bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] focus:outline-none cursor-pointer"
        >
          <option value="All">All Categories ({wardrobe.length})</option>
          {CLOTHING_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          value={colorFilter}
          onChange={(e) => setColorFilter(e.target.value)}
          aria-label="Filter by color"
          className="px-3 py-2 text-xs bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] focus:outline-none cursor-pointer"
        >
          {availableColors.map((col) => (
            <option key={col} value={col}>
              {col === 'All' ? 'All Colors' : col}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOrder)}
          aria-label="Sort clothing items"
          className="px-3 py-2 text-xs bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] focus:outline-none cursor-pointer"
        >
          <option value="newest">Sort: Newest First</option>
          <option value="oldest">Sort: Oldest First</option>
          <option value="name">Sort: Name (A–Z)</option>
        </select>
      </div>

      {/* Empty State or Grid */}
      {wardrobe.length === 0 ? (
        <div className="p-14 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] text-center space-y-4">
          <h3 className="font-display text-xl font-bold">Your digital wardrobe is empty</h3>
          <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0] max-w-md mx-auto">
            Upload your t-shirts, hoodies, trousers, sneakers, and accessories to unlock Fit Builder, Outfit Planner, and SWOOOSH AI styling.
          </p>
          <button
            type="button"
            onClick={openCreateForm}
            className="px-5 py-2.5 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add First Clothing Item</span>
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] text-center space-y-3">
          <p className="text-sm font-medium">No clothing items match your filters.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setCategoryFilter('All');
              setColorFilter('All');
            }}
            className="text-xs underline underline-offset-4 cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredItems.map((item) => (
            <article
              key={item.id}
              className="bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] hover:border-[#171717] dark:hover:border-[#e5e1da] transition-colors flex flex-col justify-between group"
            >
              <div
                onClick={() => setSelectedItem(item)}
                className="aspect-square bg-[#eae7e0] dark:bg-[#303030] overflow-hidden cursor-pointer"
              >
                <GarmentImage
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                />
              </div>

              <div className="p-4 space-y-3">
                <div
                  onClick={() => setSelectedItem(item)}
                  className="cursor-pointer space-y-1"
                >
                  <p className="text-[11px] text-[#5c5a54] dark:text-[#b0b0b0] truncate">
                    {item.brand} · {item.category}
                  </p>
                  <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                  <div className="flex items-center justify-between text-xs text-[#5c5a54] dark:text-[#b0b0b0] pt-1">
                    <span>
                      {item.color} · Size {item.size}
                    </span>
                    <span className="font-mono-num font-semibold text-[#171717] dark:text-[#e5e1da]">
                      {formatCurrency(item.price)}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#d8d4ca] dark:border-[#404040] flex items-center justify-between text-[11px]">
                  <span className="font-mono-num text-[#5c5a54] dark:text-[#b0b0b0]">
                    {item.wearCount || 0} wears
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => logWear(item.id).then(() => onToast(`Logged wear for "${item.name}".`))}
                      className="px-2 py-1 border border-[#d8d4ca] dark:border-[#404040] hover:bg-[#171717] hover:text-[#f5f4f0] dark:hover:bg-[#e5e1da] dark:hover:text-[#171717] transition-colors cursor-pointer"
                    >
                      +1 Wear
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedItem(item)}
                      className="underline underline-offset-4 hover:opacity-75 cursor-pointer"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Item Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] max-w-2xl w-full max-h-[90vh] overflow-y-auto grid grid-cols-1 md:grid-cols-2">
            <div className="aspect-square bg-[#eae7e0] dark:bg-[#303030]">
              <GarmentImage src={selectedItem.imageUrl} alt={selectedItem.name} />
            </div>

            <div className="p-6 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0]">
                      {selectedItem.brand} · {selectedItem.category}
                    </p>
                    <h2 className="font-display text-2xl font-bold mt-1">
                      {selectedItem.name}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="p-1 text-[#5c5a54] dark:text-[#b0b0b0] hover:text-[#171717] dark:hover:text-[#e5e1da] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <dl className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-[#d8d4ca] dark:border-[#404040]">
                  <div>
                    <dt className="text-[#5c5a54] dark:text-[#b0b0b0]">Color</dt>
                    <dd className="font-semibold mt-0.5">{selectedItem.color}</dd>
                  </div>
                  <div>
                    <dt className="text-[#5c5a54] dark:text-[#b0b0b0]">Size</dt>
                    <dd className="font-semibold font-mono-num mt-0.5">{selectedItem.size}</dd>
                  </div>
                  <div>
                    <dt className="text-[#5c5a54] dark:text-[#b0b0b0]">Purchase Price</dt>
                    <dd className="font-semibold font-mono-num mt-0.5">
                      {formatCurrency(selectedItem.price)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#5c5a54] dark:text-[#b0b0b0]">Purchase Date</dt>
                    <dd className="font-semibold font-mono-num mt-0.5">
                      {formatShortDate(selectedItem.purchaseDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#5c5a54] dark:text-[#b0b0b0]">Wear Count</dt>
                    <dd className="font-semibold font-mono-num mt-0.5">
                      {selectedItem.wearCount || 0} uses
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#5c5a54] dark:text-[#b0b0b0]">Cost Per Wear</dt>
                    <dd className="font-semibold font-mono-num mt-0.5">
                      {calculateCostPerWear(selectedItem.price, selectedItem.wearCount)}
                    </dd>
                  </div>
                </dl>

                {selectedItem.description && (
                  <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0] leading-relaxed pt-3 border-t border-[#d8d4ca] dark:border-[#404040]">
                    {selectedItem.description}
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-[#d8d4ca] dark:border-[#404040] flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleDelete(selectedItem)}
                  className="px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-500/10 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      logWear(selectedItem.id).then(() => {
                        setSelectedItem((prev) =>
                          prev ? { ...prev, wearCount: (prev.wearCount || 0) + 1 } : null
                        );
                        onToast(`Logged wear for "${selectedItem.name}".`);
                      });
                    }}
                    className="px-3 py-2 text-xs font-medium border border-[#d8d4ca] dark:border-[#404040] hover:border-[#171717] dark:hover:border-[#e5e1da] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>+1 Wear</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditForm(selectedItem)}
                    className="px-4 py-2 text-xs font-semibold bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Clothing Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#d8d4ca] dark:border-[#404040]">
              <h2 className="font-display text-xl font-bold">
                {editingItem ? 'Edit Garment' : 'Add Clothing Item'}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-1 text-[#5c5a54] dark:text-[#b0b0b0] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Image Upload */}
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 shrink-0 bg-[#eae7e0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040] overflow-hidden">
                  <GarmentImage src={imageUrl} alt={name || 'Garment preview'} />
                </div>
                <div className="flex-1 space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0]">
                    Garment Photo
                  </label>
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 border border-[#d8d4ca] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#303030] hover:border-[#171717] dark:hover:border-[#e5e1da] text-xs font-medium cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingImage ? 'Uploading...' : 'Upload Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-[#5c5a54] dark:text-[#b0b0b0]">
                    JPG, PNG, or WEBP up to 5 MB.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Heavyweight Boxy Tee"
                    className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ClothingCategory)}
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
                    Brand
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Entire Studios"
                    className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                    Color
                  </label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="Charcoal"
                    className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                    Size
                  </label>
                  <input
                    type="text"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="L / 32 / 43"
                    className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                    Purchase Price ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="120"
                    className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                    Purchase Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Fabric weight, fit profile, styling notes..."
                    className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#d8d4ca] dark:border-[#404040] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 text-xs font-medium border border-[#d8d4ca] dark:border-[#404040] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingImage}
                  className="px-5 py-2 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Add to Wardrobe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
