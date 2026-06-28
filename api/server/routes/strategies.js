const express = require('express');
const { requireJwtAuth } = require('../middleware/');
const { strategiesRequest, listStrategies } = require('~/server/services/traderdevStrategies');

const router = express.Router();
router.use(requireJwtAuth);

const relay = (res, result) => res.status(result.status).json(result.data);

// List the user's backtested strategies (deduped, newest first, capped).
router.get('/', async (req, res) => {
  relay(res, await listStrategies(req.user));
});

// Delete a strategy (upstream DELETE requires a JSON body).
router.delete('/:id', async (req, res) => {
  relay(
    res,
    await strategiesRequest(
      req.user,
      'DELETE',
      `/strategies/${encodeURIComponent(req.params.id)}`,
      {},
    ),
  );
});

module.exports = router;
