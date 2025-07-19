// src/routes/whatsappRoutes.js
// Rutas para integración de WhatsApp con Twilio

const express = require("express");
const router = express.Router();
const WhatsAppController = require("../controllers/whatsappController");
const { authenticate } = require("../middleware/authMiddleware");
const {
  rateLimitMiddleware,
  createCustomRateLimit,
} = require("../middleware/rateLimitMiddleware");

/**
 * POST /webhook/whatsapp
 * Webhook principal para mensajes de WhatsApp (Twilio)
 */
router.post("/webhook", WhatsAppController.handleWebhook);

/**
 * POST /webhook/whatsapp/status
 * Webhook para estados de mensaje de WhatsApp
 */
router.post("/webhook/status", WhatsAppController.handleMessageStatus);

/**
 * GET /api/whatsapp/health
 * Estado de salud de la integración de WhatsApp
 */
router.get("/health", WhatsAppController.getHealthStatus);

/**
 * GET /api/whatsapp/config
 * Verificar configuración de WhatsApp
 */
router.get("/config", authenticate, (req, res) => {
  WhatsAppController.verifyConfiguration(req, res);
});

/**
 * POST /api/whatsapp/send
 * Enviar mensaje de WhatsApp manualmente (para testing)
 */
router.post(
  "/send",
  authenticate,
  createCustomRateLimit({ windowMs: 60000, max: 10 }), // 10 mensajes por minuto
  WhatsAppController.sendMessage
);

/**
 * GET /api/whatsapp/stats
 * Estadísticas de conversaciones de WhatsApp
 */
router.get("/stats", authenticate, WhatsAppController.getConversationStats);

/**
 * POST /api/whatsapp/configure-webhook
 * Configurar webhook de Twilio
 */
router.post(
  "/configure-webhook",
  authenticate,
  WhatsAppController.configureWebhook
);

module.exports = router;
