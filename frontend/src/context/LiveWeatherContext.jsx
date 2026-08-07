import { createContext, useContext } from 'react';

const LiveWeatherContext = createContext(null);

export function LiveWeatherProvider({ value, children }) {
  return (
    <LiveWeatherContext.Provider value={value}>{children}</LiveWeatherContext.Provider>
  );
}

/** Shared live weather from Layout (one Open-Meteo fetch for header + dashboard). */
export function useSharedLiveWeather() {
  const ctx = useContext(LiveWeatherContext);
  if (!ctx) {
    throw new Error('useSharedLiveWeather must be used within LiveWeatherProvider');
  }
  return ctx;
}
