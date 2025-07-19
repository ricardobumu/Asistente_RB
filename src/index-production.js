/**
 * ASISTENTE RB - SERVIDOR DE PRODUCCIÓN OPTIMIZADO
 *
 * Versión optimizada para Railway con:
 * - Inicialización más rápida
 * - Manejo de errores robusto
 * - Configuración de producción
 * - Health checks optimizados
 * - Graceful shutdown mejorado
 *
 * @author Ricardo Buriticá - Asistente RB Team
 * @version 2.1.0-production
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

// ===== MIDDLEWARE DE SEGURIDAD =====
const SecurityMiddleware = require("./middleware/securityMiddleware");
const ErrorHandler = require("./middleware/errorHandler");

// ===== INICIALIZACIÓN RÁPIDA =====
ErrorHandler.initialize();
const app = express();

// Log de inicio optimizado
logger.info(`🚀 ${APP_NAME} v${APP_VERSION} iniciando...`, {
  environment: NODE_ENV,
  port: PORT,
  timestamp: new Date().toISOString(),
  pid: process.pid,
});

// ===== CONFIGURACIÓN DE SEGURIDAD OPTIMIZADA PARA PRODUCCIÓN =====

// 1. Headers de seguridad con Helmet (configuración de producción)
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
          "https://bot.ricardoburitica.eu",
          "https://ricardoburitica.eu",
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

// 2. CORS optimizado para producción
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = ALLOWED_ORIGINS.split(",").map((o) => o.trim());

    // En producción, ser más estricto con los orígenes
    if (NODE_ENV === "production" && !origin) {
      return callback(new Error("Origen requerido en producción"));
    }

    if (
      !origin ||
      allowedOrigins.indexOf(origin) !== -1 ||
      allowedOrigins.includes("*")
    ) {
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
  maxAge: 86400,
};

app.use(cors(corsOptions));

// 3. Compresión optimizada
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

// 4. Rate limiting global para producción
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: NODE_ENV === "production" ? 500 : 1000, // Más restrictivo en producción
  message: {
    error: "Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.",
    retryAfter: "15 minutos",
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return (
      req.path === "/health" ||
      req.path === "/" ||
      req.path.startsWith("/static")
    );
  },
});

app.use(globalLimiter);

// 5. Rate limiting para webhooks críticos
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: NODE_ENV === "production" ? 50 : 100, // Más restrictivo en producción
  message: {
    error: "Demasiados webhooks recibidos, intenta más tarde.",
    retryAfter: "1 minuto",
    timestamp: new Date().toISOString(),
  },
});

// 6. Sanitización de datos
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

// 7. Protección HPP
app.use(
  hpp({
    whitelist: ["tags", "categories", "services"],
  })
);

// 8. Parseo de JSON con límites de seguridad
app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf, encoding) => {
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
    parameterLimit: 1000,
  })
);

// 9. Logging optimizado para producción
app.use((req, res, next) => {
  const startTime = Date.now();

  // Log solo información esencial en producción
  if (NODE_ENV === "development" || req.path.includes("/webhook")) {
    logger.info("Request recibido", {
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      timestamp: new Date().toISOString(),
    });
  }

  res.on("finish", () => {
    const responseTime = Date.now() - startTime;

    // Log diferenciado por tipo de respuesta
    if (res.statusCode >= 400 || NODE_ENV === "development") {
      const logLevel = res.statusCode >= 400 ? "warn" : "info";
      logger[logLevel]("Response enviado", {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });
    }
  });

  next();
});

// ===== INICIALIZACIÓN DE CLIENTES DE INTEGRACIÓN =====
let supabase, twilioClient, calendlyClient, openaiClient, googleCalendarClient;

try {
  supabase = require("./integrations/supabaseClient");
  app.locals.supabase = supabase;
  logger.info("✅ Supabase client inicializado");
} catch (error) {
  logger.error("❌ Error inicializando Supabase client", {
    error: error.message,
  });
}

try {
  twilioClient = require("./integrations/twilioClient");
  app.locals.twilioClient = twilioClient;
  logger.info("✅ Twilio client inicializado");
} catch (error) {
  logger.warn("⚠️ Twilio client no disponible", { error: error.message });
}

try {
  calendlyClient = require("./integrations/calendlyClient");
  app.locals.calendlyClient = calendlyClient;
  logger.info("✅ Calendly client inicializado");
} catch (error) {
  logger.warn("⚠️ Calendly client no disponible", { error: error.message });
}

try {
  openaiClient = require("./integrations/openaiClient");
  app.locals.openaiClient = openaiClient;
  logger.info("✅ OpenAI client inicializado");
} catch (error) {
  logger.warn("⚠️ OpenAI client no disponible", { error: error.message });
}

try {
  googleCalendarClient = require("./integrations/googleCalendarClient");
  app.locals.googleCalendarClient = googleCalendarClient;
  logger.info("✅ Google Calendar client inicializado");
} catch (error) {
  logger.warn("⚠️ Google Calendar client no disponible", {
    error: error.message,
  });
}

// ===== CONFIGURACIÓN DE RATE LIMITERS =====
const rateLimiters = SecurityMiddleware.rateLimiters();

// ===== MONTAJE DE RUTAS PRINCIPALES =====

// 1. Health check optimizado para Railway
app.get("/health", (req, res) => {
  const healthStatus = {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    version: APP_VERSION,
    services: {
      supabase: supabase ? "connected" : "disconnected",
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

// 2. Ruta principal
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Asistente RB - Sistema Autónomo de Reservas",
    version: APP_VERSION,
    status: "online",
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
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

// ===== CARGA DINÁMICA DE RUTAS =====
const loadRoutes = () => {
  try {
    // Webhooks críticos con validación de firmas
    const calendlyWebhookRoutes = require("./routes/calendlyWebhookRoutes");
    app.use(
      "/api/calendly",
      webhookLimiter,
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
    logger.info("✅ Calendly webhook routes cargadas");

    const whatsappRoutes = require("./routes/whatsappRoutes");
    app.use(
      "/webhook/whatsapp",
      webhookLimiter,
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
    logger.info("✅ WhatsApp webhook routes cargadas");

    // API general
    const apiRouter = require("./api");
    app.use("/api", rateLimiters.general, apiRouter);
    logger.info("✅ API routes cargadas");

    // Servicios específicos
    const serviciosRouter = require("./api/servicios");
    app.use("/api/servicios", rateLimiters.general, serviciosRouter);
    logger.info("✅ Servicios routes cargadas");

    // WhatsApp autónomo
    const autonomousWhatsAppRoutes = require("./routes/autonomousWhatsAppRoutes");
    app.use(
      "/autonomous/whatsapp",
      rateLimiters.whatsapp,
      autonomousWhatsAppRoutes
    );
    logger.info("✅ Autonomous WhatsApp routes cargadas");

    // Widget de reservas
    const appointmentWidgetRoutes = require("./routes/appointmentWidgetRoutes");
    app.use("/api/widget", rateLimiters.widgetGeneral, appointmentWidgetRoutes);
    logger.info("✅ Widget routes cargadas");

    // Dashboard administrativo
    const adminRoutes = require("./routes/adminRoutes");
    app.use("/admin", rateLimiters.admin, adminRoutes);
    logger.info("✅ Admin routes cargadas");

    // Portal del cliente
    const clientPortalRoutes = require("./routes/clientPortalRoutes");
    app.use("/client", rateLimiters.general, clientPortalRoutes);
    logger.info("✅ Client portal routes cargadas");

    // Widget público
    const widgetRoutes = require("./routes/widgetRoutes");
    app.use("/widget", rateLimiters.widgetGeneral, widgetRoutes);
    logger.info("✅ Public widget routes cargadas");

    // GDPR
    const gdprRoutes = require("./routes/gdprRoutes");
    app.use("/gdpr", rateLimiters.gdpr, gdprRoutes);
    logger.info("✅ GDPR routes cargadas");

    // Google Calendar (opcional)
    try {
      const googleCalendarRoutes = require("./routes/googleCalendarRoutes");
      app.use("/api/google", rateLimiters.general, googleCalendarRoutes);
      logger.info("✅ Google Calendar routes cargadas");
    } catch (error) {
      logger.warn("⚠️ Google Calendar routes no disponibles", {
        error: error.message,
      });
    }

    // Pipedream Testing (solo desarrollo)
    if (NODE_ENV === "development") {
      try {
        const pipedreamTestRoutes = require("./routes/pipedreamTestRoutes");
        app.use(
          "/api/pipedream/test",
          rateLimiters.general,
          pipedreamTestRoutes
        );
        logger.info("✅ Pipedream test routes cargadas (desarrollo)");
      } catch (error) {
        logger.warn("⚠️ Pipedream test routes no disponibles", {
          error: error.message,
        });
      }
    }
  } catch (error) {
    logger.error("❌ Error cargando rutas", { error: error.message });
    throw error;
  }
};

// Cargar rutas
loadRoutes();

// ===== ARCHIVOS ESTÁTICOS =====
app.use(
  "/admin/static",
  express.static(path.join(__dirname, "../public/admin"), {
    maxAge: "1h",
    etag: true,
    setHeaders: (res, path) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
    },
  })
);

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

// ===== MANEJO DE ERRORES =====

// Rutas no encontradas
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

// Manejo global de errores
app.use((error, req, res, next) => {
  logger.error("Error no manejado", {
    error: error.message,
    stack: NODE_ENV === "development" ? error.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });

  const statusCode = error.status || error.statusCode || 500;
  const errorMessage =
    NODE_ENV === "production" ? "Error interno del servidor" : error.message;

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
    url:
      NODE_ENV === "production"
        ? "https://bot.ricardoburitica.eu"
        : `http://localhost:${serverPort}`,
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

// ===== INICIALIZACIÓN DE SERVICIOS DE BACKGROUND =====
async function initializeBackgroundServices() {
  const services = [];

  // Notification scheduler
  try {
    const notificationScheduler = require("./services/notificationScheduler");
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

  // GDPR cleanup worker
  try {
    const gdprCleanupWorker = require("./workers/gdprCleanupWorker");
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

// ===== MANEJO DE ERRORES DEL SERVIDOR =====
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

// ===== GRACEFUL SHUTDOWN OPTIMIZADO =====
const gracefulShutdown = async (signal) => {
  logger.info(`📴 Señal ${signal} recibida, iniciando cierre graceful...`);

  // Detener servicios de background
  const shutdownPromises = [];

  try {
    const notificationScheduler = require("./services/notificationScheduler");
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
    // Servicio no disponible
  }

  try {
    const gdprCleanupWorker = require("./workers/gdprCleanupWorker");
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
    // Servicio no disponible
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
