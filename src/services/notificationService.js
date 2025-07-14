// src/services/notificationService.js
// Servicio de notificaciones integrado con Twilio, Email y WhatsApp

const twilioClient = require("../integrations/twilioClient");
const notificationModel = require("../models/notificationModel");
const logger = require("../utils/logger");

class NotificationService {
  constructor() {
    this.channels = {
      WHATSAPP: "whatsapp",
      SMS: "sms",
      EMAIL: "email",
    };

    this.templates = {
      BOOKING_CONFIRMATION: "booking_confirmation",
      BOOKING_REMINDER: "booking_reminder",
      BOOKING_CANCELLATION: "booking_cancellation",
      BOOKING_RESCHEDULED: "booking_rescheduled",
      ADMIN_ALERT: "admin_alert",
    };
  }

  /**
   * Enviar notificación de confirmación de reserva
   */
  async sendBookingConfirmation(booking, client) {
    try {
      logger.info("📧 Enviando confirmación de reserva", {
        bookingId: booking.id_reserva,
        clientPhone: client.telefono,
      });

      const message = this.buildBookingConfirmationMessage(booking, client);

      const result = await this.sendWhatsAppMessage(client.telefono, message);

      // Registrar notificación en BD
      await notificationModel.create({
        recipient_phone: client.telefono,
        message_type: this.templates.BOOKING_CONFIRMATION,
        content: message,
        status: result.success ? "sent" : "failed",
        booking_id: booking.id_reserva,
      });

      return result;
    } catch (error) {
      logger.error("❌ Error enviando confirmación de reserva:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enviar recordatorio de cita
   */
  async sendBookingReminder(booking, client, timeframe = '24 horas') {
    try {
      logger.info("⏰ Enviando recordatorio de cita", {
        bookingId: booking.id || booking.id_reserva,
        clientPhone: client.phone || client.telefono,
        timeframe
      });

      const message = this.buildBookingReminderMessage(booking, client, timeframe);

      const result = await this.sendWhatsAppMessage(client.phone || client.telefono, message);

      await notificationModel.create({
        recipient_phone: client.phone || client.telefono,
        message_type: timeframe === '24 horas' ? 'booking_reminder_24h' : 'booking_reminder_2h',
        content: message,
        status: result.success ? "sent" : "failed",
        booking_id: booking.id || booking.id_reserva,
      });

      return result;
    } catch (error) {
      logger.error("❌ Error enviando recordatorio:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notificar cancelación de cita
   */
  async sendBookingCancellation(booking, client, reason = "") {
    try {
      logger.info("❌ Enviando notificación de cancelación", {
        bookingId: booking.id_reserva,
        clientPhone: client.telefono,
      });

      const message = this.buildBookingCancellationMessage(
        booking,
        client,
        reason,
      );

      const result = await this.sendWhatsAppMessage(client.telefono, message);

      await notificationModel.create({
        recipient_phone: client.telefono,
        message_type: this.templates.BOOKING_CANCELLATION,
        content: message,
        status: result.success ? "sent" : "failed",
        booking_id: booking.id_reserva,
      });

      return result;
    } catch (error) {
      logger.error("❌ Error enviando cancelación:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notificar reprogramación de cita
   */
  async sendBookingReschedule(booking, client, oldDate, newDate) {
    try {
      logger.info("🔄 Enviando notificación de reprogramación", {
        bookingId: booking.id_reserva,
        clientPhone: client.telefono,
      });

      const message = this.buildBookingRescheduleMessage(
        booking,
        client,
        oldDate,
        newDate,
      );

      const result = await this.sendWhatsAppMessage(client.telefono, message);

      await notificationModel.create({
        recipient_phone: client.telefono,
        message_type: this.templates.BOOKING_RESCHEDULED,
        content: message,
        status: result.success ? "sent" : "failed",
        booking_id: booking.id_reserva,
      });

      return result;
    } catch (error) {
      logger.error("❌ Error enviando reprogramación:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enviar alerta al administrador
   */
  async sendAdminAlert(message, priority = "normal") {
    try {
      logger.info("🚨 Enviando alerta al administrador", { priority });

      const adminPhone =
        process.env.ADMIN_PHONE || process.env.TWILIO_WHATSAPP_NUMBER;
      const alertMessage = `🚨 ALERTA SISTEMA\n\n${message}\n\nPrioridad: ${priority.toUpperCase()}\nFecha: ${new Date().toLocaleString(
        "es-ES",
      )}`;

      const result = await this.sendWhatsAppMessage(adminPhone, alertMessage);

      await notificationModel.create({
        recipient_phone: adminPhone,
        message_type: this.templates.ADMIN_ALERT,
        content: alertMessage,
        status: result.success ? "sent" : "failed",
        priority,
      });

      return result;
    } catch (error) {
      logger.error("❌ Error enviando alerta admin:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enviar mensaje de WhatsApp
   */
  async sendWhatsAppMessage(phone, message) {
    try {
      // Formatear número de teléfono
      const formattedPhone = this.formatPhoneNumber(phone);

      const result = await twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: `whatsapp:${formattedPhone}`,
        body: message,
      });

      logger.info("✅ Mensaje WhatsApp enviado", {
        to: formattedPhone,
        sid: result.sid,
      });

      return {
        success: true,
        messageId: result.sid,
        to: formattedPhone,
      };
    } catch (error) {
      logger.error("❌ Error enviando WhatsApp:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Construir mensaje de confirmación de reserva
   */
  buildBookingConfirmationMessage(booking, client) {
    const fecha = new Date(booking.fecha_hora).toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const hora = new Date(booking.fecha_hora).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return `✅ *CITA CONFIRMADA*

Hola ${client.nombre}, tu cita ha sido confirmada:

📅 *Fecha:* ${fecha}
🕐 *Hora:* ${hora}
💇‍♀️ *Servicio:* ${booking.servicio_nombre}
💰 *Precio:* €${booking.precio}
⏱️ *Duración:* ${booking.duracion} minutos

📍 *Ubicación:* Ricardo Buriticá Beauty Studio

Si necesitas cancelar o reprogramar, contáctame con al menos 24h de antelación.

¡Te espero! ✨`;
  }

  /**
   * Construir mensaje de recordatorio
   */
  buildBookingReminderMessage(booking, client, timeframe = '24 horas') {
    // Manejar diferentes formatos de fecha
    let appointmentDate;
    if (booking.appointment_date && booking.appointment_time) {
      appointmentDate = new Date(booking.appointment_date + ' ' + booking.appointment_time);
    } else if (booking.fecha_hora) {
      appointmentDate = new Date(booking.fecha_hora);
    } else {
      appointmentDate = new Date();
    }

    const fecha = appointmentDate.toLocaleDateString("es-ES", {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const hora = appointmentDate.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const clientName = client.name || client.nombre;
    const serviceName = booking.service_name || booking.servicio_nombre;
    const timeText = timeframe === '24 horas' ? 'mañana' : 'en 2 horas';

    return `⏰ *RECORDATORIO DE CITA*

Hola ${clientName}, te recuerdo tu cita ${timeText}:

📅 *${fecha}*
🕐 *Hora:* ${hora}
💇‍♀️ *Servicio:* ${serviceName}

${timeframe === '2 horas' ? 
  '🚨 *¡Tu cita es en 2 horas!*\n\nPor favor, confirma tu asistencia.' : 
  'Por favor, confirma tu asistencia respondiendo a este mensaje.'
}

📍 *Ubicación:* Ricardo Buriticá Beauty Studio

¡Te espero! ✨

_Ricardo Buriticá Beauty Consulting_
_Peluquería Consciente_`;
  }

  /**
   * Construir mensaje de cancelación
   */
  buildBookingCancellationMessage(booking, client, reason) {
    return `❌ *CITA CANCELADA*

Hola ${client.nombre}, tu cita ha sido cancelada:

📅 *Fecha:* ${new Date(booking.fecha_hora).toLocaleDateString("es-ES")}
🕐 *Hora:* ${new Date(booking.fecha_hora).toLocaleTimeString("es-ES")}
💇‍♀️ *Servicio:* ${booking.servicio_nombre}

${reason ? `*Motivo:* ${reason}\n` : ""}
Para reagendar, contáctame cuando gustes.

Gracias por tu comprensión 🙏`;
  }

  /**
   * Construir mensaje de reprogramación
   */
  buildBookingRescheduleMessage(booking, client, oldDate, newDate) {
    return `🔄 *CITA REPROGRAMADA*

Hola ${client.nombre}, tu cita ha sido reprogramada:

❌ *Fecha anterior:* ${new Date(oldDate).toLocaleDateString("es-ES")}
✅ *Nueva fecha:* ${new Date(newDate).toLocaleDateString("es-ES")}
🕐 *Hora:* ${new Date(newDate).toLocaleTimeString("es-ES")}
💇‍♀️ *Servicio:* ${booking.servicio_nombre}

¡Te espero en la nueva fecha! ✨`;
  }

  /**
   * Formatear número de teléfono
   */
  formatPhoneNumber(phone) {
    // Remover espacios y caracteres especiales
    let cleaned = phone.replace(/\D/g, "");

    // Si no empieza con código de país, asumir España (+34)
    if (!cleaned.startsWith("34") && cleaned.length === 9) {
      cleaned = "34" + cleaned;
    }

    return "+" + cleaned;
  }

  /**
   * Obtener estadísticas de notificaciones
   */
  async getNotificationStats(dateFrom, dateTo) {
    try {
      const stats = await notificationModel.getStats(dateFrom, dateTo);
      return { success: true, data: stats };
    } catch (error) {
      logger.error(
        "❌ Error obteniendo estadísticas de notificaciones:",
        error,
      );
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NotificationService();
