import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { supportAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import TrialSupportChat from '../components/TrialSupportChat';

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SupportInbox() {
  const { profile } = useAuth();
  const isPlatformAdmin = Boolean(profile?.is_platform_admin);
  const [threads, setThreads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadThreads = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await supportAPI.threads();
      setThreads(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      if (!silent) setError(err.message || 'Could not load inbox.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isPlatformAdmin) return undefined;
    loadThreads();
    const timer = setInterval(() => loadThreads(true), 15000);
    return () => clearInterval(timer);
  }, [isPlatformAdmin, loadThreads]);

  if (!isPlatformAdmin) {
    return <Navigate to="/" replace />;
  }

  const selected = threads.find((t) => t.user_id === selectedId) || null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Support inbox"
        description="Messages from customers whose trial has ended."
      />

      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      {loading && threads.length === 0 ? (
        <LoadingState message="Loading inbox…" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="table-wrap overflow-hidden">
            {threads.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">No customer messages yet.</p>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-white/10">
                {threads.map((thread) => {
                  const active = thread.user_id === selectedId;
                  return (
                    <li key={thread.user_id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(thread.user_id)}
                        className={`w-full px-4 py-3 text-left ${
                          active ? 'bg-emerald-500/10' : 'hover:bg-slate-50 dark:hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                            {thread.full_name}
                          </p>
                          {thread.unread > 0 ? (
                            <span className="badge badge-red">{thread.unread}</span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {thread.phone || thread.email}
                        </p>
                        <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-300">
                          {thread.last_message}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">{formatTime(thread.last_at)}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="form-panel min-h-[480px] p-4">
            {selected ? (
              <>
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {selected.full_name}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {selected.phone || selected.email}
                    {selected.trial_ends_at
                      ? ` · Trial ended ${new Date(selected.trial_ends_at).toLocaleDateString('en-IN')}`
                      : ''}
                  </p>
                </div>
                <TrialSupportChat userId={selected.user_id} compact variant="app" />
              </>
            ) : (
              <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-slate-500">
                <MessageSquare className="mb-3 h-8 w-8" />
                <p className="text-sm">Select a conversation to reply.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
