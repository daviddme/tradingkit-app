import { useCallback, useEffect, useRef, useState } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { Play, Trash2, RefreshCw } from 'lucide-react';
import { useAuthContext } from '~/hooks/AuthContext';
import { pendingChatPromptAtom } from '~/store/chatPrompt';
import { strategiesSignalAtom } from '~/store/strategiesPanel';
import { cn } from '~/utils';

type Strategy = {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  createdAt: string | null;
  mode?: string;
};

function retestPrompt(s: Strategy): string {
  return `Re-run a fresh backtest on my saved strategy "${s.name}" (${s.symbol} ${s.timeframe}), strategy id ${s.id}, on the latest market data, and show the results.`;
}

function relativeTime(ms: string | null): string {
  if (!ms) {
    return '';
  }
  const n = Number(ms);
  if (!Number.isFinite(n)) {
    return '';
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

export default function StrategiesPanel() {
  const { token } = useAuthContext();
  const setChatPrompt = useSetAtom(pendingChatPromptAtom);

  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const api = useCallback(
    async (method: string, path: string, body?: unknown) => {
      const res = await fetch(`/api/tk-strategies${path}`, {
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
      const list = await api('GET', '/');
      if (list.status === 409) {
        setPending(true);
      } else if (list.ok && Array.isArray(list.data)) {
        setStrategies(list.data as Strategy[]);
      } else {
        setError('Could not load strategies.');
      }
    } catch {
      setError('Could not load strategies.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  // Reload when a backtest completes in chat (a new strategy was recorded).
  const { refresh } = useAtomValue(strategiesSignalAtom);
  const lastRefresh = useRef(0);
  useEffect(() => {
    if (refresh > lastRefresh.current) {
      lastRefresh.current = refresh;
      load();
      const t = setTimeout(() => load(), 1500);
      return () => clearTimeout(t);
    }
  }, [refresh, load]);

  const remove = useCallback(
    async (id: string, name: string) => {
      if (!window.confirm(`Delete strategy "${name}"? This cannot be undone.`)) {
        return;
      }
      setBusyId(id);
      try {
        await api('DELETE', `/${id}`);
        await load();
      } finally {
        setBusyId(null);
      }
    },
    [api, load],
  );

  return (
    <div className="flex flex-col gap-2 px-2 pb-4 pt-2 text-text-primary">
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="text-sm font-semibold text-text-primary">My Strategies</div>
          <div className="text-xs text-text-secondary">Your backtested strategies</div>
        </div>
        <button
          onClick={load}
          className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover"
          title="Refresh"
          aria-label="Refresh strategies"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {loading && <div className="px-1 py-2 text-sm text-text-secondary">Loading…</div>}
      {error && !loading && <div className="px-1 py-2 text-sm text-red-500">{error}</div>}
      {pending && !loading && (
        <div className="px-1 py-2 text-sm text-text-secondary">
          Your Trader.dev account is still being set up. Refresh in a moment.
        </div>
      )}
      {!loading && !error && !pending && strategies.length === 0 && (
        <div className="px-1 py-2 text-sm text-text-secondary">
          No strategies yet. Run a backtest in chat and it shows up here.
        </div>
      )}

      {!loading &&
        strategies.map((s) => {
          const busy = busyId === s.id;
          const when = relativeTime(s.createdAt);
          return (
            <div
              key={s.id}
              className="rounded-lg border border-border-light bg-surface-secondary p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-text-primary" title={s.name}>
                    {s.name || 'Untitled strategy'}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {s.symbol} · {s.timeframe}
                    {when ? ` · ${when}` : ''}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 flex gap-1.5">
                <button
                  disabled={busy}
                  onClick={() => setChatPrompt(retestPrompt(s))}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-surface-active-alt py-1 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-50"
                  title="Re-run this backtest on the latest data"
                >
                  <Play className="h-3.5 w-3.5" /> Re-test
                </button>
                <button
                  disabled={busy}
                  onClick={() => remove(s.id, s.name)}
                  className="flex items-center justify-center gap-1 rounded-md border border-red-500/30 px-2.5 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                  title="Delete strategy"
                  aria-label="Delete strategy"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
    </div>
  );
}
