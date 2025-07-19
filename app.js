/**
 * ASISTENTE RB - APLICACIÓN PRINCIPAL
 * Sistema autónomo de reservas con WhatsApp, Calendly y OpenAI
 *
 * Arquitectura modular, segura y escalable
 * Cumple con RGPD y normativas europeas
 *
 * @author Asistente RB Team
 * @version 2.0.0
 */

// Cargar variables de entorno de forma segura
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");

// Importar configuración y utilidades
const config = require("./config/environment");
const logger = require("./utils/logger");
const { formatPhoneNumber } = require("./utils/phoneNumberFormatter");

// Importar rutas modulares
const calendlyRoutes = require("./routes/calendlyRoutes");
const whatsappRoutes = require("./routes/whatsappRoutes");
const adminRoutes = require("./routes/adminRoutes");
const clientRoutes = require("./routes/clientRoutes");

// Importar servicios
const supabaseService = require("./services/supabaseService");
const contextService = require("./services/contextService");

// Inicializar aplicación Express
const app = express();

// ===== CONFIGURACIÓN DE SEGURIDAD AVANZADA =====

// Headers de seguridad con Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://api.openai.com",
          "https://*.supabase.co",
        ],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Configuración CORS segura
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = config.ALLOWED_ORIGINS.split(",").map((o) =>
      o.trim()
    );

    // Permitir requests sin origin (aplicaciones móviles, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes("*")) {
      callback(null, true);
    } else {
      logger.warn("CORS: Origen no permitido", { origin });
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
  ],
  maxAge: 86400, // 24 horas
};

app.use(cors(corsOptions));

// Compresión de respuestas
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

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // máximo 1000 requests por ventana por IP
  message: {
    error: "Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.",
    retryAfter: "15 minutos",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting para health checks
    return req.path === "/health" || req.path === "/";
  },
});

app.use(globalLimiter);

// Rate limiting específico para webhooks
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // máximo 100 webhooks por minuto
  message: {
    error: "Demasiados webhooks recibidos, intenta más tarde.",
    retryAfter: "1 minuto",
  },
});

// Sanitización de datos
app.use(
  mongoSanitize({
    replaceWith: "_",
    onSanitize: ({ req, key }) => {
      logger.warn("Datos sanitizados detectados", {
        path: req.path,
        key,
        ip: req.ip,
      });
    },
  })
);

// Protección contra HTTP Parameter Pollution
app.use(
  hpp({
    whitelist: ["tags", "categories"], // parámetros que pueden repetirse
  })
);

// Parseo de JSON con límites de seguridad
app.use(
  express.json({
    limit: "10mb",
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
    parameterLimit: 1000,
  })
);

// Middleware de logging de requests
app.use((req, res, next) => {
  const startTime = Date.now();

  // Log de request entrante
  logger.info("Request recibido", {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    contentType: req.get("Content-Type"),
    contentLength: req.get("Content-Length"),
    timestamp: new Date().toISOString(),
  });

  // Log de respuesta al finalizar
  res.on("finish", () => {
    const responseTime = Date.now() - startTime;
    logger.info("Response enviado", {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip,
    });
  });

  next();
});

// ===== MONTAJE DE RUTAS =====

// Rutas de webhooks con rate limiting específico
app.use("/api/calendly", webhookLimiter, calendlyRoutes);
app.use("/webhook/whatsapp", webhookLimiter, whatsappRoutes);

// Rutas administrativas con autenticación
app.use("/admin", adminRoutes);

// Rutas del portal cliente
app.use("/client", clientRoutes);

// ===== RUTAS DE SISTEMA =====

// Health check
app.get("/health", (req, res) => {
  const healthStatus = {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.NODE_ENV,
    version: config.APP_VERSION,
    services: {
      supabase: "connected",
      openai: config.OPENAI_API_KEY ? "configured" : "not configured",
      twilio: config.TWILIO_ACCOUNT_SID ? "configured" : "not configured",
      calendly: config.CALENDLY_ACCESS_TOKEN ? "configured" : "not configured",
    },
  };

  res.status(200).json(healthStatus);
});

// Ruta principal
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Asistente RB - Sistema Autónomo de Reservas",
    version: config.APP_VERSION,
    status: "online",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/health",
      calendly_webhook: "/api/calendly/webhook",
      whatsapp_webhook: "/webhook/whatsapp",
      admin: "/admin",
      client: "/client",
    },
  });
});

// ===== ARCHIVOS ESTÁTICOS =====

const path = require("path");

// Portal administrativo
app.use(
  "/admin/static",
  express.static(path.join(__dirname, "public/admin"), {
    maxAge: "1h",
    etag: true,
  })
);

// Portal cliente
app.use(
  "/client/static",
  express.static(path.join(__dirname, "public/client"), {
    maxAge: "1h",
    etag: true,
  })
);

// Widget de reservas
app.use(
  "/widget/static",
  express.static(path.join(__dirname, "public/widget"), {
    maxAge: "1h",
    etag: true,
  })
);

// ===== MANEJO DE ERRORES =====

// Middleware para rutas no encontradas
app.use("*", (req, res) => {
  logger.warn("Ruta no encontrada", {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    error: "Ruta no encontrada",
    timestamp: new Date().toISOString(),
  });
});

// Middleware global de manejo de errores
app.use((error, req, res, next) => {
  // Log del error
  logger.error("Error no manejado", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  // Respuesta de error
  const statusCode = error.status || error.statusCode || 500;
  const errorMessage =
    config.NODE_ENV === "production"
      ? "Error interno del servidor"
      : error.message;

  res.status(statusCode).json({
    success: false,
    error: errorMessage,
    timestamp: new Date().toISOString(),
    ...(config.NODE_ENV !== "production" && { stack: error.stack }),
  });
});

// ===== INICIALIZACIÓN DEL SERVIDOR =====

const PORT = config.PORT || 3000;
const HOST = "0.0.0.0";

const server = app.listen(PORT, HOST, async () => {
  logger.info("🚀 Servidor iniciado exitosamente", {
    port: PORT,
    host: HOST,
    environment: config.NODE_ENV,
    url: `http://localhost:${PORT}`,
    pid: process.pid,
  });

  // Inicializar servicios
  try {
    await supabaseService.initialize();
    logger.info("✅ Supabase inicializado correctamente");
  } catch (error) {
    logger.error("❌ Error inicializando Supabase", { error: error.message });
  }

  try {
    await contextService.initialize();
    logger.info("✅ Servicio de contexto inicializado");
  } catch (error) {
    logger.error("❌ Error inicializando servicio de contexto", {
      error: error.message,
    });
  }
});

// Manejo de errores del servidor
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    logger.error(`❌ Puerto ${PORT} ya está en uso`, { port: PORT });
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

const gracefulShutdown = (signal) => {
  logger.info(`📴 Señal ${signal} recibida, iniciando cierre graceful...`);

  server.close(async () => {
    logger.info("🔒 Servidor HTTP cerrado");

    try {
      // Cerrar conexiones de servicios
      await supabaseService.close();
      await contextService.close();
      logger.info("✅ Servicios cerrados correctamente");
    } catch (error) {
      logger.error("❌ Error cerrando servicios", { error: error.message });
    }

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
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("💥 Promesa rechazada no manejada", {
    reason: reason?.message || reason,
    promise: promise.toString(),
  });
  process.exit(1);
});

module.exports = app;
