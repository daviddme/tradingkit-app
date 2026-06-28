const express = require('express');
const clerkAuthController = require('~/server/controllers/auth/clerk');
const clerkWebhookController = require('~/server/controllers/webhooks/clerkWebhook');

const router = express.Router();

/**
 * Auth bridge: exchange a verified Clerk session token for a native LibreChat
 * session (sets refreshToken + token_provider cookies). No JWT auth required —
 * the Clerk token IS the credential.
 */
router.post('/session', clerkAuthController);

/**
 * Clerk Billing webhook (Svix-signed). The raw body parser for this path is
 * registered in server/index.js before the global JSON parser.
 */
router.post('/webhook', clerkWebhookController);

module.exports = router;
