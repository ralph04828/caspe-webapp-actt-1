import React, { useMemo, useState } from 'react';
import { ClothingItem, NavSection } from '../types';
import { useWardrobe } from '../context/WardrobeContext';
import { getTodayISO } from '../data/demoData';
import { formatShortDate } from '../utils/formatters';
import { GarmentImage } from './GarmentImage';
import { ChevronLeft, ChevronRight, Trash2, CalendarCheck } from 'lucide-react';

interface PlannerPageProps {
  onNavigate: (section: NavSection) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const PlannerPage: React.FC<PlannerPageProps> = ({ onNavigate, onToast }) => {
  const { outfits, wardrobe, schedules, assignSchedule, removeSchedule } = useWardrobe();

  const todayISO = getTodayISO();
  const [selectedDate, setSelectedDate] = useState(todayISO);

  const initialDate = new Date(`${todayISO}T12:00:00`);
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth()); // 0-indexed

  const existingSchedule = schedules.find((s) => s.date === selectedDate);
  const [chosenOutfitId, setChosenOutfitId] = useState(existingSchedule?.outfitId || '');
  const [dayNotes, setDayNotes] = useState(existingSchedule?.notes || '');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    const sched = schedules.find((s) => s.date === selectedDate);
    setChosenOutfitId(sched?.outfitId || '');
    setDayNotes(sched?.notes || '');
  }, [selectedDate, schedules]);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: { iso: string; day: number }[] = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push({ iso: `empty_${i}`, day: 0 });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(viewMonth + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      cells.push({ iso: `${viewYear}-${mStr}-${dStr}`, day: d });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chosenOutfitId) {
      onToast('Please choose an outfit from My Lookbook.', 'error');
      return;
    }
    setSaving(true);
    try {
      await assignSchedule(selectedDate, chosenOutfitId, dayNotes.trim());
      onToast(`Scheduled outfit for ${formatShortDate(selectedDate)}.`);
    } catch (err: any) {
      onToast(err.message || 'Could not schedule outfit.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!existingSchedule) return;
    try {
      await removeSchedule(existingSchedule.id);
      onToast(`Removed scheduled outfit for ${formatShortDate(selectedDate)}.`);
    } catch (err: any) {
      onToast(err.message || 'Could not remove schedule.', 'error');
    }
  };

  const previewOutfit = outfits.find((o) => o.id === chosenOutfitId);
  const previewPieces = useMemo(() => {
    if (!previewOutfit) return [];
    const ids = [
      previewOutfit.topId,
      previewOutfit.bottomId,
      previewOutfit.shoesId,
      ...(previewOutfit.accessoryIds || []),
    ].filter(Boolean) as string[];
    return ids.map((id) => wardrobe.find((w) => w.id === id)).filter(Boolean) as ClothingItem[];
  }, [previewOutfit, wardrobe]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#d8d4ca] dark:border-[#404040]">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#5c5a54] dark:text-[#b0b0b0]">
            Monthly Rotation Calendar
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight mt-1">
            Outfit Planner
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Monthly Calendar Grid */}
        <div className="lg:col-span-7 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] p-5">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#d8d4ca] dark:border-[#404040]">
            <h2 className="font-display text-lg font-bold">{monthLabel}</h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Previous month"
                className="p-2 border border-[#d8d4ca] dark:border-[#404040] hover:border-[#171717] dark:hover:border-[#e5e1da] cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next month"
                className="p-2 border border-[#d8d4ca] dark:border-[#404040] hover:border-[#171717] dark:hover:border-[#e5e1da] cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] pb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((cell) => {
              if (cell.day === 0) {
                return <div key={cell.iso} className="h-20 bg-[#f5f4f0]/40 dark:bg-[#171717]/40" />;
              }

              const sched = schedules.find((s) => s.date === cell.iso);
              const assignedOutfit = sched ? outfits.find((o) => o.id === sched.outfitId) : null;
              const isSelected = cell.iso === selectedDate;
              const isToday = cell.iso === todayISO;

              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => setSelectedDate(cell.iso)}
                  className={`h-20 p-1.5 text-left border flex flex-col justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-[#171717] dark:border-[#e5e1da]'
                      : 'bg-[#f5f4f0] dark:bg-[#303030] border-[#d8d4ca] dark:border-[#404040] hover:border-[#171717] dark:hover:border-[#e5e1da]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-mono-num text-xs font-semibold">{cell.day}</span>
                    {isToday && (
                      <span className="text-[9px] uppercase tracking-wider opacity-75">Today</span>
                    )}
                  </div>
                  {assignedOutfit && (
                    <span className="text-[10px] font-medium leading-tight line-clamp-2">
                      {assignedOutfit.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Editor & Preview */}
        <div className="lg:col-span-5 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] p-5 space-y-5">
          <div className="pb-3 border-b border-[#d8d4ca] dark:border-[#404040]">
            <p className="text-[11px] uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0]">
              Selected Date
            </p>
            <h2 className="font-display text-xl font-bold mt-0.5">
              {formatShortDate(selectedDate)}
            </h2>
          </div>

          {outfits.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0]">
                Save at least one outfit to My Lookbook before scheduling days.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('builder')}
                className="px-4 py-2 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-semibold cursor-pointer"
              >
                Open Fit Builder
              </button>
            </div>
          ) : (
            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1.5">
                  Assign Outfit from Lookbook
                </label>
                <select
                  value={chosenOutfitId}
                  onChange={(e) => setChosenOutfitId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                >
                  <option value="">Select an outfit...</option>
                  {outfits.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.styleCategory})
                    </option>
                  ))}
                </select>
              </div>

              {previewOutfit && (
                <div className="p-3 bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040] space-y-2.5">
                  <p className="text-xs font-semibold">{previewOutfit.name}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {previewPieces.slice(0, 4).map((p) => (
                      <div key={p.id} className="aspect-square bg-[#eae7e0] dark:bg-[#171717] overflow-hidden">
                        <GarmentImage src={p.imageUrl} alt={p.name} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1.5">
                  Day Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={dayNotes}
                  onChange={(e) => setDayNotes(e.target.value)}
                  placeholder="Weather, event dress code, evening layer swap..."
                  className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                {existingSchedule && (
                  <button
                    type="button"
                    onClick={handleRemove}
                    className="px-3.5 py-2.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-500/10 cursor-pointer"
                    title="Remove scheduled outfit"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 px-4 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CalendarCheck className="w-4 h-4" />
                  <span>
                    {saving
                      ? 'Saving...'
                      : existingSchedule
                      ? 'Update Scheduled Fit'
                      : 'Assign Outfit'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
