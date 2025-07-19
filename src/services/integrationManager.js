/**
 * GESTOR CENTRALIZADO DE INTEGRACIONES
 *
 * Este módulo centraliza y coordina todas las integraciones externas
 * (Supabase, Twilio, Calendly, OpenAI) asegurando consistencia
 */

const { dbManager } = require("../config/database");
const {
  ConfigManager,
  TWILIO_CONFIG,
  CALENDLY_CONFIG,
  OPENAI_CONFIG,
} = require("../config/integrations");
const logger = require("../utils/logger");

// Clientes de integración (lazy loading)
let twilioClient = null;
let openaiClient = null;
let calendlyClient = null;

/**
 * Inicializa el cliente de Twilio
 */
function initTwilioClient() {
  if (!twilioClient && ConfigManager.isServiceConfigured("twilio")) {
    try {
      const twilio = require("twilio");
      twilioClient = twilio(TWILIO_CONFIG.accountSid, TWILIO_CONFIG.authToken);
      logger.info("Cliente de Twilio inicializado");
    } catch (error) {
      logger.error("Error inicializando cliente de Twilio", {
        error: error.message,
      });
    }
  }
  return twilioClient;
}

/**
 * Inicializa el cliente de OpenAI
 */
function initOpenAIClient() {
  if (!openaiClient && ConfigManager.isServiceConfigured("openai")) {
    try {
      const { OpenAI } = require("openai");
      openaiClient = new OpenAI({
        apiKey: OPENAI_CONFIG.apiKey,
      });
      logger.info("Cliente de OpenAI inicializado");
    } catch (error) {
      logger.error("Error inicializando cliente de OpenAI", {
        error: error.message,
      });
    }
  }
  return openaiClient;
}

/**
 * Inicializa el cliente de Calendly (simulado)
 */
function initCalendlyClient() {
  if (!calendlyClient && ConfigManager.isServiceConfigured("calendly")) {
    try {
      // Simulación de cliente de Calendly
      calendlyClient = {
        accessToken: CALENDLY_CONFIG.accessToken,
        baseUrl: "https://api.calendly.com",
        async makeRequest(endpoint, options = {}) {
          const fetch = require("node-fetch");
          const response = await fetch(`${this.baseUrl}${endpoint}`, {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              "Content-Type": "application/json",
              ...options.headers,
            },
            ...options,
          });
          return response.json();
        },
      };
      logger.info("Cliente de Calendly inicializado");
    } catch (error) {
      logger.error("Error inicializando cliente de Calendly", {
        error: error.message,
      });
    }
  }
  return calendlyClient;
}

/**
 * Gestor de integraciones
 */
class IntegrationManager {
  constructor() {
    this.services = {
      database: dbManager,
      twilio: null,
      openai: null,
      calendly: null,
    };
  }

  /**
   * Inicializa todas las integraciones
   */
  async initialize() {
    try {
      logger.info("Inicializando gestor de integraciones");

      // Verificar salud de la base de datos
      const dbHealth = await this.services.database.healthCheck();
      if (!dbHealth.healthy) {
        throw new Error(`Base de datos no disponible: ${dbHealth.error}`);
      }

      // Inicializar servicios según configuración
      this.services.twilio = initTwilioClient();
      this.services.openai = initOpenAIClient();
      this.services.calendly = initCalendlyClient();

      logger.info("Gestor de integraciones inicializado correctamente");
      return { success: true };
    } catch (error) {
      logger.error("Error inicializando gestor de integraciones", {
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene el estado de todas las integraciones
   */
  getStatus() {
    return {
      database: {
        available: !!this.services.database,
        configured: ConfigManager.isServiceConfigured("supabase"),
      },
      twilio: {
        available: !!this.services.twilio,
        configured: ConfigManager.isServiceConfigured("twilio"),
      },
      openai: {
        available: !!this.services.openai,
        configured: ConfigManager.isServiceConfigured("openai"),
      },
      calendly: {
        available: !!this.services.calendly,
        configured: ConfigManager.isServiceConfigured("calendly"),
      },
    };
  }

  /**
   * OPERACIONES DE BASE DE DATOS
   */

  async getClient(clientId) {
    return await this.services.database.getById("clients", clientId);
  }

  async updateClient(clientId, updateData) {
    return await this.services.database.updateRecord(
      "clients",
      clientId,
      updateData
    );
  }

  async findClientByPhone(phoneNumber) {
    return await this.services.database.findClientByPhone(phoneNumber);
  }

  async getAllClients(options = {}) {
    return await this.services.database.getAll("clients", options);
  }

  /**
   * OPERACIONES DE TWILIO/WHATSAPP
   */

  async sendWhatsAppMessage(to, message) {
    try {
      if (!this.services.twilio) {
        throw new Error("Twilio no está configurado");
      }

      const result = await this.services.twilio.messages.create({
        body: message,
        from: TWILIO_CONFIG.whatsappNumber,
        to: `whatsapp:${to}`,
      });

      logger.info("Mensaje de WhatsApp enviado", {
        to,
        messageId: result.sid,
        status: result.status,
      });

      return { success: true, messageId: result.sid, status: result.status };
    } catch (error) {
      logger.error("Error enviando mensaje de WhatsApp", {
        to,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  async sendSMS(to, message) {
    try {
      if (!this.services.twilio) {
        throw new Error("Twilio no está configurado");
      }

      const result = await this.services.twilio.messages.create({
        body: message,
        from: TWILIO_CONFIG.whatsappNumber.replace("whatsapp:", ""),
        to: to,
      });

      logger.info("SMS enviado", {
        to,
        messageId: result.sid,
        status: result.status,
      });

      return { success: true, messageId: result.sid, status: result.status };
    } catch (error) {
      logger.error("Error enviando SMS", {
        to,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * OPERACIONES DE OPENAI
   */

  async generateAIResponse(prompt, options = {}) {
    try {
      if (!this.services.openai) {
        throw new Error("OpenAI no está configurado");
      }

      const {
        model = OPENAI_CONFIG.model,
        maxTokens = OPENAI_CONFIG.maxTokens,
        temperature = OPENAI_CONFIG.temperature,
      } = options;

      const response = await this.services.openai.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        temperature,
      });

      const content = response.choices[0]?.message?.content;

      logger.info("Respuesta de IA generada", {
        model,
        promptLength: prompt.length,
        responseLength: content?.length || 0,
        tokensUsed: response.usage?.total_tokens || 0,
      });

      return {
        success: true,
        content,
        usage: response.usage,
      };
    } catch (error) {
      logger.error("Error generando respuesta de IA", {
        error: error.message,
        prompt: prompt.substring(0, 100) + "...",
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * OPERACIONES DE CALENDLY
   */

  async getCalendlyEvents(userUri = CALENDLY_CONFIG.userUri) {
    try {
      if (!this.services.calendly) {
        throw new Error("Calendly no está configurado");
      }

      const response = await this.services.calendly.makeRequest(
        "/scheduled_events",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${CALENDLY_CONFIG.accessToken}`,
          },
        }
      );

      logger.info("Eventos de Calendly obtenidos", {
        count: response.collection?.length || 0,
      });

      return {
        success: true,
        events: response.collection || [],
      };
    } catch (error) {
      logger.error("Error obteniendo eventos de Calendly", {
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * OPERACIONES COMBINADAS
   */

  async processClientInteraction(clientPhone, message, context = {}) {
    try {
      // 1. Buscar o crear cliente
      let clientResult = await this.findClientByPhone(clientPhone);
      let client = clientResult.data;

      if (!client) {
        // Crear cliente básico
        const insertResult = await this.services.database.insertRecord(
          "clients",
          {
            phone: clientPhone,
            full_name: `Cliente ${clientPhone}`,
            name: "Cliente",
            whatsapp_id: context.whatsappId || null,
          }
        );

        if (insertResult.error) {
          throw new Error(
            `Error creando cliente: ${insertResult.error.message}`
          );
        }

        client = insertResult.data;
        logger.info("Nuevo cliente creado", {
          clientId: client.id,
          phone: clientPhone,
        });
      }

      // 2. Generar respuesta con IA
      const aiPrompt = `
        Cliente: ${client.full_name}
        Teléfono: ${client.phone}
        Mensaje: ${message}
        Contexto: ${JSON.stringify(context)}

        Genera una respuesta profesional y útil para este cliente.
      `;

      const aiResponse = await this.generateAIResponse(aiPrompt);

      // 3. Enviar respuesta por WhatsApp
      let messageResult = null;
      if (aiResponse.success) {
        messageResult = await this.sendWhatsAppMessage(
          clientPhone,
          aiResponse.content
        );
      }

      return {
        success: true,
        client,
        aiResponse: aiResponse.content,
        messageSent: messageResult?.success || false,
        messageId: messageResult?.messageId,
      };
    } catch (error) {
      logger.error("Error procesando interacción del cliente", {
        clientPhone,
        message: message.substring(0, 100),
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Verifica la salud de todas las integraciones
   */
  async healthCheck() {
    const health = {
      overall: true,
      services: {},
    };

    // Base de datos
    const dbHealth = await this.services.database.healthCheck();
    health.services.database = dbHealth;
    if (!dbHealth.healthy) health.overall = false;

    // Twilio
    health.services.twilio = {
      healthy: !!this.services.twilio,
      configured: ConfigManager.isServiceConfigured("twilio"),
    };

    // OpenAI
    health.services.openai = {
      healthy: !!this.services.openai,
      configured: ConfigManager.isServiceConfigured("openai"),
    };

    // Calendly
    health.services.calendly = {
      healthy: !!this.services.calendly,
      configured: ConfigManager.isServiceConfigured("calendly"),
    };

    return health;
  }
}

// Instancia singleton
const integrationManager = new IntegrationManager();

module.exports = {
  integrationManager,
  IntegrationManager,
};
