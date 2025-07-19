// src/services/integrationOrchestrator.js
// Orquestador principal para integrar Calendly, Twilio y OpenAI

const logger = require("../utils/logger");
const { openaiClient } = require("../integrations/openaiClient");
const calendlyClient = require("../integrations/calendlyClient");
const twilioClient = require("../integrations/twilioClient");
const AppointmentService = require("./appointmentService");
const ClientService = require("./clientService");
const ServiceService = require("./serviceService");
const NotificationService = require("./notificationService");
const intentAnalysisService = require("./intentAnalysisService");
const responseGenerationService = require("./responseGenerationService");
const { TWILIO_WHATSAPP_NUMBER } = require("../config/env");

class IntegrationOrchestrator {
  constructor() {
    this.initialized = false;
    this.init();
  }

  async init() {
    try {
      logger.info("🔄 Inicializando Integration Orchestrator...");

      // Verificar que todos los servicios estén disponibles
      const checks = await this.performHealthChecks();

      if (checks.allHealthy) {
        this.initialized = true;
        logger.info("✅ Integration Orchestrator inicializado correctamente");
      } else {
        logger.warn(
          "⚠️ Integration Orchestrator inicializado con advertencias",
          {
            checks: checks.results,
          }
        );
        this.initialized = true; // Permitir funcionamiento parcial
      }
    } catch (error) {
      logger.error("❌ Error inicializando Integration Orchestrator:", error);
      this.initialized = false;
    }
  }

  /**
   * Verificar salud de todos los servicios integrados
   */
  async performHealthChecks() {
    const results = {
      openai: false,
      calendly: false,
      twilio: false,
      database: false,
    };

    try {
      // Check OpenAI
      const testResponse = await openaiClient.generateResponse("Test");
      results.openai = !!testResponse;
    } catch (error) {
      logger.warn("OpenAI health check failed:", error.message);
    }

    try {
      // Check Calendly
      results.calendly = calendlyClient.isInitialized();
    } catch (error) {
      logger.warn("Calendly health check failed:", error.message);
    }

    try {
      // Check Twilio
      const account = await twilioClient.api
        .accounts(twilioClient.accountSid)
        .fetch();
      results.twilio = !!account;
    } catch (error) {
      logger.warn("Twilio health check failed:", error.message);
    }

    try {
      // Check Database (simple connection test)
      const { createClient } = require("@supabase/supabase-js");
      const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = require("../config/env");

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data, error } = await supabase
        .from("services")
        .select("count")
        .limit(1);

      results.database = !error;
    } catch (error) {
      logger.warn("Database health check failed:", error.message);
    }

    const allHealthy = Object.values(results).every((status) => status);

    return {
      results,
      allHealthy,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Procesar evento de Calendly con notificación WhatsApp inteligente
   */
  async processCalendlyEvent(eventType, payload) {
    if (!this.initialized) {
      throw new Error("Integration Orchestrator not initialized");
    }

    try {
      logger.info("🔄 Procesando evento de Calendly:", {
        eventType,
        payloadUri: payload?.uri,
      });

      switch (eventType) {
        case "invitee.created":
          return await this.handleNewAppointmentWithNotification(payload);

        case "invitee.canceled":
          return await this.handleCancelledAppointmentWithNotification(payload);

        case "invitee.rescheduled":
          return await this.handleRescheduledAppointmentWithNotification(
            payload
          );

        default:
          logger.warn("Evento de Calendly no manejado:", eventType);
          return { success: false, error: "Event type not handled" };
      }
    } catch (error) {
      logger.error("Error procesando evento de Calendly:", error);
      throw error;
    }
  }

  /**
   * Manejar nueva cita con notificación WhatsApp inteligente
   */
  async handleNewAppointmentWithNotification(payload) {
    try {
      const {
        name,
        email,
        start_time,
        end_time,
        event_type,
        uri: calendlyEventUri,
      } = payload;

      // Extraer teléfono de las preguntas
      const phoneQuestion = payload.questions_and_answers?.find(
        (qa) =>
          qa.question?.toLowerCase().includes("teléfono") ||
          qa.question?.toLowerCase().includes("phone") ||
          qa.question?.toLowerCase().includes("whatsapp")
      );

      if (!phoneQuestion?.answer) {
        logger.warn(
          "No se encontró número de teléfono en el payload de Calendly"
        );
        return { success: false, error: "Phone number not found" };
      }

      const clientPhone = this.sanitizePhone(phoneQuestion.answer);

      // Buscar o crear cliente
      const clientResult = await ClientService.findOrCreateByPhone({
        phone: clientPhone,
        full_name: name,
        email: email,
      });

      if (!clientResult.success) {
        throw new Error(`Error gestionando cliente: ${clientResult.error}`);
      }

      // Mapear servicio de Calendly
      const serviceResult = await this.mapCalendlyEventToService(event_type);
      if (!serviceResult.success) {
        throw new Error(`Servicio no encontrado: ${serviceResult.error}`);
      }

      // Crear cita
      const appointmentData = {
        client_id: clientResult.data.id,
        service_id: serviceResult.data.id,
        scheduled_at: start_time,
        end_time: end_time,
        status: "confirmed",
        source: "calendly_webhook",
        calendly_event_uri: calendlyEventUri,
        notes: `Cita creada automáticamente desde Calendly para ${name}`,
      };

      const appointmentResult =
        await AppointmentService.createAppointment(appointmentData);

      if (!appointmentResult.success) {
        throw new Error(`Error creando cita: ${appointmentResult.error}`);
      }

      // Generar mensaje personalizado con IA
      const confirmationMessage = await this.generateIntelligentConfirmation({
        clientName: name,
        serviceName: serviceResult.data.name,
        scheduledAt: start_time,
        appointmentId: appointmentResult.data.id,
      });

      // Enviar notificación WhatsApp
      await this.sendWhatsAppNotification(clientPhone, confirmationMessage);

      logger.info("✅ Nueva cita procesada y notificada:", {
        appointmentId: appointmentResult.data.id,
        clientPhone: this.maskPhone(clientPhone),
        serviceName: serviceResult.data.name,
      });

      return {
        success: true,
        data: {
          appointment: appointmentResult.data,
          client: clientResult.data,
          service: serviceResult.data,
          notificationSent: true,
        },
      };
    } catch (error) {
      logger.error("Error en handleNewAppointmentWithNotification:", error);
      throw error;
    }
  }

  /**
   * Manejar cancelación con notificación
   */
  async handleCancelledAppointmentWithNotification(payload) {
    try {
      const { email, uri: calendlyEventUri } = payload;

      // Buscar cita por URI de Calendly
      const appointmentResult =
        await AppointmentService.findByCalendlyUri(calendlyEventUri);

      if (!appointmentResult.success) {
        logger.warn("Cita no encontrada para cancelación:", calendlyEventUri);
        return { success: false, error: "Appointment not found" };
      }

      // Cancelar cita
      const cancelResult = await AppointmentService.cancelAppointment(
        appointmentResult.data.id,
        "Cancelada desde Calendly"
      );

      if (!cancelResult.success) {
        throw new Error(`Error cancelando cita: ${cancelResult.error}`);
      }

      // Obtener datos del cliente
      const clientResult = await ClientService.findById(
        appointmentResult.data.client_id
      );

      if (clientResult.success && clientResult.data.phone) {
        // Generar mensaje de cancelación con IA
        const cancellationMessage = await this.generateIntelligentCancellation({
          clientName: clientResult.data.full_name,
          serviceName: appointmentResult.data.service_name,
          scheduledAt: appointmentResult.data.scheduled_at,
        });

        // Enviar notificación WhatsApp
        await this.sendWhatsAppNotification(
          clientResult.data.phone,
          cancellationMessage
        );
      }

      logger.info("✅ Cita cancelada y notificada:", {
        appointmentId: appointmentResult.data.id,
        clientEmail: email,
      });

      return {
        success: true,
        data: {
          appointment: appointmentResult.data,
          cancelled: true,
          notificationSent: true,
        },
      };
    } catch (error) {
      logger.error(
        "Error en handleCancelledAppointmentWithNotification:",
        error
      );
      throw error;
    }
  }

  /**
   * Manejar reprogramación con notificación
   */
  async handleRescheduledAppointmentWithNotification(payload) {
    try {
      const { email, start_time, end_time, uri: calendlyEventUri } = payload;

      // Buscar cita por URI de Calendly
      const appointmentResult =
        await AppointmentService.findByCalendlyUri(calendlyEventUri);

      if (!appointmentResult.success) {
        logger.warn(
          "Cita no encontrada para reprogramación:",
          calendlyEventUri
        );
        return { success: false, error: "Appointment not found" };
      }

      // Actualizar cita
      const updateResult = await AppointmentService.updateAppointment(
        appointmentResult.data.id,
        {
          scheduled_at: start_time,
          end_time: end_time,
          status: "confirmed",
          notes: `${appointmentResult.data.notes || ""}\nReprogramada desde Calendly`,
        }
      );

      if (!updateResult.success) {
        throw new Error(`Error actualizando cita: ${updateResult.error}`);
      }

      // Obtener datos del cliente
      const clientResult = await ClientService.findById(
        appointmentResult.data.client_id
      );

      if (clientResult.success && clientResult.data.phone) {
        // Generar mensaje de reprogramación con IA
        const rescheduleMessage = await this.generateIntelligentReschedule({
          clientName: clientResult.data.full_name,
          serviceName: appointmentResult.data.service_name,
          oldScheduledAt: appointmentResult.data.scheduled_at,
          newScheduledAt: start_time,
        });

        // Enviar notificación WhatsApp
        await this.sendWhatsAppNotification(
          clientResult.data.phone,
          rescheduleMessage
        );
      }

      logger.info("✅ Cita reprogramada y notificada:", {
        appointmentId: appointmentResult.data.id,
        newScheduledAt: start_time,
      });

      return {
        success: true,
        data: {
          appointment: updateResult.data,
          rescheduled: true,
          notificationSent: true,
        },
      };
    } catch (error) {
      logger.error(
        "Error en handleRescheduledAppointmentWithNotification:",
        error
      );
      throw error;
    }
  }

  /**
   * Procesar mensaje de WhatsApp con integración completa
   */
  async processWhatsAppMessage(from, body, messageId) {
    if (!this.initialized) {
      throw new Error("Integration Orchestrator not initialized");
    }

    try {
      logger.info("📱 Procesando mensaje WhatsApp:", {
        from: this.maskPhone(from),
        messageId,
        preview: body.substring(0, 50),
      });

      // Limpiar mensaje
      const cleanMessage = this.cleanMessage(body);

      // Obtener o crear cliente
      const clientResult = await ClientService.findOrCreateByPhone({
        phone: from,
      });
      if (!clientResult.success) {
        throw new Error(`Error gestionando cliente: ${clientResult.error}`);
      }

      // Analizar intención usando el servicio especializado
      const intentAnalysis = await intentAnalysisService.analyzeMessage(
        cleanMessage,
        { previousMessages: [] }, // TODO: Implementar historial
        clientResult.data.phone
      );

      // Generar respuesta usando el servicio especializado
      const response = await responseGenerationService.generateResponse(
        intentAnalysis,
        cleanMessage,
        clientResult.data,
        { previousMessages: [] } // TODO: Implementar historial
      );

      // Enviar respuesta
      await this.sendWhatsAppNotification(from, response);

      logger.info("✅ Mensaje WhatsApp procesado:", {
        clientId: clientResult.data.id,
        intent: intentAnalysis.intent,
        responseLength: response.length,
      });

      return {
        success: true,
        data: {
          client: clientResult.data,
          intent: intentAnalysis.intent,
          response: response,
        },
      };
    } catch (error) {
      logger.error("Error procesando mensaje WhatsApp:", error);

      // Enviar mensaje de error al usuario
      try {
        await this.sendWhatsAppNotification(
          from,
          "Lo siento, he tenido un problema técnico. Por favor, inténtalo de nuevo en unos minutos."
        );
      } catch (sendError) {
        logger.error("Error enviando mensaje de error:", sendError);
      }

      throw error;
    }
  }

  /**
   * Analizar intención del mensaje con OpenAI
   */
  async analyzeMessageIntent(message, client) {
    try {
      const analysis = await openaiClient.analyzeIntent(message, {
        clientName: client.full_name,
        clientId: client.id,
        previousInteractions: [], // TODO: Implementar historial
      });

      return analysis;
    } catch (error) {
      logger.error("Error analizando intención:", error);

      // Fallback básico
      return {
        intent: "general_inquiry",
        confidence: 0.5,
        entities: {},
        missing_info: [],
        urgency: "medium",
        ready_to_book: false,
      };
    }
  }

  /**
   * Procesar intención con integración de Calendly
   */
  async processIntentWithCalendlyIntegration(analysis, message, client) {
    try {
      switch (analysis.intent) {
        case "appointment_request":
          return await this.handleAppointmentRequestWithCalendly(
            analysis,
            client
          );

        case "availability_inquiry":
          return await this.handleAvailabilityWithCalendly(analysis, client);

        case "appointment_modification":
          return await this.handleAppointmentModificationWithCalendly(
            analysis,
            client
          );

        case "service_information":
          return await this.handleServiceInformation(analysis);

        case "greeting":
          return this.generateGreeting(client);

        default:
          return await this.generateGeneralResponse(analysis, message, client);
      }
    } catch (error) {
      logger.error("Error procesando intención:", error);
      return "Disculpa, no pude procesar tu solicitud. ¿Podrías reformularla?";
    }
  }

  /**
   * Manejar solicitud de reserva con Calendly
   */
  async handleBookingRequestWithCalendly(analysis, client) {
    try {
      const { entities } = analysis;

      if (entities.service && entities.date && entities.time) {
        // Verificar disponibilidad en Calendly
        const availability = await this.checkCalendlyAvailability(
          entities.service,
          entities.date,
          entities.time
        );

        if (availability.available) {
          // Generar enlace de reserva de Calendly
          const bookingLink = await this.generateCalendlyBookingLink(
            entities.service,
            entities.date,
            entities.time,
            client
          );

          return `¡Perfecto! He verificado que hay disponibilidad para ${entities.service} el ${this.formatDate(entities.date)} a las ${entities.time}.

Para confirmar tu reserva, haz clic en este enlace:
${bookingLink}

Una vez completada la reserva, recibirás una confirmación automática. ¿Necesitas algo más?`;
        } else {
          // Ofrecer alternativas
          const alternatives = await this.getCalendlyAlternatives(
            entities.service,
            entities.date
          );
          return `Lo siento, no hay disponibilidad para ${entities.service} el ${this.formatDate(entities.date)} a las ${entities.time}.

¿Te interesan estas alternativas?
${alternatives.map((alt) => `• ${alt.date} a las ${alt.time}`).join("\n")}

¿Cuál prefieres?`;
        }
      } else {
        // Solicitar información faltante
        const missing = analysis.missing_info.map((field) => {
          const fieldNames = {
            service: "el servicio que deseas",
            date: "la fecha preferida",
            time: "la hora preferida",
          };
          return fieldNames[field] || field;
        });

        return `Para ayudarte con tu reserva necesito que me proporciones: ${missing.join(", ")}.

Nuestros servicios principales son:
• Corte y Peinado - 45min - €35
• Tratamiento Capilar - 90min - €45
• Manicura - 30min - €25

¿Qué servicio te interesa y para cuándo?`;
      }
    } catch (error) {
      logger.error("Error en handleBookingRequestWithCalendly:", error);
      return "Hubo un problema procesando tu solicitud de reserva. ¿Podrías intentarlo de nuevo?";
    }
  }

  /**
   * Generar mensaje de confirmación inteligente
   */
  async generateIntelligentConfirmation({
    clientName,
    serviceName,
    scheduledAt,
    appointmentId,
  }) {
    try {
      const prompt = `Genera un mensaje de confirmación de cita profesional y amigable para WhatsApp.

Cliente: ${clientName}
Servicio: ${serviceName}
Fecha y hora: ${this.formatDateTime(scheduledAt)}
ID de cita: ${appointmentId}

El mensaje debe:
- Ser profesional pero cercano
- Incluir todos los detalles importantes
- Mencionar que se enviará un recordatorio
- Usar emojis apropiados
- Ser conciso pero completo
- Incluir información de contacto para cambios`;

      const response = await openaiClient.generateResponse(prompt);
      return (
        response ||
        this.getDefaultConfirmationMessage(clientName, serviceName, scheduledAt)
      );
    } catch (error) {
      logger.error("Error generando confirmación inteligente:", error);
      return this.getDefaultConfirmationMessage(
        clientName,
        serviceName,
        scheduledAt
      );
    }
  }

  /**
   * Generar mensaje de cancelación inteligente
   */
  async generateIntelligentCancellation({
    clientName,
    serviceName,
    scheduledAt,
  }) {
    try {
      const prompt = `Genera un mensaje de cancelación de cita profesional y empático para WhatsApp.

Cliente: ${clientName}
Servicio: ${serviceName}
Fecha y hora original: ${this.formatDateTime(scheduledAt)}

El mensaje debe:
- Ser empático y comprensivo
- Confirmar la cancelación
- Ofrecer ayuda para reagendar
- Mantener la relación positiva
- Usar emojis apropiados`;

      const response = await openaiClient.generateResponse(prompt);
      return (
        response || this.getDefaultCancellationMessage(clientName, serviceName)
      );
    } catch (error) {
      logger.error("Error generando cancelación inteligente:", error);
      return this.getDefaultCancellationMessage(clientName, serviceName);
    }
  }

  /**
   * Generar mensaje de reprogramación inteligente
   */
  async generateIntelligentReschedule({
    clientName,
    serviceName,
    oldScheduledAt,
    newScheduledAt,
  }) {
    try {
      const prompt = `Genera un mensaje de reprogramación de cita profesional para WhatsApp.

Cliente: ${clientName}
Servicio: ${serviceName}
Fecha anterior: ${this.formatDateTime(oldScheduledAt)}
Nueva fecha: ${this.formatDateTime(newScheduledAt)}

El mensaje debe:
- Confirmar el cambio de fecha
- Mostrar ambas fechas claramente
- Ser positivo y profesional
- Incluir recordatorio automático
- Usar emojis apropiados`;

      const response = await openaiClient.generateResponse(prompt);
      return (
        response ||
        this.getDefaultRescheduleMessage(
          clientName,
          serviceName,
          newScheduledAt
        )
      );
    } catch (error) {
      logger.error("Error generando reprogramación inteligente:", error);
      return this.getDefaultRescheduleMessage(
        clientName,
        serviceName,
        newScheduledAt
      );
    }
  }

  // =================================================================
  // MÉTODOS AUXILIARES
  // =================================================================

  /**
   * Mapear evento de Calendly a servicio interno
   */
  async mapCalendlyEventToService(eventTypeUri) {
    try {
      // Obtener servicios activos
      const servicesResult = await ServiceService.getActiveServices();

      if (!servicesResult.success || !servicesResult.data.length) {
        return { success: false, error: "No active services found" };
      }

      // Por ahora usar el primer servicio activo
      // TODO: Implementar mapeo más sofisticado basado en el URI del evento
      const defaultService = servicesResult.data[0];

      return {
        success: true,
        data: defaultService,
      };
    } catch (error) {
      logger.error("Error mapeando evento de Calendly:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verificar disponibilidad en Calendly
   */
  async checkCalendlyAvailability(service, date, time) {
    try {
      if (!calendlyClient.isInitialized()) {
        return { available: false, error: "Calendly not configured" };
      }

      // TODO: Implementar verificación real con Calendly API
      return { available: true };
    } catch (error) {
      logger.error("Error verificando disponibilidad en Calendly:", error);
      return { available: false, error: error.message };
    }
  }

  /**
   * Generar enlace de reserva de Calendly
   */
  async generateCalendlyBookingLink(service, date, time, client) {
    try {
      // TODO: Implementar generación de enlace personalizado
      return "https://calendly.com/ricardoburitica/consulta";
    } catch (error) {
      logger.error("Error generando enlace de Calendly:", error);
      return "https://calendly.com/ricardoburitica/consulta";
    }
  }

  /**
   * Obtener alternativas de Calendly
   */
  async getCalendlyAlternatives(service, date) {
    try {
      // TODO: Implementar obtención de alternativas reales
      return [
        { date: "2024-01-15", time: "10:00" },
        { date: "2024-01-15", time: "14:00" },
        { date: "2024-01-16", time: "09:00" },
      ];
    } catch (error) {
      logger.error("Error obteniendo alternativas de Calendly:", error);
      return [];
    }
  }

  /**
   * Enviar notificación WhatsApp
   */
  async sendWhatsAppNotification(to, message) {
    try {
      const result = await twilioClient.messages.create({
        from: TWILIO_WHATSAPP_NUMBER,
        to: `whatsapp:${to}`,
        body: message,
      });

      logger.info("📱 Mensaje WhatsApp enviado:", {
        to: this.maskPhone(to),
        messageId: result.sid,
        status: result.status,
      });

      return { success: true, messageId: result.sid };
    } catch (error) {
      logger.error("Error enviando mensaje WhatsApp:", error);
      throw error;
    }
  }

  /**
   * Limpiar mensaje
   */
  cleanMessage(message) {
    return message.trim().replace(/\s+/g, " ");
  }

  /**
   * Sanitizar teléfono
   */
  sanitizePhone(phone) {
    return phone.replace(/[^\d+]/g, "");
  }

  /**
   * Enmascarar teléfono para logs
   */
  maskPhone(phone) {
    if (!phone || phone.length < 4) return phone;
    return phone.substring(0, 3) + "***" + phone.substring(phone.length - 2);
  }

  /**
   * Formatear fecha
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  /**
   * Formatear fecha y hora
   */
  formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * Generar saludo
   */
  generateGreeting(client) {
    const hour = new Date().getHours();
    let greeting = "Hola";

    if (hour < 12) greeting = "Buenos días";
    else if (hour < 18) greeting = "Buenas tardes";
    else greeting = "Buenas noches";

    const firstName = client.full_name?.split(" ")[0] || "";

    return `${greeting}${firstName ? ` ${firstName}` : ""}! 👋

Soy el asistente virtual de Ricardo Buriticá Beauty Consulting. ¿En qué puedo ayudarte hoy?

Puedo ayudarte con:
• 📅 Agendar una cita
• 💇‍♀️ Información sobre servicios
• 📋 Consultar tus citas
• ❌ Cancelar o reprogramar

¿Qué necesitas?`;
  }

  /**
   * Generar respuesta general
   */
  async generateGeneralResponse(analysis, message, client) {
    try {
      const response = await openaiClient.generateResponse(
        `Responde como Ricardo Buriticá, especialista en belleza, a este mensaje: "${message}"`,
        {
          clientName: client.full_name,
          intent: analysis.intent,
          confidence: analysis.confidence,
        }
      );

      return (
        response ||
        "¿En qué puedo ayudarte? Puedo asistirte con citas, servicios y consultas generales."
      );
    } catch (error) {
      logger.error("Error generando respuesta general:", error);
      return "¿En qué puedo ayudarte? Estoy aquí para asistirte.";
    }
  }

  // Mensajes por defecto
  getDefaultConfirmationMessage(clientName, serviceName, scheduledAt) {
    return `✅ ¡Hola ${clientName}! Tu cita ha sido confirmada:

📅 **Servicio:** ${serviceName}
🕐 **Fecha y hora:** ${this.formatDateTime(scheduledAt)}
📍 **Ubicación:** Ricardo Buriticá Beauty Consulting

Te enviaré un recordatorio 24h antes. Si necesitas hacer algún cambio, contáctame lo antes posible.

¡Nos vemos pronto! ✨`;
  }

  getDefaultCancellationMessage(clientName, serviceName) {
    return `Hola ${clientName},

He recibido la cancelación de tu cita de ${serviceName}. No te preocupes, entiendo que a veces surgen imprevistos.

Si quieres reagendar para otra fecha, solo escríbeme y te ayudo a encontrar un horario que te convenga.

¡Que tengas un buen día! 😊`;
  }

  getDefaultRescheduleMessage(clientName, serviceName, newScheduledAt) {
    return `✅ ¡Hola ${clientName}! Tu cita ha sido reprogramada:

📅 **Servicio:** ${serviceName}
🕐 **Nueva fecha y hora:** ${this.formatDateTime(newScheduledAt)}
📍 **Ubicación:** Ricardo Buriticá Beauty Consulting

Te enviaré un recordatorio 24h antes de la nueva fecha.

¡Nos vemos pronto! ✨`;
  }
}

// Crear instancia singleton
const integrationOrchestrator = new IntegrationOrchestrator();

module.exports = integrationOrchestrator;
