/**
 * RUTAS DE WHATSAPP
 * Manejo de webhooks de Twilio para mensajes entrantes de WhatsApp
 *
 * Endpoints:
 * - POST / - Recibe webhooks de Twilio WhatsApp
 * - GET /status - Estado de la integración
 * - POST /send - Envío manual de mensajes (admin)
 */

const express = require("express");
const rateLimit = require("express-rate-limit");
const whatsappController = require("../controllers/whatsappController");
const logger = require("../utils/logger");

const router = express.Router();

// Rate limiting específico para webhooks de WhatsApp
const whatsappWebhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 200, // máximo 200 mensajes por minuto (conversaciones activas)
  message: {
    error: "Demasiados mensajes de WhatsApp recibidos",
    retryAfter: "1 minuto",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Usar número de teléfono del remitente si está disponible
    const from = req.body?.From || req.ip;
    return `whatsapp_${from}`;
  },
  skip: (req) => {
    // No aplicar rate limiting a requests de estado
    return req.method === "GET";
  },
});

// Rate limiting para envío manual de mensajes
const sendMessageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10, // máximo 10 mensajes manuales por minuto
  message: {
    error: "Demasiados mensajes enviados manualmente",
    retryAfter: "1 minuto",
  },
});

// Middleware de logging específico para WhatsApp
const whatsappLogger = (req, res, next) => {
  const startTime = Date.now();

  // Extraer información del mensaje sin exponer datos sensibles
  const from = req.body?.From;
  const messageType = req.body?.MessageType || "text";
  const hasMedia = !!(req.body?.MediaUrl0 || req.body?.MediaContentType0);

  logger.whatsapp("message_received", from, "incoming", {
    method: req.method,
    url: req.url,
    ip: req.ip,
    messageType,
    hasMedia,
    userAgent: req.get("User-Agent"),
    contentType: req.get("Content-Type"),
  });

  // Log de respuesta
  res.on("finish", () => {
    const responseTime = Date.now() - startTime;
    logger.whatsapp("message_processed", from, "response", {
      statusCode: res.statusCode,
      responseTime,
      ip: req.ip,
    });
  });

  next();
};

// Middleware de validación de webhook de Twilio
const validateTwilioWebhook = (req, res, next) => {
  // Validar que sea POST
  if (req.method !== "POST") {
    logger.warn("WhatsApp webhook: método no permitido", {
      method: req.method,
      ip: req.ip,
    });
    return res.status(405).json({
      success: false,
      error: "Método no permitido. Solo se acepta POST.",
    });
  }

  // Validar que viene de Twilio (campos requeridos)
  const requiredFields = ["From", "Body"];
  const missingFields = requiredFields.filter((field) => !req.body[field]);

  if (missingFields.length > 0) {
    logger.warn("WhatsApp webhook: campos requeridos faltantes", {
      missingFields,
      ip: req.ip,
      body: req.body,
    });
    return res.status(400).json({
      success: false,
      error: `Campos requeridos faltantes: ${missingFields.join(", ")}`,
    });
  }

  // Validar formato del número From (debe ser WhatsApp)
  if (!req.body.From.startsWith("whatsapp:")) {
    logger.warn("WhatsApp webhook: formato de número inválido", {
      from: req.body.From,
      ip: req.ip,
    });
    return res.status(400).json({
      success: false,
      error: "El número debe tener formato WhatsApp",
    });
  }

  next();
};

// ===== RUTAS =====

/**
 * POST /
 * Endpoint principal para recibir webhooks de Twilio WhatsApp
 */
router.post(
  "/",
  whatsappWebhookLimiter,
  whatsappLogger,
  validateTwilioWebhook,
  whatsappController.handleIncomingMessage
);

/**
 * GET /status
 * Obtener estado de la integración con WhatsApp
 */
router.get("/status", (req, res) => {
  try {
    const config = require("../config/environment");

    const status = {
      service: "WhatsApp Integration",
      status: "operational",
      timestamp: new Date().toISOString(),
      configuration: {
        hasTwilioSid: !!config.TWILIO_ACCOUNT_SID,
        hasTwilioToken: !!config.TWILIO_AUTH_TOKEN,
        hasWhatsAppNumber: !!config.TWILIO_WHATSAPP_NUMBER,
        whatsappNumber: config.TWILIO_WHATSAPP_NUMBER,
        signatureValidation: config.VALIDATE_TWILIO_SIGNATURE,
      },
      endpoints: {
        webhook: "/webhook/whatsapp",
        status: "/webhook/whatsapp/status",
        send: "/webhook/whatsapp/send",
      },
    };

    logger.info("WhatsApp status check", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(200).json(status);
  } catch (error) {
    logger.error("Error obteniendo estado de WhatsApp", {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /send
 * Envío manual de mensajes (para administradores)
 */
router.post("/send", sendMessageLimiter, whatsappController.sendMessage);

/**
 * GET /health
 * Health check específico para WhatsApp
 */
router.get("/health", (req, res) => {
  res.status(200).json({
    service: "WhatsApp Webhooks",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /conversations
 * Obtener lista de conversaciones activas (admin)
 */
router.get("/conversations", whatsappController.getActiveConversations);

/**
 * GET /conversation/:phoneNumber
 * Obtener historial de conversación específica (admin)
 */
router.get(
  "/conversation/:phoneNumber",
  whatsappController.getConversationHistory
);

/**
 * POST /test
 * Endpoint de prueba para desarrollo (solo en desarrollo)
 */
if (process.env.NODE_ENV === "development") {
  router.post("/test", (req, res) => {
    logger.info("WhatsApp test webhook received", {
      body: req.body,
      headers: req.headers,
      ip: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Test webhook recibido correctamente",
      receivedData: req.body,
      timestamp: new Date().toISOString(),
    });
  });

  // Endpoint para simular mensaje entrante
  router.post("/simulate", (req, res) => {
    const { from, body, messageType = "text" } = req.body;

    if (!from || !body) {
      return res.status(400).json({
        success: false,
        error: "from y body son requeridos",
      });
    }

    // Simular estructura de webhook de Twilio
    const simulatedWebhook = {
      From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
      Body: body,
      MessageType: messageType,
      To: process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886",
    };

    // Procesar como webhook real
    req.body = simulatedWebhook;
    whatsappController.handleIncomingMessage(req, res);
  });
}

// Middleware de manejo de errores específico para WhatsApp
router.use((error, req, res, next) => {
  logger.error("Error en rutas de WhatsApp", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    from: req.body?.From,
    body: req.body?.Body?.substring(0, 100),
  });

  // Responder rápidamente a Twilio para evitar reintentos
  res.status(500).json({
    success: false,
    error: "Error procesando mensaje de WhatsApp",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
