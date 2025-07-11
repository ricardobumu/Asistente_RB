// src/services/whatsappService.js
// Servicio especializado para WhatsApp con IA y gestión de conversaciones

const openaiClient = require("../integrations/openaiClient");
const bookingService = require("./bookingService");
const notificationService = require("./notificationService");
const clientModel = require("../models/clientModel");
const serviceModel = require("../models/serviceModel");
const logger = require("../utils/logger");

class WhatsAppService {
  constructor() {
    this.conversationContext = new Map(); // Cache de contexto de conversaciones
    this.supportedCommands = {
      AGENDAR: ["agendar", "reservar", "cita", "appointment"],
      CANCELAR: ["cancelar", "cancel"],
      CONSULTAR: ["consultar", "ver", "mis citas"],
      SERVICIOS: ["servicios", "precios", "treatments"],
      AYUDA: ["ayuda", "help", "info"],
    };
  }

  /**
   * Procesar mensaje entrante de WhatsApp
   */
  async processIncomingMessage(from, body, messageId) {
    try {
      logger.info("📱 Procesando mensaje WhatsApp", {
        from,
        messageId,
        preview: body.substring(0, 50),
      });

      // Limpiar y normalizar el mensaje
      const cleanMessage = this.cleanMessage(body);

      // Obtener o crear cliente
      const client = await this.getOrCreateClient(from);

      // Detectar intención del mensaje
      const intent = await this.detectIntent(cleanMessage, client);

      // Procesar según la intención
      const response = await this.processIntent(intent, cleanMessage, client);

      // Enviar respuesta
      await this.sendResponse(from, response);

      // Guardar conversación
      await this.saveConversation(
        client.id_cliente,
        cleanMessage,
        response,
        intent,
      );

      return { success: true, intent, response };
    } catch (error) {
      logger.error("❌ Error procesando mensaje WhatsApp:", error);

      // Enviar mensaje de error al usuario
      await this.sendResponse(
        from,
        "Lo siento, ha ocurrido un error técnico. Por favor, inténtalo de nuevo en unos minutos o contacta directamente conmigo.",
      );

      // Alertar al administrador
      await notificationService.sendAdminAlert(
        `Error procesando mensaje WhatsApp de ${from}: ${error.message}`,
        "high",
      );

      return { success: false, error: error.message };
    }
  }

  /**
   * Detectar intención del mensaje usando IA
   */
  async detectIntent(message, client) {
    try {
      // Obtener contexto de conversación
      const context = this.getConversationContext(client.id_cliente);

      const prompt = `
Eres un asistente de belleza profesional. Analiza este mensaje y determina la intención:

Mensaje: "${message}"
Cliente: ${client.nombre}
Contexto previo: ${context.lastIntent || "ninguno"}

Intenciones posibles:
- AGENDAR: Quiere reservar una cita
- CANCELAR: Quiere cancelar una cita
- CONSULTAR: Quiere ver sus citas
- SERVICIOS: Pregunta sobre servicios/precios
- REPROGRAMAR: Quiere cambiar fecha de cita
- CONSULTA_GENERAL: Pregunta general sobre belleza
- HABLAR_CON_RICARDO: Quiere hablar directamente conmigo
- SALUDO: Solo saluda
- OTRO: No está claro

Responde solo con la intención en mayúsculas.
`;

      const completion = await openaiClient.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 50,
        temperature: 0.3,
      });

      const intent = completion.choices[0].message.content.trim().toUpperCase();

      logger.info("🧠 Intención detectada", {
        clientId: client.id_cliente,
        intent,
        message: message.substring(0, 30),
      });

      return intent;
    } catch (error) {
      logger.error("❌ Error detectando intención:", error);
      return "OTRO";
    }
  }

  /**
   * Procesar intención y generar respuesta
   */
  async processIntent(intent, message, client) {
    try {
      switch (intent) {
        case "AGENDAR":
          return await this.handleBookingRequest(message, client);

        case "CANCELAR":
          return await this.handleCancellationRequest(message, client);

        case "CONSULTAR":
          return await this.handleBookingInquiry(client);

        case "SERVICIOS":
          return await this.handleServicesInquiry(message);

        case "REPROGRAMAR":
          return await this.handleRescheduleRequest(message, client);

        case "CONSULTA_GENERAL":
          return await this.handleGeneralInquiry(message, client);

        case "HABLAR_CON_RICARDO":
          return await this.handleDirectContactRequest(message, client);

        case "SALUDO":
          return this.handleGreeting(client);

        default:
          return await this.handleUnknownIntent(message, client);
      }
    } catch (error) {
      logger.error("❌ Error procesando intención:", error);
      return "Disculpa, no pude procesar tu solicitud. ¿Podrías reformularla?";
    }
  }

  /**
   * Manejar solicitud de reserva
   */
  async handleBookingRequest(message, client) {
    try {
      // Extraer información de la solicitud usando IA
      const bookingInfo = await this.extractBookingInfo(message);

      if (bookingInfo.service && bookingInfo.date) {
        // Intentar crear la reserva
        const result = await bookingService.createBooking({
          client_id: client.id_cliente,
          service_id: bookingInfo.service_id,
          date: bookingInfo.date,
          time: bookingInfo.time,
        });

        if (result.success) {
          return `✅ ¡Perfecto! He agendado tu cita:

📅 *Fecha:* ${bookingInfo.date}
🕐 *Hora:* ${bookingInfo.time}
💇‍♀️ *Servicio:* ${bookingInfo.service}
💰 *Precio:* €${result.data.precio}

Te enviaré un recordatorio 24h antes. ¡Te espero! ✨`;
        } else {
          return `❌ No pude agendar la cita: ${result.error}

¿Te gustaría que te muestre horarios disponibles?`;
        }
      } else {
        // Solicitar más información
        const services = await serviceModel.getAll();
        const servicesList = services.data
          .filter((s) => s.activo)
          .slice(0, 5)
          .map((s) => `• ${s.nombre} - €${s.precio}`)
          .join("\n");

        return `Para agendar tu cita necesito más información:

*Servicios disponibles:*
${servicesList}

Por favor, dime:
1. ¿Qué servicio te interesa?
2. ¿Qué día prefieres?
3. ¿Tienes preferencia de horario?`;
      }
    } catch (error) {
      logger.error("❌ Error manejando solicitud de reserva:", error);
      return "Hubo un problema procesando tu solicitud de cita. ¿Podrías intentarlo de nuevo?";
    }
  }

  /**
   * Manejar consulta de servicios
   */
  async handleServicesInquiry(message) {
    try {
      const services = await serviceModel.getAll();

      if (!services.success) {
        return "Lo siento, no pude obtener la información de servicios en este momento.";
      }

      // Agrupar por categoría
      const servicesByCategory = {};
      services.data
        .filter((s) => s.activo)
        .forEach((service) => {
          if (!servicesByCategory[service.categoria]) {
            servicesByCategory[service.categoria] = [];
          }
          servicesByCategory[service.categoria].push(service);
        });

      let response = "*💇‍♀️ MIS SERVICIOS DE BELLEZA*\n\n";

      Object.entries(servicesByCategory).forEach(([categoria, servicios]) => {
        response += `*${categoria}:*\n`;
        servicios.forEach((servicio) => {
          response += `• ${servicio.nombre} - €${servicio.precio} (${servicio.duracion}min)\n`;
        });
        response += "\n";
      });

      response +=
        "¿Te interesa algún servicio en particular? ¡Puedo ayudarte a agendar! 📅";

      return response;
    } catch (error) {
      logger.error("❌ Error manejando consulta de servicios:", error);
      return "Lo siento, no pude obtener la información de servicios. Inténtalo de nuevo.";
    }
  }

  /**
   * Manejar solicitud de contacto directo
   */
  async handleDirectContactRequest(message, client) {
    try {
      // Notificar al administrador
      await notificationService.sendAdminAlert(
        `Cliente ${client.nombre} (${client.telefono}) quiere hablar contigo:\n\n"${message}"`,
        "normal",
      );

      return `Perfecto ${client.nombre}, he notificado a Ricardo sobre tu solicitud. Te contactará lo antes posible.

Mientras tanto, ¿hay algo en lo que pueda ayudarte? Puedo:
• Mostrarte los servicios disponibles
• Ayudarte a agendar una cita
• Consultar tus citas existentes`;
    } catch (error) {
      logger.error("❌ Error manejando contacto directo:", error);
      return "He registrado tu solicitud. Ricardo te contactará pronto.";
    }
  }

  /**
   * Manejar saludo
   */
  handleGreeting(client) {
    const hour = new Date().getHours();
    let greeting = "Hola";

    if (hour < 12) greeting = "Buenos días";
    else if (hour < 18) greeting = "Buenas tardes";
    else greeting = "Buenas noches";

    return `${greeting} ${client.nombre}! 👋

Soy el asistente virtual de Ricardo Buriticá. ¿En qué puedo ayudarte hoy?

Puedo ayudarte con:
• 📅 Agendar una cita
• 💇‍♀️ Información sobre servicios
• 📋 Consultar tus citas
• ❌ Cancelar o reprogramar

¿Qué necesitas?`;
  }

  /**
   * Obtener o crear cliente
   */
  async getOrCreateClient(phone) {
    try {
      // Buscar cliente existente
      let result = await clientModel.findByPhone(phone);

      if (result.success && result.data) {
        return result.data;
      }

      // Crear nuevo cliente
      const newClient = {
        telefono: phone,
        nombre: "Cliente WhatsApp",
        email: null,
        fecha_registro: new Date().toISOString(),
      };

      result = await clientModel.create(newClient);

      if (result.success) {
        logger.info("👤 Nuevo cliente creado desde WhatsApp", {
          clientId: result.data.id_cliente,
          phone,
        });
        return result.data;
      } else {
        throw new Error("No se pudo crear el cliente");
      }
    } catch (error) {
      logger.error("❌ Error obteniendo/creando cliente:", error);
      throw error;
    }
  }

  /**
   * Enviar respuesta por WhatsApp
   */
  async sendResponse(to, message) {
    try {
      return await notificationService.sendWhatsAppMessage(to, message);
    } catch (error) {
      logger.error("❌ Error enviando respuesta WhatsApp:", error);
      throw error;
    }
  }

  /**
   * Limpiar mensaje
   */
  cleanMessage(message) {
    return message
      .trim()
      .toLowerCase()
      .replace(/[^\w\sáéíóúñ]/g, " ")
      .replace(/\s+/g, " ");
  }

  /**
   * Obtener contexto de conversación
   */
  getConversationContext(clientId) {
    return this.conversationContext.get(clientId) || {};
  }

  /**
   * Actualizar contexto de conversación
   */
  updateConversationContext(clientId, intent, data = {}) {
    this.conversationContext.set(clientId, {
      lastIntent: intent,
      timestamp: Date.now(),
      ...data,
    });
  }

  /**
   * Guardar conversación (implementar según necesidades)
   */
  async saveConversation(clientId, message, response, intent) {
    try {
      // Aquí se podría guardar en BD si se requiere historial
      logger.info("💬 Conversación guardada", {
        clientId,
        intent,
        messageLength: message.length,
        responseLength: response.length,
      });
    } catch (error) {
      logger.error("❌ Error guardando conversación:", error);
    }
  }

  /**
   * Extraer información de reserva del mensaje (placeholder)
   */
  async extractBookingInfo(message) {
    // Implementar lógica de extracción con IA
    return {
      service: null,
      service_id: null,
      date: null,
      time: null,
    };
  }

  /**
   * Manejar intención desconocida
   */
  async handleUnknownIntent(message, client) {
    return `No estoy seguro de cómo ayudarte con eso, ${client.nombre}. 

¿Podrías decirme si quieres:
• 📅 Agendar una cita
• 💇‍♀️ Ver servicios y precios
• 📋 Consultar tus citas
• 💬 Hablar directamente con Ricardo

O escribe "ayuda" para ver todas las opciones.`;
  }

  // Métodos adicionales para otras intenciones...
  async handleCancellationRequest(message, client) {
    return "Para cancelar una cita, necesito más información. ¿Podrías decirme qué cita quieres cancelar?";
  }

  async handleBookingInquiry(client) {
    return "Consultando tus citas... Esta funcionalidad se completará pronto.";
  }

  async handleRescheduleRequest(message, client) {
    return "Para reprogramar una cita, necesito saber cuál quieres cambiar y para cuándo.";
  }

  async handleGeneralInquiry(message, client) {
    return "Esa es una buena pregunta. ¿Te gustaría que Ricardo te contacte directamente para darte una respuesta más detallada?";
  }
}

module.exports = new WhatsAppService();
