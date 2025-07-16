// src/routes/appointmentWidgetRoutes.js
// Rutas para el widget de citas embebido

const express = require("express");
const router = express.Router();
const appointmentWidgetController = require("../controllers/appointmentWidgetController");

// Rutas públicas del widget (sin autenticación)

/**
 * GET /api/widget/services
 * Obtiene servicios disponibles para el widget
 */
router.get("/services", appointmentWidgetController.getServices);

/**
 * GET /api/widget/services/:serviceId/availability
 * Obtiene disponibilidad de un servicio específico
 */
router.get(
  "/services/:serviceId/availability",
  appointmentWidgetController.getAvailability,
);

/**
 * POST /api/widget/appointments
 * Crea una nueva cita desde el widget
 */
router.post("/appointments", appointmentWidgetController.createAppointment);

/**
 * POST /api/widget/check-availability
 * Verifica disponibilidad de un slot específico
 */
router.post(
  "/check-availability",
  appointmentWidgetController.checkSlotAvailability,
);

/**
 * GET /api/widget/config
 * Obtiene configuración del widget
 */
router.get("/config", appointmentWidgetController.getWidgetConfig);

/**
 * GET /api/widget/embed
 * Widget embebido completo (HTML)
 */
router.get("/embed", appointmentWidgetController.getEmbedWidget);

// Rutas para gestión de citas del cliente

/**
 * GET /api/widget/appointments/:email
 * Obtiene citas de un cliente específico
 */
router.get("/appointments/:email", appointmentWidgetController.getClientAppointments);

/**
 * POST /api/widget/appointments/:appointmentId/cancel
 * Cancela una cita específica
 */
router.post(
  "/appointments/:appointmentId/cancel",
  appointmentWidgetController.cancelAppointment,
);

module.exports = router;
