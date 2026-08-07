import { Loader2 } from 'lucide-react';

export default function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-[var(--app-muted)] dark:text-slate-400">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--app-accent)] dark:text-indigo-400" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
