// src/controllers/autonomousWhatsAppController.js
// Controlador simplificado para pruebas de webhook

const logger = require("../utils/logger");

class AutonomousWhatsAppController {
  constructor() {
    console.log("[DEBUG] AutonomousWhatsAppController inicializado");
  }

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

      logger.info("Processing autonomous WhatsApp message", {
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
        messageId,
        messageLength: message.length,
      });

      // Respuesta simple para pruebas
      const response = `Hola! Recibí tu mensaje: "${message}". Este es un mensaje de prueba del asistente autónomo de Ricardo Beauty. El sistema está funcionando correctamente! 😊`;

      logger.info("Sending response", {
        to: this.sanitizePhoneForLog(phoneNumber),
        responseLength: response.length,
      });

      // Simular envío de mensaje (por ahora solo log)
      await this.sendWhatsAppMessage(phoneNumber, response);

      return res.status(200).json({
        success: true,
        message: "Message processed successfully",
        response: response,
      });
    } catch (error) {
      const errorMessage = error?.message || "Error desconocido";

      logger.error("Error in autonomous message processing", {
        error_message: errorMessage,
        stack: error instanceof Error ? error.stack : "No stack available",
        body: req.body,
      });

      // Extraer phoneNumber del request para manejo de errores
      const phoneNumber = req.body?.From?.replace("whatsapp:", "") || "unknown";

      const errorResponse =
        "Disculpa, he tenido un problema técnico. Te conectaré con Ricardo enseguida.";

      try {
        await this.sendWhatsAppMessage(phoneNumber, errorResponse);
      } catch (sendError) {
        logger.error("Error sending error response", {
          error: sendError.message,
        });
      }

      // Notificar error al administrador
      await this.notifyAdmin("Autonomous assistant error", {
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
        error: errorMessage,
      });

      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * Sanitiza número de teléfono para logs (oculta parte del número)
   */
  sanitizePhoneForLog(phoneNumber) {
    if (!phoneNumber || phoneNumber.length < 4) {
      return "***";
    }
    const visible = phoneNumber.slice(-4);
    const hidden = "*".repeat(phoneNumber.length - 4);
    return hidden + visible;
  }

  /**
   * Envía mensaje de WhatsApp (simulado para pruebas)
   */
  async sendWhatsAppMessage(phoneNumber, message) {
    try {
      // Implementar envío de mensaje
      // Por ahora solo log para desarrollo
      logger.info("Sending WhatsApp message", {
        to: this.sanitizePhoneForLog(phoneNumber),
        messageLength: message.length,
        message:
          message.substring(0, 100) + (message.length > 100 ? "..." : ""),
      });

      // Aquí iría la integración real con Twilio
      // await twilioClient.messages.create({
      //   from: 'whatsapp:+YOUR_TWILIO_NUMBER',
      //   to: `whatsapp:${phoneNumber}`,
      //   body: message
      // });

      return { success: true };
    } catch (error) {
      logger.error("Error sending WhatsApp message", {
        error: error.message,
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
      });
      throw error;
    }
  }

  /**
   * Notifica al administrador sobre errores críticos
   */
  async notifyAdmin(subject, details) {
    try {
      logger.error("Admin notification", {
        subject,
        details,
      });

      // Aquí iría la lógica de notificación al admin
      // Por ejemplo, envío de email o mensaje

      return { success: true };
    } catch (error) {
      logger.error("Error notifying admin", {
        error: error.message,
        subject,
      });
    }
  }
}

module.exports = AutonomousWhatsAppController;
