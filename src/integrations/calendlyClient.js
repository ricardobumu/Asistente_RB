// src/integrations/calendlyClient.js
const { CALENDLY_ACCESS_TOKEN, CALENDLY_USER_URI } = require("../config/env");
const logger = require("../utils/logger");

class CalendlyClient {
  constructor() {
    this.accessToken = CALENDLY_ACCESS_TOKEN;
    this.userUri = CALENDLY_USER_URI;
    this.baseURL = "https://api.calendly.com";
    this.initialized = !!this.accessToken;

    if (!this.initialized) {
      logger.warn("Calendly client not initialized - missing access token");
    }
  }

  /**
   * Realizar petición a la API de Calendly
   */
  async makeRequest(endpoint, options = {}) {
    if (!this.initialized) {
      throw new Error("Calendly client not initialized");
    }

    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Calendly API error: ${response.status} - ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      logger.error("Calendly API request failed", {
        endpoint,
        error: error.message,
        status: error.status,
      });
      throw error;
    }
  }

  /**
   * Obtener tipos de eventos del usuario
   */
  async getEventTypes() {
    try {
      const response = await this.makeRequest(
        `/event_types?user=${this.userUri}`
      );
      return {
        success: true,
        data: response.collection || [],
      };
    } catch (error) {
      logger.error("Error getting event types", { error: error.message });
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Obtener disponibilidad para un tipo de evento
   */
  async getAvailability(params = {}) {
    try {
      const { event_type, start_time, end_time } = params;

      if (!event_type) {
        throw new Error("Event type is required");
      }

      // Construir parámetros de consulta
      const queryParams = new URLSearchParams({
        event_type: event_type,
        start_time: start_time || new Date().toISOString(),
        end_time:
          end_time ||
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 días
      });

      const response = await this.makeRequest(
        `/event_type_available_times?${queryParams}`
      );

      return {
        success: true,
        available: response.collection && response.collection.length > 0,
        slots: response.collection || [],
        data: response,
      };
    } catch (error) {
      logger.error("Error checking availability", {
        error: error.message,
        params,
      });
      return {
        success: false,
        available: false,
        slots: [],
        error: error.message,
      };
    }
  }

  /**
   * Obtener slots disponibles para un servicio
   */
  async getAvailableSlots(serviceName, fromDate, daysAhead = 7) {
    try {
      // Primero obtener tipos de eventos
      const eventTypesResult = await this.getEventTypes();
      if (!eventTypesResult.success) {
        throw new Error("Could not fetch event types");
      }

      // Buscar el tipo de evento que coincida con el servicio
      const eventType = eventTypesResult.data.find(
        (et) =>
          et.name.toLowerCase().includes(serviceName.toLowerCase()) ||
          et.slug.toLowerCase().includes(serviceName.toLowerCase())
      );

      if (!eventType) {
        return {
          success: false,
          error: `No event type found for service: ${serviceName}`,
          slots: [],
        };
      }

      // Calcular fechas
      const startDate = new Date(fromDate);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + daysAhead);

      // Obtener disponibilidad
      const availability = await this.getAvailability({
        event_type: eventType.uri,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
      });

      return {
        success: true,
        slots: availability.slots,
        eventType: eventType,
        dateRange: {
          from: startDate.toISOString(),
          to: endDate.toISOString(),
        },
      };
    } catch (error) {
      logger.error("Error getting available slots", {
        error: error.message,
        serviceName,
        fromDate,
        daysAhead,
      });
      return {
        success: false,
        error: error.message,
        slots: [],
      };
    }
  }

  /**
   * Crear una reserva en Calendly
   */
  async createBooking(bookingData) {
    try {
      const {
        event_type_uri,
        start_time,
        invitee_name,
        invitee_email,
        invitee_phone,
        additional_info,
      } = bookingData;

      if (!event_type_uri || !start_time || !invitee_email) {
        throw new Error(
          "Missing required booking data: event_type_uri, start_time, invitee_email"
        );
      }

      // Calendly usa un sistema de scheduling links, no creación directa
      // Para crear reservas automáticas necesitamos usar Scheduling Links
      const schedulingData = {
        max_event_count: 1,
        owner: this.userUri,
        pool_type: "round_robin",
        event_settings: {
          event_type: event_type_uri,
          start_time: start_time,
        },
        invitee_settings: {
          name: invitee_name,
          email: invitee_email,
          phone_number: invitee_phone,
          text_reminder_number: invitee_phone,
          custom_questions: additional_info
            ? [
                {
                  name: "Información adicional",
                  answer: additional_info,
                },
              ]
            : [],
        },
      };

      // Nota: La API de Calendly no permite creación directa de eventos
      // Necesitamos usar webhooks o scheduling links
      logger.warn("Direct booking creation not supported by Calendly API", {
        bookingData: schedulingData,
      });

      return {
        success: false,
        error:
          "Direct booking creation not supported by Calendly API. Use scheduling links instead.",
        schedulingData: schedulingData,
        requiresManualBooking: true,
      };
    } catch (error) {
      logger.error("Error creating Calendly booking", {
        error: error.message,
        bookingData,
      });
      return {
        success: false,
        error: error.message,
        requiresManualBooking: true,
      };
    }
  }

  /**
   * Obtener eventos programados
   */
  async getScheduledEvents(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        user: this.userUri,
        status: params.status || "active",
        sort: params.sort || "start_time:asc",
        count: params.count || 100,
        ...params,
      });

      const response = await this.makeRequest(
        `/scheduled_events?${queryParams}`
      );

      return {
        success: true,
        data: response.collection || [],
        pagination: response.pagination,
      };
    } catch (error) {
      logger.error("Error getting scheduled events", {
        error: error.message,
        params,
      });
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Cancelar un evento
   */
  async cancelEvent(eventUri, reason = "") {
    try {
      const response = await this.makeRequest(
        `/scheduled_events/${eventUri}/cancellation`,
        {
          method: "POST",
          body: JSON.stringify({
            reason: reason,
          }),
        }
      );

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      logger.error("Error canceling event", {
        error: error.message,
        eventUri,
        reason,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verificar si el cliente está inicializado
   */
  isInitialized() {
    return this.initialized;
  }
}

module.exports = new CalendlyClient();
