const {
  DEFAULT_PLAN,
  PLAN_CREDITS,
  TRADERDEV_TIER_CREDITS,
  normalizePlan,
  planFromClaim,
  resolveCreditsForPlan,
  resolveCreditsForTier,
} = require('./planCredits');

describe('planCredits', () => {
  describe('resolveCreditsForTier (Trader.dev tiers)', () => {
    test('maps known Trader.dev tiers to the configured rail', () => {
      expect(resolveCreditsForTier('free')).toBe(TRADERDEV_TIER_CREDITS.free);
      expect(resolveCreditsForTier('starter')).toBe(TRADERDEV_TIER_CREDITS.starter);
      expect(resolveCreditsForTier('pro')).toBe(TRADERDEV_TIER_CREDITS.pro);
      expect(resolveCreditsForTier('og')).toBe(TRADERDEV_TIER_CREDITS.og);
    });

    test('handles casing/whitespace and falls back to free', () => {
      expect(resolveCreditsForTier('  PRO ')).toBe(TRADERDEV_TIER_CREDITS.pro);
      expect(resolveCreditsForTier('unknown')).toBe(TRADERDEV_TIER_CREDITS.free);
      expect(resolveCreditsForTier(undefined)).toBe(TRADERDEV_TIER_CREDITS.free);
      expect(resolveCreditsForTier(null)).toBe(TRADERDEV_TIER_CREDITS.free);
    });

    test('every tier rail is generous (>= $1) so chat never blocks confusingly', () => {
      for (const key of Object.keys(TRADERDEV_TIER_CREDITS)) {
        expect(TRADERDEV_TIER_CREDITS[key]).toBeGreaterThanOrEqual(1000000);
      }
    });
  });

  describe('normalizePlan', () => {
    test('passes through known slugs', () => {
      expect(normalizePlan('free')).toBe('free');
      expect(normalizePlan('pro')).toBe('pro');
      expect(normalizePlan('pro_plus')).toBe('pro_plus');
    });

    test('handles aliases, casing, and whitespace', () => {
      expect(normalizePlan('Pro-Plus')).toBe('pro_plus');
      expect(normalizePlan('  PRO  ')).toBe('pro');
      expect(normalizePlan('proplus')).toBe('pro_plus');
      expect(normalizePlan('pro plus')).toBe('pro_plus');
    });

    test('falls back to default for unknown/empty/non-string', () => {
      expect(normalizePlan('enterprise')).toBe(DEFAULT_PLAN);
      expect(normalizePlan('')).toBe(DEFAULT_PLAN);
      expect(normalizePlan(undefined)).toBe(DEFAULT_PLAN);
      expect(normalizePlan(null)).toBe(DEFAULT_PLAN);
      expect(normalizePlan(42)).toBe(DEFAULT_PLAN);
    });
  });

  describe('planFromClaim', () => {
    test('parses scope:slug form', () => {
      expect(planFromClaim('u:pro')).toBe('pro');
      expect(planFromClaim('o:free')).toBe('free');
      expect(planFromClaim('u:pro_plus')).toBe('pro_plus');
    });

    test('uses the first of multiple comma-separated entries', () => {
      expect(planFromClaim('u:pro,o:free')).toBe('pro');
    });

    test('tolerates a bare slug with no scope prefix', () => {
      expect(planFromClaim('pro')).toBe('pro');
    });

    test('falls back to default for empty/missing claim', () => {
      expect(planFromClaim('')).toBe(DEFAULT_PLAN);
      expect(planFromClaim(undefined)).toBe(DEFAULT_PLAN);
      expect(planFromClaim('u:enterprise')).toBe(DEFAULT_PLAN);
    });
  });

  describe('resolveCreditsForPlan', () => {
    test('maps known plans to configured credit amounts', () => {
      expect(resolveCreditsForPlan('free')).toBe(PLAN_CREDITS.free);
      expect(resolveCreditsForPlan('pro')).toBe(PLAN_CREDITS.pro);
      expect(resolveCreditsForPlan('pro_plus')).toBe(PLAN_CREDITS.pro_plus);
    });

    test('unknown plan resolves to free credits', () => {
      expect(resolveCreditsForPlan('enterprise')).toBe(PLAN_CREDITS.free);
      expect(resolveCreditsForPlan(undefined)).toBe(PLAN_CREDITS.free);
    });

    test('every configured plan grants a positive credit amount', () => {
      for (const key of Object.keys(PLAN_CREDITS)) {
        expect(resolveCreditsForPlan(key)).toBeGreaterThan(0);
      }
    });
  });
});
