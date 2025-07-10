// src/controllers/autonomousWhatsAppController.js
// Controlador para webhooks de WhatsApp del asistente autónomo

const autonomousAssistant = require("../services/autonomousAssistant");
const logger = require("../utils/logger");

class AutonomousWhatsAppController {
  /**
   * Webhook principal para recibir mensajes de WhatsApp
   */
  async receiveMessage(req, res) {
    try {
      logger.info("WhatsApp webhook received", {
        body: req.body,
        headers: {
          "x-twilio-signature": req.headers["x-twilio-signature"],
        },
      });

      // Validar que es un mensaje de WhatsApp
      const { Body: message, From: from, MessageSid: messageId } = req.body;

      if (!from || !from.startsWith("whatsapp:")) {
        logger.warn("Non-WhatsApp message received", { from });
        return res.status(200).json({ status: "ignored" });
      }

      // Extraer número de teléfono
      const phoneNumber = from.replace("whatsapp:", "");

      // Validar mensaje
      if (!message || message.trim().length === 0) {
        logger.warn("Empty message received", { phoneNumber, messageId });
        return res.status(200).json({ status: "ignored" });
      }

      // Procesar mensaje con asistente autónomo
      const result = await autonomousAssistant.processWhatsAppMessage(
        phoneNumber,
        message.trim(),
        messageId
      );

      logger.info("Message processed successfully", {
        phoneNumber,
        messageId,
        success: result.success,
      });

      // Responder a Twilio que el mensaje fue procesado
      res.status(200).json({
        status: "processed",
        messageId,
        success: result.success,
      });
    } catch (error) {
      logger.error("Error processing WhatsApp message", {
        error: error.message,
        stack: error.stack,
        body: req.body,
      });

      // Responder a Twilio para evitar reintentos
      res.status(200).json({
        status: "error",
        error: "Internal processing error",
      });
    }
  }

  /**
   * Webhook para estados de mensajes (entregado, leído, etc.)
   */
  async messageStatus(req, res) {
    try {
      const { MessageStatus, MessageSid, To, From } = req.body;

      logger.info("WhatsApp message status update", {
        messageId: MessageSid,
        status: MessageStatus,
        to: To,
        from: From,
      });

      // Aquí podrías implementar lógica para tracking de mensajes
      // Por ejemplo, actualizar base de datos con estado de entrega

      res.status(200).json({ status: "received" });
    } catch (error) {
      logger.error("Error processing message status", {
        error: error.message,
        body: req.body,
      });

      res.status(200).json({ status: "error" });
    }
  }

  /**
   * Verificación de webhook para Twilio
   */
  async verifyWebhook(req, res) {
    try {
      logger.info("WhatsApp webhook verification request", {
        query: req.query,
        method: req.method,
      });

      // Responder con éxito para verificación
      res.status(200).json({
        status: "WhatsApp webhook active",
        timestamp: new Date().toISOString(),
        service: "Autonomous Assistant",
      });
    } catch (error) {
      logger.error("Error verifying webhook", { error: error.message });
      res.status(500).json({ error: "Verification failed" });
    }
  }

  /**
   * Endpoint para enviar mensajes manuales (admin)
   */
  async sendManualMessage(req, res) {
    try {
      const { phoneNumber, message } = req.body;

      // Validar entrada
      if (!phoneNumber || !message) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields",
          required: ["phoneNumber", "message"],
        });
      }

      // Enviar mensaje
      await autonomousAssistant.sendWhatsAppMessage(phoneNumber, message);

      logger.info("Manual WhatsApp message sent", {
        phoneNumber,
        messageLength: message.length,
        sentBy: req.user?.id || "admin",
      });

      res.json({
        success: true,
        message: "Message sent successfully",
        phoneNumber,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error sending manual WhatsApp message", {
        error: error.message,
        phoneNumber: req.body.phoneNumber,
      });

      res.status(500).json({
        success: false,
        error: "Failed to send message",
        message: error.message,
      });
    }
  }

  /**
   * Obtener estadísticas del asistente autónomo
   */
  async getAssistantStats(req, res) {
    try {
      const { period = "24h" } = req.query;

      // Aquí implementarías lógica para obtener estadísticas reales
      const stats = {
        period,
        totalMessages: 0,
        totalConversations: 0,
        successfulBookings: 0,
        averageResponseTime: "< 5 seconds",
        automationRate: "95%",
        topServices: [
          { name: "Corte de cabello", bookings: 0 },
          { name: "Coloración", bookings: 0 },
          { name: "Manicura", bookings: 0 },
        ],
        busyHours: [
          { hour: "10:00", messages: 0 },
          { hour: "14:00", messages: 0 },
          { hour: "16:00", messages: 0 },
        ],
        lastUpdated: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error("Error getting assistant stats", {
        error: error.message,
        period: req.query.period,
      });

      res.status(500).json({
        success: false,
        error: "Failed to get stats",
        message: error.message,
      });
    }
  }

  /**
   * Obtener conversaciones activas
   */
  async getActiveConversations(req, res) {
    try {
      // Obtener conversaciones del asistente
      const conversations = [];

      for (const [
        phoneNumber,
        context,
      ] of autonomousAssistant.conversations.entries()) {
        conversations.push({
          phoneNumber,
          lastActivity: context.lastActivity,
          messagesCount: context.messages.length,
          extractedData: context.extractedData,
          status:
            Object.keys(context.extractedData).length > 0
              ? "in_progress"
              : "new",
        });
      }

      res.json({
        success: true,
        data: {
          activeConversations: conversations.length,
          conversations: conversations.sort(
            (a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)
          ),
        },
      });
    } catch (error) {
      logger.error("Error getting active conversations", {
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: "Failed to get conversations",
        message: error.message,
      });
    }
  }

  /**
   * Limpiar conversaciones antiguas
   */
  async cleanupConversations(req, res) {
    try {
      const beforeCount = autonomousAssistant.conversations.size;

      // Forzar limpieza
      autonomousAssistant.cleanupOldContexts();

      const afterCount = autonomousAssistant.conversations.size;
      const cleaned = beforeCount - afterCount;

      logger.info("Conversations cleanup completed", {
        beforeCount,
        afterCount,
        cleaned,
      });

      res.json({
        success: true,
        message: "Conversations cleaned up successfully",
        data: {
          beforeCount,
          afterCount,
          cleaned,
        },
      });
    } catch (error) {
      logger.error("Error cleaning up conversations", {
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: "Failed to cleanup conversations",
        message: error.message,
      });
    }
  }

  /**
   * Reinicializar cache de servicios
   */
  async reinitializeServices(req, res) {
    try {
      await autonomousAssistant.initializeServices();

      logger.info("Services cache reinitialized", {
        servicesCount: autonomousAssistant.services?.length || 0,
      });

      res.json({
        success: true,
        message: "Services cache reinitialized successfully",
        servicesCount: autonomousAssistant.services?.length || 0,
      });
    } catch (error) {
      logger.error("Error reinitializing services", {
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: "Failed to reinitialize services",
        message: error.message,
      });
    }
  }

  /**
   * Health check específico del asistente autónomo
   */
  async healthCheck(req, res) {
    try {
      const health = {
        status: "OK",
        service: "Autonomous WhatsApp Assistant",
        timestamp: new Date().toISOString(),
        activeConversations: autonomousAssistant.conversations.size,
        servicesLoaded: autonomousAssistant.services?.length || 0,
        integrations: {
          openai: !!process.env.OPENAI_API_KEY,
          twilio: !!process.env.TWILIO_ACCOUNT_SID,
          calendly: !!process.env.CALENDLY_ACCESS_TOKEN,
        },
      };

      res.json(health);
    } catch (error) {
      logger.error("Error in assistant health check", {
        error: error.message,
      });

      res.status(500).json({
        status: "ERROR",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

module.exports = new AutonomousWhatsAppController();
