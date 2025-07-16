// src/controllers/adminBookingController.js
const AdminBookingService = require("../services/adminBookingService");
const AppointmentService = require("../services/appointmentService");
const logger = require("../utils/logger");

class AdminBookingController {
  /**
   * Dashboard principal
   */
  static async getDashboard(req, res) {
    try {
      const result = await AdminBookingService.getDashboardSummary();

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(500).json({
          success: false,
          error: result.error || "Error obteniendo dashboard",
        });
      }
    } catch (error) {
      logger.error("Error in getDashboard:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Buscar reservas con filtros
   */
  static async searchBookings(req, res) {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        status: req.query.status,
        clientName: req.query.clientName,
        serviceName: req.query.serviceName,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
      };

      const result = await AdminBookingService.searchBookings(filters);

      res.status(200).json(result);
    } catch (error) {
      logger.error("Error in searchBookings:", error);
      res.status(500).json({
        success: false,
        error: "Error buscando reservas",
        data: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 },
      });
    }
  }

  /**
   * Crear reserva manual
   */
  static async createManualBooking(req, res) {
    try {
      const bookingData = req.body;

      // Validar datos requeridos
      if (!bookingData.service_id || !bookingData.scheduled_at) {
        return res.status(400).json({
          success: false,
          error: "service_id y scheduled_at son requeridos",
        });
      }

      if (!bookingData.client_phone && !bookingData.client_email) {
        return res.status(400).json({
          success: false,
          error: "client_phone o client_email son requeridos",
        });
      }

      const result = await AdminBookingService.createManualBooking(bookingData);

      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error("Error in createManualBooking:", error);
      res.status(500).json({
        success: false,
        error: "Error creando reserva manual",
      });
    }
  }

  /**
   * Actualizar estado de reserva
   */
  static async updateBookingStatus(req, res) {
    try {
      const bookingId = req.params.id;
      const { status, notes } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          error: "status es requerido",
        });
      }

      const result = await AppointmentService.updateAppointmentStatus(
        bookingId,
        status,
        notes
      );

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error("Error in updateBookingStatus:", error);
      res.status(500).json({
        success: false,
        error: "Error actualizando estado de reserva",
      });
    }
  }

  /**
   * Reprogramar reserva
   */
  static async rescheduleBooking(req, res) {
    try {
      const bookingId = req.params.id;
      const { newDateTime, reason } = req.body;

      if (!newDateTime) {
        return res.status(400).json({
          success: false,
          error: "newDateTime es requerido",
        });
      }

      const result = await AppointmentService.rescheduleAppointment(
        bookingId,
        newDateTime,
        reason
      );

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error("Error in rescheduleBooking:", error);
      res.status(500).json({
        success: false,
        error: "Error reprogramando reserva",
      });
    }
  }

  /**
   * Cancelar reserva
   */
  static async cancelBooking(req, res) {
    try {
      const bookingId = req.params.id;
      const { reason } = req.body;

      const result = await AppointmentService.cancelAppointment(
        bookingId,
        reason
      );

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error("Error in cancelBooking:", error);
      res.status(500).json({
        success: false,
        error: "Error cancelando reserva",
      });
    }
  }

  /**
   * Obtener estadísticas
   */
  static async getBookingStats(req, res) {
    try {
      const result = await AdminBookingService.getBookingStats();

      res.status(200).json(result);
    } catch (error) {
      logger.error("Error in getBookingStats:", error);
      res.status(500).json({
        success: false,
        error: "Error obteniendo estadísticas",
        data: {},
      });
    }
  }

  /**
   * Sincronizar con Google Calendar
   */
  static async syncWithGoogleCalendar(req, res) {
    try {
      const result = await AdminBookingService.syncWithGoogleCalendar();

      if (result.success) {
        res.status(200).json({
          success: true,
          message: `Sincronización completada: ${result.data.synced} eventos sincronizados, ${result.data.errors} errores`,
          data: result.data,
        });
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error("Error in syncWithGoogleCalendar:", error);
      res.status(500).json({
        success: false,
        error: "Error sincronizando con Google Calendar",
      });
    }
  }

  /**
   * Obtener eventos de Google Calendar
   */
  static async getCalendarEvents(req, res) {
    try {
      const days = parseInt(req.query.days) || 7;
      const result = await AdminBookingService.getGoogleCalendarEvents(days);

      res.status(200).json(result);
    } catch (error) {
      logger.error("Error in getCalendarEvents:", error);
      res.status(500).json({
        success: false,
        error: "Error obteniendo eventos de calendario",
        data: [],
      });
    }
  }

  /**
   * Exportar reservas
   */
  static async exportBookings(req, res) {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        status: req.query.status,
        clientName: req.query.clientName,
        serviceName: req.query.serviceName,
      };

      const result = await AdminBookingService.exportBookingsToCSV(filters);

      if (result.success) {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${result.filename}"`
        );
        res.status(200).send(result.data);
      } else {
        res.status(500).json({
          success: false,
          error: result.error || "Error exportando reservas",
        });
      }
    } catch (error) {
      logger.error("Error in exportBookings:", error);
      res.status(500).json({
        success: false,
        error: "Error exportando reservas",
      });
    }
  }

  /**
   * Reservas de hoy
   */
  static async getTodayBookings(req, res) {
    try {
      const result = await AppointmentService.getTodayAppointments();

      res.status(200).json(result);
    } catch (error) {
      logger.error("Error in getTodayBookings:", error);
      res.status(500).json({
        success: false,
        error: "Error obteniendo reservas de hoy",
        data: [],
      });
    }
  }

  /**
   * Próximas reservas
   */
  static async getUpcomingBookings(req, res) {
    try {
      const days = parseInt(req.query.days) || 7;
      const result = await AppointmentService.getUpcomingAppointments(days);

      res.status(200).json(result);
    } catch (error) {
      logger.error("Error in getUpcomingBookings:", error);
      res.status(500).json({
        success: false,
        error: "Error obteniendo próximas reservas",
        data: [],
      });
    }
  }
}

module.exports = AdminBookingController;
