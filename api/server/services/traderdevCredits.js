const { logger } = require('@librechat/data-schemas');
const { resolveUserKey } = require('~/server/services/traderdevAlerts');

const CREDITS_BASE = process.env.TRADERDEV_CREDITS_URL || 'https://mcp-api.trader.dev';

/**
 * Read the member's live Trader.dev credit balance. This is the single,
 * unified credit balance shown in TradingKit: the same credits they hold on
 * Trader.dev (topped up via Stripe there), which their backtests draw down.
 *
 * Runs as the user's own provisioned Trader.dev key (admin falls back to the
 * shared admin key). Returns { status, data }. 409 = key not provisioned yet.
 */
async function getCredits(user) {
  const key = await resolveUserKey(user);
  if (!key) {
    return { status: 409, data: { error: 'provisioning_pending' } };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${CREDITS_BASE}/credits`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (res.status >= 400 || !data) {
      return { status: res.status || 502, data: data || { error: 'credits_upstream_error' } };
    }
    // Slim to what the UI needs (the raw payload also carries affiliate flags etc.).
    return {
      status: 200,
      data: {
        balance: typeof data.balance === 'number' ? data.balance : null,
        weeklyGrant: typeof data.weeklyGrant === 'number' ? data.weeklyGrant : null,
        weeklyResetAt: data.weeklyResetAt ?? null,
        maxBalance: data.maxBalance ?? null,
        unlimited: !!data.unlimited,
        tier: data.subscription?.tier || data.subscription?.displayTier || null,
      },
    };
  } catch (err) {
    if (err?.name !== 'AbortError') {
      logger.error('[tk-credits] upstream request failed:', err);
    }
    return { status: 502, data: { error: 'credits_upstream_unreachable' } };
  } finally {
    clearTimeout(timer);
  }
}

// Short per-user cache so the hot /api/balance path (refetched on focus + after
// every message) doesn't hit Trader.dev each time. Returns the slim credits
// object, or the last good value, or null.
const _cache = new Map();
const CACHE_MS = 10000;

async function getCreditsCached(user) {
  const userId = typeof user === 'string' ? user : user?.id;
  const now = Date.now();
  const hit = _cache.get(userId);
  if (hit && now - hit.at < CACHE_MS) {
    return hit.data;
  }
  const { status, data } = await getCredits(user);
  if (status === 200 && data && typeof data.balance === 'number') {
    _cache.set(userId, { at: now, data });
    return data;
  }
  return hit ? hit.data : null;
}

module.exports = { getCredits, getCreditsCached };
