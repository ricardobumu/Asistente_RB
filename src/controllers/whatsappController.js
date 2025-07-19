// src/controllers/whatsappController.js
// Controlador para webhook de WhatsApp con integración completa

const integrationOrchestrator = require("../services/integrationOrchestrator");
const pipedreamService = require("../services/pipedreamService");
const logger = require("../utils/logger");
const { TWILIO_WEBHOOK_SIGNING_KEY } = require("../config/env");
const crypto = require("crypto");

class WhatsAppController {
  /**
   * Manejar webhook de WhatsApp (Twilio)
   */
  static async handleWebhook(req, res) {
    try {
      const { From, Body, MessageSid, ProfileName } = req.body;

      logger.info("📱 WhatsApp webhook recibido:", {
        from: WhatsAppController.maskPhone(From),
        messageId: MessageSid,
        profileName: ProfileName,
        preview: Body?.substring(0, 50),
        timestamp: new Date().toISOString(),
      });

      // Validar webhook de Twilio (opcional pero recomendado)
      if (
        TWILIO_WEBHOOK_SIGNING_KEY &&
        !WhatsAppController.validateTwilioSignature(req)
      ) {
        logger.warn("❌ Firma de webhook de Twilio inválida");
        return res.status(403).json({
          success: false,
          error: "Invalid webhook signature",
        });
      }

      // Validar datos requeridos
      if (!From || !Body) {
        logger.warn("❌ Datos de webhook de WhatsApp incompletos:", req.body);
        return res.status(400).json({
          success: false,
          error: "Missing required fields",
        });
      }

      // Extraer número de teléfono (remover prefijo whatsapp:)
      const phoneNumber = From.replace("whatsapp:", "");

      // 1. Enviar mensaje a Pipedream para procesamiento bidireccional con OpenAI
      const pipedreamResult =
        await pipedreamService.sendWhatsAppMessageToPipedream(
          phoneNumber,
          Body,
          MessageSid,
          {
            profile_name: ProfileName,
            timestamp: new Date().toISOString(),
            source: "twilio_webhook",
          }
        );

      // 2. Procesar mensaje localmente usando Integration Orchestrator (como respaldo)
      const localResult = await integrationOrchestrator.processWhatsAppMessage(
        phoneNumber,
        Body,
        MessageSid
      );

      // Log de resultados
      logger.info("📊 Resultados del procesamiento de WhatsApp:", {
        phone: WhatsAppController.maskPhone(phoneNumber),
        messageId: MessageSid,
        pipedreamDispatch: pipedreamResult.success,
        localProcessing: localResult.success,
      });

      if (localResult.success || pipedreamResult.success) {
        logger.info("✅ Mensaje WhatsApp procesado:", {
          clientId: localResult.data?.client?.id,
          intent: localResult.data?.intent,
          responseLength: localResult.data?.response?.length,
          pipedreamSent: pipedreamResult.success,
        });
      } else {
        logger.error("❌ Error procesando mensaje WhatsApp:", {
          localError: localResult.error,
          pipedreamError: pipedreamResult.error,
        });
      }

      // Siempre responder con TwiML vacío para evitar reenvíos de Twilio
      res.set("Content-Type", "text/xml");
      res
        .status(200)
        .send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    } catch (error) {
      logger.error("❌ Error crítico en webhook de WhatsApp:", error);

      // Responder con TwiML vacío para evitar reenvíos de Twilio
      res.set("Content-Type", "text/xml");
      res
        .status(200)
        .send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }
  }

  /**
   * Manejar estado de mensaje (entregado, leído, etc.)
   */
  static async handleMessageStatus(req, res) {
    try {
      const { MessageSid, MessageStatus, To, From } = req.body;

      logger.info("📊 Estado de mensaje WhatsApp:", {
        messageId: MessageSid,
        status: MessageStatus,
        to: WhatsAppController.maskPhone(To),
        from: WhatsAppController.maskPhone(From),
        timestamp: new Date().toISOString(),
      });

      // Aquí se puede implementar lógica para actualizar el estado del mensaje
      // en la base de datos si es necesario

      res.set("Content-Type", "text/xml");
      res
        .status(200)
        .send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    } catch (error) {
      logger.error("❌ Error procesando estado de mensaje:", error);

      res.set("Content-Type", "text/xml");
      res
        .status(200)
        .send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }
  }

  /**
   * Enviar mensaje de WhatsApp manualmente (para testing)
   */
  static async sendMessage(req, res) {
    try {
      const { to, message } = req.body;

      if (!to || !message) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: to, message",
        });
      }

      // Usar Integration Orchestrator para enviar mensaje
      const result = await integrationOrchestrator.sendWhatsAppNotification(
        to,
        message
      );

      if (result.success) {
        logger.info("✅ Mensaje WhatsApp enviado manualmente:", {
          to: WhatsAppController.maskPhone(to),
          messageId: result.messageId,
        });

        res.status(200).json({
          success: true,
          message: "Message sent successfully",
          messageId: result.messageId,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to send message",
        });
      }
    } catch (error) {
      logger.error("❌ Error enviando mensaje manual:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * Obtener estado de salud de WhatsApp
   */
  static async getHealthStatus(req, res) {
    try {
      const healthCheck = await integrationOrchestrator.performHealthChecks();

      res.status(200).json({
        success: true,
        message: "WhatsApp integration health status",
        health: {
          twilio: healthCheck.results.twilio,
          openai: healthCheck.results.openai,
          database: healthCheck.results.database,
          overall: healthCheck.allHealthy,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error checking WhatsApp health:", error);
      res.status(500).json({
        success: false,
        error: "Error checking health status",
      });
    }
  }

  /**
   * Obtener estadísticas de conversaciones
   */
  static async getConversationStats(req, res) {
    try {
      // TODO: Implementar estadísticas de conversaciones
      res.status(200).json({
        success: true,
        message: "Conversation statistics",
        data: {
          totalConversations: 0,
          activeConversations: 0,
          messagesProcessed: 0,
          averageResponseTime: 0,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error getting conversation stats:", error);
      res.status(500).json({
        success: false,
        error: "Error getting statistics",
      });
    }
  }

  /**
   * Configurar webhook de Twilio
   */
  static async configureWebhook(req, res) {
    try {
      const { webhookUrl } = req.body;

      if (!webhookUrl) {
        return res.status(400).json({
          success: false,
          error: "Missing webhook URL",
        });
      }

      // TODO: Implementar configuración automática del webhook en Twilio
      logger.info("📝 Configuración de webhook solicitada:", { webhookUrl });

      res.status(200).json({
        success: true,
        message: "Webhook configuration initiated",
        webhookUrl: webhookUrl,
        note: "Manual configuration required in Twilio Console",
      });
    } catch (error) {
      logger.error("Error configuring webhook:", error);
      res.status(500).json({
        success: false,
        error: "Error configuring webhook",
      });
    }
  }

  // =================================================================
  // MÉTODOS AUXILIARES
  // =================================================================

  /**
   * Validar firma de webhook de Twilio
   */
  static validateTwilioSignature(req) {
    try {
      if (!TWILIO_WEBHOOK_SIGNING_KEY) {
        return true; // Si no hay clave, no validar
      }

      const twilioSignature = req.headers["x-twilio-signature"];
      if (!twilioSignature) {
        return false;
      }

      // Construir URL completa
      const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

      // Crear firma esperada
      const expectedSignature = crypto
        .createHmac("sha1", TWILIO_WEBHOOK_SIGNING_KEY)
        .update(url + JSON.stringify(req.body))
        .digest("base64");

      return crypto.timingSafeEqual(
        Buffer.from(twilioSignature),
        Buffer.from(`sha1=${expectedSignature}`)
      );
    } catch (error) {
      logger.error("Error validating Twilio signature:", error);
      return false;
    }
  }

  /**
   * Enmascarar número de teléfono para logs
   */
  static maskPhone(phone) {
    if (!phone || phone.length < 4) return phone;
    return phone.substring(0, 3) + "***" + phone.substring(phone.length - 2);
  }

  /**
   * Verificar configuración de WhatsApp
   */
  static async verifyConfiguration(req, res) {
    try {
      const config = {
        twilioConfigured: !!(
          process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
        ),
        whatsappNumberConfigured: !!process.env.TWILIO_WHATSAPP_NUMBER,
        webhookSigningConfigured: !!process.env.TWILIO_WEBHOOK_SIGNING_KEY,
        openaiConfigured: !!process.env.OPENAI_API_KEY,
      };

      const allConfigured = Object.values(config).every(Boolean);

      res.status(200).json({
        success: true,
        message: "WhatsApp configuration status",
        configuration: config,
        allConfigured: allConfigured,
        recommendations:
          WhatsAppController.getConfigurationRecommendations(config),
      });
    } catch (error) {
      logger.error("Error verifying configuration:", error);
      res.status(500).json({
        success: false,
        error: "Error verifying configuration",
      });
    }
  }

  /**
   * Obtener recomendaciones de configuración
   */
  static getConfigurationRecommendations(config) {
    const recommendations = [];

    if (!config.twilioConfigured) {
      recommendations.push(
        "Configure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN"
      );
    }

    if (!config.whatsappNumberConfigured) {
      recommendations.push("Configure TWILIO_WHATSAPP_NUMBER");
    }

    if (!config.webhookSigningConfigured) {
      recommendations.push("Configure TWILIO_WEBHOOK_SIGNING_KEY for security");
    }

    if (!config.openaiConfigured) {
      recommendations.push("Configure OPENAI_API_KEY for AI responses");
    }

    if (recommendations.length === 0) {
      recommendations.push("All configurations are properly set!");
    }

    return recommendations;
  }
}

module.exports = WhatsAppController;
