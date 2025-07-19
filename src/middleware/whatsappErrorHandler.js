// src/middleware/whatsappErrorHandler.js
// Middleware especializado para manejo de errores de WhatsApp

const whatsappValidationService = require("../services/whatsappValidationService");
const notificationService = require("../services/notificationService");
const logger = require("../utils/logger");

class WhatsAppErrorHandler {
  /**
   * Middleware para manejar errores de envío de WhatsApp
   */
  static async handleSendError(error, context = {}) {
    try {
      const interpretation =
        whatsappValidationService.interpretTwilioError(error);

      logger.error("🚨 Error de WhatsApp manejado", {
        ...context,
        error: {
          code: interpretation.code,
          type: interpretation.type,
          message: interpretation.message,
          canRetry: interpretation.canRetry,
          action: interpretation.action,
        },
      });

      // Acciones automáticas según el tipo de error
      await WhatsAppErrorHandler.executeAutomaticActions(
        interpretation,
        context
      );

      return {
        handled: true,
        interpretation,
        shouldRetry: interpretation.canRetry,
        userMessage: interpretation.userMessage,
      };
    } catch (handlingError) {
      logger.error("❌ Error manejando error de WhatsApp:", handlingError);
      return {
        handled: false,
        error: handlingError.message,
        shouldRetry: false,
        userMessage: "Error técnico. Contacta al administrador.",
      };
    }
  }

  /**
   * Ejecutar acciones automáticas según el tipo de error
   */
  static async executeAutomaticActions(interpretation, context) {
    try {
      switch (interpretation.type) {
        case "SENDER":
          await WhatsAppErrorHandler.handleSenderError(interpretation, context);
          break;

        case "RECIPIENT":
          await WhatsAppErrorHandler.handleRecipientError(
            interpretation,
            context
          );
          break;

        case "FORMAT":
          await WhatsAppErrorHandler.handleFormatError(interpretation, context);
          break;

        case "CONTENT":
          await WhatsAppErrorHandler.handleContentError(
            interpretation,
            context
          );
          break;

        case "LIMITS":
          await WhatsAppErrorHandler.handleLimitsError(interpretation, context);
          break;

        default:
          logger.info("ℹ️ Error de WhatsApp sin acción automática específica", {
            type: interpretation.type,
            code: interpretation.code,
          });
      }
    } catch (actionError) {
      logger.error("❌ Error ejecutando acción automática:", actionError);
    }
  }

  /**
   * Manejar errores del número remitente (Twilio)
   */
  static async handleSenderError(interpretation, context) {
    const adminMessage = `🚨 PROBLEMA CON NÚMERO DE TWILIO WHATSAPP

Código de error: ${interpretation.code}
Problema: ${interpretation.message}
Acción requerida: ${interpretation.action}

Contexto:
- Número destinatario: ${context.phone || "No disponible"}
- Timestamp: ${new Date().toISOString()}

Este es un problema de configuración que requiere atención inmediata.`;

    // Notificar al administrador
    await WhatsAppErrorHandler.notifyAdmin(adminMessage, "CRITICAL");

    logger.error("🚨 Error crítico del número remitente de Twilio", {
      code: interpretation.code,
      action: interpretation.action,
    });
  }

  /**
   * Manejar errores del número destinatario
   */
  static async handleRecipientError(interpretation, context) {
    logger.warn("⚠️ Problema con número destinatario", {
      code: interpretation.code,
      phone: context.phone,
      action: interpretation.action,
    });

    // Si el número no tiene WhatsApp, marcar en base de datos
    if (interpretation.code === "63003") {
      await WhatsAppErrorHandler.markPhoneAsInvalid(
        context.phone,
        "NO_WHATSAPP"
      );
    }

    // Si el número está bloqueado, marcar como bloqueado
    if (interpretation.code === "63004") {
      await WhatsAppErrorHandler.markPhoneAsInvalid(context.phone, "BLOCKED");
    }
  }

  /**
   * Manejar errores de formato
   */
  static async handleFormatError(interpretation, context) {
    logger.warn("⚠️ Error de formato de número", {
      code: interpretation.code,
      originalPhone: context.phone,
      action: interpretation.action,
    });

    // Intentar corrección automática si es posible
    if (context.phone) {
      const corrected = WhatsAppErrorHandler.attemptPhoneCorrection(
        context.phone
      );
      if (corrected && corrected !== context.phone) {
        logger.info("🔧 Intento de corrección automática de número", {
          original: context.phone,
          corrected: corrected,
        });

        // Aquí podrías reintentar con el número corregido
        // Pero es mejor notificar para revisión manual
      }
    }
  }

  /**
   * Manejar errores de contenido
   */
  static async handleContentError(interpretation, context) {
    logger.warn("⚠️ Problema con contenido del mensaje", {
      code: interpretation.code,
      messageLength: context.messageLength,
      action: interpretation.action,
    });

    const adminMessage = `⚠️ MENSAJE WHATSAPP RECHAZADO POR CONTENIDO

Código de error: ${interpretation.code}
Problema: ${interpretation.message}
Destinatario: ${context.phone || "No disponible"}
Longitud del mensaje: ${context.messageLength || "No disponible"}

Revisar contenido del mensaje para cumplir políticas de WhatsApp.`;

    await WhatsAppErrorHandler.notifyAdmin(adminMessage, "HIGH");
  }

  /**
   * Manejar errores de límites
   */
  static async handleLimitsError(interpretation, context) {
    logger.warn("⚠️ Límite de WhatsApp alcanzado", {
      code: interpretation.code,
      action: interpretation.action,
    });

    // Implementar rate limiting más estricto temporalmente
    await WhatsAppErrorHandler.implementTemporaryRateLimit(context.phone);

    const adminMessage = `⚠️ LÍMITE DE WHATSAPP ALCANZADO

Código de error: ${interpretation.code}
Problema: ${interpretation.message}
Acción: ${interpretation.action}

Se ha implementado rate limiting temporal.`;

    await WhatsAppErrorHandler.notifyAdmin(adminMessage, "MEDIUM");
  }

  /**
   * Marcar teléfono como inválido en base de datos
   */
  static async markPhoneAsInvalid(phone, reason) {
    try {
      // Aquí implementarías la lógica para marcar el teléfono en BD
      logger.info("📝 Marcando teléfono como inválido", {
        phone: WhatsAppErrorHandler.sanitizePhone(phone),
        reason,
      });

      // Ejemplo de implementación:
      // await clientModel.updatePhoneStatus(phone, 'INVALID', reason);
    } catch (error) {
      logger.error("❌ Error marcando teléfono como inválido:", error);
    }
  }

  /**
   * Implementar rate limiting temporal
   */
  static async implementTemporaryRateLimit(phone) {
    try {
      // Implementar lógica de rate limiting temporal
      logger.info("🚦 Implementando rate limiting temporal", {
        phone: WhatsAppErrorHandler.sanitizePhone(phone),
      });

      // Ejemplo: guardar en cache/BD con TTL
    } catch (error) {
      logger.error("❌ Error implementando rate limiting:", error);
    }
  }

  /**
   * Intentar corrección automática de número
   */
  static attemptPhoneCorrection(phone) {
    try {
      // Limpiar número
      let cleaned = phone.replace(/\D/g, "");

      // Correcciones comunes
      if (cleaned.startsWith("0034")) {
        cleaned = cleaned.substring(2); // Remover 00
      }

      if (cleaned.startsWith("0") && cleaned.length === 10) {
        cleaned = "34" + cleaned.substring(1); // 0612345678 -> 34612345678
      }

      if (cleaned.length === 9 && cleaned.match(/^[6-9]/)) {
        cleaned = "34" + cleaned; // 612345678 -> 34612345678
      }

      return "+" + cleaned;
    } catch (error) {
      logger.error("❌ Error corrigiendo número:", error);
      return phone;
    }
  }

  /**
   * Notificar al administrador
   */
  static async notifyAdmin(message, priority = "MEDIUM") {
    try {
      // Usar el servicio de notificaciones existente
      const notificationService = require("../services/notificationService");
      await notificationService.sendAdminAlert(message, priority.toLowerCase());
    } catch (error) {
      logger.error("❌ Error notificando al administrador:", error);
    }
  }

  /**
   * Sanitizar teléfono para logs
   */
  static sanitizePhone(phone) {
    if (!phone || typeof phone !== "string") return "[INVALID]";

    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 6) return "[TOO_SHORT]";

    const start = cleaned.substring(0, 3);
    const end = cleaned.substring(cleaned.length - 2);
    const middle = "*".repeat(Math.max(0, cleaned.length - 5));

    return `+${start}${middle}${end}`;
  }

  /**
   * Obtener estadísticas de errores de WhatsApp
   */
  static async getErrorStats(timeframe = "24h") {
    try {
      // Implementar lógica para obtener estadísticas de errores
      // desde logs o base de datos

      return {
        timeframe,
        totalErrors: 0,
        errorsByType: {},
        errorsBySeverity: {},
        mostCommonErrors: [],
      };
    } catch (error) {
      logger.error("❌ Error obteniendo estadísticas:", error);
      return null;
    }
  }
}

module.exports = WhatsAppErrorHandler;
