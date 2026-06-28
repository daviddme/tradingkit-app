/**
 * Client-side capture of backtest results as they run in chat, so the My
 * Strategies panel can show stats + an equity-curve sparkline and jump back to
 * the originating conversation. Stored in localStorage per user (browser-local;
 * not synced across devices).
 */
export type BacktestCapture = {
  strategyId: string;
  name: string;
  symbol: string;
  timeframe: string;
  returnPct: number | null;
  maxDrawdownPct: number | null;
  winRatePct: number | null;
  totalTrades: number | null;
  r2Url: string | null;
  conversationId: string | null;
  capturedAt: number;
};

const KEY = (userId: string) => `tk:bt:${userId || 'anon'}`;
const MAX = 80;

export function getCaptures(userId: string): BacktestCapture[] {
  try {
    const raw = localStorage.getItem(KEY(userId));
    const arr = raw ? (JSON.parse(raw) as BacktestCapture[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveCapture(userId: string, rec: BacktestCapture): void {
  try {
    const list = getCaptures(userId).filter((c) => c.strategyId !== rec.strategyId);
    list.unshift(rec);
    localStorage.setItem(KEY(userId), JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* ignore quota / serialization errors */
  }
}

export function removeCaptureByStrategyId(userId: string, strategyId: string): void {
  try {
    const list = getCaptures(userId).filter((c) => c.strategyId !== strategyId);
    localStorage.setItem(KEY(userId), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Extract the first balanced {...} JSON object from a mixed-text string. */
function extractJsonObject(str: string): unknown | null {
  const start = str.indexOf('{');
  if (start < 0) {
    return null;
  }
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (ch === '\\') {
        esc = true;
      } else if (ch === '"') {
        inStr = false;
      }
      continue;
    }
    if (ch === '"') {
      inStr = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(str.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Parse a backtest tool call (input args + output) into a capture record, or
 * null if it isn't a recognizable backtest result.
 */
export function parseBacktestCapture(
  input: string,
  output: string,
  conversationId: string | null,
): BacktestCapture | null {
  if (!output || !/r2Url|equityReturnPct|"result"/.test(output)) {
    return null;
  }
  const parsed = extractJsonObject(output) as
    | { result?: Record<string, unknown>; resultId?: string }
    | Record<string, unknown>
    | null;
  if (!parsed) {
    return null;
  }
  const result = ((parsed as { result?: Record<string, unknown> }).result ??
    parsed) as Record<string, unknown>;
  const r2Url = typeof result.r2Url === 'string' ? result.r2Url : null;
  const strategyId =
    (typeof result.strategyId === 'string' && result.strategyId) ||
    (typeof result.id === 'string' && result.id) ||
    null;
  if (!strategyId || (!r2Url && result.equityReturnPct === undefined)) {
    return null;
  }

  // Name from the Pine `strategy("...")` in the input args (the result has none).
  let name = '';
  let argSymbol = '';
  let argTf = '';
  try {
    const args = JSON.parse(input) as { pineSource?: string; symbol?: string; timeframe?: string };
    argSymbol = args.symbol || '';
    argTf = args.timeframe || '';
    const m = (args.pineSource || '').match(/strategy\s*\(\s*"([^"]+)"/);
    if (m) {
      name = m[1];
    }
  } catch {
    const m = input.match(/strategy\s*\(\s*\\?"([^"\\]+)\\?"/);
    if (m) {
      name = m[1];
    }
  }

  return {
    strategyId,
    name: name || 'Backtest',
    symbol: (result.symbol as string) || argSymbol || '',
    timeframe: (result.timeframe as string) || argTf || '',
    returnPct: num(result.equityReturnPct) ?? num(result.netProfitPct),
    maxDrawdownPct: num(result.maxDrawdownPct),
    winRatePct: num(result.winRatePct),
    totalTrades: num(result.totalTrades),
    r2Url,
    conversationId: conversationId || null,
    capturedAt: Date.now(),
  };
}
