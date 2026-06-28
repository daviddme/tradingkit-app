const { logger } = require('@librechat/data-schemas');
const { getUserPluginAuthValue } = require('~/server/services/PluginService');

const ALERTS_BASE = process.env.TRADERDEV_ALERTS_URL || 'https://mcp-api.trader.dev';
const MCP_PLUGIN_KEY = 'mcp_trader-dev';
const MCP_AUTH_FIELD = 'TRADERDEV_KEY';

/**
 * Resolve the Trader.dev API key for a user: strictly their own provisioned key
 * (PluginAuth mcp_trader-dev/TRADERDEV_KEY). We do NOT fall back to the shared
 * admin key for arbitrary users — that would leak the admin's alerts. The owner
 * account already has the admin key stored as its own TRADERDEV_KEY (set during
 * the login bridge), so admins still resolve here normally. Returns null when a
 * user has no key yet (provisioning still in flight) -> caller returns 409.
 */
async function resolveUserKey(userId) {
  try {
    return (await getUserPluginAuthValue(userId, MCP_AUTH_FIELD, false, MCP_PLUGIN_KEY)) || null;
  } catch (err) {
    logger.warn(`[tk-alerts] per-user key lookup failed: ${err?.message}`);
    return null;
  }
}

/** Proxy a request to the Trader.dev alerts REST API as the given user. */
async function alertsRequest(userId, method, path, body) {
  const key = await resolveUserKey(userId);
  if (!key) {
    // No per-user key yet (provisioning still in flight). Distinct from an error.
    return { status: 409, data: { error: 'provisioning_pending' } };
  }
  try {
    const res = await fetch(`${ALERTS_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } catch (err) {
    logger.error(`[tk-alerts] upstream request failed ${method} ${path}:`, err);
    return { status: 502, data: { error: 'alerts_upstream_unreachable' } };
  }
}

module.exports = { alertsRequest, resolveUserKey };
