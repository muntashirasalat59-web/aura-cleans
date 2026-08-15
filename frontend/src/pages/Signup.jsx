import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import LoginParticleNetwork from '../components/LoginParticleNetwork';
import useAuthSceneTilt from '../hooks/useAuthSceneTilt';
import { authAPI } from '../api';
import { digitsOnly, indianMobileStrict, normalizeIndianMobile } from '../utils/formValidation';

export default function Signup() {
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [duplicateAccount, setDuplicateAccount] = useState(false);
  const { stageRef, copyRef, stackRef } = useAuthSceneTilt();

  function validatePhoneLive(value) {
    const next = indianMobileStrict(value);
    setPhoneError(next || '');
    return next;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setDuplicateAccount(false);

    const livePhoneError = validatePhoneLive(phone);
    if (livePhoneError) return;

    setSubmitting(true);

    try {
      await authAPI.signup({
        business_name: businessName,
        full_name: fullName,
        phone: normalizeIndianMobile(phone),
        password,
      });

      navigate('/login', {
        replace: true,
        state: { signedUp: true, phone: normalizeIndianMobile(phone) },
      });
    } catch (err) {
      console.error('[signup]', err.status, err.code, err.message, err.detail || '');
      if (err.code === 'PHONE_EXISTS' || err.status === 409 || /already exists/i.test(err.message || '')) {
        setDuplicateAccount(true);
        setError('An account with this phone number already exists.');
      } else if (err.code === 'INVALID_PHONE') {
        setPhoneError(err.message || 'Enter a valid Indian mobile number');
      } else {
        setError(err.message || 'Could not create account. Please try again.');
      }
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
            Start running your business
            <br />
            on one platform.
          </h1>
          <p className="login-3d-sub">
            One intelligent platform for hygiene manufacturing and distribution.
          </p>
          <div className="login-3d-badges">
            <span className="login-3d-badge">Secure</span>
            <span className="login-3d-badge">10-day free trial</span>
            <span className="login-3d-badge">GST compliant</span>
          </div>
        </div>

        <div className="login-3d-stack login-3d-stack-signup" ref={stackRef}>
          <div className="login-3d-layer login-3d-layer-back" aria-hidden />
          <div className="login-3d-layer login-3d-layer-mid" aria-hidden />

          <div className="login-3d-card">
            <div className="login-3d-brand">
              <span className="login-3d-mark" aria-hidden />
              <span className="login-3d-brand-name">Aura Clean</span>
            </div>

            <h2 className="login-3d-title">Create account</h2>
            <p className="login-3d-lead">Start your 10-day free trial — no payment now.</p>

            <form onSubmit={handleSubmit} className="login-3d-form">
              <label className="login-3d-field login-3d-field-email">
                <span className="login-3d-label">Business name</span>
                <input
                  type="text"
                  required
                  disabled={submitting}
                  className="login-3d-input"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Your Business Pvt Ltd"
                />
              </label>

              <label className="login-3d-field login-3d-field-email">
                <span className="login-3d-label">Your name</span>
                <input
                  type="text"
                  required
                  disabled={submitting}
                  className="login-3d-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                />
              </label>

              <label className="login-3d-field login-3d-field-email">
                <span className="login-3d-label">Phone number</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  required
                  maxLength={10}
                  disabled={submitting}
                  className={`login-3d-input${phoneError ? ' login-3d-input-invalid' : ''}`}
                  value={phone}
                  onChange={(e) => {
                    const next = digitsOnly(e.target.value, 10);
                    setPhone(next);
                    if (phoneError || next.length === 10) validatePhoneLive(next);
                    else setPhoneError('');
                  }}
                  onBlur={() => validatePhoneLive(phone)}
                  placeholder="10-digit Indian mobile"
                  aria-invalid={Boolean(phoneError)}
                />
                {phoneError ? <span className="login-3d-field-error">{phoneError}</span> : null}
              </label>

              <label className="login-3d-field">
                <span className="login-3d-label">Password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  disabled={submitting}
                  className="login-3d-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                />
              </label>

              {error && (
                <p className="login-3d-error" role="alert">
                  {error}
                  {duplicateAccount ? (
                    <>
                      {' '}
                      <Link to="/login" className="login-3d-footer-link">
                        Sign in instead.
                      </Link>
                    </>
                  ) : null}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || Boolean(phoneError)}
                aria-busy={submitting}
                className="login-3d-submit"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                    Creating account…
                  </>
                ) : (
                  'Start free trial'
                )}
              </button>
            </form>

            <p className="login-3d-footer">
              Already have an account?{' '}
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
