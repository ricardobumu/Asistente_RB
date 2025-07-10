// src/routes/adminBookingRoutes.js
const express = require("express");
const router = express.Router();
const adminBookingController = require("../controllers/adminBookingController");
const authMiddleware = require("../middleware/authMiddleware");

// Aplicar autenticación a todas las rutas administrativas
router.use(authMiddleware.requireAuth);

/**
 * GET /admin/bookings/dashboard
 * Dashboard principal con resumen del día
 */
router.get("/dashboard", adminBookingController.getDashboard);

/**
 * GET /admin/bookings/search
 * Buscar reservas con filtros
 */
router.get("/search", adminBookingController.searchBookings);

/**
 * POST /admin/bookings/create
 * Crear reserva manual
 */
router.post("/create", adminBookingController.createManualBooking);

/**
 * PUT /admin/bookings/:id/status
 * Actualizar estado de reserva
 */
router.put("/:id/status", adminBookingController.updateBookingStatus);

/**
 * PUT /admin/bookings/:id/reschedule
 * Reprogramar reserva
 */
router.put("/:id/reschedule", adminBookingController.rescheduleBooking);

/**
 * DELETE /admin/bookings/:id
 * Cancelar reserva
 */
router.delete("/:id", adminBookingController.cancelBooking);

/**
 * GET /admin/bookings/stats
 * Obtener estadísticas de reservas
 */
router.get("/stats", adminBookingController.getBookingStats);

/**
 * POST /admin/bookings/sync-calendar
 * Sincronizar con Google Calendar
 */
router.post("/sync-calendar", adminBookingController.syncWithGoogleCalendar);

/**
 * GET /admin/bookings/calendar-events
 * Obtener eventos de Google Calendar
 */
router.get("/calendar-events", adminBookingController.getCalendarEvents);

/**
 * GET /admin/bookings/export
 * Exportar reservas a CSV
 */
router.get("/export", adminBookingController.exportBookings);

/**
 * GET /admin/bookings/today
 * Reservas de hoy
 */
router.get("/today", adminBookingController.getTodayBookings);

/**
 * GET /admin/bookings/upcoming
 * Próximas reservas
 */
router.get("/upcoming", adminBookingController.getUpcomingBookings);

module.exports = router;
