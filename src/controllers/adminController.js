// src/controllers/adminController.js
// Centro de Mando Interno - Dashboard Administrativo

const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");
const supabase = require("../integrations/supabaseClient");
const openaiClient = require("../integrations/openaiClient");
const twilioClient = require("../integrations/twilioClient");
const calendlyClient = require("../integrations/calendlyClient");

class AdminController {
  /**
   * Dashboard principal con métricas generales
   */
  static async getDashboard(req, res) {
    try {
      const startTime = Date.now();

      // Obtener métricas del sistema
      const systemHealth = await AdminController.getSystemHealth();
      const recentActivity = await AdminController.getRecentActivity();
      const todayStats = await AdminController.getTodayStats();
      const integrationStatus = await AdminController.getIntegrationStatus();

      const dashboard = {
        timestamp: new Date().toISOString(),
        systemHealth,
        recentActivity,
        todayStats,
        integrationStatus,
        responseTime: Date.now() - startTime,
      };

      logger.audit(
        "Dashboard accessed",
        req.user?.email || "admin",
        "dashboard",
        {
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        },
      );

      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      logger.error("Error loading dashboard", error, {
        ip: req.ip,
        user: req.user?.email,
      });

      res.status(500).json({
        success: false,
        error: "Failed to load dashboard",
        message: error.message,
      });
    }
  }

  /**
   * 🔍 LOGS DEL SISTEMA
   */
  static async getSystemLogs(req, res) {
    try {
      const {
        type = "app",
        level = "all",
        limit = 100,
        search = "",
        startDate,
        endDate,
      } = req.query;

      const logs = await AdminController.readLogFile(type, {
        level,
        limit: parseInt(limit),
        search,
        startDate,
        endDate,
      });

      logger.audit("System logs accessed", req.user?.email || "admin", "logs", {
        type,
        level,
        limit,
        search: search ? "[FILTERED]" : "none",
      });

      res.json({
        success: true,
        data: {
          logs,
          type,
          level,
          total: logs.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Error reading system logs", error);
      res.status(500).json({
        success: false,
        error: "Failed to read logs",
      });
    }
  }

  /**
   * 📞 MENSAJES DEL BOT
   */
  static async getBotMessages(req, res) {
    try {
      const {
        limit = 50,
        phone = "",
        status = "all",
        startDate,
        endDate,
      } = req.query;

      // Obtener mensajes de WhatsApp desde la base de datos
      let query = supabase
        .from("whatsapp_messages")
        .select(
          `
          *,
          whatsapp_conversations(phone_number, client_name)
        `,
        )
        .order("created_at", { ascending: false })
        .limit(parseInt(limit));

      if (phone) {
        query = query.ilike("phone_number", `%${phone}%`);
      }

      if (status !== "all") {
        query = query.eq("status", status);
      }

      if (startDate) {
        query = query.gte("created_at", startDate);
      }

      if (endDate) {
        query = query.lte("created_at", endDate);
      }

      const { data: messages, error } = await query;

      if (error) throw error;

      // Obtener estadísticas de mensajes
      const stats = await AdminController.getMessageStats();

      logger.audit(
        "Bot messages accessed",
        req.user?.email || "admin",
        "messages",
        {
          limit,
          phone: phone ? "[FILTERED]" : "all",
          status,
        },
      );

      res.json({
        success: true,
        data: {
          messages: messages || [],
          stats,
          filters: { limit, phone, status, startDate, endDate },
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Error getting bot messages", error);
      res.status(500).json({
        success: false,
        error: "Failed to get messages",
      });
    }
  }

  /**
   * 📅 RESERVAS (CALENDLY)
   */
  static async getBookings(req, res) {
    try {
      const { status = "all", limit = 50, startDate, endDate } = req.query;

      // Obtener reservas desde la base de datos
      let query = supabase
        .from("bookings")
        .select("*")
        .order("scheduled_at", { ascending: false })
        .limit(parseInt(limit));

      if (status !== "all") {
        query = query.eq("status", status);
      }

      if (startDate) {
        query = query.gte("scheduled_at", startDate);
      }

      if (endDate) {
        query = query.lte("scheduled_at", endDate);
      }

      const { data: bookings, error } = await query;

      if (error) throw error;

      // Obtener estadísticas de reservas
      const bookingStats = await AdminController.getBookingStats();

      // Obtener próximas citas desde Calendly
      const upcomingEvents = await AdminController.getCalendlyEvents();

      logger.audit(
        "Bookings accessed",
        req.user?.email || "admin",
        "bookings",
        {
          status,
          limit,
        },
      );

      res.json({
        success: true,
        data: {
          bookings: bookings || [],
          stats: bookingStats,
          upcomingEvents,
          filters: { status, limit, startDate, endDate },
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Error getting bookings", error);
      res.status(500).json({
        success: false,
        error: "Failed to get bookings",
      });
    }
  }

  /**
   * 🧠 ESTADO OPENAI
   */
  static async getOpenAIStatus(req, res) {
    try {
      const { limit = 50 } = req.query;

      // Obtener logs de OpenAI
      const openaiLogs = await AdminController.readLogFile("app", {
        search: "openai",
        limit: parseInt(limit),
      });

      // Obtener estadísticas de uso
      const openaiStats = await AdminController.getOpenAIStats();

      // Test de conectividad
      const connectivityTest = await AdminController.testOpenAIConnectivity();

      logger.audit(
        "OpenAI status accessed",
        req.user?.email || "admin",
        "openai",
      );

      res.json({
        success: true,
        data: {
          logs: openaiLogs,
          stats: openaiStats,
          connectivity: connectivityTest,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Error getting OpenAI status", error);
      res.status(500).json({
        success: false,
        error: "Failed to get OpenAI status",
      });
    }
  }

  /**
   * 📦 TWILIO WHATSAPP
   */
  static async getTwilioStatus(req, res) {
    try {
      const { limit = 50 } = req.query;

      // Obtener logs de Twilio
      const twilioLogs = await AdminController.readLogFile("whatsapp", {
        limit: parseInt(limit),
      });

      // Obtener estadísticas de Twilio
      const twilioStats = await AdminController.getTwilioStats();

      // Test de conectividad
      const connectivityTest = await AdminController.testTwilioConnectivity();

      logger.audit(
        "Twilio status accessed",
        req.user?.email || "admin",
        "twilio",
      );

      res.json({
        success: true,
        data: {
          logs: twilioLogs,
          stats: twilioStats,
          connectivity: connectivityTest,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Error getting Twilio status", error);
      res.status(500).json({
        success: false,
        error: "Failed to get Twilio status",
      });
    }
  }

  /**
   * 👤 USUARIOS Y ACTIVIDAD
   */
  static async getUserActivity(req, res) {
    try {
      const { limit = 50, phone = "" } = req.query;

      // Obtener conversaciones activas
      let query = supabase
        .from("whatsapp_conversations")
        .select(
          `
          *,
          whatsapp_messages(count),
          bookings(count)
        `,
        )
        .order("last_activity", { ascending: false })
        .limit(parseInt(limit));

      if (phone) {
        query = query.ilike("phone_number", `%${phone}%`);
      }

      const { data: users, error } = await query;

      if (error) throw error;

      // Obtener estadísticas de usuarios
      const userStats = await AdminController.getUserStats();

      logger.audit(
        "User activity accessed",
        req.user?.email || "admin",
        "users",
        {
          limit,
          phone: phone ? "[FILTERED]" : "all",
        },
      );

      res.json({
        success: true,
        data: {
          users: users || [],
          stats: userStats,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Error getting user activity", error);
      res.status(500).json({
        success: false,
        error: "Failed to get user activity",
      });
    }
  }

  /**
   * 🔐 SEGURIDAD
   */
  static async getSecurityStatus(req, res) {
    try {
      const { limit = 50 } = req.query;

      // Obtener logs de seguridad
      const securityLogs = await AdminController.readLogFile("security", {
        limit: parseInt(limit),
      });

      // Obtener estadísticas de seguridad
      const securityStats = await AdminController.getSecurityStats();

      // Obtener sesiones activas (si las hay)
      const activeSessions = await AdminController.getActiveSessions();

      logger.audit(
        "Security status accessed",
        req.user?.email || "admin",
        "security",
      );

      res.json({
        success: true,
        data: {
          logs: securityLogs,
          stats: securityStats,
          activeSessions,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Error getting security status", error);
      res.status(500).json({
        success: false,
        error: "Failed to get security status",
      });
    }
  }

  /**
   * 🌐 SALUD DEL SISTEMA
   */
  static async getSystemHealth(req, res) {
    try {
      const health = await AdminController.getSystemHealth();

      if (req && res) {
        logger.audit(
          "System health accessed",
          req.user?.email || "admin",
          "health",
        );

        res.json({
          success: true,
          data: health,
        });
      }

      return health;
    } catch (error) {
      logger.error("Error getting system health", error);

      if (req && res) {
        res.status(500).json({
          success: false,
          error: "Failed to get system health",
        });
      }

      return null;
    }
  }

  // ===== MÉTODOS AUXILIARES =====

  /**
   * Leer archivo de log con filtros
   */
  static async readLogFile(type, options = {}) {
    try {
      const logDir = path.join(process.cwd(), "logs");
      const logFile = path.join(logDir, `${type}.log`);

      if (!fs.existsSync(logFile)) {
        return [];
      }

      const content = fs.readFileSync(logFile, "utf8");
      const lines = content.split("\n").filter((line) => line.trim());

      let logs = lines
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return { message: line, timestamp: new Date().toISOString() };
          }
        })
        .reverse(); // Más recientes primero

      // Aplicar filtros
      if (options.level && options.level !== "all") {
        logs = logs.filter((log) => log.level === options.level.toUpperCase());
      }

      if (options.search) {
        logs = logs.filter((log) =>
          JSON.stringify(log)
            .toLowerCase()
            .includes(options.search.toLowerCase()),
        );
      }

      if (options.startDate) {
        logs = logs.filter(
          (log) => new Date(log.timestamp) >= new Date(options.startDate),
        );
      }

      if (options.endDate) {
        logs = logs.filter(
          (log) => new Date(log.timestamp) <= new Date(options.endDate),
        );
      }

      return logs.slice(0, options.limit || 100);
    } catch (error) {
      logger.error("Error reading log file", error, { type, options });
      return [];
    }
  }

  /**
   * Obtener salud del sistema
   */
  static async getSystemHealth() {
    const uptime = process.uptime();
    const memory = process.memoryUsage();

    return {
      status: "healthy",
      uptime: {
        seconds: uptime,
        formatted: AdminController.formatUptime(uptime),
      },
      memory: {
        used: Math.round(memory.heapUsed / 1024 / 1024),
        total: Math.round(memory.heapTotal / 1024 / 1024),
        external: Math.round(memory.external / 1024 / 1024),
        rss: Math.round(memory.rss / 1024 / 1024),
      },
      cpu: {
        usage: process.cpuUsage(),
      },
      environment: process.env.NODE_ENV || "development",
      version: process.env.APP_VERSION || "1.0.0",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Obtener actividad reciente
   */
  static async getRecentActivity() {
    try {
      const { data: recentMessages } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: recentBookings } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      return {
        messages: recentMessages || [],
        bookings: recentBookings || [],
      };
    } catch (error) {
      logger.error("Error getting recent activity", error);
      return { messages: [], bookings: [] };
    }
  }

  /**
   * Obtener estadísticas del día
   */
  static async getTodayStats() {
    try {
      const today = new Date().toISOString().split("T")[0];

      const { data: todayMessages } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);

      const { data: todayBookings } = await supabase
        .from("bookings")
        .select("*")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);

      return {
        messages: todayMessages?.length || 0,
        bookings: todayBookings?.length || 0,
        date: today,
      };
    } catch (error) {
      logger.error("Error getting today stats", error);
      return {
        messages: 0,
        bookings: 0,
        date: new Date().toISOString().split("T")[0],
      };
    }
  }

  /**
   * Obtener estado de integraciones
   */
  static async getIntegrationStatus() {
    const integrations = {
      openai: { status: "unknown", lastCheck: null },
      twilio: { status: "unknown", lastCheck: null },
      calendly: { status: "unknown", lastCheck: null },
      supabase: { status: "unknown", lastCheck: null },
    };

    // Test OpenAI
    try {
      await AdminController.testOpenAIConnectivity();
      integrations.openai = {
        status: "healthy",
        lastCheck: new Date().toISOString(),
      };
    } catch {
      integrations.openai = {
        status: "error",
        lastCheck: new Date().toISOString(),
      };
    }

    // Test Twilio
    try {
      await AdminController.testTwilioConnectivity();
      integrations.twilio = {
        status: "healthy",
        lastCheck: new Date().toISOString(),
      };
    } catch {
      integrations.twilio = {
        status: "error",
        lastCheck: new Date().toISOString(),
      };
    }

    // Test Supabase
    try {
      const { data } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .limit(1);
      integrations.supabase = {
        status: "healthy",
        lastCheck: new Date().toISOString(),
      };
    } catch {
      integrations.supabase = {
        status: "error",
        lastCheck: new Date().toISOString(),
      };
    }

    return integrations;
  }

  /**
   * Test de conectividad OpenAI
   */
  static async testOpenAIConnectivity() {
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [{ role: "user", content: "Test connectivity" }],
      max_tokens: 5,
    });

    return {
      status: "healthy",
      model: response.model,
      usage: response.usage,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Test de conectividad Twilio
   */
  static async testTwilioConnectivity() {
    const account = await twilioClient.api
      .accounts(process.env.TWILIO_ACCOUNT_SID)
      .fetch();

    return {
      status: "healthy",
      accountSid: account.sid,
      accountStatus: account.status,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Formatear uptime
   */
  static formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    return `${days}d ${hours}h ${minutes}m`;
  }

  // Métodos adicionales para estadísticas específicas...
  static async getMessageStats() {
    // Implementar estadísticas de mensajes
    return { sent: 0, received: 0, errors: 0 };
  }

  static async getBookingStats() {
    // Implementar estadísticas de reservas
    return { confirmed: 0, pending: 0, cancelled: 0 };
  }

  static async getOpenAIStats() {
    // Implementar estadísticas de OpenAI
    return { requests: 0, tokens: 0, errors: 0 };
  }

  static async getTwilioStats() {
    // Implementar estadísticas de Twilio
    return { sent: 0, delivered: 0, failed: 0 };
  }

  static async getUserStats() {
    // Implementar estadísticas de usuarios
    return { active: 0, new: 0, returning: 0 };
  }

  static async getSecurityStats() {
    // Implementar estadísticas de seguridad
    return { blocked: 0, warnings: 0, threats: 0 };
  }

  static async getActiveSessions() {
    // Implementar sesiones activas
    return [];
  }

  static async getCalendlyEvents() {
    // Implementar eventos de Calendly
    return [];
  }
}

module.exports = AdminController;
