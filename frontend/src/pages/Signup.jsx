import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Loader2, Lock, Mail, User, ShieldCheck, RefreshCw, Receipt, Sparkles, Clock, CreditCard, Check } from 'lucide-react';
import { AURA } from '../config/auraBrand';
import AuraBrandLogo from '../components/AuraBrandLogo';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: 'Secure' },
  { icon: RefreshCw, label: 'Real-time sync' },
  { icon: Receipt, label: 'GST compliant' },
];

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
  const [success, setSuccess] = useState('');
  const [planChoice, setPlanChoice] = useState(null); // 'trial' | 'subscribe'
  const [selectedPlan, setSelectedPlan] = useState('1_month');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: businessName,
          full_name: fullName,
          email,
          password,
          plan_choice: planChoice,
          selected_plan: planChoice === 'subscribe' ? selectedPlan : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Signup failed');
      }

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

      setSuccess('Account created! Redirecting to sign in…');
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err) {
      setError(err.message);
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
            Start running your business{' '}
            <span className="login-headline-accent">on one platform</span>.
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

      {/* —— Right: sign-up form —— */}
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

            {!planChoice ? (
              <>
                <div className="mb-7">
                  <h2 className="text-2xl font-bold text-white tracking-tight text-center lg:text-left">Get started</h2>
                  <p className="text-sm text-slate-400 mt-1.5 text-center lg:text-left leading-relaxed">
                    Choose how you'd like to begin.
                  </p>
                </div>

                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setPlanChoice('trial')}
                    className="w-full text-left rounded-xl border border-white/10 bg-white/[0.03] hover:border-emerald-400/40 hover:bg-emerald-400/[0.06] transition-colors p-5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400/10 ring-1 ring-emerald-400/20 shrink-0">
                        <Clock className="h-5 w-5 text-emerald-300" />
                      </span>
                      <div>
                        <p className="text-white font-semibold">Start 10-day free trial</p>
                        <p className="text-slate-400 text-xs mt-0.5">Full access, no payment required now</p>
                      </div>
                    </div>
                  </button>

                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400/10 ring-1 ring-emerald-400/20 shrink-0">
                        <CreditCard className="h-5 w-5 text-emerald-300" />
                      </span>
                      <div>
                        <p className="text-white font-semibold">Subscribe now</p>
                        <p className="text-slate-400 text-xs mt-0.5">Pick a plan to get started right away</p>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      {Object.entries(PLANS).map(([key, p]) => (
                        <label
                          key={key}
                          className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 cursor-pointer transition-colors ${
                            selectedPlan === key
                              ? 'border-emerald-400/50 bg-emerald-400/[0.08]'
                              : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                                selectedPlan === key ? 'border-emerald-400 bg-emerald-400' : 'border-slate-500'
                              }`}
                            >
                              {selectedPlan === key && <Check className="h-2.5 w-2.5 text-slate-950" />}
                            </span>
                            <span className="text-sm text-slate-200">{p.label}</span>
                          </span>
                          <span className="text-sm font-medium text-slate-300">₹{p.price}</span>
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
                      className="btn btn-primary w-full"
                    >
                      Continue with {PLANS[selectedPlan].label}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="mb-7">
                  <h2 className="text-2xl font-bold text-white tracking-tight text-center lg:text-left">Create account</h2>
                  <p className="text-sm text-slate-400 mt-1.5 text-center lg:text-left leading-relaxed">
                    {planChoice === 'trial'
                      ? '10-day free trial · no payment now'
                      : `${PLANS[selectedPlan].label} plan · ₹${PLANS[selectedPlan].price}`}{' '}
                    <button
                      type="button"
                      onClick={() => setPlanChoice(null)}
                      className="text-emerald-300 hover:text-emerald-200 font-medium"
                    >
                      Change
                    </button>
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <label className="block">
                    <span className="login-field-label">Business name</span>
                    <div className="login-field-wrap mt-2">
                      <Building2 className="login-field-icon" aria-hidden />
                      <input
                        type="text"
                        required
                        disabled={submitting}
                        className="login-input login-input-with-icon"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Your Business Pvt Ltd"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="login-field-label">Your name</span>
                    <div className="login-field-wrap mt-2">
                      <User className="login-field-icon" aria-hidden />
                      <input
                        type="text"
                        required
                        disabled={submitting}
                        className="login-input login-input-with-icon"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Full name"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="login-field-label">Email</span>
                    <div className="login-field-wrap mt-2">
                      <Mail className="login-field-icon" aria-hidden />
                      <input
                        type="email"
                        autoComplete="email"
                        required
                        disabled={submitting}
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
                        autoComplete="new-password"
                        required
                        minLength={6}
                        disabled={submitting}
                        className="login-input login-input-with-icon"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                      />
                    </div>
                  </label>

                  {error && (
                    <p className="login-error text-sm rounded-xl px-3.5 py-2.5" role="alert">
                      {error}
                    </p>
                  )}
                  {success && (
                    <p className="text-sm rounded-xl px-3.5 py-2.5 bg-emerald-950/40 border border-emerald-500/20 text-emerald-200">
                      {success}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    aria-busy={submitting}
                    className="login-submit-btn btn btn-primary w-full btn-lg mt-1"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                        <span>Creating account…</span>
                      </>
                    ) : (
                      'Create account'
                    )}
                  </button>
                </form>
              </>
            )}

            <p className="mt-6 text-center text-sm text-slate-400">
              Already have an account?{' '}
              <Link to="/login" className="text-emerald-300 hover:text-emerald-200 font-medium">
                Sign in
              </Link>
            </p>

            <p className="mt-6 text-center text-[11px] text-slate-500 leading-relaxed">
              Protected workspace · Secure signup
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}