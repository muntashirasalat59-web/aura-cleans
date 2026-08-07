import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Loader2, Lock, Mail, Receipt, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabaseConfig';
import { mapAuthError } from '../lib/authErrors';
import { AURA } from '../config/auraBrand';
import { STOCK_ALERT_DISMISS_KEY } from '../config/stock';
import { PAYMENT_ALERT_DISMISS_KEY } from '../config/payments';
import AuraBrandLogo from '../components/AuraBrandLogo';
import LoadingState from '../components/LoadingState';

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: 'Secure' },
  { icon: RefreshCw, label: 'Real-time sync' },
  { icon: Receipt, label: 'GST compliant' },
];

export default function Login() {
  const { signIn, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const from = location.state?.from || '/';
  const configured = isSupabaseConfigured();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <LoadingState message="Checking session…" />
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!configured) {
      setError('Authentication is not configured. Add Supabase keys to frontend/.env.');
      return;
    }

    setSubmitting(true);
    try {
      await signIn(email, password);
      try {
        sessionStorage.removeItem(STOCK_ALERT_DISMISS_KEY);
        sessionStorage.removeItem(PAYMENT_ALERT_DISMISS_KEY);
      } catch {
        /* ignore */
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen min-h-screen flex flex-col lg:flex-row bg-slate-950">
      {/* —— Left: branding —— */}
      <div className="login-hero relative flex-1 flex flex-col justify-center px-8 py-14 lg:px-16 lg:py-20 text-white overflow-hidden min-h-[320px] lg:min-h-0">
        <div className="login-hero-mesh absolute inset-0" aria-hidden />
        <div className="login-hero-blob login-hero-blob-1 absolute rounded-full animate-login-blob" aria-hidden />
        <div className="login-hero-blob login-hero-blob-2 absolute rounded-full animate-login-blob-slow" aria-hidden />
        <div className="login-hero-blob login-hero-blob-3 absolute rounded-full animate-login-blob-drift" aria-hidden />
        <div className="login-hero-grid absolute inset-0" aria-hidden />
        <div className="login-hero-vignette absolute inset-0" aria-hidden />

        <div className="relative z-10 max-w-lg animate-fade-in">
          <div className="login-hero-badge inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-emerald-100/90 mb-8">
            <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
            Premium Cloud ERP
          </div>

          <div className="login-logo-wrap mb-8">
            <AuraBrandLogo variant="login-hero" />
          </div>

          <h1 className="login-headline text-[2rem] sm:text-[2.35rem] lg:text-[2.65rem] font-bold tracking-tight leading-[1.15]">
            Manufacturing, inventory,{' '}
            <span className="login-headline-accent">GST &amp; distribution</span> — unified.
          </h1>

          <p className="mt-5 text-slate-300/90 text-sm lg:text-base leading-relaxed max-w-md">{AURA.description}</p>

          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3">
            {TRUST_ITEMS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm text-slate-300/85">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
                  <Icon className="h-4 w-4 text-emerald-300/90" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* —— Right: sign-in —— */}
      <div className="login-form-panel relative flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-12 overflow-hidden">
        <div className="login-form-panel-glow absolute inset-0 pointer-events-none" aria-hidden />
        <div className="login-form-panel-blob login-form-panel-blob-1 absolute rounded-full animate-login-blob-slow pointer-events-none" aria-hidden />
        <div className="login-form-panel-blob login-form-panel-blob-2 absolute rounded-full animate-login-blob-drift pointer-events-none" aria-hidden />

        <div className="relative w-full max-w-[420px] animate-scale-in">
          <div className="login-card-premium rounded-2xl p-8 sm:p-10">
            <div className="flex justify-center mb-7 lg:hidden">
              <div className="login-logo-wrap login-logo-wrap-sm">
                <AuraBrandLogo variant="login-hero" />
              </div>
            </div>

            <div className="mb-7">
              <h2 className="text-2xl font-bold text-white tracking-tight text-center lg:text-left">Sign in</h2>
              <p className="text-sm text-slate-400 mt-1.5 text-center lg:text-left leading-relaxed">
                Use your authorized work email and password.
              </p>
            </div>

            {!configured && (
              <p className="text-sm text-amber-200/95 bg-amber-950/40 border border-amber-500/20 rounded-xl px-3.5 py-2.5 mb-5">
                Missing <code className="text-amber-100 text-xs">VITE_SUPABASE_URL</code> or{' '}
                <code className="text-amber-100 text-xs">VITE_SUPABASE_ANON_KEY</code> in frontend/.env.
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="block">
                <span className="login-field-label">Email</span>
                <div className="login-field-wrap mt-2">
                  <Mail className="login-field-icon" aria-hidden />
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    disabled={!configured || submitting}
                    className="login-input login-input-with-icon"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                  />
                </div>
              </label>

              <label className="block">
                <span className="login-field-label">Password</span>
                <div className="login-field-wrap mt-2">
                  <Lock className="login-field-icon" aria-hidden />
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    disabled={!configured || submitting}
                    className="login-input login-input-with-icon"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </label>

              {error && (
                <p className="login-error text-sm rounded-xl px-3.5 py-2.5" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!configured || submitting}
                aria-busy={submitting}
                className="login-submit-btn btn btn-primary w-full btn-lg mt-1"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                    <span>Signing in…</span>
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-400">
                  Don't have an account?{' '}
                  <Link to="/signup" className="text-emerald-300 hover:text-emerald-200 font-medium">
                  Create one
  </Link>
</p>
          </div>
        </div>
      </div>
    </div>
  );
}
