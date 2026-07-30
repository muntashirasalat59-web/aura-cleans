import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Building2, KeyRound, Lock, Mail, ShieldCheck, Smartphone, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AURA } from '../config/auraBrand';

const VIEWS = {
  login: 'login',
  forgot: 'forgot',
  otp: 'otp',
  twofa: 'twofa',
  company: 'company',
  role: 'role',
};

export default function Login() {
  const { signIn, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState(VIEWS.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [companyId, setCompanyId] = useState(AURA.companies[0].id);
  const [selectedRole, setSelectedRole] = useState('owner');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const from = location.state?.from || '/';
  const [postLoginFlow, setPostLoginFlow] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated && !postLoginFlow) {
      navigate(from, { replace: true });
    }
  }, [loading, isAuthenticated, postLoginFlow, from, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500 text-sm">
        Loading…
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
      setPostLoginFlow(true);
      setView(VIEWS.company);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  function finishOnboarding() {
    setPostLoginFlow(false);
    navigate(from, { replace: true });
  }

  return (
    <div className="login-screen min-h-screen flex flex-col lg:flex-row">
      <div className="login-hero relative flex-1 flex flex-col justify-center px-8 py-12 lg:px-14 lg:py-16 text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-950 via-brand-900 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.18),transparent_55%)]" />
        <div className="relative max-w-md">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-emerald-200/90 ring-1 ring-emerald-400/25 mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            Premium Cloud ERP
          </div>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-700 shadow-lg ring-1 ring-emerald-500/30">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">{AURA.name}</h1>
              <p className="text-sm text-emerald-300/80">{AURA.tagline}</p>
            </div>
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tighter leading-tight">
            Manufacturing, inventory, GST & distribution — unified.
          </h2>
          <p className="mt-4 text-slate-300 text-sm lg:text-base leading-relaxed">{AURA.description}</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-slate-50 dark:bg-slate-950">
        <div className="w-full max-w-md">
          <div className="login-card rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-8 sm:p-10 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
            {view === VIEWS.login && (
              <>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Sign in</h3>
                <p className="text-sm text-slate-500 mt-1 mb-6">Email, password, or OTP</p>
                <div className="flex gap-2 mb-6">
                  <button type="button" className="filter-pill filter-pill-active flex-1 text-xs">
                    Password
                  </button>
                  <button type="button" onClick={() => setView(VIEWS.otp)} className="filter-pill filter-pill-inactive flex-1 text-xs">
                    OTP
                  </button>
                </div>
                <form onSubmit={handleLoginSubmit} className="space-y-5">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
                    <div className="relative mt-1.5">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="email"
                        autoComplete="email"
                        required
                        className="input input-premium pl-10 w-full dark:bg-slate-950"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@auraclean.com"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</span>
                    <div className="relative mt-1.5">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="password"
                        autoComplete="current-password"
                        required
                        className="input input-premium pl-10 w-full dark:bg-slate-950"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                  </label>
                  <div className="flex justify-between text-sm">
                    <button type="button" onClick={() => setView(VIEWS.forgot)} className="text-brand-700 dark:text-brand-300 font-medium">
                      Forgot password?
                    </button>
                    <button type="button" onClick={() => setView(VIEWS.twofa)} className="text-slate-500 hover:text-slate-700">
                      2FA setup
                    </button>
                  </div>
                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}
                  <button type="submit" disabled={submitting} className="btn btn-primary w-full btn-lg">
                    {submitting ? 'Signing in…' : 'Continue'}
                  </button>
                </form>
              </>
            )}

            {view === VIEWS.forgot && (
              <>
                <h3 className="text-xl font-bold">Reset password</h3>
                <p className="text-sm text-slate-500 mt-1 mb-6">We will email a secure reset link.</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setView(VIEWS.login);
                  }}
                  className="space-y-4"
                >
                  <input type="email" required className="input input-premium w-full" placeholder="Work email" />
                  <button type="submit" className="btn btn-primary w-full">
                    Send reset link
                  </button>
                  <button type="button" onClick={() => setView(VIEWS.login)} className="btn btn-ghost w-full text-sm">
                    Back to sign in
                  </button>
                </form>
              </>
            )}

            {view === VIEWS.otp && (
              <>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-brand-700" /> OTP login
                </h3>
                <p className="text-sm text-slate-500 mt-1 mb-6">Enter the code sent to your mobile.</p>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="input input-premium w-full text-center tracking-[0.3em] text-lg"
                  placeholder="• • • • • •"
                  maxLength={6}
                />
                <button type="button" onClick={() => setView(VIEWS.company)} className="btn btn-primary w-full mt-4">
                  Verify OTP
                </button>
                <button type="button" onClick={() => setView(VIEWS.login)} className="btn btn-ghost w-full mt-2 text-sm">
                  Back
                </button>
              </>
            )}

            {view === VIEWS.twofa && (
              <>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" /> Two-factor authentication
                </h3>
                <p className="text-sm text-slate-500 mt-1 mb-6">Enter authenticator code after password.</p>
                <input className="input input-premium w-full text-center tracking-widest" placeholder="000000" />
                <button type="button" onClick={() => setView(VIEWS.company)} className="btn btn-primary w-full mt-4">
                  Verify
                </button>
                <button type="button" onClick={() => setView(VIEWS.login)} className="btn btn-ghost w-full mt-2 text-sm">
                  Back
                </button>
              </>
            )}

            {view === VIEWS.company && (
              <>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Building2 className="h-5 w-5" /> Select company
                </h3>
                <p className="text-sm text-slate-500 mt-1 mb-4">Session will be scoped to this entity.</p>
                <ul className="space-y-2 mb-6">
                  {AURA.companies.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setCompanyId(c.id)}
                        className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition-all ${
                          companyId === c.id
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/50 ring-2 ring-brand-500/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-brand-300'
                        }`}
                      >
                        <span className="font-semibold block">{c.name}</span>
                        <span className="text-xs text-slate-500">{c.city}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => setView(VIEWS.role)} className="btn btn-primary w-full">
                  Continue
                </button>
              </>
            )}

            {view === VIEWS.role && (
              <>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <KeyRound className="h-5 w-5" /> Select role
                </h3>
                <p className="text-sm text-slate-500 mt-1 mb-4">UI preview — permissions follow your account.</p>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="input input-premium w-full mb-6"
                >
                  <option value="owner">Owner</option>
                  <option value="sales">Sales Manager</option>
                  <option value="warehouse">Warehouse Manager</option>
                  <option value="accountant">Accountant</option>
                </select>
                <button type="button" onClick={finishOnboarding} className="btn btn-primary w-full">
                  Enter {AURA.name}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
