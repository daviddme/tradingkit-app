const express = require('express');
const { requireJwtAuth } = require('../middleware/');
const { getCredits } = require('~/server/services/traderdevCredits');

const router = express.Router();
router.use(requireJwtAuth);

// Live Trader.dev credit balance for the signed-in member (the unified balance).
router.get('/', async (req, res) => {
  const result = await getCredits(req.user);
  res.status(result.status).json(result.data);
});

module.exports = router;
