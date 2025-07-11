// src/controllers/calendlyWebhookController.js
const BookingService = require("../services/bookingService");
const ClientService = require("../services/clientService");
const ServiceService = require("../services/serviceService");
const DatabaseAdapter = require("../adapters/databaseAdapter");
const calendlyClient = require("../integrations/calendlyClient");
const logger = require("../utils/logger");

class CalendlyWebhookController {
  /**
   * Manejar webhook de Calendly
   */
  static async handleWebhook(req, res) {
    try {
      const { event, payload } = req.body;

      logger.info("Calendly webhook received:", {
        event: event,
        payloadKeys: Object.keys(payload || {}),
      });

      switch (event) {
        case "invitee.created":
          await CalendlyWebhookController.handleInviteeCreated(payload);
          break;

        case "invitee.canceled":
          await CalendlyWebhookController.handleInviteeCanceled(payload);
          break;

        case "invitee_no_show.created":
          await CalendlyWebhookController.handleInviteeNoShow(payload);
          break;

        default:
          logger.info("Unhandled Calendly event:", event);
      }

      res.status(200).json({
        success: true,
        message: "Webhook processed successfully",
      });
    } catch (error) {
      logger.error("Error processing Calendly webhook:", error);
      res.status(500).json({
        success: false,
        error: "Error processing webhook",
      });
    }
  }

  /**
   * Manejar creación de invitado (nueva reserva)
   */
  static async handleInviteeCreated(payload) {
    try {
      const { email, name, event: eventData, scheduled_event } = payload;

      // Extraer información del evento
      const startTime = scheduled_event?.start_time;
      const endTime = scheduled_event?.end_time;
      const eventTypeUri = eventData?.event_type;

      if (!startTime || !email) {
        logger.warn("Incomplete Calendly invitee data:", payload);
        return;
      }

      // Buscar o crear cliente
      let clientResult = await ClientService.findByEmail(email);

      if (!clientResult.success || !clientResult.data) {
        // Crear nuevo cliente
        const [firstName, ...lastNameParts] = (name || email).split(" ");
        const lastName = lastNameParts.join(" ") || "";

        const newClientData = {
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: "", // Se puede actualizar después
          source: "calendly",
        };

        clientResult = await ClientService.createClient(newClientData);

        if (!clientResult.success) {
          logger.error(
            "Error creating client from Calendly:",
            clientResult.error,
          );
          return;
        }
      }

      // Determinar el servicio basado en el tipo de evento
      const serviceResult =
        await CalendlyWebhookController.mapEventTypeToService(eventTypeUri);

      if (!serviceResult.success) {
        logger.warn(
          "Could not map Calendly event type to service:",
          eventTypeUri,
        );
        return;
      }

      // Crear reserva
      const bookingData = {
        client_phone: clientResult.data.phone || email, // Usar email como fallback
        service_id: serviceResult.data.id,
        scheduled_at: startTime,
        status: "confirmada",
        booking_url: scheduled_event?.uri,
        notes: `Reserva creada desde Calendly - Evento: ${
          eventData?.name || "N/A"
        }`,
      };

      const bookingResult = await BookingService.createBooking(bookingData);

      if (bookingResult.success) {
        logger.info("Booking created from Calendly webhook:", {
          bookingId: bookingResult.data.id,
          clientEmail: email,
          scheduledAt: startTime,
        });
      } else {
        logger.error(
          "Error creating booking from Calendly:",
          bookingResult.error,
        );
      }
    } catch (error) {
      logger.error("Error handling Calendly invitee created:", error);
    }
  }

  /**
   * Manejar cancelación de invitado
   */
  static async handleInviteeCanceled(payload) {
    try {
      const { email, scheduled_event } = payload;
      const eventUri = scheduled_event?.uri;

      if (!eventUri) {
        logger.warn("No event URI in Calendly cancellation:", payload);
        return;
      }

      // Buscar reserva por URL de Calendly
      const { data: bookings, error } = await DatabaseAdapter.select(
        "bookings",
        "*",
        {
          booking_url: eventUri,
        },
      );

      if (error || !bookings || bookings.length === 0) {
        logger.warn("No booking found for cancelled Calendly event:", eventUri);
        return;
      }

      const booking = bookings[0];

      // Cancelar reserva
      const cancelResult = await BookingService.cancelBooking(
        booking.id,
        "Cancelada desde Calendly",
      );

      if (cancelResult.success) {
        logger.info("Booking cancelled from Calendly webhook:", {
          bookingId: booking.id,
          clientEmail: email,
        });
      } else {
        logger.error(
          "Error cancelling booking from Calendly:",
          cancelResult.error,
        );
      }
    } catch (error) {
      logger.error("Error handling Calendly invitee canceled:", error);
    }
  }

  /**
   * Manejar no-show de invitado
   */
  static async handleInviteeNoShow(payload) {
    try {
      const { email, scheduled_event } = payload;
      const eventUri = scheduled_event?.uri;

      if (!eventUri) {
        logger.warn("No event URI in Calendly no-show:", payload);
        return;
      }

      // Buscar reserva por URL de Calendly
      const { data: bookings, error } = await DatabaseAdapter.select(
        "bookings",
        "*",
        {
          booking_url: eventUri,
        },
      );

      if (error || !bookings || bookings.length === 0) {
        logger.warn("No booking found for no-show Calendly event:", eventUri);
        return;
      }

      const booking = bookings[0];

      // Marcar como no-show
      const updateResult = await BookingService.updateBookingStatus(
        booking.id,
        "no_show",
        "Cliente no se presentó (marcado desde Calendly)",
      );

      if (updateResult.success) {
        logger.info("Booking marked as no-show from Calendly webhook:", {
          bookingId: booking.id,
          clientEmail: email,
        });
      } else {
        logger.error(
          "Error marking booking as no-show from Calendly:",
          updateResult.error,
        );
      }
    } catch (error) {
      logger.error("Error handling Calendly invitee no-show:", error);
    }
  }

  /**
   * Mapear tipo de evento de Calendly a servicio interno
   */
  static async mapEventTypeToService(eventTypeUri) {
    try {
      // Obtener todos los servicios activos
      const servicesResult = await ServiceService.getActiveServices();

      if (!servicesResult.success || !servicesResult.data.length) {
        return {
          success: false,
          error: "No active services found",
        };
      }

      // Por ahora, usar el primer servicio activo
      // En el futuro, se puede implementar un mapeo más sofisticado
      const defaultService = servicesResult.data[0];

      return {
        success: true,
        data: defaultService,
      };
    } catch (error) {
      logger.error("Error mapping event type to service:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verificar webhook (para configuración inicial)
   */
  static async verifyWebhook(req, res) {
    try {
      const challenge = req.query.challenge;

      if (challenge) {
        // Responder con el challenge para verificar el webhook
        res.status(200).send(challenge);
      } else {
        res.status(200).json({
          success: true,
          message: "Calendly webhook endpoint is active",
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error("Error verifying Calendly webhook:", error);
      res.status(500).json({
        success: false,
        error: "Error verifying webhook",
      });
    }
  }

  /**
   * Sincronizar eventos manualmente
   */
  static async syncEvents(req, res) {
    try {
      // Esta función se puede implementar para sincronizar eventos existentes
      res.status(200).json({
        success: true,
        message: "Manual sync not implemented yet",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error syncing Calendly events:", error);
      res.status(500).json({
        success: false,
        error: "Error syncing events",
      });
    }
  }

  /**
   * Obtener eventos de Calendly
   */
  static async getEvents(req, res) {
    try {
      // Implementar obtención de eventos desde Calendly API
      res.status(200).json({
        success: true,
        data: [],
        message: "Events retrieval not implemented yet",
      });
    } catch (error) {
      logger.error("Error getting Calendly events:", error);
      res.status(500).json({
        success: false,
        error: "Error getting events",
      });
    }
  }

  /**
   * Obtener tipos de eventos disponibles
   */
  static async getEventTypes(req, res) {
    try {
      if (!calendlyClient.accessToken) {
        return res.status(400).json({
          success: false,
          error: "Calendly not configured",
        });
      }

      // Obtener tipos de eventos desde Calendly API
      const response = await calendlyClient.makeRequest("/event_types");

      if (!response.ok) {
        throw new Error(`Calendly API error: ${response.status}`);
      }

      const data = await response.json();

      res.status(200).json({
        success: true,
        data: data.collection || [],
        count: data.collection?.length || 0,
      });
    } catch (error) {
      logger.error("Error getting Calendly event types:", error);
      res.status(500).json({
        success: false,
        error: "Error getting event types",
      });
    }
  }
}

module.exports = CalendlyWebhookController;
