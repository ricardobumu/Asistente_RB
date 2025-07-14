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
    // Usar consulta simple sin joins por ahora para evitar errores de relación
    return supabase.from(this.tableName).select('*');
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
    const startTime = Date.now();
    const { limit = 20, offset = 0, includeCompleted = true } = options;

    try {
      if (!clientId) {
        return { success: false, error: "ID de cliente requerido" };
      }

      let query = this._buildBaseQuery().eq("client_id", clientId);

      if (!includeCompleted) {
        query = query.neq("status", "completed");
      }

      const { data, error } = await query
        .order("booking_date", { ascending: false })
        .order("booking_time", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Reservas obtenidas por cliente", {
        client_id: clientId,
        count: data.length,
        includeCompleted,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data,
        pagination: { limit, offset, count: data.length },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error obteniendo reservas por cliente", error, {
        client_id: clientId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener reservas por fecha con información completa
   */
  async getByDate(date) {
    const startTime = Date.now();

    try {
      if (!Validators.isValidDate(date)) {
        return { success: false, error: "Fecha inválida" };
      }

      const { data, error } = await this._buildBaseQuery()
        .eq("booking_date", date)
        .order("booking_time");

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Reservas obtenidas por fecha", {
        date,
        count: data.length,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data,
        summary: {
          date,
          totalBookings: data.length,
          byStatus: this._groupByStatus(data),
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error obteniendo reservas por fecha", error, {
        date,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Búsqueda avanzada con filtros múltiples
   */
  async searchAdvanced(filters = {}, options = {}) {
    const startTime = Date.now();
    const {
      limit = 50,
      offset = 0,
      sortBy = "booking_date",
      sortOrder = "desc",
    } = options;

    try {
      // Validar paginación
      const pagination = Validators.validatePagination(limit, offset);
      if (!pagination.isValid) {
        return {
          success: false,
          error: "Parámetros de paginación inválidos",
          details: pagination.errors,
        };
      }

      let query = this._buildBaseQuery();

      // Aplicar filtros
      if (filters.status && this.validStatuses.includes(filters.status)) {
        query = query.eq("status", filters.status);
      }

      if (
        filters.payment_status &&
        this.validPaymentStatuses.includes(filters.payment_status)
      ) {
        query = query.eq("payment_status", filters.payment_status);
      }

      if (filters.service_id) {
        query = query.eq("service_id", filters.service_id);
      }

      if (filters.client_id) {
        query = query.eq("client_id", filters.client_id);
      }

      if (filters.date_from && Validators.isValidDate(filters.date_from)) {
        query = query.gte("booking_date", filters.date_from);
      }

      if (filters.date_to && Validators.isValidDate(filters.date_to)) {
        query = query.lte("booking_date", filters.date_to);
      }

      if (filters.created_after) {
        query = query.gte("created_at", filters.created_after);
      }

      if (filters.min_price) {
        query = query.gte("total_price", filters.min_price);
      }

      if (filters.max_price) {
        query = query.lte("total_price", filters.max_price);
      }

      // Búsqueda por texto en notas
      if (filters.search_text) {
        query = query.ilike("notes", `%${filters.search_text}%`);
      }

      // Aplicar ordenamiento
      const ascending = sortOrder === "asc";
      query = query.order(sortBy, { ascending });

      if (sortBy !== "booking_time") {
        query = query.order("booking_time", { ascending });
      }

      // Aplicar paginación
      query = query.range(
        pagination.offset,
        pagination.offset + pagination.limit - 1
      );

      const { data, error } = await query;
      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Búsqueda avanzada completada", {
        filtersApplied: Object.keys(filters).length,
        resultsCount: data.length,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data,
        pagination: {
          limit: pagination.limit,
          offset: pagination.offset,
          count: data.length,
        },
        filters: filters,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error en búsqueda avanzada", error, {
        filters: Object.keys(filters),
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Reprogramar reserva con validación completa
   */
  async rescheduleBooking(bookingId, newDate, newTime, reason = null) {
    const startTime = Date.now();

    try {
      if (!bookingId || !newDate || !newTime) {
        return { success: false, error: "Datos de reprogramación incompletos" };
      }

      if (
        !Validators.isValidDate(newDate) ||
        !Validators.isValidTime(newTime)
      ) {
        return { success: false, error: "Fecha u hora inválida" };
      }

      // Obtener reserva actual
      const currentBooking = await this.getById(bookingId);
      if (!currentBooking.success) {
        return { success: false, error: "Reserva no encontrada" };
      }

      const booking = currentBooking.data;

      // Verificar que la reserva se puede reprogramar
      if (booking.status === "completed" || booking.status === "cancelled") {
        return {
          success: false,
          error: "No se puede reprogramar una reserva completada o cancelada",
        };
      }

      // Verificar disponibilidad en el nuevo horario
      const availability = await this.checkAvailability(
        newDate,
        newTime,
        booking.service_id,
        bookingId
      );
      if (!availability.success || !availability.available) {
        return { success: false, error: "El nuevo horario no está disponible" };
      }

      // Actualizar la reserva
      const updateData = {
        booking_date: newDate,
        booking_time: newTime,
        rescheduled_at: new Date().toISOString(),
        notes: booking.notes
          ? `${booking.notes}\n[Reprogramada: ${
              reason || "Sin razón especificada"
            }]`
          : `[Reprogramada: ${reason || "Sin razón especificada"}]`,
      };

      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId)
        .select();

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Reserva reprogramada exitosamente", {
        booking_id: bookingId,
        old_date: booking.booking_date,
        old_time: booking.booking_time,
        new_date: newDate,
        new_time: newTime,
        reason,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: data[0],
        message: "Reserva reprogramada exitosamente",
        changes: {
          from: { date: booking.booking_date, time: booking.booking_time },
          to: { date: newDate, time: newTime },
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error reprogramando reserva", error, {
        booking_id: bookingId,
        new_date: newDate,
        new_time: newTime,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Verificar disponibilidad avanzada con validaciones
   */
  async checkAvailability(date, time, serviceId, excludeBookingId = null) {
    const startTime = Date.now();

    try {
      if (!date || !time || !serviceId) {
        return {
          success: false,
          error: "Parámetros de disponibilidad incompletos",
        };
      }

      if (!Validators.isValidDate(date) || !Validators.isValidTime(time)) {
        return { success: false, error: "Fecha u hora inválida" };
      }

      // Verificar que la fecha no sea en el pasado
      const bookingDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (bookingDate < today) {
        return {
          success: false,
          available: false,
          reason: "No se pueden hacer reservas en fechas pasadas",
        };
      }

      // Obtener información del servicio
      const { data: service, error: serviceError } = await supabase
        .from("services")
        .select(
          "available_days, available_time_slots, min_advance_booking_hours, max_advance_booking_days"
        )
        .eq("id", serviceId)
        .eq("is_active", true)
        .single();

      if (serviceError) {
        return { success: false, error: "Servicio no encontrado o inactivo" };
      }

      // Verificar día de la semana
      const dayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const dayOfWeek = dayNames[bookingDate.getDay()];

      if (
        service.available_days &&
        !service.available_days.includes(dayOfWeek)
      ) {
        return {
          success: false,
          available: false,
          reason: `Servicio no disponible los ${dayOfWeek}s`,
        };
      }

      // Verificar horario disponible
      if (
        service.available_time_slots &&
        !service.available_time_slots.includes(time)
      ) {
        return {
          success: false,
          available: false,
          reason: "Horario no disponible para este servicio",
        };
      }

      // Verificar reservas existentes
      let query = supabase
        .from(this.tableName)
        .select("id, status")
        .eq("booking_date", date)
        .eq("booking_time", time)
        .eq("service_id", serviceId)
        .neq("status", "cancelled");

      if (excludeBookingId) {
        query = query.neq("id", excludeBookingId);
      }

      const { data: existingBookings, error } = await query;
      if (error) throw error;

      const isAvailable = existingBookings.length === 0;

      const duration = Date.now() - startTime;
      logger.info("Verificación de disponibilidad", {
        date,
        time,
        service_id: serviceId,
        available: isAvailable,
        existing_bookings: existingBookings.length,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        available: isAvailable,
        reason: isAvailable ? null : "Horario ya reservado",
        conflictingBookings: existingBookings,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error verificando disponibilidad", error, {
        date,
        time,
        service_id: serviceId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener estadísticas avanzadas de reservas
   */
  async getAdvancedStats(startDate, endDate, groupBy = "day") {
    const startTime = Date.now();

    try {
      if (
        !Validators.isValidDate(startDate) ||
        !Validators.isValidDate(endDate)
      ) {
        return { success: false, error: "Fechas inválidas" };
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .select(
          `
          status, 
          total_price, 
          booking_date, 
          payment_status,
          created_at,
          services (name, category),
          clients (is_vip)
        `
        )
        .gte("booking_date", startDate)
        .lte("booking_date", endDate);

      if (error) throw error;

      // Estadísticas básicas
      const basicStats = {
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
        averageBookingValue:
          data.length > 0
            ? data.reduce((sum, b) => sum + (b.total_price || 0), 0) /
              data.length
            : 0,
      };

      // Estadísticas por categoría de servicio
      const serviceCategories = {};
      data.forEach((booking) => {
        const category = booking.services?.category || "Sin categoría";
        if (!serviceCategories[category]) {
          serviceCategories[category] = { count: 0, revenue: 0 };
        }
        serviceCategories[category].count++;
        if (
          booking.status === "completed" &&
          booking.payment_status === "paid"
        ) {
          serviceCategories[category].revenue += booking.total_price || 0;
        }
      });

      // Estadísticas de clientes VIP
      const vipStats = {
        totalVipBookings: data.filter((b) => b.clients?.is_vip).length,
        vipRevenue: data
          .filter(
            (b) =>
              b.clients?.is_vip &&
              b.status === "completed" &&
              b.payment_status === "paid"
          )
          .reduce((sum, b) => sum + (b.total_price || 0), 0),
      };

      // Tasa de conversión
      const conversionRate =
        basicStats.totalBookings > 0
          ? (basicStats.completedBookings / basicStats.totalBookings) * 100
          : 0;

      // Tasa de cancelación
      const cancellationRate =
        basicStats.totalBookings > 0
          ? (basicStats.cancelledBookings / basicStats.totalBookings) * 100
          : 0;

      const duration = Date.now() - startTime;
      logger.info("Estadísticas avanzadas generadas", {
        period: `${startDate} to ${endDate}`,
        totalBookings: basicStats.totalBookings,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: {
          period: { startDate, endDate },
          basic: basicStats,
          serviceCategories,
          vipStats,
          rates: {
            conversion: Math.round(conversionRate * 100) / 100,
            cancellation: Math.round(cancellationRate * 100) / 100,
          },
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error generando estadísticas avanzadas", error, {
        startDate,
        endDate,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener horarios disponibles para un servicio en una fecha
   */
  async getAvailableTimeSlots(serviceId, date) {
    const startTime = Date.now();

    try {
      if (!serviceId || !date) {
        return { success: false, error: "Parámetros requeridos faltantes" };
      }

      if (!Validators.isValidDate(date)) {
        return { success: false, error: "Fecha inválida" };
      }

      // Obtener información del servicio
      const { data: service, error: serviceError } = await supabase
        .from("services")
        .select("available_time_slots, duration, available_days")
        .eq("id", serviceId)
        .eq("is_active", true)
        .single();

      if (serviceError) {
        return { success: false, error: "Servicio no encontrado o inactivo" };
      }

      // Verificar si el servicio está disponible ese día
      const bookingDate = new Date(date);
      const dayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const dayOfWeek = dayNames[bookingDate.getDay()];

      if (
        service.available_days &&
        !service.available_days.includes(dayOfWeek)
      ) {
        return {
          success: true,
          data: [],
          message: `Servicio no disponible los ${dayOfWeek}s`,
        };
      }

      // Obtener reservas existentes
      const { data: existingBookings, error: bookingsError } = await supabase
        .from(this.tableName)
        .select("booking_time")
        .eq("service_id", serviceId)
        .eq("booking_date", date)
        .neq("status", "cancelled");

      if (bookingsError) throw bookingsError;

      // Filtrar horarios ocupados
      const occupiedTimes = existingBookings.map((b) => b.booking_time);
      const availableSlots = (service.available_time_slots || [])
        .filter((slot) => !occupiedTimes.includes(slot))
        .sort();

      const duration = Date.now() - startTime;
      logger.info("Horarios disponibles obtenidos", {
        service_id: serviceId,
        date,
        total_slots: service.available_time_slots?.length || 0,
        available_slots: availableSlots.length,
        occupied_slots: occupiedTimes.length,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: availableSlots,
        summary: {
          date,
          totalSlots: service.available_time_slots?.length || 0,
          availableSlots: availableSlots.length,
          occupiedSlots: occupiedTimes.length,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error obteniendo horarios disponibles", error, {
        service_id: serviceId,
        date,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Cancelar reserva con validación de políticas
   */
  async cancelBookingAdvanced(
    bookingId,
    cancellationReason = null,
    cancelledBy = "client"
  ) {
    const startTime = Date.now();

    try {
      if (!bookingId) {
        return { success: false, error: "ID de reserva requerido" };
      }

      // Obtener reserva con información del servicio
      const { data: booking, error: bookingError } = await supabase
        .from(this.tableName)
        .select(
          `
          *,
          services (
            name,
            cancellation_policy_hours,
            requires_deposit
          )
        `
        )
        .eq("id", bookingId)
        .single();

      if (bookingError) {
        return { success: false, error: "Reserva no encontrada" };
      }

      // Verificar si ya está cancelada
      if (booking.status === "cancelled") {
        return { success: false, error: "La reserva ya está cancelada" };
      }

      // Verificar si ya está completada
      if (booking.status === "completed") {
        return {
          success: false,
          error: "No se puede cancelar una reserva completada",
        };
      }

      // Verificar política de cancelación
      const bookingDateTime = new Date(
        `${booking.booking_date}T${booking.booking_time}`
      );
      const now = new Date();
      const hoursUntilBooking = (bookingDateTime - now) / (1000 * 60 * 60);

      const policyHours = booking.services?.cancellation_policy_hours || 24;
      const canCancelWithoutPenalty = hoursUntilBooking >= policyHours;

      // Actualizar reserva
      const updateData = {
        status: "cancelled",
        cancellation_reason:
          Validators.sanitizeText(cancellationReason) ||
          "Sin razón especificada",
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from(this.tableName)
        .update(updateData)
        .eq("id", bookingId)
        .select();

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Reserva cancelada", {
        booking_id: bookingId,
        cancelled_by: cancelledBy,
        reason: cancellationReason,
        hours_until_booking: Math.round(hoursUntilBooking * 100) / 100,
        can_cancel_without_penalty: canCancelWithoutPenalty,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: data[0],
        message: "Reserva cancelada exitosamente",
        cancellationInfo: {
          hoursUntilBooking: Math.round(hoursUntilBooking * 100) / 100,
          policyHours,
          canCancelWithoutPenalty,
          cancelledBy,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error cancelando reserva", error, {
        booking_id: bookingId,
        cancelled_by: cancelledBy,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Confirmar reserva con validaciones
   */
  async confirmBookingAdvanced(bookingId, confirmedBy = "system") {
    const startTime = Date.now();

    try {
      if (!bookingId) {
        return { success: false, error: "ID de reserva requerido" };
      }

      // Obtener reserva actual
      const currentBooking = await this.getById(bookingId);
      if (!currentBooking.success) {
        return { success: false, error: "Reserva no encontrada" };
      }

      const booking = currentBooking.data;

      // Verificar estado actual
      if (booking.status === "confirmed") {
        return { success: false, error: "La reserva ya está confirmada" };
      }

      if (booking.status === "cancelled") {
        return {
          success: false,
          error: "No se puede confirmar una reserva cancelada",
        };
      }

      if (booking.status === "completed") {
        return { success: false, error: "La reserva ya está completada" };
      }

      // Verificar disponibilidad nuevamente
      const availability = await this.checkAvailability(
        booking.booking_date,
        booking.booking_time,
        booking.service_id,
        bookingId
      );

      if (!availability.success || !availability.available) {
        return { success: false, error: "El horario ya no está disponible" };
      }

      // Confirmar reserva
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

      const duration = Date.now() - startTime;
      logger.info("Reserva confirmada", {
        booking_id: bookingId,
        confirmed_by: confirmedBy,
        client_name: booking.clients?.name,
        service_name: booking.services?.name,
        booking_date: booking.booking_date,
        booking_time: booking.booking_time,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: data[0],
        message: "Reserva confirmada exitosamente",
        confirmationInfo: {
          confirmedBy,
          confirmedAt: data[0].confirmed_at,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error confirmando reserva", error, {
        booking_id: bookingId,
        confirmed_by: confirmedBy,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Completar reserva
   */
  async completeBookingAdvanced(
    bookingId,
    completedBy = "system",
    notes = null
  ) {
    const startTime = Date.now();

    try {
      if (!bookingId) {
        return { success: false, error: "ID de reserva requerido" };
      }

      // Obtener reserva actual
      const currentBooking = await this.getById(bookingId);
      if (!currentBooking.success) {
        return { success: false, error: "Reserva no encontrada" };
      }

      const booking = currentBooking.data;

      // Verificar estado actual
      if (booking.status === "completed") {
        return { success: false, error: "La reserva ya está completada" };
      }

      if (booking.status === "cancelled") {
        return {
          success: false,
          error: "No se puede completar una reserva cancelada",
        };
      }

      // Preparar datos de actualización
      const updateData = {
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Agregar notas si se proporcionan
      if (notes) {
        const existingNotes = booking.notes || "";
        updateData.notes = existingNotes
          ? `${existingNotes}\n[Completada: ${Validators.sanitizeText(notes)}]`
          : `[Completada: ${Validators.sanitizeText(notes)}]`;
      }

      // Completar reserva
      const { data, error } = await supabase
        .from(this.tableName)
        .update(updateData)
        .eq("id", bookingId)
        .select();

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Reserva completada", {
        booking_id: bookingId,
        completed_by: completedBy,
        client_name: booking.clients?.name,
        service_name: booking.services?.name,
        total_price: booking.total_price,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: data[0],
        message: "Reserva completada exitosamente",
        completionInfo: {
          completedBy,
          completedAt: data[0].completed_at,
          totalPrice: booking.total_price,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error completando reserva", error, {
        booking_id: bookingId,
        completed_by: completedBy,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener reservas próximas con filtros avanzados
   */
  async getUpcomingBookingsAdvanced(options = {}) {
    const startTime = Date.now();
    const {
      days = 7,
      statuses = ["pending", "confirmed"],
      includeVipOnly = false,
      serviceCategory = null,
      limit = 50,
    } = options;

    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + days);

      let query = this._buildBaseQuery()
        .gte("booking_date", today.toISOString().split("T")[0])
        .lte("booking_date", futureDate.toISOString().split("T")[0])
        .in("status", statuses);

      if (includeVipOnly) {
        query = query.eq("clients.is_vip", true);
      }

      if (serviceCategory) {
        query = query.eq("services.category", serviceCategory);
      }

      const { data, error } = await query
        .order("booking_date")
        .order("booking_time")
        .limit(limit);

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Reservas próximas obtenidas", {
        days,
        statuses,
        count: data.length,
        includeVipOnly,
        serviceCategory,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data,
        summary: {
          period: `${days} días`,
          totalBookings: data.length,
          byStatus: this._groupByStatus(data),
          vipBookings: data.filter((b) => b.clients?.is_vip).length,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error obteniendo reservas próximas", error, {
        days,
        statuses,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Método auxiliar para agrupar por estado
   */
  _groupByStatus(bookings) {
    return bookings.reduce((acc, booking) => {
      acc[booking.status] = (acc[booking.status] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Actualizar reserva con validaciones completas
   */
  async updateAdvanced(bookingId, updateData, updatedBy = "system") {
    const startTime = Date.now();

    try {
      if (!bookingId) {
        return { success: false, error: "ID de reserva requerido" };
      }

      // Validar datos de actualización si incluyen campos críticos
      if (
        updateData.booking_date ||
        updateData.booking_time ||
        updateData.service_id
      ) {
        const validation = this._validateBookingData(updateData, true);
        if (!validation.isValid) {
          return {
            success: false,
            error: "Datos de actualización inválidos",
            details: validation.errors,
          };
        }
      }

      // Obtener reserva actual
      const currentBooking = await this.getById(bookingId);
      if (!currentBooking.success) {
        return { success: false, error: "Reserva no encontrada" };
      }

      const booking = currentBooking.data;

      // Si se está cambiando fecha/hora/servicio, verificar disponibilidad
      if (
        updateData.booking_date ||
        updateData.booking_time ||
        updateData.service_id
      ) {
        const newDate = updateData.booking_date || booking.booking_date;
        const newTime = updateData.booking_time || booking.booking_time;
        const newServiceId = updateData.service_id || booking.service_id;

        const availability = await this.checkAvailability(
          newDate,
          newTime,
          newServiceId,
          bookingId
        );
        if (!availability.success || !availability.available) {
          return {
            success: false,
            error: "El nuevo horario no está disponible",
          };
        }
      }

      // Sanitizar notas si se proporcionan
      if (updateData.notes) {
        updateData.notes = Validators.sanitizeText(updateData.notes);
      }

      // Preparar datos de actualización
      const finalUpdateData = {
        ...updateData,
        updated_at: new Date().toISOString(),
      };

      // Actualizar reserva
      const { data, error } = await supabase
        .from(this.tableName)
        .update(finalUpdateData)
        .eq("id", bookingId)
        .select();

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Reserva actualizada", {
        booking_id: bookingId,
        updated_by: updatedBy,
        fields_updated: Object.keys(updateData),
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: data[0],
        message: "Reserva actualizada exitosamente",
        updateInfo: {
          updatedBy,
          fieldsUpdated: Object.keys(updateData),
          updatedAt: data[0].updated_at,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error actualizando reserva", error, {
        booking_id: bookingId,
        updated_by: updatedBy,
        fields: Object.keys(updateData),
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Eliminar reserva con auditoría
   */
  async deleteAdvanced(bookingId, deletedBy = "system", reason = null) {
    const startTime = Date.now();

    try {
      if (!bookingId) {
        return { success: false, error: "ID de reserva requerido" };
      }

      // Obtener información de la reserva antes de eliminar
      const currentBooking = await this.getById(bookingId);
      if (!currentBooking.success) {
        return { success: false, error: "Reserva no encontrada" };
      }

      const booking = currentBooking.data;

      // Eliminar reserva
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq("id", bookingId);

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Reserva eliminada", {
        booking_id: bookingId,
        deleted_by: deletedBy,
        reason: reason || "Sin razón especificada",
        client_name: booking.clients?.name,
        service_name: booking.services?.name,
        booking_date: booking.booking_date,
        booking_time: booking.booking_time,
        status: booking.status,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        message: "Reserva eliminada exitosamente",
        deletionInfo: {
          deletedBy,
          reason: reason || "Sin razón especificada",
          deletedAt: new Date().toISOString(),
          bookingInfo: {
            client: booking.clients?.name,
            service: booking.services?.name,
            date: booking.booking_date,
            time: booking.booking_time,
            status: booking.status,
          },
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error eliminando reserva", error, {
        booking_id: bookingId,
        deleted_by: deletedBy,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  // Métodos de compatibilidad con la versión anterior
  async getAll(limit = 50, offset = 0) {
    return this.searchAdvanced({}, { limit, offset });
  }

  async getByStatus(status) {
    return this.searchAdvanced({ status });
  }

  async getByDateRange(startDate, endDate) {
    return this.searchAdvanced({ date_from: startDate, date_to: endDate });
  }

  async getWithFilters(filters) {
    return this.searchAdvanced(filters);
  }

  async getUpcomingBookings(days = 7) {
    return this.getUpcomingBookingsAdvanced({ days });
  }

  async getPendingConfirmation() {
    return this.searchAdvanced({ status: "pending" });
  }

  async cancelBooking(bookingId, cancellationReason = null) {
    return this.cancelBookingAdvanced(bookingId, cancellationReason);
  }

  async confirmBooking(bookingId) {
    return this.confirmBookingAdvanced(bookingId);
  }

  async completeBooking(bookingId) {
    return this.completeBookingAdvanced(bookingId);
  }

  async update(bookingId, updateData) {
    return this.updateAdvanced(bookingId, updateData);
  }

  async updateStatus(bookingId, status) {
    return this.updateAdvanced(bookingId, { status });
  }

  async updatePaymentStatus(bookingId, paymentStatus) {
    return this.updateAdvanced(bookingId, { payment_status: paymentStatus });
  }

  async delete(bookingId) {
    return this.deleteAdvanced(bookingId);
  }

  async getBookingStats(startDate, endDate) {
    const result = await this.getAdvancedStats(startDate, endDate);
    if (result.success) {
      return { success: true, data: result.data.basic };
    }
    return result;
  }

  /**
   * Obtener reservas próximas para el programador de notificaciones
   */
  async getUpcoming(fromDate, toDate) {
    const startTime = Date.now();

    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select(
          `
          id,
          client_id,
          service_id,
          service_name,
          appointment_date,
          appointment_time,
          status,
          clients (
            id,
            name,
            phone,
            whatsapp_number,
            preferred_contact_method
          ),
          services (
            id,
            name,
            category,
            duration
          )
        `
        )
        .gte("appointment_date", fromDate.toISOString().split("T")[0])
        .lte("appointment_date", toDate.toISOString().split("T")[0])
        .in("status", ["pending", "confirmed"])
        .order("appointment_date")
        .order("appointment_time");

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Reservas próximas obtenidas para notificaciones", {
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
        count: data.length,
        duration: `${duration}ms`,
      });

      return { success: true, data };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        "Error obteniendo reservas próximas para notificaciones",
        error,
        {
          fromDate: fromDate.toISOString(),
          toDate: toDate.toISOString(),
          duration: `${duration}ms`,
        }
      );
      return { success: false, error: error.message };
    }
  }
}

module.exports = BookingModel;
