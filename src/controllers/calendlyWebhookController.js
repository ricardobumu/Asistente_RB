// src/controllers/calendlyWebhookController.js
const integrationOrchestrator = require("../services/integrationOrchestrator");
const pipedreamService = require("../services/pipedreamService");
const logger = require("../utils/logger");

class CalendlyWebhookController {
  /**
   * Manejar webhook de Calendly
   */
  static async handleWebhook(req, res) {
    try {
      const { event, payload } = req.body;

      logger.info("📅 Calendly webhook recibido:", {
        event: event,
        payloadKeys: Object.keys(payload || {}),
        timestamp: new Date().toISOString(),
      });

      // Validar estructura del webhook
      if (!event || !payload) {
        logger.warn("❌ Payload de webhook de Calendly inválido:", req.body);
        return res.status(400).json({
          success: false,
          error: "Invalid webhook payload",
        });
      }

      // 1. Procesar evento localmente usando Integration Orchestrator
      const localResult = await integrationOrchestrator.processCalendlyEvent(
        event,
        payload
      );

      // 2. Enviar evento a Pipedream independientemente del resultado local
      const pipedreamResult =
        await pipedreamService.sendCalendlyEventToPipedream(event, payload);

      // Log de resultados
      logger.info("📊 Resultados del procesamiento de Calendly:", {
        event,
        localProcessing: localResult.success,
        pipedreamDispatch: pipedreamResult.success,
      });

      if (localResult.success) {
        logger.info("✅ Evento de Calendly procesado exitosamente:", {
          event,
          localData: localResult.data,
          pipedreamSent: pipedreamResult.success,
        });

        res.status(200).json({
          success: true,
          message: "Webhook processed successfully",
          event: event,
          data: {
            local_processing: localResult.data,
            pipedream_dispatch: {
              success: pipedreamResult.success,
              sent_at: new Date().toISOString(),
            },
          },
        });
      } else {
        logger.error(
          "❌ Error procesando evento de Calendly localmente:",
          localResult.error
        );

        // Aún así, intentamos enviar a Pipedream
        res.status(200).json({
          success: false,
          message:
            "Local event processing failed, but Pipedream dispatch attempted",
          event: event,
          error: localResult.error,
          pipedream_dispatch: {
            success: pipedreamResult.success,
            sent_at: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      logger.error("❌ Error crítico procesando webhook de Calendly:", error);

      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: error.message,
      });
    }
  }

  /**
   * Obtener estado de salud del webhook
   */
  static async getHealthStatus(req, res) {
    try {
      const healthCheck = await integrationOrchestrator.performHealthChecks();

      res.status(200).json({
        success: true,
        message: "Calendly webhook health status",
        health: healthCheck,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error checking webhook health:", error);
      res.status(500).json({
        success: false,
        error: "Error checking health status",
      });
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
