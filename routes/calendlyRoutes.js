/**
 * RUTAS DE CALENDLY
 * Manejo de webhooks de Calendly para eventos de reservas
 *
 * Endpoints:
 * - POST /webhook - Recibe webhooks de Calendly
 * - GET /status - Estado de la integración
 */

const express = require("express");
const rateLimit = require("express-rate-limit");
const calendlyController = require("../controllers/calendlyController");
const logger = require("../utils/logger");

const router = express.Router();

// Rate limiting específico para webhooks de Calendly
const calendlyWebhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 50, // máximo 50 webhooks por minuto
  message: {
    error: "Demasiados webhooks de Calendly recibidos",
    retryAfter: "1 minuto",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Usar IP y user agent para generar clave única
    return `calendly_${req.ip}_${req.get("User-Agent")}`;
  },
  skip: (req) => {
    // No aplicar rate limiting a requests de estado
    return req.method === "GET";
  },
});

// Middleware de logging específico para Calendly
const calendlyLogger = (req, res, next) => {
  const startTime = Date.now();

  logger.calendly("webhook_received", null, "incoming", {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    contentType: req.get("Content-Type"),
    contentLength: req.get("Content-Length"),
    hookSignature: req.get("X-Hook-Signature") ? "present" : "missing",
  });

  // Log de respuesta
  res.on("finish", () => {
    const responseTime = Date.now() - startTime;
    logger.calendly("webhook_processed", null, "response", {
      statusCode: res.statusCode,
      responseTime,
      ip: req.ip,
    });
  });

  next();
};

// Middleware de validación de contenido
const validateCalendlyWebhook = (req, res, next) => {
  // Validar que sea POST
  if (req.method !== "POST") {
    logger.warn("Calendly webhook: método no permitido", {
      method: req.method,
      ip: req.ip,
    });
    return res.status(405).json({
      success: false,
      error: "Método no permitido. Solo se acepta POST.",
    });
  }

  // Validar Content-Type
  const contentType = req.get("Content-Type");
  if (!contentType || !contentType.includes("application/json")) {
    logger.warn("Calendly webhook: Content-Type inválido", {
      contentType,
      ip: req.ip,
    });
    return res.status(400).json({
      success: false,
      error: "Content-Type debe ser application/json",
    });
  }

  // Validar que hay body
  if (!req.body || Object.keys(req.body).length === 0) {
    logger.warn("Calendly webhook: body vacío", { ip: req.ip });
    return res.status(400).json({
      success: false,
      error: "Body del webhook no puede estar vacío",
    });
  }

  next();
};

// ===== RUTAS =====

/**
 * POST /webhook
 * Endpoint principal para recibir webhooks de Calendly
 */
router.post(
  "/webhook",
  calendlyWebhookLimiter,
  calendlyLogger,
  validateCalendlyWebhook,
  calendlyController.handleWebhook
);

/**
 * GET /status
 * Obtener estado de la integración con Calendly
 */
router.get("/status", (req, res) => {
  try {
    const config = require("../config/environment");

    const status = {
      service: "Calendly Integration",
      status: "operational",
      timestamp: new Date().toISOString(),
      configuration: {
        hasAccessToken: !!config.CALENDLY_ACCESS_TOKEN,
        hasUserUri: !!config.CALENDLY_USER_URI,
        hasWebhookUri: !!config.CALENDLY_WEBHOOK_URI,
        hasSigningKey: !!config.CALENDLY_SIGNING_KEY,
        signatureValidation: config.VALIDATE_CALENDLY_SIGNATURE,
      },
      endpoints: {
        webhook: "/api/calendly/webhook",
        status: "/api/calendly/status",
      },
    };

    logger.info("Calendly status check", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(200).json(status);
  } catch (error) {
    logger.error("Error obteniendo estado de Calendly", {
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
 * GET /health
 * Health check específico para Calendly
 */
router.get("/health", (req, res) => {
  res.status(200).json({
    service: "Calendly Webhooks",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /test
 * Endpoint de prueba para desarrollo (solo en desarrollo)
 */
if (process.env.NODE_ENV === "development") {
  router.post("/test", (req, res) => {
    logger.info("Calendly test webhook received", {
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
}

// Middleware de manejo de errores específico para Calendly
router.use((error, req, res, next) => {
  logger.error("Error en rutas de Calendly", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    body: req.body,
  });

  // Responder rápidamente a Calendly para evitar reintentos
  res.status(500).json({
    success: false,
    error: "Error procesando webhook de Calendly",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
