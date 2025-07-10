// src/routes/googleCalendarRoutes.js
// Rutas para integración con Google Calendar

const express = require("express");
const { body } = require("express-validator");
const GoogleAuthController = require("../controllers/googleAuthController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const { auditLog } = require("../middleware/auditMiddleware");

const router = express.Router();

// =====================================================
// RUTAS DE AUTENTICACIÓN GOOGLE
// =====================================================

/**
 * @route   GET /auth/google
 * @desc    Iniciar flujo de autenticación OAuth con Google
 * @access  Private (Admin/User)
 */
router.get(
  "/auth/google",
  authenticate,
  auditLog("GOOGLE_AUTH_INITIATE"),
  GoogleAuthController.initiateAuth
);

/**
 * @route   GET /auth/google/callback
 * @desc    Callback de OAuth de Google
 * @access  Public (manejado por Google)
 */
router.get(
  "/auth/google/callback",
  auditLog("GOOGLE_AUTH_CALLBACK"),
  GoogleAuthController.handleCallback
);

/**
 * @route   GET /auth/google/status
 * @desc    Verificar estado de conexión con Google
 * @access  Private
 */
router.get(
  "/auth/google/status",
  authenticate,
  auditLog("GOOGLE_AUTH_STATUS"),
  GoogleAuthController.getConnectionStatus
);

/**
 * @route   POST /auth/google/disconnect
 * @desc    Desconectar Google Calendar
 * @access  Private
 */
router.post(
  "/auth/google/disconnect",
  authenticate,
  auditLog("GOOGLE_AUTH_DISCONNECT"),
  GoogleAuthController.disconnect
);

/**
 * @route   POST /auth/google/test
 * @desc    Probar conexión con Google Calendar
 * @access  Private
 */
router.post(
  "/auth/google/test",
  authenticate,
  auditLog("GOOGLE_AUTH_TEST"),
  GoogleAuthController.testConnection
);

/**
 * @route   GET /calendars
 * @desc    Obtener lista de calendarios disponibles
 * @access  Private
 */
router.get(
  "/calendars",
  authenticate,
  auditLog("GOOGLE_CALENDARS_LIST"),
  GoogleAuthController.getCalendars
);

// =====================================================
// RUTAS DE GESTIÓN DE EVENTOS
// =====================================================

/**
 * @route   POST /events
 * @desc    Crear evento en Google Calendar
 * @access  Private
 */
router.post(
  "/events",
  authenticate,
  [
    body("title")
      .notEmpty()
      .withMessage("Title is required")
      .isLength({ max: 255 })
      .withMessage("Title must be less than 255 characters"),

    body("startDateTime")
      .isISO8601()
      .withMessage("Start date must be a valid ISO 8601 date"),

    body("endDateTime")
      .isISO8601()
      .withMessage("End date must be a valid ISO 8601 date")
      .custom((endDateTime, { req }) => {
        if (new Date(endDateTime) <= new Date(req.body.startDateTime)) {
          throw new Error("End date must be after start date");
        }
        return true;
      }),

    body("description")
      .optional()
      .isLength({ max: 2000 })
      .withMessage("Description must be less than 2000 characters"),

    body("attendeeEmail")
      .optional()
      .isEmail()
      .withMessage("Attendee email must be valid"),

    body("location")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Location must be less than 500 characters"),

    body("calendarId")
      .optional()
      .isString()
      .withMessage("Calendar ID must be a string"),
  ],
  validateRequest,
  auditLog("GOOGLE_EVENT_CREATE"),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        title,
        description,
        startDateTime,
        endDateTime,
        attendeeEmail,
        attendeeName,
        location,
        calendarId = "primary",
      } = req.body;

      // Obtener cliente autenticado
      const googleCalendarClient = require("../integrations/googleCalendarClient");
      const calendar = await googleCalendarClient.getAuthenticatedCalendar(
        userId
      );

      // Crear evento
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

      const response = await calendar.events.insert({
        calendarId: calendarId,
        resource: event,
        conferenceDataVersion: 1,
        sendUpdates: "all",
      });

      res.json({
        success: true,
        data: {
          id: response.data.id,
          htmlLink: response.data.htmlLink,
          meetLink: response.data.conferenceData?.entryPoints?.[0]?.uri,
          startTime: response.data.start.dateTime,
          endTime: response.data.end.dateTime,
          status: response.data.status,
        },
        message: "Event created successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to create event",
        details: error.message,
      });
    }
  }
);

/**
 * @route   GET /events
 * @desc    Obtener eventos del calendario
 * @access  Private
 */
router.get(
  "/events",
  authenticate,
  auditLog("GOOGLE_EVENTS_LIST"),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        calendarId = "primary",
        timeMin,
        timeMax,
        maxResults = 50,
        orderBy = "startTime",
      } = req.query;

      // Obtener cliente autenticado
      const googleCalendarClient = require("../integrations/googleCalendarClient");
      const calendar = await googleCalendarClient.getAuthenticatedCalendar(
        userId
      );

      // Configurar parámetros de búsqueda
      const params = {
        calendarId: calendarId,
        maxResults: parseInt(maxResults),
        singleEvents: true,
        orderBy: orderBy,
      };

      if (timeMin) {
        params.timeMin = new Date(timeMin).toISOString();
      }

      if (timeMax) {
        params.timeMax = new Date(timeMax).toISOString();
      }

      // Si no se especifica rango, obtener eventos de los próximos 30 días
      if (!timeMin && !timeMax) {
        params.timeMin = new Date().toISOString();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        params.timeMax = futureDate.toISOString();
      }

      const response = await calendar.events.list(params);

      const events =
        response.data.items?.map((event) => ({
          id: event.id,
          summary: event.summary,
          description: event.description,
          location: event.location,
          start: event.start?.dateTime || event.start?.date,
          end: event.end?.dateTime || event.end?.date,
          status: event.status,
          htmlLink: event.htmlLink,
          meetLink: event.conferenceData?.entryPoints?.[0]?.uri,
          attendees:
            event.attendees?.map((attendee) => ({
              email: attendee.email,
              displayName: attendee.displayName,
              responseStatus: attendee.responseStatus,
            })) || [],
          created: event.created,
          updated: event.updated,
        })) || [];

      res.json({
        success: true,
        data: {
          events,
          total: events.length,
          nextPageToken: response.data.nextPageToken,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to get events",
        details: error.message,
      });
    }
  }
);

/**
 * @route   PUT /events/:eventId
 * @desc    Actualizar evento en Google Calendar
 * @access  Private
 */
router.put(
  "/events/:eventId",
  authenticate,
  [
    body("title")
      .optional()
      .isLength({ max: 255 })
      .withMessage("Title must be less than 255 characters"),

    body("startDateTime")
      .optional()
      .isISO8601()
      .withMessage("Start date must be a valid ISO 8601 date"),

    body("endDateTime")
      .optional()
      .isISO8601()
      .withMessage("End date must be a valid ISO 8601 date"),

    body("description")
      .optional()
      .isLength({ max: 2000 })
      .withMessage("Description must be less than 2000 characters"),
  ],
  validateRequest,
  auditLog("GOOGLE_EVENT_UPDATE"),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { eventId } = req.params;
      const { calendarId = "primary" } = req.query;
      const updateData = req.body;

      // Obtener cliente autenticado
      const googleCalendarClient = require("../integrations/googleCalendarClient");
      const calendar = await googleCalendarClient.getAuthenticatedCalendar(
        userId
      );

      // Obtener evento actual
      const currentEvent = await calendar.events.get({
        calendarId: calendarId,
        eventId: eventId,
      });

      // Preparar datos de actualización
      const updatedEvent = {
        ...currentEvent.data,
      };

      if (updateData.title) {
        updatedEvent.summary = updateData.title;
      }

      if (updateData.description) {
        updatedEvent.description = updateData.description;
      }

      if (updateData.location) {
        updatedEvent.location = updateData.location;
      }

      if (updateData.startDateTime) {
        updatedEvent.start = {
          dateTime: updateData.startDateTime,
          timeZone: "Europe/Madrid",
        };
      }

      if (updateData.endDateTime) {
        updatedEvent.end = {
          dateTime: updateData.endDateTime,
          timeZone: "Europe/Madrid",
        };
      }

      // Actualizar evento
      const response = await calendar.events.update({
        calendarId: calendarId,
        eventId: eventId,
        resource: updatedEvent,
        sendUpdates: "all",
      });

      res.json({
        success: true,
        data: {
          id: response.data.id,
          htmlLink: response.data.htmlLink,
          status: response.data.status,
          updated: response.data.updated,
        },
        message: "Event updated successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to update event",
        details: error.message,
      });
    }
  }
);

/**
 * @route   DELETE /events/:eventId
 * @desc    Eliminar evento de Google Calendar
 * @access  Private
 */
router.delete(
  "/events/:eventId",
  authenticate,
  auditLog("GOOGLE_EVENT_DELETE"),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { eventId } = req.params;
      const { calendarId = "primary", sendUpdates = "all" } = req.query;

      // Obtener cliente autenticado
      const googleCalendarClient = require("../integrations/googleCalendarClient");
      const calendar = await googleCalendarClient.getAuthenticatedCalendar(
        userId
      );

      // Eliminar evento
      await calendar.events.delete({
        calendarId: calendarId,
        eventId: eventId,
        sendUpdates: sendUpdates,
      });

      res.json({
        success: true,
        message: "Event deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to delete event",
        details: error.message,
      });
    }
  }
);

/**
 * @route   POST /events/:eventId/cancel
 * @desc    Cancelar evento en Google Calendar
 * @access  Private
 */
router.post(
  "/events/:eventId/cancel",
  authenticate,
  [
    body("reason")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Reason must be less than 500 characters"),
  ],
  validateRequest,
  auditLog("GOOGLE_EVENT_CANCEL"),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { eventId } = req.params;
      const { reason = "Evento cancelado", calendarId = "primary" } = req.body;

      // Obtener cliente autenticado
      const googleCalendarClient = require("../integrations/googleCalendarClient");
      const calendar = await googleCalendarClient.getAuthenticatedCalendar(
        userId
      );

      // Obtener evento actual
      const currentEvent = await calendar.events.get({
        calendarId: calendarId,
        eventId: eventId,
      });

      // Marcar como cancelado
      const cancelledEvent = {
        ...currentEvent.data,
        status: "cancelled",
        description: `${
          currentEvent.data.description || ""
        }\n\n[CANCELADO] ${reason}`,
      };

      // Actualizar evento
      await calendar.events.update({
        calendarId: calendarId,
        eventId: eventId,
        resource: cancelledEvent,
        sendUpdates: "all",
      });

      res.json({
        success: true,
        message: "Event cancelled successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to cancel event",
        details: error.message,
      });
    }
  }
);

module.exports = router;
