// ARCHIVO ELIMINADO - FUNCIONALIDAD CONSOLIDADA EN rateLimitMiddleware.js
// Este archivo ha sido eliminado para evitar duplicaciones
// Toda la funcionalidad se encuentra ahora en rateLimitMiddleware.js

module.exports = require("./rateLimitMiddleware");
        message: {
          success: false,
          error: "Demasiadas solicitudes. Inténtalo de nuevo en 15 minutos.",
        },
        standardHeaders: true,
        legacyHeaders: false,
      },

      strict: {
        windowMs: 60 * 60 * 1000, // 1 hora
        max: 10, // 10 requests por IP
        message: {
          success: false,
          error:
            "Límite de solicitudes alcanzado. Inténtalo de nuevo en 1 hora.",
        },
        standardHeaders: true,
        legacyHeaders: false,
      },

      auth: {
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: 5, // 5 intentos de login por IP
        message: {
          success: false,
          error:
            "Demasiados intentos de autenticación. Inténtalo de nuevo en 15 minutos.",
        },
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: true,
      },

      whatsapp: {
        windowMs: 1 * 60 * 1000, // 1 minuto
        max: 30, // 30 mensajes por minuto por IP
        message: {
          success: false,
          error: "Demasiados mensajes de WhatsApp. Espera un momento.",
        },
        standardHeaders: true,
        legacyHeaders: false,
      },

      booking: {
        windowMs: 5 * 60 * 1000, // 5 minutos
        max: 10, // 10 reservas por IP cada 5 minutos
        message: {
          success: false,
          error:
            "Demasiadas solicitudes de reserva. Inténtalo de nuevo en 5 minutos.",
        },
        standardHeaders: true,
        legacyHeaders: false,
      },

      gdpr: {
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: 10, // 10 requests RGPD por IP
        message: {
          success: false,
          error:
            "Demasiadas solicitudes RGPD. Inténtalo de nuevo en 15 minutos.",
        },
        standardHeaders: true,
        legacyHeaders: false,
      },
    };

    logger.info("Rate Limiter initialized", {
      configs: Object.keys(this.configs).length,
    });
  }

  /**
   * Crear un limitador personalizado
   */
  createLimiter(options = {}) {
    const config = {
      ...this.configs.general,
      ...options,
      handler: (req, res) => {
        logger.warn("Rate limit exceeded", {
          ip: req.ip,
          path: req.path,
          method: req.method,
          userAgent: req.get("User-Agent"),
        });

        const message = options.message || this.configs.general.message;
        res.status(429).json(message);
      },
      skip: (req) => {
        // Skip rate limiting para IPs de desarrollo
        const devIPs = ["127.0.0.1", "::1", "localhost"];
        return (
          process.env.NODE_ENV === "development" && devIPs.includes(req.ip)
        );
      },
    };

    return rateLimit(config);
  }

  /**
   * Obtener limitador por nombre
   */
  getLimiter(name) {
    if (this.limiters.has(name)) {
      return this.limiters.get(name);
    }

    const config = this.configs[name];
    if (!config) {
      logger.warn("Rate limiter config not found, using general", { name });
      return this.createLimiter();
    }

    const limiter = this.createLimiter(config);
    this.limiters.set(name, limiter);

    return limiter;
  }

  /**
   * Limitadores predefinidos
   */
  get general() {
    return this.getLimiter("general");
  }

  get strict() {
    return this.getLimiter("strict");
  }

  get auth() {
    return this.getLimiter("auth");
  }

  get whatsapp() {
    return this.getLimiter("whatsapp");
  }

  get booking() {
    return this.getLimiter("booking");
  }

  get gdpr() {
    return this.getLimiter("gdpr");
  }

  /**
   * Crear limitador dinámico por usuario
   */
  createUserLimiter(userId, options = {}) {
    const keyGenerator = (req) => {
      return `user_${userId}_${req.ip}`;
    };

    return this.createLimiter({
      ...options,
      keyGenerator,
    });
  }

  /**
   * Crear limitador por endpoint específico
   */
  createEndpointLimiter(endpoint, options = {}) {
    const keyGenerator = (req) => {
      return `endpoint_${endpoint}_${req.ip}`;
    };

    return this.createLimiter({
      ...options,
      keyGenerator,
    });
  }

  /**
   * Middleware para logging de rate limits
   */
  logRateLimit() {
    return (req, res, next) => {
      const originalSend = res.send;

      res.send = function (data) {
        if (res.statusCode === 429) {
          logger.warn("Rate limit hit", {
            ip: req.ip,
            path: req.path,
            method: req.method,
            userAgent: req.get("User-Agent"),
            timestamp: new Date().toISOString(),
          });
        }

        return originalSend.call(this, data);
      };

      next();
    };
  }

  /**
   * Middleware para bypass de rate limiting en desarrollo
   */
  developmentBypass() {
    return (req, res, next) => {
      if (process.env.NODE_ENV === "development") {
        logger.debug("Rate limiting bypassed in development", {
          ip: req.ip,
          path: req.path,
        });
      }
      next();
    };
  }

  /**
   * Obtener estadísticas de rate limiting
   */
  getStats() {
    return {
      activeLimiters: this.limiters.size,
      configs: Object.keys(this.configs),
      environment: process.env.NODE_ENV,
    };
  }

  /**
   * Limpiar limitadores en memoria
   */
  clearLimiters() {
    this.limiters.clear();
    logger.info("Rate limiters cleared");
  }
}

module.exports = new RateLimiter();
