const { createClerkClient, verifyToken } = require('@clerk/backend');
const { logger } = require('@librechat/data-schemas');

let _client = null;

/** Whether Clerk auth is configured (secret key present). */
function isClerkEnabled() {
  return !!(process.env.CLERK_SECRET_KEY && process.env.CLERK_SECRET_KEY.trim());
}

/** Lazily-built Clerk backend client (null when Clerk is not configured). */
function getClerkClient() {
  if (!isClerkEnabled()) {
    return null;
  }
  if (!_client) {
    _client = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  }
  return _client;
}

/**
 * Verify a Clerk session JWT against the configured instance.
 * Resolves to the decoded claims ({ sub, pla, fea, ... }); rejects on
 * invalid/expired tokens.
 */
async function verifyClerkToken(token) {
  return verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
}

/** Fetch the full Clerk user (email, name, avatar) by id. */
async function getClerkUser(userId) {
  const client = getClerkClient();
  if (!client) {
    return null;
  }
  return client.users.getUser(userId);
}

/** Primary (or first) verified email for a Clerk user object, lowercased. */
function primaryEmail(clerkUser) {
  if (!clerkUser) {
    return null;
  }
  const list = clerkUser.emailAddresses || [];
  const match = list.find((e) => e.id === clerkUser.primaryEmailAddressId) || list[0];
  return match?.emailAddress ? match.emailAddress.toLowerCase() : null;
}

module.exports = {
  isClerkEnabled,
  getClerkClient,
  verifyClerkToken,
  getClerkUser,
  primaryEmail,
  logger,
};
