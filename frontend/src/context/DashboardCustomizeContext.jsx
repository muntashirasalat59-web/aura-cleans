import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const DashboardCustomizeContext = createContext(null);

export function DashboardCustomizeProvider({ children }) {
  const [controls, setControls] = useState(null);

  const register = useCallback((next) => {
    setControls(next);
  }, []);

  const unregister = useCallback(() => {
    setControls(null);
  }, []);

  const value = useMemo(
    () => ({
      controls,
      register,
      unregister,
    }),
    [controls, register, unregister]
  );

  return (
    <DashboardCustomizeContext.Provider value={value}>
      {children}
    </DashboardCustomizeContext.Provider>
  );
}

export function useDashboardCustomize() {
  const ctx = useContext(DashboardCustomizeContext);
  if (!ctx) {
    throw new Error('useDashboardCustomize must be used within DashboardCustomizeProvider');
  }
  return ctx;
}

/** Safe for Layout — returns null controls when provider missing. */
export function useDashboardCustomizeOptional() {
  return useContext(DashboardCustomizeContext);
}
