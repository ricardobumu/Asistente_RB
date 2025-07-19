// src/routes/calendlyWebhookRoutes.js
const express = require("express");
const router = express.Router();
const calendlyWebhookController = require("../controllers/calendlyWebhookController");

/**
 * POST /api/calendly/webhook
 * Webhook principal para eventos de Calendly
 */
router.post("/webhook", calendlyWebhookController.handleWebhook);

/**
 * GET /api/calendly/webhook
 * Verificación de webhook para Calendly
 */
router.get("/webhook", calendlyWebhookController.verifyWebhook);

/**
 * GET /api/calendly/health
 * Estado de salud del webhook de Calendly
 */
router.get("/health", calendlyWebhookController.getHealthStatus);

/**
 * POST /api/calendly/sync
 * Sincronizar eventos de Calendly manualmente
 */
router.post("/sync", calendlyWebhookController.syncEvents);

/**
 * GET /api/calendly/events
 * Obtener eventos de Calendly
 */
router.get("/events", calendlyWebhookController.getEvents);

/**
 * GET /api/calendly/event-types
 * Obtener tipos de eventos disponibles
 */
router.get("/event-types", calendlyWebhookController.getEventTypes);

module.exports = router;
