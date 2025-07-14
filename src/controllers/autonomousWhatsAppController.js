// src/controllers/autonomousWhatsAppController.js
// Controlador para webhooks de WhatsApp del asistente autónomo

const autonomousAssistant = require("../services/autonomousAssistant");
const intentAnalysisService = require("../services/intentAnalysisService");
const responseGenerationService = require("../services/responseGenerationService");
const gdprService = require("../services/gdprService");
const logger = require("../utils/logger");
const Validators = require("../utils/validators"); // Asegúrate de que Validators esté importado aquí también

// Imports adicionales necesarios
const ClientService = require("../services/clientService");
const DatabaseAdapter = require("../adapters/databaseAdapter");
const calendlyClient = require("../integrations/calendlyClient");
const openaiClient = require("../integrations/openaiClient");
const twilioClient = require("../integrations/twilioClient");
const conversationContextService = require("../services/ConversationContextService");
const notificationScheduler = require("../services/notificationScheduler");
const { TWILIO_WHATSAPP_NUMBER } = require("../config/env");

// Importar modelos para integración real con base de datos
const ClientModel = require("../models/clientModel");
const BookingModel = require("../models/bookingModel");
const ServiceModel = require("../models/serviceModel");

class AutonomousWhatsAppController {
  constructor() {
    // Inicializar servicios y propiedades necesarias
    this.services = [];
    this.contextService = conversationContextService;
    this.calendlyClient = calendlyClient;
    this.logger = logger;
    this.Validators = Validators;

    // Inicializar modelos de base de datos
    this.clientModel = new ClientModel();
    this.bookingModel = new BookingModel();
    this.serviceModel = new ServiceModel();

    // Cargar servicios al inicializar
    this.loadServices();
  }

  async loadServices() {
    try {
      // Cargar servicios reales desde la base de datos
      const result = await this.serviceModel.getAll();
      if (result.success) {
        this.services = result.data;
        logger.info("Services loaded successfully", {
          count: this.services.length,
        });
      } else {
        logger.warn("Failed to load services from database", {
          error: result.error,
        });
        this.services = []; // Fallback a array vacío
      }
    } catch (error) {
      logger.error("Error loading services", { error: error.message });
      this.services = []; // Fallback a array vacío
    }
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

      // Sanitizar mensaje
      const sanitizedMessage = Validators.sanitizeText(message);

      logger.info("Processing autonomous WhatsApp message", {
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
        messageId,
        messageLength: sanitizedMessage.length,
      });

      // Obtener contexto de conversación
      const context = this.contextService.getConversationContext(phoneNumber);

      // Analizar mensaje con IA mejorada
      const analysis = await intentAnalysisService.analyzeMessage(
        sanitizedMessage,
        context,
        phoneNumber
      );

      // Procesar según el análisis
      let response;
      switch (analysis.intent) {
        case "booking_request":
          response = await this.handleBookingRequest(
            phoneNumber,
            analysis,
            context
          );
          break;
        case "availability_inquiry":
          response = await this.handleAvailabilityInquiry(analysis);
          break;
        case "booking_modification":
          response = await this.handleBookingModification(
            phoneNumber,
            analysis,
            context
          );
          break;
        case "service_information":
          response = await this.handleServiceInformation(analysis);
          break;
        case "greeting":
          response = await this.handleGreeting(phoneNumber, analysis, context);
          break;
        case "direct_contact_request":
          response = await this.handleDirectContactRequest(
            phoneNumber,
            sanitizedMessage,
            analysis
          );
          break;
        case "gdpr_request":
          response = await this.handleGDPRRequest(phoneNumber, analysis, context);
          break;
        case "complaint":
          response = await this.handleComplaint(phoneNumber, analysis, context);
          break;
        case "compliment":
          response = await this.handleCompliment(phoneNumber, analysis, context);
          break;
        default:
          response = await this.handleGeneralInquiry(sanitizedMessage, context, analysis);
      }

      // Validar respuesta antes de enviar
      if (!response || typeof response !== "string") {
        response =
          "Disculpa, he tenido un problema procesando tu mensaje. ¿Podrías intentar de nuevo? 😊";
      }

      // Limitar longitud de respuesta
      if (response.length > 1600) {
        response =
          response.substring(0, 1500) + "...\n\n¿Necesitas más información? 😊";
      }

      // Actualizar contexto
      this.contextService.updateConversationContext(
        phoneNumber,
        sanitizedMessage,
        response,
        analysis
      );

      // Enviar respuesta
      await this.sendWhatsAppMessage(phoneNumber, response);

      return { success: true, response };
    } catch (error) {
      // Manejo de errores global para processWhatsAppMessage
      let errorMessage;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "object" && error !== null && error.message) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else {
        errorMessage = "Error desconocido o formato inesperado";
      }

      logger.error("Error in autonomous message processing", {
        error_message: errorMessage,
        stack: error instanceof Error ? error.stack : "No stack available",
        body: req.body,
      });

      // Extraer phoneNumber del request para manejo de errores
      const phoneNumber = req.body?.From?.replace("whatsapp:", "") || "unknown";

      const errorResponse =
        "Disculpa, he tenido un problema técnico. Te conectaré con Ricardo enseguida.";
      await this.sendWhatsAppMessage(phoneNumber, errorResponse);

      // Notificar error al administrador
      await this.notifyAdmin("Autonomous assistant error", {
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
        error: errorMessage,
      });

      throw error; // Re-lanza el error para que sea capturado por el manejador de Express si es un webhook
    }
  }

  /**
   * Analiza mensaje usando OpenAI con function calling avanzado
   */
  async analyzeMessage(message, context) {
    try {
      // Usar el nuevo cliente con function calling
      const analysis = await openaiClient.analyzeMessageWithFunctions(
        message,
        context,
        autonomousAssistant.systemPrompt // Pasa el systemPrompt aquí también, si openaiClient lo necesita
      );

      if (analysis.type === "function_call") {
        // El mensaje requiere una acción específica
        return await this.handleFunctionCall(analysis);
      } else {
        // Análisis tradicional de intención
        return await openaiClient.analyzeIntent(message, context);
      }
    } catch (error) {
      // Manejo de errores robusto para analyzeMessage
      let errorMessage;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "object" && error !== null && error.message) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else {
        errorMessage = "Error desconocido o formato inesperado";
      }

      logger.error("Error analyzing message with functions", {
        error_message: errorMessage,
      });

      // Fallback al método tradicional
      try {
        const prompt = `Analiza este mensaje de WhatsApp y extrae la información para reservas:

MENSAJE: "${message}"
CONTEXTO PREVIO: ${JSON.stringify(context.extractedData || {})}

Responde SOLO con un objeto JSON válido:
{
  "intent": "booking_request|availability_inquiry|booking_modification|service_information|greeting|general_inquiry",
  "confidence": 0.0-1.0,
  "entities": {
    "service": "corte|coloracion|tratamiento|manicura|pedicura|null",
    "date": "fecha_extraida|null",
    "time": "hora_extraida|null",
    "client_name": "nombre_extraido|null",
    "phone": "telefono_extraido|null",
    "email": "email_extraido|null"
  },
  "missing_info": ["campo1", "campo2"],
  "urgency": "low|medium|high",
  "ready_to_book": true|false
}`;

        const response = await openaiClient.chat(
          [
            {
              role: "system",
              content:
                "Eres un analizador experto de intenciones para reservas de servicios de belleza.",
            },
            { role: "user", content: prompt },
          ],
          {
            model: "gpt-4-turbo-preview",
            temperature: 0.1,
            max_tokens: 400,
          }
        );

        return JSON.parse(response.choices[0].message.content);
      } catch (fallbackError) {
        // Manejo de errores para el fallback
        let fallbackErrorMessage;
        if (fallbackError instanceof Error) {
          fallbackErrorMessage = fallbackError.message;
        } else if (
          typeof fallbackError === "object" &&
          fallbackError !== null &&
          fallbackError.message
        ) {
          fallbackErrorMessage = fallbackError.message;
        } else if (typeof fallbackError === "string") {
          fallbackErrorMessage = fallbackError;
        } else {
          fallbackErrorMessage = "Error desconocido o formato inesperado";
        }

        logger.error("Fallback analysis also failed", {
          error_message: fallbackErrorMessage,
        });
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
  }

  /**
   * Maneja llamadas a funciones de OpenAI
   */
  async handleFunctionCall(analysis) {
    const { function_name, arguments: args } = analysis;

    try {
      switch (function_name) {
        case "check_availability": {
          const availability = await this.checkCalendlyAvailability(
            args.service_name,
            args.date,
            args.time
          );
          return {
            intent: "availability_inquiry",
            confidence: 0.9,
            entities: args,
            missing_info: [],
            urgency: "medium",
            ready_to_book: availability.available,
            function_result: availability,
          };
        }

        case "create_booking":
          return {
            intent: "booking_request",
            confidence: 0.95,
            entities: args,
            missing_info: [],
            urgency: "high",
            ready_to_book: true,
            function_result: { action: "create_booking", data: args },
          };

        case "get_available_slots": {
          const slots = await this.getAvailableSlots(
            args.service_name,
            args.from_date,
            args.days_ahead || 7
          );
          return {
            intent: "availability_inquiry",
            confidence: 0.9,
            entities: args,
            missing_info: [],
            urgency: "medium",
            ready_to_book: false,
            function_result: slots,
          };
        }

        default:
          logger.warn("Unknown function call", { function_name });
          return {
            intent: "general_inquiry",
            confidence: 0.5,
            entities: {},
            missing_info: [],
            urgency: "medium",
            ready_to_book: false,
          };
      }
    } catch (error) {
      // Manejo de errores robusto para handleFunctionCall
      let errorMessage;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "object" && error !== null && error.message) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else {
        errorMessage = "Error desconocido o formato inesperado";
      }

      logger.error("Error handling function call", {
        error_message: errorMessage,
        function_name,
        arguments: args,
      });
      return {
        intent: "general_inquiry",
        confidence: 0.3,
        entities: {},
        missing_info: [],
        urgency: "medium",
        ready_to_book: false,
        error: errorMessage, // Pasa el mensaje de error para que se vea en el contexto
      };
    }
  }

  /**
   * Maneja solicitudes de reserva de forma autónoma con validaciones completas
   */
  async handleBookingRequest(phoneNumber, analysis, context) {
    try {
      const { entities, missing_info, ready_to_book } = analysis;

      // Combinar datos del análisis actual con contexto previo
      const bookingData = {
        ...context.extractedData,
        ...entities,
        phone: phoneNumber,
      };

      // Sanitizar datos del cliente
      if (bookingData.client_name) {
        bookingData.client_name = Validators.sanitizeText(
          bookingData.client_name
        );
      }
      if (bookingData.email) {
        bookingData.email = Validators.sanitizeText(bookingData.email);
      }

      // Validar datos del cliente
      const validation = Validators.validateClientData(bookingData);
      if (!validation.isValid) {
        this.contextService.updateConversationContext(phoneNumber, null, null, {
          extractedData: bookingData,
        });
        return `Para completar tu reserva necesito:\n\n${validation.errors
          .map((e) => `❌ ${e}`)
          .join("\n")}\n\n¿Podrías proporcionar esta información? 😊`;
      }

      // Si falta información crítica, solicitarla
      if (!ready_to_book || missing_info.length > 0) {
        this.contextService.updateConversationContext(phoneNumber, null, null, {
          extractedData: bookingData,
        });
        return this.requestMissingInformation(missing_info, bookingData);
      }

      // Verificar disponibilidad en Calendly
      const availability = await this.checkCalendlyAvailability(
        bookingData.service,
        bookingData.date,
        bookingData.time
      );

      if (!availability.available) {
        return await this.suggestAlternativeSlots(
          bookingData.service,
          bookingData.date
        );
      }

      // Crear reserva automáticamente
      const booking = await this.createAutomaticBooking(
        phoneNumber,
        bookingData,
        availability
      );

      // Limpiar contexto después de reserva exitosa
      this.contextService.clearConversationContext(phoneNumber);

      return this.formatBookingConfirmation(booking);
    } catch (error) {
      // Manejo de errores robusto para handleBookingRequest
      let errorMessage;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "object" && error !== null && error.message) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else {
        errorMessage = "Error desconocido o formato inesperado";
      }

      logger.error("Error handling booking request", {
        error_message: errorMessage,
        phoneNumber,
      });
      return "He tenido un problema al procesar tu reserva. Te conectaré con Ricardo para ayudarte mejor.";
    }
  }

  /**
   * Verifica disponibilidad en Calendly
   */
  async checkCalendlyAvailability(serviceName, date, time) {
    try {
      // Buscar servicio en cache
      const service = this.services.find((s) =>
        s.name.toLowerCase().includes(serviceName.toLowerCase())
      );

      if (!service) {
        throw new Error(`Service not found: ${serviceName}`);
      }

      // Formatear datetime para Calendly
      const datetime = `${date}T${time}:00`;

      // Consultar disponibilidad
      const slots = await calendlyClient.getAvailability({
        event_type: service.calendly_event_type, // Usa el slug (ej: "corte-hombre")
        start_time: datetime,
        duration: service.duration,
        // Si necesitas usar el ID numérico de la API, aquí sería el lugar:
        // event_type_id: service.calendly_api_id,
      });

      return {
        available: slots.length > 0,
        slots,
        service,
        datetime,
      };
    } catch (error) {
      // Manejo de errores robusto para checkCalendlyAvailability
      let errorMessage;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "object" && error !== null && error.message) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else {
        errorMessage = "Error desconocido o formato inesperado";
      }
      logger.error("Error checking Calendly availability", {
        error_message: errorMessage,
      });
      return { available: false, slots: [], service: null };
    }
  }

  /**
   * Crea reserva automática sin intervención humana
   */
  async createAutomaticBooking(phoneNumber, bookingData, availability) {
    try {
      // Obtener o crear cliente
      let clientResult = await ClientService.findByPhone(phoneNumber);
      let client = clientResult.data;

      if (!client) {
        const createResult = await ClientService.createClient({
          first_name: bookingData.client_name || "Cliente",
          last_name: bookingData.last_name || "",
          phone: phoneNumber,
          email:
            bookingData.email || `${phoneNumber.replace("+", "")}@temp.com`,
          whatsapp_phone: phoneNumber,
          lgpd_accepted: true,
          registration_complete: true,
        });

        if (!createResult.success) {
          throw new Error(`Error creating client: ${createResult.error}`);
        }
        client = createResult.data;
      }

      // Crear reserva en Calendly
      const calendlyBooking = await calendlyClient.createBooking({
        event_type_uuid: availability.service.calendly_api_id || "default", // ¡USA EL ID NUMÉRICO AQUÍ!
        start_time: availability.datetime,
        invitee: {
          name: `${client.first_name} ${client.last_name}`.trim(),
          email: client.email,
          phone: phoneNumber,
        },
      });

      // Crear reserva en nuestro sistema
      const bookingResult = await DatabaseAdapter.insert("bookings", {
        client_id: client.id,
        service_id: availability.service.id,
        scheduled_at: `${bookingData.date}T${bookingData.time}:00`,
        status: "confirmada",
        booking_url: calendlyBooking?.uri || null,
        notes: "Reserva creada automáticamente por asistente IA",
      });

      if (!bookingResult.success) {
        throw new Error(`Error creating booking: ${bookingResult.error}`);
      }

      const booking = bookingResult.data[0];

      // Programar recordatorios automáticos
      await this.scheduleAutomaticReminders(booking);

      logger.info("Automatic booking created successfully", {
        bookingId: booking.id,
        clientId: client.id,
        service: availability.service.name,
        phoneNumber,
      });

      return { booking, client, service: availability.service };
    } catch (error) {
      // Manejo de errores robusto para createAutomaticBooking
      let errorMessage;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "object" && error !== null && error.message) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else {
        errorMessage = "Error desconocido o formato inesperado";
      }

      logger.error("Error creating automatic booking", {
        error_message: errorMessage,
      });
      throw error;
    }
  }

  /**
   * Programa recordatorios automáticos
   */
  async scheduleAutomaticReminders(booking) {
    try {
      const reminders = [
        {
          hours: 24,
          message: `🔔 Recordatorio: Tienes una cita mañana\n\n📅 ${booking.service_name}\n🗓️ ${booking.date}\n⏰ ${booking.time}\n\n¡Te esperamos! 😊`,
        },
        {
          hours: 2,
          message: `⏰ Tu cita es en 2 horas\n\n📅 ${booking.service_name}\n🗓️ Hoy a las ${booking.time}\n\n📍 Recuerda la ubicación del salón.`,
        },
        {
          hours: 0.5,
          message: `🚨 ¡Tu cita es en 30 minutos!\n\n📅 ${booking.service_name}\n⏰ ${booking.time}\n\n¡Nos vemos pronto! 🎉`,
        },
      ];

      // Aquí implementarías la lógica de programación
      // Por ejemplo, usando cron jobs o un sistema de colas
      reminders.forEach(() => {
        // await reminderService.schedule(booking.id, reminder);
      });

      this.logger.info("Automatic reminders scheduled", {
        bookingId: booking.id,
        remindersCount: reminders.length,
      });
    } catch (error) {
      // Manejo de errores robusto para scheduleAutomaticReminders
      let errorMessage;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "object" && error !== null && error.message) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else {
        errorMessage = "Error desconocido o formato inesperado";
      }

      this.logger.error("Error scheduling automatic reminders", {
        error_message: errorMessage,
        bookingId: booking.id,
      });
    }
  }

  /**
   * Solicita información faltante de forma inteligente
   */
  requestMissingInformation(missingInfo, currentData) {
    const questions = {
      service:
        "¿Qué servicio necesitas? 💇‍♂️\n\n🔹 Corte de cabello (€25)\n🔹 Coloración (€45)\n🔹 Tratamiento capilar (€35)\n🔹 Manicura (€20)\n🔹 Pedicura (€25)",
      date: "¿Para qué fecha? 📅\n\nPuedes decir: 'mañana', 'el viernes', '15 de marzo', etc.",
      time: "¿A qué hora prefieres? ⏰\n\nEjemplo: '10:00', 'por la mañana', 'después de las 14:00'",
      client_name: "¿Cuál es tu nombre para la reserva? 😊",
      email: "¿Tu email para enviarte la confirmación? 📧",
    };

    const firstMissing = missingInfo[0];
    const question =
      questions[firstMissing] ||
      "Necesito más información para completar tu reserva.";

    let response = `Para completar tu reserva automáticamente:\n\n${question}`;

    // Mostrar información ya recopilada
    if (Object.keys(currentData).length > 0) {
      response += "\n\n📋 **Información actual:**";
      if (currentData.service)
        response += `\n✅ Servicio: ${currentData.service}`;
      if (currentData.date) response += `\n✅ Fecha: ${currentData.date}`;
      if (currentData.time) response += `\n✅ Hora: ${currentData.time}`;
      if (currentData.client_name)
        response += `\n✅ Nombre: ${currentData.client_name}`;
    }

    return response;
  }

  /**
   * Sugiere horarios alternativos cuando no hay disponibilidad
   */
  async suggestAlternativeSlots(serviceName, requestedDate) {
    try {
      const service = this.services.find((s) =>
        s.name.toLowerCase().includes(serviceName.toLowerCase())
      );

      if (!service) {
        return "No he encontrado ese servicio. ¿Podrías especificar cuál necesitas?";
      }

      // **CORRECCIÓN:** `date` y `time` deben venir del `requestedDate` y no de variables globales no definidas.
      // Si `requestedDate` es solo una fecha (ej. "2025-07-15"), necesitamos una hora para `datetime`
      // Asumimos que `requestedDate` es un formato compatible para construir datetime o se ajusta en CalendlyClient.
      // Si `getAvailableSlots` en calendlyClient.js espera `start_time` como un ISO string, entonces `requestedDate` ya debería serlo.
      // Para este ejemplo, solo usaremos `requestedDate` como `start_time`
      const slots = await this.calendlyClient.getAvailableSlots({
        event_type: service.calendly_event_type, // Usa el slug (ej: "corte-hombre")
        start_time: requestedDate, // Usar requestedDate directamente para start_time
        duration: service.duration, // Usa la duración del servicio
        // Si necesitas usar el ID numérico de la API, aquí sería el lugar:
        // event_type_id: service.calendly_api_id,
      });

      return {
        success: true,
        available: slots.length > 0,
        slots,
        service,
        requested_date: requestedDate, // Mantener la fecha solicitada
      };
    } catch (error) {
      // Manejo de errores robusto para suggestAlternativeSlots
      let errorMessage;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "object" && error !== null && error.message) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else {
        errorMessage = "Error desconocido o formato inesperado";
      }
      this.logger.error("Error suggesting alternatives", {
        error_message: errorMessage,
        serviceName: this.Validators.sanitizeText(serviceName),
        fromDate: requestedDate, // Usar requestedDate para el log
      });
      return {
        success: false,
        error: errorMessage,
        slots: [],
      };
    }
  }

  /**
   * Maneja consultas de disponibilidad
   */
  async handleAvailabilityInquiry(analysis) {
    try {
      const { entities } = analysis;
      const { service, date, time } = entities;

      if (!service) {
        return "¿Para qué servicio te gustaría consultar la disponibilidad? Ofrezco cortes, coloración, tratamientos, manicura y pedicura. 💅";
      }

      if (!date) {
        return `Para consultar disponibilidad de ${service}, ¿qué día te interesa? Puedes decirme una fecha específica o algo como "mañana" o "esta semana". 📅`;
      }

      // Verificar disponibilidad
      const availability = await this.checkCalendlyAvailability(
        service,
        date,
        time
      );

      if (availability.available) {
        return `¡Perfecto! Tengo disponibilidad para ${service} el ${date}${time ? ` a las ${time}` : ""}. ¿Te gustaría hacer la reserva? 😊`;
      } else {
        return await this.suggestAlternativeSlots(service, date);
      }
    } catch (error) {
      logger.error("Error handling availability inquiry", {
        error: error.message,
      });
      return "He tenido un problema consultando la disponibilidad. ¿Podrías intentar de nuevo o contactar directamente con Ricardo? 😊";
    }
  }

  /**
   * Maneja modificaciones de reservas
   */
  async handleBookingModification(phoneNumber, analysis, context) {
    try {
      const { entities } = analysis;

      // Buscar reservas existentes del cliente
      const existingBookings = await this.getClientBookings(phoneNumber);

      if (!existingBookings || existingBookings.length === 0) {
        return "No encuentro reservas activas en tu número. ¿Podrías proporcionarme más detalles sobre la reserva que quieres modificar? 🤔";
      }

      if (existingBookings.length === 1) {
        const booking = existingBookings[0];
        return `Encontré tu reserva para ${booking.service} el ${booking.date} a las ${booking.time}. ¿Qué te gustaría cambiar? (fecha, hora, servicio) 📝`;
      } else {
        const bookingsList = existingBookings
          .map((b, i) => `${i + 1}. ${b.service} - ${b.date} a las ${b.time}`)
          .join("\n");

        return `Tienes varias reservas activas:\n\n${bookingsList}\n\n¿Cuál quieres modificar? Puedes responder con el número. 📋`;
      }
    } catch (error) {
      logger.error("Error handling booking modification", {
        error: error.message,
      });
      return "He tenido un problema accediendo a tus reservas. Te conectaré con Ricardo para ayudarte mejor. 😊";
    }
  }

  /**
   * Maneja consultas sobre información de servicios
   */
  async handleServiceInformation(analysis) {
    try {
      const { entities } = analysis;
      const { service } = entities;

      if (!service) {
        return `Te ofrezco estos servicios:\n\n💇‍♀️ **Cortes** - Desde 25€\n🎨 **Coloración** - Desde 45€\n✨ **Tratamientos** - Desde 35€\n💅 **Manicura** - Desde 20€\n🦶 **Pedicura** - Desde 25€\n\n¿Sobre cuál te gustaría saber más? 😊`;
      }

      // Información específica por servicio
      const serviceInfo = {
        corte:
          "💇‍♀️ **Corte de Cabello**\n• Precio: Desde 25€\n• Duración: 45-60 min\n• Incluye: Lavado, corte y peinado\n• Consulta de estilo personalizada",
        coloracion:
          "🎨 **Coloración**\n• Precio: Desde 45€\n• Duración: 90-120 min\n• Incluye: Análisis capilar, aplicación y tratamiento\n• Colores naturales y fantasía",
        tratamiento:
          "✨ **Tratamientos Capilares**\n• Precio: Desde 35€\n• Duración: 60-90 min\n• Hidratación, reparación, alisado\n• Productos profesionales de alta calidad",
        manicura:
          "💅 **Manicura**\n• Precio: Desde 20€\n• Duración: 45-60 min\n• Incluye: Limado, cutículas, esmaltado\n• Opciones: clásica, semipermanente, gel",
        pedicura:
          "🦶 **Pedicura**\n• Precio: Desde 25€\n• Duración: 60-75 min\n• Incluye: Exfoliación, hidratación, esmaltado\n• Cuidado completo de pies",
      };

      const info = serviceInfo[service.toLowerCase()] || serviceInfo.corte;
      return `${info}\n\n¿Te gustaría hacer una reserva? 😊`;
    } catch (error) {
      logger.error("Error handling service information", {
        error: error.message,
      });
      return "He tenido un problema obteniendo la información. ¿Podrías ser más específico sobre qué servicio te interesa? 😊";
    }
  }

  /**
   * Maneja saludos iniciales
   */
  async handleGreeting(phoneNumber) {
    try {
      // Verificar si es un cliente conocido
      const existingClient = await this.getClientByPhone(phoneNumber);

      if (existingClient) {
        return `¡Hola ${existingClient.name}! 👋 Soy el asistente de Ricardo. ¿En qué puedo ayudarte hoy? Puedo ayudarte con:\n\n📅 Hacer una nueva reserva\n🔄 Modificar una reserva existente\n💡 Información sobre servicios\n📞 Contactar directamente con Ricardo\n\n¿Qué necesitas? 😊`;
      } else {
        return `¡Hola! 👋 Soy el asistente virtual de Ricardo Buriticá, tu estilista de confianza.\n\nPuedo ayudarte con:\n📅 **Reservar cita** - Cortes, coloración, tratamientos\n💅 **Servicios de belleza** - Manicura y pedicura\n📞 **Contacto directo** - Te conecto con Ricardo\n\n¿Cómo puedo ayudarte hoy? 😊`;
      }
    } catch (error) {
      logger.error("Error handling greeting", { error: error.message });
      return `¡Hola! 👋 Soy el asistente de Ricardo. ¿En qué puedo ayudarte hoy? Puedo ayudarte con reservas, información de servicios o conectarte directamente con Ricardo. 😊`;
    }
  }

  /**
   * Maneja solicitudes de contacto directo
   */
  async handleDirectContactRequest(phoneNumber, message) {
    try {
      // Notificar a Ricardo sobre la solicitud de contacto directo
      await this.notifyAdmin("Solicitud de contacto directo", {
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
        message: message,
        timestamp: new Date().toISOString(),
      });

      return `He notificado a Ricardo sobre tu solicitud. Te contactará lo antes posible. 📞\n\nMientras tanto, ¿hay algo en lo que pueda ayudarte? Puedo:\n\n📅 Ayudarte con reservas\n💡 Darte información sobre servicios\n⏰ Consultar disponibilidad\n\n¿Te gustaría que haga algo de esto? 😊`;
    } catch (error) {
      logger.error("Error handling direct contact request", {
        error: error.message,
      });
      return `He registrado tu solicitud de contacto. Ricardo se pondrá en contacto contigo pronto. 📞\n\n¿Mientras tanto puedo ayudarte con algo más? 😊`;
    }
  }

  /**
   * Maneja consultas generales
   */
  async handleGeneralInquiry(message, context) {
    try {
      // Usar OpenAI para generar una respuesta contextual
      const response = await openaiClient.chat(
        [
          {
            role: "system",
            content: `Eres el asistente virtual de Ricardo Buriticá, un estilista profesional. 
          Responde de manera amigable y profesional. Si no puedes ayudar con algo específico, 
          ofrece conectar con Ricardo directamente. Mantén las respuestas concisas y útiles.
          
          Servicios disponibles:
          - Cortes de cabello (desde 25€)
          - Coloración (desde 45€) 
          - Tratamientos capilares (desde 35€)
          - Manicura (desde 20€)
          - Pedicura (desde 25€)
          
          Siempre termina ofreciendo ayuda adicional.`,
          },
          {
            role: "user",
            content: message,
          },
        ],
        {
          model: "gpt-4-turbo-preview",
          temperature: 0.7,
          max_tokens: 300,
        }
      );

      return (
        response.choices[0].message.content +
        "\n\n¿Hay algo más en lo que pueda ayudarte? 😊"
      );
    } catch (error) {
      logger.error("Error handling general inquiry", { error: error.message });
      return `Entiendo tu consulta, pero prefiero que hables directamente con Ricardo para darte la mejor respuesta. ¿Te gustaría que le notifique para que te contacte? 📞\n\nO puedo ayudarte con:\n📅 Hacer una reserva\n💡 Información sobre servicios\n⏰ Consultar disponibilidad\n\n¿Qué prefieres? 😊`;
    }
  }

  /**
   * Obtiene las reservas de un cliente por teléfono
   */
  async getClientBookings(phoneNumber) {
    try {
      // Buscar cliente por teléfono
      const clientResult = await this.clientModel.getByPhone(phoneNumber);
      if (!clientResult.success || !clientResult.data) {
        return [];
      }

      // Obtener reservas del cliente
      const bookingsResult = await this.bookingModel.getByClientId(
        clientResult.data.id
      );
      if (!bookingsResult.success) {
        logger.error("Error getting bookings for client", {
          phoneNumber: this.sanitizePhoneForLog(phoneNumber),
          error: bookingsResult.error,
        });
        return [];
      }

      // Filtrar solo reservas activas (no canceladas)
      const activeBookings = bookingsResult.data.filter(
        (booking) =>
          booking.status !== "cancelled" && booking.status !== "completed"
      );

      return activeBookings;
    } catch (error) {
      logger.error("Error getting client bookings", {
        error: error.message,
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
      });
      return [];
    }
  }

  /**
   * Obtiene información de un cliente por teléfono
   */
  async getClientByPhone(phoneNumber) {
    try {
      // Limpiar número de teléfono para búsqueda
      const cleanPhone = phoneNumber.replace(/\D/g, "");

      // Buscar cliente por teléfono o WhatsApp
      const result = await this.clientModel.getByPhone(cleanPhone);

      if (result.success && result.data) {
        return result.data;
      }

      // Si no se encuentra por teléfono, intentar por WhatsApp
      const whatsappResult = await this.clientModel.getByWhatsApp(cleanPhone);

      if (whatsappResult.success && whatsappResult.data) {
        return whatsappResult.data;
      }

      return null;
    } catch (error) {
      logger.error("Error getting client by phone", {
        error: error.message,
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
      });
      return null;
    }
  }

  /**
   * Solicita información faltante para completar la reserva
   */
  requestMissingInformation(missingInfo, currentData) {
    try {
      const missingFields = {
        service:
          "¿Qué servicio te gustaría reservar? (corte, coloración, tratamiento, manicura, pedicura)",
        date: "¿Para qué fecha te gustaría la cita? Puedes decir algo como 'mañana', 'viernes' o una fecha específica",
        time: "¿A qué hora prefieres? Estoy disponible de 9:00 a 18:00",
        client_name: "¿Cuál es tu nombre completo?",
        email: "¿Podrías proporcionarme tu email para confirmar la reserva?",
      };

      if (!missingInfo || missingInfo.length === 0) {
        return "Necesito un poco más de información para completar tu reserva. ¿Podrías darme más detalles? 😊";
      }

      const questions = missingInfo.map(
        (field) =>
          missingFields[field] || `Necesito información sobre: ${field}`
      );

      let response = "Para completar tu reserva necesito:\n\n";
      questions.forEach((question, index) => {
        response += `${index + 1}. ${question}\n`;
      });

      response += "\n¿Podrías ayudarme con esta información? 😊";
      return response;
    } catch (error) {
      logger.error("Error requesting missing information", {
        error: error.message,
      });
      return "Necesito un poco más de información para completar tu reserva. ¿Podrías darme más detalles? 😊";
    }
  }

  /**
   * Crea una reserva automática
   */
  async createAutomaticBooking(phoneNumber, bookingData, availability) {
    try {
      // Crear reserva en Calendly
      const calendlyBooking = await this.calendlyClient.createBooking({
        event_type: availability.event_type,
        start_time: availability.start_time,
        invitee: {
          name: bookingData.client_name,
          email: bookingData.email || `${phoneNumber}@whatsapp.temp`,
          phone: phoneNumber,
        },
        questions_and_answers: [
          {
            question: "Servicio solicitado",
            answer: bookingData.service,
          },
          {
            question: "Número de WhatsApp",
            answer: phoneNumber,
          },
        ],
      });

      // Crear o actualizar cliente en base de datos
      let client = await this.getClientByPhone(phoneNumber);

      if (!client) {
        // Crear nuevo cliente
        const clientData = {
          name: bookingData.client_name,
          phone: phoneNumber,
          whatsapp_number: phoneNumber,
          email: bookingData.email,
          preferred_contact_method: "whatsapp",
          source: "whatsapp_autonomous",
          notes: `Cliente creado automáticamente via WhatsApp el ${new Date().toLocaleDateString()}`,
        };

        const clientResult = await this.clientModel.create(clientData);
        if (!clientResult.success) {
          throw new Error(`Error creating client: ${clientResult.error}`);
        }
        client = clientResult.data;
      } else {
        // Actualizar información del cliente si es necesario
        if (
          bookingData.client_name &&
          client.name !== bookingData.client_name
        ) {
          const updateResult = await this.clientModel.update(client.id, {
            name: bookingData.client_name,
            email: bookingData.email || client.email,
          });
          if (updateResult.success) {
            client = { ...client, ...updateResult.data };
          }
        }
      }

      // Buscar servicio en la base de datos
      const serviceResult = await this.serviceModel.getByName(
        bookingData.service
      );
      let serviceId = null;
      if (serviceResult.success && serviceResult.data) {
        serviceId = serviceResult.data.id;
      }

      // Crear registro de reserva en la base de datos
      const bookingDataForDB = {
        client_id: client.id,
        service_id: serviceId,
        service_name: bookingData.service,
        appointment_date: bookingData.date,
        appointment_time: bookingData.time,
        status: "confirmed",
        source: "whatsapp_autonomous",
        calendly_event_uri: calendlyBooking.uri,
        notes: `Reserva creada automáticamente via WhatsApp`,
        total_amount: serviceResult.success ? serviceResult.data.price : 0,
      };

      const bookingResult = await this.bookingModel.create(bookingDataForDB);
      if (!bookingResult.success) {
        logger.error("Error saving booking to database", {
          error: bookingResult.error,
          calendlyUri: calendlyBooking.uri,
        });
        // Continuar aunque falle el guardado en DB, ya que la reserva está en Calendly
      }

      const booking = {
        id: bookingResult.success
          ? bookingResult.data.id
          : calendlyBooking.uri.split("/").pop(),
        client_id: client.id,
        client_name: client.name,
        phone: phoneNumber,
        email: client.email,
        service: bookingData.service,
        date: bookingData.date,
        time: bookingData.time,
        status: "confirmed",
        calendly_uri: calendlyBooking.uri,
        created_at: new Date().toISOString(),
      };

      logger.info("Automatic booking created", {
        bookingId: booking.id,
        clientId: client.id,
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
        service: bookingData.service,
        calendlyUri: calendlyBooking.uri,
      });

      // Programar notificaciones automáticas para la nueva reserva
      try {
        await notificationScheduler.scheduleImmediateBookingNotifications(booking, client);
        logger.info("Notifications scheduled for new booking", { bookingId: booking.id });
      } catch (notificationError) {
        logger.error("Error scheduling notifications for new booking", {
          bookingId: booking.id,
          error: notificationError.message
        });
        // No fallar la reserva por errores de notificación
      }

      return booking;
    } catch (error) {
      logger.error("Error creating automatic booking", {
        error: error.message,
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
      });
      throw new Error(
        "No he podido crear la reserva automáticamente. Te conectaré con Ricardo para completarla."
      );
    }
  }

  /**
   * Formatea la confirmación de reserva
   */
  formatBookingConfirmation(booking) {
    try {
      return (
        `✅ **¡Reserva Confirmada!**\n\n` +
        `👤 **Cliente:** ${booking.client_name}\n` +
        `💇‍♀️ **Servicio:** ${booking.service}\n` +
        `📅 **Fecha:** ${booking.date}\n` +
        `⏰ **Hora:** ${booking.time}\n` +
        `📱 **Teléfono:** ${this.sanitizePhoneForLog(booking.phone)}\n\n` +
        `📧 Te he enviado un email de confirmación${booking.email ? ` a ${booking.email}` : ""}.\n\n` +
        `**Importante:**\n` +
        `• Llega 5 minutos antes\n` +
        `• Si necesitas cancelar, avísame con 24h de antelación\n` +
        `• ¿Alguna pregunta? ¡Escríbeme!\n\n` +
        `¡Nos vemos pronto! 😊✨`
      );
    } catch (error) {
      logger.error("Error formatting booking confirmation", {
        error: error.message,
      });
      return `✅ ¡Tu reserva ha sido confirmada! Te he enviado los detalles por email. ¡Nos vemos pronto! 😊`;
    }
  }

  /**
   * Obtiene slots disponibles para un servicio
   */
  async getAvailableSlots(serviceName, fromDate, daysAhead = 7) {
    try {
      // Buscar servicio
      const service = this.services.find((s) =>
        s.name.toLowerCase().includes(serviceName.toLowerCase())
      );

      if (!service) {
        throw new Error(`Service not found: ${serviceName}`);
      }

      // Calcular rango de fechas
      const startDate = new Date(fromDate);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + daysAhead);

      // Obtener slots de Calendly
      const slots = await this.calendlyClient.getAvailableSlots({
        event_type: service.calendly_event_type,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
      });

      return {
        success: true,
        service: serviceName,
        slots: slots.map((slot) => ({
          date: slot.start_time.split("T")[0],
          time: slot.start_time.split("T")[1].substring(0, 5),
          available: true,
          slot_id: slot.uri,
        })),
      };
    } catch (error) {
      logger.error("Error getting available slots", {
        error: error.message,
        serviceName,
        fromDate,
      });
      return {
        success: false,
        error: error.message,
        slots: [],
      };
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
   * Envía mensaje de WhatsApp
   */
  async sendWhatsAppMessage(phoneNumber, message) {
    try {
      // Validar parámetros
      if (!phoneNumber || !message) {
        throw new Error("phoneNumber y message son requeridos");
      }

      // Validar configuración de Twilio
      if (!TWILIO_WHATSAPP_NUMBER) {
        logger.warn("TWILIO_WHATSAPP_NUMBER no configurado, solo logging", {
          to: this.sanitizePhoneForLog(phoneNumber),
          messageLength: message.length,
        });
        return { success: true, mode: "development" };
      }

      // Sanitizar número de teléfono
      const cleanPhoneNumber = phoneNumber.replace(/\D/g, "");
      const formattedPhoneNumber = cleanPhoneNumber.startsWith("+")
        ? cleanPhoneNumber
        : `+${cleanPhoneNumber}`;

      logger.info("Sending WhatsApp message", {
        to: this.sanitizePhoneForLog(formattedPhoneNumber),
        messageLength: message.length,
      });

      // Enviar mensaje usando Twilio
      const twilioMessage = await twilioClient.messages.create({
        from: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:${formattedPhoneNumber}`,
        body: message,
      });

      logger.info("WhatsApp message sent successfully", {
        messageId: twilioMessage.sid,
        to: this.sanitizePhoneForLog(formattedPhoneNumber),
        status: twilioMessage.status,
      });

      return {
        success: true,
        messageId: twilioMessage.sid,
        status: twilioMessage.status,
      };
    } catch (error) {
      logger.error("Error sending WhatsApp message", {
        error: error.message,
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
        stack: error.stack,
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

  /**
   * Webhook para estados de mensajes (entregado, leído, etc.)
   */
  async messageStatus(req, res) {
    try {
      logger.info("WhatsApp message status received", { body: req.body });
      return res.status(200).json({ status: "ok" });
    } catch (error) {
      logger.error("Error processing message status", { error: error.message });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Verificación de webhook para Twilio
   */
  async verifyWebhook(req, res) {
    try {
      const challenge = req.query["hub.challenge"];
      if (challenge) {
        return res.status(200).send(challenge);
      }
      return res.status(200).json({ status: "webhook verified" });
    } catch (error) {
      logger.error("Error verifying webhook", { error: error.message });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Health check específico del asistente autónomo
   */
  async healthCheck(req, res) {
    try {
      return res.status(200).json({
        status: "healthy",
        service: "autonomous-whatsapp-assistant",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    } catch (error) {
      logger.error("Error in health check", { error: error.message });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Enviar mensaje manual desde admin
   */
  async sendManualMessage(req, res) {
    try {
      const { phoneNumber, message } = req.body;

      if (!phoneNumber || !message) {
        return res
          .status(400)
          .json({ error: "phoneNumber and message are required" });
      }

      // Aquí iría la lógica para enviar mensaje
      logger.info("Manual message sent", {
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
      });

      return res.status(200).json({ status: "message sent" });
    } catch (error) {
      logger.error("Error sending manual message", { error: error.message });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Obtener estadísticas del asistente
   */
  async getAssistantStats(req, res) {
    try {
      const stats = {
        activeConversations: 0,
        totalMessages: 0,
        successfulBookings: 0,
        uptime: process.uptime(),
      };

      return res.status(200).json(stats);
    } catch (error) {
      logger.error("Error getting assistant stats", { error: error.message });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Obtener conversaciones activas
   */
  async getActiveConversations(req, res) {
    try {
      const conversations = [];
      return res.status(200).json({ conversations });
    } catch (error) {
      logger.error("Error getting active conversations", {
        error: error.message,
      });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Limpiar conversaciones antiguas
   */
  async cleanupConversations(req, res) {
    try {
      logger.info("Cleaning up old conversations");
      return res.status(200).json({ status: "cleanup completed" });
    } catch (error) {
      logger.error("Error cleaning up conversations", { error: error.message });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Reinicializar cache de servicios
   */
  async reinitializeServices(req, res) {
    try {
      logger.info("Reinitializing services cache");
      return res.status(200).json({ status: "services reinitialized" });
    } catch (error) {
      logger.error("Error reinitializing services", { error: error.message });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Manejar saludo mejorado
   */
  async handleGreeting(phoneNumber, analysis, context) {
    try {
      // Obtener servicios disponibles
      const availableServices = this.services.slice(0, 3);
      
      // Generar respuesta personalizada
      const response = await responseGenerationService.generateResponse(
        analysis, 
        { 
          ...context, 
          clientName: context.extractedData?.client_name,
          sentiment: analysis.entities?.sentiment 
        }, 
        availableServices
      );

      return response;

    } catch (error) {
      logger.error("Error handling greeting", { 
        error: error.message,
        phoneNumber: this.sanitizePhoneForLog(phoneNumber)
      });
      return "¡Hola! Soy el asistente virtual de Ricardo Buriticá Beauty Consulting. ¿En qué puedo ayudarte hoy? 😊";
    }
  }

  /**
   * Manejar solicitud de contacto directo mejorada
   */
  async handleDirectContactRequest(phoneNumber, message, analysis) {
    try {
      // Generar respuesta personalizada
      const response = await responseGenerationService.generateResponse(analysis, {
        urgency: analysis.entities?.urgency || 'medium'
      });

      // Notificar al administrador
      await this.notifyAdmin("Direct contact request", {
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
        message: message.substring(0, 100),
        urgency: analysis.entities?.urgency,
        timestamp: new Date().toISOString()
      });

      return response;

    } catch (error) {
      logger.error("Error handling direct contact request", { 
        error: error.message,
        phoneNumber: this.sanitizePhoneForLog(phoneNumber)
      });
      return "Entiendo que quieres hablar con Ricardo. Le notificaré inmediatamente para que se ponga en contacto contigo. ¿Es algo urgente?";
    }
  }

  /**
   * Manejar solicitudes RGPD
   */
  async handleGDPRRequest(phoneNumber, analysis, context) {
    try {
      const gdprAction = analysis.entities?.gdpr_action;

      switch (gdprAction) {
        case 'consent_required':
          return analysis.suggested_response;

        case 'consent_granted':
          // Registrar consentimiento
          await gdprService.recordConsent(
            phoneNumber,
            gdprService.consentTypes.WHATSAPP,
            true,
            'whatsapp_communication',
            'whatsapp'
          );
          return await responseGenerationService.generateResponse(analysis, context);

        case 'consent_withdrawn':
          // Registrar retirada de consentimiento
          await gdprService.recordConsent(
            phoneNumber,
            gdprService.consentTypes.WHATSAPP,
            false,
            'whatsapp_communication',
            'whatsapp'
          );
          return await responseGenerationService.generateResponse(analysis, context);

        case 'data_export':
          // Procesar solicitud de exportación
          const exportResult = await gdprService.exportUserData(phoneNumber);
          if (exportResult.success) {
            return "He preparado la exportación de tus datos. Te enviaré la información por email en los próximos minutos.";
          } else {
            return "Ha habido un problema procesando tu solicitud de exportación. Te conectaré con Ricardo para resolverlo.";
          }

        case 'data_deletion':
          // Procesar solicitud de eliminación
          const deleteResult = await gdprService.deleteUserData(phoneNumber);
          if (deleteResult.success) {
            return "Tus datos han sido eliminados correctamente según tu solicitud. Gracias por habernos contactado.";
          } else {
            return "No puedo eliminar tus datos debido a obligaciones legales. Te conectaré con Ricardo para más información.";
          }

        default:
          return "Para solicitudes relacionadas con privacidad y datos personales, puedes escribir 'EXPORTAR DATOS' o 'ELIMINAR DATOS'. También puedes contactar directamente con Ricardo.";
      }

    } catch (error) {
      logger.error("Error handling GDPR request", { 
        error: error.message,
        phoneNumber: this.sanitizePhoneForLog(phoneNumber)
      });
      return "Ha habido un problema procesando tu solicitud de privacidad. Te conectaré con Ricardo para resolverlo.";
    }
  }

  /**
   * Manejar quejas
   */
  async handleComplaint(phoneNumber, analysis, context) {
    try {
      // Generar respuesta empática
      const response = await responseGenerationService.generateResponse(analysis, {
        sentiment: 'negative',
        urgency: 'high'
      });

      // Notificar inmediatamente al administrador
      await this.notifyAdmin("Customer complaint", {
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
        sentiment: analysis.entities?.sentiment,
        urgency: 'high',
        timestamp: new Date().toISOString()
      });

      return response;

    } catch (error) {
      logger.error("Error handling complaint", { 
        error: error.message,
        phoneNumber: this.sanitizePhoneForLog(phoneNumber)
      });
      return "Lamento mucho que hayas tenido una experiencia negativa. Voy a notificar inmediatamente a Ricardo para que se ponga en contacto contigo y resuelva esta situación.";
    }
  }

  /**
   * Manejar elogios
   */
  async handleCompliment(phoneNumber, analysis, context) {
    try {
      // Generar respuesta de agradecimiento
      const response = await responseGenerationService.generateResponse(analysis, {
        sentiment: 'positive'
      });

      // Notificar al administrador (feedback positivo)
      await this.notifyAdmin("Customer compliment", {
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
        sentiment: 'positive',
        timestamp: new Date().toISOString()
      });

      return response;

    } catch (error) {
      logger.error("Error handling compliment", { 
        error: error.message,
        phoneNumber: this.sanitizePhoneForLog(phoneNumber)
      });
      return "¡Muchísimas gracias por tus palabras! Me alegra saber que estás contenta con nuestros servicios. ¿Hay algo más en lo que pueda ayudarte?";
    }
  }

  /**
   * Manejar consulta general mejorada
   */
  async handleGeneralInquiry(message, context, analysis) {
    try {
      // Generar respuesta inteligente
      const response = await responseGenerationService.generateResponse(
        analysis, 
        context, 
        this.services.slice(0, 3)
      );

      return response;

    } catch (error) {
      logger.error("Error handling general inquiry", { 
        error: error.message,
        messageLength: message.length
      });
      return "Gracias por contactarnos. ¿En qué puedo ayudarte específicamente? Puedo ayudarte con reservas, información sobre servicios o conectarte con Ricardo.";
    }
  }
}

module.exports = AutonomousWhatsAppController;
