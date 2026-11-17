import React, { useMemo, useState } from 'react';
import { NavSection } from '../types';
import { useAuth } from '../context/AuthContext';
import { useWardrobe } from '../context/WardrobeContext';
import { getTodayISO } from '../data/demoData';
import { calculateCostPerWear, formatCurrency, formatShortDate } from '../utils/formatters';
import { GarmentImage } from './GarmentImage';
import {
  Plus,
  Layers,
  Sparkles,
  BookOpen,
  ArrowUpRight,
  BarChart3,
  LayoutGrid,
  Check,
} from 'lucide-react';

interface OverviewPageProps {
  onNavigate: (section: NavSection) => void;
  onQuickAddClothing: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  onNavigate,
  onQuickAddClothing,
}) => {
  const { userProfile } = useAuth();
  const { wardrobe, outfits, wishlist, schedules, logWear } = useWardrobe();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics'>('dashboard');

  const firstName = userProfile?.displayName?.split(' ')[0] || 'Member';
  const todayISO = getTodayISO();

  // Dynamic Statistics
  const stats = useMemo(() => {
    const categoryCounts: Record<string, number> = {};
    const colorCounts: Record<string, number> = {};
    let totalWardrobeValue = 0;

    wardrobe.forEach((item) => {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
      const colorKey = item.color.trim() || 'Neutral';
      colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;
      totalWardrobeValue += item.price || 0;
    });

    const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
    const sortedColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
    const mostUsedCategory = sortedCategories[0]?.[0] || 'None yet';

    const activeWishlist = wishlist.filter((w) => !w.isPurchased);
    const wishlistTotalCost = activeWishlist.reduce((sum, w) => sum + (w.price || 0), 0);

    const mostWornItems = [...wardrobe]
      .sort((a, b) => (b.wearCount || 0) - (a.wearCount || 0))
      .slice(0, 5);

    return {
      totalItems: wardrobe.length,
      totalOutfits: outfits.length,
      wishlistCount: activeWishlist.length,
      mostUsedCategory,
      totalWardrobeValue,
      wishlistTotalCost,
      categoryDistribution: sortedCategories,
      colorDistribution: sortedColors,
      mostWornItems,
    };
  }, [wardrobe, outfits, wishlist]);

  // Today's Fit
  const todaySchedule = schedules.find((s) => s.date === todayISO);
  const todaysOutfit =
    (todaySchedule && outfits.find((o) => o.id === todaySchedule.outfitId)) ||
    outfits.find((o) => o.isFavorite) ||
    outfits[0] ||
    null;

  const todaysPieces = useMemo(() => {
    if (!todaysOutfit) return [];
    const ids = [
      todaysOutfit.topId,
      todaysOutfit.bottomId,
      todaysOutfit.shoesId,
      ...(todaysOutfit.accessoryIds || []),
    ].filter(Boolean) as string[];
    return ids.map((id) => wardrobe.find((w) => w.id === id)).filter(Boolean);
  }, [todaysOutfit, wardrobe]);

  const recentItems = wardrobe.slice(0, 4);

  return (
    <div className="space-y-8">
      {/* Welcome & Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#d8d4ca] dark:border-[#404040]">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
            Welcome back, {firstName}.
          </h1>
          <p className="text-sm text-[#5c5a54] dark:text-[#b0b0b0] mt-1.5">
            Your wardrobe. Your style. Your archive.
          </p>
        </div>

        {/* Segmented Dashboard vs Style Analytics Switch */}
        <div className="inline-flex p-1 bg-[#eae7e0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040] self-start">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-white dark:bg-[#171717] text-[#171717] dark:text-[#e5e1da]'
                : 'text-[#5c5a54] dark:text-[#b0b0b0] hover:text-[#171717] dark:hover:text-[#e5e1da]'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-white dark:bg-[#171717] text-[#171717] dark:text-[#e5e1da]'
                : 'text-[#5c5a54] dark:text-[#b0b0b0] hover:text-[#171717] dark:hover:text-[#e5e1da]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Style Analytics</span>
          </button>
        </div>
      </div>

      {/* Live Key Metrics Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 border border-[#d8d4ca] dark:border-[#404040] bg-white dark:bg-[#242424] divide-y lg:divide-y-0 lg:divide-x divide-[#d8d4ca] dark:divide-[#404040]">
        <div className="p-5">
          <p className="text-xs uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0]">
            Clothing Items
          </p>
          <p className="font-mono-num text-3xl font-bold mt-2">{stats.totalItems}</p>
        </div>
        <div className="p-5">
          <p className="text-xs uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0]">
            Saved Outfits
          </p>
          <p className="font-mono-num text-3xl font-bold mt-2">{stats.totalOutfits}</p>
        </div>
        <div className="p-5">
          <p className="text-xs uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0]">
            Wishlist Items
          </p>
          <p className="font-mono-num text-3xl font-bold mt-2">{stats.wishlistCount}</p>
        </div>
        <div className="p-5">
          <p className="text-xs uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0]">
            Top Category
          </p>
          <p className="font-display text-2xl font-bold mt-2 truncate">
            {stats.mostUsedCategory}
          </p>
        </div>
      </section>

      {activeTab === 'dashboard' ? (
        <>
          {/* Quick Actions Bar */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5c5a54] dark:text-[#b0b0b0]">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={onQuickAddClothing}
                className="p-4 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-left flex items-center justify-between hover:opacity-90 transition-opacity cursor-pointer"
              >
                <span className="text-xs font-semibold">Add Clothing</span>
                <Plus className="w-4 h-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('builder')}
                className="p-4 bg-white dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040] text-left flex items-center justify-between hover:border-[#171717] dark:hover:border-[#e5e1da] transition-colors cursor-pointer"
              >
                <span className="text-xs font-semibold">Create Outfit</span>
                <Layers className="w-4 h-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('ai')}
                className="p-4 bg-white dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040] text-left flex items-center justify-between hover:border-[#171717] dark:hover:border-[#e5e1da] transition-colors cursor-pointer"
              >
                <span className="text-xs font-semibold">Generate AI Outfit</span>
                <Sparkles className="w-4 h-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('lookbook')}
                className="p-4 bg-white dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040] text-left flex items-center justify-between hover:border-[#171717] dark:hover:border-[#e5e1da] transition-colors cursor-pointer"
              >
                <span className="text-xs font-semibold">View Lookbook</span>
                <BookOpen className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </section>

          {/* Today's Fit & SWOOOSH AI Preview Split */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Today's Fit */}
            <div className="lg:col-span-7 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] p-6 flex flex-col justify-between">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[#5c5a54] dark:text-[#b0b0b0]">
                    {todaySchedule ? `Scheduled for Today · ${formatShortDate(todayISO)}` : "Featured Rotation · Today's Fit"}
                  </p>
                  <h2 className="font-display text-2xl font-bold mt-1">
                    {todaysOutfit ? todaysOutfit.name : 'No Outfit Scheduled'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('planner')}
                  className="text-xs font-medium underline underline-offset-4 hover:opacity-75 whitespace-nowrap cursor-pointer"
                >
                  Open Planner
                </button>
              </div>

              {todaysOutfit ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {todaysPieces.length > 0 ? (
                      todaysPieces.slice(0, 4).map((piece) =>
                        piece ? (
                          <div
                            key={piece.id}
                            className="border border-[#d8d4ca] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#303030] overflow-hidden"
                          >
                            <div className="aspect-square">
                              <GarmentImage src={piece.imageUrl} alt={piece.name} />
                            </div>
                            <div className="p-2.5">
                              <p className="text-xs font-medium truncate">{piece.name}</p>
                              <p className="text-[11px] text-[#5c5a54] dark:text-[#b0b0b0] truncate">
                                {piece.brand} · {piece.category}
                              </p>
                            </div>
                          </div>
                        ) : null
                      )
                    ) : (
                      <div className="col-span-4 py-8 text-center text-xs text-[#5c5a54] dark:text-[#b0b0b0]">
                        Outfit garments were removed from wardrobe.
                      </div>
                    )}
                  </div>
                  {(todaySchedule?.notes || todaysOutfit.description) && (
                    <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0] pt-3 border-t border-[#d8d4ca] dark:border-[#404040]">
                      {todaySchedule?.notes || todaysOutfit.description}
                    </p>
                  )}
                </div>
              ) : (
                <div className="py-10 text-center border border-dashed border-[#d8d4ca] dark:border-[#404040]">
                  <p className="text-sm text-[#5c5a54] dark:text-[#b0b0b0] mb-3">
                    Create your first outfit in Fit Builder or schedule one in Outfit Planner.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('builder')}
                    className="px-4 py-2 text-xs font-semibold bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] cursor-pointer"
                  >
                    Launch Fit Builder
                  </button>
                </div>
              )}
            </div>

            {/* SWOOOSH AI Preview Card */}
            <div className="lg:col-span-5 bg-[#303030] text-[#e5e1da] border border-[#404040] p-6 flex flex-col justify-between">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.2em] text-[#b0b0b0]">
                  SWOOOSH AI
                </p>
                <h2 className="font-display text-2xl font-bold leading-snug text-balance">
                  YOUR PERSONAL AI FASHION STYLIST.
                </h2>
                <p className="text-xs text-[#b0b0b0] leading-relaxed">
                  Your wardrobe has more possibilities than you think. Let SWOOOSH AI analyze your {stats.totalItems} saved pieces to recommend occasion outfits, color pairings, and missing essentials.
                </p>
              </div>

              <div className="mt-6 pt-5 border-t border-[#404040] space-y-3">
                <div className="text-xs text-[#b0b0b0] space-y-1.5">
                  <p>· Occasion & weather-aware outfit combinations</p>
                  <p>· Multimodal outfit photo critique & proportion balance</p>
                  <p>· Real-time wardrobe color matching</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('ai')}
                  className="w-full py-2.5 px-4 bg-[#e5e1da] text-[#171717] text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Open SWOOOSH AI</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </section>

          {/* Recent Additions */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5c5a54] dark:text-[#b0b0b0]">
                Recent Additions
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('wardrobe')}
                className="text-xs font-medium underline underline-offset-4 hover:opacity-75 cursor-pointer"
              >
                View All ({stats.totalItems})
              </button>
            </div>

            {recentItems.length === 0 ? (
              <div className="p-10 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] text-center">
                <p className="text-sm text-[#5c5a54] dark:text-[#b0b0b0] mb-3">
                  Your wardrobe archive is empty.
                </p>
                <button
                  type="button"
                  onClick={onQuickAddClothing}
                  className="px-4 py-2 text-xs font-semibold bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] cursor-pointer"
                >
                  Add First Piece
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {recentItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onNavigate('wardrobe')}
                    className="bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] hover:border-[#171717] dark:hover:border-[#e5e1da] transition-colors cursor-pointer group"
                  >
                    <div className="aspect-square overflow-hidden bg-[#eae7e0] dark:bg-[#303030]">
                      <GarmentImage
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    </div>
                    <div className="p-3.5 space-y-1">
                      <p className="text-sm font-semibold truncate">{item.name}</p>
                      <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0] truncate">
                        {item.brand} · {item.category} · <span className="font-mono-num">{formatCurrency(item.price)}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        /* STYLE DASHBOARD & WARDROBE ANALYTICS */
        <div className="space-y-6">
          {/* Valuation Summary */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040]">
              <p className="text-xs uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0]">
                Total Wardrobe Value
              </p>
              <p className="font-mono-num text-3xl font-bold mt-2">
                {formatCurrency(stats.totalWardrobeValue)}
              </p>
              <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0] mt-1">
                Across {stats.totalItems} cataloged pieces
              </p>
            </div>

            <div className="p-5 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040]">
              <p className="text-xs uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0]">
                Wishlist Estimated Cost
              </p>
              <p className="font-mono-num text-3xl font-bold mt-2">
                {formatCurrency(stats.wishlistTotalCost)}
              </p>
              <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0] mt-1">
                {stats.wishlistCount} unpurchased items tracked
              </p>
            </div>

            <div className="p-5 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040]">
              <p className="text-xs uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0]">
                Dominant Color Palette
              </p>
              <p className="font-display text-2xl font-bold mt-2 truncate">
                {stats.colorDistribution[0]?.[0] || 'None yet'}
              </p>
              <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0] mt-1">
                {stats.colorDistribution.length} distinct tones in rotation
              </p>
            </div>
          </section>

          {/* Category Distribution & Color Breakdown Charts */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Bar Chart */}
            <div className="p-6 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5c5a54] dark:text-[#b0b0b0]">
                Category Distribution
              </h3>
              {stats.categoryDistribution.length === 0 ? (
                <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0] py-6">
                  Add garments to see category distribution.
                </p>
              ) : (
                <div className="space-y-3">
                  {stats.categoryDistribution.map(([category, count]) => {
                    const pct = Math.round((count / Math.max(1, stats.totalItems)) * 100);
                    return (
                      <div key={category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{category}</span>
                          <span className="font-mono-num text-[#5c5a54] dark:text-[#b0b0b0]">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#eae7e0] dark:bg-[#303030]">
                          <div
                            className="h-2 bg-[#171717] dark:bg-[#e5e1da]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Most-Used Colors */}
            <div className="p-6 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5c5a54] dark:text-[#b0b0b0]">
                Most-Used Colors
              </h3>
              {stats.colorDistribution.length === 0 ? (
                <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0] py-6">
                  Add garments to analyze color distribution.
                </p>
              ) : (
                <div className="space-y-3">
                  {stats.colorDistribution.slice(0, 6).map(([color, count]) => {
                    const pct = Math.round((count / Math.max(1, stats.totalItems)) * 100);
                    return (
                      <div key={color} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{color}</span>
                          <span className="font-mono-num text-[#5c5a54] dark:text-[#b0b0b0]">
                            {count} items · {pct}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#eae7e0] dark:bg-[#303030]">
                          <div
                            className="h-2 bg-[#78756e] dark:bg-[#a5a5a5]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Cost Per Wear & Most Frequently Used Table */}
          <section className="bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040]">
            <div className="p-5 border-b border-[#d8d4ca] dark:border-[#404040] flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5c5a54] dark:text-[#b0b0b0]">
                  Cost Per Wear & Usage Ledger
                </h3>
                <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0] mt-1">
                  Log wears to calculate real-time Cost Per Wear (Purchase Price / Number of Uses).
                </p>
              </div>
            </div>

            {wardrobe.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#5c5a54] dark:text-[#b0b0b0]">
                No wardrobe items to analyze yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#d8d4ca] dark:border-[#404040] text-[#5c5a54] dark:text-[#b0b0b0] uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Garment</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Purchase Price</th>
                      <th className="py-3 px-4 text-right">Uses</th>
                      <th className="py-3 px-4 text-right">Cost Per Wear</th>
                      <th className="py-3 px-4 text-right">Log Wear</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#d8d4ca] dark:divide-[#404040]">
                    {[...wardrobe]
                      .sort((a, b) => (b.wearCount || 0) - (a.wearCount || 0))
                      .map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-[#f5f4f0] dark:hover:bg-[#303030]/60 transition-colors"
                        >
                          <td className="py-3 px-4 font-medium">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 shrink-0 bg-[#eae7e0] dark:bg-[#303030] overflow-hidden">
                                <GarmentImage src={item.imageUrl} alt={item.name} />
                              </div>
                              <div>
                                <p className="font-semibold">{item.name}</p>
                                <p className="text-[11px] text-[#5c5a54] dark:text-[#b0b0b0]">
                                  {item.brand}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[#5c5a54] dark:text-[#b0b0b0]">
                            {item.category}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-num">
                            {formatCurrency(item.price)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-num">
                            {item.wearCount || 0}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-num font-semibold">
                            {calculateCostPerWear(item.price, item.wearCount)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => logWear(item.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 border border-[#d8d4ca] dark:border-[#404040] hover:bg-[#171717] hover:text-[#f5f4f0] dark:hover:bg-[#e5e1da] dark:hover:text-[#171717] text-[11px] font-medium transition-colors cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                              <span>+1 Wear</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
