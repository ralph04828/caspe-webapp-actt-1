import React from 'react';
import { Search, LayoutGrid, List, SlidersHorizontal, Plus, Sparkles, Filter, X } from 'lucide-react';
import { SortOption, ViewMode } from '../types';

interface HeaderBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  activeClientFilter: string | null;
  onClearClientFilter: () => void;
  activeCategoryFilter: string | null;
  onClearCategoryFilter: () => void;
  onOpenUpload: () => void;
  onSeedSampleFiles: () => void;
  fileCount: number;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  activeClientFilter,
  onClearClientFilter,
  activeCategoryFilter,
  onClearCategoryFilter,
  onOpenUpload,
  onSeedSampleFiles,
  fileCount,
}) => {
  return (
    <header className="bg-white border-b border-pink-100 p-4 sm:px-6 sticky top-0 z-30 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search files by name, client, or tag..."
            className="w-full pl-9 pr-8 py-2 bg-pink-50/40 border border-pink-200/80 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#831843]/20 focus:border-[#831843] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Controls: Sort, View Switcher, Primary Action */}
        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 bg-pink-50/50 border border-pink-200/70 rounded-xl px-2.5 py-1.5 text-xs text-gray-700">
            <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="bg-transparent border-none text-xs font-medium text-gray-700 focus:outline-none cursor-pointer pr-1"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="size-desc">Largest Size</option>
              <option value="size-asc">Smallest Size</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-pink-50/50 border border-pink-200/70 rounded-xl p-1">
            <button
              onClick={() => onViewModeChange('list')}
              title="Table List View"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-[#831843] shadow-xs font-semibold'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('grid')}
              title="Card Grid View"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-[#831843] shadow-xs font-semibold'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Upload Button */}
          <button
            onClick={onOpenUpload}
            className="py-2 px-3.5 bg-[#831843] hover:bg-[#9d174d] text-white text-xs font-semibold rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload</span>
          </button>
        </div>
      </div>

      {/* Active Filter Chips */}
      {(activeClientFilter || activeCategoryFilter) && (
        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-pink-100 text-xs">
          <span className="text-gray-400 flex items-center gap-1 text-[11px]">
            <Filter className="w-3 h-3" /> Filters:
          </span>
          {activeClientFilter && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-pink-100 text-[#831843] font-medium text-[11px]">
              Client: {activeClientFilter}
              <button
                onClick={onClearClientFilter}
                className="hover:text-rose-900 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {activeCategoryFilter && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-pink-100 text-[#831843] font-medium text-[11px]">
              Category: {activeCategoryFilter}
              <button
                onClick={onClearCategoryFilter}
                className="hover:text-rose-900 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </header>
  );
};
