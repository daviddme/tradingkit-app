const { logger } = require('@librechat/data-schemas');
const {
  updateUserPluginAuth,
  getUserPluginAuthValue,
} = require('~/server/services/PluginService');

const PROVISION_BASE = process.env.TRADERDEV_PROVISION_URL || 'https://mcp-api.trader.dev';
const ADMIN_EMAIL = 'hi@davidd.tech';

// MCP server name in librechat.yaml is `trader-dev`; LibreChat namespaces its
// per-user credentials as `mcp_<serverName>` with one authField per customUserVar.
const MCP_PLUGIN_KEY = 'mcp_trader-dev';
const MCP_AUTH_FIELD = 'TRADERDEV_KEY';

function adminKey() {
  return process.env.TRADERDEV_ADMIN_KEY;
}

/** POST /provision/user with the admin key. Returns { status, data }. */
async function callProvision(email, displayName, rotateKey) {
  const res = await fetch(`${PROVISION_BASE}/provision/user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminKey()}`,
    },
    body: JSON.stringify({ email, displayName, rotateKey }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

/**
 * Ensure the LibreChat user has a personal Trader.dev MCP key stored, so their
 * MCP connection runs as their own auto-provisioned Trader.dev account instead
 * of a shared admin key.
 *
 * Idempotent and best-effort: callers swallow errors so a provisioning hiccup
 * never blocks login.
 *  - Already have a stored key -> nothing to do.
 *  - New/unprovisioned Trader.dev user -> mint + store the returned key.
 *  - Pre-existing Trader.dev user whose key is hidden -> rotate to mint a fresh,
 *    usable key and store it.
 */
async function ensureTraderDevKey(userId, email, displayName) {
  if (!adminKey()) {
    logger.warn('[traderdev] TRADERDEV_ADMIN_KEY not set; skipping provisioning');
    return { provisioned: false, reason: 'no_admin_key' };
  }

  const existing = await getUserPluginAuthValue(userId, MCP_AUTH_FIELD, false, MCP_PLUGIN_KEY);
  if (existing) {
    return { provisioned: true, reason: 'already_stored' };
  }

  // The owner account uses the unlimited shared admin key directly (no free-tier
  // Trader.dev account), so admin backtests/alerts are never metered.
  if (email === ADMIN_EMAIL) {
    await updateUserPluginAuth(userId, MCP_AUTH_FIELD, MCP_PLUGIN_KEY, adminKey());
    logger.info('[traderdev] stored unlimited admin key for owner account');
    return { provisioned: true, reason: 'admin_key' };
  }

  let { status, data } = await callProvision(email, displayName, false);
  if (status >= 400) {
    logger.error(
      `[traderdev] provision failed ${status}: ${JSON.stringify(data).slice(0, 300)}`,
    );
    return { provisioned: false, reason: `http_${status}` };
  }

  let apiKey = data.apiKey;
  if (!apiKey && data.exists) {
    // User exists on Trader.dev but the plaintext key is hidden; rotate to mint
    // a fresh usable key (the old one is revoked server-side).
    const rotated = await callProvision(email, displayName, true);
    if (rotated.status < 400) {
      apiKey = rotated.data.apiKey;
      data = rotated.data;
    }
  }

  if (!apiKey) {
    logger.warn(`[traderdev] no apiKey returned for ${email} after provisioning`);
    return { provisioned: false, reason: 'no_key' };
  }

  await updateUserPluginAuth(userId, MCP_AUTH_FIELD, MCP_PLUGIN_KEY, apiKey);
  logger.info(
    `[traderdev] stored personal MCP key for ${email} (tier=${data.tier}, credits=${data.credits})`,
  );
  return { provisioned: true, reason: data.created ? 'created' : 'rotated', tier: data.tier };
}

module.exports = { ensureTraderDevKey, MCP_PLUGIN_KEY, MCP_AUTH_FIELD };
