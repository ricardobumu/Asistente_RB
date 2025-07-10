// src/routes/adminRoutes.js
// Rutas del Centro de Mando Interno - Dashboard Administrativo

const express = require("express");
const router = express.Router();
const AdminController = require("../controllers/adminController");
const AuthController = require("../controllers/authController");
const SecurityMiddleware = require("../middleware/securityMiddleware");
const ErrorHandler = require("../middleware/errorHandler");
const adminBookingRoutes = require("./adminBookingRoutes");

// ===== RUTAS DE AUTENTICACIÓN (SIN PROTECCIÓN) =====

/**
 * POST /admin/auth/login
 * Login de administrador
 */
router.post("/auth/login", ErrorHandler.asyncWrapper(AuthController.login));

/**
 * POST /admin/auth/verify
 * Verificar token JWT
 */
router.post(
  "/auth/verify",
  ErrorHandler.asyncWrapper(AuthController.verifyToken)
);

/**
 * GET /admin/auth/temp-token
 * Generar token temporal (solo desarrollo)
 */
router.get(
  "/auth/temp-token",
  ErrorHandler.asyncWrapper(AuthController.generateTempToken)
);

// ===== MIDDLEWARE DE SEGURIDAD PARA ADMIN =====

// Middleware para proteger rutas (excepto auth)
router.use((req, res, next) => {
  // Skip authentication for auth routes
  if (req.path.startsWith("/auth/")) {
    return next();
  }

  // Apply JWT authentication for all other routes
  return SecurityMiddleware.authenticateJWT(req, res, next);
});

// Rate limiting específico para admin
const rateLimiters = SecurityMiddleware.rateLimiters();
router.use(rateLimiters.admin);

// Logging específico para acciones administrativas
router.use((req, res, next) => {
  const logger = require("../utils/logger");
  logger.audit(
    "Admin route accessed",
    req.user?.email || "admin",
    req.originalUrl,
    {
      method: req.method,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    }
  );
  next();
});

// ===== RUTAS DEL DASHBOARD =====

/**
 * GET /admin/dashboard
 * Dashboard principal con métricas generales
 */
router.get(
  "/dashboard",
  ErrorHandler.asyncWrapper(AdminController.getDashboard)
);

/**
 * GET /admin/logs
 * 🔍 Logs del sistema con filtros
 * Query params: type, level, limit, search, startDate, endDate
 */
router.get("/logs", ErrorHandler.asyncWrapper(AdminController.getSystemLogs));

/**
 * GET /admin/messages
 * 📞 Mensajes del bot de WhatsApp
 * Query params: limit, phone, status, startDate, endDate
 */
router.get(
  "/messages",
  ErrorHandler.asyncWrapper(AdminController.getBotMessages)
);

// ===== RUTAS DE GESTIÓN DE RESERVAS =====

/**
 * Montar rutas de gestión de reservas
 * /admin/bookings/* - Sistema completo de gestión de reservas
 */
router.use("/bookings", adminBookingRoutes);

/**
 * GET /admin/bookings-legacy
 * 📅 Reservas y citas de Calendly (legacy)
 * Query params: status, limit, startDate, endDate
 */
router.get(
  "/bookings-legacy",
  ErrorHandler.asyncWrapper(AdminController.getBookings)
);

/**
 * GET /admin/openai
 * 🧠 Estado y logs de OpenAI
 * Query params: limit
 */
router.get(
  "/openai",
  ErrorHandler.asyncWrapper(AdminController.getOpenAIStatus)
);

/**
 * GET /admin/twilio
 * 📦 Estado y logs de Twilio WhatsApp
 * Query params: limit
 */
router.get(
  "/twilio",
  ErrorHandler.asyncWrapper(AdminController.getTwilioStatus)
);

/**
 * GET /admin/users
 * 👤 Usuarios y actividad
 * Query params: limit, phone
 */
router.get(
  "/users",
  ErrorHandler.asyncWrapper(AdminController.getUserActivity)
);

/**
 * GET /admin/security
 * 🔐 Estado de seguridad y logs
 * Query params: limit
 */
router.get(
  "/security",
  ErrorHandler.asyncWrapper(AdminController.getSecurityStatus)
);

/**
 * GET /admin/health
 * 🌐 Salud del sistema
 */
router.get(
  "/health",
  ErrorHandler.asyncWrapper(AdminController.getSystemHealth)
);

// ===== RUTAS DE ACCIONES ADMINISTRATIVAS =====

/**
 * POST /admin/logs/rotate
 * Rotar logs manualmente
 */
router.post(
  "/logs/rotate",
  ErrorHandler.asyncWrapper(async (req, res) => {
    const logger = require("../utils/logger");

    try {
      logger.rotateLogs();

      logger.audit(
        "Logs rotated manually",
        req.user?.email || "admin",
        "logs_rotate",
        {
          ip: req.ip,
        }
      );

      res.json({
        success: true,
        message: "Logs rotated successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error rotating logs", error);
      throw error;
    }
  })
);

/**
 * POST /admin/logs/clean
 * Limpiar logs antiguos
 */
router.post(
  "/logs/clean",
  ErrorHandler.asyncWrapper(async (req, res) => {
    const logger = require("../utils/logger");
    const { days = 30 } = req.body;

    try {
      logger.cleanOldLogs(parseInt(days));

      logger.audit(
        "Old logs cleaned",
        req.user?.email || "admin",
        "logs_clean",
        {
          days: parseInt(days),
          ip: req.ip,
        }
      );

      res.json({
        success: true,
        message: `Logs older than ${days} days cleaned successfully`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error cleaning logs", error);
      throw error;
    }
  })
);

/**
 * POST /admin/system/restart
 * Reiniciar sistema (solo en desarrollo)
 */
router.post(
  "/system/restart",
  ErrorHandler.asyncWrapper(async (req, res) => {
    const logger = require("../utils/logger");

    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        success: false,
        error: "System restart not allowed in production",
      });
    }

    logger.audit(
      "System restart requested",
      req.user?.email || "admin",
      "system_restart",
      {
        ip: req.ip,
      }
    );

    res.json({
      success: true,
      message: "System restart initiated",
      timestamp: new Date().toISOString(),
    });

    // Reiniciar después de enviar respuesta
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  })
);

/**
 * GET /admin/export/logs
 * Exportar logs como archivo
 */
router.get(
  "/export/logs",
  ErrorHandler.asyncWrapper(async (req, res) => {
    const logger = require("../utils/logger");
    const { type = "app", format = "json" } = req.query;

    try {
      const logs = await AdminController.readLogFile(type, { limit: 1000 });

      logger.audit("Logs exported", req.user?.email || "admin", "logs_export", {
        type,
        format,
        count: logs.length,
        ip: req.ip,
      });

      if (format === "csv") {
        // Convertir a CSV
        const csv = AdminController.convertLogsToCSV(logs);
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${type}-logs-${
            new Date().toISOString().split("T")[0]
          }.csv"`
        );
        res.send(csv);
      } else {
        // JSON por defecto
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${type}-logs-${
            new Date().toISOString().split("T")[0]
          }.json"`
        );
        res.json({
          exportDate: new Date().toISOString(),
          type,
          count: logs.length,
          logs,
        });
      }
    } catch (error) {
      logger.error("Error exporting logs", error);
      throw error;
    }
  })
);

/**
 * GET /admin/stats/summary
 * Resumen de estadísticas para widgets
 */
router.get(
  "/stats/summary",
  ErrorHandler.asyncWrapper(async (req, res) => {
    const logger = require("../utils/logger");

    try {
      const summary = {
        system: await AdminController.getSystemHealth(),
        today: await AdminController.getTodayStats(),
        integrations: await AdminController.getIntegrationStatus(),
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error("Error getting stats summary", error);
      throw error;
    }
  })
);

// ===== RUTAS DE CONFIGURACIÓN =====

/**
 * POST /admin/auth/logout
 * Logout de administrador
 */
router.post("/auth/logout", ErrorHandler.asyncWrapper(AuthController.logout));

/**
 * GET /admin/config
 * Obtener configuración actual (sin secretos)
 */
router.get(
  "/config",
  ErrorHandler.asyncWrapper(async (req, res) => {
    const logger = require("../utils/logger");

    const config = {
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION || "1.0.0",
      features: {
        openai: !!process.env.OPENAI_API_KEY,
        twilio: !!process.env.TWILIO_ACCOUNT_SID,
        calendly: !!process.env.CALENDLY_ACCESS_TOKEN,
        supabase: !!process.env.SUPABASE_URL,
      },
      cors: {
        allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") || [],
      },
      logging: {
        level: process.env.LOG_LEVEL || "info",
      },
      timestamp: new Date().toISOString(),
    };

    logger.audit(
      "Configuration accessed",
      req.user?.email || "admin",
      "config",
      {
        ip: req.ip,
      }
    );

    res.json({
      success: true,
      data: config,
    });
  })
);

// ===== MIDDLEWARE DE MANEJO DE ERRORES =====

// Manejo específico de errores de admin
router.use((err, req, res, next) => {
  const logger = require("../utils/logger");

  logger.error("Admin route error", err, {
    route: req.originalUrl,
    method: req.method,
    user: req.user?.email || "admin",
    ip: req.ip,
  });

  // Log de seguridad para errores administrativos
  logger.security("Admin route error occurred", {
    route: req.originalUrl,
    error: err.message,
    user: req.user?.email || "admin",
    ip: req.ip,
  });

  res.status(500).json({
    success: false,
    error: "Admin operation failed",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
