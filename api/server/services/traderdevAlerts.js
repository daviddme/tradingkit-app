const { logger } = require('@librechat/data-schemas');
const { getUserPluginAuthValue } = require('~/server/services/PluginService');

const ALERTS_BASE = process.env.TRADERDEV_ALERTS_URL || 'https://mcp-api.trader.dev';
const MCP_PLUGIN_KEY = 'mcp_trader-dev';
const MCP_AUTH_FIELD = 'TRADERDEV_KEY';

/**
 * Resolve the Trader.dev API key to act as: the user's own provisioned key if
 * present (PluginAuth mcp_trader-dev/TRADERDEV_KEY), otherwise the shared admin
 * key. The per-user key starts flowing automatically once provisioning unblocks.
 */
async function resolveUserKey(userId) {
  try {
    const personal = await getUserPluginAuthValue(userId, MCP_AUTH_FIELD, false, MCP_PLUGIN_KEY);
    if (personal) {
      return personal;
    }
  } catch (err) {
    logger.warn(`[tk-alerts] per-user key lookup failed, using admin fallback: ${err?.message}`);
  }
  return process.env.TRADERDEV_ADMIN_KEY || null;
}

/** Proxy a request to the Trader.dev alerts REST API as the given user. */
async function alertsRequest(userId, method, path, body) {
  const key = await resolveUserKey(userId);
  if (!key) {
    return { status: 503, data: { error: 'no_trader_dev_key' } };
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
