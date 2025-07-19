// src/services/responseGenerationService.js
// Servicio para generación inteligente de respuestas

const openaiClient = require("../integrations/openaiClient");
const logger = require("../utils/logger");

class ResponseGenerationService {
  constructor() {
    this.responseTemplates = {
      greeting: [
        "¡Hola! Soy el asistente virtual de Ricardo Buriticá Beauty Consulting. ¿En qué puedo ayudarte hoy? 😊",
        "¡Bienvenid@! Estoy aquí para ayudarte con tus reservas de servicios de belleza. ¿Qué necesitas?",
        "¡Hola! ¿Te gustaría reservar algún servicio o tienes alguna consulta? Estoy aquí para ayudarte ✨",
      ],

      booking_confirmation: [
        "¡Perfecto! He confirmado tu reserva para {service} el {date} a las {time}. Te enviaré un recordatorio 24h antes. ¿Necesitas algo más?",
        "¡Reserva confirmada! {service} - {date} a las {time}. ¡Nos vemos pronto! 💫",
        "¡Listo! Tu cita para {service} está confirmada el {date} a las {time}. ¡Esperamos verte! ✨",
      ],

      missing_info: [
        "Para completar tu reserva necesito que me proporciones: {missing_fields}. ¿Puedes ayudarme con esa información?",
        "Casi listo! Solo me falta: {missing_fields}. ¿Podrías proporcionármelo?",
        "Perfecto, solo necesito algunos datos más: {missing_fields} para confirmar tu reserva.",
      ],

      no_availability: [
        "Lo siento, no tengo disponibilidad para {service} el {date} a las {time}. ¿Te gustaría ver otras opciones disponibles?",
        "Esa fecha y hora no está disponible para {service}. ¿Prefieres que te muestre horarios alternativos?",
        "No hay disponibilidad en ese horario. ¿Te parece bien si te sugiero otras opciones para {service}?",
      ],

      service_info: [
        "Te cuento sobre nuestros servicios de {service}: {description}. El precio es {price}€ y la duración aproximada es {duration}. ¿Te gustaría reservar?",
        "Nuestro servicio de {service} incluye: {description}. Cuesta {price}€ y dura {duration}. ¿Quieres que te reserve una cita?",
        "El {service} que ofrecemos: {description}. Precio: {price}€, Duración: {duration}. ¿Te interesa reservar?",
      ],

      error: [
        "Disculpa, he tenido un pequeño problema técnico. ¿Podrías repetir tu solicitud? 😊",
        "Lo siento, algo no ha funcionado bien. ¿Puedes intentarlo de nuevo?",
        "Ups, parece que hubo un error. ¿Podrías volver a escribirme lo que necesitas?",
      ],

      direct_contact: [
        "Entiendo que prefieres hablar directamente con Ricardo. Te voy a conectar con él enseguida. Mientras tanto, ¿hay algo urgente que pueda ayudarte?",
        "Por supuesto, voy a notificar a Ricardo para que se ponga en contacto contigo. ¿Es algo urgente?",
        "Perfecto, le diré a Ricardo que quieres hablar con él. ¿Puedes contarme brevemente de qué se trata?",
      ],

      gdpr_consent: [
        "Gracias por tu consentimiento. Ahora puedo ayudarte con tus reservas y consultas. ¿En qué puedo asistirte?",
        "Perfecto, ya puedo procesar tus datos para brindarte el mejor servicio. ¿Qué necesitas hoy?",
        "Consentimiento registrado. ¡Ahora sí puedo ayudarte completamente! ¿Qué servicio te interesa?",
      ],

      gdpr_withdrawal: [
        "Entiendo. He registrado la retirada de tu consentimiento. No procesaré más tus datos personales. Si cambias de opinión, puedes escribir 'ACEPTO' en cualquier momento.",
        "Consentimiento retirado correctamente. Tus datos no serán procesados. Gracias por habernos contactado.",
        "He eliminado tu consentimiento. Si en el futuro quieres usar nuestros servicios, solo escribe 'ACEPTO' para dar tu consentimiento nuevamente.",
      ],
    };

    this.personalityTraits = {
      tone: "friendly",
      formality: "casual",
      enthusiasm: "moderate",
      helpfulness: "high",
      patience: "high",
    };

    this.contextualFactors = {
      timeOfDay: this.getTimeOfDay(),
      dayOfWeek: this.getDayOfWeek(),
      season: this.getSeason(),
    };

    logger.info("Response Generation Service initialized", {
      templates: Object.keys(this.responseTemplates).length,
      personalityTraits: Object.keys(this.personalityTraits).length,
    });
  }

  /**
   * Generar respuesta inteligente basada en análisis
   */
  async generateResponse(analysis, context = {}, availableServices = []) {
    try {
      // Determinar tipo de respuesta necesaria
      const responseType = this.determineResponseType(analysis);

      // Generar respuesta base
      let response = await this.generateBaseResponse(
        responseType,
        analysis,
        context
      );

      // Personalizar respuesta
      response = this.personalizeResponse(response, context);

      // Agregar información contextual si es necesario
      response = this.addContextualInfo(response, analysis, availableServices);

      // Validar y optimizar longitud
      response = this.optimizeResponseLength(response);

      logger.debug("Response generated", {
        responseType,
        length: response.length,
        intent: analysis.intent,
      });

      return response;
    } catch (error) {
      logger.error("Error generating response", {
        error: error.message,
        intent: analysis.intent,
      });

      return this.getFallbackResponse();
    }
  }

  /**
   * Determinar tipo de respuesta necesaria
   */
  determineResponseType(analysis) {
    const { intent, confidence, ready_to_book, entities } = analysis;

    // Respuestas específicas para RGPD
    if (intent === "gdpr_request") {
      if (entities.gdpr_action === "consent_required") {
        return "gdpr_consent_request";
      } else if (entities.gdpr_action === "consent_granted") {
        return "gdpr_consent_confirmed";
      } else if (entities.gdpr_action === "consent_withdrawn") {
        return "gdpr_withdrawal_confirmed";
      }
    }

    // Respuestas para reservas
    if (intent === "appointment_request") {
      if (ready_to_book) {
        return "booking_ready";
      } else if (analysis.missing_info.length > 0) {
        return "booking_missing_info";
      }
    }

    // Respuestas para disponibilidad
    if (intent === "availability_inquiry") {
      return "availability_check";
    }

    // Respuestas para información de servicios
    if (intent === "service_information") {
      return "service_info";
    }

    // Respuestas para contacto directo
    if (intent === "direct_contact_request") {
      return "direct_contact";
    }

    // Respuestas para saludos
    if (intent === "greeting") {
      return "greeting";
    }

    // Respuestas para quejas
    if (intent === "complaint") {
      return "complaint_handling";
    }

    // Respuestas para elogios
    if (intent === "compliment") {
      return "compliment_response";
    }

    // Respuesta general
    return "general_inquiry";
  }

  /**
   * Generar respuesta base
   */
  async generateBaseResponse(responseType, analysis, context) {
    switch (responseType) {
      case "gdpr_consent_request":
        return (
          analysis.suggested_response || this.getRandomTemplate("gdpr_consent")
        );

      case "gdpr_consent_confirmed":
        return this.getRandomTemplate("gdpr_consent");

      case "gdpr_withdrawal_confirmed":
        return this.getRandomTemplate("gdpr_withdrawal");

      case "greeting":
        return this.generateGreetingResponse(context);

      case "booking_ready":
        return await this.generateBookingReadyResponse(analysis, context);

      case "booking_missing_info":
        return this.generateMissingInfoResponse(analysis);

      case "availability_check":
        return await this.generateAvailabilityResponse(analysis, context);

      case "service_info":
        return await this.generateServiceInfoResponse(analysis, context);

      case "direct_contact":
        return this.generateDirectContactResponse(analysis, context);

      case "complaint_handling":
        return await this.generateComplaintResponse(analysis, context);

      case "compliment_response":
        return this.generateComplimentResponse(analysis, context);

      default:
        return await this.generateGeneralResponse(analysis, context);
    }
  }

  /**
   * Generar respuesta de saludo personalizada
   */
  generateGreetingResponse(context) {
    const timeOfDay = this.getTimeOfDay();
    const isReturningUser =
      context.previousMessages && context.previousMessages.length > 0;

    let greeting;
    if (timeOfDay === "morning") {
      greeting = isReturningUser ? "¡Buenos días de nuevo!" : "¡Buenos días!";
    } else if (timeOfDay === "afternoon") {
      greeting = isReturningUser ? "¡Buenas tardes!" : "¡Hola, buenas tardes!";
    } else {
      greeting = isReturningUser ? "¡Buenas noches!" : "¡Hola, buenas noches!";
    }

    const baseResponse = this.getRandomTemplate("greeting");
    return `${greeting} ${baseResponse}`;
  }

  /**
   * Generar respuesta para reserva lista
   */
  async generateBookingReadyResponse(analysis, context) {
    const { entities } = analysis;

    // Verificar disponibilidad antes de confirmar
    const availabilityCheck = await this.checkAvailability(
      entities.service,
      entities.date,
      entities.time
    );

    if (availabilityCheck.available) {
      const template = this.getRandomTemplate("booking_confirmation");
      return template
        .replace("{service}", entities.service)
        .replace("{date}", this.formatDate(entities.date))
        .replace("{time}", entities.time);
    } else {
      return this.generateNoAvailabilityResponse(
        entities,
        availabilityCheck.alternatives
      );
    }
  }

  /**
   * Generar respuesta para información faltante
   */
  generateMissingInfoResponse(analysis) {
    const missingFields = analysis.missing_info.map((field) => {
      const fieldNames = {
        service: "el servicio que deseas",
        date: "la fecha preferida",
        time: "la hora preferida",
        client_name: "tu nombre",
        phone: "tu número de teléfono",
        email: "tu email",
      };
      return fieldNames[field] || field;
    });

    const template = this.getRandomTemplate("missing_info");
    return template.replace("{missing_fields}", missingFields.join(", "));
  }

  /**
   * Generar respuesta de disponibilidad
   */
  async generateAvailabilityResponse(analysis, context) {
    const { entities } = analysis;

    if (entities.service && entities.date) {
      const availability = await this.getAvailableSlots(
        entities.service,
        entities.date
      );

      if (availability.length > 0) {
        const slots = availability.slice(0, 3).join(", ");
        return `Para ${entities.service} el ${this.formatDate(entities.date)} tengo disponibilidad a las: ${slots}. ¿Cuál te conviene mejor?`;
      } else {
        return `Lo siento, no tengo disponibilidad para ${entities.service} el ${this.formatDate(entities.date)}. ¿Te gustaría ver otros días disponibles?`;
      }
    } else {
      return "Para consultar disponibilidad necesito que me digas qué servicio te interesa y para qué fecha. ¿Puedes proporcionarme esa información?";
    }
  }

  /**
   * Generar respuesta de información de servicios
   */
  async generateServiceInfoResponse(analysis, context) {
    const { entities } = analysis;

    if (entities.service) {
      const serviceInfo = await this.getServiceInfo(entities.service);

      if (serviceInfo) {
        const template = this.getRandomTemplate("service_info");
        return template
          .replace("{service}", serviceInfo.name)
          .replace("{description}", serviceInfo.description)
          .replace("{price}", serviceInfo.price)
          .replace("{duration}", serviceInfo.duration);
      }
    }

    return `Te cuento sobre nuestros servicios principales:

🌟 **Corte y Peinado** - Desde 35€
✨ **Coloración** - Desde 60€
💆‍♀️ **Tratamientos Capilares** - Desde 45€
💅 **Manicura** - Desde 25€
🦶 **Pedicura** - Desde 30€

¿Sobre cuál te gustaría saber más detalles?`;
  }

  /**
   * Generar respuesta para contacto directo
   */
  generateDirectContactResponse(analysis, context) {
    const template = this.getRandomTemplate("direct_contact");

    // Agregar información de urgencia si se detecta
    if (analysis.entities.urgency === "high") {
      return (
        template +
        " He marcado tu consulta como urgente para que Ricardo te atienda lo antes posible."
      );
    }

    return template;
  }

  /**
   * Generar respuesta para quejas
   */
  async generateComplaintResponse(analysis, context) {
    const empathyResponse =
      "Lamento mucho que hayas tenido una experiencia negativa. ";
    const actionResponse =
      "Voy a notificar inmediatamente a Ricardo para que se ponga en contacto contigo y resuelva esta situación. ";
    const followUpResponse =
      "¿Podrías contarme brevemente qué ha ocurrido para que pueda informarle mejor?";

    return empathyResponse + actionResponse + followUpResponse;
  }

  /**
   * Generar respuesta para elogios
   */
  generateComplimentResponse(analysis, context) {
    const gratitudeResponses = [
      "¡Muchísimas gracias por tus palabras! Me alegra saber que estás contenta con nuestros servicios. ",
      "¡Qué alegría leer esto! Gracias por tomarte el tiempo de escribirnos. ",
      "¡Gracias! Es maravilloso saber que hemos cumplido tus expectativas. ",
    ];

    const followUpResponses = [
      "¿Hay algo más en lo que pueda ayudarte hoy?",
      "¿Te gustaría reservar tu próxima cita?",
      "¿Necesitas algún otro servicio?",
    ];

    const gratitude =
      gratitudeResponses[Math.floor(Math.random() * gratitudeResponses.length)];
    const followUp =
      followUpResponses[Math.floor(Math.random() * followUpResponses.length)];

    return gratitude + followUp;
  }

  /**
   * Generar respuesta general con IA
   */
  async generateGeneralResponse(analysis, context) {
    try {
      const prompt = this.buildGeneralResponsePrompt(analysis, context);

      const response = await openaiClient.chat(
        [
          {
            role: "system",
            content: this.buildSystemPromptForGeneration(),
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        {
          model: "gpt-3.5-turbo",
          temperature: 0.7,
          max_tokens: 200,
        }
      );

      return response.choices[0].message.content.trim();
    } catch (error) {
      logger.error("Error generating general response", {
        error: error.message,
      });
      return this.getFallbackResponse();
    }
  }

  /**
   * Personalizar respuesta según contexto
   */
  personalizeResponse(response, context) {
    // Agregar nombre si está disponible
    if (context.clientName) {
      response = response.replace(/¡Hola!/g, `¡Hola ${context.clientName}!`);
    }

    // Ajustar según hora del día
    const timeOfDay = this.getTimeOfDay();
    if (timeOfDay === "evening" && !response.includes("noche")) {
      response = response.replace(/¡Hola!/g, "¡Buenas noches!");
    }

    // Agregar emojis según el sentimiento
    if (
      context.sentiment === "positive" &&
      !response.includes("😊") &&
      !response.includes("✨")
    ) {
      response += " ✨";
    }

    return response;
  }

  /**
   * Agregar información contextual
   */
  addContextualInfo(response, analysis, availableServices) {
    // Agregar información de servicios si es relevante
    if (analysis.intent === "general_inquiry" && availableServices.length > 0) {
      const serviceList = availableServices
        .slice(0, 3)
        .map((s) => s.name)
        .join(", ");
      response += `\n\nNuestros servicios más populares son: ${serviceList}. ¿Te interesa alguno?`;
    }

    // Agregar información de horarios
    if (analysis.intent === "availability_inquiry") {
      response += `\n\nNuestro horario es de lunes a sábado de 9:00 a 20:00.`;
    }

    return response;
  }

  /**
   * Optimizar longitud de respuesta
   */
  optimizeResponseLength(response) {
    const maxLength = 1600; // Límite de WhatsApp

    if (response.length > maxLength) {
      // Truncar y agregar indicación
      response =
        response.substring(0, maxLength - 50) +
        "...\n\n¿Necesitas más información? 😊";
    }

    return response;
  }

  /**
   * Métodos auxiliares
   */
  getRandomTemplate(type) {
    const templates = this.responseTemplates[type];
    if (!templates || templates.length === 0) {
      return this.getFallbackResponse();
    }
    return templates[Math.floor(Math.random() * templates.length)];
  }

  getFallbackResponse() {
    return "Gracias por contactarnos. ¿En qué puedo ayudarte hoy? 😊";
  }

  getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 18) return "afternoon";
    return "evening";
  }

  getDayOfWeek() {
    const days = [
      "domingo",
      "lunes",
      "martes",
      "miércoles",
      "jueves",
      "viernes",
      "sábado",
    ];
    return days[new Date().getDay()];
  }

  getSeason() {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return "spring";
    if (month >= 5 && month <= 7) return "summer";
    if (month >= 8 && month <= 10) return "autumn";
    return "winter";
  }

  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      return dateString;
    }
  }

  buildGeneralResponsePrompt(analysis, context) {
    return `Genera una respuesta amigable y profesional para un salón de belleza.

ANÁLISIS DEL MENSAJE:
- Intención: ${analysis.intent}
- Confianza: ${analysis.confidence}
- Entidades: ${JSON.stringify(analysis.entities)}

CONTEXTO:
- Hora del día: ${this.getTimeOfDay()}
- Día de la semana: ${this.getDayOfWeek()}

La respuesta debe ser:
- Amigable pero profesional
- Máximo 150 palabras
- En español
- Con emojis apropiados
- Orientada a ayudar al cliente`;
  }

  buildSystemPromptForGeneration() {
    return `Eres el asistente virtual de Ricardo Buriticá Beauty Consulting, un salón de belleza premium.

PERSONALIDAD:
- Amigable y cercano
- Profesional y competente
- Entusiasta por la belleza
- Paciente y comprensivo
- Orientado a soluciones

SERVICIOS PRINCIPALES:
- Corte y peinado
- Coloración
- Tratamientos capilares
- Manicura y pedicura
- Cejas y depilación
- Maquillaje para eventos

HORARIOS:
- Lunes a sábado: 9:00 - 20:00
- Domingos: Cerrado

Siempre mantén un tono positivo y ofrece ayuda proactiva.`;
  }

  // Métodos que deberían conectar con otros servicios
  async checkAvailability(service, date, time) {
    // Placeholder - debería conectar con calendlyClient
    return { available: true, alternatives: [] };
  }

  async getAvailableSlots(service, date) {
    // Placeholder - debería conectar con calendlyClient
    return ["10:00", "14:00", "16:30"];
  }

  async getServiceInfo(serviceName) {
    // Placeholder - debería conectar con serviceService
    return {
      name: serviceName,
      description: "Servicio profesional de belleza",
      price: "45",
      duration: "60 minutos",
    };
  }

  generateNoAvailabilityResponse(entities, alternatives) {
    const template = this.getRandomTemplate("no_availability");
    let response = template
      .replace("{service}", entities.service)
      .replace("{date}", this.formatDate(entities.date))
      .replace("{time}", entities.time);

    if (alternatives && alternatives.length > 0) {
      response += `\n\nTengo estas alternativas disponibles: ${alternatives.slice(0, 3).join(", ")}`;
    }

    return response;
  }
}

module.exports = new ResponseGenerationService();
