import { useEffect, useState } from 'react';
import { useAuthContext } from '~/hooks/AuthContext';
import { useSubmitMessage } from '~/hooks';

type PublicStrategy = { id: string; name: string; symbol: string; timeframe: string };

/** Generic builder prompts — always available, and the fallback if the fetch fails. */
const GENERIC = [
  'Build an RSI mean-reversion strategy on BTC 1h',
  'Build an EMA crossover with an ADX filter on ETH 4h',
  'Build a MACD momentum strategy on SOL 1h',
];

const STRATEGY_ACTIONS: Array<(s: PublicStrategy) => string> = [
  (s) => `Optimise the "${s.name}" strategy`,
  (s) => `Backtest "${s.name}" and explain the results`,
  (s) => `Fork "${s.name}" and try to improve it`,
];

/** Interleave a few real community-strategy prompts with the generic builders. */
function buildPrompts(strategies: PublicStrategy[]): string[] {
  const fromStrategies = strategies
    .slice(0, 3)
    .map((s, i) => STRATEGY_ACTIONS[i % STRATEGY_ACTIONS.length](s));
  const out: string[] = [];
  for (let i = 0; i < 3; i++) {
    if (fromStrategies[i]) {
      out.push(fromStrategies[i]);
    }
    if (GENERIC[i]) {
      out.push(GENERIC[i]);
    }
  }
  return out.slice(0, 6);
}

/**
 * Starter-prompt chips on the new/empty chat, above the composer. Mixes generic
 * "build a strategy" prompts with prompts referencing real top community
 * strategies fetched from Trader.dev. Clicking a chip sends it immediately.
 */
export default function StrategyStarters() {
  const { token } = useAuthContext();
  const { submitMessage } = useSubmitMessage();
  const [prompts, setPrompts] = useState<string[]>(GENERIC);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/tk-strategies/public', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
          cache: 'no-store',
        });
        const data = res.ok ? await res.json() : null;
        const strategies = Array.isArray(data) ? (data as PublicStrategy[]) : [];
        if (!cancelled && strategies.length > 0) {
          setPrompts(buildPrompts(strategies));
        }
      } catch {
        /* keep the generic fallback already in state */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (prompts.length === 0) {
    return null;
  }

  return (
    <div className="mb-3 flex flex-wrap items-center justify-center gap-2 px-2">
      {prompts.map((p, i) => (
        <button
          key={i}
          type="button"
          title={p}
          onClick={() => submitMessage({ text: p })}
          className="max-w-[15rem] truncate rounded-full border border-border-medium bg-surface-secondary px-3.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          {p}
        </button>
      ))}
    </div>
  );
}
