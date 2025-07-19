// src/controllers/adminAppointmentController.js
const AdminAppointmentService = require("../services/adminAppointmentService");
const AppointmentService = require("../services/appointmentService");
const logger = require("../utils/logger");

class AdminAppointmentController {
  /**
   * Dashboard principal
   */
  static async getDashboard(req, res) {
    try {
      const result = await AdminAppointmentService.getDashboardSummary();

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
   * Buscar citas con filtros
   */
  static async searchAppointments(req, res) {
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

      const result = await AdminAppointmentService.searchAppointments(filters);

      res.status(200).json(result);
    } catch (error) {
      logger.error("Error in searchAppointments:", error);
      res.status(500).json({
        success: false,
        error: "Error buscando citas",
        data: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 },
      });
    }
  }

  /**
   * Crear cita manual
   */
  static async createManualAppointment(req, res) {
    try {
      const appointmentData = req.body;

      // Validar datos requeridos
      if (!appointmentData.service_id || !appointmentData.scheduled_at) {
        return res.status(400).json({
          success: false,
          error: "service_id y scheduled_at son requeridos",
        });
      }

      if (!appointmentData.client_phone && !appointmentData.client_email) {
        return res.status(400).json({
          success: false,
          error: "client_phone o client_email son requeridos",
        });
      }

      const result =
        await AdminAppointmentService.createManualAppointment(appointmentData);

      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error("Error in createManualAppointment:", error);
      res.status(500).json({
        success: false,
        error: "Error creando cita manual",
      });
    }
  }

  /**
   * Actualizar estado de cita
   */
  static async updateAppointmentStatus(req, res) {
    try {
      const appointmentId = req.params.id;
      const { status, notes } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          error: "status es requerido",
        });
      }

      const result = await AppointmentService.updateAppointmentStatus(
        appointmentId,
        status,
        notes
      );

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error("Error in updateAppointmentStatus:", error);
      res.status(500).json({
        success: false,
        error: "Error actualizando estado de cita",
      });
    }
  }

  /**
   * Reprogramar cita
   */
  static async rescheduleAppointment(req, res) {
    try {
      const appointmentId = req.params.id;
      const { newDateTime, reason } = req.body;

      if (!newDateTime) {
        return res.status(400).json({
          success: false,
          error: "newDateTime es requerido",
        });
      }

      const result = await AppointmentService.rescheduleAppointment(
        appointmentId,
        newDateTime,
        reason
      );

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error("Error in rescheduleAppointment:", error);
      res.status(500).json({
        success: false,
        error: "Error reprogramando cita",
      });
    }
  }

  /**
   * Cancelar cita
   */
  static async cancelAppointment(req, res) {
    try {
      const appointmentId = req.params.id;
      const { reason } = req.body;

      const result = await AppointmentService.cancelAppointment(
        appointmentId,
        reason
      );

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error("Error in cancelAppointment:", error);
      res.status(500).json({
        success: false,
        error: "Error cancelando cita",
      });
    }
  }

  /**
   * Obtener estadísticas
   */
  static async getAppointmentStats(req, res) {
    try {
      const result = await AdminAppointmentService.getAppointmentStats();

      res.status(200).json(result);
    } catch (error) {
      logger.error("Error in getAppointmentStats:", error);
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
      const result = await AdminAppointmentService.syncWithGoogleCalendar();

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
      const result =
        await AdminAppointmentService.getGoogleCalendarEvents(days);

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
   * Exportar citas
   */
  static async exportAppointments(req, res) {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        status: req.query.status,
        clientName: req.query.clientName,
        serviceName: req.query.serviceName,
      };

      const result =
        await AdminAppointmentService.exportAppointmentsToCSV(filters);

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
          error: result.error || "Error exportando citas",
        });
      }
    } catch (error) {
      logger.error("Error in exportAppointments:", error);
      res.status(500).json({
        success: false,
        error: "Error exportando citas",
      });
    }
  }

  /**
   * Citas de hoy
   */
  static async getTodayAppointments(req, res) {
    try {
      const result = await AppointmentService.getTodayAppointments();

      res.status(200).json(result);
    } catch (error) {
      logger.error("Error in getTodayAppointments:", error);
      res.status(500).json({
        success: false,
        error: "Error obteniendo citas de hoy",
        data: [],
      });
    }
  }

  /**
   * Próximas citas
   */
  static async getUpcomingAppointments(req, res) {
    try {
      const days = parseInt(req.query.days) || 7;
      const result = await AppointmentService.getUpcomingAppointments(days);

      res.status(200).json(result);
    } catch (error) {
      logger.error("Error in getUpcomingAppointments:", error);
      res.status(500).json({
        success: false,
        error: "Error obteniendo próximas citas",
        data: [],
      });
    }
  }
}

module.exports = AdminAppointmentController;
