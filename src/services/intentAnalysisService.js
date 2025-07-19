// src/services/intentAnalysisService.js
// Servicio avanzado para análisis de intenciones con IA

const openaiClient = require("../integrations/openaiClient");
const logger = require("../utils/logger");
const gdprService = require("./gdprService");

class IntentAnalysisService {
  constructor() {
    this.intentTypes = {
      APPOINTMENT_REQUEST: "appointment_request",
      AVAILABILITY_INQUIRY: "availability_inquiry",
      APPOINTMENT_MODIFICATION: "appointment_modification",
      APPOINTMENT_CANCELLATION: "appointment_cancellation",
      SERVICE_INFORMATION: "service_information",
      PRICING_INQUIRY: "pricing_inquiry",
      GREETING: "greeting",
      COMPLAINT: "complaint",
      COMPLIMENT: "compliment",
      DIRECT_CONTACT: "direct_contact_request",
      GDPR_REQUEST: "gdpr_request",
      GENERAL_INQUIRY: "general_inquiry",
    };

    this.confidenceThresholds = {
      HIGH: 0.8,
      MEDIUM: 0.6,
      LOW: 0.4,
    };

    this.serviceKeywords = {
      corte: ["corte", "cortar", "pelo", "cabello", "haircut"],
      coloracion: ["color", "tinte", "mechas", "highlights", "coloración"],
      tratamiento: ["tratamiento", "mascarilla", "hidratación", "reparación"],
      manicura: ["manicura", "uñas", "manos", "nail"],
      pedicura: ["pedicura", "pies", "foot"],
      cejas: ["cejas", "depilación", "eyebrow"],
      maquillaje: ["maquillaje", "makeup", "evento"],
    };

    this.timeKeywords = {
      mañana: ["mañana", "morning", "am"],
      tarde: ["tarde", "afternoon", "pm"],
      noche: ["noche", "evening", "night"],
      hoy: ["hoy", "today"],
      mañana_dia: ["mañana", "tomorrow"],
      semana: ["semana", "week"],
      mes: ["mes", "month"],
    };

    logger.info("Intent Analysis Service initialized", {
      intentTypes: Object.keys(this.intentTypes).length,
      serviceKeywords: Object.keys(this.serviceKeywords).length,
    });
  }

  /**
   * Analizar mensaje con IA avanzada
   */
  async analyzeMessage(message, context = {}, phoneNumber = null) {
    try {
      // Verificar consentimiento RGPD si hay número de teléfono
      if (phoneNumber) {
        const consentCheck = await gdprService.checkConsent(
          phoneNumber,
          gdprService.consentTypes.WHATSAPP
        );

        if (!consentCheck.hasConsent) {
          return this.createGDPRConsentResponse();
        }
      }

      // Pre-análisis con keywords para optimizar
      const preAnalysis = this.preAnalyzeWithKeywords(message);

      // Análisis con OpenAI
      const aiAnalysis = await this.analyzeWithOpenAI(
        message,
        context,
        preAnalysis
      );

      // Post-procesamiento y validación
      const finalAnalysis = this.postProcessAnalysis(
        aiAnalysis,
        preAnalysis,
        context
      );

      // Log del análisis (sin datos sensibles)
      logger.info("Message analysis completed", {
        intent: finalAnalysis.intent,
        confidence: finalAnalysis.confidence,
        hasPersonalData:
          finalAnalysis.entities.client_name || finalAnalysis.entities.phone,
        messageLength: message.length,
      });

      return finalAnalysis;
    } catch (error) {
      logger.error("Error in message analysis", {
        error: error.message,
        messageLength: message.length,
      });

      return this.createFallbackAnalysis();
    }
  }

  /**
   * Pre-análisis con keywords para optimización
   */
  preAnalyzeWithKeywords(message) {
    const lowerMessage = message.toLowerCase();
    const analysis = {
      detectedServices: [],
      detectedTimes: [],
      hasPersonalData: false,
      urgencyIndicators: [],
      sentimentIndicators: [],
    };

    // Detectar servicios
    Object.entries(this.serviceKeywords).forEach(([service, keywords]) => {
      if (keywords.some((keyword) => lowerMessage.includes(keyword))) {
        analysis.detectedServices.push(service);
      }
    });

    // Detectar referencias temporales
    Object.entries(this.timeKeywords).forEach(([timeType, keywords]) => {
      if (keywords.some((keyword) => lowerMessage.includes(keyword))) {
        analysis.detectedTimes.push(timeType);
      }
    });

    // Detectar datos personales
    const phoneRegex = /(\+?\d{9,15})/;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const nameIndicators = ["me llamo", "soy", "mi nombre"];

    analysis.hasPersonalData =
      phoneRegex.test(message) ||
      emailRegex.test(message) ||
      nameIndicators.some((indicator) => lowerMessage.includes(indicator));

    // Detectar urgencia
    const urgencyWords = [
      "urgente",
      "rápido",
      "ya",
      "ahora",
      "hoy mismo",
      "emergency",
    ];
    analysis.urgencyIndicators = urgencyWords.filter((word) =>
      lowerMessage.includes(word)
    );

    // Detectar sentimiento
    const positiveWords = [
      "gracias",
      "perfecto",
      "genial",
      "excelente",
      "encantada",
    ];
    const negativeWords = ["problema", "mal", "terrible", "horrible", "queja"];

    if (positiveWords.some((word) => lowerMessage.includes(word))) {
      analysis.sentimentIndicators.push("positive");
    }
    if (negativeWords.some((word) => lowerMessage.includes(word))) {
      analysis.sentimentIndicators.push("negative");
    }

    return analysis;
  }

  /**
   * Análisis con OpenAI usando function calling
   */
  async analyzeWithOpenAI(message, context, preAnalysis) {
    try {
      const systemPrompt = this.buildSystemPrompt(preAnalysis);
      const functions = this.buildAnalysisFunctions();

      const response = await openaiClient.chat(
        [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: this.buildAnalysisPrompt(message, context, preAnalysis),
          },
        ],
        {
          model: "gpt-4-turbo-preview",
          temperature: 0.1,
          max_tokens: 800,
          functions: functions,
          function_call: "auto",
        }
      );

      // Procesar respuesta de function calling
      if (response.choices[0].message.function_call) {
        return this.processFunctionCall(
          response.choices[0].message.function_call
        );
      } else {
        // Fallback a análisis tradicional
        return this.parseTraditionalResponse(
          response.choices[0].message.content
        );
      }
    } catch (error) {
      logger.error("Error in OpenAI analysis", { error: error.message });
      throw error;
    }
  }

  /**
   * Construir prompt del sistema
   */
  buildSystemPrompt(preAnalysis) {
    return `Eres un asistente experto en análisis de intenciones para un salón de belleza.

SERVICIOS DETECTADOS: ${preAnalysis.detectedServices.join(", ") || "ninguno"}
REFERENCIAS TEMPORALES: ${preAnalysis.detectedTimes.join(", ") || "ninguna"}
URGENCIA: ${preAnalysis.urgencyIndicators.length > 0 ? "alta" : "normal"}
SENTIMIENTO: ${preAnalysis.sentimentIndicators.join(", ") || "neutral"}

Tu tarea es analizar mensajes de WhatsApp y determinar:
1. La intención principal del usuario
2. Extraer información relevante (servicio, fecha, hora, datos personales)
3. Evaluar la confianza del análisis
4. Determinar qué información falta para completar una reserva

INTENCIONES POSIBLES:
- appointment_request: Solicitud de nueva reserva
- availability_inquiry: Consulta de disponibilidad
- appointment_modification: Modificar reserva existente
- appointment_cancellation: Cancelar reserva
- service_information: Información sobre servicios
- pricing_inquiry: Consulta de precios
- greeting: Saludo inicial
- complaint: Queja o problema
- compliment: Elogio o agradecimiento
- direct_contact_request: Solicita hablar con Ricardo
- gdpr_request: Solicitud relacionada con privacidad/datos
- general_inquiry: Consulta general

IMPORTANTE:
- Sé conservador con la confianza si hay ambigüedad
- Extrae solo información explícitamente mencionada
- Respeta la privacidad y no inventes datos personales`;
  }

  /**
   * Construir funciones para function calling
   */
  buildAnalysisFunctions() {
    return [
      {
        name: "analyze_intent",
        description:
          "Analizar la intención del mensaje y extraer información relevante",
        parameters: {
          type: "object",
          properties: {
            intent: {
              type: "string",
              enum: Object.values(this.intentTypes),
              description: "Intención principal del mensaje",
            },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description: "Confianza del análisis (0-1)",
            },
            entities: {
              type: "object",
              properties: {
                service: {
                  type: "string",
                  description: "Servicio solicitado",
                },
                date: {
                  type: "string",
                  description: "Fecha mencionada (formato YYYY-MM-DD)",
                },
                time: {
                  type: "string",
                  description: "Hora mencionada (formato HH:MM)",
                },
                client_name: {
                  type: "string",
                  description: "Nombre del cliente",
                },
                phone: {
                  type: "string",
                  description: "Teléfono del cliente",
                },
                email: {
                  type: "string",
                  description: "Email del cliente",
                },
                urgency: {
                  type: "string",
                  enum: ["low", "medium", "high"],
                  description: "Nivel de urgencia",
                },
                sentiment: {
                  type: "string",
                  enum: ["positive", "neutral", "negative"],
                  description: "Sentimiento del mensaje",
                },
              },
            },
            missing_info: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Información faltante para completar la acción",
            },
            ready_to_book: {
              type: "boolean",
              description:
                "Si tiene suficiente información para hacer una reserva",
            },
            suggested_response: {
              type: "string",
              description: "Respuesta sugerida para el usuario",
            },
          },
          required: [
            "intent",
            "confidence",
            "entities",
            "missing_info",
            "ready_to_book",
          ],
        },
      },
    ];
  }

  /**
   * Construir prompt de análisis
   */
  buildAnalysisPrompt(message, context, preAnalysis) {
    let prompt = `Analiza este mensaje de WhatsApp:\n\n"${message}"\n\n`;

    if (context.previousMessages && context.previousMessages.length > 0) {
      prompt += `CONTEXTO PREVIO:\n`;
      context.previousMessages.slice(-3).forEach((msg, index) => {
        prompt += `${index + 1}. ${msg.role}: ${msg.content}\n`;
      });
      prompt += `\n`;
    }

    if (
      context.extractedData &&
      Object.keys(context.extractedData).length > 0
    ) {
      prompt += `DATOS EXTRAÍDOS PREVIAMENTE:\n${JSON.stringify(context.extractedData, null, 2)}\n\n`;
    }

    prompt += `PRE-ANÁLISIS:\n`;
    prompt += `- Servicios detectados: ${preAnalysis.detectedServices.join(", ") || "ninguno"}\n`;
    prompt += `- Referencias temporales: ${preAnalysis.detectedTimes.join(", ") || "ninguna"}\n`;
    prompt += `- Datos personales detectados: ${preAnalysis.hasPersonalData ? "sí" : "no"}\n`;
    prompt += `- Urgencia: ${preAnalysis.urgencyIndicators.length > 0 ? "alta" : "normal"}\n`;

    return prompt;
  }

  /**
   * Procesar respuesta de function calling
   */
  processFunctionCall(functionCall) {
    try {
      const args = JSON.parse(functionCall.arguments);

      return {
        intent: args.intent,
        confidence: args.confidence,
        entities: args.entities || {},
        missing_info: args.missing_info || [],
        ready_to_book: args.ready_to_book || false,
        suggested_response: args.suggested_response,
        analysis_method: "function_call",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Error processing function call", { error: error.message });
      return this.createFallbackAnalysis();
    }
  }

  /**
   * Parsear respuesta tradicional (fallback)
   */
  parseTraditionalResponse(content) {
    try {
      // Intentar parsear como JSON
      const parsed = JSON.parse(content);

      return {
        intent: parsed.intent || this.intentTypes.GENERAL_INQUIRY,
        confidence: parsed.confidence || 0.5,
        entities: parsed.entities || {},
        missing_info: parsed.missing_info || [],
        ready_to_book: parsed.ready_to_book || false,
        suggested_response: parsed.suggested_response,
        analysis_method: "traditional",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Error parsing traditional response", {
        error: error.message,
      });
      return this.createFallbackAnalysis();
    }
  }

  /**
   * Post-procesamiento y validación
   */
  postProcessAnalysis(analysis, preAnalysis, context) {
    // Validar y ajustar confianza
    if (
      analysis.confidence > this.confidenceThresholds.HIGH &&
      preAnalysis.detectedServices.length === 0 &&
      analysis.intent === this.intentTypes.APPOINTMENT_REQUEST
    ) {
      analysis.confidence = this.confidenceThresholds.MEDIUM;
    }

    // Enriquecer con datos del pre-análisis
    if (preAnalysis.detectedServices.length > 0 && !analysis.entities.service) {
      analysis.entities.service = preAnalysis.detectedServices[0];
    }

    // Determinar urgencia
    if (preAnalysis.urgencyIndicators.length > 0) {
      analysis.entities.urgency = "high";
    } else if (preAnalysis.detectedTimes.includes("hoy")) {
      analysis.entities.urgency = "medium";
    } else {
      analysis.entities.urgency = "low";
    }

    // Determinar sentimiento
    if (preAnalysis.sentimentIndicators.length > 0) {
      analysis.entities.sentiment = preAnalysis.sentimentIndicators[0];
    } else {
      analysis.entities.sentiment = "neutral";
    }

    // Validar información para reserva
    const requiredForBooking = ["service", "date", "time"];
    const missingInfo = requiredForBooking.filter(
      (field) => !analysis.entities[field]
    );

    analysis.missing_info = missingInfo;
    analysis.ready_to_book =
      missingInfo.length === 0 && analysis.entities.client_name;

    return analysis;
  }

  /**
   * Crear respuesta para consentimiento RGPD
   */
  createGDPRConsentResponse() {
    return {
      intent: this.intentTypes.GDPR_REQUEST,
      confidence: 1.0,
      entities: {
        gdpr_action: "consent_required",
      },
      missing_info: ["gdpr_consent"],
      ready_to_book: false,
      suggested_response: `Hola! Para poder ayudarte con WhatsApp, necesito tu consentimiento para procesar tus datos personales según el RGPD.

¿Aceptas que procese tus datos para:
- Gestionar tus reservas
- Comunicarme contigo por WhatsApp
- Mejorar nuestros servicios

Responde "SÍ" para aceptar o "NO" para rechazar.

Puedes retirar tu consentimiento en cualquier momento escribiendo "STOP".`,
      analysis_method: "gdpr_check",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Crear análisis de fallback
   */
  createFallbackAnalysis() {
    return {
      intent: this.intentTypes.GENERAL_INQUIRY,
      confidence: 0.3,
      entities: {
        urgency: "medium",
        sentiment: "neutral",
      },
      missing_info: ["clarification"],
      ready_to_book: false,
      suggested_response:
        "Disculpa, no he entendido bien tu mensaje. ¿Podrías ser más específico sobre lo que necesitas? 😊",
      analysis_method: "fallback",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Analizar sentimiento del mensaje
   */
  async analyzeSentiment(message) {
    try {
      const response = await openaiClient.chat(
        [
          {
            role: "system",
            content:
              "Analiza el sentimiento de este mensaje en una escala de -1 (muy negativo) a 1 (muy positivo). Responde solo con el número.",
          },
          {
            role: "user",
            content: message,
          },
        ],
        {
          model: "gpt-3.5-turbo",
          temperature: 0.1,
          max_tokens: 10,
        }
      );

      const sentiment = parseFloat(response.choices[0].message.content.trim());

      return {
        score: isNaN(sentiment) ? 0 : sentiment,
        label:
          sentiment > 0.3
            ? "positive"
            : sentiment < -0.3
              ? "negative"
              : "neutral",
      };
    } catch (error) {
      logger.error("Error analyzing sentiment", { error: error.message });
      return { score: 0, label: "neutral" };
    }
  }

  /**
   * Extraer entidades específicas
   */
  extractEntities(message) {
    const entities = {};

    // Extraer teléfonos
    const phoneRegex = /(\+?\d{9,15})/g;
    const phones = message.match(phoneRegex);
    if (phones) {
      entities.phone = phones[0];
    }

    // Extraer emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = message.match(emailRegex);
    if (emails) {
      entities.email = emails[0];
    }

    // Extraer fechas
    const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g;
    const dates = message.match(dateRegex);
    if (dates) {
      entities.date = dates[0];
    }

    // Extraer horas
    const timeRegex = /(\d{1,2}):(\d{2})/g;
    const times = message.match(timeRegex);
    if (times) {
      entities.time = times[0];
    }

    return entities;
  }
}

module.exports = new IntentAnalysisService();
