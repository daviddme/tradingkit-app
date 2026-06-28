const { Webhook } = require('svix');
const { logger } = require('@librechat/data-schemas');
const { SystemRoles } = require('librechat-data-provider');
const { findUser, upsertBalanceFields } = require('~/models');
const { getClerkUser, primaryEmail } = require('~/server/services/Clerk/clerkClient');
const { normalizePlan, resolveCreditsForPlan } = require('~/server/services/Clerk/planCredits');

const ADMIN_EMAIL = 'hi@davidd.tech';

/** Verify the Svix signature and return the decoded Clerk event. Throws on failure. */
function verifyEvent(req) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    throw new Error('CLERK_WEBHOOK_SIGNING_SECRET is not set');
  }
  const wh = new Webhook(secret);
  const headers = {
    'svix-id': req.headers['svix-id'],
    'svix-timestamp': req.headers['svix-timestamp'],
    'svix-signature': req.headers['svix-signature'],
  };
  const payload = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
  return wh.verify(payload, headers);
}

/** Best-effort extraction of the Clerk user id from a billing event payload. */
function extractClerkUserId(data) {
  if (!data) {
    return null;
  }
  return (
    data.payer?.user_id ||
    data.user_id ||
    data.payer_id ||
    (typeof data.payer === 'string' ? data.payer : null) ||
    null
  );
}

/** Best-effort extraction of a plan slug from a billing event payload. */
function extractPlanSlug(data) {
  if (!data) {
    return null;
  }
  return (
    data.plan?.slug ||
    data.plan_slug ||
    data.items?.[0]?.plan?.slug ||
    data.subscription_items?.[0]?.plan?.slug ||
    null
  );
}

/**
 * Clerk Billing webhook: on subscription lifecycle changes, set the user's
 * monthly credit balance to match their (new) plan. Cancellations/ends drop to
 * free. Bridge-time sync (in the auth controller) is the primary mechanism;
 * this keeps balances fresh when a plan changes mid-session.
 *
 * POST /api/clerk/webhook  (raw body, Svix-signed)
 */
async function clerkWebhookController(req, res) {
  let evt;
  try {
    evt = verifyEvent(req);
  } catch (err) {
    logger.warn(`[clerk webhook] verification failed: ${err?.message}`);
    return res.status(400).json({ message: 'Invalid signature' });
  }

  const { type, data } = evt;
  logger.info(`[clerk webhook] received ${type}`);

  // Only act on subscription / subscription-item lifecycle events.
  if (!/^subscription/i.test(type)) {
    return res.status(200).json({ received: true });
  }

  const clerkUserId = extractClerkUserId(data);
  if (!clerkUserId) {
    logger.warn(`[clerk webhook] no user id in ${type} payload; ignoring`);
    return res.status(200).json({ received: true });
  }

  const downgrade = /(canceled|cancelled|ended|abandoned|incomplete)$/i.test(type);
  const plan = downgrade ? 'free' : normalizePlan(extractPlanSlug(data));
  const credits = resolveCreditsForPlan(plan);

  try {
    let user = await findUser({ idOnTheSource: clerkUserId }, '_id email role');
    if (!user) {
      const clerkUser = await getClerkUser(clerkUserId);
      const email = primaryEmail(clerkUser);
      if (email) {
        user = await findUser({ email }, '_id email role');
      }
    }
    if (!user) {
      logger.warn(`[clerk webhook] no LibreChat user for Clerk id ${clerkUserId}; ignoring`);
      return res.status(200).json({ received: true });
    }
    if (user.role === SystemRoles.ADMIN || user.email === ADMIN_EMAIL) {
      return res.status(200).json({ received: true });
    }

    await upsertBalanceFields(user._id.toString(), {
      tokenCredits: credits,
      clerkPlan: plan,
      autoRefillEnabled: true,
      refillAmount: credits,
      refillIntervalValue: 30,
      refillIntervalUnit: 'days',
      lastRefill: new Date(),
    });
    logger.info(`[clerk webhook] set ${credits} credits (plan "${plan}") for ${user.email}`);
  } catch (err) {
    logger.error('[clerk webhook] failed to apply credits:', err);
    return res.status(500).json({ message: 'Failed to apply credits' });
  }

  return res.status(200).json({ received: true });
}

module.exports = clerkWebhookController;
