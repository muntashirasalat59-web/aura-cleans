import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabaseConfig';
import { mapAuthError } from '../lib/authErrors';
import { STOCK_ALERT_DISMISS_KEY } from '../config/stock';
import { PAYMENT_ALERT_DISMISS_KEY } from '../config/payments';
import LoadingState from '../components/LoadingState';
import LoginParticleNetwork from '../components/LoginParticleNetwork';
import useAuthSceneTilt from '../hooks/useAuthSceneTilt';

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
  const { stageRef, copyRef, stackRef } = useAuthSceneTilt();

  if (loading) {
    return (
      <div className="login-3d-stage min-h-screen flex items-center justify-center">
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
    <div className="login-3d-stage" ref={stageRef}>
      <div className="login-3d-bg" aria-hidden />
      <LoginParticleNetwork />

      <div className="login-3d-row">
        <div className="login-3d-copy" ref={copyRef}>
          <h1 className="login-3d-headline">
            Manufacturing, inventory,
            <br />
            GST and distribution —
            <br />
            unified.
          </h1>
          <p className="login-3d-sub">
            One intelligent platform for hygiene manufacturing and distribution.
          </p>
          <div className="login-3d-badges">
            <span className="login-3d-badge">Secure</span>
            <span className="login-3d-badge">GST ready</span>
          </div>
        </div>

        <div className="login-3d-stack" ref={stackRef}>
          <div className="login-3d-layer login-3d-layer-back" aria-hidden />
          <div className="login-3d-layer login-3d-layer-mid" aria-hidden />

          <div className="login-3d-card">
            <div className="login-3d-brand">
              <span className="login-3d-mark" aria-hidden />
              <span className="login-3d-brand-name">Aura Clean</span>
            </div>

            <h2 className="login-3d-title">Sign in</h2>

            {!configured && (
              <p className="login-3d-warn">
                Missing <code>VITE_SUPABASE_URL</code> or <code>VITE_SUPABASE_ANON_KEY</code> in
                frontend/.env.
              </p>
            )}

            <form onSubmit={handleSubmit} className="login-3d-form">
              <label className="login-3d-field login-3d-field-email">
                <span className="login-3d-label">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  disabled={!configured || submitting}
                  className="login-3d-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </label>

              <label className="login-3d-field login-3d-field-password">
                <span className="login-3d-label">Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  disabled={!configured || submitting}
                  className="login-3d-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </label>

              {error && (
                <p className="login-3d-error" role="alert">
                  {error}
                  {/verify your email/i.test(error) && email.trim() ? (
                    <>
                      {' '}
                      <Link
                        to={`/check-email?email=${encodeURIComponent(email.trim().toLowerCase())}`}
                        className="login-3d-footer-link"
                      >
                        Resend email
                      </Link>
                    </>
                  ) : null}
                </p>
              )}

              <button
                type="submit"
                disabled={!configured || submitting}
                aria-busy={submitting}
                className="login-3d-submit"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <p className="login-3d-footer">
              Don&apos;t have an account?{' '}
              <Link to="/signup" className="login-3d-footer-link">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
