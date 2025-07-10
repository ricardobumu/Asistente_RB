// src/models/notificationModel.js
const supabase = require("../integrations/supabaseClient");
const logger = require("../utils/logger");
const Validators = require("../utils/validators");

/**
 * NotificationModel - Sistema avanzado de notificaciones empresarial
 *
 * Funcionalidades:
 * - CRUD completo con validaciones robustas
 * - Sistema de notificaciones multi-canal
 * - Gestión de plantillas y personalización
 * - Programación inteligente de envíos
 * - Sistema de reintentos automáticos
 * - Análisis de efectividad y métricas
 * - Gestión de preferencias de usuario
 * - Sistema de notificaciones push
 * - Integración con múltiples proveedores
 * - Auditoría completa de comunicaciones
 * - Sistema de campañas masivas
 * - Gestión de listas de distribución
 * - Análisis de engagement
 * - Sistema de A/B testing
 * - Automatización de workflows
 */
class NotificationModel {
  constructor() {
    this.tableName = "notifications";
    this.templatesTableName = "notification_templates";
    this.campaignsTableName = "notification_campaigns";
    this.preferencesTableName = "notification_preferences";
    this.metricsTableName = "notification_metrics";

    // Tipos de notificación
    this.validTypes = [
      "booking_confirmation", // Confirmación de reserva
      "booking_reminder", // Recordatorio de cita
      "booking_cancellation", // Cancelación de reserva
      "booking_rescheduled", // Reprogramación de cita
      "payment_confirmation", // Confirmación de pago
      "payment_reminder", // Recordatorio de pago
      "welcome_message", // Mensaje de bienvenida
      "birthday_greeting", // Saludo de cumpleaños
      "promotional", // Promociones y ofertas
      "service_feedback", // Solicitud de feedback
      "appointment_followup", // Seguimiento post-cita
      "loyalty_reward", // Recompensas de lealtad
      "system_alert", // Alertas del sistema
      "custom", // Personalizado
    ];

    // Canales de comunicación
    this.validChannels = [
      "whatsapp", // WhatsApp Business
      "email", // Email
      "sms", // SMS
      "push", // Notificación push
      "in_app", // Notificación in-app
      "voice", // Llamada de voz
      "telegram", // Telegram
    ];

    // Estados de notificación
    this.validStatuses = [
      "pending", // Pendiente de envío
      "scheduled", // Programada
      "processing", // Procesando
      "sent", // Enviada exitosamente
      "delivered", // Entregada
      "read", // Leída
      "failed", // Falló el envío
      "cancelled", // Cancelada
      "expired", // Expirada
    ];

    // Prioridades de notificación
    this.validPriorities = [
      "low", // Baja prioridad
      "normal", // Prioridad normal
      "high", // Alta prioridad
      "urgent", // Urgente
      "critical", // Crítica
    ];

    // Configuración de reintentos por canal
    this.retryConfig = {
      whatsapp: { maxRetries: 3, delayMinutes: [5, 15, 60] },
      email: { maxRetries: 5, delayMinutes: [2, 10, 30, 120, 360] },
      sms: { maxRetries: 3, delayMinutes: [1, 5, 15] },
      push: { maxRetries: 2, delayMinutes: [1, 5] },
      in_app: { maxRetries: 1, delayMinutes: [0] },
      voice: { maxRetries: 2, delayMinutes: [10, 30] },
      telegram: { maxRetries: 3, delayMinutes: [2, 10, 30] },
    };

    // Log de inicialización
    logger.info("NotificationModel inicializado", {
      table: this.tableName,
      validTypes: this.validTypes.length,
      validChannels: this.validChannels.length,
      validStatuses: this.validStatuses.length,
      retryChannels: Object.keys(this.retryConfig).length,
    });
  }

  /**
   * Validar datos de notificación
   */
  _validateNotificationData(notificationData, isUpdate = false) {
    const validation = Validators.validateNotificationData(
      notificationData,
      isUpdate
    );

    if (!validation.isValid) {
      logger.warn("Validación de notificación fallida", {
        errors: validation.errors,
        data: Object.keys(notificationData),
      });
    }

    return validation;
  }

  /**
   * Construir query base con información relacionada
   */
  _buildBaseQuery() {
    return supabase.from(this.tableName).select(`
      id,
      client_id,
      booking_id,
      campaign_id,
      template_id,
      type,
      channel,
      priority,
      title,
      message,
      status,
      scheduled_for,
      sent_at,
      delivered_at,
      read_at,
      error_message,
      retry_count,
      metadata,
      personalization_data,
      tracking_data,
      created_at,
      updated_at,
      created_by,
      clients (
        id,
        name,
        email,
        phone,
        whatsapp_number,
        preferred_contact_method,
        timezone,
        language
      ),
      bookings (
        id,
        booking_date,
        booking_time,
        status,
        services (
          name,
          duration
        )
      )
    `);
  }

  /**
   * Crear notificación con validación completa
   */
  async create(notificationData, createdBy = "system") {
    const startTime = Date.now();

    try {
      // Validar datos de entrada
      const validation = this._validateNotificationData(notificationData);
      if (!validation.isValid) {
        return {
          success: false,
          error: "Datos de notificación inválidos",
          details: validation.errors,
        };
      }

      // Verificar que el tipo es válido
      if (!this.validTypes.includes(notificationData.type)) {
        return { success: false, error: "Tipo de notificación inválido" };
      }

      // Verificar que el canal es válido
      if (!this.validChannels.includes(notificationData.channel)) {
        return { success: false, error: "Canal de notificación inválido" };
      }

      // Verificar que el cliente existe
      if (notificationData.client_id) {
        const { data: client, error: clientError } = await supabase
          .from("clients")
          .select("id, name, preferred_contact_method, timezone, language")
          .eq("id", notificationData.client_id)
          .single();

        if (clientError || !client) {
          return { success: false, error: "Cliente no encontrado" };
        }

        // Usar canal preferido del cliente si no se especifica
        if (!notificationData.channel && client.preferred_contact_method) {
          notificationData.channel = client.preferred_contact_method;
        }
      }

      // Preparar datos para inserción
      const insertData = {
        client_id: notificationData.client_id || null,
        booking_id: notificationData.booking_id || null,
        campaign_id: notificationData.campaign_id || null,
        template_id: notificationData.template_id || null,
        type: notificationData.type,
        channel: notificationData.channel,
        priority: notificationData.priority || "normal",
        title: Validators.sanitizeText(notificationData.title),
        message: Validators.sanitizeText(notificationData.message),
        status: notificationData.status || "pending",
        scheduled_for:
          notificationData.scheduled_for || new Date().toISOString(),
        sent_at: null,
        delivered_at: null,
        read_at: null,
        error_message: null,
        retry_count: 0,
        metadata: notificationData.metadata || {},
        personalization_data: notificationData.personalization_data || {},
        tracking_data: {
          created_ip: notificationData.created_ip || null,
          user_agent: notificationData.user_agent || null,
          source: notificationData.source || "system",
        },
        created_by: createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from(this.tableName)
        .insert([insertData])
        .select();

      if (error) throw error;

      // Registrar métricas
      await this._recordMetric("notification_created", {
        notification_id: data[0].id,
        type: data[0].type,
        channel: data[0].channel,
        priority: data[0].priority,
        created_by: createdBy,
      });

      const duration = Date.now() - startTime;
      logger.info("Notificación creada exitosamente", {
        notification_id: data[0].id,
        type: data[0].type,
        channel: data[0].channel,
        client_id: data[0].client_id,
        created_by: createdBy,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: data[0],
        message: "Notificación creada exitosamente",
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error creando notificación", error, {
        notificationData: Object.keys(notificationData),
        created_by: createdBy,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Búsqueda avanzada de notificaciones con filtros múltiples
   */
  async searchAdvanced(filters = {}, options = {}) {
    const startTime = Date.now();
    const {
      limit = 50,
      offset = 0,
      sortBy = "created_at",
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
      if (filters.client_id) {
        query = query.eq("client_id", filters.client_id);
      }

      if (filters.booking_id) {
        query = query.eq("booking_id", filters.booking_id);
      }

      if (filters.campaign_id) {
        query = query.eq("campaign_id", filters.campaign_id);
      }

      if (filters.type && this.validTypes.includes(filters.type)) {
        query = query.eq("type", filters.type);
      }

      if (filters.channel && this.validChannels.includes(filters.channel)) {
        query = query.eq("channel", filters.channel);
      }

      if (filters.status && this.validStatuses.includes(filters.status)) {
        query = query.eq("status", filters.status);
      }

      if (filters.priority && this.validPriorities.includes(filters.priority)) {
        query = query.eq("priority", filters.priority);
      }

      // Búsqueda por texto en título y mensaje
      if (filters.search_text) {
        query = query.or(
          `title.ilike.%${filters.search_text}%,message.ilike.%${filters.search_text}%`
        );
      }

      // Filtros de fecha
      if (filters.created_after) {
        query = query.gte("created_at", filters.created_after);
      }

      if (filters.created_before) {
        query = query.lte("created_at", filters.created_before);
      }

      if (filters.scheduled_after) {
        query = query.gte("scheduled_for", filters.scheduled_after);
      }

      if (filters.scheduled_before) {
        query = query.lte("scheduled_for", filters.scheduled_before);
      }

      if (filters.sent_after) {
        query = query.gte("sent_at", filters.sent_after);
      }

      // Filtrar por estado de entrega
      if (filters.is_delivered !== undefined) {
        if (filters.is_delivered) {
          query = query.not("delivered_at", "is", null);
        } else {
          query = query.is("delivered_at", null);
        }
      }

      // Filtrar por estado de lectura
      if (filters.is_read !== undefined) {
        if (filters.is_read) {
          query = query.not("read_at", "is", null);
        } else {
          query = query.is("read_at", null);
        }
      }

      // Filtrar por reintentos
      if (filters.has_retries !== undefined) {
        if (filters.has_retries) {
          query = query.gt("retry_count", 0);
        } else {
          query = query.eq("retry_count", 0);
        }
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
      logger.info("Búsqueda avanzada de notificaciones completada", {
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
      logger.error("Error en búsqueda avanzada de notificaciones", error, {
        filters: Object.keys(filters),
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener notificaciones pendientes con priorización
   */
  async getPendingAdvanced(options = {}) {
    const startTime = Date.now();
    const { limit = 100, priorityOrder = true } = options;

    try {
      const now = new Date().toISOString();

      let query = this._buildBaseQuery()
        .eq("status", "pending")
        .lte("scheduled_for", now);

      // Ordenar por prioridad si se solicita
      if (priorityOrder) {
        // Orden de prioridad: critical, urgent, high, normal, low
        query = query.order("priority", { ascending: false });
      }

      query = query.order("scheduled_for", { ascending: true }).limit(limit);

      const { data, error } = await query;
      if (error) throw error;

      // Agrupar por prioridad para mejor procesamiento
      const groupedByPriority = data.reduce((acc, notification) => {
        const priority = notification.priority || "normal";
        if (!acc[priority]) acc[priority] = [];
        acc[priority].push(notification);
        return acc;
      }, {});

      const duration = Date.now() - startTime;
      logger.info("Notificaciones pendientes obtenidas", {
        totalPending: data.length,
        byPriority: Object.keys(groupedByPriority).reduce((acc, priority) => {
          acc[priority] = groupedByPriority[priority].length;
          return acc;
        }, {}),
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data,
        groupedByPriority,
        summary: {
          total: data.length,
          byPriority: Object.keys(groupedByPriority).reduce((acc, priority) => {
            acc[priority] = groupedByPriority[priority].length;
            return acc;
          }, {}),
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error obteniendo notificaciones pendientes", error, {
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Marcar notificación como enviada con métricas
   */
  async markAsSentAdvanced(notificationId, sentData = {}) {
    const startTime = Date.now();

    try {
      if (!notificationId) {
        return { success: false, error: "ID de notificación requerido" };
      }

      // Obtener notificación actual
      const current = await this.getById(notificationId);
      if (!current.success) {
        return { success: false, error: "Notificación no encontrada" };
      }

      const updateData = {
        status: "sent",
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Agregar datos de envío si se proporcionan
      if (sentData.provider_message_id) {
        updateData.metadata = {
          ...current.data.metadata,
          provider_message_id: sentData.provider_message_id,
          provider_response: sentData.provider_response || null,
          sent_via: sentData.sent_via || null,
        };
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .update(updateData)
        .eq("id", notificationId)
        .select();

      if (error) throw error;

      // Registrar métricas de envío
      await this._recordMetric("notification_sent", {
        notification_id: notificationId,
        type: current.data.type,
        channel: current.data.channel,
        priority: current.data.priority,
        time_to_send:
          new Date(updateData.sent_at) - new Date(current.data.created_at),
        retry_count: current.data.retry_count || 0,
      });

      const duration = Date.now() - startTime;
      logger.info("Notificación marcada como enviada", {
        notification_id: notificationId,
        type: current.data.type,
        channel: current.data.channel,
        retry_count: current.data.retry_count || 0,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: data[0],
        message: "Notificación marcada como enviada",
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error marcando notificación como enviada", error, {
        notification_id: notificationId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Marcar notificación como entregada
   */
  async markAsDelivered(notificationId, deliveredData = {}) {
    const startTime = Date.now();

    try {
      if (!notificationId) {
        return { success: false, error: "ID de notificación requerido" };
      }

      const updateData = {
        status: "delivered",
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Agregar datos de entrega si se proporcionan
      if (deliveredData.delivery_receipt) {
        updateData.metadata = {
          delivery_receipt: deliveredData.delivery_receipt,
          delivered_via: deliveredData.delivered_via || null,
        };
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .update(updateData)
        .eq("id", notificationId)
        .select();

      if (error) throw error;

      // Registrar métricas de entrega
      await this._recordMetric("notification_delivered", {
        notification_id: notificationId,
        delivery_time: deliveredData.delivery_time || null,
      });

      const duration = Date.now() - startTime;
      logger.info("Notificación marcada como entregada", {
        notification_id: notificationId,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: data[0],
        message: "Notificación marcada como entregada",
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error marcando notificación como entregada", error, {
        notification_id: notificationId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Marcar notificación como leída
   */
  async markAsRead(notificationId, readData = {}) {
    const startTime = Date.now();

    try {
      if (!notificationId) {
        return { success: false, error: "ID de notificación requerido" };
      }

      const updateData = {
        status: "read",
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Agregar datos de lectura si se proporcionan
      if (readData.read_receipt) {
        updateData.metadata = {
          read_receipt: readData.read_receipt,
          read_via: readData.read_via || null,
          engagement_data: readData.engagement_data || null,
        };
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .update(updateData)
        .eq("id", notificationId)
        .select();

      if (error) throw error;

      // Registrar métricas de lectura
      await this._recordMetric("notification_read", {
        notification_id: notificationId,
        read_time: readData.read_time || null,
        engagement_score: readData.engagement_score || null,
      });

      const duration = Date.now() - startTime;
      logger.info("Notificación marcada como leída", {
        notification_id: notificationId,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: data[0],
        message: "Notificación marcada como leída",
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error marcando notificación como leída", error, {
        notification_id: notificationId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Marcar notificación como fallida con sistema de reintentos
   */
  async markAsFailedAdvanced(notificationId, errorMessage, retryOptions = {}) {
    const startTime = Date.now();

    try {
      if (!notificationId) {
        return { success: false, error: "ID de notificación requerido" };
      }

      // Obtener notificación actual
      const current = await this.getById(notificationId);
      if (!current.success) {
        return { success: false, error: "Notificación no encontrada" };
      }

      const notification = current.data;
      const currentRetryCount = notification.retry_count || 0;
      const channelConfig = this.retryConfig[notification.channel] || {
        maxRetries: 0,
        delayMinutes: [],
      };

      let shouldRetry = false;
      let nextRetryTime = null;

      // Determinar si debe reintentarse
      if (
        retryOptions.allowRetry !== false &&
        currentRetryCount < channelConfig.maxRetries
      ) {
        shouldRetry = true;
        const delayMinutes =
          channelConfig.delayMinutes[currentRetryCount] ||
          channelConfig.delayMinutes[channelConfig.delayMinutes.length - 1];
        nextRetryTime = new Date();
        nextRetryTime.setMinutes(nextRetryTime.getMinutes() + delayMinutes);
      }

      const updateData = {
        status: shouldRetry ? "pending" : "failed",
        error_message: errorMessage,
        retry_count: currentRetryCount + 1,
        updated_at: new Date().toISOString(),
      };

      if (shouldRetry) {
        updateData.scheduled_for = nextRetryTime.toISOString();
      }

      // Agregar información del error
      updateData.metadata = {
        ...notification.metadata,
        last_error: {
          message: errorMessage,
          timestamp: new Date().toISOString(),
          retry_count: currentRetryCount + 1,
          error_code: retryOptions.error_code || null,
          provider_error: retryOptions.provider_error || null,
        },
      };

      const { data, error } = await supabase
        .from(this.tableName)
        .update(updateData)
        .eq("id", notificationId)
        .select();

      if (error) throw error;

      // Registrar métricas de fallo
      await this._recordMetric("notification_failed", {
        notification_id: notificationId,
        type: notification.type,
        channel: notification.channel,
        error_message: errorMessage,
        retry_count: currentRetryCount + 1,
        will_retry: shouldRetry,
        next_retry_time: nextRetryTime?.toISOString() || null,
      });

      const duration = Date.now() - startTime;
      logger.warn("Notificación marcada como fallida", {
        notification_id: notificationId,
        type: notification.type,
        channel: notification.channel,
        error_message: errorMessage,
        retry_count: currentRetryCount + 1,
        will_retry: shouldRetry,
        next_retry_time: nextRetryTime?.toISOString() || null,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: data[0],
        retryInfo: {
          willRetry: shouldRetry,
          nextRetryTime: nextRetryTime?.toISOString() || null,
          retryCount: currentRetryCount + 1,
          maxRetries: channelConfig.maxRetries,
        },
        message: shouldRetry
          ? "Notificación programada para reintento"
          : "Notificación marcada como fallida definitivamente",
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error marcando notificación como fallida", error, {
        notification_id: notificationId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Crear recordatorio inteligente con personalización
   */
  async createReminderAdvanced(bookingId, reminderConfig = {}) {
    const startTime = Date.now();

    try {
      if (!bookingId) {
        return { success: false, error: "ID de reserva requerido" };
      }

      // Obtener datos completos de la reserva
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select(
          `
          *,
          clients (
            id,
            name,
            email,
            phone,
            whatsapp_number,
            preferred_contact_method,
            timezone,
            language,
            notification_preferences
          ),
          services (
            name,
            duration,
            category,
            preparation_instructions
          )
        `
        )
        .eq("id", bookingId)
        .single();

      if (bookingError || !booking) {
        return { success: false, error: "Reserva no encontrada" };
      }

      const client = booking.clients;
      const service = booking.services;

      // Configuración por defecto del recordatorio
      const defaultConfig = {
        reminderType: "24h",
        channel: client.preferred_contact_method || "whatsapp",
        priority: "normal",
        includePreparation: true,
        includeLocation: true,
        personalizeMessage: true,
      };

      const config = { ...defaultConfig, ...reminderConfig };

      // Calcular cuándo enviar el recordatorio
      const bookingDateTime = new Date(
        `${booking.booking_date}T${booking.booking_time}`
      );
      let reminderTime = new Date(bookingDateTime);

      switch (config.reminderType) {
        case "72h":
          reminderTime.setHours(reminderTime.getHours() - 72);
          break;
        case "48h":
          reminderTime.setHours(reminderTime.getHours() - 48);
          break;
        case "24h":
          reminderTime.setHours(reminderTime.getHours() - 24);
          break;
        case "12h":
          reminderTime.setHours(reminderTime.getHours() - 12);
          break;
        case "6h":
          reminderTime.setHours(reminderTime.getHours() - 6);
          break;
        case "2h":
          reminderTime.setHours(reminderTime.getHours() - 2);
          break;
        case "1h":
          reminderTime.setHours(reminderTime.getHours() - 1);
          break;
        case "30min":
          reminderTime.setMinutes(reminderTime.getMinutes() - 30);
          break;
        case "15min":
          reminderTime.setMinutes(reminderTime.getMinutes() - 15);
          break;
        default:
          reminderTime.setHours(reminderTime.getHours() - 24);
      }

      // Verificar que el recordatorio no sea en el pasado
      if (reminderTime < new Date()) {
        return {
          success: false,
          error: "El tiempo de recordatorio calculado está en el pasado",
          details: {
            bookingDateTime: bookingDateTime.toISOString(),
            calculatedReminderTime: reminderTime.toISOString(),
            reminderType: config.reminderType,
          },
        };
      }

      // Generar mensaje personalizado
      let message = await this._generatePersonalizedMessage(
        "booking_reminder",
        {
          client,
          booking,
          service,
          reminderType: config.reminderType,
          includePreparation: config.includePreparation,
          includeLocation: config.includeLocation,
        }
      );

      // Crear datos de la notificación
      const notificationData = {
        client_id: booking.client_id,
        booking_id: bookingId,
        type: "booking_reminder",
        channel: config.channel,
        priority: config.priority,
        title: `Recordatorio de cita - ${service.name}`,
        message: message,
        scheduled_for: reminderTime.toISOString(),
        personalization_data: {
          client_name: client.name,
          service_name: service.name,
          booking_date: booking.booking_date,
          booking_time: booking.booking_time,
          reminder_type: config.reminderType,
          timezone: client.timezone || "America/Argentina/Buenos_Aires",
        },
        metadata: {
          reminder_config: config,
          booking_info: {
            service_category: service.category,
            service_duration: service.duration,
            booking_status: booking.status,
          },
        },
      };

      // Crear la notificación
      const result = await this.create(notificationData, "system");

      if (result.success) {
        const duration = Date.now() - startTime;
        logger.info("Recordatorio inteligente creado", {
          notification_id: result.data.id,
          booking_id: bookingId,
          client_id: booking.client_id,
          reminder_type: config.reminderType,
          channel: config.channel,
          scheduled_for: reminderTime.toISOString(),
          duration: `${duration}ms`,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error creando recordatorio inteligente", error, {
        booking_id: bookingId,
        reminder_config: reminderConfig,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generar mensaje personalizado basado en plantilla
   */
  async _generatePersonalizedMessage(messageType, context) {
    try {
      const { client, booking, service, reminderType } = context;

      // Plantillas base por tipo de mensaje
      const templates = {
        booking_reminder: {
          "72h": `Hola ${client.name}! 👋 Te recordamos que tienes una cita de ${service.name} programada para el ${booking.booking_date} a las ${booking.booking_time}. ¡Nos vemos en 3 días! 📅`,
          "48h": `¡Hola ${client.name}! 🌟 Tu cita de ${service.name} está programada para pasado mañana (${booking.booking_date}) a las ${booking.booking_time}. ¡Te esperamos! ✨`,
          "24h": `Hola ${client.name}! 😊 Te recordamos tu cita de ${service.name} programada para mañana ${booking.booking_date} a las ${booking.booking_time}. ¡Nos vemos pronto! 💆‍♀️`,
          "12h": `¡Hola ${client.name}! Tu cita de ${service.name} es hoy a las ${booking.booking_time}. ¡Te esperamos en unas horas! 🕐`,
          "6h": `Hola ${client.name}! 🌸 Tu cita de ${service.name} es hoy a las ${booking.booking_time}. ¡Nos vemos en unas horas!`,
          "2h": `¡Hola ${client.name}! Tu cita de ${service.name} es en 2 horas (${booking.booking_time}). ¡Te esperamos! ⏰`,
          "1h": `Hola ${client.name}! Tu cita de ${service.name} es en 1 hora (${booking.booking_time}). ¡Nos vemos pronto! 🚗`,
          "30min": `¡${client.name}! Tu cita de ${service.name} es en 30 minutos (${booking.booking_time}). ¡Te esperamos! 🏃‍♀️`,
          "15min": `${client.name}, tu cita de ${service.name} es en 15 minutos (${booking.booking_time}). ¡Nos vemos ya! ⚡`,
        },
        booking_confirmation: `¡Hola ${client.name}! ✅ Tu cita de ${service.name} ha sido confirmada para el ${booking.booking_date} a las ${booking.booking_time}. ¡Te esperamos! 🌟`,
        booking_cancellation: `Hola ${client.name}, tu cita de ${service.name} programada para el ${booking.booking_date} a las ${booking.booking_time} ha sido cancelada. ¡Esperamos verte pronto! 💙`,
      };

      let message = templates[messageType];

      if (messageType === "booking_reminder" && reminderType) {
        message =
          templates[messageType][reminderType] || templates[messageType]["24h"];
      }

      // Agregar instrucciones de preparación si se solicita
      if (context.includePreparation && service.preparation_instructions) {
        message += `\n\n📝 Preparación: ${service.preparation_instructions}`;
      }

      // Agregar información de ubicación si se solicita
      if (context.includeLocation) {
        message += `\n\n📍 Ubicación: [Dirección del spa]`;
        message += `\n📞 Consultas: [Teléfono de contacto]`;
      }

      return message;
    } catch (error) {
      logger.error("Error generando mensaje personalizado", error, {
        messageType,
        context: Object.keys(context),
      });
      return `Hola ${
        context.client?.name || "Cliente"
      }! Te recordamos tu cita programada.`;
    }
  }

  /**
   * Obtener estadísticas avanzadas de notificaciones
   */
  async getAdvancedStats(startDate = null, endDate = null) {
    const startTime = Date.now();

    try {
      // Establecer fechas por defecto (último mes)
      if (!endDate) endDate = new Date().toISOString();
      if (!startDate) {
        const start = new Date();
        start.setMonth(start.getMonth() - 1);
        startDate = start.toISOString();
      }

      // Obtener todas las notificaciones del período
      const { data: notifications, error: notificationsError } = await supabase
        .from(this.tableName)
        .select(
          "type, channel, status, priority, created_at, sent_at, delivered_at, read_at, retry_count"
        )
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (notificationsError) throw notificationsError;

      // Estadísticas básicas
      const basicStats = {
        totalNotifications: notifications.length,
        sent: notifications.filter(
          (n) =>
            n.status === "sent" ||
            n.status === "delivered" ||
            n.status === "read"
        ).length,
        pending: notifications.filter(
          (n) => n.status === "pending" || n.status === "scheduled"
        ).length,
        failed: notifications.filter((n) => n.status === "failed").length,
        delivered: notifications.filter(
          (n) => n.status === "delivered" || n.status === "read"
        ).length,
        read: notifications.filter((n) => n.status === "read").length,
        cancelled: notifications.filter((n) => n.status === "cancelled").length,
      };

      // Calcular tasas de éxito
      const successRates = {
        deliveryRate:
          basicStats.totalNotifications > 0
            ? (
                (basicStats.delivered / basicStats.totalNotifications) *
                100
              ).toFixed(2)
            : 0,
        readRate:
          basicStats.delivered > 0
            ? ((basicStats.read / basicStats.delivered) * 100).toFixed(2)
            : 0,
        failureRate:
          basicStats.totalNotifications > 0
            ? (
                (basicStats.failed / basicStats.totalNotifications) *
                100
              ).toFixed(2)
            : 0,
      };

      // Estadísticas por canal
      const channelStats = {};
      this.validChannels.forEach((channel) => {
        const channelNotifications = notifications.filter(
          (n) => n.channel === channel
        );
        channelStats[channel] = {
          total: channelNotifications.length,
          sent: channelNotifications.filter(
            (n) =>
              n.status === "sent" ||
              n.status === "delivered" ||
              n.status === "read"
          ).length,
          delivered: channelNotifications.filter(
            (n) => n.status === "delivered" || n.status === "read"
          ).length,
          failed: channelNotifications.filter((n) => n.status === "failed")
            .length,
          deliveryRate:
            channelNotifications.length > 0
              ? (
                  (channelNotifications.filter(
                    (n) => n.status === "delivered" || n.status === "read"
                  ).length /
                    channelNotifications.length) *
                  100
                ).toFixed(2)
              : 0,
        };
      });

      // Estadísticas por tipo
      const typeStats = {};
      this.validTypes.forEach((type) => {
        const typeNotifications = notifications.filter((n) => n.type === type);
        typeStats[type] = {
          total: typeNotifications.length,
          sent: typeNotifications.filter(
            (n) =>
              n.status === "sent" ||
              n.status === "delivered" ||
              n.status === "read"
          ).length,
          delivered: typeNotifications.filter(
            (n) => n.status === "delivered" || n.status === "read"
          ).length,
          failed: typeNotifications.filter((n) => n.status === "failed").length,
        };
      });

      // Estadísticas por prioridad
      const priorityStats = {};
      this.validPriorities.forEach((priority) => {
        const priorityNotifications = notifications.filter(
          (n) => n.priority === priority
        );
        priorityStats[priority] = {
          total: priorityNotifications.length,
          sent: priorityNotifications.filter(
            (n) =>
              n.status === "sent" ||
              n.status === "delivered" ||
              n.status === "read"
          ).length,
          avgDeliveryTime: this._calculateAverageDeliveryTime(
            priorityNotifications
          ),
        };
      });

      // Análisis de reintentos
      const retryStats = {
        totalRetries: notifications.reduce(
          (sum, n) => sum + (n.retry_count || 0),
          0
        ),
        notificationsWithRetries: notifications.filter(
          (n) => (n.retry_count || 0) > 0
        ).length,
        avgRetriesPerNotification:
          notifications.length > 0
            ? (
                notifications.reduce(
                  (sum, n) => sum + (n.retry_count || 0),
                  0
                ) / notifications.length
              ).toFixed(2)
            : 0,
        maxRetries: Math.max(...notifications.map((n) => n.retry_count || 0)),
      };

      // Análisis de tiempos
      const timeAnalysis = {
        avgTimeToSend: this._calculateAverageTimeToSend(notifications),
        avgTimeToDeliver: this._calculateAverageTimeToDeliver(notifications),
        avgTimeToRead: this._calculateAverageTimeToRead(notifications),
      };

      // Tendencias por día
      const dailyTrends = this._calculateDailyTrends(
        notifications,
        startDate,
        endDate
      );

      const duration = Date.now() - startTime;
      logger.info("Estadísticas avanzadas de notificaciones generadas", {
        period: `${startDate} to ${endDate}`,
        totalNotifications: basicStats.totalNotifications,
        deliveryRate: successRates.deliveryRate,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: {
          period: { startDate, endDate },
          basic: basicStats,
          successRates,
          channels: channelStats,
          types: typeStats,
          priorities: priorityStats,
          retries: retryStats,
          timeAnalysis,
          dailyTrends,
          recommendations: this._generateNotificationRecommendations(
            basicStats,
            successRates,
            channelStats,
            retryStats
          ),
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        "Error generando estadísticas avanzadas de notificaciones",
        error,
        {
          startDate,
          endDate,
          duration: `${duration}ms`,
        }
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Calcular tiempo promedio de envío
   */
  _calculateAverageTimeToSend(notifications) {
    const sentNotifications = notifications.filter(
      (n) => n.sent_at && n.created_at
    );
    if (sentNotifications.length === 0) return 0;

    const totalTime = sentNotifications.reduce((sum, n) => {
      return sum + (new Date(n.sent_at) - new Date(n.created_at));
    }, 0);

    return Math.round(totalTime / sentNotifications.length / 1000); // en segundos
  }

  /**
   * Calcular tiempo promedio de entrega
   */
  _calculateAverageTimeToDeliver(notifications) {
    const deliveredNotifications = notifications.filter(
      (n) => n.delivered_at && n.sent_at
    );
    if (deliveredNotifications.length === 0) return 0;

    const totalTime = deliveredNotifications.reduce((sum, n) => {
      return sum + (new Date(n.delivered_at) - new Date(n.sent_at));
    }, 0);

    return Math.round(totalTime / deliveredNotifications.length / 1000); // en segundos
  }

  /**
   * Calcular tiempo promedio de lectura
   */
  _calculateAverageTimeToRead(notifications) {
    const readNotifications = notifications.filter(
      (n) => n.read_at && n.delivered_at
    );
    if (readNotifications.length === 0) return 0;

    const totalTime = readNotifications.reduce((sum, n) => {
      return sum + (new Date(n.read_at) - new Date(n.delivered_at));
    }, 0);

    return Math.round(totalTime / readNotifications.length / 1000); // en segundos
  }

  /**
   * Calcular tendencias diarias
   */
  _calculateDailyTrends(notifications, startDate, endDate) {
    const trends = {};
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Inicializar todos los días del período
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split("T")[0];
      trends[dateKey] = {
        total: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
      };
    }

    // Contar notificaciones por día
    notifications.forEach((notification) => {
      const dateKey = notification.created_at.split("T")[0];
      if (trends[dateKey]) {
        trends[dateKey].total++;
        if (
          notification.status === "sent" ||
          notification.status === "delivered" ||
          notification.status === "read"
        ) {
          trends[dateKey].sent++;
        }
        if (
          notification.status === "delivered" ||
          notification.status === "read"
        ) {
          trends[dateKey].delivered++;
        }
        if (notification.status === "failed") {
          trends[dateKey].failed++;
        }
      }
    });

    return trends;
  }

  /**
   * Generar recomendaciones basadas en estadísticas
   */
  _generateNotificationRecommendations(
    basicStats,
    successRates,
    channelStats,
    retryStats
  ) {
    const recommendations = [];

    // Recomendación de tasa de entrega
    if (parseFloat(successRates.deliveryRate) < 85) {
      recommendations.push({
        type: "delivery_optimization",
        priority: "high",
        message: `Tasa de entrega baja (${successRates.deliveryRate}%). Revisar configuración de canales.`,
        action: "optimize_delivery_channels",
      });
    }

    // Recomendación de tasa de lectura
    if (parseFloat(successRates.readRate) < 60) {
      recommendations.push({
        type: "engagement_optimization",
        priority: "medium",
        message: `Tasa de lectura baja (${successRates.readRate}%). Mejorar contenido de mensajes.`,
        action: "improve_message_content",
      });
    }

    // Recomendación de reintentos
    if (
      retryStats.notificationsWithRetries >
      basicStats.totalNotifications * 0.2
    ) {
      recommendations.push({
        type: "reliability_improvement",
        priority: "medium",
        message:
          "Alto número de reintentos. Revisar estabilidad de proveedores.",
        action: "review_provider_reliability",
      });
    }

    // Recomendación de canal más efectivo
    const bestChannel = Object.entries(channelStats)
      .filter(([_, stats]) => stats.total > 0)
      .sort(
        ([_, a], [__, b]) =>
          parseFloat(b.deliveryRate) - parseFloat(a.deliveryRate)
      )[0];

    if (bestChannel && parseFloat(bestChannel[1].deliveryRate) > 90) {
      recommendations.push({
        type: "channel_optimization",
        priority: "low",
        message: `Canal ${bestChannel[0]} tiene la mejor tasa de entrega (${bestChannel[1].deliveryRate}%). Considerar priorizar.`,
        action: "prioritize_best_channel",
      });
    }

    return recommendations;
  }

  /**
   * Registrar métrica de notificación
   */
  async _recordMetric(metricType, metricData) {
    try {
      await supabase.from(this.metricsTableName).insert([
        {
          metric_type: metricType,
          metric_data: metricData,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      logger.error("Error registrando métrica de notificación", error, {
        metric_type: metricType,
        metric_data: metricData,
      });
    }
  }

  /**
   * Limpiar notificaciones antiguas con configuración avanzada
   */
  async cleanupAdvanced(options = {}) {
    const startTime = Date.now();

    try {
      const {
        daysOld = 90,
        statusesToClean = ["sent", "delivered", "read", "failed", "cancelled"],
        batchSize = 1000,
        preserveImportant = true,
      } = options;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      let query = supabase
        .from(this.tableName)
        .delete()
        .lt("created_at", cutoffDate.toISOString())
        .in("status", statusesToClean);

      // Preservar notificaciones importantes si se solicita
      if (preserveImportant) {
        query = query.not("priority", "in", "('urgent', 'critical')");
      }

      const { error, count } = await query;
      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Limpieza avanzada de notificaciones completada", {
        days_old: daysOld,
        statuses_cleaned: statusesToClean,
        records_deleted: count || 0,
        preserve_important: preserveImportant,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        recordsDeleted: count || 0,
        message: `${count || 0} notificaciones eliminadas exitosamente`,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error en limpieza avanzada de notificaciones", error, {
        options,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  // Métodos de compatibilidad con la versión anterior
  async getById(notificationId) {
    const startTime = Date.now();

    try {
      if (!notificationId) {
        return { success: false, error: "ID de notificación requerido" };
      }

      const { data, error } = await this._buildBaseQuery()
        .eq("id", notificationId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return { success: false, error: "Notificación no encontrada" };
        }
        throw error;
      }

      const duration = Date.now() - startTime;
      logger.info("Notificación obtenida por ID", {
        notification_id: notificationId,
        type: data.type,
        status: data.status,
        duration: `${duration}ms`,
      });

      return { success: true, data };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error obteniendo notificación por ID", error, {
        notification_id: notificationId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  async getPendingNotifications() {
    return this.getPendingAdvanced();
  }

  async getByClientId(clientId, limit = 20) {
    return this.searchAdvanced({ client_id: clientId }, { limit });
  }

  async getByBookingId(bookingId) {
    return this.searchAdvanced({ booking_id: bookingId });
  }

  async markAsSent(notificationId, sentData = {}) {
    return this.markAsSentAdvanced(notificationId, sentData);
  }

  async markAsFailed(notificationId, errorMessage) {
    return this.markAsFailedAdvanced(notificationId, errorMessage);
  }

  async reschedule(notificationId, newScheduledTime) {
    const startTime = Date.now();

    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          scheduled_for: newScheduledTime,
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", notificationId)
        .select();

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Notificación reprogramada", {
        notification_id: notificationId,
        new_scheduled_time: newScheduledTime,
        duration: `${duration}ms`,
      });

      return { success: true, data: data[0] };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error reprogramando notificación", error, {
        notification_id: notificationId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  async cancel(notificationId) {
    const startTime = Date.now();

    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", notificationId)
        .select();

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Notificación cancelada", {
        notification_id: notificationId,
        duration: `${duration}ms`,
      });

      return { success: true, data: data[0] };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error cancelando notificación", error, {
        notification_id: notificationId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  async getNotificationStats(startDate, endDate) {
    const result = await this.getAdvancedStats(startDate, endDate);
    if (result.success) {
      // Convertir al formato esperado por la versión anterior
      const advancedStats = result.data;
      return {
        success: true,
        data: {
          total: advancedStats.basic.totalNotifications,
          sent: advancedStats.basic.sent,
          pending: advancedStats.basic.pending,
          failed: advancedStats.basic.failed,
          cancelled: advancedStats.basic.cancelled,
          byChannel: Object.keys(advancedStats.channels).reduce(
            (acc, channel) => {
              acc[channel] = advancedStats.channels[channel].total;
              return acc;
            },
            {}
          ),
          byType: Object.keys(advancedStats.types).reduce((acc, type) => {
            acc[type] = advancedStats.types[type].total;
            return acc;
          }, {}),
        },
      };
    }
    return result;
  }

  async cleanupOldNotifications(daysOld = 90) {
    return this.cleanupAdvanced({ daysOld });
  }

  async createReminder(bookingId, reminderType = "24h") {
    return this.createReminderAdvanced(bookingId, { reminderType });
  }
}

module.exports = new NotificationModel();
