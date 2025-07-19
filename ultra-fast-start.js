/**
 * ARRANQUE ULTRA MÍNIMO - SOLO LO ESENCIAL
 *
 * Arranca el servidor con el mínimo absoluto necesario
 * Carga rutas bajo demanda cuando se necesiten
 */

console.log("🚀 ARRANQUE ULTRA MÍNIMO");
const startTime = Date.now();

// Solo cargar lo absolutamente esencial
require("dotenv").config();
require("dotenv").config({ path: ".env.local" });

const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware mínimo
app.use(express.json({ limit: "10mb" }));

// Health check inmediato
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mode: "ultra-fast",
  });
});

// Webhook WhatsApp - CARGA BAJO DEMANDA
app.post("/webhook/whatsapp", (req, res) => {
  try {
    // Cargar handler solo cuando se necesite
    const {
      handleWhatsAppWebhook,
    } = require("./src/controllers/whatsappController");
    return handleWhatsAppWebhook(req, res);
  } catch (error) {
    console.error("Error cargando WhatsApp handler:", error.message);
    res.status(500).json({ error: "Handler no disponible" });
  }
});

// Webhook Calendly - CARGA BAJO DEMANDA
app.post("/api/calendly/webhook", (req, res) => {
  try {
    const {
      handleCalendlyWebhook,
    } = require("./src/controllers/calendlyController");
    return handleCalendlyWebhook(req, res);
  } catch (error) {
    console.error("Error cargando Calendly handler:", error.message);
    res.status(500).json({ error: "Handler no disponible" });
  }
});

// Admin - CARGA BAJO DEMANDA
app.get("/admin*", (req, res) => {
  try {
    const path = require("path");
    const fs = require("fs");
    const adminPath = path.join(__dirname, "public/admin/index.html");

    if (fs.existsSync(adminPath)) {
      res.sendFile(adminPath);
    } else {
      res.status(404).send("Admin panel no encontrado");
    }
  } catch (error) {
    res.status(500).send("Error cargando admin");
  }
});

// Cargar rutas adicionales solo si se solicitan
app.use("*", (req, res, next) => {
  // Si es una ruta que no hemos manejado, intentar cargar el sistema completo
  if (!req.route) {
    try {
      const { setupRoutes } = require("./src/routes");
      setupRoutes(app);
      // Reintentar la petición
      next();
    } catch (error) {
      res.status(404).json({
        error: "Ruta no encontrada",
        path: req.path,
        method: req.method,
      });
    }
  } else {
    next();
  }
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  const totalTime = Date.now() - startTime;

  console.log(`✅ Servidor iniciado en puerto ${PORT}`);
  console.log(`⚡ Tiempo de arranque: ${totalTime}ms`);
  console.log(`🌐 Health: http://localhost:${PORT}/health`);
  console.log(`📱 WhatsApp: http://localhost:${PORT}/webhook/whatsapp`);
  console.log(`📅 Calendly: http://localhost:${PORT}/api/calendly/webhook`);
  console.log(`🔧 Admin: http://localhost:${PORT}/admin`);
});

// Manejo de errores
process.on("uncaughtException", (error) => {
  console.error("Error no capturado:", error.message);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Promesa rechazada:", reason);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Cerrando servidor...");
  server.close(() => {
    console.log("✅ Servidor cerrado correctamente");
    process.exit(0);
  });
});

module.exports = { app, server };
