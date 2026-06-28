import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { Play, Trash2, RefreshCw, MessageSquare } from 'lucide-react';
import { useAuthContext } from '~/hooks/AuthContext';
import { pendingChatPromptAtom } from '~/store/chatPrompt';
import { strategiesSignalAtom } from '~/store/strategiesPanel';
import {
  getCaptures,
  removeCaptureByStrategyId,
  type BacktestCapture,
} from '~/utils/backtestCapture';
import EquitySparkline from './EquitySparkline';
import { cn } from '~/utils';

type Strategy = {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  createdAt: string | null;
  mode?: string;
};

type Row = {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  createdAt: string | null;
  capture?: BacktestCapture;
};

function retestPrompt(r: Row): string {
  return `Re-run a fresh backtest on my saved strategy "${r.name}" (${r.symbol} ${r.timeframe}), strategy id ${r.id}, on the latest market data, and show the results.`;
}

function relativeTime(ms: string | number | null): string {
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

function pct(v: number | null, digits = 1): string {
  return v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;
}

export default function StrategiesPanel() {
  const { token, user } = useAuthContext();
  const userId = user?.id ?? '';
  const setChatPrompt = useSetAtom(pendingChatPromptAtom);
  const navigate = useNavigate();

  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [captures, setCaptures] = useState<BacktestCapture[]>([]);
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
    setCaptures(getCaptures(userId));
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
  }, [api, userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Reload when a backtest completes in chat (a new capture was recorded).
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

  // Merge: enrich base strategies with captures by id; prepend captures whose
  // strategy isn't in the (possibly admin-polluted / deduped) base list.
  const rows = useMemo<Row[]>(() => {
    const capById = new Map(captures.map((c) => [c.strategyId, c]));
    const baseIds = new Set(strategies.map((s) => s.id));
    const orphans: Row[] = captures
      .filter((c) => !baseIds.has(c.strategyId))
      .map((c) => ({
        id: c.strategyId,
        name: c.name,
        symbol: c.symbol,
        timeframe: c.timeframe,
        createdAt: String(c.capturedAt),
        capture: c,
      }));
    const base: Row[] = strategies.map((s) => ({ ...s, capture: capById.get(s.id) }));
    return [...orphans, ...base];
  }, [strategies, captures]);

  const remove = useCallback(
    async (id: string, name: string) => {
      if (!window.confirm(`Delete strategy "${name}"? This cannot be undone.`)) {
        return;
      }
      setBusyId(id);
      try {
        await api('DELETE', `/${id}`);
        removeCaptureByStrategyId(userId, id);
        await load();
      } finally {
        setBusyId(null);
      }
    },
    [api, load, userId],
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
      {!loading && !error && !pending && rows.length === 0 && (
        <div className="px-1 py-2 text-sm text-text-secondary">
          No strategies yet. Run a backtest in chat and it shows up here.
        </div>
      )}

      {!loading &&
        rows.map((r) => {
          const busy = busyId === r.id;
          const c = r.capture;
          const up = (c?.returnPct ?? 0) >= 0;
          return (
            <div
              key={r.id}
              className="rounded-lg border border-border-light bg-surface-secondary p-3"
            >
              {c && (
                <>
                  <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
                    <span className={cn('font-semibold', up ? 'text-green-500' : 'text-red-500')}>
                      {pct(c.returnPct)}
                    </span>
                    <span className="text-text-secondary">DD {pct(c.maxDrawdownPct)?.replace('+', '')}</span>
                    <span className="text-text-secondary">
                      Win {c.winRatePct == null ? '—' : `${Math.round(c.winRatePct)}%`}
                    </span>
                    <span className="text-text-secondary">
                      {c.totalTrades == null ? '' : `${c.totalTrades} trades`}
                    </span>
                  </div>
                  {c.r2Url && (
                    <div className="mb-2 overflow-hidden rounded border border-border-light bg-surface-primary">
                      <EquitySparkline url={c.r2Url} up={up} />
                    </div>
                  )}
                </>
              )}

              <div className="truncate text-sm font-medium text-text-primary" title={r.name}>
                {r.name || 'Untitled strategy'}
              </div>
              <div className="text-xs text-text-secondary">
                {r.symbol} · {r.timeframe}
                {relativeTime(r.createdAt) ? ` · ${relativeTime(r.createdAt)}` : ''}
              </div>

              <div className="mt-2.5 flex gap-1.5">
                <button
                  disabled={busy}
                  onClick={() => setChatPrompt(retestPrompt(r))}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-surface-active-alt py-1 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-50"
                  title="Re-run this backtest on the latest data"
                >
                  <Play className="h-3.5 w-3.5" /> Re-test
                </button>
                {c?.conversationId && (
                  <button
                    disabled={busy}
                    onClick={() => navigate(`/c/${c.conversationId}`)}
                    className="flex items-center justify-center gap-1 rounded-md border border-border-light px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-50"
                    title="Open the chat this backtest came from"
                    aria-label="Open original chat"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  disabled={busy}
                  onClick={() => remove(r.id, r.name)}
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
