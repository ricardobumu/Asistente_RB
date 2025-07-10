// src/index-simple.js
// Versión simplificada SEGURA y FUNCIONAL

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

// Importar modelos al inicio
const serviceModel = require("./models/serviceModel");
const autonomousWhatsAppController = require("./controllers/autonomousWhatsAppController");

const app = express();
const PORT = process.env.PORT || 3000;

// CORS seguro
const corsOptions = {
  origin: [
    "https://bot.ricardoburitica.eu",
    "https://www.ricardoburitica.eu",
    ...(process.env.NODE_ENV === "development"
      ? ["http://localhost:3000"]
      : []),
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana
  message: { error: "Demasiadas solicitudes, intenta más tarde" },
});

const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // máximo 30 webhooks por minuto
  message: { error: "Límite de webhooks excedido" },
});

// Middleware de seguridad
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);
app.use(cors(corsOptions));
app.use(generalLimiter);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Logging básico
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// RUTAS PRINCIPALES
app.get("/", (req, res) => {
  res.send("¡Hola, mundo desde Express!");
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Servidor funcionando correctamente",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// API SERVICIOS
app.get("/api/servicios", async (req, res) => {
  try {
    const result = await serviceModel.getAll();

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: "Error obteniendo servicios",
      });
    }

    const activeServices = result.data.filter(
      (service) => service.activo === true
    );

    res.json({
      success: true,
      data: activeServices,
      count: activeServices.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error en /api/servicios:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// API HEALTH
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "API funcionando correctamente",
    timestamp: new Date().toISOString(),
  });
});

// WEBHOOK WHATSAPP (SEGURO)
app.post("/autonomous/whatsapp/webhook", webhookLimiter, async (req, res) => {
  try {
    await autonomousWhatsAppController.receiveMessage(req, res);
  } catch (error) {
    console.error("Error en webhook WhatsApp:", error);
    res.status(500).json({ error: "Error procesando mensaje" });
  }
});

app.get("/autonomous/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const expectedToken =
    process.env.TWILIO_WEBHOOK_TOKEN || process.env.TWILIO_AUTH_TOKEN;

  if (mode === "subscribe" && token === expectedToken) {
    res.status(200).send(challenge);
  } else {
    console.warn("Webhook verification failed", {
      mode,
      token: token?.substring(0, 10),
    });
    res.status(403).send("Forbidden");
  }
});

// WEBHOOK CALENDLY
app.post("/api/calendly/webhook", (req, res) => {
  console.log("Calendly webhook recibido:", req.body);
  res.status(200).json({ success: true });
});

// ADMIN BÁSICO
app.get("/admin", (req, res) => {
  res.send(`
        <h1>Admin Panel - Asistente RB</h1>
        <p>Sistema funcionando correctamente</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
    `);
});

// PORTAL CLIENTE
app.get("/portal", (req, res) => {
  res.send(`
        <h1>Portal Cliente - Asistente RB</h1>
        <p>Bienvenido al portal de servicios</p>
        <a href="/api/servicios">Ver Servicios</a>
    `);
});

// Error handler
app.use((error, req, res, next) => {
  console.error("Error:", error);
  res.status(500).json({
    success: false,
    error: "Error interno del servidor",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint no encontrado",
    path: req.originalUrl,
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
  console.log(`Aplicación: ${process.env.APP_NAME || "Asistente RB"}`);
  console.log(`Entorno: ${process.env.NODE_ENV || "development"}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
});

module.exports = app;
