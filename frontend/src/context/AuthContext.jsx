import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { authAPI, setAccessToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (accessToken) => {
    setAccessToken(accessToken);
    try {
      const data = await authAPI.me();
      setProfile(data.profile);
      return data.profile;
    } catch (apiErr) {
      console.error('[Auth] /api/auth/me failed:', apiErr?.message || apiErr);

      const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
      if (!userError && userData?.user) {
        const { data: row, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userData.user.id)
          .maybeSingle();

        if (profileError) {
          console.error('[Auth] user_profiles query:', profileError.message);
        } else if (row) {
          setProfile(row);
          return row;
        }
      }

      setProfile(null);
      return null;
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const current = data.session;
    setSession(current);
    if (current?.access_token) {
      await loadProfile(current.access_token);
    } else {
      setAccessToken(null);
      setProfile(null);
    }
    setLoading(false);
  }, [loadProfile]);

  useEffect(() => {
    refreshSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.access_token) {
        await loadProfile(newSession.access_token);
      } else {
        setAccessToken(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile, refreshSession]);

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
    if (data.session?.access_token) {
      const p = await loadProfile(data.session.access_token);
      if (!p) {
        await supabase.auth.signOut();
        throw new Error(
          'User profile not found. Contact your administrator. Ensure the backend is running (port 5000), user_profiles.id matches your Auth user UUID, and backend/.env includes SUPABASE_SERVICE_ROLE_KEY.'
        );
      }
    }
    return data;
  }

  async function signOut() {
    setAccessToken(null);
    setProfile(null);
    setSession(null);
    await supabase.auth.signOut();
  }

  const value = {
    session,
    profile,
    role: profile?.role ?? null,
    loading,
    signIn,
    signOut,
    isAuthenticated: Boolean(session && profile),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
