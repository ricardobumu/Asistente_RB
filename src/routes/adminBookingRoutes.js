// src/routes/adminBookingRoutes.js
const express = require("express");
const router = express.Router();
const adminAppointmentController = require("../controllers/adminAppointmentController");
const { authenticate } = require("../middleware/authMiddleware");

// Aplicar autenticación a todas las rutas administrativas
router.use(authenticate);

/**
 * GET /admin/appointments/dashboard
 * Dashboard principal con resumen del día
 */
router.get("/dashboard", adminAppointmentController.getDashboard);

/**
 * GET /admin/appointments/search
 * Buscar citas con filtros
 */
router.get("/search", adminAppointmentController.searchAppointments);

/**
 * POST /admin/appointments/create
 * Crear cita manual
 */
router.post("/create", adminAppointmentController.createManualAppointment);

/**
 * PUT /admin/appointments/:id/status
 * Actualizar estado de cita
 */
router.put("/:id/status", adminAppointmentController.updateAppointmentStatus);

/**
 * PUT /admin/appointments/:id/reschedule
 * Reprogramar cita
 */
router.put("/:id/reschedule", adminAppointmentController.rescheduleAppointment);

/**
 * DELETE /admin/appointments/:id
 * Cancelar cita
 */
router.delete("/:id", adminAppointmentController.cancelAppointment);

/**
 * GET /admin/appointments/stats
 * Obtener estadísticas de citas
 */
router.get("/stats", adminAppointmentController.getAppointmentStats);

/**
 * POST /admin/appointments/sync-calendar
 * Sincronizar con Google Calendar
 */
router.post("/sync-calendar", adminAppointmentController.syncWithGoogleCalendar);

/**
 * GET /admin/appointments/calendar-events
 * Obtener eventos de Google Calendar
 */
router.get("/calendar-events", adminAppointmentController.getCalendarEvents);

/**
 * GET /admin/appointments/export
 * Exportar citas a CSV
 */
router.get("/export", adminAppointmentController.exportAppointments);

/**
 * GET /admin/appointments/today
 * Citas de hoy
 */
router.get("/today", adminAppointmentController.getTodayAppointments);

/**
 * GET /admin/appointments/upcoming
 * Próximas citas
 */
router.get("/upcoming", adminAppointmentController.getUpcomingAppointments);

module.exports = router;
