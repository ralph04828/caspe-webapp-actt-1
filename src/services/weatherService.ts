import { WeatherForecast, WeatherLocation } from '../types';

const WEATHER_CACHE_KEY = 'swooosh_weather_cache_v1';

function mapWmoCodeToLabel(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code <= 3) return 'Partly Cloudy';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 57) return 'Light Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Mild';
}

function buildClothingAdvice(tempC: number, code: number, windKmh: number): string {
  const isWet = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
  if (isWet) {
    return 'Wet conditions — reach for a water-resistant outer shell and closed footwear.';
  }
  if (tempC <= 8) {
    return 'Cold air — heavy coat or layered hoodie + structured jacket recommended.';
  }
  if (tempC <= 16) {
    return windKmh > 22
      ? 'Crisp & breezy — midweight jacket or overshirt with full-length trousers.'
      : 'Cool layering weather — hoodie, overshirt, or light work jacket.';
  }
  if (tempC <= 24) {
    return 'Balanced mild day — boxy tee or light long-sleeve with relaxed cargos or denim.';
  }
  return 'Warm weather — breathable cotton tee, shorts or jorts, and low-top sneakers or slides.';
}

export async function searchCities(queryText: string): Promise<WeatherLocation[]> {
  if (!queryText.trim()) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    queryText.trim()
  )}&count=5&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not search cities.');
  const json = await res.json();
  const results = Array.isArray(json.results) ? json.results : [];
  return results.map((r: any) => ({
    name: [r.name, r.admin1, r.country_code].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude,
  }));
}

export async function fetchWeatherForLocation(location: WeatherLocation): Promise<WeatherForecast> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather service temporarily unavailable.');
  const data = await res.json();

  const current = data.current || {};
  const tempC = Math.round(Number(current.temperature_2m ?? 18));
  const feelsLikeC = Math.round(Number(current.apparent_temperature ?? tempC));
  const code = Number(current.weather_code ?? 1);
  const windKmh = Math.round(Number(current.wind_speed_10m ?? 8));
  const precip = Number(current.precipitation ?? 0);

  const dailyTimes: string[] = data.daily?.time || [];
  const dailyMax: number[] = data.daily?.temperature_2m_max || [];
  const dailyMin: number[] = data.daily?.temperature_2m_min || [];
  const dailyCodes: number[] = data.daily?.weather_code || [];
  const dailyProb: number[] = data.daily?.precipitation_probability_max || [];

  const forecast: WeatherForecast = {
    locationName: location.name,
    currentTempC: tempC,
    feelsLikeC,
    conditionCode: code,
    conditionLabel: mapWmoCodeToLabel(code),
    precipitationMm: precip,
    windKmh,
    clothingAdvice: buildClothingAdvice(tempC, code, windKmh),
    daily: dailyTimes.map((date, idx) => ({
      date,
      tempMaxC: Math.round(Number(dailyMax[idx] ?? tempC)),
      tempMinC: Math.round(Number(dailyMin[idx] ?? tempC - 4)),
      conditionCode: Number(dailyCodes[idx] ?? 1),
      conditionLabel: mapWmoCodeToLabel(Number(dailyCodes[idx] ?? 1)),
      precipitationProb: Number(dailyProb[idx] ?? 0),
    })),
    fetchedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(forecast));
  } catch {
    // ignore cache error
  }

  return forecast;
}

export function getCachedWeather(): WeatherForecast | null {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WeatherForecast;
  } catch {
    return null;
  }
}

export function getBrowserCoordinates(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => reject(new Error('Location permission denied. Enter your city manually instead.')),
      { timeout: 8000 }
    );
  });
}
