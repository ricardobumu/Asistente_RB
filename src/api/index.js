// src/api/index.js
const express = require("express");
const router = express.Router();
const logger = require("../utils/logger");

// Importar controladores
const appointmentController = require("../controllers/appointmentController");
const clientController = require("../controllers/clientController");
const authController = require("../controllers/authController");

// Middleware de logging para API
router.use((req, res, next) => {
  logger.info(`API Request: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });
  next();
});

// ===== RUTAS DE AUTENTICACIÓN =====
router.post("/auth/login", authController.login);
router.post("/auth/register", authController.register);
router.post("/auth/refresh", authController.refreshToken);
router.post("/auth/logout", authController.logout);

// ===== RUTAS DE CITAS =====
router.get("/appointments", appointmentController.getAppointments);
router.get("/appointments/:id", appointmentController.getAppointmentById);
router.post("/appointments", appointmentController.createAppointment);
router.put("/appointments/:id", appointmentController.updateAppointment);
router.delete("/appointments/:id", appointmentController.deleteAppointment);

// ===== RUTAS DE CLIENTES =====
router.get("/clients", clientController.getClients);
router.get("/clients/:id", clientController.getClientById);
router.post("/clients", clientController.createClient);
router.put("/clients/:id", clientController.updateClient);
router.delete("/clients/:id", clientController.deleteClient);

// ===== RUTA DE SALUD DE LA API =====
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API funcionando correctamente",
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || "1.0.0",
  });
});

// ===== MANEJO DE ERRORES DE API =====
router.use((error, req, res, next) => {
  logger.error("Error en API:", {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  res.status(error.status || 500).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? "Error interno del servidor"
        : error.message,
    timestamp: new Date().toISOString(),
  });
});

// ===== RUTA NO ENCONTRADA =====
router.use("*", (req, res) => {
  logger.warn(`API endpoint no encontrado: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    error: "Endpoint de API no encontrado",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
