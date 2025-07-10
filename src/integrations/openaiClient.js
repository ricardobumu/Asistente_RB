// src/integrations/openaiClient.js
const OpenAI = require("openai");
const { OPENAI_API_KEY, OPENAI_MODEL } = require("../config/env");
const logger = require("../utils/logger");

class OpenAIClient {
  constructor() {
    this.client = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });
    this.model = OPENAI_MODEL || "gpt-4-turbo";
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 1000;
  }

  /**
   * Analiza mensaje con function calling para reservas
   */
  async analyzeMessageWithFunctions(message, context = {}) {
    try {
      const functions = this.getBookingFunctions();

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: this.getSystemPromptWithFunctions(),
          },
          {
            role: "user",
            content: `Contexto previo: ${JSON.stringify(
              context
            )}\n\nMensaje: ${message}`,
          },
        ],
        functions: functions,
        function_call: "auto",
        temperature: 0.1,
        max_tokens: this.maxTokens,
      });

      const choice = response.choices[0];

      if (choice.message.function_call) {
        return {
          type: "function_call",
          function_name: choice.message.function_call.name,
          arguments: JSON.parse(choice.message.function_call.arguments),
          message: choice.message.content,
        };
      }

      return {
        type: "text_response",
        message: choice.message.content,
      };
    } catch (error) {
      logger.error("Error in OpenAI function calling", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Genera respuesta estructurada para análisis de intención
   */
  async analyzeIntent(message, context = {}) {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: `Eres un analizador de intenciones para un sistema de reservas de belleza.
            
ANALIZA el mensaje y devuelve SOLO un JSON válido con esta estructura:
{
  "intent": "booking_request|availability_inquiry|booking_modification|service_information|greeting|general_inquiry",
  "confidence": 0.0-1.0,
  "entities": {
    "service": "nombre del servicio mencionado",
    "date": "fecha en formato YYYY-MM-DD",
    "time": "hora en formato HH:MM",
    "client_name": "nombre del cliente",
    "client_email": "email si se menciona"
  },
  "missing_info": ["lista de información faltante"],
  "urgency": "low|medium|high",
  "ready_to_book": boolean
}`,
          },
          {
            role: "user",
            content: `Contexto: ${JSON.stringify(
              context
            )}\nMensaje: ${message}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error("Error analyzing intent", { error: error.message });
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
   * Genera respuesta conversacional
   */
  async generateResponse(prompt, context = {}) {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: this.getConversationalSystemPrompt(),
          },
          {
            role: "user",
            content: `Contexto: ${JSON.stringify(
              context
            )}\n\nGenera respuesta para: ${prompt}`,
          },
        ],
        temperature: 0.3,
        max_tokens: this.maxTokens,
      });

      return response.choices[0].message.content;
    } catch (error) {
      logger.error("Error generating response", { error: error.message });
      throw error;
    }
  }

  /**
   * Define las funciones disponibles para el bot
   */
  getBookingFunctions() {
    return [
      {
        name: "check_availability",
        description:
          "Verifica disponibilidad para un servicio en fecha y hora específica",
        parameters: {
          type: "object",
          properties: {
            service_name: {
              type: "string",
              description: "Nombre del servicio solicitado",
            },
            date: {
              type: "string",
              description: "Fecha deseada en formato YYYY-MM-DD",
            },
            time: {
              type: "string",
              description: "Hora deseada en formato HH:MM",
            },
          },
          required: ["service_name", "date", "time"],
        },
      },
      {
        name: "create_booking",
        description: "Crea una nueva reserva con todos los datos necesarios",
        parameters: {
          type: "object",
          properties: {
            client_name: {
              type: "string",
              description: "Nombre completo del cliente",
            },
            client_phone: {
              type: "string",
              description: "Número de teléfono del cliente",
            },
            client_email: {
              type: "string",
              description: "Email del cliente (opcional)",
            },
            service_name: {
              type: "string",
              description: "Nombre del servicio",
            },
            date: {
              type: "string",
              description: "Fecha de la reserva YYYY-MM-DD",
            },
            time: {
              type: "string",
              description: "Hora de la reserva HH:MM",
            },
            notes: {
              type: "string",
              description: "Notas adicionales (opcional)",
            },
          },
          required: [
            "client_name",
            "client_phone",
            "service_name",
            "date",
            "time",
          ],
        },
      },
      {
        name: "get_available_slots",
        description:
          "Obtiene slots disponibles para un servicio en los próximos días",
        parameters: {
          type: "object",
          properties: {
            service_name: {
              type: "string",
              description: "Nombre del servicio",
            },
            from_date: {
              type: "string",
              description: "Fecha desde la cual buscar YYYY-MM-DD",
            },
            days_ahead: {
              type: "integer",
              description: "Número de días a buscar (default: 7)",
            },
          },
          required: ["service_name"],
        },
      },
    ];
  }

  /**
   * System prompt para function calling
   */
  getSystemPromptWithFunctions() {
    return `Eres un asistente virtual AUTÓNOMO para Ricardo Buriticá, especialista en servicios de belleza.

OBJETIVO: Gestionar reservas automáticamente usando las funciones disponibles.

SERVICIOS DISPONIBLES:
- Corte de Cabello (45 min, €25)
- Peinado (60 min, €35) 
- Tratamiento Capilar (90 min, €45)
- Manicura (30 min, €20)
- Pedicura (45 min, €25)

PROCESO:
1. Analiza la intención del cliente
2. Si quiere reservar, usa check_availability primero
3. Si hay disponibilidad, usa create_booking
4. Si no hay disponibilidad, usa get_available_slots para ofrecer alternativas
5. Siempre confirma los detalles antes de crear reserva

REGLAS:
- SIEMPRE usar las funciones para verificar disponibilidad real
- NUNCA inventar horarios disponibles
- Ser claro y profesional en las respuestas
- Pedir información faltante de forma específica`;
  }

  /**
   * System prompt para respuestas conversacionales
   */
  getConversationalSystemPrompt() {
    return `Eres Ricardo Buriticá, especialista en servicios de belleza profesional.

PERSONALIDAD:
- Profesional pero cercano
- Experto en tu campo
- Eficiente y organizado
- Amable y servicial

SERVICIOS:
- Corte de Cabello (45 min, €25)
- Peinado (60 min, €35)
- Tratamiento Capilar (90 min, €45) 
- Manicura (30 min, €20)
- Pedicura (45 min, €25)

HORARIOS:
- Lunes a Viernes: 9:00 - 18:00
- Citas cada 30 minutos
- Ubicación: Barcelona

INSTRUCCIONES:
- Respuestas cortas y claras
- Usar emojis apropiados
- Ser proactivo en completar reservas
- Ofrecer alternativas si no hay disponibilidad`;
  }

  /**
   * Método básico para compatibilidad
   */
  async chat(messages, options = {}) {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        temperature: options.temperature || 0.3,
        max_tokens: options.max_tokens || this.maxTokens,
        ...options,
      });

      return response;
    } catch (error) {
      logger.error("Error in OpenAI chat", { error: error.message });
      throw error;
    }
  }
}

// Crear instancia singleton
const openaiClient = new OpenAIClient();

module.exports = { openaiClient, OpenAIClient };
