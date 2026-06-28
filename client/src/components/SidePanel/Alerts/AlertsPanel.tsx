import { useCallback, useEffect, useRef, useState } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { Plus, RefreshCw } from 'lucide-react';
import { useAuthContext } from '~/hooks/AuthContext';
import { alertsSignalAtom } from '~/store/alertsPanel';
import { pendingChatPromptAtom } from '~/store/chatPrompt';
import { cn } from '~/utils';

type Channel = { type?: string };
type Alert = {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  status: string;
  channels: Channel[];
  lastFiredAt: string | null;
};
type Quota = {
  used: number | string;
  limit: number | null;
  tier: string;
  unlimited: boolean;
  remaining: number | null;
};

const NEW_ALERT_PROMPT =
  'I want to set up a live alert. Show me the channel options (Webhook, Telegram, Email) and walk me through connecting one.';

function channelLabel(type?: string): string {
  switch ((type || '').toLowerCase()) {
    case 'webhook':
      return 'Webhook';
    case 'telegram':
      return 'Telegram';
    case 'email':
      return 'Email';
    default:
      return type || 'Channel';
  }
}

function relativeTime(ms: string | null): string {
  if (!ms) {
    return 'never';
  }
  const n = Number(ms);
  if (!Number.isFinite(n)) {
    return 'never';
  }
  const diff = Date.now() - n;
  if (diff < 60000) {
    return 'just now';
  }
  const mins = Math.floor(diff / 60000);
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    return `${hrs}h ago`;
  }
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AlertsPanel() {
  const { token } = useAuthContext();
  const setChatPrompt = useSetAtom(pendingChatPromptAtom);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const api = useCallback(
    async (method: string, path: string, body?: unknown) => {
      const res = await fetch(`/api/tk-alerts${path}`, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        credentials: 'include',
        cache: 'no-store',
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => null);
      return { ok: res.ok, status: res.status, data };
    },
    [token],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPending(false);
    try {
      const [list, q] = await Promise.all([api('GET', '/'), api('GET', '/quota')]);
      if (list.status === 409) {
        setPending(true);
      } else if (list.ok && Array.isArray(list.data)) {
        setAlerts(list.data as Alert[]);
      } else {
        setError('Could not load alerts.');
      }
      if (q.ok && q.data) {
        setQuota(q.data as Quota);
      }
    } catch {
      setError('Could not load alerts.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  // Reload whenever an alert tool completes in chat. Fires for both the
  // just-opened and the already-open panel. A short follow-up reload guards
  // against any brief lag between the tool returning and the list reflecting it.
  const { refresh } = useAtomValue(alertsSignalAtom);
  const lastRefresh = useRef(0);
  useEffect(() => {
    if (refresh > lastRefresh.current) {
      lastRefresh.current = refresh;
      load();
      const t = setTimeout(() => load(), 1200);
      return () => clearTimeout(t);
    }
  }, [refresh, load]);

  const act = useCallback(
    async (id: string, verb: 'pause' | 'resume' | 'test' | 'delete') => {
      setBusyId(id);
      try {
        if (verb === 'delete') {
          await api('DELETE', `/${id}`);
        } else {
          await api('POST', `/${id}/${verb}`);
        }
        if (verb !== 'test') {
          await load();
        }
      } finally {
        setBusyId(null);
      }
    },
    [api, load],
  );

  const quotaText = quota
    ? quota.unlimited
      ? `${quota.used} active · unlimited`
      : `${quota.used} / ${quota.limit ?? '—'} active alerts`
    : '';

  return (
    <div className="flex flex-col gap-2 px-2 pb-4 pt-2 text-text-primary">
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="text-sm font-semibold text-text-primary">My Alerts</div>
          {quotaText && <div className="text-xs text-text-secondary">{quotaText}</div>}
        </div>
        <button
          onClick={load}
          className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover"
          title="Refresh"
          aria-label="Refresh alerts"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      <button
        onClick={() => setChatPrompt(NEW_ALERT_PROMPT)}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-border-light bg-surface-active-alt py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover"
      >
        <Plus className="h-4 w-4" /> New alert
      </button>

      {loading && <div className="px-1 py-2 text-sm text-text-secondary">Loading…</div>}
      {error && !loading && <div className="px-1 py-2 text-sm text-red-500">{error}</div>}
      {pending && !loading && (
        <div className="px-1 py-2 text-sm text-text-secondary">
          Your Trader.dev account is still being set up. Refresh in a moment.
        </div>
      )}
      {!loading && !error && !pending && alerts.length === 0 && (
        <div className="px-1 py-2 text-sm text-text-secondary">
          No alerts yet. Create one to get notified the moment a strategy fires.
        </div>
      )}

      {!loading &&
        alerts.map((a) => {
          const paused = a.status === 'paused';
          const busy = busyId === a.id;
          return (
            <div
              key={a.id}
              className="rounded-lg border border-border-light bg-surface-secondary p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-text-primary" title={a.name}>
                    {a.name || 'Untitled alert'}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {a.symbol} · {a.timeframe} · fired {relativeTime(a.lastFiredAt)}
                  </div>
                </div>
                <span
                  className={cn(
                    'whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    paused
                      ? 'bg-surface-active-alt text-text-secondary'
                      : 'bg-green-500/15 text-green-600 dark:text-green-400',
                  )}
                >
                  {paused ? 'Paused' : 'Active'}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {(a.channels || []).length === 0 ? (
                  <span className="rounded border border-border-light px-1.5 py-0.5 text-[11px] text-text-secondary-alt">
                    No channels
                  </span>
                ) : (
                  a.channels.map((c, i) => (
                    <span
                      key={i}
                      className="rounded border border-border-light px-1.5 py-0.5 text-[11px] text-text-secondary"
                    >
                      {channelLabel(c.type)}
                    </span>
                  ))
                )}
              </div>

              <div className="mt-2.5 flex gap-1.5">
                <button
                  disabled={busy}
                  onClick={() => act(a.id, paused ? 'resume' : 'pause')}
                  className="flex-1 rounded-md border border-border-light py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-50"
                >
                  {paused ? 'Resume' : 'Pause'}
                </button>
                <button
                  disabled={busy}
                  onClick={() => act(a.id, 'test')}
                  className="flex-1 rounded-md border border-border-light py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-50"
                >
                  Test
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Delete alert "${a.name}"?`)) {
                      act(a.id, 'delete');
                    }
                  }}
                  className="flex-1 rounded-md border border-red-500/30 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
    </div>
  );
}
