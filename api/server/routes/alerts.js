const express = require('express');
const { requireJwtAuth } = require('../middleware/');
const { alertsRequest } = require('~/server/services/traderdevAlerts');

const router = express.Router();
router.use(requireJwtAuth);

function relay(res, result) {
  return res.status(result.status).json(result.data);
}

const sid = (req) => encodeURIComponent(req.params.id);

// Quota: { used, limit, tier, unlimited, remaining }
router.get('/quota', async (req, res) => {
  relay(res, await alertsRequest(req.user,'GET', '/alerts/quota'));
});

// List / create
router.get('/', async (req, res) => {
  relay(res, await alertsRequest(req.user,'GET', '/alerts/subscriptions'));
});
router.post('/', async (req, res) => {
  relay(res, await alertsRequest(req.user,'POST', '/alerts/subscriptions', req.body));
});

// Single alert read / update
router.get('/:id', async (req, res) => {
  relay(res, await alertsRequest(req.user,'GET', `/alerts/subscriptions/${sid(req)}`));
});
router.patch('/:id', async (req, res) => {
  relay(res, await alertsRequest(req.user,'PATCH', `/alerts/subscriptions/${sid(req)}`, req.body));
});

// Lifecycle actions
router.post('/:id/pause', async (req, res) => {
  relay(res, await alertsRequest(req.user,'POST', `/alerts/subscriptions/${sid(req)}/pause`));
});
router.post('/:id/resume', async (req, res) => {
  relay(res, await alertsRequest(req.user,'POST', `/alerts/subscriptions/${sid(req)}/resume`));
});
router.post('/:id/test', async (req, res) => {
  relay(res, await alertsRequest(req.user,'POST', `/alerts/subscriptions/${sid(req)}/test`));
});
router.delete('/:id', async (req, res) => {
  relay(res, await alertsRequest(req.user,'DELETE', `/alerts/subscriptions/${sid(req)}`));
});

module.exports = router;
