// src/routes/autonomousWhatsAppRoutes.js
// Rutas para el asistente autónomo de WhatsApp

const express = require("express");
const router = express.Router();
const autonomousWhatsAppController = require("../controllers/autonomousWhatsAppController");

// Rutas públicas para webhooks de Twilio

/**
 * POST /autonomous/whatsapp/webhook
 * Webhook principal para recibir mensajes de WhatsApp
 */
router.post("/webhook", autonomousWhatsAppController.receiveMessage);

/**
 * POST /autonomous/whatsapp/status
 * Webhook para estados de mensajes (entregado, leído, etc.)
 */
router.post("/status", autonomousWhatsAppController.messageStatus);

/**
 * GET /autonomous/whatsapp/webhook
 * Verificación de webhook para Twilio
 */
router.get("/webhook", autonomousWhatsAppController.verifyWebhook);

/**
 * GET /autonomous/whatsapp/health
 * Health check específico del asistente autónomo
 */
router.get("/health", autonomousWhatsAppController.healthCheck);

// Rutas administrativas (podrían requerir autenticación en el futuro)

/**
 * POST /autonomous/whatsapp/send
 * Enviar mensaje manual desde admin
 */
router.post("/send", autonomousWhatsAppController.sendManualMessage);

/**
 * GET /autonomous/whatsapp/stats
 * Obtener estadísticas del asistente
 */
router.get("/stats", autonomousWhatsAppController.getAssistantStats);

/**
 * GET /autonomous/whatsapp/conversations
 * Obtener conversaciones activas
 */
router.get(
  "/conversations",
  autonomousWhatsAppController.getActiveConversations
);

/**
 * POST /autonomous/whatsapp/cleanup
 * Limpiar conversaciones antiguas
 */
router.post("/cleanup", autonomousWhatsAppController.cleanupConversations);

/**
 * POST /autonomous/whatsapp/reinitialize
 * Reinicializar cache de servicios
 */
router.post("/reinitialize", autonomousWhatsAppController.reinitializeServices);

module.exports = router;
