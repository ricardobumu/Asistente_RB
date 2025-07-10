// src/routes/bookingWidgetRoutes.js
// Rutas para el widget de reservas embebido

const express = require("express");
const router = express.Router();
const bookingWidgetController = require("../controllers/bookingWidgetController");

// Rutas públicas del widget (sin autenticación)

/**
 * GET /api/widget/services
 * Obtiene servicios disponibles para el widget
 */
router.get("/services", bookingWidgetController.getServices);

/**
 * GET /api/widget/services/:serviceId/availability
 * Obtiene disponibilidad de un servicio específico
 */
router.get(
  "/services/:serviceId/availability",
  bookingWidgetController.getAvailability
);

/**
 * POST /api/widget/bookings
 * Crea una nueva reserva desde el widget
 */
router.post("/bookings", bookingWidgetController.createBooking);

/**
 * POST /api/widget/check-availability
 * Verifica disponibilidad de un slot específico
 */
router.post(
  "/check-availability",
  bookingWidgetController.checkSlotAvailability
);

/**
 * GET /api/widget/config
 * Obtiene configuración del widget
 */
router.get("/config", bookingWidgetController.getWidgetConfig);

/**
 * GET /api/widget/embed
 * Widget embebido completo (HTML)
 */
router.get("/embed", bookingWidgetController.getEmbedWidget);

// Rutas para gestión de reservas del cliente

/**
 * GET /api/widget/bookings/:email
 * Obtiene reservas de un cliente específico
 */
router.get("/bookings/:email", bookingWidgetController.getClientBookings);

/**
 * POST /api/widget/bookings/:bookingId/cancel
 * Cancela una reserva específica
 */
router.post(
  "/bookings/:bookingId/cancel",
  bookingWidgetController.cancelBooking
);

module.exports = router;
