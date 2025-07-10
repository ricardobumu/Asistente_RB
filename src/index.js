// src/index.js
// Cargar variables de entorno de forma segura
require("dotenv").config({ path: ".env" }); // Configuración base
require("dotenv").config({ path: ".env.local", override: true }); // Secretos locales (override)

const express = require("express");
const { PORT, APP_NAME, APP_VERSION, NODE_ENV } = require("./config/env");
const logger = require("./utils/logger");

// Importar middleware de seguridad avanzado
const SecurityMiddleware = require("./middleware/securityMiddleware");
const ErrorHandler = require("./middleware/errorHandler");

// Importar middleware existente como fallback
const {
  rateLimitMiddleware,
  sanitizeMiddleware,
} = require("./middleware/auditMiddleware");

// Importar clientes de integración
const supabase = require("./integrations/supabaseClient");
const twilioClient = require("./integrations/twilioClient");
const calendlyClient = require("./integrations/calendlyClient");
const openaiClient = require("./integrations/openaiClient");
const googleCalendarClient = require("./integrations/googleCalendarClient");

// Importar API router
const apiRouter = require("./api");

// Importar rutas del asistente autónomo
const autonomousWhatsAppRoutes = require("./routes/autonomousWhatsAppRoutes");
const bookingWidgetRoutes = require("./routes/bookingWidgetRoutes");
const adminRoutes = require("./routes/adminRoutes");
const calendlyWebhookRoutes = require("./routes/calendlyWebhookRoutes");
const clientPortalRoutes = require("./routes/clientPortalRoutes");
const googleCalendarRoutes = require("./routes/googleCalendarRoutes");

// Inicializar manejadores de errores globales
ErrorHandler.initialize();

const app = express();

// Log de inicio de aplicación
logger.info(`Iniciando ${APP_NAME} v${APP_VERSION}`, {
  environment: NODE_ENV,
  port: PORT,
});

// ===== MIDDLEWARE DE SEGURIDAD AVANZADO =====

// 1. Headers de seguridad (Helmet)
app.use(SecurityMiddleware.helmetConfig());

// 2. CORS configurado de forma segura
app.use(SecurityMiddleware.corsConfig());

// 3. Logging de seguridad
app.use(SecurityMiddleware.securityLogger);

// 4. Timeout para requests
app.use(SecurityMiddleware.timeoutHandler(30000)); // 30 segundos

// 5. Sanitización de entrada
app.use(SecurityMiddleware.sanitizeInput);

// 6. Validación de contenido JSON
app.use(SecurityMiddleware.validateJsonContent);

// 7. Protección contra timing attacks
app.use(SecurityMiddleware.timingAttackProtection);

// 8. Rate limiting por endpoint
const rateLimiters = SecurityMiddleware.rateLimiters();

// Middleware para parsear JSON con límites seguros
app.use(
  express.json({
    limit: "1mb", // Reducido para seguridad
    verify: (req, res, buf) => {
      // Verificar que el JSON no sea malicioso
      const body = buf.toString();
      if (body.includes("<script>") || body.includes("javascript:")) {
        throw new Error("Malicious content detected");
      }
    },
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
    parameterLimit: 100, // Limitar parámetros
  })
);

// Middleware de logging existente (mejorado)
app.use((req, res, next) => {
  const startTime = Date.now();

  logger.info(`Request received: ${req.method} ${req.url}`, {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get("User-Agent"),
    contentType: req.get("Content-Type"),
    contentLength: req.get("Content-Length"),
    origin: req.get("Origin"),
    referer: req.get("Referer"),
  });

  // Log de respuesta
  res.on("finish", () => {
    const responseTime = Date.now() - startTime;
    logger.performance(`${req.method} ${req.url}`, responseTime, {
      statusCode: res.statusCode,
      ip: req.ip,
    });
  });

  next();
});

// Hacer los clientes disponibles globalmente en el objeto app
app.locals.supabase = supabase;
app.locals.twilioClient = twilioClient;
app.locals.calendlyClient = calendlyClient;
app.locals.openaiClient = openaiClient;
app.locals.googleCalendarClient = googleCalendarClient;

// ===== MONTAJE DE RUTAS CON SEGURIDAD =====

// 1. API general con rate limiting moderado
app.use("/api", rateLimiters.general, apiRouter);

// 1.1. API específica para servicios del portal cliente
const serviciosRouter = require("./api/servicios");
app.use("/api/servicios", rateLimiters.general, serviciosRouter);

// 2. WhatsApp autónomo con validación de Twilio y rate limiting específico
app.use(
  "/autonomous/whatsapp",
  rateLimiters.whatsapp,
  // Aplicar validación de Twilio solo a webhooks POST
  (req, res, next) => {
    if (req.method === "POST" && req.path === "/webhook") {
      return SecurityMiddleware.validateTwilioSignature(req, res, next);
    }
    next();
  },
  autonomousWhatsAppRoutes
);

// 3. Widget de reservas con rate limiting específico
app.use(
  "/api/widget",
  rateLimiters.widgetGeneral,
  // Rate limiting más estricto para creación de reservas
  (req, res, next) => {
    if (req.method === "POST" && req.path === "/bookings") {
      return rateLimiters.widgetBooking(req, res, next);
    }
    next();
  },
  bookingWidgetRoutes
);

// 4. Dashboard administrativo con máxima seguridad
app.use("/admin", rateLimiters.admin, adminRoutes);

// 5. Webhooks de Calendly con rate limiting específico
app.use("/api/calendly", rateLimiters.general, calendlyWebhookRoutes);

// 6. Portal del Cliente con rate limiting moderado
app.use("/client", rateLimiters.general, clientPortalRoutes);

// 7. Google Calendar con rate limiting específico
app.use("/api/google", rateLimiters.general, googleCalendarRoutes);

// ===== ARCHIVOS ESTÁTICOS =====

// Importar path para archivos estáticos
const path = require("path");

// Servir dashboard administrativo (solo con autenticación)
app.use(
  "/admin/static",
  express.static(path.join(__dirname, "../public/admin"))
);

// Ruta para acceder al dashboard
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin/index.html"));
});

// Ruta para login del dashboard
app.get("/admin/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin/login.html"));
});

// ===== PORTAL CLIENTE =====

// Servir archivos estáticos del portal cliente
app.use(
  "/portal/static",
  express.static(path.join(__dirname, "../public/client"))
);

// Ruta principal del portal cliente
app.get("/portal", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/client/ricardo-portal.html"));
});

// Ruta alternativa para compatibilidad
app.get("/client", (req, res) => {
  res.redirect("/portal");
});

// ===== RUTAS DE SISTEMA =====

// Health check mejorado con seguridad
app.get("/health", ErrorHandler.healthCheck);

// Ruta principal con información limitada
app.get("/", (req, res) => {
  const response = {
    mensaje: "Asistente Virtual Autónomo - Sistema Operativo",
    app: APP_NAME,
    version: APP_VERSION,
    status: "online",
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
});

// ===== MANEJO DE ERRORES =====

// Middleware para rutas no encontradas
app.use(ErrorHandler.notFoundHandler);

// Middleware de manejo de errores de seguridad
app.use(SecurityMiddleware.securityErrorHandler);

// Middleware global de manejo de errores
app.use(ErrorHandler.globalErrorHandler);

// Middleware de manejo de errores
app.use((error, req, res, next) => {
  logger.error("Error no manejado", error, {
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  res.status(500).json({
    success: false,
    error:
      NODE_ENV === "production" ? "Error interno del servidor" : error.message,
    timestamp: new Date().toISOString(),
  });
});

// Middleware para rutas no encontradas
app.use((req, res) => {
  logger.warn("Ruta no encontrada", {
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    error: "Ruta no encontrada",
    timestamp: new Date().toISOString(),
  });
});

// Manejo de señales del sistema
process.on("SIGTERM", () => {
  logger.info("Señal SIGTERM recibida, cerrando servidor...");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("Señal SIGINT recibida, cerrando servidor...");
  process.exit(0);
});

process.on("uncaughtException", (error) => {
  logger.error("Excepción no capturada", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Promesa rechazada no manejada", reason);
  process.exit(1);
});

// Puerto de escucha
const serverPort = PORT || 3000;
app.listen(serverPort, () => {
  logger.info(`🚀 Servidor iniciado exitosamente`, {
    port: serverPort,
    environment: NODE_ENV,
    url: `http://localhost:${serverPort}`,
    pid: process.pid,
  });
});

module.exports = app;
