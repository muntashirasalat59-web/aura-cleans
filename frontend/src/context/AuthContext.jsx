import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { isSupabaseConfigured } from '../lib/supabaseConfig';
import { mapAuthError } from '../lib/authErrors';
import { authAPI, setAccessToken, setUnauthorizedHandler } from '../api';
import { isPhoneAuthEmail, loginIdentifierToEmail } from '../utils/formValidation';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const signingOutRef = useRef(false);

  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setProfile(null);
    setSession(null);
  }, []);

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

  const signOut = useCallback(async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    clearAuth();
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) {
          console.error('[Auth] signOut failed:', error.message);
        }
      }
    } finally {
      signingOutRef.current = false;
    }
  }, [clearAuth]);

  const applySession = useCallback(
    async (nextSession) => {
      setSession(nextSession);
      if (nextSession?.access_token) {
        const p = await loadProfile(nextSession.access_token);
        if (!p) {
          await signOut();
        }
      } else {
        clearAuth();
      }
    },
    [clearAuth, loadProfile, signOut]
  );

  const refreshSession = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      clearAuth();
      setLoading(false);
      return;
    }

    try {
      const { data } = await supabase.auth.getSession();
      await applySession(data.session);
    } catch (err) {
      console.error('[Auth] session restore failed:', err);
      clearAuth();
    } finally {
      setLoading(false);
    }
  }, [applySession, clearAuth]);

  useEffect(() => {
    refreshSession();

    if (!isSupabaseConfigured()) {
      return undefined;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      /* Boot path already handled by refreshSession — avoid duplicate /auth/me. */
      if (event === 'INITIAL_SESSION') return;
      await applySession(newSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [applySession, refreshSession]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  async function signIn(identifier, password) {
    if (!isSupabaseConfigured()) {
      throw new Error('Authentication is not configured.');
    }

    const email = loginIdentifierToEmail(identifier);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(mapAuthError(error));
    }

    const confirmedAt = data.user?.email_confirmed_at || data.user?.confirmed_at;
    if (data.user && !confirmedAt && !isPhoneAuthEmail(email)) {
      await supabase.auth.signOut({ scope: 'local' });
      throw new Error('Please verify your email first. Check your inbox.');
    }

    if (data.session?.access_token) {
      const p = await loadProfile(data.session.access_token);
      if (!p) {
        await signOut();
        throw new Error('Account not provisioned. Contact your administrator.');
      }
      setSession(data.session);
    }

    return data;
  }

  const refreshProfile = useCallback(async () => {
    if (session?.access_token) {
      return loadProfile(session.access_token);
    }
    return null;
  }, [loadProfile, session?.access_token]);

  const value = {
    session,
    profile,
    role: profile?.role ?? null,
    loading,
    signIn,
    signOut,
    refreshProfile,
    isAuthenticated: Boolean(session?.access_token && profile),
    isConfigured: isSupabaseConfigured(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
