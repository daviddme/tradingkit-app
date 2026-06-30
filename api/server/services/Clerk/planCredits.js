/**
 * Maps Clerk Billing plan slugs to a monthly TradingKit credit grant
 * (tokenCredits, where 1000 tokenCredits = 1 mill = $0.001). These mirror the
 * tiers in the auth/credits/billing design spec and can be tuned freely without
 * touching any wiring.
 *
 * Pure module: no DB, no Clerk SDK, no env. Fully unit-tested.
 */
const DEFAULT_PLAN = 'free';

const PLAN_CREDITS = {
  free: 50000,
  pro: 1000000,
  pro_plus: 5000000,
};

// Accept the common slug spellings Clerk might emit (hyphen/space/casing).
const PLAN_ALIASES = {
  free: 'free',
  pro: 'pro',
  'pro-plus': 'pro_plus',
  pro_plus: 'pro_plus',
  proplus: 'pro_plus',
  'pro plus': 'pro_plus',
};

/** Normalize a raw plan slug to a known plan key, falling back to the default. */
function normalizePlan(rawSlug) {
  if (!rawSlug || typeof rawSlug !== 'string') {
    return DEFAULT_PLAN;
  }
  const key = rawSlug.trim().toLowerCase();
  if (PLAN_ALIASES[key]) {
    return PLAN_ALIASES[key];
  }
  if (Object.prototype.hasOwnProperty.call(PLAN_CREDITS, key)) {
    return key;
  }
  return DEFAULT_PLAN;
}

/**
 * Extract the plan slug from a Clerk session-token `pla` claim.
 * Format is `<scope>:<slug>` (e.g. "u:pro", "o:free"); multiple comma-separated
 * entries are possible, in which case the first is used.
 */
function planFromClaim(pla) {
  if (!pla || typeof pla !== 'string') {
    return DEFAULT_PLAN;
  }
  const first = pla.split(',')[0];
  const slug = first.includes(':') ? first.split(':').slice(1).join(':') : first;
  return normalizePlan(slug);
}

/** Monthly credit grant for a plan key/slug. */
function resolveCreditsForPlan(planKeyOrSlug) {
  const key = normalizePlan(planKeyOrSlug);
  return PLAN_CREDITS[key] != null ? PLAN_CREDITS[key] : PLAN_CREDITS[DEFAULT_PLAN];
}

/**
 * Per-tier LLM-CHAT rail (tokenCredits, 1000 = $0.001). Since credits were
 * unified, the member's *visible* balance is their live Trader.dev balance
 * (what backtests spend); this rail is the invisible backstop that meters only
 * the chat LLM tokens. It must be generous enough never to block in normal use
 * (a confusing "insufficient balance" while the shown Trader.dev credits look
 * fine), while still capping runaway abuse. Tune freely.
 *   free 2M=$2 / starter 10M=$10 / pro 50M=$50 / og 1B≈unmetered.
 */
const TRADERDEV_TIER_CREDITS = {
  free: 2000000,
  starter: 10000000,
  pro: 50000000,
  og: 1000000000,
};

/** Credit grant for a Trader.dev tier; `tier` already normalized by the caller. */
function resolveCreditsForTier(tier) {
  const key = typeof tier === 'string' ? tier.trim().toLowerCase() : 'free';
  return TRADERDEV_TIER_CREDITS[key] != null
    ? TRADERDEV_TIER_CREDITS[key]
    : TRADERDEV_TIER_CREDITS.free;
}

module.exports = {
  DEFAULT_PLAN,
  PLAN_CREDITS,
  TRADERDEV_TIER_CREDITS,
  normalizePlan,
  planFromClaim,
  resolveCreditsForPlan,
  resolveCreditsForTier,
};
