// src/models/serviceModel.js
const supabase = require("../integrations/supabaseClient");
const logger = require("../utils/logger");
const Validators = require("../utils/validators");

/**
 * ServiceModel - Sistema avanzado de gestión de servicios
 *
 * Funcionalidades:
 * - CRUD completo con validaciones
 * - Gestión avanzada de categorías
 * - Políticas de cancelación configurables
 * - Configuración de horarios inteligente
 * - Gestión de precios y descuentos
 * - Análisis de rendimiento por servicio
 * - Gestión de disponibilidad avanzada
 * - Integración con sistema de reservas
 * - Auditoría completa
 */
class ServiceModel {
  constructor() {
    this.tableName = "services";
    this.validCategories = [
      "masajes",
      "faciales",
      "corporales",
      "relajacion",
      "terapeuticos",
      "esteticos",
      "premium",
      "vip",
      "general",
    ];
    this.validDays = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];
    this.defaultTimeSlots = [
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
    ];

    // Log de inicialización
    logger.info("ServiceModel inicializado", {
      table: this.tableName,
      validCategories: this.validCategories.length,
      validDays: this.validDays.length,
      defaultTimeSlots: this.defaultTimeSlots.length,
    });
  }

  /**
   * Validar datos de servicio
   */
  _validateServiceData(serviceData, isUpdate = false) {
    const validation = Validators.validateServiceData(serviceData, isUpdate);

    if (!validation.isValid) {
      logger.warn("Validación de servicio fallida", {
        errors: validation.errors,
        data: Object.keys(serviceData),
      });
    }

    return validation;
  }

  /**
   * Construir query base con información relacionada
   */
  _buildBaseQuery() {
    return supabase.from(this.tableName).select(`
      *,
      service_categories (
        id,
        name,
        description,
        color,
        icon
      )
    `);
  }

  /**
   * Crear un nuevo servicio con validación completa
   */
  async create(serviceData) {
    const startTime = Date.now();

    try {
      // Validar datos de entrada
      const validation = this._validateServiceData(serviceData);
      if (!validation.isValid) {
        return {
          success: false,
          error: "Datos de servicio inválidos",
          details: validation.errors,
        };
      }

      // Verificar que la categoría existe
      if (
        serviceData.category &&
        !this.validCategories.includes(serviceData.category)
      ) {
        return { success: false, error: "Categoría de servicio inválida" };
      }

      // Validar horarios disponibles
      if (serviceData.available_time_slots) {
        const invalidSlots = serviceData.available_time_slots.filter(
          (slot) => !Validators.isValidTime(slot)
        );
        if (invalidSlots.length > 0) {
          return {
            success: false,
            error: "Horarios inválidos detectados",
            details: invalidSlots,
          };
        }
      }

      // Validar días disponibles
      if (serviceData.available_days) {
        const invalidDays = serviceData.available_days.filter(
          (day) => !this.validDays.includes(day)
        );
        if (invalidDays.length > 0) {
          return {
            success: false,
            error: "Días inválidos detectados",
            details: invalidDays,
          };
        }
      }

      // Preparar datos para inserción
      const insertData = {
        name: Validators.sanitizeText(serviceData.name),
        description: Validators.sanitizeText(serviceData.description) || null,
        price: serviceData.price,
        duration: serviceData.duration,
        category: serviceData.category || "general",
        is_active:
          serviceData.is_active !== undefined ? serviceData.is_active : true,
        max_advance_booking_days: serviceData.max_advance_booking_days || 30,
        min_advance_booking_hours: serviceData.min_advance_booking_hours || 24,
        cancellation_policy_hours: serviceData.cancellation_policy_hours || 24,
        requires_deposit: serviceData.requires_deposit || false,
        deposit_amount: serviceData.deposit_amount || 0,
        deposit_percentage: serviceData.deposit_percentage || null,
        available_days: serviceData.available_days || [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
        ],
        available_time_slots:
          serviceData.available_time_slots || this.defaultTimeSlots,
        max_daily_bookings: serviceData.max_daily_bookings || null,
        buffer_time_minutes: serviceData.buffer_time_minutes || 0,
        preparation_time_minutes: serviceData.preparation_time_minutes || 0,
        cleanup_time_minutes: serviceData.cleanup_time_minutes || 0,
        requires_confirmation: serviceData.requires_confirmation || false,
        auto_confirm_hours: serviceData.auto_confirm_hours || null,
        seasonal_pricing: serviceData.seasonal_pricing || {},
        discount_rules: serviceData.discount_rules || {},
        metadata: serviceData.metadata || {},
        tags: serviceData.tags || [],
        image_url: serviceData.image_url || null,
        gallery_urls: serviceData.gallery_urls || [],
        instructions: Validators.sanitizeText(serviceData.instructions) || null,
        contraindications: serviceData.contraindications || [],
        benefits: serviceData.benefits || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from(this.tableName)
        .insert([insertData])
        .select();

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Servicio creado exitosamente", {
        service_id: data[0].id,
        name: data[0].name,
        category: data[0].category,
        price: data[0].price,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: data[0],
        message: "Servicio creado exitosamente",
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error creando servicio", error, {
        serviceData: Object.keys(serviceData),
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener servicio por ID con información completa
   */
  async getById(serviceId) {
    const startTime = Date.now();

    try {
      if (!serviceId) {
        return { success: false, error: "ID de servicio requerido" };
      }

      const { data, error } = await this._buildBaseQuery()
        .eq("id", serviceId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return { success: false, error: "Servicio no encontrado" };
        }
        throw error;
      }

      const duration = Date.now() - startTime;
      logger.info("Servicio obtenido por ID", {
        service_id: serviceId,
        name: data.name,
        category: data.category,
        is_active: data.is_active,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data,
        message: "Servicio encontrado",
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error obteniendo servicio por ID", error, {
        service_id: serviceId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Búsqueda avanzada de servicios con filtros múltiples
   */
  async searchAdvanced(filters = {}, options = {}) {
    const startTime = Date.now();
    const {
      limit = 50,
      offset = 0,
      sortBy = "name",
      sortOrder = "asc",
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
      if (filters.category && this.validCategories.includes(filters.category)) {
        query = query.eq("category", filters.category);
      }

      if (filters.is_active !== undefined) {
        query = query.eq("is_active", filters.is_active);
      }

      if (filters.requires_deposit !== undefined) {
        query = query.eq("requires_deposit", filters.requires_deposit);
      }

      if (filters.min_price) {
        query = query.gte("price", filters.min_price);
      }

      if (filters.max_price) {
        query = query.lte("price", filters.max_price);
      }

      if (filters.min_duration) {
        query = query.gte("duration", filters.min_duration);
      }

      if (filters.max_duration) {
        query = query.lte("duration", filters.max_duration);
      }

      // Búsqueda por texto en nombre o descripción
      if (filters.search_text) {
        query = query.or(
          `name.ilike.%${filters.search_text}%,description.ilike.%${filters.search_text}%`
        );
      }

      // Filtrar por tags
      if (filters.tags && filters.tags.length > 0) {
        query = query.overlaps("tags", filters.tags);
      }

      // Filtrar por disponibilidad en día específico
      if (
        filters.available_day &&
        this.validDays.includes(filters.available_day)
      ) {
        query = query.contains("available_days", [filters.available_day]);
      }

      // Aplicar ordenamiento
      const ascending = sortOrder === "asc";
      query = query.order(sortBy, { ascending });

      // Aplicar paginación
      query = query.range(
        pagination.offset,
        pagination.offset + pagination.limit - 1
      );

      const { data, error } = await query;
      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Búsqueda avanzada de servicios completada", {
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
      logger.error("Error en búsqueda avanzada de servicios", error, {
        filters: Object.keys(filters),
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener servicios por categoría con estadísticas
   */
  async getByCategory(category, includeStats = false) {
    const startTime = Date.now();

    try {
      if (!category || !this.validCategories.includes(category)) {
        return { success: false, error: "Categoría inválida" };
      }

      const { data, error } = await this._buildBaseQuery()
        .eq("category", category)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      let result = { success: true, data };

      // Incluir estadísticas si se solicita
      if (includeStats && data.length > 0) {
        const stats = {
          totalServices: data.length,
          averagePrice: data.reduce((sum, s) => sum + s.price, 0) / data.length,
          averageDuration:
            data.reduce((sum, s) => sum + s.duration, 0) / data.length,
          withDeposit: data.filter((s) => s.requires_deposit).length,
          priceRange: {
            min: Math.min(...data.map((s) => s.price)),
            max: Math.max(...data.map((s) => s.price)),
          },
        };
        result.stats = stats;
      }

      const duration = Date.now() - startTime;
      logger.info("Servicios obtenidos por categoría", {
        category,
        count: data.length,
        includeStats,
        duration: `${duration}ms`,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error obteniendo servicios por categoría", error, {
        category,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Gestión avanzada de horarios de servicio
   */
  async updateScheduleAdvanced(serviceId, scheduleData) {
    const startTime = Date.now();

    try {
      if (!serviceId) {
        return { success: false, error: "ID de servicio requerido" };
      }

      // Validar días disponibles
      if (scheduleData.available_days) {
        const invalidDays = scheduleData.available_days.filter(
          (day) => !this.validDays.includes(day)
        );
        if (invalidDays.length > 0) {
          return {
            success: false,
            error: "Días inválidos detectados",
            details: invalidDays,
          };
        }
      }

      // Validar horarios disponibles
      if (scheduleData.available_time_slots) {
        const invalidSlots = scheduleData.available_time_slots.filter(
          (slot) => !Validators.isValidTime(slot)
        );
        if (invalidSlots.length > 0) {
          return {
            success: false,
            error: "Horarios inválidos detectados",
            details: invalidSlots,
          };
        }
      }

      // Preparar datos de actualización
      const updateData = {
        updated_at: new Date().toISOString(),
      };

      if (scheduleData.available_days) {
        updateData.available_days = scheduleData.available_days;
      }

      if (scheduleData.available_time_slots) {
        updateData.available_time_slots =
          scheduleData.available_time_slots.sort();
      }

      if (scheduleData.max_daily_bookings !== undefined) {
        updateData.max_daily_bookings = scheduleData.max_daily_bookings;
      }

      if (scheduleData.buffer_time_minutes !== undefined) {
        updateData.buffer_time_minutes = scheduleData.buffer_time_minutes;
      }

      if (scheduleData.preparation_time_minutes !== undefined) {
        updateData.preparation_time_minutes =
          scheduleData.preparation_time_minutes;
      }

      if (scheduleData.cleanup_time_minutes !== undefined) {
        updateData.cleanup_time_minutes = scheduleData.cleanup_time_minutes;
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .update(updateData)
        .eq("id", serviceId)
        .select();

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Horarios de servicio actualizados", {
        service_id: serviceId,
        fields_updated: Object.keys(scheduleData),
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: data[0],
        message: "Horarios actualizados exitosamente",
        updateInfo: {
          fieldsUpdated: Object.keys(scheduleData),
          updatedAt: data[0].updated_at,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error actualizando horarios de servicio", error, {
        service_id: serviceId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Gestión avanzada de políticas de cancelación
   */
  async updateCancellationPolicy(serviceId, policyData) {
    const startTime = Date.now();

    try {
      if (!serviceId) {
        return { success: false, error: "ID de servicio requerido" };
      }

      // Validar datos de política
      if (
        policyData.cancellation_policy_hours &&
        policyData.cancellation_policy_hours < 0
      ) {
        return {
          success: false,
          error: "Las horas de política de cancelación deben ser positivas",
        };
      }

      if (
        policyData.deposit_percentage &&
        (policyData.deposit_percentage < 0 ||
          policyData.deposit_percentage > 100)
      ) {
        return {
          success: false,
          error: "El porcentaje de depósito debe estar entre 0 y 100",
        };
      }

      // Preparar datos de actualización
      const updateData = {
        updated_at: new Date().toISOString(),
      };

      if (policyData.cancellation_policy_hours !== undefined) {
        updateData.cancellation_policy_hours =
          policyData.cancellation_policy_hours;
      }

      if (policyData.requires_deposit !== undefined) {
        updateData.requires_deposit = policyData.requires_deposit;
      }

      if (policyData.deposit_amount !== undefined) {
        updateData.deposit_amount = policyData.deposit_amount;
      }

      if (policyData.deposit_percentage !== undefined) {
        updateData.deposit_percentage = policyData.deposit_percentage;
      }

      if (policyData.refund_policy) {
        updateData.refund_policy = policyData.refund_policy;
      }

      if (policyData.penalty_rules) {
        updateData.penalty_rules = policyData.penalty_rules;
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .update(updateData)
        .eq("id", serviceId)
        .select();

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Política de cancelación actualizada", {
        service_id: serviceId,
        fields_updated: Object.keys(policyData),
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: data[0],
        message: "Política de cancelación actualizada exitosamente",
        updateInfo: {
          fieldsUpdated: Object.keys(policyData),
          updatedAt: data[0].updated_at,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error actualizando política de cancelación", error, {
        service_id: serviceId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Gestión de precios y descuentos avanzada
   */
  async updatePricingAdvanced(serviceId, pricingData) {
    const startTime = Date.now();

    try {
      if (!serviceId) {
        return { success: false, error: "ID de servicio requerido" };
      }

      // Validar precio base
      if (pricingData.price && pricingData.price <= 0) {
        return { success: false, error: "El precio debe ser mayor a 0" };
      }

      // Preparar datos de actualización
      const updateData = {
        updated_at: new Date().toISOString(),
      };

      if (pricingData.price !== undefined) {
        updateData.price = pricingData.price;
      }

      if (pricingData.seasonal_pricing) {
        updateData.seasonal_pricing = pricingData.seasonal_pricing;
      }

      if (pricingData.discount_rules) {
        updateData.discount_rules = pricingData.discount_rules;
      }

      if (pricingData.group_pricing) {
        updateData.group_pricing = pricingData.group_pricing;
      }

      if (pricingData.vip_pricing) {
        updateData.vip_pricing = pricingData.vip_pricing;
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .update(updateData)
        .eq("id", serviceId)
        .select();

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Precios de servicio actualizados", {
        service_id: serviceId,
        fields_updated: Object.keys(pricingData),
        new_price: data[0].price,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: data[0],
        message: "Precios actualizados exitosamente",
        updateInfo: {
          fieldsUpdated: Object.keys(pricingData),
          newPrice: data[0].price,
          updatedAt: data[0].updated_at,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error actualizando precios de servicio", error, {
        service_id: serviceId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener estadísticas avanzadas del servicio
   */
  async getAdvancedStats(serviceId, startDate, endDate) {
    const startTime = Date.now();

    try {
      if (!serviceId) {
        return { success: false, error: "ID de servicio requerido" };
      }

      if (
        !Validators.isValidDate(startDate) ||
        !Validators.isValidDate(endDate)
      ) {
        return { success: false, error: "Fechas inválidas" };
      }

      // Obtener información del servicio
      const serviceResult = await this.getById(serviceId);
      if (!serviceResult.success) {
        return serviceResult;
      }

      const service = serviceResult.data;

      // Obtener reservas del período
      const { data: bookings, error } = await supabase
        .from("bookings")
        .select(
          `
          status, 
          total_price, 
          booking_date,
          booking_time,
          payment_status,
          created_at,
          cancelled_at,
          clients (is_vip)
        `
        )
        .eq("service_id", serviceId)
        .gte("booking_date", startDate)
        .lte("booking_date", endDate);

      if (error) throw error;

      // Estadísticas básicas
      const basicStats = {
        totalBookings: bookings.length,
        pendingBookings: bookings.filter((b) => b.status === "pending").length,
        confirmedBookings: bookings.filter((b) => b.status === "confirmed")
          .length,
        completedBookings: bookings.filter((b) => b.status === "completed")
          .length,
        cancelledBookings: bookings.filter((b) => b.status === "cancelled")
          .length,
        totalRevenue: bookings
          .filter(
            (b) => b.status === "completed" && b.payment_status === "paid"
          )
          .reduce((sum, b) => sum + (b.total_price || 0), 0),
        pendingPayments: bookings
          .filter((b) => b.payment_status === "pending")
          .reduce((sum, b) => sum + (b.total_price || 0), 0),
        averageBookingValue:
          bookings.length > 0
            ? bookings.reduce((sum, b) => sum + (b.total_price || 0), 0) /
              bookings.length
            : 0,
      };

      // Estadísticas de rendimiento
      const performanceStats = {
        conversionRate:
          basicStats.totalBookings > 0
            ? (basicStats.completedBookings / basicStats.totalBookings) * 100
            : 0,
        cancellationRate:
          basicStats.totalBookings > 0
            ? (basicStats.cancelledBookings / basicStats.totalBookings) * 100
            : 0,
        averageRevenuePerDay:
          basicStats.totalRevenue /
          (Math.ceil(
            (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)
          ) || 1),
        bookingFrequency:
          basicStats.totalBookings /
          (Math.ceil(
            (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)
          ) || 1),
      };

      // Estadísticas VIP
      const vipStats = {
        vipBookings: bookings.filter((b) => b.clients?.is_vip).length,
        vipRevenue: bookings
          .filter(
            (b) =>
              b.clients?.is_vip &&
              b.status === "completed" &&
              b.payment_status === "paid"
          )
          .reduce((sum, b) => sum + (b.total_price || 0), 0),
      };

      // Análisis de horarios populares
      const timeSlotAnalysis = {};
      bookings.forEach((booking) => {
        const time = booking.booking_time;
        if (!timeSlotAnalysis[time]) {
          timeSlotAnalysis[time] = { count: 0, revenue: 0 };
        }
        timeSlotAnalysis[time].count++;
        if (
          booking.status === "completed" &&
          booking.payment_status === "paid"
        ) {
          timeSlotAnalysis[time].revenue += booking.total_price || 0;
        }
      });

      const duration = Date.now() - startTime;
      logger.info("Estadísticas avanzadas de servicio generadas", {
        service_id: serviceId,
        service_name: service.name,
        period: `${startDate} to ${endDate}`,
        totalBookings: basicStats.totalBookings,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: {
          service: {
            id: service.id,
            name: service.name,
            category: service.category,
            price: service.price,
          },
          period: { startDate, endDate },
          basic: basicStats,
          performance: performanceStats,
          vip: vipStats,
          timeSlotAnalysis,
          recommendations: this._generateRecommendations(
            basicStats,
            performanceStats,
            service
          ),
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        "Error generando estadísticas avanzadas de servicio",
        error,
        {
          service_id: serviceId,
          startDate,
          endDate,
          duration: `${duration}ms`,
        }
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Generar recomendaciones basadas en estadísticas
   */
  _generateRecommendations(basicStats, performanceStats, service) {
    const recommendations = [];

    // Recomendación de precio
    if (performanceStats.conversionRate > 80) {
      recommendations.push({
        type: "pricing",
        priority: "medium",
        message: "Alta tasa de conversión. Considera aumentar el precio.",
        action: "increase_price",
      });
    }

    // Recomendación de cancelaciones
    if (performanceStats.cancellationRate > 20) {
      recommendations.push({
        type: "policy",
        priority: "high",
        message: "Alta tasa de cancelación. Revisa la política de cancelación.",
        action: "review_cancellation_policy",
      });
    }

    // Recomendación de disponibilidad
    if (
      basicStats.totalBookings > 0 &&
      performanceStats.bookingFrequency > 0.8
    ) {
      recommendations.push({
        type: "availability",
        priority: "medium",
        message: "Alta demanda. Considera ampliar horarios disponibles.",
        action: "expand_availability",
      });
    }

    return recommendations;
  }

  /**
   * Verificar disponibilidad del servicio en fecha/hora específica
   */
  async checkServiceAvailability(serviceId, date, time) {
    const startTime = Date.now();

    try {
      if (!serviceId || !date || !time) {
        return { success: false, error: "Parámetros requeridos faltantes" };
      }

      if (!Validators.isValidDate(date) || !Validators.isValidTime(time)) {
        return { success: false, error: "Fecha u hora inválida" };
      }

      // Obtener información del servicio
      const serviceResult = await this.getById(serviceId);
      if (!serviceResult.success) {
        return serviceResult;
      }

      const service = serviceResult.data;

      // Verificar si el servicio está activo
      if (!service.is_active) {
        return {
          success: false,
          available: false,
          reason: "Servicio inactivo",
        };
      }

      // Verificar día de la semana
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

      if (!service.available_days.includes(dayOfWeek)) {
        return {
          success: false,
          available: false,
          reason: `Servicio no disponible los ${dayOfWeek}s`,
        };
      }

      // Verificar horario disponible
      if (!service.available_time_slots.includes(time)) {
        return {
          success: false,
          available: false,
          reason: "Horario no disponible para este servicio",
        };
      }

      // Verificar límite diario si existe
      if (service.max_daily_bookings) {
        const { data: dailyBookings, error } = await supabase
          .from("bookings")
          .select("id")
          .eq("service_id", serviceId)
          .eq("booking_date", date)
          .neq("status", "cancelled");

        if (error) throw error;

        if (dailyBookings.length >= service.max_daily_bookings) {
          return {
            success: false,
            available: false,
            reason: "Límite diario de reservas alcanzado",
          };
        }
      }

      const duration = Date.now() - startTime;
      logger.info("Disponibilidad de servicio verificada", {
        service_id: serviceId,
        date,
        time,
        available: true,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        available: true,
        serviceInfo: {
          name: service.name,
          duration: service.duration,
          price: service.price,
          requiresDeposit: service.requires_deposit,
          depositAmount: service.deposit_amount,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error verificando disponibilidad de servicio", error, {
        service_id: serviceId,
        date,
        time,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener servicios populares basados en reservas
   */
  async getPopularServices(period = 30, limit = 10) {
    const startTime = Date.now();

    try {
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          service_id,
          services (
            id,
            name,
            category,
            price,
            duration
          )
        `
        )
        .gte("booking_date", startDate)
        .lte("booking_date", endDate)
        .neq("status", "cancelled");

      if (error) throw error;

      // Agrupar por servicio y contar
      const serviceStats = {};
      data.forEach((booking) => {
        const serviceId = booking.service_id;
        if (!serviceStats[serviceId]) {
          serviceStats[serviceId] = {
            service: booking.services,
            bookingCount: 0,
          };
        }
        serviceStats[serviceId].bookingCount++;
      });

      // Convertir a array y ordenar
      const popularServices = Object.values(serviceStats)
        .sort((a, b) => b.bookingCount - a.bookingCount)
        .slice(0, limit);

      const duration = Date.now() - startTime;
      logger.info("Servicios populares obtenidos", {
        period: `${period} días`,
        totalServices: popularServices.length,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: popularServices,
        period: { days: period, startDate, endDate },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error obteniendo servicios populares", error, {
        period,
        limit,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Actualizar servicio con validaciones completas
   */
  async updateAdvanced(serviceId, updateData, updatedBy = "system") {
    const startTime = Date.now();

    try {
      if (!serviceId) {
        return { success: false, error: "ID de servicio requerido" };
      }

      // Validar datos de actualización
      const validation = this._validateServiceData(updateData, true);
      if (!validation.isValid) {
        return {
          success: false,
          error: "Datos de actualización inválidos",
          details: validation.errors,
        };
      }

      // Obtener servicio actual
      const currentService = await this.getById(serviceId);
      if (!currentService.success) {
        return { success: false, error: "Servicio no encontrado" };
      }

      // Sanitizar texto si se proporciona
      if (updateData.name) {
        updateData.name = Validators.sanitizeText(updateData.name);
      }

      if (updateData.description) {
        updateData.description = Validators.sanitizeText(
          updateData.description
        );
      }

      if (updateData.instructions) {
        updateData.instructions = Validators.sanitizeText(
          updateData.instructions
        );
      }

      // Preparar datos de actualización
      const finalUpdateData = {
        ...updateData,
        updated_at: new Date().toISOString(),
      };

      // Actualizar servicio
      const { data, error } = await supabase
        .from(this.tableName)
        .update(finalUpdateData)
        .eq("id", serviceId)
        .select();

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Servicio actualizado", {
        service_id: serviceId,
        updated_by: updatedBy,
        fields_updated: Object.keys(updateData),
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: data[0],
        message: "Servicio actualizado exitosamente",
        updateInfo: {
          updatedBy,
          fieldsUpdated: Object.keys(updateData),
          updatedAt: data[0].updated_at,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error actualizando servicio", error, {
        service_id: serviceId,
        updated_by: updatedBy,
        fields: Object.keys(updateData),
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Eliminar servicio con validaciones de seguridad
   */
  async deleteAdvanced(serviceId, deletedBy = "system", reason = null) {
    const startTime = Date.now();

    try {
      if (!serviceId) {
        return { success: false, error: "ID de servicio requerido" };
      }

      // Obtener información del servicio antes de eliminar
      const currentService = await this.getById(serviceId);
      if (!currentService.success) {
        return { success: false, error: "Servicio no encontrado" };
      }

      const service = currentService.data;

      // Verificar si tiene reservas activas
      const activeBookingsResult = await this.hasActiveBookings(serviceId);
      if (!activeBookingsResult.success) {
        return activeBookingsResult;
      }

      if (activeBookingsResult.hasActiveBookings) {
        return {
          success: false,
          error: "No se puede eliminar un servicio con reservas activas",
          suggestion: "Desactiva el servicio en su lugar",
        };
      }

      // Eliminar servicio
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq("id", serviceId);

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Servicio eliminado", {
        service_id: serviceId,
        deleted_by: deletedBy,
        reason: reason || "Sin razón especificada",
        service_name: service.name,
        category: service.category,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        message: "Servicio eliminado exitosamente",
        deletionInfo: {
          deletedBy,
          reason: reason || "Sin razón especificada",
          deletedAt: new Date().toISOString(),
          serviceInfo: {
            name: service.name,
            category: service.category,
            price: service.price,
          },
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error eliminando servicio", error, {
        service_id: serviceId,
        deleted_by: deletedBy,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Método auxiliar para agrupar por categoría
   */
  _groupByCategory(services) {
    return services.reduce((acc, service) => {
      acc[service.category] = (acc[service.category] || 0) + 1;
      return acc;
    }, {});
  }

  // Métodos de compatibilidad con la versión anterior
  async getActiveServices() {
    return this.searchAdvanced({ is_active: true });
  }

  async getAll(includeInactive = false) {
    const filters = includeInactive ? {} : { is_active: true };
    return this.searchAdvanced(filters);
  }

  async update(serviceId, updateData) {
    return this.updateAdvanced(serviceId, updateData);
  }

  async toggleActiveStatus(serviceId, isActive) {
    return this.updateAdvanced(serviceId, { is_active: isActive });
  }

  async delete(serviceId) {
    return this.deleteAdvanced(serviceId);
  }

  async hasActiveBookings(serviceId) {
    const startTime = Date.now();

    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("id")
        .eq("service_id", serviceId)
        .in("status", ["pending", "confirmed"])
        .gte("booking_date", new Date().toISOString().split("T")[0]);

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Verificación de reservas activas", {
        service_id: serviceId,
        has_active_bookings: data.length > 0,
        active_bookings_count: data.length,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        hasActiveBookings: data.length > 0,
        count: data.length,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error verificando reservas activas", error, {
        service_id: serviceId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  async getServiceStats(serviceId, startDate, endDate) {
    const result = await this.getAdvancedStats(serviceId, startDate, endDate);
    if (result.success) {
      return { success: true, data: result.data.basic };
    }
    return result;
  }
}

module.exports = new ServiceModel();
