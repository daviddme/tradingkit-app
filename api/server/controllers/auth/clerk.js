const { logger } = require('@librechat/data-schemas');
const { SystemRoles } = require('librechat-data-provider');
const { findUser, createUser, updateUser } = require('~/models');
const { setAuthTokens } = require('~/server/services/AuthService');
const {
  isClerkEnabled,
  verifyClerkToken,
  getClerkUser,
  primaryEmail,
} = require('~/server/services/Clerk/clerkClient');
const {
  ensureTraderDevKey,
  syncTierCredits,
} = require('~/server/services/Clerk/traderdevProvision');

const ADMIN_EMAIL = 'hi@davidd.tech';

/** Pull the Clerk session token from the JSON body or the Authorization header. */
function extractToken(req) {
  if (req.body && typeof req.body.token === 'string' && req.body.token) {
    return req.body.token;
  }
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
}

/**
 * Auth bridge: verify a Clerk session token, find-or-create the matching
 * LibreChat user, force the owner account to ADMIN, sync plan credits, and
 * issue a native LibreChat session (refreshToken + token_provider cookies) so
 * the rest of the app works unchanged.
 *
 * POST /api/clerk/session  body: { token } | Authorization: Bearer <clerk jwt>
 */
async function clerkAuthController(req, res) {
  if (!isClerkEnabled()) {
    return res.status(404).json({ message: 'Clerk auth is not enabled' });
  }

  const token = extractToken(req);
  if (!token) {
    return res.status(400).json({ message: 'Missing Clerk session token' });
  }

  let claims;
  try {
    claims = await verifyClerkToken(token);
  } catch (err) {
    logger.warn(`[clerk] token verification failed: ${err?.message}`);
    return res.status(401).json({ message: 'Invalid Clerk session token' });
  }

  const clerkUserId = claims.sub;

  let clerkUser;
  try {
    clerkUser = await getClerkUser(clerkUserId);
  } catch (err) {
    logger.error('[clerk] failed to fetch Clerk user profile:', err);
    return res.status(502).json({ message: 'Could not load Clerk profile' });
  }

  const email = primaryEmail(clerkUser);
  if (!email) {
    return res.status(400).json({ message: 'Clerk account has no email address' });
  }
  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() ||
    clerkUser.username ||
    email.split('@')[0];

  try {
    let user = await findUser({ email }, '-password -totpSecret -backupCodes');

    if (!user) {
      const isAdmin = email === ADMIN_EMAIL;
      const newUserData = {
        provider: 'clerk',
        email,
        name,
        username: clerkUser.username || undefined,
        avatar: clerkUser.imageUrl || undefined,
        emailVerified: true,
        idOnTheSource: clerkUserId,
        role: isAdmin ? SystemRoles.ADMIN : SystemRoles.USER,
      };
      // disableTTL=true (real user, not a temp signup), returnUser=true.
      user = await createUser(newUserData, undefined, true, true);
      logger.info(`[clerk] created user ${email} (${user._id})`);
    } else {
      const updates = {};
      if (email === ADMIN_EMAIL && user.role !== SystemRoles.ADMIN) {
        updates.role = SystemRoles.ADMIN;
      }
      if (!user.idOnTheSource) {
        updates.idOnTheSource = clerkUserId;
      }
      if (Object.keys(updates).length > 0) {
        await updateUser(user._id, updates);
        Object.assign(user, updates);
      }
    }

    const userId = user._id.toString();

    // Auto-provision the user's personal Trader.dev account + MCP key first, so
    // their account exists before we read its tier (best-effort; never blocks).
    try {
      await ensureTraderDevKey(userId, email, name);
    } catch (err) {
      logger.error('[clerk] Trader.dev provisioning failed:', err);
    }

    // Credits follow the member's Trader.dev tier ("Trader.dev plan governs
    // access"). Admins are metering-exempt, so skip them.
    if (user.role !== SystemRoles.ADMIN && email !== ADMIN_EMAIL) {
      try {
        await syncTierCredits(userId, email);
      } catch (err) {
        logger.error('[clerk] failed to sync tier credits:', err);
      }
    }

    const lcToken = await setAuthTokens(userId, res, null, req);
    return res.status(200).json({ token: lcToken, user });
  } catch (err) {
    logger.error('[clerk] auth bridge failed:', err);
    return res.status(500).json({ message: 'Failed to establish session' });
  }
}

module.exports = clerkAuthController;
