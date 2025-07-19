// src/routes/pipedreamTestRoutes.js
// Rutas para probar la integración con Pipedream

const express = require("express");
const router = express.Router();
const PipedreamTestController = require("../controllers/pipedreamTestController");
const { authenticateToken } = require("../middleware/authMiddleware");

/**
 * GET /api/pipedream/test/connectivity
 * Probar conectividad con workflows de Pipedream
 */
router.get(
  "/connectivity",
  authenticateToken,
  PipedreamTestController.testConnectivity
);

/**
 * POST /api/pipedream/test/calendly-webhook
 * Simular webhook de Calendly para probar integración
 */
router.post(
  "/calendly-webhook",
  authenticateToken,
  PipedreamTestController.simulateCalendlyWebhook
);

/**
 * POST /api/pipedream/test/whatsapp-message
 * Simular mensaje de WhatsApp para probar integración
 */
router.post(
  "/whatsapp-message",
  authenticateToken,
  PipedreamTestController.simulateWhatsAppMessage
);

/**
 * GET /api/pipedream/test/configuration
 * Obtener configuración actual de Pipedream
 */
router.get(
  "/configuration",
  authenticateToken,
  PipedreamTestController.getConfiguration
);

/**
 * POST /api/pipedream/test/configure-whatsapp-url
 * Configurar URL del WhatsApp Inbound Handler
 */
router.post(
  "/configure-whatsapp-url",
  authenticateToken,
  PipedreamTestController.setWhatsAppHandlerUrl
);

module.exports = router;
