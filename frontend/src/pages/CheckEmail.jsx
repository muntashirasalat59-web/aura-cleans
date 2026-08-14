import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, Mail } from 'lucide-react';
import LoginParticleNetwork from '../components/LoginParticleNetwork';
import useAuthSceneTilt from '../hooks/useAuthSceneTilt';
import { authAPI } from '../api';
import { emailFormat } from '../utils/formValidation';

export default function CheckEmail() {
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get('email') || '';
  const [email, setEmail] = useState(initialEmail);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { stageRef, copyRef, stackRef } = useAuthSceneTilt();

  const emailErr = useMemo(() => (email.trim() ? emailFormat(email) : null), [email]);

  async function handleResend() {
    setError('');
    setMessage('');
    const invalid = emailFormat(email);
    if (invalid) {
      setError(invalid);
      return;
    }

    setResending(true);
    try {
      const data = await authAPI.resendConfirmation(email.trim().toLowerCase());
      if (data.already_confirmed) {
        setMessage(data.message || 'This email is already verified. Sign in instead.');
      } else {
        setMessage("If you still need to verify, we've sent another confirmation link.");
      }
    } catch (err) {
      if (err.status === 429 || /wait a moment/i.test(err.message || '')) {
        setError(err.message || 'Please wait a moment before requesting another email.');
      } else {
        setError('Could not resend confirmation email. Please try again.');
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="login-3d-stage" ref={stageRef}>
      <div className="login-3d-bg" aria-hidden />
      <LoginParticleNetwork />

      <div className="login-3d-row">
        <div className="login-3d-copy" ref={copyRef}>
          <h1 className="login-3d-headline">
            Check your inbox
            <br />
            to activate Aura.
          </h1>
          <p className="login-3d-sub">
            Confirm your email so we know it&apos;s really you.
          </p>
        </div>

        <div className="login-3d-stack" ref={stackRef}>
          <div className="login-3d-layer login-3d-layer-back" aria-hidden />
          <div className="login-3d-layer login-3d-layer-mid" aria-hidden />

          <div className="login-3d-card">
            <div className="login-3d-brand">
              <span className="login-3d-mark" aria-hidden />
              <span className="login-3d-brand-name">Aura Clean</span>
            </div>

            <div className="login-3d-check-icon" aria-hidden>
              <Mail className="h-6 w-6" />
            </div>
            <h2 className="login-3d-title">Verify your email</h2>
            <p className="login-3d-lead">
              We&apos;ve sent a confirmation link to your email. Please verify to activate your
              account.
            </p>
            {initialEmail ? (
              <p className="login-3d-check-email">{initialEmail}</p>
            ) : (
              <label className="login-3d-field login-3d-field-email">
                <span className="login-3d-label">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  className="login-3d-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </label>
            )}

            {error && (
              <p className="login-3d-error" role="alert">
                {error}
              </p>
            )}
            {message && <p className="login-3d-success">{message}</p>}

            <button
              type="button"
              onClick={handleResend}
              disabled={resending || Boolean(emailErr) || !email.trim()}
              aria-busy={resending}
              className="login-3d-submit"
            >
              {resending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                  Sending…
                </>
              ) : (
                'Resend email'
              )}
            </button>

            <p className="login-3d-footer">
              Already verified?{' '}
              <Link to="/login" className="login-3d-footer-link">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
