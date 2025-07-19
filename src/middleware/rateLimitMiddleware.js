// src/middleware/rateLimitMiddleware.js
// Middleware de rate limiting para proteger endpoints

const rateLimit = require("express-rate-limit");
const logger = require("../utils/logger");

/**
 * Rate limiting general para API
 */
const generalRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // máximo 100 requests por ventana
  message: {
    success: false,
    error: "Demasiadas solicitudes. Inténtalo más tarde.",
    retryAfter: Math.ceil(
      (parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000
    ),
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Rate limit excedido", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      endpoint: req.originalUrl,
      method: req.method,
    });

    res.status(429).json({
      success: false,
      error: "Demasiadas solicitudes. Inténtalo más tarde.",
      retryAfter: Math.ceil(
        (parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000
      ),
    });
  },
});

/**
 * Rate limiting estricto para autenticación
 */
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5, // máximo 5 intentos de login
  message: {
    success: false,
    error: "Demasiados intentos de autenticación. Inténtalo más tarde.",
    retryAfter: 900, // 15 minutos
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // No contar requests exitosos
  handler: (req, res) => {
    logger.warn("Rate limit de autenticación excedido", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      endpoint: req.originalUrl,
    });

    res.status(429).json({
      success: false,
      error: "Demasiados intentos de autenticación. Inténtalo más tarde.",
      retryAfter: 900,
    });
  },
});

/**
 * Rate limiting para registro de usuarios
 */
const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: parseInt(process.env.REGISTER_RATE_LIMIT_MAX) || 3, // máximo 3 registros por hora
  message: {
    success: false,
    error: "Demasiados intentos de registro. Inténtalo más tarde.",
    retryAfter: 3600, // 1 hora
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Rate limit de registro excedido", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      email: req.body?.email,
    });

    res.status(429).json({
      success: false,
      error: "Demasiados intentos de registro. Inténtalo más tarde.",
      retryAfter: 3600,
    });
  },
});

/**
 * Rate limiting flexible para webhooks
 */
const webhookRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 60, // máximo 60 webhooks por minuto
  message: {
    success: false,
    error: "Webhook rate limit exceeded",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Webhook rate limit excedido", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      endpoint: req.originalUrl,
      webhookType: req.headers["x-webhook-type"] || "unknown",
    });

    res.status(429).json({
      success: false,
      error: "Webhook rate limit exceeded",
      retryAfter: 60,
    });
  },
});

/**
 * Rate limiting muy permisivo para desarrollo
 */
const developmentRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 1000, // máximo 1000 requests por minuto (muy permisivo)
  message: {
    success: false,
    error: "Rate limit excedido en desarrollo",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Middleware principal que selecciona el rate limit apropiado
 */
const rateLimitMiddleware = (req, res, next) => {
  // En desarrollo, usar rate limiting muy permisivo
  if (process.env.NODE_ENV === "development") {
    return developmentRateLimit(req, res, next);
  }

  // En producción, usar rate limiting normal
  return generalRateLimit(req, res, next);
};

/**
 * Crear rate limiter personalizado
 */
const createCustomRateLimit = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100,
    message: {
      success: false,
      error: "Rate limit excedido",
      retryAfter: Math.ceil((options.windowMs || 15 * 60 * 1000) / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
  };

  return rateLimit({ ...defaultOptions, ...options });
};

module.exports = {
  rateLimitMiddleware,
  generalRateLimit,
  authRateLimit,
  registerRateLimit,
  webhookRateLimit,
  developmentRateLimit,
  createCustomRateLimit,
};
