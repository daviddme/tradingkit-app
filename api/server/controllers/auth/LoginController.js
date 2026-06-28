const { logger } = require('@librechat/data-schemas');
const { generate2FATempToken } = require('~/server/services/twoFactorService');
const { setAuthTokens } = require('~/server/services/AuthService');
const { ensureTraderDevKey } = require('~/server/services/Clerk/traderdevProvision');

const loginController = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (req.user.twoFactorEnabled) {
      const tempToken = generate2FATempToken(req.user._id);
      return res.status(200).json({ twoFAPending: true, tempToken });
    }

    const { password: _p, totpSecret: _t, __v, ...user } = req.user;
    user.id = user._id.toString();

    // TradingKit: provision/store the user's personal Trader.dev MCP key on
    // native login too (the Clerk bridge does this for Clerk logins). For the
    // owner account this stores the unlimited admin key. Best-effort.
    try {
      await ensureTraderDevKey(user.id, req.user.email, req.user.name);
    } catch (err) {
      logger.error('[loginController] Trader.dev provisioning failed:', err);
    }

    const token = await setAuthTokens(req.user._id, res, null, req);

    return res.status(200).send({ token, user });
  } catch (err) {
    logger.error('[loginController]', err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = {
  loginController,
};
