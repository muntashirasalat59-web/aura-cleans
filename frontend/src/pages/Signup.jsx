import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Clock, CreditCard, Check } from 'lucide-react';
import LoginParticleNetwork from '../components/LoginParticleNetwork';
import useAuthSceneTilt from '../hooks/useAuthSceneTilt';
import { authAPI } from '../api';
import { emailFormat, suggestEmailDomain } from '../utils/formValidation';

const PLANS = {
  '1_month': { label: '1 Month', price: 999 },
  '6_month': { label: '6 Months', price: 1500 },
  '1_year': { label: '1 Year', price: 2000 },
};

export default function Signup() {
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSuggestion, setEmailSuggestion] = useState(null);
  const [duplicateAccount, setDuplicateAccount] = useState(false);
  const [planChoice, setPlanChoice] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState('1_month');
  const { stageRef, copyRef, stackRef } = useAuthSceneTilt();

  function validateEmailLive(value) {
    const next = emailFormat(value);
    setEmailError(next || '');
    setEmailSuggestion(next ? null : suggestEmailDomain(value));
    return next;
  }

  function applyEmailSuggestion() {
    if (!emailSuggestion?.email) return;
    setEmail(emailSuggestion.email);
    setEmailError('');
    setEmailSuggestion(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setDuplicateAccount(false);

    const liveEmailError = validateEmailLive(email);
    if (liveEmailError) {
      return;
    }

    setSubmitting(true);

    try {
      const data = await authAPI.signup({
        business_name: businessName,
        full_name: fullName,
        email: email.trim().toLowerCase(),
        password,
        plan_choice: planChoice,
        selected_plan: planChoice === 'subscribe' ? selectedPlan : null,
      });

      if (data.payment_pending) {
        navigate('/payment-pending', {
          replace: true,
          state: {
            businessName,
            plan: selectedPlan,
            amount: PLANS[selectedPlan].price,
          },
        });
        return;
      }

      const confirmedEmail = data.email || email.trim().toLowerCase();
      if (data.needs_email_confirmation === false) {
        navigate('/login', { replace: true });
        return;
      }
      navigate(`/check-email?email=${encodeURIComponent(confirmedEmail)}`, { replace: true });
    } catch (err) {
      console.error('[signup]', err.status, err.code, err.message, err.detail || '');
      if (err.code === 'EMAIL_EXISTS' || err.status === 409 || /already exists/i.test(err.message || '')) {
        setDuplicateAccount(true);
        setError('An account with this email already exists.');
      } else if (err.code === 'INVALID_EMAIL' || /valid email/i.test(err.message || '')) {
        setEmailError('Enter a valid email address');
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
            <span className="login-3d-badge">Real-time sync</span>
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

            {!planChoice ? (
              <>
                <h2 className="login-3d-title">Get started</h2>
                <p className="login-3d-lead">Choose how you&apos;d like to begin.</p>

                <div className="login-3d-plans">
                  <button
                    type="button"
                    onClick={() => setPlanChoice('trial')}
                    className="login-3d-plan"
                  >
                    <span className="login-3d-plan-icon" aria-hidden>
                      <Clock className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="login-3d-plan-title">Start 10-day free trial</span>
                      <span className="login-3d-plan-sub">Full access, no payment required now</span>
                    </span>
                  </button>

                  <div className="login-3d-plan login-3d-plan-static">
                    <div className="login-3d-plan-head">
                      <span className="login-3d-plan-icon" aria-hidden>
                        <CreditCard className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="login-3d-plan-title">Subscribe now</span>
                        <span className="login-3d-plan-sub">Pick a plan to get started right away</span>
                      </span>
                    </div>

                    <div className="login-3d-plan-list">
                      {Object.entries(PLANS).map(([key, p]) => (
                        <label
                          key={key}
                          className={`login-3d-plan-option${selectedPlan === key ? ' is-selected' : ''}`}
                        >
                          <span className="login-3d-plan-option-left">
                            <span className={`login-3d-radio${selectedPlan === key ? ' is-selected' : ''}`}>
                              {selectedPlan === key && <Check className="h-2.5 w-2.5" />}
                            </span>
                            <span>{p.label}</span>
                          </span>
                          <span className="login-3d-plan-price">₹{p.price}</span>
                          <input
                            type="radio"
                            name="plan"
                            className="sr-only"
                            checked={selectedPlan === key}
                            onChange={() => setSelectedPlan(key)}
                          />
                        </label>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setPlanChoice('subscribe')}
                      className="login-3d-submit"
                    >
                      Continue with {PLANS[selectedPlan].label}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="login-3d-title">Create account</h2>
                <p className="login-3d-lead">
                  {planChoice === 'trial'
                    ? '10-day free trial · no payment now'
                    : `${PLANS[selectedPlan].label} plan · ₹${PLANS[selectedPlan].price}`}{' '}
                  <button
                    type="button"
                    onClick={() => setPlanChoice(null)}
                    className="login-3d-footer-link"
                  >
                    Change
                  </button>
                </p>

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
                    <span className="login-3d-label">Email</span>
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      disabled={submitting}
                      className={`login-3d-input${emailError ? ' login-3d-input-invalid' : ''}`}
                      value={email}
                      onChange={(e) => {
                        const next = e.target.value;
                        setEmail(next);
                        if (emailError || next.trim()) validateEmailLive(next);
                      }}
                      onBlur={() => validateEmailLive(email)}
                      placeholder="you@company.com"
                      aria-invalid={Boolean(emailError)}
                    />
                    {emailError ? <span className="login-3d-field-error">{emailError}</span> : null}
                    {!emailError && emailSuggestion ? (
                      <button
                        type="button"
                        className="login-3d-field-suggest"
                        onClick={applyEmailSuggestion}
                      >
                        Did you mean @{emailSuggestion.domain}?
                      </button>
                    ) : null}
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
                    disabled={submitting || Boolean(emailError)}
                    aria-busy={submitting}
                    className="login-3d-submit"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                        Creating account…
                      </>
                    ) : (
                      'Create account'
                    )}
                  </button>
                </form>
              </>
            )}

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
