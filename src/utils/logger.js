// src/utils/logger.js
// Sistema de logging avanzado con seguridad y monitoreo

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

class AdvancedLogger {
  constructor() {
    this.logDir = path.join(process.cwd(), "logs");
    this.ensureLogDirectory();
    this.sensitiveFields = [
      "password",
      "token",
      "secret",
      "key",
      "authorization",
      "phone",
      "email",
      "name",
      "address",
      "ssn",
      "credit_card",
      "api_key",
      "access_token",
      "refresh_token",
      "jwt",
    ];
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  // Generar ID único para cada log
  generateLogId() {
    return crypto.randomBytes(8).toString("hex");
  }

  // Sanitizar datos sensibles antes de loggear
  sanitizeLogData(data) {
    if (!data || typeof data !== "object") return data;

    const sanitized = JSON.parse(JSON.stringify(data));

    const recursiveSanitize = (obj) => {
      if (typeof obj !== "object" || obj === null) return obj;

      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();

        // Verificar si es un campo sensible
        if (this.sensitiveFields.some((field) => lowerKey.includes(field))) {
          if (typeof value === "string" && value.length > 0) {
            obj[key] = `${value.substring(0, 3)}***${value.substring(
              value.length - 3,
            )}`;
          } else {
            obj[key] = "[REDACTED]";
          }
        } else if (typeof value === "object") {
          recursiveSanitize(value);
        }
      }
    };

    recursiveSanitize(sanitized);
    return sanitized;
  }

  formatMessage(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const sanitizedMetadata = this.sanitizeLogData(metadata);

    const logEntry = {
      timestamp,
      level,
      message,
      metadata: sanitizedMetadata,
      logId: this.generateLogId(),
      service: "asistente-rb-autonomo",
      environment: process.env.NODE_ENV || "development",
    };
    return JSON.stringify(logEntry) + "\n";
  }

  writeToFile(filename, content) {
    try {
      const filePath = path.join(this.logDir, filename);
      fs.appendFileSync(filePath, content);
    } catch (error) {
      console.error("Error writing to log file:", error);
    }
  }

  info(message, metadata = {}) {
    const logMessage = this.formatMessage("INFO", message, metadata);

    if (process.env.NODE_ENV !== "production") {
      console.log(`[INFO] ${message}`, this.sanitizeLogData(metadata));
    }

    this.writeToFile("app.log", logMessage);
  }

  error(message, error = null, metadata = {}) {
    const errorData = error
      ? {
          message: error.message,
          stack: error.stack,
          ...metadata,
        }
      : metadata;

    const logMessage = this.formatMessage("ERROR", message, errorData);

    if (process.env.NODE_ENV !== "production") {
      console.error(`[ERROR] ${message}`, this.sanitizeLogData(errorData));
    }

    this.writeToFile("error.log", logMessage);
    this.writeToFile("app.log", logMessage);
  }

  warn(message, metadata = {}) {
    const logMessage = this.formatMessage("WARN", message, metadata);

    if (process.env.NODE_ENV !== "production") {
      console.warn(`[WARN] ${message}`, this.sanitizeLogData(metadata));
    }

    this.writeToFile("warn.log", logMessage);
    this.writeToFile("app.log", logMessage);
  }

  // Log de eventos de seguridad
  security(message, metadata = {}) {
    const securityData = {
      ...metadata,
      securityEvent: true,
      severity: "security",
    };

    const logMessage = this.formatMessage("SECURITY", message, securityData);

    console.warn(`[SECURITY] ${message}`, this.sanitizeLogData(securityData));
    this.writeToFile("security.log", logMessage);
    this.writeToFile("app.log", logMessage);
  }

  // Log de auditoría
  audit(action, user, resource, metadata = {}) {
    const auditData = {
      action,
      user: user ? this.sanitizeLogData({ user }).user : "anonymous",
      resource,
      ...metadata,
      auditEvent: true,
    };

    const logMessage = this.formatMessage(
      "AUDIT",
      `Audit event: ${action}`,
      auditData,
    );
    this.writeToFile("audit.log", logMessage);
    this.writeToFile("app.log", logMessage);
  }

  // Log de performance
  performance(operation, duration, metadata = {}) {
    const performanceData = {
      operation,
      duration: `${duration}ms`,
      performanceMetric: true,
      ...metadata,
    };

    const logMessage = this.formatMessage(
      "PERFORMANCE",
      `Performance: ${operation}`,
      performanceData,
    );
    this.writeToFile("performance.log", logMessage);

    if (duration > 1000) {
      // Log slow operations
      this.warn(`Slow operation detected: ${operation}`, performanceData);
    }
  }

  // Log de eventos de WhatsApp
  whatsapp(event, phoneNumber, metadata = {}) {
    const whatsappData = {
      event,
      phoneNumber: phoneNumber ? `***${phoneNumber.slice(-4)}` : "unknown",
      channel: "whatsapp",
      ...metadata,
    };

    const logMessage = this.formatMessage(
      "WHATSAPP",
      `WhatsApp: ${event}`,
      whatsappData,
    );
    this.writeToFile("whatsapp.log", logMessage);
    this.writeToFile("app.log", logMessage);
  }

  // Log de reservas
  booking(action, bookingId, clientInfo, metadata = {}) {
    const bookingData = {
      action,
      bookingId,
      clientInfo: this.sanitizeLogData(clientInfo),
      bookingEvent: true,
      ...metadata,
    };

    const logMessage = this.formatMessage(
      "BOOKING",
      `Booking ${action}`,
      bookingData,
    );
    this.writeToFile("bookings.log", logMessage);
    this.writeToFile("app.log", logMessage);
  }

  // Log de errores de integración
  integration(service, operation, error, metadata = {}) {
    const integrationData = {
      service,
      operation,
      error: error.message,
      stack: error.stack,
      integration: true,
      ...metadata,
    };

    const logMessage = this.formatMessage(
      "INTEGRATION_ERROR",
      `Integration error: ${service}`,
      integrationData,
    );
    this.writeToFile("integrations.log", logMessage);
    this.writeToFile("error.log", logMessage);
  }

  // Limpiar logs antiguos
  cleanOldLogs(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    fs.readdir(this.logDir, (err, files) => {
      if (err) {
        this.error("Error reading log directory", err);
        return;
      }

      files.forEach((file) => {
        const filePath = path.join(this.logDir, file);
        fs.stat(filePath, (err, stats) => {
          if (err) return;

          if (stats.mtime < cutoffDate) {
            fs.unlink(filePath, (err) => {
              if (!err) {
                this.info("Old log file deleted", { file });
              }
            });
          }
        });
      });
    });
  }

  // Rotar logs manualmente
  rotateLogs() {
    this.info("Manual log rotation initiated");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    const logFiles = ["app.log", "error.log", "security.log", "whatsapp.log"];

    logFiles.forEach((file) => {
      const currentPath = path.join(this.logDir, file);
      const rotatedPath = path.join(this.logDir, `${file}.${timestamp}`);

      if (fs.existsSync(currentPath)) {
        fs.renameSync(currentPath, rotatedPath);
        this.info("Log file rotated", {
          original: file,
          rotated: `${file}.${timestamp}`,
        });
      }
    });
  }
}

// Crear instancia única
const logger = new AdvancedLogger();

// Limpiar logs antiguos al iniciar (solo en producción)
if (process.env.NODE_ENV === "production") {
  logger.cleanOldLogs(30); // Mantener logs por 30 días
}

module.exports = logger;
