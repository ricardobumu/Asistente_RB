// src/integrations/googleCalendarClient.js
const { google } = require("googleapis");
const {
  GOOGLE_CALENDAR_CREDENTIALS,
  GOOGLE_CALENDAR_ID,
} = require("../config/env");
const logger = require("../utils/logger");

class GoogleCalendarClient {
  constructor() {
    this.calendar = null;
    this.calendarId = GOOGLE_CALENDAR_ID || "primary";
    this.initialized = false;
    this.initializeClient();
  }

  /**
   * Inicializar cliente de Google Calendar
   */
  async initializeClient() {
    try {
      if (!GOOGLE_CALENDAR_CREDENTIALS) {
        logger.warn("Google Calendar credentials not configured");
        return;
      }

      // Parsear credenciales JSON
      const credentials = JSON.parse(GOOGLE_CALENDAR_CREDENTIALS);

      // Configurar autenticación
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          "https://www.googleapis.com/auth/calendar",
          "https://www.googleapis.com/auth/calendar.events",
        ],
      });

      // Crear cliente de Calendar API
      this.calendar = google.calendar({ version: "v3", auth });
      this.initialized = true;

      logger.info("Google Calendar client initialized successfully");
    } catch (error) {
      logger.error("Error initializing Google Calendar client:", error);
      this.initialized = false;
    }
  }

  /**
   * Verificar si el cliente está inicializado
   */
  isInitialized() {
    return this.initialized && this.calendar;
  }

  /**
   * Crear evento en Google Calendar
   */
  async createEvent(eventData) {
    try {
      if (!this.isInitialized()) {
        throw new Error("Google Calendar client not initialized");
      }

      const {
        title,
        description,
        startDateTime,
        endDateTime,
        attendeeEmail,
        attendeeName,
        location = "Consulta Virtual",
      } = eventData;

      // Configurar evento
      const event = {
        summary: title,
        description: description,
        location: location,
        start: {
          dateTime: startDateTime,
          timeZone: "Europe/Madrid",
        },
        end: {
          dateTime: endDateTime,
          timeZone: "Europe/Madrid",
        },
        attendees: attendeeEmail
          ? [
              {
                email: attendeeEmail,
                displayName: attendeeName || attendeeEmail,
                responseStatus: "needsAction",
              },
            ]
          : [],
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 }, // 24 horas antes
            { method: "popup", minutes: 30 }, // 30 minutos antes
          ],
        },
        conferenceData: {
          createRequest: {
            requestId: `booking-${Date.now()}`,
            conferenceSolutionKey: {
              type: "hangoutsMeet",
            },
          },
        },
      };

      // Crear evento
      const response = await this.calendar.events.insert({
        calendarId: this.calendarId,
        resource: event,
        conferenceDataVersion: 1,
        sendUpdates: "all",
      });

      logger.info("Google Calendar event created:", {
        eventId: response.data.id,
        title: title,
        startTime: startDateTime,
      });

      return {
        success: true,
        data: {
          id: response.data.id,
          htmlLink: response.data.htmlLink,
          meetLink: response.data.conferenceData?.entryPoints?.[0]?.uri,
          startTime: response.data.start.dateTime,
          endTime: response.data.end.dateTime,
        },
      };
    } catch (error) {
      logger.error("Error creating Google Calendar event:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Actualizar evento en Google Calendar
   */
  async updateEvent(eventId, updateData) {
    try {
      if (!this.isInitialized()) {
        throw new Error("Google Calendar client not initialized");
      }

      // Obtener evento actual
      const currentEvent = await this.calendar.events.get({
        calendarId: this.calendarId,
        eventId: eventId,
      });

      // Preparar datos de actualización
      const updatedEvent = {
        ...currentEvent.data,
        ...updateData,
      };

      // Actualizar evento
      const response = await this.calendar.events.update({
        calendarId: this.calendarId,
        eventId: eventId,
        resource: updatedEvent,
        sendUpdates: "all",
      });

      logger.info("Google Calendar event updated:", {
        eventId: eventId,
        changes: Object.keys(updateData),
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      logger.error("Error updating Google Calendar event:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Cancelar evento en Google Calendar
   */
  async cancelEvent(eventId, reason = "Cita cancelada") {
    try {
      if (!this.isInitialized()) {
        throw new Error("Google Calendar client not initialized");
      }

      // Obtener evento actual
      const currentEvent = await this.calendar.events.get({
        calendarId: this.calendarId,
        eventId: eventId,
      });

      // Marcar como cancelado
      const cancelledEvent = {
        ...currentEvent.data,
        status: "cancelled",
        description: `${
          currentEvent.data.description || ""
        }\n\n[CANCELADA] ${reason}`,
      };

      // Actualizar evento
      await this.calendar.events.update({
        calendarId: this.calendarId,
        eventId: eventId,
        resource: cancelledEvent,
        sendUpdates: "all",
      });

      logger.info("Google Calendar event cancelled:", {
        eventId: eventId,
        reason: reason,
      });

      return {
        success: true,
        message: "Evento cancelado exitosamente",
      };
    } catch (error) {
      logger.error("Error cancelling Google Calendar event:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Obtener eventos del día
   */
  async getTodayEvents() {
    try {
      if (!this.isInitialized()) {
        throw new Error("Google Calendar client not initialized");
      }

      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
      });

      return {
        success: true,
        data: response.data.items || [],
        count: response.data.items?.length || 0,
      };
    } catch (error) {
      logger.error("Error getting today events:", error);
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Obtener próximos eventos
   */
  async getUpcomingEvents(days = 7) {
    try {
      if (!this.isInitialized()) {
        throw new Error("Google Calendar client not initialized");
      }

      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(now.getDate() + days);

      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: now.toISOString(),
        timeMax: futureDate.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
      });

      return {
        success: true,
        data: response.data.items || [],
        count: response.data.items?.length || 0,
      };
    } catch (error) {
      logger.error("Error getting upcoming events:", error);
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Verificar disponibilidad en un horario
   */
  async checkAvailability(startDateTime, endDateTime) {
    try {
      if (!this.isInitialized()) {
        throw new Error("Google Calendar client not initialized");
      }

      const response = await this.calendar.freebusy.query({
        resource: {
          timeMin: startDateTime,
          timeMax: endDateTime,
          items: [{ id: this.calendarId }],
        },
      });

      const busyTimes = response.data.calendars[this.calendarId]?.busy || [];
      const isAvailable = busyTimes.length === 0;

      return {
        success: true,
        available: isAvailable,
        busyTimes: busyTimes,
      };
    } catch (error) {
      logger.error("Error checking availability:", error);
      return {
        success: false,
        error: error.message,
        available: false,
      };
    }
  }
}

// Crear instancia singleton
const googleCalendarClient = new GoogleCalendarClient();

module.exports = googleCalendarClient;
