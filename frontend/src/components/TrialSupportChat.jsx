import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send, Trash2 } from 'lucide-react';
import { supportAPI } from '../api';

function formatTime(value) {
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function TrialSupportChat({
  userId = null,
  pollMs = 15000,
  compact = false,
  variant = 'dark',
}) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const bottomRef = useRef(null);
  const viewerIsAdmin = Boolean(userId);

  const loadMessages = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const data = await supportAPI.list(userId ? { user_id: userId } : undefined);
        setMessages(Array.isArray(data) ? data : []);
        setError('');
      } catch (err) {
        if (!silent) setError(err.message || 'Could not load messages.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    loadMessages();
    const timer = setInterval(() => loadMessages(true), pollMs);
    return () => clearInterval(timer);
  }, [loadMessages, pollMs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setError('');
    try {
      const created = await supportAPI.send({
        message: text,
        ...(userId ? { user_id: userId } : {}),
      });
      setMessages((prev) => [...prev, created]);
      setDraft('');
    } catch (err) {
      setError(err.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this message?')) return;
    setDeletingId(id);
    try {
      await supportAPI.delete(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err.message || 'Could not delete message.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className={`flex flex-col ${compact ? 'h-[420px]' : 'h-[360px]'}`}>
      <div
        className={`flex-1 space-y-2 overflow-y-auto rounded-lg border p-3 text-left ${
          variant === 'dark'
            ? 'border-white/10 bg-black/20'
            : 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5'
        }`}
      >
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            No messages yet. Write to our team below.
          </p>
        ) : (
          messages.map((msg) => {
            const mine = viewerIsAdmin ? msg.sender === 'admin' : msg.sender === 'customer';
            const label = viewerIsAdmin
              ? msg.sender === 'admin'
                ? 'You'
                : 'Customer'
              : msg.sender === 'admin'
                ? 'Team'
                : 'You';
            return (
              <div key={msg.id} className={`group flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex items-end gap-1.5 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      mine
                        ? 'bg-emerald-600 text-white'
                        : variant === 'dark'
                          ? 'bg-white/10 text-slate-100'
                          : 'bg-white text-slate-800 shadow-sm dark:bg-white/10 dark:text-slate-100'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                    <p className={`mt-1 text-[10px] ${mine ? 'text-emerald-100/80' : 'text-slate-400'}`}>
                      {label} · {formatTime(msg.created_at)}
                    </p>
                  </div>

                  {viewerIsAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDelete(msg.id)}
                      disabled={deletingId === msg.id}
                      title="Delete message"
                      className="mb-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50 group-hover:opacity-100"
                    >
                      {deletingId === msg.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <p className="mt-2 text-left text-xs text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSend} className="mt-3 flex gap-2">
        <textarea
          className={
            variant === 'dark'
              ? 'min-h-[44px] flex-1 resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none'
              : 'input input-premium min-h-[44px] flex-1 resize-none'
          }
          rows={2}
          maxLength={2000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your message…"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
          aria-label="Send message"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}