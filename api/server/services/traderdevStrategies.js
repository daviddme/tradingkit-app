const { logger } = require('@librechat/data-schemas');
const { resolveUserKey } = require('~/server/services/traderdevAlerts');

const BASE = process.env.TRADERDEV_ALERTS_URL || 'https://mcp-api.trader.dev';

/** Proxy a request to the Trader.dev strategies REST API as the given user. */
async function strategiesRequest(user, method, path, body) {
  const key = await resolveUserKey(user);
  if (!key) {
    return { status: 409, data: { error: 'provisioning_pending' } };
  }
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } catch (err) {
    logger.error(`[tk-strategies] upstream ${method} ${path} failed:`, err);
    return { status: 502, data: { error: 'strategies_upstream_unreachable' } };
  }
}

/**
 * List the user's backtested strategies, deduped by name+symbol+timeframe
 * (keeping the most recent version of each so re-runs collapse to one row),
 * newest first, capped. The upstream endpoint ignores pagination, so we slim +
 * cap here.
 */
async function listStrategies(user, limit = 60) {
  const { status, data } = await strategiesRequest(user, 'GET', '/strategies');
  if (status !== 200 || !Array.isArray(data)) {
    return { status, data };
  }
  const byKey = new Map();
  for (const s of data) {
    const key = `${s.name}|${s.symbol}|${s.timeframe}`;
    const prev = byKey.get(key);
    if (!prev || Number(s.createdAt) > Number(prev.createdAt)) {
      byKey.set(key, s);
    }
  }
  const slim = [...byKey.values()]
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
    .slice(0, limit)
    .map((s) => ({
      id: s.id,
      name: s.name,
      symbol: s.symbol,
      timeframe: s.timeframe,
      createdAt: s.createdAt,
      mode: s.mode,
    }));
  return { status: 200, data: slim };
}

// Names that signal internal/test strategies we don't want to surface as starters.
const JUNK_NAME =
  /(test|audit|baseline|random|uniform|freq|sanity|debug|\bdbg|cron|factory|\bwip\b|scratch|\btmp\b|\btemp\b|placeholder)/i;

/**
 * A curated list of public community strategies for the new-chat starter prompts:
 * drop internal/test names and obvious overfit (very low trade counts), slim the
 * fields, and cap. Public data, so any valid key works.
 */
async function publicStrategies(user, limit = 10) {
  const { status, data } = await strategiesRequest(user, 'GET', '/strategies/public');
  if (status !== 200) {
    return { status, data };
  }
  const cards = data && Array.isArray(data.cards) ? data.cards : [];
  const seen = new Set();
  const clean = cards
    .filter((c) => c.name && !JUNK_NAME.test(c.name))
    .filter((c) => {
      const t = Number(c.latestResult?.totalTrades);
      return Number.isFinite(t) && t >= 5; // drop 1-2 trade overfit
    })
    .filter((c) => {
      const key = c.name.trim().toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((c) => ({
      id: c.id,
      name: c.name,
      symbol: c.symbol,
      timeframe: c.timeframe,
      winRatePct: c.latestResult?.winRatePct,
      maxDrawdownPct: c.latestResult?.maxDrawdownPct,
      totalTrades: c.latestResult?.totalTrades,
    }))
    .slice(0, limit);
  return { status: 200, data: clean };
}

module.exports = { strategiesRequest, listStrategies, publicStrategies };
