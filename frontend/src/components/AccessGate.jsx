import { useEffect } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { hasValidAccess } from '../lib/access';
import AuraBrandLogo from './AuraBrandLogo';
import TrialSupportChat from './TrialSupportChat';

export default function AccessGate({ children }) {
  const { profile, signOut, refreshProfile } = useAuth();

  useEffect(() => {
    if (hasValidAccess(profile) || !refreshProfile) return undefined;
    const timer = setInterval(() => {
      refreshProfile();
    }, 15000);
    return () => clearInterval(timer);
  }, [profile, refreshProfile]);

  if (hasValidAccess(profile)) {
    return children;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <AuraBrandLogo variant="login-hero" />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center sm:p-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/30">
            <Lock className="h-6 w-6 text-red-300" />
          </div>

          <h1 className="text-xl font-bold text-white">Your trial has ended</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Send a message to our team to continue. Your data is safe and will be exactly where you
            left it.
          </p>

          <div className="mt-6">
            <TrialSupportChat />
          </div>

          <button
            type="button"
            onClick={() => signOut()}
            className="mt-6 text-sm text-slate-400 underline hover:text-slate-200"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
