// src/controllers/googleAuthController.js
// Controlador para autenticación con Google Calendar

const googleCalendarClient = require("../integrations/googleCalendarClient");
const logger = require("../utils/logger");
const { validationResult } = require("express-validator");

class GoogleAuthController {
  /**
   * Iniciar flujo de autenticación OAuth con Google
   */
  static async initiateAuth(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "User authentication required",
        });
      }

      // Verificar si el cliente está inicializado
      if (!googleCalendarClient.isInitialized()) {
        return res.status(503).json({
          success: false,
          error: "Google Calendar integration not available",
        });
      }

      // Generar URL de autorización
      const authUrl = googleCalendarClient.getAuthUrl(userId);

      logger.info("Google auth initiated", {
        userId,
        userEmail: req.user.email,
      });

      res.json({
        success: true,
        data: {
          authUrl,
          message:
            "Redirect user to this URL to authorize Google Calendar access",
        },
      });
    } catch (error) {
      logger.error("Error initiating Google auth", {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Failed to initiate Google authentication",
      });
    }
  }

  /**
   * Manejar callback de OAuth de Google
   */
  static async handleCallback(req, res) {
    try {
      const { code, state, error } = req.query;

      // Verificar si hubo error en la autorización
      if (error) {
        logger.warn("Google auth error", { error, state });
        return res.redirect(
          `/admin/settings?google_auth=error&message=${encodeURIComponent(
            error
          )}`
        );
      }

      // Verificar que tenemos el código de autorización
      if (!code) {
        logger.warn("No authorization code received");
        return res.redirect(
          "/admin/settings?google_auth=error&message=No authorization code received"
        );
      }

      // El state contiene el userId
      const userId = state;
      if (!userId) {
        logger.warn("No user ID in state parameter");
        return res.redirect(
          "/admin/settings?google_auth=error&message=Invalid state parameter"
        );
      }

      // Intercambiar código por tokens
      const result = await googleCalendarClient.exchangeCodeForTokens(
        code,
        userId
      );

      if (!result.success) {
        logger.error("Failed to exchange code for tokens", {
          error: result.error,
          userId,
        });
        return res.redirect(
          `/admin/settings?google_auth=error&message=${encodeURIComponent(
            result.error
          )}`
        );
      }

      logger.info("Google Calendar connected successfully", {
        userId,
        hasRefreshToken: result.hasRefreshToken,
      });

      // Redirigir con éxito
      res.redirect(
        "/admin/settings?google_auth=success&message=Google Calendar connected successfully"
      );
    } catch (error) {
      logger.error("Error in Google auth callback", {
        error: error.message,
        query: req.query,
      });

      res.redirect(
        `/admin/settings?google_auth=error&message=${encodeURIComponent(
          "Authentication failed"
        )}`
      );
    }
  }

  /**
   * Verificar estado de conexión con Google
   */
  static async getConnectionStatus(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "User authentication required",
        });
      }

      // Verificar si el usuario tiene tokens válidos
      const tokens = await googleCalendarClient.getUserTokens(userId);
      const isConnected = !!tokens;

      let calendarInfo = null;
      if (isConnected) {
        try {
          // Obtener información básica del calendario
          const calendar = await googleCalendarClient.getAuthenticatedCalendar(
            userId
          );
          const calendarList = await calendar.calendarList.list();

          calendarInfo = {
            primaryCalendar: calendarList.data.items?.find(
              (cal) => cal.primary
            ),
            totalCalendars: calendarList.data.items?.length || 0,
          };
        } catch (calendarError) {
          logger.warn("Error getting calendar info", {
            error: calendarError.message,
            userId,
          });
        }
      }

      res.json({
        success: true,
        data: {
          isConnected,
          calendarInfo,
          lastConnected: tokens ? new Date().toISOString() : null,
        },
      });
    } catch (error) {
      logger.error("Error getting connection status", {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Failed to get connection status",
      });
    }
  }

  /**
   * Desconectar Google Calendar
   */
  static async disconnect(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "User authentication required",
        });
      }

      // Revocar tokens
      const result = await googleCalendarClient.revokeUserTokens(userId);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error || "Failed to disconnect Google Calendar",
        });
      }

      logger.info("Google Calendar disconnected", {
        userId,
        userEmail: req.user.email,
      });

      res.json({
        success: true,
        message: "Google Calendar disconnected successfully",
      });
    } catch (error) {
      logger.error("Error disconnecting Google Calendar", {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Failed to disconnect Google Calendar",
      });
    }
  }

  /**
   * Probar conexión con Google Calendar
   */
  static async testConnection(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "User authentication required",
        });
      }

      // Verificar tokens
      const tokens = await googleCalendarClient.getUserTokens(userId);
      if (!tokens) {
        return res.status(400).json({
          success: false,
          error: "Google Calendar not connected",
        });
      }

      // Probar acceso al calendario
      const calendar = await googleCalendarClient.getAuthenticatedCalendar(
        userId
      );

      // Obtener eventos de hoy para probar la conexión
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      const eventsResponse = await calendar.events.list({
        calendarId: "primary",
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        maxResults: 5,
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = eventsResponse.data.items || [];

      logger.info("Google Calendar connection tested successfully", {
        userId,
        eventsFound: events.length,
      });

      res.json({
        success: true,
        data: {
          connectionStatus: "active",
          eventsToday: events.length,
          sampleEvents: events.slice(0, 3).map((event) => ({
            id: event.id,
            summary: event.summary,
            start: event.start?.dateTime || event.start?.date,
            end: event.end?.dateTime || event.end?.date,
          })),
          message: "Google Calendar connection is working correctly",
        },
      });
    } catch (error) {
      logger.error("Error testing Google Calendar connection", {
        error: error.message,
        userId: req.user?.id,
      });

      // Determinar tipo de error
      let errorMessage = "Connection test failed";
      let statusCode = 500;

      if (
        error.message.includes("invalid_grant") ||
        error.message.includes("unauthorized")
      ) {
        errorMessage =
          "Google Calendar authorization expired. Please reconnect.";
        statusCode = 401;
      } else if (error.message.includes("quota")) {
        errorMessage =
          "Google Calendar API quota exceeded. Please try again later.";
        statusCode = 429;
      }

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
        details: error.message,
      });
    }
  }

  /**
   * Obtener información de calendarios disponibles
   */
  static async getCalendars(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "User authentication required",
        });
      }

      // Verificar conexión
      const tokens = await googleCalendarClient.getUserTokens(userId);
      if (!tokens) {
        return res.status(400).json({
          success: false,
          error: "Google Calendar not connected",
        });
      }

      // Obtener lista de calendarios
      const calendar = await googleCalendarClient.getAuthenticatedCalendar(
        userId
      );
      const calendarListResponse = await calendar.calendarList.list();

      const calendars =
        calendarListResponse.data.items?.map((cal) => ({
          id: cal.id,
          summary: cal.summary,
          description: cal.description,
          primary: cal.primary || false,
          accessRole: cal.accessRole,
          backgroundColor: cal.backgroundColor,
          foregroundColor: cal.foregroundColor,
          timeZone: cal.timeZone,
        })) || [];

      res.json({
        success: true,
        data: {
          calendars,
          total: calendars.length,
          primaryCalendar: calendars.find((cal) => cal.primary),
        },
      });
    } catch (error) {
      logger.error("Error getting calendars", {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Failed to get calendars",
      });
    }
  }
}

module.exports = GoogleAuthController;
