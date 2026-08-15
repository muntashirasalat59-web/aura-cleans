import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { supportAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import TrialSupportChat from '../components/TrialSupportChat';
import { notifyDataSync } from '../lib/dataSync';

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
  const selectedIdRef = useRef(null);
  selectedIdRef.current = selectedId;

  const loadThreads = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await supportAPI.threads();
      const next = Array.isArray(data) ? data : [];
      const openId = selectedIdRef.current;
      setThreads(
        next.map((thread) => (openId && thread.user_id === openId ? { ...thread, unread: 0 } : thread))
      );
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
    const timer = setInterval(async () => {
      if (selectedIdRef.current) {
        try {
          await supportAPI.markRead(selectedIdRef.current);
        } catch {
          /* list() also marks read */
        }
      }
      await loadThreads(true);
      notifyDataSync('support_messages');
    }, 15000);
    return () => clearInterval(timer);
  }, [isPlatformAdmin, loadThreads]);

  async function openThread(userId) {
    setSelectedId(userId);
    setThreads((prev) => prev.map((thread) => (
      thread.user_id === userId ? { ...thread, unread: 0 } : thread
    )));
    try {
      await supportAPI.markRead(userId);
    } catch {
      /* GET thread also marks customer messages read */
    }
    notifyDataSync('support_messages');
    loadThreads(true);
  }

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
                  const unread = thread.unread > 0;
                  return (
                    <li key={thread.user_id}>
                      <button
                        type="button"
                        onClick={() => openThread(thread.user_id)}
                        className={`w-full px-4 py-3 text-left ${
                          active ? 'bg-emerald-500/10' : 'hover:bg-slate-50 dark:hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`truncate ${
                              unread
                                ? 'font-semibold text-slate-900 dark:text-white'
                                : 'font-medium text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {thread.full_name}
                          </p>
                          {unread ? (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">
                              {thread.unread}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {thread.phone || thread.email}
                        </p>
                        <p
                          className={`mt-1 truncate text-sm ${
                            unread
                              ? 'font-medium text-slate-800 dark:text-slate-100'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
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
