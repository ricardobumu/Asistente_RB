/**
 * ASISTENTE RB - SISTEMA AUTÓNOMO DE RESERVAS
 * Aplicación principal consolidada y optimizada
 *
 * Sistema autónomo de reservas con WhatsApp, Calendly y OpenAI
 * Arquitectura modular, segura y escalable
 * Cumple con RGPD y normativas europeas
 *
 * @author Ricardo Buriticá - Asistente RB Team
 * @version 2.1.0
 * @since 2024
 */

// ===== CARGA SEGURA DE VARIABLES DE ENTORNO =====
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

// ===== IMPORTACIONES PRINCIPALES =====
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const path = require("path");

// ===== CONFIGURACIÓN Y UTILIDADES =====
const {
  PORT,
  APP_NAME,
  APP_VERSION,
  NODE_ENV,
  ALLOWED_ORIGINS,
} = require("./config/env");
const logger = require("./utils/logger");

// ===== MIDDLEWARE DE SEGURIDAD AVANZADO =====
const SecurityMiddleware = require("./middleware/securityMiddleware");
const ErrorHandler = require("./middleware/errorHandler");

// ===== CLIENTES DE INTEGRACIÓN =====
const supabase = require("./integrations/supabaseClient");
const twilioClient = require("./integrations/twilioClient");
const calendlyClient = require("./integrations/calendlyClient");
const openaiClient = require("./integrations/openaiClient");
const googleCalendarClient = require("./integrations/googleCalendarClient");

// ===== RUTAS MODULARES =====
const apiRouter = require("./api");
const autonomousWhatsAppRoutes = require("./routes/autonomousWhatsAppRoutes");
const whatsappRoutes = require("./routes/whatsappRoutes");
const appointmentWidgetRoutes = require("./routes/appointmentWidgetRoutes");
const adminRoutes = require("./routes/adminRoutes");
const calendlyWebhookRoutes = require("./routes/calendlyWebhookRoutes");
const clientPortalRoutes = require("./routes/clientPortalRoutes");
const googleCalendarRoutes = require("./routes/googleCalendarRoutes");
const widgetRoutes = require("./routes/widgetRoutes");
const gdprRoutes = require("./routes/gdprRoutes");
const pipedreamTestRoutes = require("./routes/pipedreamTestRoutes");

// ===== SERVICIOS DE BACKGROUND =====
const notificationScheduler = require("./services/notificationScheduler");
const gdprCleanupWorker = require("./workers/gdprCleanupWorker");

// ===== INICIALIZACIÓN =====
ErrorHandler.initialize();
const app = express();

// Log de inicio de aplicación
logger.info(`🚀 Iniciando ${APP_NAME} v${APP_VERSION}`, {
  environment: NODE_ENV,
  port: PORT,
  timestamp: new Date().toISOString(),
  pid: process.pid,
});

// ===== CONFIGURACIÓN DE SEGURIDAD AVANZADA =====

// 1. Headers de seguridad con Helmet (configuración optimizada)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdn.tailwindcss.com",
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://api.openai.com",
          "https://api.calendly.com",
          "https://*.supabase.co",
        ],
        frameSrc: [
          "'self'",
          "https://ricardoburitica.eu",
          "https://www.ricardoburitica.eu",
        ],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// 2. Configuración CORS segura y optimizada
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = ALLOWED_ORIGINS.split(",").map((o) => o.trim());

    // Permitir requests sin origin (aplicaciones móviles, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes("*")) {
      callback(null, true);
    } else {
      logger.warn("CORS: Origen no permitido", { origin, allowedOrigins });
      callback(new Error("No permitido por CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-Hook-Signature",
    "X-Twilio-Signature",
    "X-API-Key",
  ],
  exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining"],
  maxAge: 86400, // 24 horas
};

app.use(cors(corsOptions));

// 3. Compresión de respuestas optimizada
app.use(
  compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
  })
);

// 4. Rate limiting global optimizado
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // máximo 1000 requests por ventana por IP
  message: {
    error: "Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.",
    retryAfter: "15 minutos",
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting para health checks y rutas de sistema
    return (
      req.path === "/health" ||
      req.path === "/" ||
      req.path.startsWith("/static")
    );
  },
});

app.use(globalLimiter);

// 5. Rate limiting específico para webhooks críticos
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // máximo 100 webhooks por minuto
  message: {
    error: "Demasiados webhooks recibidos, intenta más tarde.",
    retryAfter: "1 minuto",
    timestamp: new Date().toISOString(),
  },
});

// 6. Sanitización de datos avanzada
app.use(
  mongoSanitize({
    replaceWith: "_",
    onSanitize: ({ req, key }) => {
      logger.warn("Datos sanitizados detectados", {
        path: req.path,
        key,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        timestamp: new Date().toISOString(),
      });
    },
  })
);

// 7. Protección contra HTTP Parameter Pollution
app.use(
  hpp({
    whitelist: ["tags", "categories", "services"], // parámetros que pueden repetirse
  })
);

// 8. Rate limiting por endpoint usando SecurityMiddleware
const rateLimiters = SecurityMiddleware.rateLimiters();

// 9. Parseo de JSON con límites de seguridad avanzados
app.use(
  express.json({
    limit: "10mb", // Límite optimizado para webhooks y uploads
    verify: (req, res, buf, encoding) => {
      // Verificar contenido malicioso
      const body = buf.toString();
      if (body.includes("<script>") || body.includes("javascript:")) {
        const error = new Error("Contenido malicioso detectado");
        error.status = 400;
        throw error;
      }
    },
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
    parameterLimit: 1000, // Límite optimizado para formularios complejos
  })
);

// 10. Middleware de logging de requests optimizado
app.use((req, res, next) => {
  const startTime = Date.now();

  // Log de request entrante (solo información esencial)
  logger.info("Request recibido", {
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get("User-Agent"),
    contentType: req.get("Content-Type"),
    contentLength: req.get("Content-Length"),
    timestamp: new Date().toISOString(),
  });

  // Log de respuesta al finalizar
  res.on("finish", () => {
    const responseTime = Date.now() - startTime;

    // Log diferenciado por tipo de respuesta
    const logLevel = res.statusCode >= 400 ? "warn" : "info";
    logger[logLevel]("Response enviado", {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });
  });

  next();
});

// 11. Hacer los clientes disponibles globalmente en el objeto app
app.locals.supabase = supabase;
app.locals.twilioClient = twilioClient;
app.locals.calendlyClient = calendlyClient;
app.locals.openaiClient = openaiClient;
app.locals.googleCalendarClient = googleCalendarClient;

// ===== MONTAJE DE RUTAS CON SEGURIDAD PROFESIONAL =====

// 1. Webhooks críticos con rate limiting específico y validación de firmas
app.use(
  "/api/calendly",
  webhookLimiter,
  // Validación de firma de Calendly si está configurada
  (req, res, next) => {
    if (
      req.method === "POST" &&
      process.env.VALIDATE_CALENDLY_SIGNATURE === "true"
    ) {
      return SecurityMiddleware.validateCalendlySignature(req, res, next);
    }
    next();
  },
  calendlyWebhookRoutes
);

app.use(
  "/webhook/whatsapp",
  webhookLimiter,
  // Validación de firma de Twilio
  (req, res, next) => {
    if (
      req.method === "POST" &&
      process.env.VALIDATE_TWILIO_SIGNATURE === "true"
    ) {
      return SecurityMiddleware.validateTwilioSignature(req, res, next);
    }
    next();
  },
  whatsappRoutes
);

// 2. API general con rate limiting moderado
app.use("/api", rateLimiters.general, apiRouter);

// 3. API específica para servicios del portal cliente
const serviciosRouter = require("./api/servicios");
app.use("/api/servicios", rateLimiters.general, serviciosRouter);

// 4. WhatsApp autónomo con validación avanzada
app.use(
  "/autonomous/whatsapp",
  rateLimiters.whatsapp,
  autonomousWhatsAppRoutes
);

// 5. Rutas integradas de WhatsApp
app.use("/api/whatsapp", rateLimiters.general, whatsappRoutes);

// 6. Widget de reservas con rate limiting específico
app.use(
  "/api/widget",
  rateLimiters.widgetGeneral,
  // Rate limiting más estricto para creación de reservas
  (req, res, next) => {
    if (
      req.method === "POST" &&
      (req.path === "/appointments" || req.path === "/bookings")
    ) {
      return rateLimiters.widgetAppointment(req, res, next);
    }
    next();
  },
  appointmentWidgetRoutes
);

// 7. Dashboard administrativo con máxima seguridad
app.use("/admin", rateLimiters.admin, adminRoutes);

// 8. Portal del Cliente con rate limiting moderado
app.use("/client", rateLimiters.general, clientPortalRoutes);

// 9. Google Calendar con rate limiting específico
app.use("/api/google", rateLimiters.general, googleCalendarRoutes);

// 10. Widget público de reservas (con rate limiting básico)
app.use("/widget", rateLimiters.widgetGeneral, widgetRoutes);

// 11. RGPD y compliance (acceso público para derechos de usuarios)
app.use("/gdpr", rateLimiters.gdpr, gdprRoutes);

// 12. Pipedream Testing (solo para desarrollo y testing)
if (NODE_ENV === "development") {
  app.use("/api/pipedream/test", rateLimiters.general, pipedreamTestRoutes);
}

// ===== ARCHIVOS ESTÁTICOS CON SEGURIDAD =====

// Portal administrativo con cache optimizado
app.use(
  "/admin/static",
  express.static(path.join(__dirname, "../public/admin"), {
    maxAge: "1h",
    etag: true,
    setHeaders: (res, path) => {
      // Headers de seguridad adicionales para archivos estáticos
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
    },
  })
);

// Widget público con cache optimizado
app.use(
  "/widget/static",
  express.static(path.join(__dirname, "../public/widget"), {
    maxAge: "1h",
    etag: true,
    setHeaders: (res, path) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

// Portal cliente con cache optimizado
app.use(
  "/client/static",
  express.static(path.join(__dirname, "../public/client"), {
    maxAge: "1h",
    etag: true,
    setHeaders: (res, path) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

// Ruta alternativa para portal cliente
app.use(
  "/portal/static",
  express.static(path.join(__dirname, "../public/client"), {
    maxAge: "1h",
    etag: true,
  })
);

// ===== RUTAS DE SISTEMA =====

// Health check optimizado
app.get("/health", (req, res) => {
  const healthStatus = {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    version: APP_VERSION,
    services: {
      supabase: "connected",
      openai: process.env.OPENAI_API_KEY ? "configured" : "not configured",
      twilio: process.env.TWILIO_ACCOUNT_SID ? "configured" : "not configured",
      calendly: process.env.CALENDLY_ACCESS_TOKEN
        ? "configured"
        : "not configured",
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB",
    },
  };

  res.status(200).json(healthStatus);
});

// Ruta principal optimizada
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Asistente RB - Sistema Autónomo de Reservas",
    version: APP_VERSION,
    status: "online",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/health",
      calendly_webhook: "/api/calendly/webhook",
      whatsapp_webhook: "/webhook/whatsapp",
      admin: "/admin",
      client: "/client",
      widget: "/widget",
      api: "/api",
    },
  });
});

// Ruta de información de la API
app.get("/api", (req, res) => {
  res.status(200).json({
    api: "Asistente RB API",
    version: APP_VERSION,
    endpoints: [
      "/api/servicios",
      "/api/whatsapp",
      "/api/calendly",
      "/api/widget",
      "/api/google",
      "/api/gdpr",
    ],
    timestamp: new Date().toISOString(),
  });
});

// ===== MANEJO DE ERRORES PROFESIONAL =====

// Middleware para rutas no encontradas
app.use("*", (req, res) => {
  logger.warn("Ruta no encontrada", {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });

  res.status(404).json({
    success: false,
    error: "Ruta no encontrada",
    message: `La ruta ${req.method} ${req.originalUrl} no existe`,
    timestamp: new Date().toISOString(),
    availableEndpoints: {
      api: "/api",
      health: "/health",
      admin: "/admin",
      client: "/client",
      widget: "/widget",
    },
  });
});

// Middleware global de manejo de errores
app.use((error, req, res, next) => {
  // Log del error con información completa
  logger.error("Error no manejado", {
    error: error.message,
    stack: NODE_ENV === "development" ? error.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });

  // Determinar código de estado
  const statusCode = error.status || error.statusCode || 500;

  // Mensaje de error según el entorno
  const errorMessage =
    NODE_ENV === "production" ? "Error interno del servidor" : error.message;

  // Respuesta de error estructurada
  res.status(statusCode).json({
    success: false,
    error: errorMessage,
    timestamp: new Date().toISOString(),
    ...(NODE_ENV === "development" && {
      stack: error.stack,
      details: error.details || null,
    }),
  });
});

// ===== INICIALIZACIÓN DEL SERVIDOR =====

const serverPort = PORT || 3000;
const serverHost = "0.0.0.0";

const server = app.listen(serverPort, serverHost, async () => {
  logger.info("🚀 Servidor iniciado exitosamente", {
    port: serverPort,
    host: serverHost,
    environment: NODE_ENV,
    url: `http://localhost:${serverPort}`,
    pid: process.pid,
    timestamp: new Date().toISOString(),
  });

  // Inicializar servicios de background de forma segura
  try {
    await initializeBackgroundServices();
    logger.info("✅ Servicios de background inicializados correctamente");
  } catch (error) {
    logger.error("❌ Error inicializando servicios de background", {
      error: error.message,
    });
  }
});

// Función para inicializar servicios de background
async function initializeBackgroundServices() {
  const services = [];

  // Inicializar notification scheduler
  try {
    if (
      notificationScheduler &&
      typeof notificationScheduler.start === "function"
    ) {
      await notificationScheduler.start();
      services.push("📅 Notification Scheduler");
    }
  } catch (error) {
    logger.warn("⚠️ Notification scheduler no disponible", {
      error: error.message,
    });
  }

  // Inicializar GDPR cleanup worker
  try {
    if (gdprCleanupWorker && typeof gdprCleanupWorker.start === "function") {
      await gdprCleanupWorker.start();
      services.push("🔒 GDPR Cleanup Worker");
    }
  } catch (error) {
    logger.warn("⚠️ GDPR cleanup worker no disponible", {
      error: error.message,
    });
  }

  if (services.length > 0) {
    logger.info("Servicios de background activos:", { services });
  }
}

// Manejo de errores del servidor
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    logger.error(`❌ Puerto ${serverPort} ya está en uso`, {
      port: serverPort,
      error: error.message,
    });
    process.exit(1);
  } else {
    logger.error("❌ Error del servidor", {
      error: error.message,
      code: error.code,
    });
    process.exit(1);
  }
});

// ===== MANEJO GRACEFUL DE CIERRE =====

const gracefulShutdown = async (signal) => {
  logger.info(`📴 Señal ${signal} recibida, iniciando cierre graceful...`);

  // Detener servicios de background de forma segura
  const shutdownPromises = [];

  try {
    if (
      notificationScheduler &&
      typeof notificationScheduler.stop === "function"
    ) {
      shutdownPromises.push(
        Promise.resolve(notificationScheduler.stop()).catch((err) =>
          logger.warn("Error deteniendo notification scheduler", {
            error: err.message,
          })
        )
      );
    }
  } catch (error) {
    logger.warn("Error accediendo a notification scheduler", {
      error: error.message,
    });
  }

  try {
    if (gdprCleanupWorker && typeof gdprCleanupWorker.stop === "function") {
      shutdownPromises.push(
        Promise.resolve(gdprCleanupWorker.stop()).catch((err) =>
          logger.warn("Error deteniendo GDPR cleanup worker", {
            error: err.message,
          })
        )
      );
    }
  } catch (error) {
    logger.warn("Error accediendo a GDPR cleanup worker", {
      error: error.message,
    });
  }

  // Esperar a que todos los servicios se detengan
  try {
    await Promise.allSettled(shutdownPromises);
    logger.info("✅ Servicios de background detenidos");
  } catch (error) {
    logger.warn("⚠️ Algunos servicios no se pudieron detener correctamente", {
      error: error.message,
    });
  }

  // Cerrar servidor HTTP
  server.close(async () => {
    logger.info("🔒 Servidor HTTP cerrado");
    logger.info("👋 Aplicación cerrada correctamente");
    process.exit(0);
  });

  // Forzar cierre después de 30 segundos
  setTimeout(() => {
    logger.error("⚠️ Forzando cierre de la aplicación");
    process.exit(1);
  }, 30000);
};

// Manejo de señales del sistema
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Manejo de excepciones no capturadas
process.on("uncaughtException", (error) => {
  logger.error("💥 Excepción no capturada", {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("💥 Promesa rechazada no manejada", {
    reason: reason?.message || reason,
    promise: promise.toString(),
    timestamp: new Date().toISOString(),
  });
  process.exit(1);
});

module.exports = app;
