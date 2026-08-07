import { useEffect, useState } from 'react';

const REFRESH_MS = 60 * 1000;

function describeWeather(code) {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 67) return 'Rainy';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Cloudy';
}

function dispatchHint(code, temp) {
  if (code >= 61 && code <= 82) return 'Rain expected — plan dispatch carefully';
  if (temp >= 35) return 'Hot — ensure liquid products stored cool';
  if (temp <= 18) return 'Cool — good for warehouse ops';
  return 'Good for dispatch planning';
}

export function useLiveWeather(lat, lon, cityName) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (lat == null || lon == null) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    async function fetchWeather() {
      try {
        const params = new URLSearchParams({
          latitude: String(lat),
          longitude: String(lon),
          current: 'temperature_2m,relative_humidity_2m,weather_code',
          timezone: 'Asia/Kolkata',
        });
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
        if (!res.ok) throw new Error('Weather unavailable');

        const data = await res.json();
        if (cancelled) return;

        const current = data.current;
        const temp = Math.round(current.temperature_2m);
        const code = current.weather_code;

        setWeather({
          temp,
          humidity: current.relative_humidity_2m,
          label: describeWeather(code),
          hint: dispatchHint(code, temp),
          city: cityName,
          updatedAt: new Date(),
        });
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load weather');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    fetchWeather();
    const intervalId = setInterval(fetchWeather, REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [lat, lon, cityName]);

  return { weather, loading, error };
}
