// src/integrations/googleCalendarClient.js
const { google } = require("googleapis");
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GOOGLE_CALENDAR_ID,
  GOOGLE_CALENDAR_CREDENTIALS,
} = require("../config/env");
const logger = require("../utils/logger");
const DatabaseAdapter = require("../adapters/databaseAdapter");

class GoogleCalendarClient {
  constructor() {
    this.calendar = null;
    this.oauth2Client = null;
    this.calendarId = GOOGLE_CALENDAR_ID || "primary";
    this.initialized = false;
    this.userTokens = new Map(); // Cache de tokens por usuario
    this.initializeClient();
  }

  /**
   * Inicializar cliente de Google Calendar
   */
  async initializeClient() {
    try {
      // Verificar configuración OAuth
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
        logger.warn("Google OAuth credentials not configured");

        // Fallback a service account si está disponible
        if (GOOGLE_CALENDAR_CREDENTIALS) {
          return this.initializeServiceAccount();
        }
        return;
      }

      // Configurar OAuth2 client
      this.oauth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI
      );

      this.initialized = true;
      logger.info("Google Calendar OAuth client initialized successfully");
    } catch (error) {
      logger.error("Error initializing Google Calendar client:", error);
      this.initialized = false;
    }
  }

  /**
   * Inicializar con service account (fallback)
   */
  async initializeServiceAccount() {
    try {
      const credentials = JSON.parse(GOOGLE_CALENDAR_CREDENTIALS);

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          "https://www.googleapis.com/auth/calendar",
          "https://www.googleapis.com/auth/calendar.events",
        ],
      });

      this.calendar = google.calendar({ version: "v3", auth });
      this.initialized = true;

      logger.info("Google Calendar service account initialized successfully");
    } catch (error) {
      logger.error("Error initializing service account:", error);
      this.initialized = false;
    }
  }

  /**
   * Verificar si el cliente está inicializado
   */
  isInitialized() {
    return this.initialized && (this.calendar || this.oauth2Client);
  }

  /**
   * Generar URL de autorización OAuth
   */
  getAuthUrl(userId, scopes = null) {
    if (!this.oauth2Client) {
      throw new Error("OAuth client not initialized");
    }

    const defaultScopes = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ];

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes || defaultScopes,
      state: userId, // Para identificar al usuario en el callback
      prompt: "consent", // Forzar pantalla de consentimiento para obtener refresh token
    });

    logger.info("Generated Google auth URL", {
      userId,
      authUrl: authUrl.substring(0, 100) + "...",
    });
    return authUrl;
  }

  /**
   * Intercambiar código de autorización por tokens
   */
  async exchangeCodeForTokens(code, userId) {
    try {
      if (!this.oauth2Client) {
        throw new Error("OAuth client not initialized");
      }

      // Intercambiar código por tokens
      const { tokens } = await this.oauth2Client.getToken(code);

      // Guardar tokens en base de datos
      await this.saveUserTokens(userId, tokens);

      // Cachear tokens
      this.userTokens.set(userId, {
        tokens,
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600000), // 1 hora por defecto
      });

      logger.info("Successfully exchanged code for tokens", {
        userId,
        hasRefreshToken: !!tokens.refresh_token,
      });

      return {
        success: true,
        tokens,
        hasRefreshToken: !!tokens.refresh_token,
      };
    } catch (error) {
      logger.error("Error exchanging code for tokens", {
        error: error.message,
        userId,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Obtener tokens de usuario desde base de datos
   */
  async getUserTokens(userId) {
    try {
      // Verificar cache primero
      const cached = this.userTokens.get(userId);
      if (cached && cached.expiresAt > new Date()) {
        return cached.tokens;
      }

      // Buscar en base de datos
      const result = await DatabaseAdapter.query(
        `
        SELECT google_access_token, google_refresh_token, google_token_expires_at
        FROM users 
        WHERE id = $1 AND google_access_token IS NOT NULL
      `,
        [userId]
      );

      if (!result.data || result.data.length === 0) {
        return null;
      }

      const user = result.data[0];
      const tokens = {
        access_token: user.google_access_token,
        refresh_token: user.google_refresh_token,
        expiry_date: user.google_token_expires_at
          ? new Date(user.google_token_expires_at).getTime()
          : null,
      };

      // Verificar si el token ha expirado
      if (tokens.expiry_date && tokens.expiry_date <= Date.now()) {
        if (tokens.refresh_token) {
          return await this.refreshUserTokens(userId, tokens.refresh_token);
        } else {
          return null; // Token expirado sin refresh token
        }
      }

      // Cachear tokens válidos
      this.userTokens.set(userId, {
        tokens,
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600000),
      });

      return tokens;
    } catch (error) {
      logger.error("Error getting user tokens", {
        error: error.message,
        userId,
      });
      return null;
    }
  }

  /**
   * Guardar tokens de usuario en base de datos
   */
  async saveUserTokens(userId, tokens) {
    try {
      const expiresAt = tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : null;

      await DatabaseAdapter.query(
        `
        UPDATE users 
        SET 
          google_access_token = $1,
          google_refresh_token = COALESCE($2, google_refresh_token),
          google_token_expires_at = $3,
          google_connected_at = NOW(),
          updated_at = NOW()
        WHERE id = $4
      `,
        [
          tokens.access_token,
          tokens.refresh_token,
          expiresAt?.toISOString(),
          userId,
        ]
      );

      logger.info("User tokens saved successfully", { userId });
    } catch (error) {
      logger.error("Error saving user tokens", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Refrescar tokens de usuario
   */
  async refreshUserTokens(userId, refreshToken) {
    try {
      if (!this.oauth2Client) {
        throw new Error("OAuth client not initialized");
      }

      // Configurar refresh token
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      // Refrescar tokens
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      // Guardar nuevos tokens
      await this.saveUserTokens(userId, credentials);

      // Actualizar cache
      this.userTokens.set(userId, {
        tokens: credentials,
        expiresAt: new Date(credentials.expiry_date || Date.now() + 3600000),
      });

      logger.info("User tokens refreshed successfully", { userId });
      return credentials;
    } catch (error) {
      logger.error("Error refreshing user tokens", {
        error: error.message,
        userId,
      });

      // Si el refresh token es inválido, limpiar tokens del usuario
      await this.revokeUserTokens(userId);
      return null;
    }
  }

  /**
   * Revocar tokens de usuario
   */
  async revokeUserTokens(userId) {
    try {
      const tokens = await this.getUserTokens(userId);

      if (tokens && tokens.access_token) {
        // Revocar token en Google
        try {
          await this.oauth2Client.revokeToken(tokens.access_token);
        } catch (revokeError) {
          logger.warn("Error revoking token with Google", {
            error: revokeError.message,
            userId,
          });
        }
      }

      // Limpiar tokens de base de datos
      await DatabaseAdapter.query(
        `
        UPDATE users 
        SET 
          google_access_token = NULL,
          google_refresh_token = NULL,
          google_token_expires_at = NULL,
          google_disconnected_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `,
        [userId]
      );

      // Limpiar cache
      this.userTokens.delete(userId);

      logger.info("User tokens revoked successfully", { userId });
      return { success: true };
    } catch (error) {
      logger.error("Error revoking user tokens", {
        error: error.message,
        userId,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener cliente de calendar autenticado para un usuario
   */
  async getAuthenticatedCalendar(userId) {
    try {
      const tokens = await this.getUserTokens(userId);
      if (!tokens) {
        throw new Error("User not authenticated with Google Calendar");
      }

      // Crear cliente OAuth con tokens del usuario
      const userOAuth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI
      );

      userOAuth2Client.setCredentials(tokens);

      // Crear cliente de calendar
      const calendar = google.calendar({
        version: "v3",
        auth: userOAuth2Client,
      });

      return calendar;
    } catch (error) {
      logger.error("Error getting authenticated calendar", {
        error: error.message,
        userId,
      });
      throw error;
    }
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
