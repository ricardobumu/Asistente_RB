// src/middleware/errorHandler.js
// Sistema avanzado de manejo de errores con logging y monitoreo

const logger = require("../utils/logger");

class ErrorHandler {
  /**
   * Middleware principal de manejo de errores
   */
  static globalErrorHandler(err, req, res, next) {
    const startTime = Date.now();

    // Generar ID único para el error
    const errorId = require("crypto").randomBytes(8).toString("hex");

    // Clasificar el error
    const errorInfo = ErrorHandler.classifyError(err);

    // Log del error con contexto completo
    logger.error("Global error caught", err, {
      errorId,
      errorType: errorInfo.type,
      severity: errorInfo.severity,
      statusCode: errorInfo.statusCode,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      body: req.body,
      query: req.query,
      params: req.params,
      headers: {
        "content-type": req.headers["content-type"],
        authorization: req.headers["authorization"] ? "[PRESENT]" : "[ABSENT]",
        "x-api-key": req.headers["x-api-key"] ? "[PRESENT]" : "[ABSENT]",
      },
    });

    // Log de seguridad si es necesario
    if (errorInfo.severity === "high" || errorInfo.type === "security") {
      logger.security("High severity error detected", {
        errorId,
        errorType: errorInfo.type,
        message: err.message,
        ip: req.ip,
        endpoint: `${req.method} ${req.originalUrl}`,
      });
    }

    // Respuesta al cliente (sin exponer información sensible)
    const response = ErrorHandler.buildErrorResponse(errorInfo, errorId);

    // Log de performance si la respuesta es lenta
    const responseTime = Date.now() - startTime;
    if (responseTime > 100) {
      logger.performance("Error handling", responseTime, {
        errorId,
        errorType: errorInfo.type,
      });
    }

    res.status(errorInfo.statusCode).json(response);
  }

  /**
   * Clasificar el tipo y severidad del error
   */
  static classifyError(err) {
    // Errores de validación
    if (err.name === "ValidationError" || err.message.includes("validation")) {
      return {
        type: "validation",
        severity: "low",
        statusCode: 400,
        userMessage: "Invalid input data",
      };
    }

    // Errores de autenticación
    if (
      err.name === "UnauthorizedError" ||
      err.message.includes("unauthorized") ||
      err.message.includes("token") ||
      err.message.includes("authentication")
    ) {
      return {
        type: "authentication",
        severity: "medium",
        statusCode: 401,
        userMessage: "Authentication required",
      };
    }

    // Errores de autorización
    if (
      err.message.includes("forbidden") ||
      err.message.includes("permission") ||
      err.status === 403
    ) {
      return {
        type: "authorization",
        severity: "medium",
        statusCode: 403,
        userMessage: "Access denied",
      };
    }

    // Errores de rate limiting
    if (err.message.includes("rate limit") || err.status === 429) {
      return {
        type: "rate_limit",
        severity: "medium",
        statusCode: 429,
        userMessage: "Too many requests",
      };
    }

    // Errores de base de datos
    if (
      err.name === "SequelizeError" ||
      err.name === "DatabaseError" ||
      err.message.includes("database") ||
      err.message.includes("connection")
    ) {
      return {
        type: "database",
        severity: "high",
        statusCode: 500,
        userMessage: "Database error",
      };
    }

    // Errores de integración externa
    if (
      err.message.includes("openai") ||
      err.message.includes("twilio") ||
      err.message.includes("calendly") ||
      err.message.includes("API") ||
      err.code === "ECONNREFUSED" ||
      err.code === "ETIMEDOUT"
    ) {
      return {
        type: "integration",
        severity: "high",
        statusCode: 502,
        userMessage: "External service error",
      };
    }

    // Errores de seguridad
    if (
      err.message.includes("security") ||
      err.message.includes("malicious") ||
      err.message.includes("attack") ||
      err.message.includes("injection")
    ) {
      return {
        type: "security",
        severity: "critical",
        statusCode: 403,
        userMessage: "Security violation detected",
      };
    }

    // Errores de recursos no encontrados
    if (err.status === 404 || err.message.includes("not found")) {
      return {
        type: "not_found",
        severity: "low",
        statusCode: 404,
        userMessage: "Resource not found",
      };
    }

    // Errores de timeout
    if (err.code === "ETIMEDOUT" || err.message.includes("timeout")) {
      return {
        type: "timeout",
        severity: "medium",
        statusCode: 408,
        userMessage: "Request timeout",
      };
    }

    // Error genérico del servidor
    return {
      type: "server",
      severity: "high",
      statusCode: 500,
      userMessage: "Internal server error",
    };
  }

  /**
   * Construir respuesta de error para el cliente
   */
  static buildErrorResponse(errorInfo, errorId) {
    const baseResponse = {
      success: false,
      error: {
        type: errorInfo.type,
        message: errorInfo.userMessage,
        errorId: errorId,
        timestamp: new Date().toISOString(),
      },
    };

    // Agregar información adicional según el tipo de error
    switch (errorInfo.type) {
      case "validation":
        baseResponse.error.details =
          "Please check your input data and try again";
        break;

      case "authentication":
        baseResponse.error.details =
          "Please provide valid authentication credentials";
        break;

      case "authorization":
        baseResponse.error.details =
          "You do not have permission to access this resource";
        break;

      case "rate_limit":
        baseResponse.error.details =
          "Please wait before making another request";
        baseResponse.error.retryAfter = "1 minute";
        break;

      case "integration":
        baseResponse.error.details = "External service temporarily unavailable";
        baseResponse.error.retryAfter = "5 minutes";
        break;

      case "timeout":
        baseResponse.error.details = "Request took too long to process";
        break;

      default:
        baseResponse.error.details = "An unexpected error occurred";
    }

    // En desarrollo, agregar más información
    if (process.env.NODE_ENV === "development") {
      baseResponse.error.stack = errorInfo.stack;
      baseResponse.error.originalMessage = errorInfo.message;
    }

    return baseResponse;
  }

  /**
   * Manejo de errores asíncronos no capturados
   */
  static handleUncaughtException(err) {
    logger.error("Uncaught Exception", err, {
      severity: "critical",
      type: "uncaught_exception",
      processId: process.pid,
    });

    // Log de seguridad crítico
    logger.security("Critical system error - uncaught exception", {
      error: err.message,
      stack: err.stack,
      processId: process.pid,
    });

    // En producción, intentar graceful shutdown
    if (process.env.NODE_ENV === "production") {
      console.error("Uncaught Exception - shutting down gracefully");
      process.exit(1);
    }
  }

  /**
   * Manejo de promesas rechazadas no capturadas
   */
  static handleUnhandledRejection(reason, promise) {
    logger.error("Unhandled Promise Rejection", reason, {
      severity: "critical",
      type: "unhandled_rejection",
      promise: promise.toString(),
      processId: process.pid,
    });

    // Log de seguridad crítico
    logger.security("Critical system error - unhandled rejection", {
      reason: reason?.message || reason,
      processId: process.pid,
    });

    // En producción, intentar graceful shutdown
    if (process.env.NODE_ENV === "production") {
      console.error("Unhandled Rejection - shutting down gracefully");
      process.exit(1);
    }
  }

  /**
   * Middleware para errores 404
   */
  static notFoundHandler(req, res, next) {
    const error = new Error(
      `Route not found: ${req.method} ${req.originalUrl}`
    );
    error.status = 404;

    logger.warn("Route not found", {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    next(error);
  }

  /**
   * Wrapper para funciones async para capturar errores automáticamente
   */
  static asyncWrapper(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Validador de entrada con manejo de errores
   */
  static validateInput(schema) {
    return (req, res, next) => {
      try {
        const { error, value } = schema.validate(req.body);

        if (error) {
          const validationError = new Error("Validation failed");
          validationError.name = "ValidationError";
          validationError.details = error.details;
          return next(validationError);
        }

        req.validatedBody = value;
        next();
      } catch (err) {
        next(err);
      }
    };
  }

  /**
   * Middleware de timeout para requests
   */
  static timeoutHandler(timeoutMs = 30000) {
    return (req, res, next) => {
      const timeout = setTimeout(() => {
        const error = new Error("Request timeout");
        error.code = "ETIMEDOUT";
        error.status = 408;
        next(error);
      }, timeoutMs);

      // Limpiar timeout cuando la respuesta termine
      res.on("finish", () => clearTimeout(timeout));
      res.on("close", () => clearTimeout(timeout));

      next();
    };
  }

  /**
   * Inicializar manejadores globales
   */
  static initialize() {
    // Manejar excepciones no capturadas
    process.on("uncaughtException", ErrorHandler.handleUncaughtException);

    // Manejar promesas rechazadas no capturadas
    process.on("unhandledRejection", ErrorHandler.handleUnhandledRejection);

    // Manejar señales de terminación
    process.on("SIGTERM", () => {
      logger.info("SIGTERM received - shutting down gracefully");
      process.exit(0);
    });

    process.on("SIGINT", () => {
      logger.info("SIGINT received - shutting down gracefully");
      process.exit(0);
    });

    logger.info("Error handlers initialized");
  }

  /**
   * Health check con manejo de errores
   */
  static healthCheck(req, res, next) {
    try {
      const health = {
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.APP_VERSION || "1.0.0",
        environment: process.env.NODE_ENV || "development",
      };

      res.json(health);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ErrorHandler;
