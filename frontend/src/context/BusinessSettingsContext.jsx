import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { settingsAPI } from '../api';
import { useDataSync } from '../hooks/useDataSync';

const EMPTY = {
  id: 1,
  company_name: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  gstin: '',
  phone: '',
  email: '',
  bank_name: '',
  bank_account_number: '',
  upi_id: '',
  logo_url: '',
  configured: false,
  address_display: '',
};

const BusinessSettingsContext = createContext(null);

export function BusinessSettingsProvider({ children }) {
  const [settings, setSettings] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await settingsAPI.getBusiness();
      setSettings({ ...EMPTY, ...data });
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load business settings');
      if (!silent) setSettings(EMPTY);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useDataSync('business_settings', () => refresh(true));

  const value = useMemo(
    () => ({
      settings,
      loading,
      error,
      refresh,
      setSettings,
    }),
    [settings, loading, error, refresh]
  );

  return (
    <BusinessSettingsContext.Provider value={value}>{children}</BusinessSettingsContext.Provider>
  );
}

export function useBusinessSettings() {
  const ctx = useContext(BusinessSettingsContext);
  if (!ctx) {
    throw new Error('useBusinessSettings must be used within BusinessSettingsProvider');
  }
  return ctx;
}
