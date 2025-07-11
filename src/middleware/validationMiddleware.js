// src/middleware/validationMiddleware.js
// Middleware de validación avanzada con sanitización y protección

const Joi = require("joi");
const DOMPurify = require("isomorphic-dompurify");
const validator = require("validator");
const logger = require("../utils/logger");

class ValidationMiddleware {
  /**
   * Esquemas de validación Joi
   */
  static schemas = {
    // Cliente
    client: Joi.object({
      first_name: Joi.string()
        .min(2)
        .max(50)
        .required()
        .pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/),
      last_name: Joi.string()
        .min(2)
        .max(50)
        .required()
        .pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/),
      email: Joi.string().email().max(255).optional(),
      phone: Joi.string()
        .pattern(/^\+?[1-9]\d{8,14}$/)
        .required(),
      whatsapp_phone: Joi.string()
        .pattern(/^\+?[1-9]\d{8,14}$/)
        .optional(),
      address: Joi.string().max(500).optional(),
      birth_date: Joi.date().max("now").optional(),
      gender: Joi.string()
        .valid("male", "female", "other", "prefer_not_to_say")
        .optional(),
      emergency_contact_name: Joi.string().max(100).optional(),
      emergency_contact_phone: Joi.string()
        .pattern(/^\+?[1-9]\d{8,14}$/)
        .optional(),
      medical_notes: Joi.string().max(2000).optional(),
      preferences: Joi.object().optional(),
      lgpd_accepted: Joi.boolean().required(),
      marketing_consent: Joi.boolean().optional(),
      status: Joi.string()
        .valid(
          "active",
          "inactive",
          "suspended",
          "pending_verification",
          "blocked",
        )
        .optional(),
    }),

    // Servicio
    service: Joi.object({
      name: Joi.string().min(2).max(255).required(),
      slug: Joi.string()
        .pattern(/^[a-z0-9-]+$/)
        .max(255)
        .optional(),
      description: Joi.string().max(5000).optional(),
      short_description: Joi.string().max(500).optional(),
      category: Joi.string()
        .valid("consultation", "therapy", "assessment", "workshop", "other")
        .required(),
      duration_minutes: Joi.number().integer().min(1).max(480).required(),
      price: Joi.number().precision(2).min(0).max(9999.99).required(),
      currency: Joi.string().length(3).uppercase().optional(),
      active: Joi.boolean().optional(),
      online_booking_enabled: Joi.boolean().optional(),
      requires_approval: Joi.boolean().optional(),
      max_advance_booking_days: Joi.number()
        .integer()
        .min(1)
        .max(365)
        .optional(),
      min_advance_booking_hours: Joi.number()
        .integer()
        .min(0)
        .max(168)
        .optional(),
      max_cancellation_hours: Joi.number().integer().min(0).max(168).optional(),
      assigned_staff: Joi.array().items(Joi.string().uuid()).optional(),
      metadata: Joi.object().optional(),
    }),

    // Reserva
    booking: Joi.object({
      client_id: Joi.string().uuid().optional(),
      client_phone: Joi.string()
        .pattern(/^\+?[1-9]\d{8,14}$/)
        .optional(),
      client_email: Joi.string().email().optional(),
      client_name: Joi.string().min(2).max(50).optional(),
      client_last_name: Joi.string().min(2).max(50).optional(),
      service_id: Joi.string().uuid().required(),
      staff_id: Joi.string().uuid().optional(),
      start_time: Joi.date().greater("now").required(),
      end_time: Joi.date().greater(Joi.ref("start_time")).optional(),
      timezone: Joi.string().max(50).optional(),
      status: Joi.string()
        .valid("pending", "confirmed", "cancelled", "completed", "no_show")
        .optional(),
      notes: Joi.string().max(2000).optional(),
      client_notes: Joi.string().max(1000).optional(),
      staff_notes: Joi.string().max(2000).optional(),
      original_price: Joi.number().precision(2).min(0).optional(),
      final_price: Joi.number().precision(2).min(0).optional(),
      currency: Joi.string().length(3).uppercase().optional(),
      external_id: Joi.string().max(255).optional(),
      external_platform: Joi.string().max(100).optional(),
      metadata: Joi.object().optional(),
    }).or("client_id", "client_phone"),

    // Parámetros de consulta
    queryParams: Joi.object({
      page: Joi.number().integer().min(1).max(1000).optional(),
      limit: Joi.number().integer().min(1).max(100).optional(),
      search: Joi.string().max(255).optional(),
      sortBy: Joi.string().max(50).optional(),
      sortOrder: Joi.string().valid("asc", "desc").optional(),
      status: Joi.string().max(50).optional(),
      category: Joi.string().max(50).optional(),
      active: Joi.boolean().optional(),
      includeExpired: Joi.boolean().optional(),
    }),

    // IDs
    uuid: Joi.string().uuid().required(),
    phone: Joi.string()
      .pattern(/^\+?[1-9]\d{8,14}$/)
      .required(),
    email: Joi.string().email().required(),
    slug: Joi.string()
      .pattern(/^[a-z0-9-]+$/)
      .required(),
  };

  /**
   * Validar datos con esquema específico
   */
  static validate(schema) {
    return (req, res, next) => {
      try {
        const schemaToUse = this.schemas[schema];
        if (!schemaToUse) {
          throw new Error(`Schema '${schema}' not found`);
        }

        // Validar body, query y params según corresponda
        const dataToValidate = req.method === "GET" ? req.query : req.body;

        const { error, value } = schemaToUse.validate(dataToValidate, {
          abortEarly: false,
          stripUnknown: true,
          convert: true,
        });

        if (error) {
          const errors = error.details.map((detail) => ({
            field: detail.path.join("."),
            message: detail.message,
            value: detail.context?.value,
          }));

          logger.warn("Validation failed", {
            schema,
            errors,
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
          });

          return res.status(400).json({
            success: false,
            error: "Validation failed",
            details: errors,
          });
        }

        // Reemplazar datos originales con datos validados
        if (req.method === "GET") {
          req.query = value;
        } else {
          req.body = value;
        }

        next();
      } catch (error) {
        logger.error("Validation middleware error", {
          error: error.message,
          schema,
          method: req.method,
          url: req.originalUrl,
        });

        res.status(500).json({
          success: false,
          error: "Validation error",
        });
      }
    };
  }

  /**
   * Validar parámetros de URL
   */
  static validateParams(paramSchema) {
    return (req, res, next) => {
      try {
        const schemaToUse = this.schemas[paramSchema];
        if (!schemaToUse) {
          throw new Error(`Parameter schema '${paramSchema}' not found`);
        }

        const { error, value } = schemaToUse.validate(req.params, {
          abortEarly: false,
          stripUnknown: true,
        });

        if (error) {
          const errors = error.details.map((detail) => ({
            field: detail.path.join("."),
            message: detail.message,
          }));

          return res.status(400).json({
            success: false,
            error: "Invalid parameters",
            details: errors,
          });
        }

        req.params = value;
        next();
      } catch (error) {
        logger.error("Parameter validation error", {
          error: error.message,
          paramSchema,
          params: req.params,
        });

        res.status(500).json({
          success: false,
          error: "Parameter validation error",
        });
      }
    };
  }

  /**
   * Sanitización avanzada de HTML/XSS
   */
  static sanitizeHtml(req, res, next) {
    try {
      const sanitizeValue = (value) => {
        if (typeof value === "string") {
          // Sanitizar HTML y XSS
          return DOMPurify.sanitize(value, {
            ALLOWED_TAGS: [],
            ALLOWED_ATTR: [],
          });
        }

        if (Array.isArray(value)) {
          return value.map(sanitizeValue);
        }

        if (value && typeof value === "object") {
          const sanitized = {};
          for (const [key, val] of Object.entries(value)) {
            sanitized[key] = sanitizeValue(val);
          }
          return sanitized;
        }

        return value;
      };

      if (req.body) req.body = sanitizeValue(req.body);
      if (req.query) req.query = sanitizeValue(req.query);
      if (req.params) req.params = sanitizeValue(req.params);

      next();
    } catch (error) {
      logger.error("HTML sanitization error", {
        error: error.message,
        method: req.method,
        url: req.originalUrl,
      });

      res.status(500).json({
        success: false,
        error: "Sanitization error",
      });
    }
  }

  /**
   * Validación de archivos subidos
   */
  static validateFileUpload(options = {}) {
    const {
      maxSize = 5 * 1024 * 1024, // 5MB por defecto
      allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "application/pdf",
      ],
      maxFiles = 1,
    } = options;

    return (req, res, next) => {
      try {
        if (!req.files || Object.keys(req.files).length === 0) {
          return next(); // No hay archivos, continuar
        }

        const files = Array.isArray(req.files)
          ? req.files
          : Object.values(req.files);

        if (files.length > maxFiles) {
          return res.status(400).json({
            success: false,
            error: `Maximum ${maxFiles} file(s) allowed`,
          });
        }

        for (const file of files) {
          // Validar tamaño
          if (file.size > maxSize) {
            return res.status(400).json({
              success: false,
              error: `File size exceeds ${maxSize / 1024 / 1024}MB limit`,
            });
          }

          // Validar tipo MIME
          if (!allowedTypes.includes(file.mimetype)) {
            return res.status(400).json({
              success: false,
              error: `File type ${file.mimetype} not allowed`,
            });
          }

          // Validar nombre de archivo
          if (!/^[a-zA-Z0-9._-]+$/.test(file.name)) {
            return res.status(400).json({
              success: false,
              error: "Invalid file name",
            });
          }
        }

        next();
      } catch (error) {
        logger.error("File validation error", {
          error: error.message,
          method: req.method,
          url: req.originalUrl,
        });

        res.status(500).json({
          success: false,
          error: "File validation error",
        });
      }
    };
  }

  /**
   * Validación de IP permitidas
   */
  static validateAllowedIPs(allowedIPs = []) {
    return (req, res, next) => {
      try {
        if (allowedIPs.length === 0) {
          return next(); // Sin restricciones
        }

        const clientIP = req.ip || req.connection.remoteAddress;

        if (!allowedIPs.includes(clientIP)) {
          logger.warn("IP not allowed", {
            ip: clientIP,
            allowedIPs,
            method: req.method,
            url: req.originalUrl,
          });

          return res.status(403).json({
            success: false,
            error: "Access denied from this IP",
          });
        }

        next();
      } catch (error) {
        logger.error("IP validation error", {
          error: error.message,
          ip: req.ip,
        });

        res.status(500).json({
          success: false,
          error: "IP validation error",
        });
      }
    };
  }

  /**
   * Validación de User-Agent
   */
  static validateUserAgent(req, res, next) {
    try {
      const userAgent = req.headers["user-agent"];

      if (!userAgent) {
        logger.warn("Missing User-Agent", {
          ip: req.ip,
          method: req.method,
          url: req.originalUrl,
        });

        return res.status(400).json({
          success: false,
          error: "User-Agent header required",
        });
      }

      // Detectar bots maliciosos conocidos
      const maliciousBots = [
        /sqlmap/i,
        /nikto/i,
        /nessus/i,
        /openvas/i,
        /nmap/i,
        /masscan/i,
        /zap/i,
      ];

      if (maliciousBots.some((bot) => bot.test(userAgent))) {
        logger.warn("Malicious bot detected", {
          userAgent,
          ip: req.ip,
          method: req.method,
          url: req.originalUrl,
        });

        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      next();
    } catch (error) {
      logger.error("User-Agent validation error", {
        error: error.message,
        userAgent: req.headers["user-agent"],
      });

      res.status(500).json({
        success: false,
        error: "User-Agent validation error",
      });
    }
  }

  /**
   * Validación de contenido JSON estricta
   */
  static validateStrictJSON(req, res, next) {
    try {
      if (["POST", "PUT", "PATCH"].includes(req.method)) {
        const contentType = req.headers["content-type"];

        if (!contentType || !contentType.includes("application/json")) {
          return res.status(400).json({
            success: false,
            error: "Content-Type must be application/json",
          });
        }

        if (!req.body || typeof req.body !== "object") {
          return res.status(400).json({
            success: false,
            error: "Request body must be valid JSON object",
          });
        }

        // Validar profundidad del JSON (prevenir ataques de DoS)
        const maxDepth = 10;
        const checkDepth = (obj, depth = 0) => {
          if (depth > maxDepth) {
            throw new Error("JSON too deep");
          }

          if (obj && typeof obj === "object") {
            for (const value of Object.values(obj)) {
              if (typeof value === "object" && value !== null) {
                checkDepth(value, depth + 1);
              }
            }
          }
        };

        checkDepth(req.body);
      }

      next();
    } catch (error) {
      logger.warn("Strict JSON validation failed", {
        error: error.message,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
      });

      res.status(400).json({
        success: false,
        error: "Invalid JSON structure",
      });
    }
  }
}

module.exports = ValidationMiddleware;
