// src/models/notificationModel.js
const supabase = require("../integrations/supabaseClient");

class NotificationModel {
  constructor() {
    this.tableName = "notifications";
  }

  // Crear una nueva notificación
  async create(notificationData) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .insert([
          {
            client_id: notificationData.client_id,
            booking_id: notificationData.booking_id || null,
            type: notificationData.type, // 'booking_confirmation', 'reminder', 'cancellation', etc.
            channel: notificationData.channel, // 'whatsapp', 'email', 'sms'
            title: notificationData.title,
            message: notificationData.message,
            status: notificationData.status || "pending",
            scheduled_for:
              notificationData.scheduled_for || new Date().toISOString(),
            sent_at: null,
            error_message: null,
            metadata: notificationData.metadata || {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener notificación por ID
  async getById(notificationId) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select(
          `
          *,
          clients (
            id,
            name,
            email,
            phone,
            whatsapp_number
          ),
          bookings (
            id,
            booking_date,
            booking_time,
            status
          )
        `
        )
        .eq("id", notificationId)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener notificaciones pendientes
  async getPendingNotifications() {
    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from(this.tableName)
        .select(
          `
          *,
          clients (
            id,
            name,
            email,
            phone,
            whatsapp_number,
            preferred_contact_method
          ),
          bookings (
            id,
            booking_date,
            booking_time,
            status
          )
        `
        )
        .eq("status", "pending")
        .lte("scheduled_for", now)
        .order("scheduled_for");

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener notificaciones por cliente
  async getByClientId(clientId, limit = 20) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener notificaciones por reserva
  async getByBookingId(bookingId) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Marcar notificación como enviada
  async markAsSent(notificationId, sentData = {}) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          metadata: sentData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", notificationId)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Marcar notificación como fallida
  async markAsFailed(notificationId, errorMessage) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          status: "failed",
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", notificationId)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Reprogramar notificación
  async reschedule(notificationId, newScheduledTime) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          scheduled_for: newScheduledTime,
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", notificationId)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Cancelar notificación
  async cancel(notificationId) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", notificationId)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener estadísticas de notificaciones
  async getNotificationStats(startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("status, channel, type, created_at")
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (error) throw error;

      const stats = {
        total: data.length,
        sent: data.filter((n) => n.status === "sent").length,
        pending: data.filter((n) => n.status === "pending").length,
        failed: data.filter((n) => n.status === "failed").length,
        cancelled: data.filter((n) => n.status === "cancelled").length,
        byChannel: {
          whatsapp: data.filter((n) => n.channel === "whatsapp").length,
          email: data.filter((n) => n.channel === "email").length,
          sms: data.filter((n) => n.channel === "sms").length,
        },
        byType: data.reduce((acc, n) => {
          acc[n.type] = (acc[n.type] || 0) + 1;
          return acc;
        }, {}),
      };

      return { success: true, data: stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Limpiar notificaciones antiguas
  async cleanupOldNotifications(daysOld = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .lt("created_at", cutoffDate.toISOString())
        .in("status", ["sent", "failed", "cancelled"]);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Crear notificación de recordatorio
  async createReminder(bookingId, reminderType = "24h") {
    try {
      // Obtener datos de la reserva
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select(
          `
          *,
          clients (
            id,
            name,
            email,
            phone,
            whatsapp_number,
            preferred_contact_method
          ),
          services (
            name,
            duration
          )
        `
        )
        .eq("id", bookingId)
        .single();

      if (bookingError) throw bookingError;

      // Calcular cuándo enviar el recordatorio
      const bookingDateTime = new Date(
        `${booking.booking_date}T${booking.booking_time}`
      );
      let reminderTime = new Date(bookingDateTime);

      switch (reminderType) {
        case "24h":
          reminderTime.setHours(reminderTime.getHours() - 24);
          break;
        case "2h":
          reminderTime.setHours(reminderTime.getHours() - 2);
          break;
        case "30min":
          reminderTime.setMinutes(reminderTime.getMinutes() - 30);
          break;
        default:
          reminderTime.setHours(reminderTime.getHours() - 24);
      }

      const message = `Hola ${booking.clients.name}, te recordamos tu cita de ${booking.services.name} programada para el ${booking.booking_date} a las ${booking.booking_time}. ¡Te esperamos!`;

      const notificationData = {
        client_id: booking.client_id,
        booking_id: bookingId,
        type: `reminder_${reminderType}`,
        channel: booking.clients.preferred_contact_method || "whatsapp",
        title: "Recordatorio de cita",
        message: message,
        scheduled_for: reminderTime.toISOString(),
      };

      return await this.create(notificationData);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NotificationModel();
