// src/controllers/appointmentController.js
// Controlador para gestión de citas con validaciones y lógica de negocio

const appointmentService = require("../services/appointmentService");
const notificationService = require("../services/notificationService");
const clientModel = require("../models/clientModel");
const serviceModel = require("../models/serviceModel");
const logger = require("../utils/logger");
const {
  validateAppointmentData,
  validateDateRange,
} = require("../utils/validators");

class AppointmentController {
  /**
   * Crear nueva cita
   * POST /api/appointments
   */
  async createAppointment(req, res) {
    try {
      logger.info("📅 Creando nueva cita", {
        body: req.body,
        ip: req.ip,
      });

      // Validar datos de entrada
      const validation = validateAppointmentData(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: "Datos de cita inválidos",
          details: validation.errors,
        });
      }

      const { client_id, service_id, fecha_hora, notas } = req.body;

      // Verificar que el cliente existe
      const clientResult = await clientModel.getById(client_id);
      if (!clientResult.success) {
        return res.status(404).json({
          success: false,
          error: "Cliente no encontrado",
        });
      }

      // Verificar que el servicio existe
      const serviceResult = await serviceModel.getById(service_id);
      if (!serviceResult.success) {
        return res.status(404).json({
          success: false,
          error: "Servicio no encontrado",
        });
      }

      // Crear la cita
      const appointmentData = {
        client_id,
        service_id,
        fecha_hora,
        notas: notas || "",
        estado: "pending",
        precio: serviceResult.data.precio,
        duracion: serviceResult.data.duracion,
      };

      const result = await appointmentService.createAppointment(appointmentData);

      if (result.success) {
        // Enviar notificación de confirmación
        await notificationService.sendAppointmentConfirmation(
          result.data,
          clientResult.data
        );

        logger.info("✅ Cita creada exitosamente", {
          appointmentId: result.data.id_cita,
          clientId: client_id,
          serviceId: service_id,
        });

        res.status(201).json({
          success: true,
          data: result.data,
          message: "Cita creada exitosamente",
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("❌ Error creando cita:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Obtener todas las citas con filtros
   * GET /api/appointments
   */
  async getAppointments(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        client_id,
        service_id,
        date_from,
        date_to,
        search,
      } = req.query;

      logger.info("📋 Obteniendo citas", {
        filters: req.query,
        ip: req.ip,
      });

      // Validar rango de fechas si se proporciona
      if (date_from && date_to) {
        const dateValidation = validateDateRange(date_from, date_to);
        if (!dateValidation.isValid) {
          return res.status(400).json({
            success: false,
            error: "Rango de fechas inválido",
            details: dateValidation.errors,
          });
        }
      }

      const filters = {
        status,
        client_id,
        service_id,
        date_from,
        date_to,
        search,
      };

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
      };

      const result = await appointmentService.getAppointments(filters, options);

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          pagination: result.pagination,
          total: result.total,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("❌ Error obteniendo citas:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Obtener cita por ID
   * GET /api/appointments/:id
   */
  async getAppointmentById(req, res) {
    try {
      const { id } = req.params;

      logger.info("📋 Obteniendo cita por ID", {
        appointmentId: id,
        ip: req.ip,
      });

      const result = await appointmentService.getAppointmentById(id);

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
        });
      } else {
        res.status(404).json({
          success: false,
          error: "Cita no encontrada",
        });
      }
    } catch (error) {
      logger.error("❌ Error obteniendo cita:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Actualizar cita
   * PUT /api/appointments/:id
   */
  async updateAppointment(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      logger.info("📝 Actualizando cita", {
        appointmentId: id,
        updateData,
        ip: req.ip,
      });

      // Obtener cita actual
      const currentAppointment = await appointmentService.getAppointmentById(id);
      if (!currentAppointment.success) {
        return res.status(404).json({
          success: false,
          error: "Cita no encontrada",
        });
      }

      const result = await appointmentService.updateAppointment(id, updateData);

      if (result.success) {
        logger.info("✅ Cita actualizada", {
          appointmentId: id,
          changes: Object.keys(updateData),
        });

        res.json({
          success: true,
          data: result.data,
          message: "Cita actualizada exitosamente",
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("❌ Error actualizando cita:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Cancelar cita
   * POST /api/appointments/:id/cancel
   */
  async cancelAppointment(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      logger.info("❌ Cancelando cita", {
        appointmentId: id,
        reason,
        ip: req.ip,
      });

      // Obtener cita y cliente
      const appointmentResult = await appointmentService.getAppointmentById(id);
      if (!appointmentResult.success) {
        return res.status(404).json({
          success: false,
          error: "Cita no encontrada",
        });
      }

      const clientResult = await clientModel.getById(
        appointmentResult.data.client_id
      );

      const result = await appointmentService.cancelAppointment(id, reason);

      if (result.success) {
        // Enviar notificación de cancelación
        if (clientResult.success) {
          await notificationService.sendAppointmentCancellation(
            appointmentResult.data,
            clientResult.data,
            reason
          );
        }

        logger.info("✅ Cita cancelada", {
          appointmentId: id,
          reason,
        });

        res.json({
          success: true,
          data: result.data,
          message: "Cita cancelada exitosamente",
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("❌ Error cancelando cita:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Confirmar cita
   * POST /api/appointments/:id/confirm
   */
  async confirmAppointment(req, res) {
    try {
      const { id } = req.params;

      logger.info("✅ Confirmando cita", {
        appointmentId: id,
        ip: req.ip,
      });

      const result = await appointmentService.confirmAppointment(id);

      if (result.success) {
        logger.info("✅ Cita confirmada", { appointmentId: id });

        res.json({
          success: true,
          data: result.data,
          message: "Cita confirmada exitosamente",
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("❌ Error confirmando cita:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Reprogramar cita
   * POST /api/appointments/:id/reschedule
   */
  async rescheduleAppointment(req, res) {
    try {
      const { id } = req.params;
      const { nueva_fecha_hora, reason } = req.body;

      logger.info("🔄 Reprogramando cita", {
        appointmentId: id,
        nueva_fecha_hora,
        reason,
        ip: req.ip,
      });

      if (!nueva_fecha_hora) {
        return res.status(400).json({
          success: false,
          error: "Nueva fecha y hora requeridas",
        });
      }

      // Obtener cita actual
      const currentAppointment = await appointmentService.getAppointmentById(id);
      if (!currentAppointment.success) {
        return res.status(404).json({
          success: false,
          error: "Cita no encontrada",
        });
      }

      const oldDate = currentAppointment.data.fecha_hora;
      const result = await appointmentService.rescheduleAppointment(
        id,
        nueva_fecha_hora,
        reason
      );

      if (result.success) {
        // Obtener cliente para notificación
        const clientResult = await clientModel.getById(
          currentAppointment.data.client_id
        );

        if (clientResult.success) {
          await notificationService.sendAppointmentReschedule(
            result.data,
            clientResult.data,
            oldDate,
            nueva_fecha_hora
          );
        }

        logger.info("✅ Cita reprogramada", {
          appointmentId: id,
          oldDate,
          newDate: nueva_fecha_hora,
        });

        res.json({
          success: true,
          data: result.data,
          message: "Cita reprogramada exitosamente",
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("❌ Error reprogramando cita:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Verificar disponibilidad
   * GET /api/appointments/availability
   */
  async checkAvailability(req, res) {
    try {
      const { fecha, hora, service_id, duracion } = req.query;

      logger.info("🔍 Verificando disponibilidad", {
        fecha,
        hora,
        service_id,
        ip: req.ip,
      });

      if (!fecha || !hora || !service_id) {
        return res.status(400).json({
          success: false,
          error: "Fecha, hora y servicio son requeridos",
        });
      }

      const result = await appointmentService.checkAvailability(
        fecha,
        hora,
        service_id,
        duracion
      );

      res.json({
        success: true,
        available: result.success,
        message: result.success ? "Horario disponible" : result.error,
      });
    } catch (error) {
      logger.error("❌ Error verificando disponibilidad:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Obtener estadísticas de citas
   * GET /api/appointments/stats
   */
  async getAppointmentStats(req, res) {
    try {
      const { date_from, date_to } = req.query;

      logger.info("📊 Obteniendo estadísticas de citas", {
        date_from,
        date_to,
        ip: req.ip,
      });

      const result = await appointmentService.getAppointmentStats(date_from, date_to);

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("❌ Error obteniendo estadísticas:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Obtener horarios disponibles para un día
   * GET /api/appointments/available-slots
   */
  async getAvailableSlots(req, res) {
    try {
      const { fecha, service_id } = req.query;

      logger.info("🕐 Obteniendo horarios disponibles", {
        fecha,
        service_id,
        ip: req.ip,
      });

      if (!fecha || !service_id) {
        return res.status(400).json({
          success: false,
          error: "Fecha y servicio son requeridos",
        });
      }

      const result = await appointmentService.getAvailableSlots(fecha, service_id);

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          total_slots: result.data.length,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("❌ Error obteniendo horarios disponibles:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }
}

module.exports = new AppointmentController();
