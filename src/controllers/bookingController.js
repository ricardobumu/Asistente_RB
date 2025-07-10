// src/controllers/bookingController.js
// Controlador para gestión de reservas con validaciones y lógica de negocio

const bookingService = require("../services/bookingService");
const notificationService = require("../services/notificationService");
const clientModel = require("../models/clientModel");
const serviceModel = require("../models/serviceModel");
const logger = require("../utils/logger");
const {
  validateBookingData,
  validateDateRange,
} = require("../utils/validators");

class BookingController {
  /**
   * Crear nueva reserva
   * POST /api/bookings
   */
  async createBooking(req, res) {
    try {
      logger.info("📅 Creando nueva reserva", {
        body: req.body,
        ip: req.ip,
      });

      // Validar datos de entrada
      const validation = validateBookingData(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: "Datos de reserva inválidos",
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

      // Crear la reserva
      const bookingData = {
        client_id,
        service_id,
        fecha_hora,
        notas: notas || "",
        estado: "pending",
        precio: serviceResult.data.precio,
        duracion: serviceResult.data.duracion,
      };

      const result = await bookingService.createBooking(bookingData);

      if (result.success) {
        // Enviar notificación de confirmación
        await notificationService.sendBookingConfirmation(
          result.data,
          clientResult.data
        );

        logger.info("✅ Reserva creada exitosamente", {
          bookingId: result.data.id_reserva,
          clientId: client_id,
          serviceId: service_id,
        });

        res.status(201).json({
          success: true,
          data: result.data,
          message: "Reserva creada exitosamente",
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("❌ Error creando reserva:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Obtener todas las reservas con filtros
   * GET /api/bookings
   */
  async getBookings(req, res) {
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

      logger.info("📋 Obteniendo reservas", {
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

      const result = await bookingService.getBookings(filters, options);

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
      logger.error("❌ Error obteniendo reservas:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Obtener reserva por ID
   * GET /api/bookings/:id
   */
  async getBookingById(req, res) {
    try {
      const { id } = req.params;

      logger.info("📋 Obteniendo reserva por ID", {
        bookingId: id,
        ip: req.ip,
      });

      const result = await bookingService.getBookingById(id);

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
        });
      } else {
        res.status(404).json({
          success: false,
          error: "Reserva no encontrada",
        });
      }
    } catch (error) {
      logger.error("❌ Error obteniendo reserva:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Actualizar reserva
   * PUT /api/bookings/:id
   */
  async updateBooking(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      logger.info("📝 Actualizando reserva", {
        bookingId: id,
        updateData,
        ip: req.ip,
      });

      // Obtener reserva actual
      const currentBooking = await bookingService.getBookingById(id);
      if (!currentBooking.success) {
        return res.status(404).json({
          success: false,
          error: "Reserva no encontrada",
        });
      }

      const result = await bookingService.updateBooking(id, updateData);

      if (result.success) {
        logger.info("✅ Reserva actualizada", {
          bookingId: id,
          changes: Object.keys(updateData),
        });

        res.json({
          success: true,
          data: result.data,
          message: "Reserva actualizada exitosamente",
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("❌ Error actualizando reserva:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Cancelar reserva
   * POST /api/bookings/:id/cancel
   */
  async cancelBooking(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      logger.info("❌ Cancelando reserva", {
        bookingId: id,
        reason,
        ip: req.ip,
      });

      // Obtener reserva y cliente
      const bookingResult = await bookingService.getBookingById(id);
      if (!bookingResult.success) {
        return res.status(404).json({
          success: false,
          error: "Reserva no encontrada",
        });
      }

      const clientResult = await clientModel.getById(
        bookingResult.data.client_id
      );

      const result = await bookingService.cancelBooking(id, reason);

      if (result.success) {
        // Enviar notificación de cancelación
        if (clientResult.success) {
          await notificationService.sendBookingCancellation(
            bookingResult.data,
            clientResult.data,
            reason
          );
        }

        logger.info("✅ Reserva cancelada", {
          bookingId: id,
          reason,
        });

        res.json({
          success: true,
          data: result.data,
          message: "Reserva cancelada exitosamente",
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("❌ Error cancelando reserva:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Confirmar reserva
   * POST /api/bookings/:id/confirm
   */
  async confirmBooking(req, res) {
    try {
      const { id } = req.params;

      logger.info("✅ Confirmando reserva", {
        bookingId: id,
        ip: req.ip,
      });

      const result = await bookingService.confirmBooking(id);

      if (result.success) {
        logger.info("✅ Reserva confirmada", { bookingId: id });

        res.json({
          success: true,
          data: result.data,
          message: "Reserva confirmada exitosamente",
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("❌ Error confirmando reserva:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Reprogramar reserva
   * POST /api/bookings/:id/reschedule
   */
  async rescheduleBooking(req, res) {
    try {
      const { id } = req.params;
      const { nueva_fecha_hora, reason } = req.body;

      logger.info("🔄 Reprogramando reserva", {
        bookingId: id,
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

      // Obtener reserva actual
      const currentBooking = await bookingService.getBookingById(id);
      if (!currentBooking.success) {
        return res.status(404).json({
          success: false,
          error: "Reserva no encontrada",
        });
      }

      const oldDate = currentBooking.data.fecha_hora;
      const result = await bookingService.rescheduleBooking(
        id,
        nueva_fecha_hora,
        reason
      );

      if (result.success) {
        // Obtener cliente para notificación
        const clientResult = await clientModel.getById(
          currentBooking.data.client_id
        );

        if (clientResult.success) {
          await notificationService.sendBookingReschedule(
            result.data,
            clientResult.data,
            oldDate,
            nueva_fecha_hora
          );
        }

        logger.info("✅ Reserva reprogramada", {
          bookingId: id,
          oldDate,
          newDate: nueva_fecha_hora,
        });

        res.json({
          success: true,
          data: result.data,
          message: "Reserva reprogramada exitosamente",
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("❌ Error reprogramando reserva:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Verificar disponibilidad
   * GET /api/bookings/availability
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

      const result = await bookingService.checkAvailability(
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
   * Obtener estadísticas de reservas
   * GET /api/bookings/stats
   */
  async getBookingStats(req, res) {
    try {
      const { date_from, date_to } = req.query;

      logger.info("📊 Obteniendo estadísticas de reservas", {
        date_from,
        date_to,
        ip: req.ip,
      });

      const result = await bookingService.getBookingStats(date_from, date_to);

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
   * GET /api/bookings/available-slots
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

      const result = await bookingService.getAvailableSlots(fecha, service_id);

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

module.exports = new BookingController();
