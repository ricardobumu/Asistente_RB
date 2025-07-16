// src/services/appointmentWidgetService.js
// Servicio para widget de citas embebido en ricardoburitica.eu

const { calendlyClient } = require("../integrations/calendlyClient");
const autonomousAssistant = require("./autonomousAssistant");
const AppointmentModel = require("../models/appointmentModel");
const ClientModel = require("../models/clientModel");
const ServiceModel = require("../models/serviceModel");
const logger = require("../utils/logger");

class AppointmentWidgetService {
  constructor() {
    this.services = null;
    this.initializeServices();
  }

  /**
   * Inicializa cache de servicios
   */
  async initializeServices() {
    try {
      this.services = await ServiceModel.findActive();
      logger.info("Widget services cache initialized", {
        count: this.services.length,
      });
    } catch (error) {
      logger.error("Failed to initialize widget services cache", {
        error: error.message,
      });
    }
  }

  /**
   * Obtiene servicios disponibles para el widget
   */
  async getAvailableServices() {
    try {
      if (!this.services) {
        await this.initializeServices();
      }

      return this.services.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        duration: service.duration,
        price: service.price,
        category: service.category,
        image: service.image_url || null,
        features: service.features || [],
      }));
    } catch (error) {
      logger.error("Error getting available services for widget", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Obtiene disponibilidad para un servicio específico
   */
  async getServiceAvailability(serviceId, startDate, endDate) {
    try {
      const service = this.services.find((s) => s.id === parseInt(serviceId));
      if (!service) {
        throw new Error("Service not found");
      }

      // Calcular endDate si no se proporciona (7 días por defecto)
      const end =
        endDate ||
        new Date(new Date(startDate).getTime() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];

      // Obtener disponibilidad de Calendly
      const availability = await calendlyClient.getAvailability({
        event_type: service.calendly_event_type,
        start_time: `${startDate}T00:00:00`,
        end_time: `${end}T23:59:59`,
      });

      // Formatear slots para el widget
      const formattedSlots = availability.map((slot) => ({
        datetime: slot.start_time,
        date: slot.start_time.split("T")[0],
        time: slot.start_time.split("T")[1].substring(0, 5),
        available: true,
        price: service.price,
        duration: service.duration,
      }));

      return {
        service: {
          id: service.id,
          name: service.name,
          duration: service.duration,
          price: service.price,
        },
        availability: formattedSlots,
      };
    } catch (error) {
      logger.error("Error getting service availability for widget", {
        error: error.message,
        serviceId,
      });
      throw error;
    }
  }

  /**
   * Crea una cita desde el widget web usando el asistente autónomo
   */
  async createWebAppointment(appointmentData) {
    try {
      const {
        serviceId,
        datetime,
        clientInfo,
        source = "web_widget",
        notes = "",
      } = appointmentData;

      // Validar servicio
      const service = this.services.find((s) => s.id === parseInt(serviceId));
      if (!service) {
        throw new Error("Service not found");
      }

      // Verificar disponibilidad
      const isAvailable = await this.verifySlotAvailability(
        serviceId,
        datetime
      );
      if (!isAvailable) {
        throw new Error("Selected time slot is no longer available");
      }

      // Obtener o crear cliente
      let client = await ClientModel.findByEmail(clientInfo.email);
      if (!client) {
        client = await ClientModel.create({
          name: clientInfo.name,
          email: clientInfo.email,
          phone: clientInfo.phone,
          source: source,
        });
      } else {
        // Actualizar información si es necesaria
        await ClientModel.update(client.id, {
          name: clientInfo.name,
          phone: clientInfo.phone,
        });
      }

      // Crear cita en Calendly
      const calendlyAppointment = await calendlyClient.createAppointment({
        event_type_uuid: service.calendly_event_type,
        start_time: datetime,
        invitee: {
          name: client.name,
          email: client.email,
          phone: client.phone,
        },
        questions_and_answers: notes
          ? [
              {
                question: "Notas adicionales",
                answer: notes,
              },
            ]
          : [],
      });

      // Crear cita en nuestro sistema
      const appointment = await AppointmentModel.create({
        client_id: client.id,
        service_id: service.id,
        date: datetime.split("T")[0],
        time: datetime.split("T")[1].substring(0, 5),
        status: "confirmed",
        calendly_event_id: calendlyAppointment.uri,
        created_via: source,
        price: service.price,
        duration: service.duration,
        notes: notes,
      });

      // Enviar confirmación por WhatsApp si tiene teléfono
      if (client.phone) {
        await this.sendWebAppointmentConfirmation(appointment, client, service);
      }

      // Programar recordatorios usando el asistente autónomo
      await autonomousAssistant.scheduleAutomaticReminders(appointment, client);

      logger.info("Web appointment created successfully", {
        appointmentId: appointment.id,
        clientId: client.id,
        serviceId: service.id,
        source,
      });

      return {
        success: true,
        appointment: {
          id: appointment.id,
          service: service.name,
          date: appointment.date,
          time: appointment.time,
          price: appointment.price,
          duration: appointment.duration,
          status: appointment.status,
        },
        client: {
          name: client.name,
          email: client.email,
          phone: client.phone,
        },
      };
    } catch (error) {
      logger.error("Error creating web appointment", {
        error: error.message,
        appointmentData,
      });
      throw error;
    }
  }

  /**
   * Verifica si un slot específico está disponible
   */
  async verifySlotAvailability(serviceId, datetime) {
    try {
      const service = this.services.find((s) => s.id === parseInt(serviceId));
      if (!service) return false;

      const availability = await calendlyClient.getAvailability({
        event_type: service.calendly_event_type,
        start_time: datetime,
        end_time: datetime,
      });

      return availability.length > 0;
    } catch (error) {
      logger.error("Error verifying slot availability", {
        error: error.message,
        serviceId,
        datetime,
      });
      return false;
    }
  }

  /**
   * Envía confirmación de cita web por WhatsApp
   */
  async sendWebAppointmentConfirmation(appointment, client, service) {
    try {
      const confirmationMessage = `✅ ¡RESERVA CONFIRMADA DESDE WEB!

📅 **${service.name}**
🗓️ Fecha: ${appointment.date}
⏰ Hora: ${appointment.time}
💰 Precio: €${appointment.price}
⏱️ Duración: ${appointment.duration} min

👤 Cliente: ${client.name}
📧 Email: ${client.email}
📱 Teléfono: ${client.phone}

📍 **Ubicación**: [Dirección del salón]

🔔 **Recordatorios automáticos:**
• 24 horas antes
• 2 horas antes  
• 30 minutos antes

Para cambios, responde a este WhatsApp con al menos 24h de antelación.

¡Nos vemos pronto! 🎉`;

      await autonomousAssistant.sendWhatsAppMessage(
        client.phone,
        confirmationMessage
      );
    } catch (error) {
      logger.error("Error sending web appointment confirmation", {
        error: error.message,
        appointmentId: appointment.id,
      });
      // No lanzar error para no fallar la cita
    }
  }

  /**
   * Obtiene citas de un cliente para el portal
   */
  async getClientAppointments(clientEmail) {
    try {
      const client = await ClientModel.findByEmail(clientEmail);
      if (!client) {
        return { appointments: [] };
      }

      const appointments = await AppointmentModel.findByClientId(client.id);

      const formattedAppointments = await Promise.all(
        appointments.map(async (appointment) => {
          const service = this.services.find(
            (s) => s.id === appointment.service_id
          );
          return {
            id: appointment.id,
            service: {
              name: service?.name || "Servicio no encontrado",
              duration: service?.duration || 0,
            },
            date: appointment.date,
            time: appointment.time,
            status: appointment.status,
            price: appointment.price,
            canModify: this.canModifyAppointment(appointment),
            canCancel: this.canCancelAppointment(appointment),
            createdVia: appointment.created_via,
          };
        })
      );

      return {
        client: {
          name: client.name,
          email: client.email,
          phone: client.phone,
        },
        appointments: formattedAppointments,
      };
    } catch (error) {
      logger.error("Error getting client appointments", {
        error: error.message,
        clientEmail,
      });
      throw error;
    }
  }

  /**
   * Verifica si una cita puede ser modificada
   */
  canModifyAppointment(appointment) {
    const appointmentDateTime = new Date(`${appointment.date}T${appointment.time}`);
    const now = new Date();
    const hoursUntilAppointment = (appointmentDateTime - now) / (1000 * 60 * 60);

    return hoursUntilAppointment > 24 && appointment.status === "confirmed";
  }

  /**
   * Verifica si una cita puede ser cancelada
   */
  canCancelAppointment(appointment) {
    const appointmentDateTime = new Date(`${appointment.date}T${appointment.time}`);
    const now = new Date();
    const hoursUntilAppointment = (appointmentDateTime - now) / (1000 * 60 * 60);

    return (
      hoursUntilAppointment > 24 &&
      ["confirmed", "pending"].includes(appointment.status)
    );
  }

  /**
   * Cancela una cita desde el portal
   */
  async cancelAppointment(appointmentId, clientEmail, reason = "") {
    try {
      const appointment = await AppointmentModel.findById(appointmentId);
      if (!appointment) {
        throw new Error("Appointment not found");
      }

      const client = await ClientModel.findByEmail(clientEmail);
      if (!client || client.id !== appointment.client_id) {
        throw new Error("Unauthorized to cancel this appointment");
      }

      if (!this.canCancelAppointment(appointment)) {
        throw new Error(
          "Appointment cannot be cancelled (less than 24h notice or invalid status)"
        );
      }

      // Cancelar en Calendly
      if (appointment.calendly_event_id) {
        await calendlyClient.cancelAppointment(appointment.calendly_event_id);
      }

      // Actualizar en nuestro sistema
      await AppointmentModel.update(appointmentId, {
        status: "cancelled",
        cancellation_reason: reason,
        cancelled_at: new Date(),
      });

      // Enviar confirmación de cancelación por WhatsApp
      if (client.phone) {
        await this.sendCancellationConfirmation(appointment, client, reason);
      }

      logger.info("Appointment cancelled from web portal", {
        appointmentId,
        clientId: client.id,
        reason,
      });

      return {
        success: true,
        message: "Appointment cancelled successfully",
      };
    } catch (error) {
      logger.error("Error cancelling appointment from web", {
        error: error.message,
        appointmentId,
        clientEmail,
      });
      throw error;
    }
  }

  /**
   * Envía confirmación de cancelación por WhatsApp
   */
  async sendCancellationConfirmation(appointment, client, reason) {
    try {
      const service = this.services.find((s) => s.id === appointment.service_id);

      const message = `❌ **RESERVA CANCELADA**

📅 **${service?.name || "Servicio"}**
🗓️ Fecha: ${appointment.date}
⏰ Hora: ${appointment.time}

${reason ? `💬 Motivo: ${reason}` : ""}

Tu cita ha sido cancelada exitosamente desde el portal web.

¿Necesitas reagendar? Responde a este mensaje y te ayudo a encontrar un nuevo horario. 😊`;

      await autonomousAssistant.sendWhatsAppMessage(client.phone, message);
    } catch (error) {
      logger.error("Error sending cancellation confirmation", {
        error: error.message,
        appointmentId: appointment.id,
      });
    }
  }

  /**
   * Obtiene configuración del widget
   */
  async getWidgetConfig() {
    try {
      return {
        businessInfo: {
          name: "Ricardo Buriticá",
          description: "Especialista en servicios de belleza y estética",
          address: "Dirección del salón",
          phone: "+34 XXX XXX XXX",
          email: "info@ricardoburitica.eu",
          website: "https://ricardoburitica.eu",
        },
        appointmentSettings: {
          advanceAppointmentDays: 30,
          minimumNoticeHours: 24,
          maxAppointmentsPerDay: 10,
          workingHours: {
            monday: { start: "09:00", end: "18:00" },
            tuesday: { start: "09:00", end: "18:00" },
            wednesday: { start: "09:00", end: "18:00" },
            thursday: { start: "09:00", end: "18:00" },
            friday: { start: "09:00", end: "18:00" },
            saturday: { start: "10:00", end: "16:00" },
            sunday: { closed: true },
          },
        },
        uiSettings: {
          primaryColor: "#3B82F6",
          secondaryColor: "#1F2937",
          accentColor: "#10B981",
          fontFamily: "Inter, sans-serif",
          borderRadius: "8px",
        },
        features: {
          whatsappIntegration: true,
          automaticConfirmation: true,
          automaticReminders: true,
          aiAssistant: true,
        },
      };
    } catch (error) {
      logger.error("Error getting widget config", { error: error.message });
      throw error;
    }
  }
}

module.exports = new AppointmentWidgetService();
