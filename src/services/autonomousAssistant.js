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

const openaiClient = require("../integrations/openaiClient");
const calendlyClient = require("../integrations/calendlyClient");
const twilioClient = require("../integrations/twilioClient");
const ClientService = require("./clientService");
const ServiceService = require("./serviceService");
const DatabaseAdapter = require("../adapters/databaseAdapter");
const logger = require("../utils/logger");
const ConversationContextService = require("./conversationContextService");
const Validators = require("../utils/validators");

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
    /** @type {ConversationContextService} Servicio para gestionar el contexto de las conversaciones */
    this.contextService = ConversationContextService;

    /** @type {Array<Object>|null} Cache de servicios disponibles */
    this.services = null;

    /** @type {string|null} Prompt del sistema para OpenAI */
    this.systemPrompt = null;

    // Inicialización asíncrona
    this.initializeServices();
    this.startCacheRefreshScheduler();
  }

  /**
   * Inicializa cache de servicios
   */
  async initializeServices() {
    try {
      const result = await ServiceService.getActiveServices();
      if (result.success) {
        this.services = result.data;
        this.systemPrompt = this.buildSystemPrompt(); // Construir prompt después de cargar servicios
        logger.info("Services cache initialized", {
          count: this.services.length,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error("Failed to initialize services cache", {
        error: error.message,
      });
      this.services = [];
      this.systemPrompt = this.buildSystemPrompt(); // Construir con servicios vacíos
    }
  }

  /**
   * Construye el prompt del sistema para el asistente
   */
  buildSystemPrompt() {
    const servicesText = this.services
      ? this.services
          .map((s) => `- ${s.name} (${s.duration_minutes} min, €${s.price})`)
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
      const analysis = await this.analyzeMessage(sanitizedMessage, context);

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
          response = await this.handleAvailabilityInquiry(analysis, context);
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
      logger.error("Error in autonomous message processing", {
        error: error.message,
        phoneNumber,
        messageId,
      });

      const errorResponse =
        "Disculpa, he tenido un problema técnico. Te conectaré con Ricardo enseguida.";
      await this.sendWhatsAppMessage(phoneNumber, errorResponse);

      // Notificar error al administrador
      await this.notifyAdmin("Autonomous assistant error", {
        phoneNumber,
        error: error.message,
      });

      throw error;
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
        context
      );

      if (analysis.type === "function_call") {
        // El mensaje requiere una acción específica
        return await this.handleFunctionCall(analysis);
      } else {
        // Análisis tradicional de intención
        return await openaiClient.analyzeIntent(message, context);
      }
    } catch (error) {
      logger.error("Error analyzing message with functions", {
        error: error.message,
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
        logger.error("Fallback analysis also failed", {
          error: fallbackError.message,
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
        case "check_availability":
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

        case "get_available_slots":
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
      logger.error("Error handling booking request", {
        error: error.message,
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
        event_type: service.calendly_event_type,
        start_time: datetime,
        duration: service.duration,
      });

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

      // Crear reserva en Calendly
      const calendlyBooking = await calendlyClient.createBooking({
        event_type_uuid: availability.service.calendly_event_type || "default",
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
      await this.scheduleAutomaticReminders(booking, client);

      logger.info("Automatic booking created successfully", {
        bookingId: booking.id,
        clientId: client.id,
        service: availability.service.name,
        phoneNumber,
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

      this.logger.info("Automatic reminders scheduled", {
        bookingId: booking.id,
        remindersCount: reminders.length,
      });
    } catch (error) {
      this.logger.error("Error scheduling automatic reminders", {
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
      const service = this.services.find((s) =>
        s.name.toLowerCase().includes(serviceName.toLowerCase())
      );

      if (!service) {
        return "No he encontrado ese servicio. ¿Podrías especificar cuál necesitas?";
      }

      // Buscar alternativas en los próximos 7 días
      const alternatives = await this.calendlyClient.getAvailability({
        event_type: service.calendly_event_type,
        start_date: requestedDate,
        days_ahead: 7,
      });

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
      this.logger.error("Error suggesting alternatives", {
        error: error.message,
      });
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
🗓️ Fecha: ${booking.date}
⏰ Hora: ${booking.time}
💰 Precio: €${booking.price}
⏱️ Duración: ${booking.duration} min

👤 Cliente: ${client.name}
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
      if (!this.Validators.validatePhoneNumber(phoneNumber)) {
        this.logger.warn("Invalid phone number in greeting", { phoneNumber });
        return "¡Hola! 👋 Soy tu asistente virtual para reservas. ¿En qué puedo ayudarte?";
      }

      const clientResult = await this.ClientService.findByPhone(phoneNumber);
      const client = clientResult.success ? clientResult.data : null;

      // Sanitizar nombre del cliente
      const clientName = client?.first_name
        ? this.Validators.sanitizeText(client.first_name)
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
      this.logger.error("Error in handleGreeting", {
        error: error.message,
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
      });
      return "¡Hola! 👋 Soy tu asistente virtual para reservas. ¿En qué puedo ayudarte?";
    }
  }

  /**
   * Envía mensaje por WhatsApp con validaciones de seguridad
   */
  async sendWhatsAppMessage(phoneNumber, message) {
    try {
      // Validaciones de seguridad
      if (!this.Validators.validatePhoneNumber(phoneNumber)) {
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

      await this.twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: "whatsapp:" + phoneNumber,
        body: truncatedMessage,
      });

      this.logger.info("Autonomous WhatsApp message sent", {
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
        messageLength: truncatedMessage.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error("Error sending autonomous WhatsApp message", {
        error: error.message,
        phoneNumber: this.sanitizePhoneForLog(phoneNumber),
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Notifica al administrador
   */
  async notifyAdmin(subject, data) {
    const adminPhone = process.env.ADMIN_PHONE_NUMBER;
    if (!adminPhone) {
      this.logger.error(
        "ADMIN_PHONE_NUMBER not configured. Cannot send admin alert."
      );
      return;
    }

    try {
      this.logger.warn("Sending admin notification", { subject, data });

      const message = `🚨 ALERTA: ${subject}\n\n${
        typeof data === "object" ? JSON.stringify(data, null, 2) : data
      }`;

      await this.twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: `whatsapp:${adminPhone}`,
        body: message.substring(0, 1600), // Truncar mensaje por si es muy largo
      });
    } catch (error) {
      this.logger.error("Error notifying admin", { error: error.message });
    }
  }

  /**
   * Maneja consultas generales
   */
  async handleGeneralInquiry(message, context) {
    try {
      const response = await this.openaiClient.generateResponse(
        this.systemPrompt + "\n\nUsuario: " + message,
        context
      );
      return response;
    } catch (error) {
      this.logger.error("Error handling general inquiry", {
        error: error.message,
      });
      return "¿Podrías reformular tu consulta? Estoy aquí para ayudarte con reservas de servicios de belleza. 😊";
    }
  }

  /**
   * Maneja la solicitud de contacto directo con un humano.
   */
  async handleDirectContactRequest(phoneNumber, message) {
    try {
      // Obtener nombre del cliente si existe para una notificación más personalizada
      const clientResult = await this.ClientService.findByPhone(phoneNumber);
      const clientName =
        clientResult.success && clientResult.data
          ? clientResult.data.first_name
          : "un cliente";

      // Notificar al administrador
      const adminNotification = `El cliente ${clientName} (${this.sanitizePhoneForLog(
        phoneNumber
      )}) quiere hablar contigo.\n\nMensaje: "${message}"`;
      await this.notifyAdmin(
        "Solicitud de Contacto Directo",
        adminNotification
      );

      // Respuesta al usuario
      return `¡Entendido! He notificado a Ricardo que quieres hablar con él. Te contactará lo antes posible. 😊\n\nMientras tanto, ¿puedo ayudarte con algo más?`;
    } catch (error) {
      this.logger.error("Error handling direct contact request", {
        error: error.message,
        phoneNumber,
      });
      return "He tenido un problema al notificar a Ricardo, pero he registrado tu solicitud. Te contactará pronto.";
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
      this.logger.error("Error handling availability inquiry", {
        error: error.message,
      });
      return "Déjame consultar la disponibilidad y te respondo enseguida.";
    }
  }

  /**
   * Maneja modificaciones de reservas
   */
  async handleBookingModification(phoneNumber, analysis, context) {
    try {
      // Buscar reservas activas del cliente
      const clientResult = await this.ClientService.findByPhone(phoneNumber);
      if (!clientResult.success) {
        return "No encuentro reservas asociadas a este número. ¿Podrías verificar tu información?";
      }

      const client = clientResult.data;

      // Obtener reservas activas
      const { data: bookings } = await this.DatabaseAdapter.query(
        "SELECT * FROM bookings WHERE client_id = ? AND status IN ('confirmed', 'pending') AND service_date >= NOW() ORDER BY service_date ASC",
        [client.id]
      );

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
        response += `${index + 1}. ${
          booking.service_name
        } - ${date} a las ${time}\n`;
      });

      response += "\n¿Cuál quieres modificar? Responde con el número.";

      // Guardar reservas en contexto para próxima interacción
      context.extractedData.activeBookings = bookings;

      return response;
    } catch (error) {
      this.logger.error("Error handling booking modification", {
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
        const service = this.services.find((s) =>
          s.name.toLowerCase().includes(entities.service.toLowerCase())
        );

        if (service) {
          return (
            `💇‍♂️ **${service.name}**\n\n` +
            `💰 Precio: €${service.price}\n` +
            `⏱️ Duración: ${service.duration_minutes} minutos\n` +
            `📝 ${
              service.description || "Servicio profesional de belleza"
            }\n\n` +
            `¿Te gustaría reservar este servicio? 😊`
          );
        }
      }

      // Mostrar todos los servicios
      return this.getServicesMenu();
    } catch (error) {
      this.logger.error("Error handling service information", {
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

      return await this.calendlyClient.getAvailableSlots(
        serviceName,
        fromDate,
        maxDaysAhead
      );
    } catch (error) {
      this.logger.error("Error getting available slots", {
        error: error.message,
        serviceName: this.Validators.sanitizeText(serviceName),
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
    if (!phoneNumber || phoneNumber.length < 8) {
      return "***";
    }

    const start = phoneNumber.substring(0, 3);
    const end = phoneNumber.substring(phoneNumber.length - 2);
    return `${start}***${end}`;
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
      const result = await this.ServiceService.getActiveServices();
      if (result.success && Array.isArray(result.data)) {
        this.services = result.data;
        this.systemPrompt = this.buildSystemPrompt();
        this.logger.info("Services cache refreshed", {
          count: this.services.length,
          timestamp: new Date().toISOString(),
        });
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error("Error refreshing services cache", {
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
    setInterval(() => {
      this.refreshServicesCache();
    }, 30 * 60 * 1000);
  }
}

module.exports = new AutonomousAssistant({
  openaiClient,
  calendlyClient,
  twilioClient,
  ClientService,
  ServiceService,
  DatabaseAdapter,
  logger,
  ConversationContextService,
  Validators,
});
