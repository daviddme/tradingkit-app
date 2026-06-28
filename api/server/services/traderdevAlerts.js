const { logger } = require('@librechat/data-schemas');
const { getUserPluginAuthValue } = require('~/server/services/PluginService');

const ALERTS_BASE = process.env.TRADERDEV_ALERTS_URL || 'https://mcp-api.trader.dev';
const MCP_PLUGIN_KEY = 'mcp_trader-dev';
const MCP_AUTH_FIELD = 'TRADERDEV_KEY';
const ADMIN_EMAIL = 'hi@davidd.tech';

/**
 * Resolve the Trader.dev API key for a user: their own provisioned key
 * (PluginAuth mcp_trader-dev/TRADERDEV_KEY). We do NOT fall back to the shared
 * admin key for arbitrary users — that would leak the admin's alerts. ONLY the
 * owner/admin falls back to the admin key (so the admin always works even if the
 * stored var is missing). Returns null otherwise -> caller returns 409.
 */
async function resolveUserKey(user) {
  const userId = typeof user === 'string' ? user : user?.id;
  try {
    const personal = await getUserPluginAuthValue(userId, MCP_AUTH_FIELD, false, MCP_PLUGIN_KEY);
    if (personal) {
      return personal;
    }
  } catch (err) {
    logger.warn(`[tk-alerts] per-user key lookup failed: ${err?.message}`);
  }
  const isAdmin =
    user && typeof user === 'object' && (user.role === 'ADMIN' || user.email === ADMIN_EMAIL);
  if (isAdmin) {
    return process.env.TRADERDEV_ADMIN_KEY || null;
  }
  return null;
}

/** Proxy a request to the Trader.dev alerts REST API as the given user. */
async function alertsRequest(user, method, path, body) {
  const key = await resolveUserKey(user);
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
