// src/middleware/auditMiddleware.js
const logger = require("../utils/logger");
const DatabaseAdapter = require("../adapters/databaseAdapter");
const crypto = require("crypto");

class AuditMiddleware {
  /**
   * Middleware de auditoría completa
   */
  static auditMiddleware(action, options = {}) {
    const {
      logLevel = "info",
      includeBody = false,
      includeResponse = false,
      persistToDb = false,
      sensitiveFields = ["password", "token", "secret", "key"],
    } = options;

    return async (req, res, next) => {
      const startTime = Date.now();
      const requestId = crypto.randomUUID();

      // Información básica de la request
      const requestInfo = {
        requestId,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get("User-Agent"),
        action: action || `${req.method} ${req.originalUrl}`,
        timestamp: new Date().toISOString(),
        userId: req.user?.id || null,
        sessionId: req.sessionID || null,
      };

      // Agregar información del cuerpo si se solicita
      if (includeBody && req.body) {
        requestInfo.body = this.sanitizeSensitiveData(
          req.body,
          sensitiveFields
        );
      }

      // Agregar headers importantes
      requestInfo.headers = {
        contentType: req.get("Content-Type"),
        contentLength: req.get("Content-Length"),
        authorization: req.get("Authorization") ? "[REDACTED]" : null,
        referer: req.get("Referer"),
        origin: req.get("Origin"),
      };

      // Log inicial
      logger[logLevel](`Request started: ${requestInfo.action}`, {
        requestId,
        method: requestInfo.method,
        url: requestInfo.url,
        ip: requestInfo.ip,
        userAgent: requestInfo.userAgent,
        userId: requestInfo.userId,
      });

      // Interceptar la respuesta
      const originalSend = res.send;
      const originalJson = res.json;

      let responseData = null;

      res.send = function (data) {
        if (includeResponse) {
          responseData = data;
        }
        return originalSend.call(this, data);
      };

      res.json = function (data) {
        if (includeResponse) {
          responseData = data;
        }
        return originalJson.call(this, data);
      };

      // Interceptar el final de la respuesta
      res.on("finish", async () => {
        const duration = Date.now() - startTime;
        const success = res.statusCode < 400;

        const responseInfo = {
          ...requestInfo,
          duration,
          statusCode: res.statusCode,
          success,
          responseSize: res.get("Content-Length") || 0,
          completedAt: new Date().toISOString(),
        };

        if (includeResponse && responseData) {
          responseInfo.response = this.sanitizeSensitiveData(
            responseData,
            sensitiveFields
          );
        }

        // Log de finalización
        const logData = {
          requestId,
          method: responseInfo.method,
          url: responseInfo.url,
          statusCode: responseInfo.statusCode,
          duration: `${duration}ms`,
          success,
          ip: responseInfo.ip,
          userId: responseInfo.userId,
        };

        if (success) {
          logger[logLevel](
            `Request completed: ${responseInfo.action}`,
            logData
          );
        } else {
          logger.warn(`Request failed: ${responseInfo.action}`, logData);
        }

        // Persistir en base de datos si se solicita
        if (persistToDb) {
          try {
            await this.persistAuditLog(responseInfo);
          } catch (error) {
            logger.error("Failed to persist audit log", {
              error: error.message,
              requestId,
            });
          }
        }

        // Alertas para eventos críticos
        if (this.isCriticalEvent(responseInfo)) {
          await this.sendCriticalAlert(responseInfo);
        }
      });

      // Agregar requestId a la request para tracking
      req.requestId = requestId;
      next();
    };
  }

  /**
   * Sanitizar datos sensibles
   */
  static sanitizeSensitiveData(data, sensitiveFields) {
    if (!data || typeof data !== "object") {
      return data;
    }

    const sanitized = Array.isArray(data) ? [] : {};

    for (const [key, value] of Object.entries(data)) {
      const keyLower = key.toLowerCase();

      if (
        sensitiveFields.some((field) => keyLower.includes(field.toLowerCase()))
      ) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = this.sanitizeSensitiveData(value, sensitiveFields);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Persistir log de auditoría en base de datos
   */
  static async persistAuditLog(auditData) {
    try {
      const logEntry = {
        id: auditData.requestId,
        action: auditData.action,
        method: auditData.method,
        url: auditData.url,
        ip_address: auditData.ip,
        user_agent: auditData.userAgent,
        user_id: auditData.userId,
        session_id: auditData.sessionId,
        status_code: auditData.statusCode,
        duration_ms: auditData.duration,
        success: auditData.success,
        request_data: auditData.body || null,
        response_data: auditData.response || null,
        headers: auditData.headers,
        timestamp: auditData.timestamp,
        completed_at: auditData.completedAt,
      };

      await DatabaseAdapter.insert("audit_logs", logEntry);
    } catch (error) {
      logger.error("Error persisting audit log", {
        error: error.message,
        requestId: auditData.requestId,
      });
    }
  }

  /**
   * Determinar si es un evento crítico
   */
  static isCriticalEvent(auditData) {
    // Eventos críticos que requieren alerta
    const criticalConditions = [
      auditData.statusCode >= 500, // Errores del servidor
      auditData.statusCode === 401 && auditData.url.includes("/admin"), // Intentos de acceso admin
      auditData.statusCode === 403, // Acceso denegado
      auditData.duration > 30000, // Requests muy lentos (>30s)
      auditData.url.includes("/webhook") && !auditData.success, // Webhooks fallidos
      auditData.method === "DELETE" && auditData.success, // Eliminaciones exitosas
    ];

    return criticalConditions.some((condition) => condition);
  }

  /**
   * Enviar alerta crítica
   */
  static async sendCriticalAlert(auditData) {
    try {
      const alertData = {
        type: "CRITICAL_EVENT",
        timestamp: new Date().toISOString(),
        requestId: auditData.requestId,
        action: auditData.action,
        statusCode: auditData.statusCode,
        ip: auditData.ip,
        userId: auditData.userId,
        url: auditData.url,
        duration: auditData.duration,
      };

      // Log crítico
      logger.error("CRITICAL EVENT DETECTED", alertData);

      // Aquí se podría integrar con servicios de alertas como:
      // - Slack
      // - Discord
      // - Email
      // - SMS
      // - PagerDuty
    } catch (error) {
      logger.error("Failed to send critical alert", {
        error: error.message,
        requestId: auditData.requestId,
      });
    }
  }

  /**
   * Middleware para operaciones sensibles
   */
  static sensitiveOperation(action) {
    return this.auditMiddleware(action, {
      logLevel: "warn",
      includeBody: true,
      includeResponse: false,
      persistToDb: true,
    });
  }

  /**
   * Middleware para operaciones administrativas
   */
  static adminOperation(action) {
    return this.auditMiddleware(action, {
      logLevel: "info",
      includeBody: true,
      includeResponse: true,
      persistToDb: true,
    });
  }

  /**
   * Middleware para webhooks
   */
  static webhookOperation(action) {
    return this.auditMiddleware(action, {
      logLevel: "info",
      includeBody: true,
      includeResponse: false,
      persistToDb: false,
    });
  }
}

// Middleware para rate limiting básico
const rateLimitMiddleware = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!requests.has(ip)) {
      requests.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const requestData = requests.get(ip);

    if (now > requestData.resetTime) {
      requestData.count = 1;
      requestData.resetTime = now + windowMs;
      return next();
    }

    if (requestData.count >= maxRequests) {
      logger.warn("Rate limit exceeded", {
        ip,
        count: requestData.count,
        url: req.url,
      });
      return res.status(429).json({
        success: false,
        error: "Demasiadas solicitudes. Intenta de nuevo más tarde.",
      });
    }

    requestData.count++;
    next();
  };
};

// Middleware para sanitizar entrada
const sanitizeMiddleware = (req, res, next) => {
  if (req.body) {
    // Sanitizar strings en el body
    const sanitizeObject = (obj) => {
      for (let key in obj) {
        if (typeof obj[key] === "string") {
          obj[key] = obj[key].trim();
          // Remover caracteres potencialmente peligrosos
          obj[key] = obj[key].replace(/[<>]/g, "");
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    };

    sanitizeObject(req.body);
  }

  next();
};

module.exports = {
  auditLog: AuditMiddleware.auditMiddleware,
  rateLimitMiddleware: AuditMiddleware.rateLimitMiddleware,
  sanitizeMiddleware: AuditMiddleware.sanitizeMiddleware,
};
