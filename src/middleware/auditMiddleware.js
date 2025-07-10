// src/middleware/auditMiddleware.js
const logger = require("../utils/logger");

// Middleware para auditar requests importantes
const auditMiddleware = (action) => {
  return (req, res, next) => {
    const startTime = Date.now();

    // Capturar información de la request
    const requestInfo = {
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      action: action || `${req.method} ${req.url}`,
    };

    // Log de la request entrante para operaciones importantes
    if (req.method !== "GET") {
      logger.info(`Operación iniciada: ${requestInfo.action}`, {
        ip: requestInfo.ip,
        userAgent: requestInfo.userAgent,
        body: req.body ? Object.keys(req.body) : [],
      });
    }

    // Interceptar la respuesta
    const originalSend = res.send;
    res.send = function (data) {
      const duration = Date.now() - startTime;

      // Log de la respuesta para operaciones importantes
      if (req.method !== "GET") {
        logger.info(`Operación completada: ${requestInfo.action}`, {
          duration: `${duration}ms`,
          statusCode: res.statusCode,
          success: res.statusCode < 400,
          ip: requestInfo.ip,
        });
      }

      originalSend.call(this, data);
    };

    next();
  };
};

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
  auditMiddleware,
  rateLimitMiddleware,
  sanitizeMiddleware,
};
