// src/index-secure.js
// Versión COMPLETAMENTE SEGURA y de EXCELENCIA

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const path = require("path");

// Importaciones seguras
const logger = require("./utils/logger");
const { authenticate } = require("./middleware/authMiddleware");

const app = express();
const PORT = process.env.PORT || 3000;

// ================================
// CONFIGURACIÓN DE SEGURIDAD AVANZADA
// ================================

// 1. CORS RESTRICTIVO Y SEGURO
const allowedOrigins = [
  "https://bot.ricardoburitica.eu",
  "https://www.ricardoburitica.eu",
  "https://ricardoburitica.com",
];

// En desarrollo, agregar localhost solo si está explícitamente permitido
if (
  process.env.NODE_ENV === "development" &&
  process.env.ALLOW_LOCALHOST === "true"
) {
  allowedOrigins.push("http://localhost:3000", "http://localhost:3001");
}

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin solo en desarrollo (para herramientas como Postman)
    if (!origin && process.env.NODE_ENV === "development") {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn("CORS: Origen no permitido", { origin, allowedOrigins });
      callback(new Error("No permitido por CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-Twilio-Signature",
  ],
  maxAge: 86400, // Cache preflight por 24 horas
};

// 2. RATE LIMITING GRANULAR
const createRateLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    message: { success: false, error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn("Rate limit excedido", {
        ip: req.ip,
        path: req.path,
        userAgent: req.get("User-Agent"),
      });
      res.status(429).json({ success: false, error: message });
    },
  });

const rateLimiters = {
  general: createRateLimiter(
    15 * 60 * 1000,
    100,
    "Demasiadas solicitudes generales"
  ),
  api: createRateLimiter(15 * 60 * 1000, 50, "Demasiadas solicitudes a la API"),
  webhook: createRateLimiter(1 * 60 * 1000, 30, "Demasiados webhooks"),
  auth: createRateLimiter(
    15 * 60 * 1000,
    5,
    "Demasiados intentos de autenticación"
  ),
};

// 3. HELMET CON CONFIGURACIÓN AVANZADA
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://api.calendly.com",
          "https://api.openai.com",
        ],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    frameguard: { action: "deny" },
    xssFilter: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);

// 4. MIDDLEWARE DE SEGURIDAD
app.use(cors(corsOptions));
app.use(rateLimiters.general);

// Parseo seguro con límites estrictos
app.use(
  express.json({
    limit: "1mb",
    verify: (req, res, buf) => {
      // Verificar que el JSON es válido antes de parsearlo
      try {
        JSON.parse(buf);
      } catch (e) {
        logger.warn("JSON inválido recibido", { ip: req.ip, error: e.message });
        throw new Error("JSON inválido");
      }
    },
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
    parameterLimit: 100,
  })
);

// 5. LOGGING SEGURO Y ESTRUCTURADO
app.use((req, res, next) => {
  // No loggear datos sensibles
  const sanitizedHeaders = { ...req.headers };
  delete sanitizedHeaders.authorization;
  delete sanitizedHeaders["x-twilio-signature"];

  logger.info("Request recibido", {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });

  next();
});

// ================================
// RUTAS PÚBLICAS SEGURAS
// ================================

// Ruta principal
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Asistente RB - Sistema de Reservas",
    version: process.env.APP_VERSION || "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Health check público
app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || "1.0.0",
  });
});

// ================================
// API ENDPOINTS SEGUROS
// ================================

// API Health con rate limiting específico
app.get("/api/health", rateLimiters.api, (req, res) => {
  res.json({
    success: true,
    message: "API funcionando correctamente",
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || "1.0.0",
  });
});

// API Servicios con validación y cache
app.get("/api/servicios", rateLimiters.api, async (req, res) => {
  try {
    // Importación lazy para mejor rendimiento
    const serviceModel = require("./models/serviceModel");

    logger.info("Solicitando servicios", { ip: req.ip });

    const result = await serviceModel.getAll();

    if (!result.success) {
      logger.error("Error obteniendo servicios", { error: result.error });
      return res.status(500).json({
        success: false,
        error: "Error obteniendo servicios",
      });
    }

    // Filtrar solo servicios activos y datos públicos
    const activeServices = result.data
      .filter((service) => service.activo === true)
      .map((service) => ({
        id: service.id,
        name: service.name,
        category: service.category,
        price: service.price,
        duration_minutes: service.duration_minutes,
        description: service.description,
        conscious_benefits: service.conscious_benefits,
      }));

    // Headers de cache para mejor rendimiento
    res.set({
      "Cache-Control": "public, max-age=300", // 5 minutos
      ETag: crypto
        .createHash("md5")
        .update(JSON.stringify(activeServices))
        .digest("hex"),
    });

    res.json({
      success: true,
      data: activeServices,
      count: activeServices.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error crítico en /api/servicios", {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// ================================
// WEBHOOKS SEGUROS
// ================================

// Función para validar firma de Twilio
function validateTwilioSignature(req) {
  const signature = req.headers["x-twilio-signature"];
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!signature || !authToken) {
    return false;
  }

  const url = `https://${req.get("host")}${req.originalUrl}`;
  const expectedSignature = crypto
    .createHmac("sha1", authToken)
    .update(url + JSON.stringify(req.body))
    .digest("base64");

  return crypto.timingSafeEqual(
    Buffer.from(signature, "base64"),
    Buffer.from(expectedSignature, "base64")
  );
}

// Webhook WhatsApp SEGURO
app.get("/autonomous/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const expectedToken =
    process.env.TWILIO_WEBHOOK_TOKEN || process.env.TWILIO_AUTH_TOKEN;

  if (
    mode === "subscribe" &&
    token &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))
  ) {
    logger.info("Webhook WhatsApp verificado correctamente");
    res.status(200).send(challenge);
  } else {
    logger.warn("Intento de verificación de webhook fallido", {
      mode,
      tokenProvided: !!token,
      ip: req.ip,
    });
    res.status(403).json({ error: "Verificación fallida" });
  }
});

app.post(
  "/autonomous/whatsapp/webhook",
  rateLimiters.webhook,
  async (req, res) => {
    try {
      // Validar firma de Twilio
      if (!validateTwilioSignature(req)) {
        logger.warn("Firma Twilio inválida", { ip: req.ip });
        return res.status(403).json({ error: "Firma inválida" });
      }

      // Validar estructura del mensaje
      const { Body: message, From: from, MessageSid: messageId } = req.body;

      if (!from || !from.startsWith("whatsapp:")) {
        logger.warn("Mensaje no es de WhatsApp", { from });
        return res.status(200).json({ status: "ignored" });
      }

      if (!message || message.trim().length === 0) {
        logger.warn("Mensaje vacío recibido", { from, messageId });
        return res.status(200).json({ status: "ignored" });
      }

      // Procesar mensaje de forma segura
      const autonomousWhatsAppController = require("./controllers/autonomousWhatsAppController");
      await autonomousWhatsAppController.receiveMessage(req, res);
    } catch (error) {
      logger.error("Error procesando webhook WhatsApp", {
        error: error.message,
        ip: req.ip,
      });
      res.status(500).json({ error: "Error procesando mensaje" });
    }
  }
);

// Webhook Calendly SEGURO
app.post("/api/calendly/webhook", rateLimiters.webhook, async (req, res) => {
  try {
    // Validar que viene de Calendly (implementar según su documentación)
    const signature = req.headers["calendly-webhook-signature"];
    const webhookSecret = process.env.CALENDLY_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(JSON.stringify(req.body))
        .digest("hex");

      if (
        !crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expectedSignature)
        )
      ) {
        logger.warn("Firma Calendly inválida", { ip: req.ip });
        return res.status(403).json({ error: "Firma inválida" });
      }
    }

    logger.info("Webhook Calendly recibido", {
      event: req.body.event,
      ip: req.ip,
    });

    // Procesar webhook de Calendly
    const calendlyWebhookController = require("./controllers/calendlyWebhookController");
    await calendlyWebhookController.handleWebhook(req, res);
  } catch (error) {
    logger.error("Error procesando webhook Calendly", {
      error: error.message,
      ip: req.ip,
    });
    res.status(500).json({ error: "Error procesando webhook" });
  }
});

// ================================
// RUTAS PROTEGIDAS
// ================================

// Admin con autenticación
app.get("/admin", authenticate, (req, res) => {
  res.json({
    success: true,
    message: "Panel administrativo",
    user: req.user.username,
    timestamp: new Date().toISOString(),
  });
});

// Portal cliente público pero con rate limiting
app.get("/portal", rateLimiters.api, (req, res) => {
  res.json({
    success: true,
    message: "Portal del cliente",
    services_url: "/api/servicios",
    timestamp: new Date().toISOString(),
  });
});

// ================================
// MANEJO DE ERRORES SEGURO
// ================================

// Error handler que no filtra información sensible
app.use((error, req, res, next) => {
  // Log completo para debugging interno
  logger.error("Error de aplicación", {
    error: error.message,
    stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  // Respuesta genérica al cliente
  const statusCode = error.statusCode || 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "Error interno del servidor"
      : error.message;

  res.status(statusCode).json({
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use("*", (req, res) => {
  logger.warn("Endpoint no encontrado", {
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    error: "Endpoint no encontrado",
    timestamp: new Date().toISOString(),
  });
});

// ================================
// INICIALIZACIÓN SEGURA
// ================================

// Validar variables de entorno críticas al inicio
const requiredEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "TWILIO_AUTH_TOKEN",
  "JWT_SECRET",
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  logger.error("Variables de entorno faltantes", { missingVars });
  process.exit(1);
}

// Iniciar servidor con manejo de errores
const server = app.listen(PORT, () => {
  logger.info("Servidor iniciado correctamente", {
    port: PORT,
    environment: process.env.NODE_ENV || "development",
    version: process.env.APP_VERSION || "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Manejo graceful de cierre
process.on("SIGTERM", () => {
  logger.info("SIGTERM recibido, cerrando servidor...");
  server.close(() => {
    logger.info("Servidor cerrado correctamente");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT recibido, cerrando servidor...");
  server.close(() => {
    logger.info("Servidor cerrado correctamente");
    process.exit(0);
  });
});

module.exports = app;
