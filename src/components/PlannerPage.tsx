import React, { useEffect, useMemo, useState } from 'react';
import { NavSection, Outfit, WeatherForecast } from '../types';
import { useAuth } from '../context/AuthContext';
import { useWardrobe } from '../context/WardrobeContext';
import {
  fetchWeatherForLocation,
  getBrowserCoordinates,
  getCachedWeather,
  searchCities,
} from '../services/weatherService';
import { formatShortDate } from '../utils/formatters';
import { getTodayISO } from '../data/demoData';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  Lock,
  MapPin,
  Share2,
  Trash2,
} from 'lucide-react';

interface PlannerPageProps {
  onNavigate: (section: NavSection) => void;
  onSharePlannedOutfit?: (outfit: Outfit, dateIso: string) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const PlannerPage: React.FC<PlannerPageProps> = ({
  onNavigate,
  onSharePlannedOutfit,
  onToast,
}) => {
  const { userProfile, updateAccountProfile } = useAuth();
  const { outfits, wardrobe, schedules, assignSchedule, markScheduleWornToday, removeSchedule } =
    useWardrobe();

  const [selectedDate, setSelectedDate] = useState(getTodayISO());
  const [selectedOutfitId, setSelectedOutfitId] = useState(outfits[0]?.id || '');
  const [notes, setNotes] = useState('');
  const [weather, setWeather] = useState<WeatherForecast | null>(() => getCachedWeather());
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<{ name: string; lat: number; lon: number }[]>([]);

  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  useEffect(() => {
    const loc = userProfile?.weatherLocation;
    if (loc) {
      fetchWeatherForLocation(loc).then(setWeather).catch(() => {});
    }
  }, [userProfile?.weatherLocation?.name]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) {
      const m = String(viewMonth + 1).padStart(2, '0');
      const day = String(d).padStart(2, '0');
      cells.push(`${viewYear}-${m}-${day}`);
    }
    return cells;
  }, [viewMonth, viewYear]);

  const scheduledMap = useMemo(() => {
    const map = new Map<string, (typeof schedules)[0]>();
    schedules.forEach((s) => map.set(s.date, s));
    return map;
  }, [schedules]);

  const weatherByDate = useMemo(() => {
    const map = new Map<string, WeatherForecast['daily'][0]>();
    weather?.daily.forEach((d) => map.set(d.date, d));
    return map;
  }, [weather]);

  const activeSchedule = scheduledMap.get(selectedDate);
  const activeOutfit: Outfit | undefined = outfits.find(
    (o) => o.id === (activeSchedule?.outfitId || selectedOutfitId)
  );

  const dirtyPiecesInActiveOutfit = useMemo(() => {
    if (!activeOutfit) return [];
    const ids = [
      activeOutfit.topId,
      activeOutfit.bottomId,
      activeOutfit.shoesId,
      ...(activeOutfit.accessoryIds || []),
    ].filter(Boolean);
    return wardrobe.filter((w) => ids.includes(w.id) && w.laundryStatus !== 'clean');
  }, [activeOutfit, wardrobe]);

  const handleCitySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await searchCities(cityQuery);
      setCityResults(res);
    } catch {
      onToast('Could not search cities.', 'error');
    }
  };

  const handleUseBrowserGeo = async () => {
    try {
      const coords = await getBrowserCoordinates();
      const loc = { name: 'Current Location', ...coords };
      const forecast = await fetchWeatherForLocation(loc);
      setWeather(forecast);
      await updateAccountProfile({ weatherLocation: loc });
      onToast('Updated weather from your location.');
    } catch (err: any) {
      onToast(err?.message || 'Location denied — search a city manually.', 'error');
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutfitId) {
      onToast('Create an outfit in Fit Builder first.', 'error');
      return;
    }
    await assignSchedule(selectedDate, selectedOutfitId, notes);
    onToast(`Planned outfit for ${formatShortDate(selectedDate)}.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight">Outfit Planner</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-chip text-[11px] border border-[#d4cfc5] dark:border-[#404040]">
              <Lock className="w-3 h-3" /> Private
            </span>
          </div>
          <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
            Private calendar with Open-Meteo weather forecasts and wear logging.
          </p>
        </div>

        <button
          type="button"
          onClick={handleUseBrowserGeo}
          className="px-3.5 py-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-xs font-semibold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>{weather ? `${weather.locationName} (${weather.currentTempC}°C)` : 'Detect Weather'}</span>
        </button>
      </div>

      {/* Weather Strip + Manual City Search */}
      <div className="p-4 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CloudSun className="w-6 h-6 shrink-0" />
          <div>
            <p className="text-sm font-semibold">
              {weather
                ? `${weather.locationName}: ${weather.currentTempC}°C · ${weather.conditionLabel}`
                : 'Set your city for 7-day outfit weather forecasts'}
            </p>
            <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
              {weather?.clothingAdvice || 'Powered by Open-Meteo (free, no API key required).'}
            </p>
          </div>
        </div>

        <form onSubmit={handleCitySearch} className="flex gap-2">
          <input
            type="text"
            value={cityQuery}
            onChange={(e) => setCityQuery(e.target.value)}
            placeholder="Set city (e.g., Tokyo, London)"
            className="px-3 py-1.5 rounded-control text-xs bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-control bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold cursor-pointer"
          >
            Search
          </button>
        </form>
      </div>

      {cityResults.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {cityResults.map((c) => (
            <button
              key={`${c.lat}_${c.lon}`}
              type="button"
              onClick={async () => {
                const f = await fetchWeatherForLocation(c);
                setWeather(f);
                setCityResults([]);
                await updateAccountProfile({ weatherLocation: c });
                onToast(`Weather set to ${c.name}.`);
              }}
              className="px-3 py-1.5 rounded-chip border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-xs cursor-pointer"
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar Grid */}
        <section className="lg:col-span-8 p-5 rounded-modal border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-lg">
              {new Date(viewYear, viewMonth).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => {
                  if (viewMonth === 0) {
                    setViewMonth(11);
                    setViewYear((y) => y - 1);
                  } else setViewMonth((m) => m - 1);
                }}
                className="p-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => {
                  if (viewMonth === 11) {
                    setViewMonth(0);
                    setViewYear((y) => y + 1);
                  } else setViewMonth((m) => m + 1);
                }}
                className="p-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label="Outfit calendar">
            {calendarDays.map((iso, idx) => {
              if (!iso) return <div key={`empty_${idx}`} className="h-20" />;
              const sched = scheduledMap.get(iso);
              const outfit = sched ? outfits.find((o) => o.id === sched.outfitId) : undefined;
              const forecast = weatherByDate.get(iso);
              const isSelected = iso === selectedDate;
              const isToday = iso === getTodayISO();

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    setSelectedDate(iso);
                    if (sched) {
                      setSelectedOutfitId(sched.outfitId);
                      setNotes(sched.notes || '');
                    }
                  }}
                  className={`h-20 p-2 rounded-control border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                      : 'border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0]/60 dark:bg-[#171717]/60 hover:bg-[#eae7e0] dark:hover:bg-[#303030]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-xs font-mono-num ${isToday ? 'underline font-bold' : ''}`}>
                      {Number(iso.slice(8))}
                    </span>
                    {forecast && (
                      <span className="text-[10px] font-mono-num opacity-80">
                        {forecast.tempMaxC}°
                      </span>
                    )}
                  </div>
                  {outfit && (
                    <span className="text-[10px] font-medium truncate w-full">
                      {sched?.wornConfirmed ? '✓ ' : ''}
                      {outfit.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Day Inspector & Assignment */}
        <section className="lg:col-span-4 p-5 rounded-modal border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            <h3 className="font-display font-bold text-base">{formatShortDate(selectedDate)}</h3>
          </div>

          {weatherByDate.get(selectedDate) && (
            <div className="p-3 rounded-control bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040] text-xs">
              Forecast: <strong>{weatherByDate.get(selectedDate)!.conditionLabel}</strong> ·{' '}
              {weatherByDate.get(selectedDate)!.tempMinC}°–{weatherByDate.get(selectedDate)!.tempMaxC}°C ·{' '}
              {weatherByDate.get(selectedDate)!.precipitationProb}% rain
            </div>
          )}

          {dirtyPiecesInActiveOutfit.length > 0 && (
            <div className="p-3 rounded-control border border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Laundry reminder: {dirtyPiecesInActiveOutfit.map((d) => d.name).join(', ')} marked dirty/washing.
              </span>
            </div>
          )}

          {activeSchedule ? (
            <div className="p-4 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider">Planned Fit</span>
                <button
                  type="button"
                  onClick={() => removeSchedule(activeSchedule.id)}
                  aria-label="Remove scheduled outfit"
                  className="p-1.5 rounded-control text-red-600 dark:text-red-400 hover:bg-red-500/15 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="font-display font-bold text-base">
                {activeOutfit?.name || 'Outfit'}
              </p>
              {activeSchedule.notes && (
                <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">{activeSchedule.notes}</p>
              )}

              {activeSchedule.wornConfirmed ? (
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Worn & logged to Style Stats</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    await markScheduleWornToday(activeSchedule, activeOutfit);
                    onToast('Logged wear! Stats & laundry updated.');
                  }}
                  className="w-full py-2.5 px-4 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Wore this today</span>
                </button>
              )}

              {activeOutfit && onSharePlannedOutfit && (
                <div className="pt-2 border-t border-[#d4cfc5]/70 dark:border-[#404040]/70 space-y-1">
                  <button
                    type="button"
                    onClick={() => onSharePlannedOutfit(activeOutfit, selectedDate)}
                    className="w-full py-2 px-3 min-h-[40px] rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share this planned outfit</span>
                  </button>
                  <p className="text-[10px] text-[#4e4c46] dark:text-[#b0b0b0] text-center">
                    Shares an independent copy — your planner stays private.
                  </p>
                </div>
              )}
            </div>
          ) : null}

          <form onSubmit={handleAssign} className="space-y-3 pt-2 border-t border-[#d4cfc5] dark:border-[#404040]">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
                {activeSchedule ? 'Change Planned Outfit' : 'Assign Outfit'}
              </label>
              <select
                value={selectedOutfitId}
                onChange={(e) => setSelectedOutfitId(e.target.value)}
                className="w-full px-3 py-2 rounded-control text-sm bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
              >
                {outfits.length === 0 && <option value="">No outfits in Lookbook</option>}
                {outfits.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.styleCategory})
                  </option>
                ))}
              </select>
            </div>

            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Weather / event notes..."
              className="w-full px-3 py-2 rounded-control text-xs bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
            />

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={outfits.length === 0}
                className="flex-1 py-2.5 px-4 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold cursor-pointer disabled:opacity-40"
              >
                Save Plan
              </button>
              {outfits.length === 0 && (
                <button
                  type="button"
                  onClick={() => onNavigate('builder')}
                  className="py-2.5 px-3 rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold cursor-pointer"
                >
                  Open Builder
                </button>
              )}
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};
