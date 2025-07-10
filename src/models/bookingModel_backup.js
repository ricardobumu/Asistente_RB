// src/models/bookingModel.js
const supabase = require("../integrations/supabaseClient");
const logger = require("../utils/logger");
const Validators = require("../utils/validators");

/**
 * BookingModel - Sistema avanzado de gestión de reservas
 *
 * Funcionalidades:
 * - CRUD completo con validaciones
 * - Gestión de estados avanzada
 * - Reprogramación inteligente
 * - Filtros complejos y búsquedas
 * - Validación de disponibilidad
 * - Estadísticas y reportes
 * - Integración con notificaciones
 * - Auditoría completa
 */
class BookingModel {
  constructor() {
    this.tableName = "bookings";
    this.validStatuses = ["pending", "confirmed", "completed", "cancelled"];
    this.validPaymentStatuses = ["pending", "paid", "refunded"];

    // Log de inicialización
    logger.info("BookingModel inicializado", {
      table: this.tableName,
      validStatuses: this.validStatuses.length,
      validPaymentStatuses: this.validPaymentStatuses.length,
    });
  }

  /**
   * Validar datos de reserva
   */
  _validateBookingData(bookingData, isUpdate = false) {
    const validation = Validators.validateBookingData(bookingData);

    if (!validation.isValid) {
      logger.warn("Validación de reserva fallida", {
        errors: validation.errors,
        data: Object.keys(bookingData),
      });
    }

    return validation;
  }

  /**
   * Construir query base con joins
   */
  _buildBaseQuery() {
    return supabase.from(this.tableName).select(`
      *,
      clients (
        id,
        name,
        email,
        phone,
        whatsapp_number,
        preferred_contact_method,
        is_vip
      ),
      services (
        id,
        name,
        description,
        price,
        duration,
        category,
        cancellation_policy_hours,
        requires_deposit
      )
    `);
  }

  /**
   * Crear una nueva reserva con validación completa
   */
  async create(bookingData) {
    const startTime = Date.now();

    try {
      // Validar datos de entrada
      const validation = this._validateBookingData(bookingData);
      if (!validation.isValid) {
        return {
          success: false,
          error: "Datos de reserva inválidos",
          details: validation.errors,
        };
      }

      // Verificar disponibilidad
      const availability = await this.checkAvailability(
        bookingData.booking_date,
        bookingData.booking_time,
        bookingData.service_id
      );

      if (!availability.success || !availability.available) {
        logger.warn("Intento de reserva en horario no disponible", {
          date: bookingData.booking_date,
          time: bookingData.booking_time,
          service_id: bookingData.service_id,
        });
        return {
          success: false,
          error: "Horario no disponible",
        };
      }

      // Obtener información del servicio para calcular precio
      const serviceResult = await supabase
        .from("services")
        .select("price, requires_deposit, deposit_amount")
        .eq("id", bookingData.service_id)
        .single();

      if (serviceResult.error) {
        return { success: false, error: "Servicio no encontrado" };
      }

      const service = serviceResult.data;
      const totalPrice = bookingData.total_price || service.price;

      // Preparar datos para inserción
      const insertData = {
        client_id: bookingData.client_id,
        service_id: bookingData.service_id,
        booking_date: bookingData.booking_date,
        booking_time: bookingData.booking_time,
        status: bookingData.status || "pending",
        notes: Validators.sanitizeText(bookingData.notes) || null,
        total_price: totalPrice,
        payment_status: bookingData.payment_status || "pending",
        calendly_event_id: bookingData.calendly_event_id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from(this.tableName)
        .insert([insertData])
        .select();

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Reserva creada exitosamente", {
        booking_id: data[0].id,
        client_id: bookingData.client_id,
        service_id: bookingData.service_id,
        date: bookingData.booking_date,
        time: bookingData.booking_time,
        total_price: totalPrice,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: data[0],
        message: "Reserva creada exitosamente",
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error creando reserva", error, {
        bookingData: Object.keys(bookingData),
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener reserva por ID con información completa
   */
  async getById(bookingId) {
    const startTime = Date.now();

    try {
      if (!bookingId) {
        return { success: false, error: "ID de reserva requerido" };
      }

      const { data, error } = await this._buildBaseQuery()
        .eq("id", bookingId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return { success: false, error: "Reserva no encontrada" };
        }
        throw error;
      }

      const duration = Date.now() - startTime;
      logger.info("Reserva obtenida por ID", {
        booking_id: bookingId,
        status: data.status,
        client_name: data.clients?.name,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data,
        message: "Reserva encontrada",
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error obteniendo reserva por ID", error, {
        booking_id: bookingId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener reservas por cliente con paginación
   */
  async getByClientId(clientId, options = {}) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select(
          `
          *,
          services (
            id,
            name,
            description,
            price,
            duration
          )
        `
        )
        .eq("client_id", clientId)
        .order("booking_date", { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener reservas por fecha
  async getByDate(date) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select(
          `
          *,
          clients (
            id,
            name,
            email,
            phone,
            whatsapp_number
          ),
          services (
            id,
            name,
            description,
            price,
            duration
          )
        `
        )
        .eq("booking_date", date)
        .order("booking_time");

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener reservas por rango de fechas
  async getByDateRange(startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select(
          `
          *,
          clients (
            id,
            name,
            email,
            phone,
            whatsapp_number
          ),
          services (
            id,
            name,
            description,
            price,
            duration
          )
        `
        )
        .gte("booking_date", startDate)
        .lte("booking_date", endDate)
        .order("booking_date")
        .order("booking_time");

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener reservas por estado
  async getByStatus(status) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select(
          `
          *,
          clients (
            id,
            name,
            email,
            phone,
            whatsapp_number
          ),
          services (
            id,
            name,
            description,
            price,
            duration
          )
        `
        )
        .eq("status", status)
        .order("booking_date")
        .order("booking_time");

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener todas las reservas
  async getAll(limit = 50, offset = 0) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select(
          `
          *,
          clients (
            id,
            name,
            email,
            phone,
            whatsapp_number
          ),
          services (
            id,
            name,
            description,
            price,
            duration
          )
        `
        )
        .order("booking_date", { ascending: false })
        .order("booking_time", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Actualizar reserva
  async update(bookingId, updateData) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Actualizar estado de la reserva
  async updateStatus(bookingId, status) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Actualizar estado de pago
  async updatePaymentStatus(bookingId, paymentStatus) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          payment_status: paymentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Eliminar reserva
  async delete(bookingId) {
    try {
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq("id", bookingId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Verificar disponibilidad
  async checkAvailability(date, time, serviceId, excludeBookingId = null) {
    try {
      let query = supabase
        .from(this.tableName)
        .select("id")
        .eq("booking_date", date)
        .eq("booking_time", time)
        .eq("service_id", serviceId)
        .neq("status", "cancelled");

      if (excludeBookingId) {
        query = query.neq("id", excludeBookingId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, available: data.length === 0 };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener reservas con filtros avanzados
  async getWithFilters(filters) {
    try {
      let query = supabase.from(this.tableName).select(`
          *,
          clients (
            id,
            name,
            email,
            phone,
            whatsapp_number
          ),
          services (
            id,
            name,
            description,
            price,
            duration
          )
        `);

      if (filters.status) {
        query = query.eq("status", filters.status);
      }
      if (filters.payment_status) {
        query = query.eq("payment_status", filters.payment_status);
      }
      if (filters.service_id) {
        query = query.eq("service_id", filters.service_id);
      }
      if (filters.client_id) {
        query = query.eq("client_id", filters.client_id);
      }
      if (filters.date_from) {
        query = query.gte("booking_date", filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte("booking_date", filters.date_to);
      }
      if (filters.created_after) {
        query = query.gte("created_at", filters.created_after);
      }

      const { data, error } = await query
        .order("booking_date", { ascending: false })
        .order("booking_time", { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener reservas próximas (siguientes 7 días)
  async getUpcomingBookings(days = 7) {
    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + days);

      const { data, error } = await supabase
        .from(this.tableName)
        .select(
          `
          *,
          clients (
            id,
            name,
            email,
            phone,
            whatsapp_number
          ),
          services (
            id,
            name,
            description,
            price,
            duration
          )
        `
        )
        .gte("booking_date", today.toISOString().split("T")[0])
        .lte("booking_date", futureDate.toISOString().split("T")[0])
        .in("status", ["pending", "confirmed"])
        .order("booking_date")
        .order("booking_time");

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener reservas que requieren confirmación
  async getPendingConfirmation() {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select(
          `
          *,
          clients (
            id,
            name,
            email,
            phone,
            whatsapp_number
          ),
          services (
            id,
            name,
            description,
            price,
            duration
          )
        `
        )
        .eq("status", "pending")
        .order("created_at");

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Cancelar reserva con razón
  async cancelBooking(bookingId, cancellationReason = null) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          status: "cancelled",
          cancellation_reason: cancellationReason,
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Confirmar reserva
  async confirmBooking(bookingId) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Marcar como completada
  async completeBooking(bookingId) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener estadísticas de reservas
  async getBookingStats(startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("status, total_price, booking_date, payment_status")
        .gte("booking_date", startDate)
        .lte("booking_date", endDate);

      if (error) throw error;

      const stats = {
        totalBookings: data.length,
        pendingBookings: data.filter((b) => b.status === "pending").length,
        confirmedBookings: data.filter((b) => b.status === "confirmed").length,
        completedBookings: data.filter((b) => b.status === "completed").length,
        cancelledBookings: data.filter((b) => b.status === "cancelled").length,
        totalRevenue: data
          .filter(
            (b) => b.status === "completed" && b.payment_status === "paid"
          )
          .reduce((sum, b) => sum + (b.total_price || 0), 0),
        pendingPayments: data
          .filter((b) => b.payment_status === "pending")
          .reduce((sum, b) => sum + (b.total_price || 0), 0),
      };

      return { success: true, data: stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener horarios disponibles para un servicio en una fecha
  async getAvailableTimeSlots(serviceId, date) {
    try {
      // Obtener el servicio para conocer los horarios disponibles
      const { data: service, error: serviceError } = await supabase
        .from("services")
        .select("available_time_slots, duration")
        .eq("id", serviceId)
        .single();

      if (serviceError) throw serviceError;

      // Obtener reservas existentes para esa fecha y servicio
      const { data: existingBookings, error: bookingsError } = await supabase
        .from(this.tableName)
        .select("booking_time")
        .eq("service_id", serviceId)
        .eq("booking_date", date)
        .neq("status", "cancelled");

      if (bookingsError) throw bookingsError;

      const bookedTimes = existingBookings.map((b) => b.booking_time);
      const availableSlots = service.available_time_slots.filter(
        (slot) => !bookedTimes.includes(slot)
      );

      return { success: true, data: availableSlots };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Reprogramar reserva
  async rescheduleBooking(bookingId, newDate, newTime) {
    try {
      // Verificar disponibilidad del nuevo horario
      const booking = await this.getById(bookingId);
      if (!booking.success) {
        return booking;
      }

      const availability = await this.checkAvailability(
        newDate,
        newTime,
        booking.data.service_id,
        bookingId
      );

      if (!availability.success || !availability.available) {
        return {
          success: false,
          error: "El horario seleccionado no está disponible",
        };
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          booking_date: newDate,
          booking_time: newTime,
          rescheduled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new BookingModel();
