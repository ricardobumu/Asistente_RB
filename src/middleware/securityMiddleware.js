// src/middleware/securityMiddleware.js
// Middleware de seguridad avanzado para el asistente autónomo

const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const cors = require("cors");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");

class SecurityMiddleware {
  /**
   * Configuración de CORS segura
   */
  static corsConfig() {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : ["http://localhost:3000"];

    return cors({
      origin: (origin, callback) => {
        // Permitir requests sin origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn("CORS blocked request", { origin });
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Origin",
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "Authorization",
        "X-API-Key",
        "X-Twilio-Signature",
      ],
      exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining"],
      maxAge: 86400, // 24 horas
    });
  }

  /**
   * Configuración de Helmet para headers de seguridad
   */
  static helmetConfig() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
            "https://cdn.tailwindcss.com",
          ],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://cdn.tailwindcss.com",
          ],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: [
            "'self'",
            "https://api.openai.com",
            "https://api.calendly.com",
          ],
          frameSrc: [
            "'self'",
            "https://ricardoburitica.eu",
            "https://www.ricardoburitica.eu",
          ],
        },
      },
      crossOriginEmbedderPolicy: false, // Para permitir embeds
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    });
  }

  /**
   * Rate limiting por endpoint
   */
  static rateLimiters() {
    return {
      // WhatsApp webhook - más permisivo para Twilio
      whatsapp: rateLimit({
        windowMs: 1 * 60 * 1000, // 1 minuto
        max: 1000, // 1000 requests por minuto
        message: {
          error: "Too many WhatsApp requests",
          retryAfter: "1 minute",
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
          // Rate limit por número de teléfono si está disponible
          const from = req.body?.From;
          return from ? `whatsapp:${from}` : req.ip;
        },
        skip: (req) => {
          // Skip rate limiting para verificación de webhook
          return req.method === "GET";
        },
      }),

      // Widget booking - moderado
      widgetBooking: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: 20, // 20 reservas por 15 minutos por IP
        message: {
          error: "Too many booking attempts",
          retryAfter: "15 minutes",
        },
        standardHeaders: true,
        legacyHeaders: false,
      }),

      // Widget general - permisivo
      widgetGeneral: rateLimit({
        windowMs: 1 * 60 * 1000, // 1 minuto
        max: 100, // 100 requests por minuto
        message: {
          error: "Too many requests",
          retryAfter: "1 minute",
        },
        standardHeaders: true,
        legacyHeaders: false,
      }),

      // Admin endpoints - restrictivo
      admin: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: 50, // 50 requests por 15 minutos
        message: {
          error: "Too many admin requests",
          retryAfter: "15 minutes",
        },
        standardHeaders: true,
        legacyHeaders: false,
      }),

      // General API - balanceado
      general: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: 200, // 200 requests por 15 minutos
        message: {
          error: "Too many requests",
          retryAfter: "15 minutes",
        },
        standardHeaders: true,
        legacyHeaders: false,
      }),
    };
  }

  /**
   * Validación de firma de Twilio
   */
  static validateTwilioSignature(req, res, next) {
    try {
      const twilioSignature = req.headers["x-twilio-signature"];

      if (!twilioSignature) {
        logger.warn("Missing Twilio signature", {
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        });
        return res.status(401).json({ error: "Unauthorized" });
      }

      const authToken = process.env.TWILIO_AUTH_TOKEN;
      if (!authToken) {
        logger.error("Missing Twilio auth token in environment");
        return res.status(500).json({ error: "Server configuration error" });
      }

      // Construir URL completa
      const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

      // Crear firma esperada
      const expectedSignature = crypto
        .createHmac("sha1", authToken)
        .update(url + JSON.stringify(req.body))
        .digest("base64");

      // Comparar firmas de forma segura
      const isValid = crypto.timingSafeEqual(
        Buffer.from(twilioSignature),
        Buffer.from(expectedSignature)
      );

      if (!isValid) {
        logger.warn("Invalid Twilio signature", {
          ip: req.ip,
          expectedSignature: expectedSignature.substring(0, 10) + "...",
          receivedSignature: twilioSignature.substring(0, 10) + "...",
        });
        return res.status(401).json({ error: "Unauthorized" });
      }

      next();
    } catch (error) {
      logger.error("Error validating Twilio signature", {
        error: error.message,
        ip: req.ip,
      });
      res.status(500).json({ error: "Signature validation failed" });
    }
  }

  /**
   * Autenticación JWT para endpoints administrativos
   */
  static authenticateJWT(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

      if (!token) {
        return res.status(401).json({
          error: "Access token required",
          message: "Please provide a valid JWT token",
        });
      }

      jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
          logger.warn("Invalid JWT token", {
            error: err.message,
            ip: req.ip,
          });
          return res.status(403).json({
            error: "Invalid token",
            message: "Token is expired or invalid",
          });
        }

        req.user = user;
        next();
      });
    } catch (error) {
      logger.error("Error in JWT authentication", {
        error: error.message,
        ip: req.ip,
      });
      res.status(500).json({ error: "Authentication failed" });
    }
  }

  /**
   * Validación de API Key para integraciones externas
   */
  static validateApiKey(req, res, next) {
    try {
      const apiKey = req.headers["x-api-key"];
      const validApiKey = process.env.API_KEY;

      if (!apiKey || !validApiKey) {
        return res.status(401).json({
          error: "API key required",
          message: "Please provide a valid API key",
        });
      }

      // Comparación segura
      const isValid = crypto.timingSafeEqual(
        Buffer.from(apiKey),
        Buffer.from(validApiKey)
      );

      if (!isValid) {
        logger.warn("Invalid API key", {
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        });
        return res.status(401).json({ error: "Invalid API key" });
      }

      next();
    } catch (error) {
      logger.error("Error validating API key", {
        error: error.message,
        ip: req.ip,
      });
      res.status(500).json({ error: "API key validation failed" });
    }
  }

  /**
   * Sanitización de entrada
   */
  static sanitizeInput(req, res, next) {
    try {
      // Función recursiva para limpiar objetos
      const sanitize = (obj) => {
        if (typeof obj === "string") {
          // Remover caracteres peligrosos
          return obj
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            .replace(/javascript:/gi, "")
            .replace(/on\w+\s*=/gi, "")
            .trim();
        }

        if (Array.isArray(obj)) {
          return obj.map(sanitize);
        }

        if (obj && typeof obj === "object") {
          const sanitized = {};
          for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitize(value);
          }
          return sanitized;
        }

        return obj;
      };

      // Sanitizar body, query y params
      if (req.body) req.body = sanitize(req.body);
      if (req.query) req.query = sanitize(req.query);
      if (req.params) req.params = sanitize(req.params);

      next();
    } catch (error) {
      logger.error("Error sanitizing input", {
        error: error.message,
        ip: req.ip,
      });
      res.status(500).json({ error: "Input sanitization failed" });
    }
  }

  /**
   * Logging de seguridad
   */
  static securityLogger(req, res, next) {
    const startTime = Date.now();

    // Log de request
    logger.info("Request received", {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      contentType: req.headers["content-type"],
      contentLength: req.headers["content-length"],
    });

    // Override res.json para log de response
    const originalJson = res.json;
    res.json = function (data) {
      const responseTime = Date.now() - startTime;

      logger.info("Response sent", {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        ip: req.ip,
      });

      return originalJson.call(this, data);
    };

    next();
  }

  /**
   * Manejo de errores de seguridad
   */
  static securityErrorHandler(err, req, res, next) {
    // Log del error
    logger.error("Security error", {
      error: err.message,
      stack: err.stack,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Respuestas genéricas para no exponer información
    if (err.message.includes("CORS")) {
      return res.status(403).json({
        error: "Access denied",
        message: "Origin not allowed",
      });
    }

    if (err.message.includes("rate limit")) {
      return res.status(429).json({
        error: "Too many requests",
        message: "Please try again later",
      });
    }

    if (err.message.includes("JWT") || err.message.includes("token")) {
      return res.status(401).json({
        error: "Authentication failed",
        message: "Invalid or expired token",
      });
    }

    // Error genérico
    res.status(500).json({
      error: "Internal server error",
      message: "An unexpected error occurred",
    });
  }

  /**
   * Validación de contenido JSON
   */
  static validateJsonContent(req, res, next) {
    if (req.method === "POST" || req.method === "PUT") {
      const contentType = req.headers["content-type"];

      if (contentType && contentType.includes("application/json")) {
        if (!req.body || typeof req.body !== "object") {
          return res.status(400).json({
            error: "Invalid JSON",
            message: "Request body must be valid JSON",
          });
        }
      }
    }

    next();
  }

  /**
   * Protección contra ataques de timing
   */
  static timingAttackProtection(req, res, next) {
    // Agregar delay aleatorio pequeño para prevenir timing attacks
    const delay = Math.floor(Math.random() * 10) + 5; // 5-15ms

    setTimeout(() => {
      next();
    }, delay);
  }
}

module.exports = SecurityMiddleware;
