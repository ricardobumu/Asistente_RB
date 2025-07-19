/**
 * @file Archivo central del controlador para la lógica de negocio.
 * @description Este archivo contiene la clase AutonomousWhatsAppController, que gestiona:
 * 1. Webhooks de Calendly (creación, cancelación, reprogramación de citas).
 * 2. Un bot de WhatsApp conversacional vía Twilio.
 * 3. Interacción con una base de datos para gestionar clientes, servicios y citas.
 * 4. Análisis de intención de mensajes con un servicio de IA.
 * 5. Gestión de consentimiento de usuario (GDPR).
 * 6. Sistema de logging estructurado y detallado para diagnóstico y producción.
 * @version 2.0.0
 */

// =================================================================
// DEPENDENCIAS
// =================================================================
const logger = require("../utils/logger");
const ClientService = require("../services/clientService");
const AppointmentModel = require("../models/appointmentModel");
const ServiceModel = require("../models/serviceModel");
const conversationContextService = require("../services/conversationContextService");
const intentAnalysisService = require("../services/intentAnalysisService");
const responseGenerationService = require("../services/responseGenerationService");
const gdprService = require("../services/gdprService");
const notificationScheduler = require("../services/notificationScheduler");
const twilio = require("twilio");
const { TWILIO_WHATSAPP_NUMBER, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } =
  process.env;
const { sanitizeText, sanitizePhone } = require("../utils/sanitizers");

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/**
 * AutonomousWhatsAppController
 * Orquesta toda la lógica para el bot de WhatsApp y la integración con Calendly.
 */
class AutonomousWhatsAppController {
  constructor() {
    this.clientService = new ClientService();
    this.appointmentModel = new AppointmentModel();
    this.serviceModel = new ServiceModel();
    this.contextService = conversationContextService;
    this.services = [];
    this.lastServiceUpdate = null;

    this.loadServicesCache();
    logger.info(
      "✅ Controlador Autónomo de WhatsApp inicializado correctamente."
    );
  }

  /**
   * Carga los servicios disponibles desde la base de datos a una caché en memoria.
   */
  async loadServicesCache() {
    try {
      // ✅ CORREGIDO: Usar getAllActive() en lugar de getAll()
      const result = await this.serviceModel.getAllActive();
      if (result.success && result.data && result.data.length > 0) {
        this.services = result.data;
        this.lastServiceUpdate = new Date();
        logger.info(`Cargados ${this.services.length} servicios en la caché.`);
      } else {
        logger.warn("No se encontraron servicios para cargar en la caché.", {
          error: result.error || "La consulta no devolvió datos.",
        });
        this.services = [];
      }
    } catch (error) {
      logger.error("Error crítico al cargar los servicios en la caché.", {
        error: error.message,
        stack: error.stack,
      });
      this.services = [];
    }
  }

  /**
   * Refresca el cache de servicios.
   */
  async refreshServicesCache() {
    logger.info("Refrescando la caché de servicios...");
    await this.loadServicesCache();
  }

  // =================================================================
  // SECCIÓN DEL WEBHOOK DE CALENDLY
  // =================================================================

  /**
   * Procesa webhooks de Calendly con logging de diagnóstico mejorado.
   * @param {object} req - El objeto de solicitud de Express.
   * @param {object} res - El objeto de respuesta de Express.
   */
  async handleCalendlyWebhook(req, res) {
    // 🔍 LOGS DE DIAGNÓSTICO AÑADIDOS
    console.log("🚀 INICIANDO handleCalendlyWebhook");
    console.log("📦 Headers recibidos:", req.headers);
    console.log(
      "📋 Body completo recibido:",
      JSON.stringify(req.body, null, 2)
    );
    console.log("🌐 URL completa:", req.originalUrl);
    console.log("📍 Método HTTP:", req.method);
    console.log("⏰ Timestamp:", new Date().toISOString());

    const eventType = req.body?.event;
    const payload = req.body?.payload;

    logger.debug("🚀 Webhook de Calendly recibido", {
      headers: req.headers,
      body: req.body,
      url: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
    });

    if (!eventType || !payload) {
      console.log("❌ DIAGNÓSTICO: Webhook sin event o payload");
      logger.warn('Webhook de Calendly recibido sin "event" o "payload".', {
        body: req.body,
      });
      return res.status(400).json({
        success: false,
        error: 'Petición inválida. Faltan "event" o "payload".',
      });
    }

    console.log(`🔄 DIAGNÓSTICO: Procesando evento tipo: ${eventType}`);

    logger.info(`Procesando evento de webhook de Calendly: [${eventType}]`, {
      event_type: eventType,
      payload_uri: payload?.uri,
    });

    try {
      switch (eventType) {
        case "invitee.created":
          console.log("✅ DIAGNÓSTICO: Ejecutando _processNewAppointment");
          await this._processNewAppointment(payload);
          break;
        case "invitee.canceled":
          console.log("❌ DIAGNÓSTICO: Ejecutando _processCanceledAppointment");
          await this._processCanceledAppointment(payload);
          break;
        case "invitee.rescheduled":
          console.log(
            "🔄 DIAGNÓSTICO: Ejecutando _processRescheduledAppointment"
          );
          await this._processRescheduledAppointment(payload);
          break;
        default:
          console.log(`⚠️ DIAGNÓSTICO: Evento no manejado: ${eventType}`);
          logger.warn(`Evento de Calendly no manejado: [${eventType}]`);
          break;
      }

      const responseData = {
        success: true,
        message: "Webhook procesado correctamente",
        event_type: eventType,
        timestamp: new Date().toISOString(),
        processed_data: {
          payload_uri: payload?.uri,
          client_name: payload?.name,
          client_email: payload?.email,
          scheduled_at: payload?.start_time,
        },
        debug_info: {
          services_cached: this.services.length,
          last_service_update: this.lastServiceUpdate,
        },
      };

      console.log("✅ DIAGNÓSTICO: Enviando respuesta exitosa:", responseData);
      logger.info(`✅ Webhook de Calendly [${eventType}] procesado con éxito.`);
      res.status(200).json(responseData);
    } catch (error) {
      console.log("❌ DIAGNÓSTICO: Error en webhook:", error.message);
      console.log("❌ DIAGNÓSTICO: Stack trace:", error.stack);

      logger.error("❌ Error crítico procesando el webhook de Calendly", {
        error: error.message,
        stack: error.stack,
        event_type: eventType,
        payload_uri: payload?.uri,
      });

      const errorResponse = {
        success: false,
        error: "Error interno del servidor",
        message: error.message,
        event_type: eventType,
        timestamp: new Date().toISOString(),
        debug_info: {
          payload_uri: payload?.uri,
          error_stack: error.stack?.split("\n").slice(0, 3), // Primeras 3 líneas del stack
          services_cached: this.services.length,
        },
      };

      console.log(
        "❌ DIAGNÓSTICO: Enviando respuesta de error:",
        errorResponse
      );
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Procesa la creación de una nueva cita desde el payload de Calendly.
   * @param {object} payload - El payload del evento de Calendly.
   */
  async _processNewAppointment(payload) {
    try {
      logger.info("Iniciando el procesamiento de nueva cita desde Calendly");

      const clientName = payload.name;
      const clientEmail = payload.email;

      // Búsqueda más robusta del número de teléfono
      const phoneQuestion = payload.questions_and_answers?.find(
        (qa) =>
          qa.question?.toLowerCase().includes("teléfono") ||
          qa.question?.toLowerCase().includes("phone") ||
          qa.position === 0
      );
      const clientPhone = sanitizePhone(phoneQuestion?.answer);

      logger.info("Datos extraídos del payload de Calendly", {
        clientName,
        clientPhone,
      });
      if (!clientPhone) {
        throw new Error(
          "No se pudo encontrar un número de teléfono válido en el payload de Calendly."
        );
      }

      // ✅ CORREGIDO: Estructura correcta del payload de Calendly
      const scheduledAt = new Date(payload.start_time);
      const endTime = new Date(payload.end_time);
      const eventTypeUri = payload.event_type;
      const calendlyEventUri = payload.uri;

      logger.info("Datos procesados de la cita de Calendly", {
        client_name: clientName,
        client_email: clientEmail,
        client_phone: this.sanitizePhoneForLog(clientPhone),
        scheduled_at: scheduledAt,
        service_uri: eventTypeUri,
      });

      const clientResult = await this.clientService.findOrCreateByPhone({
        full_name: clientName,
        email: clientEmail,
      });

      if (!clientResult.success) {
        throw new Error(`Error al gestionar el cliente: ${clientResult.error}`);
      }
      const client = clientResult.data;

      // ✅ CORREGIDO: Método correcto del ServiceModel
      const serviceResult =
        await this.serviceModel.findByCalendlyUrl(eventTypeUri);
      if (!serviceResult.success || !serviceResult.data) {
        console.log(serviceResult.error);
        throw new Error(
          `Servicio con URI de Calendly "${eventTypeUri}" no encontrado en la base de datos.`
        );
      }
      const service = serviceResult.data;

      // Crear los datos de la cita
      const appointmentData = {
        client_id: client.id,
        service_id: service.id,
        scheduled_at: scheduledAt,
        end_time: endTime,
        status: "confirmed",
        source: "calendly_webhook",
        calendly_event_uri: calendlyEventUri,
        notes: `Cita creada automáticamente vía Calendly para ${clientName}.`,
      };

      // Guardar la cita en la BD
      const createResult = await this.appointmentModel.create(appointmentData);
      if (!createResult.success) {
        throw new Error(
          `Error al guardar la cita en la base de datos: ${createResult.error}`
        );
      }

      logger.info("✅ Nueva cita creada y guardada en la base de datos.", {
        appointment_id: createResult.data.id,
        client_id: client.id,
        service_id: service.id,
      });

      // Enviar confirmación por WhatsApp
      const confirmationMessage = this._buildConfirmationMessage(
        client.full_name,
        service.name,
        scheduledAt
      );

      await this.sendWhatsAppMessage(client.phone, confirmationMessage);

      return createResult;
    } catch (error) {
      logger.error("Error al procesar nueva cita de Calendly", {
        error: error.message,
        stack: error.stack,
        payload_uri: payload?.uri,
      });
      throw error;
    }
  }

  /**
   * Procesa la cancelación de una cita desde el payload de Calendly.
   * @param {object} payload - El payload del evento de Calendly.
   */
  async _processCanceledAppointment(payload) {
    try {
      const calendlyEventUri = payload.uri;

      logger.info("Procesando cancelación de cita de Calendly...", {
        calendly_event_uri: calendlyEventUri,
      });

      const updateResult =
        await this.appointmentModel.updateStatusByCalendlyUri(
          calendlyEventUri,
          "cancelled"
        );

      if (!updateResult.success) {
        logger.warn(
          `No se encontró o no se pudo cancelar la cita con Calendly URI: ${calendlyEventUri}. Puede que ya estuviera cancelada.`,
          {
            error: updateResult.error,
          }
        );
        return null;
      }

      logger.info("✅ Cita cancelada correctamente en la base de datos.", {
        appointment_id: updateResult.data?.id,
      });

      return updateResult;
    } catch (error) {
      logger.error("Error en _processCanceledAppointment.", {
        error: error.message,
        stack: error.stack,
        calendly_uri: payload?.uri,
      });
      throw error;
    }
  }

  /**
   * Procesa la reprogramación de una cita desde el payload de Calendly.
   * @param {object} payload - El payload del evento de Calendly.
   */
  async _processRescheduledAppointment(payload) {
    try {
      const calendlyEventUri = payload.uri;
      const newScheduledAt = new Date(payload.start_time);
      const newEndTime = new Date(payload.end_time);

      logger.info("Procesando reprogramación de cita de Calendly...", {
        calendly_event_uri: calendlyEventUri,
        new_scheduled_at: newScheduledAt,
      });

      const updateResult = await this.appointmentModel.updateByCalendlyUri(
        calendlyEventUri,
        {
          scheduled_at: newScheduledAt,
          end_time: newEndTime,
          status: "confirmed",
        }
      );

      if (!updateResult.success) {
        logger.warn(
          `No se encontró una cita para reprogramar con la URI: ${calendlyEventUri}`,
          {
            error: updateResult.error,
          }
        );
        return null;
      }

      logger.info("✅ Cita reprogramada exitosamente.", {
        appointment_id: updateResult.data?.id,
      });

      return updateResult;
    } catch (error) {
      logger.error("Error en _processRescheduledAppointment.", {
        error: error.message,
        stack: error.stack,
        calendly_uri: payload?.uri,
      });
      throw error;
    }
  }

  // =================================================================
  // SECCIÓN DEL BOT DE WHATSAPP
  // =================================================================

  /**
   * Procesa webhooks entrantes, diferenciando entre Twilio (WhatsApp) y Calendly.
   * Es el punto de entrada principal para la comunicación externa.
   * @param {object} req - El objeto de solicitud de Express.
   * @param {object} res - El objeto de respuesta de Express.
   */
  async receiveMessage(req, res) {
    // Primero, identificar si es un webhook de Calendly por su estructura (`event` y `payload`)
    if (req.body && req.body.event && req.body.payload) {
      logger.info(
        "Webhook de Calendly detectado, delegando a handleCalendlyWebhook."
      );
      return this.handleCalendlyWebhook(req, res);
    }

    // Si no, se asume que es un webhook de Twilio para WhatsApp.
    let phoneNumber = null;
    try {
      const { Body: message, From: from, ProfileName: senderName } = req.body;

      // Validar que es un webhook de Twilio válido
      if (typeof from === "undefined" || typeof message === "undefined") {
        logger.warn(
          "Webhook recibido con formato no reconocido (ni Calendly ni Twilio).",
          { body: req.body, headers: req.headers }
        );
        // Es importante devolver un 200 para que el emisor no reintente.
        return res.status(200).send("<Response/>");
      }
      phoneNumber = sanitizePhone(from);

      logger.info("Mensaje de WhatsApp recibido.", {
        phone: this.sanitizePhoneForLog(phoneNumber),
        sender_name: senderName,
        message_length: message?.length || 0,
      });

      if (!message || message.trim() === "") {
        logger.warn("Mensaje recibido vacío o solo con espacios.", {
          phone: this.sanitizePhoneForLog(phoneNumber),
        });
        return res.status(200).send("<Response/>");
      }

      const sanitizedMessage = sanitizeText(message);

      // Verificar consentimiento GDPR
      const gdprResult = await gdprService.checkAndRequestConsent(phoneNumber);
      if (!gdprResult.hasConsent) {
        await this.sendWhatsAppMessage(phoneNumber, gdprResult.message);
        logger.info(
          `Enviado mensaje de consentimiento GDPR a ${this.sanitizePhoneForLog(phoneNumber)}.`
        );
        return res.status(200).send("<Response/>");
      }

      // Obtener contexto de la conversación
      const context = await this.contextService.getContext(phoneNumber);

      // Análisis de intención
      const analysis = await this._analyzeMessageIntent(
        sanitizedMessage,
        context
      );
      logger.debug("Análisis de intención completado.", {
        intent: analysis.intent,
        phone: this.sanitizePhoneForLog(phoneNumber),
      });

      // Procesar según la intención y generar respuesta
      const responseText = await this._processUserIntent(
        phoneNumber,
        sanitizedMessage,
        analysis,
        context
      );

      // Enviar respuesta si existe
      if (responseText) {
        await this.sendWhatsAppMessage(phoneNumber, responseText);
      }

      // Actualizar contexto de la conversación
      await this.contextService.updateContext(phoneNumber, {
        lastMessage: sanitizedMessage,
        lastIntent: analysis.intent,
        timestamp: new Date(),
      });

      res.status(200).send("<Response/>");
    } catch (error) {
      logger.error("Error crítico en receiveMessage (procesando WhatsApp).", {
        error: error.message,
        stack: error.stack,
        phone: this.sanitizePhoneForLog(phoneNumber),
      });

      // Enviar mensaje de error genérico al usuario si es posible
      if (phoneNumber) {
        try {
          await this.sendWhatsAppMessage(
            phoneNumber,
            "Lo siento, he encontrado un problema técnico y no puedo procesar tu solicitud ahora mismo. Por favor, inténtalo de nuevo más tarde."
          );
        } catch (sendError) {
          logger.error(
            "Fallo al enviar el mensaje de error de fallback al usuario.",
            {
              phone: this.sanitizePhoneForLog(phoneNumber),
              sendError: sendError.message,
            }
          );
        }
      }

      res.status(200).send("<Response/>");
    }
  }

  /**
   * Analiza la intención del mensaje del usuario.
   * @private
   */
  async _analyzeMessageIntent(message, context) {
    try {
      return await intentAnalysisService.analyzeMessage(message, {
        context,
        availableServices: this.services,
      });
    } catch (error) {
      logger.error("Error en el servicio de análisis de intención.", {
        error: error.message,
      });
      // Fallback a una intención genérica para no detener el flujo
      return {
        intent: "general_inquiry",
        confidence: 0.5,
        entities: {},
        needsHumanAssistance: false,
      };
    }
  }

  /**
   * Dirige el flujo de la conversación según la intención detectada.
   * @private
   */
  async _processUserIntent(phone, message, analysis, context) {
    const handlers = {
      greeting: () => this.handleGreeting(phone),
      appointment_request: () =>
        this.handleAppointmentRequest(phone, analysis, context),
      appointment_modification: () =>
        this.handleAppointmentModification(phone, analysis, context),
      cancellation_request: () =>
        this.handleCancellationRequest(phone, analysis, context),
      service_inquiry: () => this.handleServiceInquiry(analysis, context),
      availability_inquiry: () =>
        this.handleAvailabilityInquiry(analysis, context),
      general_inquiry: () => this.handleGeneralInquiry(analysis, context),
    };

    try {
      const handler = handlers[analysis.intent] || handlers["general_inquiry"];
      return await handler();
    } catch (error) {
      logger.error("Error procesando la intención del usuario.", {
        error: error.message,
        intent: analysis.intent,
        phone: this.sanitizePhoneForLog(phone),
      });
      return "Disculpa, he tenido un problema al entender tu petición. ¿Podrías intentarlo de otra forma?";
    }
  }

  // =================================================================
  // MANEJADORES DE INTENCIÓN
  // =================================================================

  async handleGreeting(phone) {
    try {
      const clientResult = await this.clientService.findByPhone(phone);
      const clientName = clientResult.success
        ? clientResult.data.full_name.split(" ")[0]
        : null;

      const greeting = clientName
        ? `¡Hola ${clientName}! 👋 ¿En qué te puedo ayudar hoy?`
        : "¡Hola! 👋 Bienvenido a Ricardo Buriticá Beauty Consulting. ¿En qué puedo ayudarte?";

      return greeting;
    } catch (error) {
      logger.error("Error en handleGreeting", { error: error.message });
      return "¡Hola! 👋 ¿En qué puedo ayudarte hoy?";
    }
  }

  async handleBookingRequest(phone, analysis, context) {
    try {
      const clientResult = await this.clientService.findOrCreateByPhone(phone);

      if (!clientResult.success) {
        return "Para hacer una reserva necesito algunos datos. ¿Podrías decirme tu nombre completo?";
      }

      // Generar respuesta usando el servicio de generación
      const response = await responseGenerationService.generateResponse(
        analysis,
        {
          ...context,
          client: clientResult.data,
          availableServices: this.services,
        },
        this.services
      );

      return (
        response ||
        "Te ayudo con tu reserva. ¿Qué servicio te interesa y para cuándo?"
      );
    } catch (error) {
      logger.error("Error en handleBookingRequest", { error: error.message });
      return "Te ayudo con tu reserva. ¿Qué servicio te interesa?";
    }
  }

  async handleAppointmentModification(phone, analysis, context) {
    try {
      const clientResult = await this.clientService.findByPhone(phone);

      if (!clientResult.success) {
        return "Para modificar una cita, primero necesito identificarte. ¿Podrías proporcionarme tu nombre completo?";
      }

      const appointmentsResult = await this.appointmentModel.findByClientId(
        clientResult.data.id
      );

      if (!appointmentsResult.success || !appointmentsResult.data.length) {
        return "No encuentro citas activas a tu nombre. ¿Te gustaría hacer una nueva reserva?";
      }

      const activeAppointments = appointmentsResult.data.filter(
        (apt) => apt.status === "confirmed" || apt.status === "scheduled"
      );

      if (!activeAppointments.length) {
        return "No tienes citas activas que modificar. ¿Te gustaría hacer una nueva reserva?";
      }

      // Generar respuesta usando el servicio de generación
      const response = await responseGenerationService.generateResponse(
        analysis,
        {
          ...context,
          existingAppointments: activeAppointments,
          clientName: clientResult.data.full_name,
        },
        this.services
      );

      return (
        response || "Te ayudo a modificar tu cita. ¿Qué cambio necesitas hacer?"
      );
    } catch (error) {
      logger.error("Error en handleAppointmentModification", {
        error: error.message,
      });
      return "Puedo ayudarte a modificar tu cita. ¿Cuál es el cambio que necesitas?";
    }
  }

  async handleCancellationRequest(phone, analysis, context) {
    try {
      const clientResult = await this.clientService.findByPhone(phone);

      if (!clientResult.success) {
        return "Para cancelar una cita necesito identificarte. ¿Podrías proporcionarme tu nombre completo?";
      }

      const appointmentsResult = await this.appointmentModel.findByClientId(
        clientResult.data.id
      );

      if (!appointmentsResult.success || !appointmentsResult.data.length) {
        return "No encuentro citas activas a tu nombre que se puedan cancelar.";
      }

      const response = await responseGenerationService.generateResponse(
        analysis,
        {
          ...context,
          client: clientResult.data,
          existingAppointments: appointmentsResult.data,
        },
        this.services
      );

      return (
        response ||
        "Te ayudo con la cancelación. ¿Podrías confirmarme los detalles de la cita?"
      );
    } catch (error) {
      logger.error("Error en handleCancellationRequest", {
        error: error.message,
      });
      return "Entiendo que quieres cancelar una cita. ¿Podrías confirmarme los detalles?";
    }
  }

  async handleServiceInquiry(analysis, context) {
    try {
      if (!this.services || this.services.length === 0) {
        await this.loadServicesCache();
      }

      if (!this.services.length) {
        return "Actualmente no tengo información sobre los servicios. Por favor, consulta más tarde.";
      }

      const response = await responseGenerationService.generateResponse(
        analysis,
        {
          ...context,
          availableServices: this.services,
        },
        this.services
      );

      return (
        response ||
        `Estos son nuestros servicios:\n${this.services.map((s) => `• ${s.name}: ${s.description}`).join("\n")}\n\n¿Te gustaría saber más de alguno?`
      );
    } catch (error) {
      logger.error("Error en handleServiceInquiry", { error: error.message });
      return "Tenemos varios servicios disponibles. ¿Te interesa algún tratamiento en particular?";
    }
  }

  async handleAvailabilityInquiry(analysis, context) {
    try {
      const response = await responseGenerationService.generateResponse(
        analysis,
        {
          ...context,
          availableServices: this.services,
        },
        this.services
      );

      return (
        response ||
        "Para consultar disponibilidad, ¿podrías decirme qué servicio te interesa y qué fechas prefieres?"
      );
    } catch (error) {
      logger.error("Error en handleAvailabilityInquiry", {
        error: error.message,
      });
      return "Para revisar disponibilidad necesito saber qué servicio te interesa. ¿Podrías especificar?";
    }
  }

  async handleGeneralInquiry(analysis, context) {
    try {
      const response = await responseGenerationService.generateResponse(
        analysis,
        context,
        this.services
      );

      return (
        response ||
        "¿En qué puedo ayudarte? Puedo asistirte con citas, servicios y consultas generales."
      );
    } catch (error) {
      logger.error("Error en handleGeneralInquiry", { error: error.message });
      return "¿En qué puedo ayudarte? Estoy aquí para asistirte.";
    }
  }

  // =================================================================
  // MÉTODOS AUXILIARES
  // =================================================================

  /**
   * Envía un mensaje de WhatsApp usando Twilio.
   * @param {string} phone - Número de teléfono del destinatario (formato E.164).
   * @param {string} message - El texto del mensaje a enviar.
   */
  async sendWhatsAppMessage(phone, message) {
    try {
      const to = `whatsapp:${phone}`;
      const from = `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;

      const result = await twilioClient.messages.create({
        body: message,
        from,
        to,
      });

      logger.info(`Mensaje de WhatsApp enviado con éxito.`, {
        to: this.sanitizePhoneForLog(phone),
        message_sid: result.sid,
        status: result.status,
      });

      return { success: true, sid: result.sid };
    } catch (error) {
      logger.error(`Error al enviar mensaje de WhatsApp.`, {
        error: error.message,
        to: this.sanitizePhoneForLog(phone),
        message_preview: message.substring(0, 50) + "...",
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Construye un mensaje de confirmación de cita formateado.
   * @private
   */
  _buildConfirmationMessage(clientName, serviceName, scheduledAt) {
    const formattedDate = new Date(scheduledAt).toLocaleString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Madrid",
    });

    const firstName = clientName.split(" ")[0];

    return `¡Hola ${firstName}! 👋

✅ Tu cita ha sido confirmada con éxito.

*Detalles de la cita:*
📅 *Servicio:* ${serviceName}
🕐 *Fecha y hora:* ${formattedDate}

📍 Ricardo Buriticá Beauty Consulting

Si necesitas modificar o cancelar tu cita, puedes hacerlo respondiendo a este mensaje.

¡Nos vemos pronto! ✨`;
  }

  /**
   * Sanitiza un número de teléfono para mostrarlo en logs de forma segura.
   * @private
   */
  sanitizePhoneForLog(phoneNumber) {
    if (!phoneNumber || phoneNumber.length < 8) return "INVALID_PHONE";
    const start = phoneNumber.substring(0, 4);
    const end = phoneNumber.substring(phoneNumber.length - 3);
    return `${start}***${end}`;
  }

  /**
   * Maneja mensajes entrantes de WhatsApp
   * @param {object} req - Request de Express
   * @param {object} res - Response de Express
   */
  async handleWhatsAppMessage(req, res) {
    try {
      logger.info("📱 Mensaje de WhatsApp recibido", {
        body: req.body,
        headers: req.headers,
      });

      const { Body, From, ProfileName } = req.body;

      if (!Body || !From) {
        logger.warn("Mensaje de WhatsApp incompleto", { body: req.body });
        return res.status(400).send("Mensaje incompleto");
      }

      // Sanitizar datos de entrada
      const sanitizedData = {
        message: sanitizeText(Body, { maxLength: 4096, allowEmojis: true }),
        phone: sanitizePhone(From),
        profileName: ProfileName ? sanitizeText(ProfileName) : null,
      };

      // Procesar el mensaje de forma asíncrona
      this._processIncomingMessage(
        sanitizedData.phone,
        sanitizedData.message,
        sanitizedData.profileName
      ).catch((error) => {
        logger.error("Error procesando mensaje de WhatsApp", {
          error: error.message,
          phone: this.sanitizePhoneForLog(sanitizedData.phone),
        });
      });

      // Responder inmediatamente a Twilio
      res.status(200).send("OK");
    } catch (error) {
      logger.error("Error en handleWhatsAppMessage", {
        error: error.message,
        stack: error.stack,
      });
      res.status(500).send("Error interno");
    }
  }

  /**
   * Maneja estados de mensajes de WhatsApp (entregado, leído, etc.)
   * @param {object} req - Request de Express
   * @param {object} res - Response de Express
   */
  async messageStatus(req, res) {
    try {
      logger.info("📊 Estado de mensaje WhatsApp recibido", {
        body: req.body,
      });

      const { MessageStatus, MessageSid, To, From } = req.body;

      if (MessageStatus && MessageSid) {
        logger.info("Estado de mensaje actualizado", {
          messageSid: MessageSid,
          status: MessageStatus,
          to: this.sanitizePhoneForLog(To),
          from: this.sanitizePhoneForLog(From),
        });

        // Aquí podrías actualizar el estado en la base de datos si es necesario
        // await this.updateMessageStatus(MessageSid, MessageStatus);
      }

      res.status(200).send("OK");
    } catch (error) {
      logger.error("Error en messageStatus", {
        error: error.message,
        stack: error.stack,
      });
      res.status(500).send("Error interno");
    }
  }

  /**
   * Verifica el webhook de Twilio
   * @param {object} req - Request de Express
   * @param {object} res - Response de Express
   */
  async verifyWebhook(req, res) {
    try {
      logger.info("🔍 Verificación de webhook de Twilio", {
        query: req.query,
        headers: req.headers,
      });

      // Twilio envía un parámetro 'hub.challenge' para verificar el webhook
      const challenge = req.query["hub.challenge"];

      if (challenge) {
        logger.info("Webhook verificado correctamente", { challenge });
        return res.status(200).send(challenge);
      }

      // Si no hay challenge, responder OK
      res.status(200).send("Webhook verificado");
    } catch (error) {
      logger.error("Error en verifyWebhook", {
        error: error.message,
        stack: error.stack,
      });
      res.status(500).send("Error interno");
    }
  }

  /**
   * Procesa un mensaje entrante de forma asíncrona
   * @private
   */
  async _processIncomingMessage(phone, message, profileName) {
    try {
      logger.info("🔄 Procesando mensaje entrante", {
        phone: this.sanitizePhoneForLog(phone),
        messageLength: message.length,
        profileName,
      });

      // Obtener o crear contexto de conversación
      const context = await this.contextService.getOrCreateContext(phone, {
        profileName,
        lastActivity: new Date(),
      });

      // Actualizar contexto con el nuevo mensaje
      await this.contextService.updateContext(phone, {
        lastMessage: message,
        messageCount: (context.messageCount || 0) + 1,
        lastActivity: new Date(),
      });

      // Analizar intención del mensaje
      const analysis = await this._analyzeMessageIntent(message, context);

      // Procesar según la intención
      const response = await this._processUserIntent(
        phone,
        message,
        analysis,
        context
      );

      // Enviar respuesta
      if (response) {
        await this.sendWhatsAppMessage(phone, response);
      }

      logger.info("✅ Mensaje procesado correctamente", {
        phone: this.sanitizePhoneForLog(phone),
        intent: analysis.intent,
        responseLength: response ? response.length : 0,
      });
    } catch (error) {
      logger.error("Error procesando mensaje entrante", {
        error: error.message,
        phone: this.sanitizePhoneForLog(phone),
        stack: error.stack,
      });

      // Enviar mensaje de error al usuario
      try {
        await this.sendWhatsAppMessage(
          phone,
          "Disculpa, he tenido un problema técnico. Por favor, inténtalo de nuevo en unos momentos."
        );
      } catch (sendError) {
        logger.error("Error enviando mensaje de error", {
          error: sendError.message,
        });
      }
    }
  }

  /**
   * Health check del asistente
   */
  async healthCheck(req, res) {
    try {
      const stats = this.contextService.getStats();

      res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        services: {
          total: this.services.length,
          loaded: this.services.length > 0,
        },
        conversations: {
          active: stats.totalContexts,
          maxAllowed: stats.maxConversations,
        },
        integrations: {
          twilio: !!TWILIO_WHATSAPP_NUMBER,
          supabase: true,
          openai: true,
        },
      });
    } catch (error) {
      logger.error("Error en health check", { error: error.message });
      res.status(500).json({
        status: "unhealthy",
        error: error.message,
      });
    }
  }

  /**
   * Obtiene estadísticas de estado del controlador.
   */
  getStats() {
    return {
      services_loaded: this.services.length,
      last_service_update: this.lastServiceUpdate,
      controller_version: "2.0.0",
    };
  }

  // =================================================================
  // MÉTODOS ADMINISTRATIVOS
  // =================================================================

  /**
   * Enviar mensaje manual desde admin
   */
  async sendManualMessage(req, res) {
    try {
      const { phone, message } = req.body;

      if (!phone || !message) {
        return res.status(400).json({
          success: false,
          error: "Teléfono y mensaje son requeridos",
        });
      }

      const sanitizedPhone = sanitizePhone(phone);
      if (!sanitizedPhone) {
        return res.status(400).json({
          success: false,
          error: "Número de teléfono inválido",
        });
      }

      await this.sendWhatsAppMessage(sanitizedPhone, message);

      logger.info("Mensaje manual enviado", {
        phone: this.sanitizePhoneForLog(sanitizedPhone),
        messageLength: message.length,
      });

      res.status(200).json({
        success: true,
        message: "Mensaje enviado correctamente",
      });
    } catch (error) {
      logger.error("Error enviando mensaje manual", {
        error: error.message,
        stack: error.stack,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Obtener estadísticas del asistente
   */
  async getAssistantStats(req, res) {
    try {
      const contextStats = this.contextService.getStats();

      const stats = {
        timestamp: new Date().toISOString(),
        services: {
          total: this.services.length,
          lastUpdate: this.lastServiceUpdate,
        },
        conversations: {
          active: contextStats.totalContexts,
          maxAllowed: contextStats.maxConversations,
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: "2.0.0",
        },
      };

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error("Error obteniendo estadísticas", {
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Obtener conversaciones activas
   */
  async getActiveConversations(req, res) {
    try {
      const conversations = this.contextService.getAllContexts();

      // Sanitizar datos sensibles
      const sanitizedConversations = Object.entries(conversations).map(
        ([phone, context]) => ({
          phone: this.sanitizePhoneForLog(phone),
          lastActivity: context.lastActivity,
          messageCount: context.messageCount,
          profileName: context.profileName || "Desconocido",
        })
      );

      res.status(200).json({
        success: true,
        data: {
          total: sanitizedConversations.length,
          conversations: sanitizedConversations,
        },
      });
    } catch (error) {
      logger.error("Error obteniendo conversaciones", {
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Limpiar conversaciones antiguas
   */
  async cleanupConversations(req, res) {
    try {
      const { hoursOld = 24 } = req.body;

      const cleaned = this.contextService.cleanupOldContexts(hoursOld);

      logger.info("Limpieza de conversaciones completada", {
        conversationsRemoved: cleaned,
      });

      res.status(200).json({
        success: true,
        message: `${cleaned} conversaciones antiguas eliminadas`,
      });
    } catch (error) {
      logger.error("Error limpiando conversaciones", {
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Reinicializar cache de servicios
   */
  async reinitializeServices(req, res) {
    try {
      await this.refreshServicesCache();

      logger.info("Cache de servicios reinicializado", {
        servicesLoaded: this.services.length,
      });

      res.status(200).json({
        success: true,
        message: "Cache de servicios reinicializado correctamente",
        servicesLoaded: this.services.length,
      });
    } catch (error) {
      logger.error("Error reinicializando servicios", {
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
}

module.exports = AutonomousWhatsAppController;
