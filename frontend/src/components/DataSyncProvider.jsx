import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { notifyDataSync } from '../lib/dataSync';

const SYNC_TABLES = [
  'parties',
  'products',
  'sales',
  'sale_items',
  'purchases',
  'purchase_items',
  'expenses',
  'employees',
  'user_profiles',
  'business_settings',
];

/** Listen to Supabase postgres changes — keeps UI in sync without manual refresh. */
export default function DataSyncProvider({ children }) {
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return undefined;

    let channel = supabase.channel('aura-app-data-sync');

    for (const table of SYNC_TABLES) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => notifyDataSync(table)
      );
    }

    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('[dataSync] Realtime unavailable — enable replication for public tables in Supabase.');
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return children;
}
