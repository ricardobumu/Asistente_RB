/**
 * SISTEMA DE LOGGING AVANZADO
 * Logger centralizado con múltiples niveles y destinos
 *
 * Características:
 * - Logs estructurados en JSON
 * - Rotación automática de archivos
 * - Diferentes niveles de log
 * - Logs de seguridad y auditoría
 * - Logs de performance
 */

const winston = require("winston");
const path = require("path");
const fs = require("fs");

// Crear directorio de logs si no existe
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configuración de niveles personalizados
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
    security: 5,
    performance: 6,
    audit: 7,
  },
  colors: {
    error: "red",
    warn: "yellow",
    info: "green",
    http: "magenta",
    debug: "white",
    security: "cyan",
    performance: "blue",
    audit: "gray",
  },
};

// Agregar colores a winston
winston.addColors(customLevels.colors);

// Formato personalizado para logs
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss.SSS",
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta,
    };

    // Agregar información del proceso
    logEntry.pid = process.pid;
    logEntry.environment = process.env.NODE_ENV || "development";

    return JSON.stringify(logEntry);
  })
);

// Formato para consola (más legible)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({
    format: "HH:mm:ss",
  }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? JSON.stringify(meta, null, 2)
      : "";
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Configuración de transports
const transports = [
  // Console transport (solo en desarrollo)
  ...(process.env.NODE_ENV !== "production"
    ? [
        new winston.transports.Console({
          level: "debug",
          format: consoleFormat,
          handleExceptions: true,
          handleRejections: true,
        }),
      ]
    : []),

  // Archivo principal de logs
  new winston.transports.File({
    filename: path.join(logsDir, "app.log"),
    level: "info",
    format: logFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    tailable: true,
  }),

  // Archivo de errores
  new winston.transports.File({
    filename: path.join(logsDir, "error.log"),
    level: "error",
    format: logFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    tailable: true,
  }),

  // Archivo de seguridad
  new winston.transports.File({
    filename: path.join(logsDir, "security.log"),
    level: "security",
    format: logFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 10,
    tailable: true,
  }),

  // Archivo de auditoría
  new winston.transports.File({
    filename: path.join(logsDir, "audit.log"),
    level: "audit",
    format: logFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 30, // Mantener más tiempo los logs de auditoría
    tailable: true,
  }),

  // Archivo de performance
  new winston.transports.File({
    filename: path.join(logsDir, "performance.log"),
    level: "performance",
    format: logFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 3,
    tailable: true,
  }),
];

// Crear logger principal
const logger = winston.createLogger({
  levels: customLevels.levels,
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  transports,
  exitOnError: false,
  handleExceptions: true,
  handleRejections: true,
});

// Métodos de logging especializados
const specializedLogger = {
  /**
   * Log de seguridad para eventos críticos
   */
  security: (message, meta = {}) => {
    logger.log("security", message, {
      ...meta,
      category: "security",
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log de auditoría para trazabilidad
   */
  audit: (action, user, resource, meta = {}) => {
    logger.log("audit", `${action} on ${resource}`, {
      ...meta,
      category: "audit",
      action,
      user,
      resource,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log de performance para métricas
   */
  performance: (operation, duration, meta = {}) => {
    logger.log("performance", `${operation} completed in ${duration}ms`, {
      ...meta,
      category: "performance",
      operation,
      duration,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log de requests HTTP
   */
  http: (method, url, statusCode, responseTime, meta = {}) => {
    logger.http(`${method} ${url} ${statusCode} - ${responseTime}ms`, {
      ...meta,
      method,
      url,
      statusCode,
      responseTime,
      category: "http",
    });
  },

  /**
   * Log de errores de WhatsApp
   */
  whatsapp: (event, phoneNumber, message, meta = {}) => {
    logger.info(`WhatsApp ${event}`, {
      ...meta,
      category: "whatsapp",
      event,
      phoneNumber: phoneNumber
        ? phoneNumber.replace(/\d(?=\d{4})/g, "*")
        : null, // Ofuscar número
      message: message ? message.substring(0, 100) : null, // Limitar longitud
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log de eventos de Calendly
   */
  calendly: (event, inviteeEmail, eventType, meta = {}) => {
    logger.info(`Calendly ${event}`, {
      ...meta,
      category: "calendly",
      event,
      inviteeEmail: inviteeEmail
        ? inviteeEmail.replace(/(.{2}).*(@.*)/, "$1***$2")
        : null, // Ofuscar email
      eventType,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log de eventos de OpenAI
   */
  openai: (operation, tokens, model, meta = {}) => {
    logger.info(`OpenAI ${operation}`, {
      ...meta,
      category: "openai",
      operation,
      tokens,
      model,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log de eventos de base de datos
   */
  database: (operation, table, recordId, meta = {}) => {
    logger.info(`Database ${operation}`, {
      ...meta,
      category: "database",
      operation,
      table,
      recordId,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log de eventos de autenticación
   */
  auth: (event, userId, ip, meta = {}) => {
    logger.security(`Auth ${event}`, {
      ...meta,
      category: "auth",
      event,
      userId,
      ip,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log de eventos GDPR
   */
  gdpr: (action, dataSubject, dataType, meta = {}) => {
    logger.audit(`GDPR ${action}`, {
      ...meta,
      category: "gdpr",
      action,
      dataSubject: dataSubject
        ? dataSubject.replace(/(.{2}).*/, "$1***")
        : null, // Ofuscar
      dataType,
      timestamp: new Date().toISOString(),
    });
  },
};

// Extender logger con métodos especializados
Object.assign(logger, specializedLogger);

// Función para limpiar logs antiguos
logger.cleanOldLogs = (daysToKeep = 30) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  fs.readdir(logsDir, (err, files) => {
    if (err) {
      logger.error("Error leyendo directorio de logs", { error: err.message });
      return;
    }

    files.forEach((file) => {
      const filePath = path.join(logsDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;

        if (stats.mtime < cutoffDate) {
          fs.unlink(filePath, (err) => {
            if (err) {
              logger.error("Error eliminando log antiguo", {
                file,
                error: err.message,
              });
            } else {
              logger.info("Log antiguo eliminado", { file });
            }
          });
        }
      });
    });
  });
};

// Función para obtener estadísticas de logs
logger.getStats = () => {
  return new Promise((resolve, reject) => {
    fs.readdir(logsDir, (err, files) => {
      if (err) {
        reject(err);
        return;
      }

      const stats = {
        totalFiles: files.length,
        files: [],
        totalSize: 0,
      };

      let processed = 0;

      files.forEach((file) => {
        const filePath = path.join(logsDir, file);
        fs.stat(filePath, (err, fileStat) => {
          processed++;

          if (!err) {
            stats.files.push({
              name: file,
              size: fileStat.size,
              modified: fileStat.mtime,
              sizeFormatted: formatBytes(fileStat.size),
            });
            stats.totalSize += fileStat.size;
          }

          if (processed === files.length) {
            stats.totalSizeFormatted = formatBytes(stats.totalSize);
            resolve(stats);
          }
        });
      });

      if (files.length === 0) {
        resolve(stats);
      }
    });
  });
};

// Función auxiliar para formatear bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// Manejo de errores del logger
logger.on("error", (error) => {
  console.error("Error en el sistema de logging:", error);
});

// Limpiar logs antiguos al iniciar (solo en producción)
if (process.env.NODE_ENV === "production") {
  setTimeout(() => {
    logger.cleanOldLogs(30);
  }, 60000); // Esperar 1 minuto después del inicio
}

module.exports = logger;
