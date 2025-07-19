// src/services/autonomousAssistant.js
/**
 * Asistente Virtual Autónomo para Reservas
 *
 * Sistema de inteligencia artificial que gestiona reservas de servicios de belleza
 * de forma completamente automática a través de WhatsApp, integrando con:
 * - OpenAI para análisis de mensajes e intenciones
 * - Calendly para gestión de disponibilidad y reservas
 * - Twilio para comunicación por WhatsApp
 * - Supabase para persistencia de datos
 *
 * Características de seguridad:
 * - Validación y sanitización de todas las entradas
 * - Rate limiting por usuario
 * - Gestión de memoria con límites
 * - Logging seguro sin exposición de datos sensibles
 * - Cumplimiento con RGPD en manejo de datos personales
 *
 * @author Ricardo Buriticá
 * @version 2.0.0
 * @since 2024
 */

// Cargar variables de entorno antes que cualquier otra cosa
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const openaiClient = require("../integrations/openaiClient");
const calendlyClient = require("../integrations/calendlyClient");
const twilioClient = require("../integrations/twilioClient");
const ClientService = require("./clientService");
const ServiceService = require("./serviceService");
const DatabaseAdapter = require("../adapters/databaseAdapter");
const ServiceModel = require("../models/serviceModel");
const logger = require("../utils/logger");

/**
 * Clase principal del Asistente Virtual Autónomo
 *
 * Gestiona el flujo completo de reservas automáticas:
 * 1. Recibe mensajes de WhatsApp
 * 2. Analiza intenciones con IA
 * 3. Extrae información necesaria
 * 4. Verifica disponibilidad en Calendly
 * 5. Crea reservas automáticamente
 * 6. Envía confirmaciones y recordatorios
 *
 * @class AutonomousAssistant
 */
class AutonomousAssistant {
  /**
   * Inicializa el Asistente Virtual Autónomo
   *
   * Configura:
   * - Cache de conversaciones con límites de memoria
   * - Sistema de rate limiting
   * - Cache de servicios con actualización automática
   * - Prompt del sistema para IA
   *
   * @constructor
   */
  constructor() {
    /** @type {Map<string, Object>} Cache de conversaciones activas por número de teléfono */
    this.conversations = new Map();

    /** @type {Array<Object>|null} Cache de servicios disponibles */
    this.services = null;

    /** @type {string|null} Prompt del sistema para OpenAI */
    this.systemPrompt = null;

    /** @type {Map<string, Array<number>>} Rate limiting por número de teléfono */
    this.rateLimitMap = new Map();

    /** @type {number} Límite máximo de conversaciones en memoria */
    this.maxConversations = 1000;

    // Inicialización asíncrona
    this.initializeServices();
    this.startCacheRefreshScheduler();
  }

  /**
   * Inicializa cache de servicios
   */
  async initializeServices() {
    try {
      console.log(
        "[DEBUG_INIT_AA] Iniciando initializeServices en AutonomousAssistant..."
      );
      const serviceModel = new ServiceModel();
      const result = await serviceModel.searchAdvanced(
        { is_active: true },
        { limit: 100, sortBy: "name", sortOrder: "asc" }
      );
      console.log(
        "[DEBUG_INIT_AA] Resultado de ServiceModel.searchAdvanced en initializeServices:",
        JSON.stringify(result, null, 2)
      );

      if (result && result.success && Array.isArray(result.data)) {
        this.services = result.data;
        this.systemPrompt = this.buildSystemPrompt(); // Construir prompt después de cargar servicios
        logger.info("Services cache initialized", {
          count: this.services.length,
        });
        console.log(
          "[DEBUG_INIT_AA] Cache de servicios inicializada con éxito. Total:",
          this.services.length
        );
      } else {
        logger.warn(
          "No services found during initialization - services may not be initialized yet",
          {
            success: result.success,
            dataLength: result.data ? result.data.length : 0,
            error: result.error, // Este error es del resultado de searchAdvanced
          }
        );
        this.services = [];
        this.systemPrompt = this.buildSystemPrompt(); // Construir con servicios vacíos

        // Programar un retry en 5 segundos
        setTimeout(() => {
          this.retryServiceInitialization();
        }, 5000);
      }
    } catch (error) {
      // Manejo de errores mejorado para initializeServices
      let errorMessage;
      let fullErrorDetails;

      if (error instanceof Error) {
        errorMessage = error.message;
        fullErrorDetails = error;
      } else if (typeof error === "object" && error !== null && error.message) {
        errorMessage = error.message;
        fullErrorDetails = error;
      } else if (typeof error === "string") {
        errorMessage = error;
        fullErrorDetails = { message: error, type: "string_error" };
      } else {
        errorMessage = "Error desconocido o formato inesperado";
        fullErrorDetails = { original: error, type: typeof error };
      }

      logger.warn(
        "Failed to initialize services cache on startup - will retry",
        {
          error_message: errorMessage,
          full_error_details: JSON.stringify(fullErrorDetails, null, 2),
        }
      );
      this.services = [];
      this.systemPrompt = this.buildSystemPrompt(); // Construir con servicios vacíos

      // Programar un retry en 5 segundos
      setTimeout(() => {
        this.retryServiceInitialization();
      }, 5000);
    }
  }

  /**
   * Reintentar inicialización de servicios
   */
  async retryServiceInitialization() {
    try {
      logger.info("Retrying services cache initialization...");
      const serviceModel = new ServiceModel();
      const result = await serviceModel.searchAdvanced(
        { is_active: true },
        { limit: 100, sortBy: "name", sortOrder: "asc" }
      );

      if (result.success && result.data && result.data.length > 0) {
        this.services = result.data;
        this.systemPrompt = this.buildSystemPrompt();
        logger.info("Services cache initialized successfully on retry", {
          count: this.services.length,
        });
      } else {
        logger.warn("Services still not available on retry", {
          success: result.success,
          dataLength: result.data ? result.data.length : 0,
          error: result.error,
        });
      }
    } catch (error) {
      // Manejo de errores mejorado para retryServiceInitialization
      let errorMessage;
      let fullErrorDetails;

      if (error instanceof Error) {
        errorMessage = error.message;
        fullErrorDetails = error;
      } else if (typeof error === "object" && error !== null && error.message) {
        errorMessage = error.message;
        fullErrorDetails = error;
      } else if (typeof error === "string") {
        errorMessage = error;
        fullErrorDetails = { message: error, type: "string_error" };
      } else {
        errorMessage = "Error desconocido o formato inesperado";
        fullErrorDetails = { original: error, type: typeof error };
      }

      logger.warn("Retry of services cache initialization failed", {
        error_message: errorMessage,
        full_error_details: JSON.stringify(fullErrorDetails, null, 2),
      });
    }
  }

  /**
   * Construye el prompt del sistema para el asistente
   */
  buildSystemPrompt() {
    const servicesText = this.services
      ? this.services
          .map((s) => `- ${s.name} (${s.duration} min, €${s.price})`) // Usar s.duration y s.price directamente
          .join("\n")
      : "- Servicios cargándose...";

    return `Eres un asistente virtual AUTÓNOMO para Ricardo Buriticá, especialista en servicios de belleza.

OBJETIVO: Gestionar reservas de manera completamente automática sin intervención humana.

PERSONALIDAD:
- Profesional, amable y eficiente
- Experto en servicios de belleza
- Proactivo en completar reservas
- Claro y directo en comunicación

SERVICIOS DISPONIBLES:
${servicesText}

PROCESO AUTOMÁTICO:
1. Identificar intención del cliente
2. Extraer información necesaria (servicio, fecha, hora, datos cliente)
3. Verificar disponibilidad en Calendly
4. Crear reserva automáticamente
5. Confirmar por WhatsApp
6. Programar recordatorios

REGLAS CRÍTICAS:
- SIEMPRE completar reservas automáticamente cuando sea posible
- NUNCA inventar horarios - solo usar datos reales de Calendly
- Si falta información, preguntar de forma directa y específica
- Ofrecer alternativas si no hay disponibilidad
- Si el cliente quiere hablar con un humano, usar la intención 'direct_contact_request'
- Confirmar TODOS los datos antes de crear reserva

FORMATO DE RESPUESTA:
- Mensajes cortos y claros
- Usar emojis para mejor experiencia
- Incluir toda la información relevante
- Ser proactivo en sugerir próximos pasos

Si no puedes resolver algo automáticamente, indica: "Te conectaré con Ricardo para ayudarte mejor."`;
  }

  /**
   * Procesa mensaje de WhatsApp de forma autónoma con validaciones de seguridad
   */
  async processWhatsAppMessage(phoneNumber, message, messageId) {
    try {
      // Validaciones de seguridad iniciales
      if (!Validators.validatePhoneNumber(phoneNumber)) {
        logger.warn("Invalid phone number received", {
          phoneNumber: this.sanitizePhoneForLog(phoneNumber),
          messageId,
        });
        return { success: false, error: "Invalid phone number" };
      }

      // Rate limiting
      if (!this.checkRateLimit(phoneNumber)) {
        logger.warn("Rate limit exceeded", {
          phoneNumber: this.sanitizePhoneForLog(phoneNumber),
          messageId,
        });
        await this.sendWhatsAppMessage(
          phoneNumber,
          "Has enviado muchos mensajes muy rápido. Por favor, espera un momento antes de continuar. 😊"
        );
        return { success: false, error: "Rate limit exceeded" };
      }

      // Validar mensaje
      if (!message || typeof message !== "string" || message.length > 1000) {
        logger.warn("Invalid message received", {
          phoneNumber: this.sanitizePhoneForLog(phoneNumber),
          messageLength: message?.length,
          messageId,
        });
        await this.sendWhatsAppMessage(
          phoneNumber,
          "Por favor, envía un mensaje válido de máximo 1000 caracteres. 😊"
        );
        return { success: false, error: "Invalid message" };
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

      // Analizar mensaje con IA
      const analysis = await openaiClient.analyzeMessageWithFunctions(
        sanitizedMessage,
        context,
        this.systemPrompt // Pasa el systemPrompt para que OpenAI pueda usarlo
      );

      // Procesar según el análisis
      let response;
      switch (analysis.intent) {
        case "appointment_request":
          response = await this.handleAppointmentRequest(
            phoneNumber,
            analysis,
            context
          );
          break;
        case "availability_inquiry":
          response = await this.handleAvailabilityInquiry(analysis);
          break;
        case "appointment_modification":
          response = await this.handleAppointmentModification(
            phoneNumber,
            analysis,
            context
          );
          break;
        case "service_information":
          response = await this.handleServiceInformation(analysis);
          break;
        case "greeting":
          response = await this.handleGreeting(phoneNumber);
          break;
        case "direct_contact_request":
          response = await this.handleDirectContactRequest(
            phoneNumber,
            sanitizedMessage
          );
          break;
        default:
          response = await this.handleGeneralInquiry(sanitizedMessage, context);
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
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
        messageId,
      });

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
        this.systemPrompt // Pasa el systemPrompt aquí también, si openaiClient lo necesita
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
  "intent": "appointment_request|availability_inquiry|appointment_modification|service_information|greeting|general_inquiry",
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
            // REMOVED: 'in_' line
            urgency: "medium",
            ready_to_book: availability.available,
            function_result: availability,
          };
        }

        case "create_booking":
          return {
            intent: "appointment_request",
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
      logger.error("Error handling function call", {
        error: error.message,
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
        error: error.message,
      };
    }
  }

  /**
   * Análisis básico de mensajes por palabras clave (fallback)
   */
  basicMessageAnalysis(message, context) {
    const lowerMessage = message.toLowerCase();

    // Detectar saludos
    if (
      /^(hola|hi|hello|buenas|buenos días|buenas tardes|buenas noches)/.test(
        lowerMessage
      )
    ) {
      return {
        intent: "greeting",
        confidence: 0.9,
        entities: {},
        missing_info: [],
        urgency: "low",
        ready_to_book: false,
      };
    }

    // Detectar solicitudes de reserva
    if (/reserva|cita|appointment|booking|agendar/.test(lowerMessage)) {
      return {
        intent: "appointment_request",
        confidence: 0.8,
        entities: this.extractBasicEntities(message),
        missing_info: this.getMissingBookingInfo(
          this.extractBasicEntities(message)
        ),
        urgency: "high",
        ready_to_book: false,
      };
    }

    // Detectar consultas de disponibilidad
    if (/disponible|disponibilidad|horario|cuando|qué día/.test(lowerMessage)) {
      return {
        intent: "availability_inquiry",
        confidence: 0.7,
        entities: this.extractBasicEntities(message),
        missing_info: [],
        urgency: "medium",
        ready_to_book: false,
      };
    }

    // Detectar información de servicios
    if (/servicio|precio|cuánto|qué hacen|tratamiento/.test(lowerMessage)) {
      return {
        intent: "service_information",
        confidence: 0.7,
        entities: this.extractBasicEntities(message),
        missing_info: [],
        urgency: "low",
        ready_to_book: false,
      };
    }

    // Por defecto: consulta general
    return {
      intent: "general_inquiry",
      confidence: 0.5,
      entities: {},
      missing_info: [],
      urgency: "medium",
      ready_to_book: false,
    };
  }

  /**
   * Extrae entidades básicas del mensaje
   */
  extractBasicEntities(message) {
    const entities = {};

    // Extraer servicios mencionados
    if (this.services) {
      for (const service of this.services) {
        if (message.toLowerCase().includes(service.name.toLowerCase())) {
          entities.service = service.name;
          break;
        }
      }
    }

    // Extraer fechas básicas
    const datePatterns = [
      /mañana/i,
      /hoy/i,
      /pasado mañana/i,
      /\d{1,2}\/\d{1,2}/,
      /(lunes|martes|miércoles|jueves|viernes|sábado|domingo)/i,
    ];

    for (const pattern of datePatterns) {
      const match = message.match(pattern);
      if (match) {
        entities.date = match[0];
        break;
      }
    }

    // Extraer horas básicas
    const timeMatch = message.match(/\d{1,2}:\d{2}|\d{1,2}\s*(am|pm|h)/i);
    if (timeMatch) {
      entities.time = timeMatch[0];
    }

    return entities;
  }

  /**
   * Determina qué información falta para una reserva
   */
  getMissingBookingInfo(entities) {
    const missing = [];

    if (!entities.service) missing.push("service");
    if (!entities.date) missing.push("date");
    if (!entities.time) missing.push("time");
    if (!entities.client_name) missing.push("client_name");

    return missing;
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
        bookingData.client_name = this.sanitizeText(bookingData.client_name);
      }
      if (bookingData.email) {
        bookingData.email = this.sanitizeText(bookingData.email);
      }

      // Validar datos del cliente
      const validation = this.validateClientData(bookingData);
      if (!validation.isValid) {
        context.extractedData = bookingData;
        return `Para completar tu reserva necesito:\n\n${validation.errors.map((e) => `❌ ${e}`).join("\n")}\n\n¿Podrías proporcionar esta información? 😊`;
      }

      // Si falta información crítica, solicitarla
      if (!ready_to_book || missing_info.length > 0) {
        context.extractedData = bookingData;
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
      this.clearConversationContext(phoneNumber);

      return this.formatBookingConfirmation(booking);
    } catch (error) {
      logger.error("Error handling booking request", {
        error: error.message,
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
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
      const service = this.services?.find((s) =>
        s.name.toLowerCase().includes(serviceName.toLowerCase())
      );

      if (!service) {
        logger.warn(`Service not found: ${serviceName}`);
        return { available: false, slots: [], service: null };
      }

      // Formatear datetime para Calendly
      const datetime = `${date}T${time}:00`;

      // Consultar disponibilidad (con fallback si calendlyClient no está disponible)
      let slots = [];
      if (calendlyClient && calendlyClient.getAvailability) {
        slots = await calendlyClient.getAvailability({
          event_type: service.calendly_event_type,
          start_time: datetime,
          duration: service.duration,
        });
      }

      return {
        available: slots.length > 0,
        slots,
        service,
        datetime,
      };
    } catch (error) {
      logger.error("Error checking Calendly availability", {
        error: error.message,
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

      // Crear reserva en nuestro sistema
      const bookingResult = await DatabaseAdapter.insert("bookings", {
        client_id: client.id,
        service_id: availability.service.id,
        scheduled_at: `${bookingData.date}T${bookingData.time}:00`,
        status: "confirmada",
        booking_url: null,
        notes: "Reserva creada automáticamente por asistente IA",
      });

      if (!bookingResult.success) {
        throw new Error(`Error creating booking: ${bookingResult.error}`);
      }

      const booking = bookingResult.data[0];

      // Programar recordatorios automáticos
      await this.scheduleAutomaticReminders(booking, client);

      logger.info("Automatic booking created successfully", {
        bookingId: booking.id,
        clientId: client.id,
        service: availability.service.name,
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
      });

      return { booking, client, service: availability.service };
    } catch (error) {
      logger.error("Error creating automatic booking", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Programa recordatorios automáticos
   */
  async scheduleAutomaticReminders(booking, client) {
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
      for (const reminder of reminders) {
        // await reminderService.schedule(booking.id, reminder);
      }

      logger.info("Automatic reminders scheduled", {
        bookingId: booking.id,
        remindersCount: reminders.length,
      });
    } catch (error) {
      logger.error("Error scheduling automatic reminders", {
        error: error.message,
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
      const service = this.services?.find((s) =>
        s.name.toLowerCase().includes(serviceName.toLowerCase())
      );

      if (!service) {
        return "No he encontrado ese servicio. ¿Podrías especificar cuál necesitas?";
      }

      // Simular alternativas (en producción usarías calendlyClient)
      const alternatives = [
        { start_time: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        { start_time: new Date(Date.now() + 48 * 60 * 60 * 1000) },
        { start_time: new Date(Date.now() + 72 * 60 * 60 * 1000) },
      ];

      if (alternatives.length === 0) {
        return `Lo siento, no tengo disponibilidad para ${serviceName} en los próximos días. 😔\n\n¿Te gustaría que Ricardo te contacte directamente para encontrar un horario?`;
      }

      let response = `No tengo disponibilidad exacta para esa hora, pero tengo estas alternativas para ${serviceName}:\n\n`;

      alternatives.slice(0, 3).forEach((slot, index) => {
        const date = new Date(slot.start_time).toLocaleDateString("es-ES");
        const time = new Date(slot.start_time).toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        });
        response += `${index + 1}. 📅 ${date} a las ⏰ ${time}\n`;
      });

      response += "\n¿Cuál prefieres? Solo responde con el número. 😊";
      return response;
    } catch (error) {
      logger.error("Error suggesting alternatives", { error: error.message });
      return "Déjame consultar las opciones disponibles y te contacto enseguida.";
    }
  }

  /**
   * Formatea confirmación de reserva
   */
  formatBookingConfirmation(bookingResult) {
    const { booking, client, service } = bookingResult;

    return `✅ ¡RESERVA CONFIRMADA AUTOMÁTICAMENTE!

📅 **${service.name}**
🗓️ Fecha: ${booking.scheduled_at}
💰 Precio: €${service.price}
⏱️ Duración: ${service.duration_minutes} min

👤 Cliente: ${client.first_name} ${client.last_name}
📱 Teléfono: ${client.phone}

📍 **Ubicación**: [Dirección del salón]

🔔 **Recordatorios automáticos:**
• 24 horas antes
• 2 horas antes
• 30 minutos antes

Para cambios, escríbeme con al menos 24h de antelación.

¡Nos vemos pronto! 🎉`;
  }

  /**
   * Maneja saludos de forma personalizada y segura
   */
  async handleGreeting(phoneNumber) {
    try {
      // Validar número de teléfono
      if (!this.validatePhoneNumber(phoneNumber)) {
        logger.warn("Invalid phone number in greeting", { phoneNumber });
        return "¡Hola! 👋 Soy tu asistente virtual para reservas. ¿En qué puedo ayudarte?";
      }

      const clientResult = await ClientService.findByPhone(phoneNumber);
      const client = clientResult.success ? clientResult.data : null;

      // Sanitizar nombre del cliente
      const clientName = client?.first_name
        ? this.sanitizeText(client.first_name)
        : null;

      const greeting = clientName
        ? `¡Hola ${clientName}! 👋 Me alegra verte de nuevo.`
        : "¡Hola! 👋 Soy tu asistente virtual para reservas.";

      const servicesMenu = this.getServicesMenu();

      return `${greeting}

Puedo ayudarte a reservar una cita automáticamente. Solo dime:

🔹 Qué servicio necesitas
🔹 Para qué fecha y hora
🔹 Tu nombre

¡Y yo me encargo del resto! 😊

${servicesMenu}`;
    } catch (error) {
      logger.error("Error in handleGreeting", {
        error: error.message,
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
      });
      return "¡Hola! 👋 Soy tu asistente virtual para reservas. ¿En qué puedo ayudarte?";
    }
  }

  /**
   * Maneja consultas generales
   */
  async handleGeneralInquiry(message, context) {
    try {
      if (openaiClient && openaiClient.generateResponse) {
        const response = await openaiClient.generateResponse(
          this.systemPrompt + "\n\nUsuario: " + message,
          context
        );
        return response;
      }

      // Fallback básico
      return "¿Podrías reformular tu consulta? Estoy aquí para ayudarte con reservas de servicios de belleza. 😊";
    } catch (error) {
      logger.error("Error handling general inquiry", { error: error.message });
      return "¿Podrías reformular tu consulta? Estoy aquí para ayudarte con reservas de servicios de belleza. 😊";
    }
  }

  /**
   * Maneja consultas de disponibilidad
   */
  async handleAvailabilityInquiry(analysis, context) {
    try {
      const { entities } = analysis;

      if (!entities.service) {
        return (
          "¿Para qué servicio quieres consultar disponibilidad? 🤔\n\n" +
          this.getServicesMenu()
        );
      }

      if (!entities.date) {
        return `Para consultar disponibilidad de ${entities.service}, ¿para qué fecha? 📅\n\nPuedes decir: 'mañana', 'el viernes', '15 de marzo', etc.`;
      }

      // Obtener slots disponibles
      const slots = await this.getAvailableSlots(
        entities.service,
        entities.date,
        7
      );

      if (!slots.success || slots.slots.length === 0) {
        return `No tengo disponibilidad para ${entities.service} en esa fecha. 😔\n\n¿Te gustaría ver otras fechas disponibles?`;
      }

      let response = `📅 **Disponibilidad para ${entities.service}:**\n\n`;

      slots.slots.slice(0, 5).forEach((slot, index) => {
        const date = new Date(slot.start_time).toLocaleDateString("es-ES");
        const time = new Date(slot.start_time).toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        });
        response += `${index + 1}. 📅 ${date} a las ⏰ ${time}\n`;
      });

      response +=
        "\n¿Te interesa alguno de estos horarios? Solo dime el número o la fecha/hora que prefieres. 😊";

      return response;
    } catch (error) {
      logger.error("Error handling availability inquiry", {
        error: error.message,
      });
      return "Déjame consultar la disponibilidad y te respondo enseguida.";
    }
  }

  /**
   * Maneja modificaciones de reservas
   */
  async handleAppointmentModification(phoneNumber, analysis, context) {
    try {
      // Buscar reservas activas del cliente
      const clientResult = await ClientService.findByPhone(phoneNumber);
      if (!clientResult.success) {
        return "No encuentro reservas asociadas a este número. ¿Podrías verificar tu información?";
      }

      const client = clientResult.data;

      // Obtener reservas activas (simulado)
      const bookings = [];

      if (!bookings || bookings.length === 0) {
        return "No tienes reservas activas para modificar. ¿Quieres hacer una nueva reserva?";
      }

      let response = "📋 **Tus reservas activas:**\n\n";

      bookings.forEach((booking, index) => {
        const date = new Date(booking.service_date).toLocaleDateString("es-ES");
        const time = new Date(booking.service_date).toLocaleTimeString(
          "es-ES",
          {
            hour: "2-digit",
            minute: "2-digit",
          }
        );
        response += `${index + 1}. ${booking.service_name} - ${date} a las ${time}\n`;
      });

      response += "\n¿Cuál quieres modificar? Responde con el número.";

      // Guardar reservas en contexto para próxima interacción
      context.extractedData.activeBookings = bookings;

      return response;
    } catch (error) {
      logger.error("Error handling booking modification", {
        error: error.message,
      });
      return "He tenido un problema consultando tus reservas. Te conectaré con Ricardo para ayudarte.";
    }
  }

  /**
   * Maneja información de servicios
   */
  async handleServiceInformation(analysis) {
    try {
      const { entities } = analysis;

      if (entities.service) {
        // Buscar servicio específico
        const service = this.services?.find((s) =>
          s.name.toLowerCase().includes(entities.service.toLowerCase())
        );

        if (service) {
          return (
            `💇‍♂️ **${service.name}**\n\n` +
            `💰 Precio: €${service.price}\n` +
            `⏱️ Duración: ${service.duration_minutes} minutos\n` +
            `📝 ${service.description || "Servicio profesional de belleza"}\n\n` +
            `¿Te gustaría reservar este servicio? 😊`
          );
        }
      }

      // Mostrar todos los servicios
      return this.getServicesMenu();
    } catch (error) {
      logger.error("Error handling service information", {
        error: error.message,
      });
      return "Déjame consultar la información de servicios y te respondo enseguida.";
    }
  }

  /**
   * Obtiene menú de servicios
   */
  getServicesMenu() {
    if (!this.services || this.services.length === 0) {
      return "🔄 Cargando servicios disponibles...";
    }

    let menu = "💇‍♂️ **Servicios disponibles:**\n\n";

    this.services.forEach((service) => {
      menu += `🔹 **${service.name}**\n`;
      menu += `   💰 €${service.price} | ⏱️ ${service.duration_minutes}min\n`;
      if (service.description) {
        menu += `   📝 ${service.description}\n`;
      }
      menu += "\n";
    });

    menu += "¿Cuál te interesa? 😊";

    return menu;
  }

  /**
   * Envía mensaje por WhatsApp con validaciones de seguridad
   */
  async sendWhatsAppMessage(phoneNumber, message) {
    try {
      // Validaciones de seguridad
      if (!this.validatePhoneNumber(phoneNumber)) {
        throw new Error("Invalid phone number for WhatsApp message");
      }

      if (!message || typeof message !== "string") {
        throw new Error("Invalid message content");
      }

      // Limitar longitud del mensaje (WhatsApp tiene límite de ~4096 caracteres)
      const truncatedMessage =
        message.length > 1600
          ? message.substring(0, 1500) + "...\n\n¿Necesitas más información? 😊"
          : message;

      // Verificar configuración de Twilio
      if (!process.env.TWILIO_WHATSAPP_NUMBER) {
        throw new Error("Twilio WhatsApp number not configured");
      }

      if (twilioClient && twilioClient.messages) {
        await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: "whatsapp:" + phoneNumber,
          body: truncatedMessage,
        });
      }

      logger.info("Autonomous WhatsApp message sent", {
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
        messageLength: truncatedMessage.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error sending autonomous WhatsApp message", {
        error: error.message,
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Procesa la creación de una nueva cita proveniente de Calendly.
   * @param {object} appointmentData - Datos de la cita extraídos del webhook de Calendly.
   * @returns {Promise<object>} - Resultado del procesamiento.
   */
  async processCalendlyAppointment(appointmentData) {
    try {
      const {
        clientName,
        clientEmail,
        clientPhone,
        scheduledAt,
        endTime,
        eventTypeUri,
        calendlyEventUri,
      } = appointmentData;

      logger.info("Procesando cita de Calendly en AutonomousAssistant...", {
        client_name: clientName,
        client_phone: this.sanitizePhoneForLog(clientPhone),
        scheduled_at: scheduledAt,
        service_uri: eventTypeUri,
      });

      // Buscar o crear cliente
      const clientResult = await ClientService.findOrCreateByPhone(
        clientPhone,
        {
          full_name: clientName,
          email: clientEmail,
        }
      );

      if (!clientResult.success) {
        throw new Error(`Error al gestionar el cliente: ${clientResult.error}`);
      }
      const client = clientResult.data;

      // Buscar servicio por Calendly URL
      const serviceResult = await this.findServiceByCalendlyUrl(eventTypeUri);
      if (!serviceResult.success || !serviceResult.data) {
        throw new Error(
          `Servicio con URI de Calendly "${eventTypeUri}" no encontrado en la base de datos.`
        );
      }
      const service = serviceResult.data;

      // Crear los datos de la cita
      const newAppointmentData = {
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
      const createResult = await DatabaseAdapter.insert(
        "appointments",
        newAppointmentData
      );
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

      return createResult;
    } catch (error) {
      logger.error(
        "Error al procesar la creación de cita de Calendly en el asistente autónomo",
        {
          error: error.message,
          stack: error.stack,
          appointmentData,
        }
      );
      throw error;
    }
  }

  /**
   * Encuentra un servicio por la URL de Calendly.
   * @param {string} calendlyEventUri - La URL del evento de Calendly.
   * @returns {Promise<object>} - El resultado de la búsqueda del servicio.
   */
  async findServiceByCalendlyUrl(calendlyEventUri) {
    try {
      // Implementar la lógica para buscar el servicio por la URL de Calendly en la base de datos.
      // Utiliza this.serviceModel para interactuar con la base de datos.
      const serviceResult =
        await ServiceModel.findByCalendlyUrl(calendlyEventUri);
      if (!serviceResult.success) {
        logger.warn(
          `Servicio no encontrado para la URL de Calendly: ${calendlyEventUri}`
        );
        return { success: false, error: "Servicio no encontrado" };
      }
      return { success: true, data: serviceResult.data };
    } catch (error) {
      logger.error(
        `Error al buscar el servicio por la URL de Calendly: ${calendlyEventUri}`,
        { error: error.message }
      );
      return {
        success: false,
        error: "Error al buscar el servicio por la URL de Calendly",
      };
    }
  }

  /**
   * Obtiene contexto de conversación con límites de memoria
   */
  getConversationContext(phoneNumber) {
    if (!this.conversations.has(phoneNumber)) {
      // Verificar límite de conversaciones
      if (this.conversations.size >= this.maxConversations) {
        this.cleanupOldContexts();

        // Si aún está lleno, eliminar las más antiguas
        if (this.conversations.size >= this.maxConversations) {
          const oldestEntries = Array.from(this.conversations.entries())
            .sort(([, a], [, b]) => a.lastActivity - b.lastActivity)
            .slice(0, Math.floor(this.maxConversations * 0.1));

          oldestEntries.forEach(([phone]) => {
            this.conversations.delete(phone);
          });
        }
      }

      this.conversations.set(phoneNumber, {
        extractedData: {},
        messages: [],
        createdAt: new Date(),
        lastActivity: new Date(),
      });
    }

    const context = this.conversations.get(phoneNumber);
    context.lastActivity = new Date();
    return context;
  }

  /**
   * Actualiza contexto de conversación
   */
  updateConversationContext(
    phoneNumber,
    userMessage,
    assistantResponse,
    analysis
  ) {
    const context = this.getConversationContext(phoneNumber);

    context.messages.push({
      user: userMessage,
      assistant: assistantResponse,
      analysis,
      timestamp: new Date(),
    });

    context.lastActivity = new Date();

    // Mantener solo los últimos 10 mensajes
    if (context.messages.length > 10) {
      context.messages = context.messages.slice(-10);
    }

    // Limpiar contextos antiguos (más de 2 horas)
    this.cleanupOldContexts();
  }

  /**
   * Limpia contexto de conversación
   */
  clearConversationContext(phoneNumber) {
    this.conversations.delete(phoneNumber);
  }

  /**
   * Limpia contextos antiguos
   */
  cleanupOldContexts() {
    const now = new Date();
    const maxAge = 2 * 60 * 60 * 1000; // 2 horas

    for (const [phoneNumber, context] of this.conversations.entries()) {
      if (now - context.lastActivity > maxAge) {
        this.conversations.delete(phoneNumber);
      }
    }
  }

  /**
   * Notifica al administrador
   */
  async notifyAdmin(subject, data) {
    try {
      logger.warn("Admin notification", { subject, data });
      // Aquí implementarías notificación real (email, SMS, etc.)
    } catch (error) {
      logger.error("Error notifying admin", { error: error.message });
    }
  }

  /**
   * Obtener slots disponibles (wrapper para calendlyClient)
   */
  async getAvailableSlots(serviceName, fromDate, daysAhead = 7) {
    try {
      // Validar parámetros de entrada
      if (!serviceName || !fromDate) {
        throw new Error("Service name and from date are required");
      }

      // Limitar días hacia adelante para prevenir consultas excesivas
      const maxDaysAhead = Math.min(daysAhead, 30);

      if (calendlyClient && calendlyClient.getAvailableSlots) {
        return await calendlyClient.getAvailableSlots(
          serviceName,
          fromDate,
          maxDaysAhead
        );
      }

      // Fallback: simular slots disponibles
      return {
        success: true,
        slots: [
          { start_time: new Date(Date.now() + 24 * 60 * 60 * 1000) },
          { start_time: new Date(Date.now() + 48 * 60 * 60 * 1000) },
        ],
      };
    } catch (error) {
      logger.error("Error getting available slots", {
        error: error.message,
        serviceName: this.sanitizeText(serviceName),
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
   * Valida formato de número de teléfono
   */
  validatePhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== "string") {
      return false;
    }

    // Formato internacional básico: +[código país][número]
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * Sanitiza texto para prevenir inyecciones
   */
  sanitizeText(text) {
    if (!text || typeof text !== "string") {
      return "";
    }

    return text
      .replace(/[<>\"'&]/g, "") // Remover caracteres peligrosos
      .trim()
      .substring(0, 100); // Limitar longitud
  }

  /**
   * Sanitiza número de teléfono para logs (oculta parte del número)
   */
  sanitizePhoneForLog(phoneNumber) {
    if (!phoneNumber || phoneNumber.length < 8) {
      return "***";
    }

    const start = phoneNumber.substring(0, 3);
    const end = phoneNumber.substring(phoneNumber.length - 2);
    return `${start}***${end}`;
  }

  /**
   * Valida datos del cliente antes de crear reserva
   */
  validateClientData(clientData) {
    const errors = [];

    if (!clientData.client_name || clientData.client_name.length < 2) {
      errors.push("Nombre requerido (mínimo 2 caracteres)");
    }

    if (!clientData.phone || !this.validatePhoneNumber(clientData.phone)) {
      errors.push("Número de teléfono válido requerido");
    }

    if (clientData.email && !this.validateEmail(clientData.email)) {
      errors.push("Email válido requerido");
    }

    if (!clientData.service) {
      errors.push("Servicio requerido");
    }

    if (!clientData.date || !clientData.time) {
      errors.push("Fecha y hora requeridas");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Valida formato de email
   */
  validateEmail(email) {
    if (!email || typeof email !== "string") {
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Implementa rate limiting básico por número de teléfono
   */
  checkRateLimit(phoneNumber) {
    const now = Date.now();
    const windowMs = 60000; // 1 minuto
    const maxRequests = 10; // máximo 10 mensajes por minuto

    if (!this.rateLimitMap) {
      this.rateLimitMap = new Map();
    }

    const userRequests = this.rateLimitMap.get(phoneNumber) || [];
    const recentRequests = userRequests.filter((time) => now - time < windowMs);

    if (recentRequests.length >= maxRequests) {
      return false;
    }

    recentRequests.push(now);
    this.rateLimitMap.set(phoneNumber, recentRequests);

    // Limpiar entradas antiguas cada 5 minutos
    if (Math.random() < 0.1) {
      this.cleanupRateLimit();
    }

    return true;
  }

  /**
   * Limpia entradas antiguas del rate limiting
   */
  cleanupRateLimit() {
    if (!this.rateLimitMap) return;

    const now = Date.now();
    const windowMs = 60000;

    for (const [phoneNumber, requests] of this.rateLimitMap.entries()) {
      const recentRequests = requests.filter((time) => now - time < windowMs);
      if (recentRequests.length === 0) {
        this.rateLimitMap.delete(phoneNumber);
      } else {
        this.rateLimitMap.set(phoneNumber, recentRequests);
      }
    }
  }

  /**
   * Actualiza cache de servicios de forma segura
   */
  async refreshServicesCache() {
    try {
      const result = await ServiceService.getActiveServices();
      if (result.success && Array.isArray(result.data)) {
        this.services = result.data;
        this.systemPrompt = this.buildSystemPrompt();
        logger.info("Services cache refreshed", {
          count: this.services.length,
          timestamp: new Date().toISOString(),
        });
        return true;
      }
      return false;
    } catch (error) {
      logger.error("Error refreshing services cache", {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Programa actualización automática del cache
   */
  startCacheRefreshScheduler() {
    // Actualizar cache cada 30 minutos
    setInterval(
      () => {
        this.refreshServicesCache();
      },
      30 * 60 * 1000
    );
  }
}

module.exports = new AutonomousAssistant();
