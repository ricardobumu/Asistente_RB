// src/index-test.js
// Versión mínima para probar ngrok

require("dotenv").config({ path: ".env" });

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware básico
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas de prueba
app.get("/", (req, res) => {
  res.json({
    message: "🎉 Ricardo Beauty Assistant está funcionando!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0-test",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Sistema funcionando correctamente",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Webhook de prueba para WhatsApp
app.post("/webhook/whatsapp", (req, res) => {
  console.log("📱 Webhook WhatsApp recibido:", {
    body: req.body,
    headers: req.headers,
  });

  const { Body: message, From: from } = req.body;

  console.log(`💬 Mensaje de ${from}: ${message}`);

  res.json({
    success: true,
    message: "Webhook procesado correctamente",
    received: {
      from,
      message,
      timestamp: new Date().toISOString(),
    },
  });
});

// Webhook de prueba para Calendly
app.post("/webhook/calendly", (req, res) => {
  console.log("📅 Webhook Calendly recibido:", {
    body: req.body,
    headers: req.headers,
  });

  res.json({
    success: true,
    message: "Webhook Calendly procesado correctamente",
    timestamp: new Date().toISOString(),
  });
});

// Ruta de admin básica
app.get("/admin", (req, res) => {
  res.json({
    message: "Panel de administración",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/health",
      whatsapp_webhook: "/webhook/whatsapp",
      calendly_webhook: "/webhook/calendly",
    },
  });
});

// Manejo de errores
app.use((error, req, res, next) => {
  console.error("❌ Error:", error);
  res.status(500).json({
    error: "Error interno del servidor",
    timestamp: new Date().toISOString(),
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 RICARDO BEAUTY ASSISTANT - SERVIDOR INICIADO");
  console.log("=".repeat(60));
  console.log(`📍 URL Local: http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`📱 WhatsApp Webhook: http://localhost:${PORT}/webhook/whatsapp`);
  console.log(`📅 Calendly Webhook: http://localhost:${PORT}/webhook/calendly`);
  console.log(`⚙️  Admin: http://localhost:${PORT}/admin`);
  console.log("=".repeat(60));
  console.log(`⏰ Iniciado: ${new Date().toLocaleString()}`);
  console.log(`🌍 Entorno: ${process.env.NODE_ENV || "development"}`);
  console.log("=".repeat(60));
  console.log("\n✅ ¡Listo para recibir conexiones!");
  console.log("🔗 Para exponer con ngrok: ngrok http 3000");
  console.log("\n");
});
