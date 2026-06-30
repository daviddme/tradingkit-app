const { findBalanceByUser } = require('~/models');
const { getCreditsCached } = require('~/server/services/traderdevCredits');

async function balanceController(req, res) {
  const balanceLocals = res.locals || {};

  if (balanceLocals.balanceConfigEnabled === false) {
    return res.sendStatus(204);
  }

  const balanceData = balanceLocals.balanceData ?? (await findBalanceByUser(req.user.id));

  if (!balanceData) {
    return res.status(404).json({ error: 'Balance not found' });
  }

  const { _id: _, ...result } = balanceData;

  if (!result.autoRefillEnabled) {
    delete result.refillIntervalValue;
    delete result.refillIntervalUnit;
    delete result.lastRefill;
    delete result.refillAmount;
  }

  // TradingKit: unify the displayed balance with the member's Trader.dev credits
  // (the same balance they hold on Trader.dev, topped up via Stripe, that their
  // backtests draw down). The DB `tokenCredits` stays the internal LLM-chat rail
  // used by server-side metering; we only swap the NUMBER shown to the user.
  // Best-effort: any failure leaves the chat-rail value so the menu never breaks.
  try {
    const tk = await getCreditsCached(req.user);
    if (tk && typeof tk.balance === 'number') {
      result.tokenCredits = tk.balance;
      result.tkUnified = true;
      if (tk.weeklyResetAt != null) {
        result.tkWeeklyResetAt = tk.weeklyResetAt;
      }
      if (typeof tk.weeklyGrant === 'number') {
        result.tkWeeklyGrant = tk.weeklyGrant;
      }
      if (tk.tier) {
        result.tkTier = tk.tier;
      }
    }
  } catch {
    // keep the chat-rail tokenCredits value
  }

  res.status(200).json(result);
}

module.exports = balanceController;
