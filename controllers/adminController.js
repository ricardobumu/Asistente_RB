/**
 * CONTROLADOR DE ADMINISTRACIÓN
 * Lógica de negocio para el panel administrativo
 *
 * Funcionalidades:
 * - Estadísticas del sistema
 * - Gestión de conversaciones
 * - Gestión de clientes
 * - Monitoreo de servicios
 * - Herramientas de administración
 */

const config = require("../config/environment");
const logger = require("../utils/logger");
const supabaseService = require("../services/supabaseService");
const contextService = require("../services/contextService");
const openaiService = require("../services/openaiService");
const twilioService = require("../services/twilioService");
const whatsappController = require("./whatsappController");

/**
 * Obtiene estadísticas generales del sistema
 */
const getSystemStats = async (req, res) => {
  try {
    const stats = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.NODE_ENV,
      version: config.APP_VERSION,
    };

    // Estadísticas de base de datos
    try {
      stats.database = await supabaseService.getDatabaseMetrics();
    } catch (error) {
      logger.warn("Error obteniendo métricas de base de datos", {
        error: error.message,
      });
      stats.database = { error: "No disponible" };
    }

    // Estadísticas de contexto
    try {
      stats.context = contextService.getContextStats();
    } catch (error) {
      logger.warn("Error obteniendo estadísticas de contexto", {
        error: error.message,
      });
      stats.context = { error: "No disponible" };
    }

    // Estadísticas de Twilio
    try {
      stats.twilio = twilioService.getMetrics();
    } catch (error) {
      logger.warn("Error obteniendo métricas de Twilio", {
        error: error.message,
      });
      stats.twilio = { error: "No disponible" };
    }

    // Estadísticas de OpenAI
    try {
      stats.openai = openaiService.getStats();
    } catch (error) {
      logger.warn("Error obteniendo estadísticas de OpenAI", {
        error: error.message,
      });
      stats.openai = { error: "No disponible" };
    }

    // Estadísticas de Calendly
    try {
      stats.calendly = await supabaseService.getCalendlyStats();
    } catch (error) {
      logger.warn("Error obteniendo estadísticas de Calendly", {
        error: error.message,
      });
      stats.calendly = { error: "No disponible" };
    }

    // Estadísticas del sistema
    stats.system = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
        total:
          Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB",
        external:
          Math.round(process.memoryUsage().external / 1024 / 1024) + " MB",
      },
      cpu: process.cpuUsage(),
    };

    logger.audit("system_stats_accessed", req.ip, "system_stats", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error("Error obteniendo estadísticas del sistema", {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error obteniendo estadísticas del sistema",
    });
  }
};

/**
 * Obtiene lista de conversaciones recientes
 */
const getConversations = async (req, res) => {
  try {
    const { limit = 50, offset = 0, phoneNumber } = req.query;

    const conversations = await supabaseService.getRecentConversations({
      limit: parseInt(limit),
      offset: parseInt(offset),
      phoneNumber,
    });

    // Obtener conversaciones activas del contexto
    const activeConversations = await contextService.getActiveConversations({
      limit: 20,
    });

    res.status(200).json({
      success: true,
      data: {
        recent: conversations,
        active: activeConversations,
        total: conversations.length,
        activeCount: activeConversations.length,
      },
    });
  } catch (error) {
    logger.error("Error obteniendo conversaciones", {
      error: error.message,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error obteniendo conversaciones",
    });
  }
};

/**
 * Obtiene historial de conversación específica
 */
const getConversationHistory = async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { limit = 100, includeContext = true } = req.query;

    // Obtener historial de base de datos
    const dbHistory = await supabaseService.getRecentConversations({
      phoneNumber,
      limit: parseInt(limit),
    });

    let contextHistory = [];
    if (includeContext === "true") {
      // Obtener contexto actual
      contextHistory = await contextService.getContext(phoneNumber, {
        limit: 50,
        includeMetadata: true,
      });
    }

    // Análisis de patrones si está disponible
    let patterns = null;
    try {
      patterns = await contextService.analyzeConversationPatterns(phoneNumber);
    } catch (error) {
      logger.warn("Error analizando patrones de conversación", {
        error: error.message,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        phoneNumber,
        database: dbHistory,
        context: contextHistory,
        patterns,
        totalMessages: dbHistory.length,
      },
    });
  } catch (error) {
    logger.error("Error obteniendo historial de conversación", {
      error: error.message,
      phoneNumber: req.params.phoneNumber,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error obteniendo historial de conversación",
    });
  }
};

/**
 * Obtiene lista de clientes
 */
const getClients = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    // Esta funcionalidad requiere implementación en supabaseService
    // Por ahora devolvemos estructura básica
    const clients = [];

    res.status(200).json({
      success: true,
      data: {
        clients,
        total: clients.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    logger.error("Error obteniendo clientes", {
      error: error.message,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error obteniendo clientes",
    });
  }
};

/**
 * Obtiene detalles de cliente específico
 */
const getClientDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Implementar obtención de detalles de cliente
    const clientDetails = {
      id,
      message: "Funcionalidad en desarrollo",
    };

    res.status(200).json({
      success: true,
      data: clientDetails,
    });
  } catch (error) {
    logger.error("Error obteniendo detalles de cliente", {
      error: error.message,
      clientId: req.params.id,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error obteniendo detalles de cliente",
    });
  }
};

/**
 * Envía mensaje manual
 */
const sendManualMessage = async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Los campos "to" y "message" son requeridos',
      });
    }

    // Usar el controlador de WhatsApp para enviar mensaje
    const mockReq = {
      body: { to, message },
      ip: req.ip,
      get: (header) => req.get(header),
    };

    const mockRes = {
      status: (code) => ({
        json: (data) => {
          res.status(code).json(data);
        },
      }),
    };

    await whatsappController.sendMessage(mockReq, mockRes);

    logger.audit("manual_message_sent", req.ip, "whatsapp_message", {
      to,
      messageLength: message.length,
      ip: req.ip,
    });
  } catch (error) {
    logger.error("Error enviando mensaje manual", {
      error: error.message,
      to: req.body?.to,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error enviando mensaje manual",
    });
  }
};

/**
 * Obtiene eventos de Calendly recientes
 */
const getCalendlyEvents = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    // Esta funcionalidad requiere implementación específica
    const events = [];

    res.status(200).json({
      success: true,
      data: {
        events,
        total: events.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    logger.error("Error obteniendo eventos de Calendly", {
      error: error.message,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error obteniendo eventos de Calendly",
    });
  }
};

/**
 * Obtiene estadísticas de Calendly
 */
const getCalendlyStats = async (req, res) => {
  try {
    const stats = await supabaseService.getCalendlyStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error("Error obteniendo estadísticas de Calendly", {
      error: error.message,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error obteniendo estadísticas de Calendly",
    });
  }
};

/**
 * Obtiene estado de todos los servicios
 */
const getServicesStatus = async (req, res) => {
  try {
    const services = {
      timestamp: new Date().toISOString(),
      services: {},
    };

    // Estado de Supabase
    try {
      services.services.supabase = {
        status: (await supabaseService.testConnection())
          ? "healthy"
          : "unhealthy",
        configured: !!config.SUPABASE_URL && !!config.SUPABASE_ANON_KEY,
      };
    } catch (error) {
      services.services.supabase = {
        status: "error",
        error: error.message,
      };
    }

    // Estado de Twilio
    services.services.twilio = {
      status:
        config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN
          ? "configured"
          : "not_configured",
      configured: !!config.TWILIO_ACCOUNT_SID && !!config.TWILIO_AUTH_TOKEN,
    };

    // Estado de OpenAI
    services.services.openai = {
      status: config.OPENAI_API_KEY ? "configured" : "not_configured",
      configured: !!config.OPENAI_API_KEY,
    };

    // Estado de Calendly
    services.services.calendly = {
      status: config.CALENDLY_ACCESS_TOKEN ? "configured" : "not_configured",
      configured: !!config.CALENDLY_ACCESS_TOKEN,
    };

    res.status(200).json({
      success: true,
      data: services,
    });
  } catch (error) {
    logger.error("Error obteniendo estado de servicios", {
      error: error.message,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error obteniendo estado de servicios",
    });
  }
};

/**
 * Obtiene logs del sistema
 */
const getSystemLogs = async (req, res) => {
  try {
    const { level = "info", limit = 100 } = req.query;

    // Esta funcionalidad requiere implementación específica para leer logs
    const logs = {
      message: "Funcionalidad de logs en desarrollo",
      level,
      limit: parseInt(limit),
    };

    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    logger.error("Error obteniendo logs del sistema", {
      error: error.message,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error obteniendo logs del sistema",
    });
  }
};

/**
 * Obtiene métricas detalladas
 */
const getDetailedMetrics = async (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        version: process.version,
        platform: process.platform,
      },
      application: {
        name: config.APP_NAME,
        version: config.APP_VERSION,
        environment: config.NODE_ENV,
      },
    };

    // Agregar métricas de servicios
    try {
      metrics.services = {
        twilio: twilioService.getMetrics(),
        openai: openaiService.getStats(),
        context: contextService.getContextStats(),
      };
    } catch (error) {
      logger.warn("Error obteniendo métricas de servicios", {
        error: error.message,
      });
    }

    res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error("Error obteniendo métricas detalladas", {
      error: error.message,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error obteniendo métricas detalladas",
    });
  }
};

/**
 * Limpia contexto de conversación
 */
const clearConversationContext = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: "phoneNumber es requerido",
      });
    }

    await contextService.clearContext(phoneNumber);

    logger.audit("context_cleared", req.ip, "conversation_context", {
      phoneNumber,
      ip: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Contexto limpiado correctamente",
      phoneNumber,
    });
  } catch (error) {
    logger.error("Error limpiando contexto", {
      error: error.message,
      phoneNumber: req.body?.phoneNumber,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error limpiando contexto",
    });
  }
};

/**
 * Exporta contextos para backup
 */
const exportContexts = async (req, res) => {
  try {
    const { phoneNumber } = req.query;

    const exportData = await contextService.exportContext(phoneNumber || null);

    logger.audit("contexts_exported", req.ip, "conversation_contexts", {
      phoneNumber: phoneNumber || "all",
      contextCount: exportData.contexts.length,
      ip: req.ip,
    });

    res.status(200).json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    logger.error("Error exportando contextos", {
      error: error.message,
      phoneNumber: req.query?.phoneNumber,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error exportando contextos",
    });
  }
};

/**
 * Limpia caches del sistema
 */
const clearSystemCaches = async (req, res) => {
  try {
    const { cacheType = "all" } = req.body;

    const results = {};

    if (cacheType === "all" || cacheType === "openai") {
      openaiService.clearCache();
      results.openai = "cleared";
    }

    if (cacheType === "all" || cacheType === "context") {
      // El contexto se limpia automáticamente, pero podríamos forzar limpieza
      results.context = "cleaned";
    }

    logger.audit("caches_cleared", req.ip, "system_caches", {
      cacheType,
      results,
      ip: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Caches limpiados correctamente",
      results,
    });
  } catch (error) {
    logger.error("Error limpiando caches", {
      error: error.message,
      cacheType: req.body?.cacheType,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error limpiando caches",
    });
  }
};

/**
 * Obtiene estadísticas de base de datos
 */
const getDatabaseStats = async (req, res) => {
  try {
    const stats = await supabaseService.getDatabaseMetrics();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error("Error obteniendo estadísticas de base de datos", {
      error: error.message,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error obteniendo estadísticas de base de datos",
    });
  }
};

/**
 * Limpia datos antiguos (GDPR)
 */
const cleanupOldData = async (req, res) => {
  try {
    const { retentionDays = 365 } = req.body;

    const results = await supabaseService.cleanupOldData(
      parseInt(retentionDays)
    );

    logger.audit("data_cleanup_manual", req.ip, "old_data", {
      retentionDays: parseInt(retentionDays),
      results,
      ip: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Limpieza de datos completada",
      results,
    });
  } catch (error) {
    logger.error("Error en limpieza de datos", {
      error: error.message,
      retentionDays: req.body?.retentionDays,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error en limpieza de datos",
    });
  }
};

/**
 * Obtiene logs de auditoría
 */
const getAuditLogs = async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    // Esta funcionalidad requiere implementación específica
    const auditLogs = {
      message: "Funcionalidad de auditoría en desarrollo",
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    res.status(200).json({
      success: true,
      data: auditLogs,
    });
  } catch (error) {
    logger.error("Error obteniendo logs de auditoría", {
      error: error.message,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error obteniendo logs de auditoría",
    });
  }
};

/**
 * Obtiene reporte de seguridad
 */
const getSecurityReport = async (req, res) => {
  try {
    const report = {
      timestamp: new Date().toISOString(),
      security: {
        httpsEnabled: req.secure || req.get("X-Forwarded-Proto") === "https",
        environment: config.NODE_ENV,
        corsConfigured: !!config.ALLOWED_ORIGINS,
        jwtConfigured: !!config.JWT_SECRET,
        webhookValidation: {
          twilio: config.VALIDATE_TWILIO_SIGNATURE,
          calendly: config.VALIDATE_CALENDLY_SIGNATURE,
        },
      },
      recommendations: [],
    };

    // Generar recomendaciones
    if (config.NODE_ENV === "development") {
      report.recommendations.push("Cambiar a entorno de producción");
    }

    if (config.JWT_SECRET.includes("default")) {
      report.recommendations.push("Cambiar secretos JWT por defecto");
    }

    if (!config.VALIDATE_TWILIO_SIGNATURE) {
      report.recommendations.push("Habilitar validación de firma de Twilio");
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error("Error generando reporte de seguridad", {
      error: error.message,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error generando reporte de seguridad",
    });
  }
};

/**
 * Prueba webhook (solo desarrollo)
 */
const testWebhook = async (req, res) => {
  try {
    if (config.NODE_ENV !== "development") {
      return res.status(403).json({
        success: false,
        error: "Funcionalidad solo disponible en desarrollo",
      });
    }

    const { type, data } = req.body;

    logger.info("Webhook de prueba recibido", {
      type,
      data,
      ip: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Webhook de prueba procesado",
      received: { type, data },
    });
  } catch (error) {
    logger.error("Error procesando webhook de prueba", {
      error: error.message,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error procesando webhook de prueba",
    });
  }
};

/**
 * Obtiene configuración del sistema (sin secretos)
 */
const getSystemConfig = async (req, res) => {
  try {
    const configSummary = config.getSummary();

    res.status(200).json({
      success: true,
      data: configSummary,
    });
  } catch (error) {
    logger.error("Error obteniendo configuración del sistema", {
      error: error.message,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error obteniendo configuración del sistema",
    });
  }
};

/**
 * Valida configuración del sistema
 */
const validateConfig = async (req, res) => {
  try {
    const isValid = config.validate();

    res.status(200).json({
      success: true,
      data: {
        valid: isValid,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Error validando configuración", {
      error: error.message,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error validando configuración",
    });
  }
};

module.exports = {
  getSystemStats,
  getConversations,
  getConversationHistory,
  getClients,
  getClientDetails,
  sendManualMessage,
  getCalendlyEvents,
  getCalendlyStats,
  getServicesStatus,
  getSystemLogs,
  getDetailedMetrics,
  clearConversationContext,
  exportContexts,
  clearSystemCaches,
  getDatabaseStats,
  cleanupOldData,
  getAuditLogs,
  getSecurityReport,
  testWebhook,
  getSystemConfig,
  validateConfig,
};
