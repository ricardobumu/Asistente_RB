// src/controllers/pipedreamTestController.js
// Controlador para probar la integración con Pipedream

const pipedreamService = require("../services/pipedreamService");
const logger = require("../utils/logger");

class PipedreamTestController {
  /**
   * Probar conectividad con Pipedream
   */
  static async testConnectivity(req, res) {
    try {
      logger.info("🧪 Iniciando test de conectividad con Pipedream");

      const results = await pipedreamService.testConnectivity();

      res.status(200).json({
        success: true,
        message: "Pipedream connectivity test completed",
        results: results,
        configuration: pipedreamService.getConfiguration(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("❌ Error en test de conectividad:", error);
      res.status(500).json({
        success: false,
        error: "Connectivity test failed",
        message: error.message,
      });
    }
  }

  /**
   * Simular webhook de Calendly para probar integración
   */
  static async simulateCalendlyWebhook(req, res) {
    try {
      const { eventType = "invitee.created", customPayload } = req.body;

      logger.info("🧪 Simulando webhook de Calendly:", { eventType });

      // Payload de prueba realista
      const mockPayload = customPayload || {
        cancel_url: "https://calendly.com/cancellations/TEST123",
        created_at: new Date().toISOString(),
        email: "test@example.com",
        event: "https://api.calendly.com/scheduled_events/TEST123",
        name: "Test User",
        questions_and_answers: [
          {
            question: "What's your phone number?",
            answer: "+34612345678",
          },
        ],
        status: "active",
        timezone: "Europe/Madrid",
        updated_at: new Date().toISOString(),
        uri: "https://api.calendly.com/scheduled_events/TEST123/invitees/TEST123",
        invitee: {
          uri: "https://api.calendly.com/scheduled_events/TEST123/invitees/TEST123",
          name: "Test User",
          email: "test@example.com",
          phone_number: "+34612345678",
          timezone: "Europe/Madrid",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        event_type: {
          name: "Test Meeting",
          duration: 30,
          kind: "solo",
        },
        start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Mañana
        end_time: new Date(
          Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000
        ).toISOString(), // Mañana + 30 min
        location: {
          type: "zoom",
          location: "https://zoom.us/j/test123",
        },
      };

      // Enviar a Pipedream
      const result = await pipedreamService.sendCalendlyEventToPipedream(
        eventType,
        mockPayload
      );

      if (result.success) {
        logger.info("✅ Simulación de webhook enviada exitosamente");
        res.status(200).json({
          success: true,
          message: "Calendly webhook simulation sent successfully",
          eventType: eventType,
          phoneExtracted:
            pipedreamService.extractPhoneFromCalendlyPayload(mockPayload),
          pipedreamResponse: result.data,
          timestamp: new Date().toISOString(),
        });
      } else {
        logger.error("❌ Error enviando simulación:", result.error);
        res.status(500).json({
          success: false,
          message: "Failed to send webhook simulation",
          error: result.error,
          details: result.details,
        });
      }
    } catch (error) {
      logger.error("❌ Error en simulación de webhook:", error);
      res.status(500).json({
        success: false,
        error: "Webhook simulation failed",
        message: error.message,
      });
    }
  }

  /**
   * Simular mensaje de WhatsApp para probar integración
   */
  static async simulateWhatsAppMessage(req, res) {
    try {
      const {
        phoneNumber = "+34612345678",
        message = "Hola, quiero reservar una cita",
        messageId = "TEST_MSG_" + Date.now(),
      } = req.body;

      logger.info("🧪 Simulando mensaje de WhatsApp:", {
        phone: pipedreamService.maskPhone(phoneNumber),
        messageId,
      });

      // Verificar si la URL está configurada
      if (!pipedreamService.whatsappInboundHandlerUrl) {
        return res.status(400).json({
          success: false,
          error: "WhatsApp Inbound Handler URL not configured",
          message:
            "Please set PIPEDREAM_WHATSAPP_INBOUND_HANDLER_URL environment variable",
        });
      }

      // Enviar a Pipedream
      const result = await pipedreamService.sendWhatsAppMessageToPipedream(
        phoneNumber,
        message,
        messageId,
        {
          profile_name: "Test User",
          timestamp: new Date().toISOString(),
          source: "simulation_test",
        }
      );

      if (result.success) {
        logger.info("✅ Simulación de mensaje WhatsApp enviada exitosamente");
        res.status(200).json({
          success: true,
          message: "WhatsApp message simulation sent successfully",
          phoneNumber: pipedreamService.maskPhone(phoneNumber),
          messageId: messageId,
          pipedreamResponse: result.data,
          timestamp: new Date().toISOString(),
        });
      } else {
        logger.error("❌ Error enviando simulación WhatsApp:", result.error);
        res.status(500).json({
          success: false,
          message: "Failed to send WhatsApp simulation",
          error: result.error,
          details: result.details,
        });
      }
    } catch (error) {
      logger.error("❌ Error en simulación de WhatsApp:", error);
      res.status(500).json({
        success: false,
        error: "WhatsApp simulation failed",
        message: error.message,
      });
    }
  }

  /**
   * Obtener configuración actual de Pipedream
   */
  static async getConfiguration(req, res) {
    try {
      const config = pipedreamService.getConfiguration();

      res.status(200).json({
        success: true,
        message: "Pipedream configuration",
        configuration: config,
        status: {
          calendly_configured: !!config.calendly_event_dispatcher_url,
          whatsapp_configured: !!config.whatsapp_inbound_handler_url,
          ready_for_production: !!(
            config.calendly_event_dispatcher_url &&
            config.whatsapp_inbound_handler_url
          ),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("❌ Error obteniendo configuración:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get configuration",
        message: error.message,
      });
    }
  }

  /**
   * Configurar URL del WhatsApp Inbound Handler
   */
  static async setWhatsAppHandlerUrl(req, res) {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({
          success: false,
          error: "URL is required",
        });
      }

      // Validar que sea una URL válida
      try {
        new URL(url);
      } catch (urlError) {
        return res.status(400).json({
          success: false,
          error: "Invalid URL format",
        });
      }

      pipedreamService.setWhatsAppInboundHandlerUrl(url);

      logger.info("✅ URL de WhatsApp Handler configurada:", { url });

      res.status(200).json({
        success: true,
        message: "WhatsApp Inbound Handler URL configured successfully",
        url: url,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("❌ Error configurando URL:", error);
      res.status(500).json({
        success: false,
        error: "Failed to configure URL",
        message: error.message,
      });
    }
  }
}

module.exports = PipedreamTestController;
