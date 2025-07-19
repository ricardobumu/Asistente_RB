/**
 * RUTAS DE ADMINISTRACIÓN
 * Panel de control administrativo para gestión del sistema
 *
 * Endpoints:
 * - GET / - Dashboard principal
 * - GET /stats - Estadísticas del sistema
 * - GET /conversations - Lista de conversaciones
 * - GET /clients - Lista de clientes
 * - POST /message - Envío manual de mensajes
 */

const express = require("express");
const path = require("path");
const rateLimit = require("express-rate-limit");
const adminController = require("../controllers/adminController");
const logger = require("../utils/logger");

const router = express.Router();

// Rate limiting estricto para rutas administrativas
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana
  message: {
    error: "Demasiadas solicitudes administrativas",
    retryAfter: "15 minutos",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return `admin_${req.ip}_${req.get("User-Agent")}`;
  },
});

// Middleware de logging para rutas administrativas
const adminLogger = (req, res, next) => {
  logger.audit("admin_access", "system", req.path, {
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });
  next();
};

// Aplicar rate limiting y logging a todas las rutas
router.use(adminLimiter);
router.use(adminLogger);

// ===== RUTAS DE ARCHIVOS ESTÁTICOS =====

/**
 * GET /
 * Dashboard principal de administración
 */
router.get("/", (req, res) => {
  try {
    res.sendFile(path.join(__dirname, "../public/admin/index.html"));
  } catch (error) {
    logger.error("Error sirviendo dashboard admin", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Error cargando dashboard",
    });
  }
});

/**
 * GET /login
 * Página de login administrativo
 */
router.get("/login", (req, res) => {
  try {
    res.sendFile(path.join(__dirname, "../public/admin/login.html"));
  } catch (error) {
    logger.error("Error sirviendo login admin", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Error cargando login",
    });
  }
});

// ===== API ENDPOINTS =====

/**
 * GET /api/stats
 * Estadísticas generales del sistema
 */
router.get("/api/stats", adminController.getSystemStats);

/**
 * GET /api/conversations
 * Lista de conversaciones recientes
 */
router.get("/api/conversations", adminController.getConversations);

/**
 * GET /api/conversations/:phoneNumber
 * Historial de conversación específica
 */
router.get(
  "/api/conversations/:phoneNumber",
  adminController.getConversationHistory
);

/**
 * GET /api/clients
 * Lista de clientes
 */
router.get("/api/clients", adminController.getClients);

/**
 * GET /api/clients/:id
 * Detalles de cliente específico
 */
router.get("/api/clients/:id", adminController.getClientDetails);

/**
 * POST /api/message
 * Envío manual de mensaje
 */
router.post("/api/message", adminController.sendManualMessage);

/**
 * GET /api/calendly/events
 * Eventos de Calendly recientes
 */
router.get("/api/calendly/events", adminController.getCalendlyEvents);

/**
 * GET /api/calendly/stats
 * Estadísticas de Calendly
 */
router.get("/api/calendly/stats", adminController.getCalendlyStats);

/**
 * GET /api/services/status
 * Estado de todos los servicios
 */
router.get("/api/services/status", adminController.getServicesStatus);

/**
 * GET /api/logs
 * Logs del sistema (últimos)
 */
router.get("/api/logs", adminController.getSystemLogs);

/**
 * GET /api/metrics
 * Métricas detalladas del sistema
 */
router.get("/api/metrics", adminController.getDetailedMetrics);

/**
 * POST /api/context/clear
 * Limpiar contexto de conversación
 */
router.post("/api/context/clear", adminController.clearConversationContext);

/**
 * GET /api/context/export
 * Exportar contextos para backup
 */
router.get("/api/context/export", adminController.exportContexts);

/**
 * POST /api/cache/clear
 * Limpiar caches del sistema
 */
router.post("/api/cache/clear", adminController.clearSystemCaches);

/**
 * GET /api/database/stats
 * Estadísticas de base de datos
 */
router.get("/api/database/stats", adminController.getDatabaseStats);

/**
 * POST /api/database/cleanup
 * Limpieza de datos antiguos (GDPR)
 */
router.post("/api/database/cleanup", adminController.cleanupOldData);

/**
 * GET /api/audit/logs
 * Logs de auditoría
 */
router.get("/api/audit/logs", adminController.getAuditLogs);

/**
 * GET /api/security/report
 * Reporte de seguridad
 */
router.get("/api/security/report", adminController.getSecurityReport);

/**
 * POST /api/test/webhook
 * Probar webhook (desarrollo)
 */
if (process.env.NODE_ENV === "development") {
  router.post("/api/test/webhook", adminController.testWebhook);
}

/**
 * GET /api/config
 * Configuración del sistema (sin secretos)
 */
router.get("/api/config", adminController.getSystemConfig);

/**
 * POST /api/config/validate
 * Validar configuración
 */
router.post("/api/config/validate", adminController.validateConfig);

// ===== RUTAS DE UTILIDAD =====

/**
 * GET /health
 * Health check administrativo
 */
router.get("/health", (req, res) => {
  res.status(200).json({
    service: "Admin Panel",
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /version
 * Información de versión
 */
router.get("/version", (req, res) => {
  const config = require("../config/environment");
  res.status(200).json({
    app: config.APP_NAME,
    version: config.APP_VERSION,
    environment: config.NODE_ENV,
    node: process.version,
    timestamp: new Date().toISOString(),
  });
});

// ===== MANEJO DE ERRORES =====

// Middleware de manejo de errores específico para admin
router.use((error, req, res, next) => {
  logger.error("Error en rutas administrativas", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  // Log de auditoría para errores administrativos
  logger.audit("admin_error", "system", req.path, {
    error: error.message,
    ip: req.ip,
    method: req.method,
  });

  const statusCode = error.status || error.statusCode || 500;
  const errorMessage =
    process.env.NODE_ENV === "production"
      ? "Error interno del servidor"
      : error.message;

  res.status(statusCode).json({
    success: false,
    error: errorMessage,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
  });
});

module.exports = router;
