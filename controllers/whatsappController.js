/**
 * CONTROLADOR DE WHATSAPP
 * Lógica de negocio para el manejo de mensajes de WhatsApp
 *
 * Funcionalidades:
 * - Procesamiento de mensajes entrantes
 * - Generación de respuestas con OpenAI
 * - Gestión de contexto conversacional
 * - Envío de mensajes
 * - Validación de firma de Twilio
 */

const crypto = require("crypto");
const config = require("../config/environment");
const logger = require("../utils/logger");
const { formatPhoneNumber } = require("../utils/phoneNumberFormatter");
const openaiService = require("../services/openaiService");
const twilioService = require("../services/twilioService");
const contextService = require("../services/contextService");
const supabaseService = require("../services/supabaseService");

/**
 * Valida la firma del webhook de Twilio
 * @param {object} req - Request object
 * @returns {boolean} - true si la firma es válida
 */
function validateTwilioSignature(req) {
  if (!config.TWILIO_AUTH_TOKEN || !config.VALIDATE_TWILIO_SIGNATURE) {
    logger.warn("Validación de firma de Twilio deshabilitada");
    return true;
  }

  const signature = req.get("X-Twilio-Signature");
  if (!signature) {
    logger.security("Webhook de Twilio sin firma", {
      ip: req.ip,
      from: req.body?.From,
    });
    return false;
  }

  try {
    // Construir URL completa del webhook
    const protocol = req.get("X-Forwarded-Proto") || req.protocol;
    const host = req.get("Host");
    const url = `${protocol}://${host}${req.originalUrl}`;

    // Crear string para validación (URL + parámetros ordenados)
    const params = new URLSearchParams();
    Object.keys(req.body)
      .sort()
      .forEach((key) => {
        params.append(key, req.body[key]);
      });

    const data = url + params.toString();

    // Generar firma esperada
    const expectedSignature = crypto
      .createHmac("sha1", config.TWILIO_AUTH_TOKEN)
      .update(data, "utf8")
      .digest("base64");

    // Comparación segura
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, "base64"),
      Buffer.from(expectedSignature, "base64")
    );

    if (!isValid) {
      logger.security("Firma de Twilio inválida", {
        url,
        receivedSignature: signature.substring(0, 20) + "...",
        expectedSignature: expectedSignature.substring(0, 20) + "...",
        ip: req.ip,
      });
    }

    return isValid;
  } catch (error) {
    logger.error("Error validando firma de Twilio", {
      error: error.message,
      signature: signature?.substring(0, 20) + "...",
    });
    return false;
  }
}

/**
 * Extrae y normaliza datos del webhook de Twilio
 * @param {object} body - Body del webhook
 * @returns {object} - Datos extraídos y normalizados
 */
function extractWhatsAppData(body) {
  try {
    // Extraer número de teléfono (quitar prefijo whatsapp:)
    const from = body.From.replace("whatsapp:", "");
    const to = body.To.replace("whatsapp:", "");

    const data = {
      from: formatPhoneNumber(from),
      to: formatPhoneNumber(to),
      body: body.Body || "",
      messageType: body.MessageType || "text",
      messageId: body.MessageSid || body.SmsMessageSid,
      timestamp: new Date().toISOString(),
      media: {
        hasMedia: false,
        mediaUrl: null,
        mediaType: null,
        mediaSize: null,
      },
      location: {
        hasLocation: false,
        latitude: null,
        longitude: null,
        address: null,
      },
      raw: body,
    };

    // Procesar media si existe
    if (body.NumMedia && parseInt(body.NumMedia) > 0) {
      data.media.hasMedia = true;
      data.media.mediaUrl = body.MediaUrl0;
      data.media.mediaType = body.MediaContentType0;
      data.media.mediaSize = body.MediaSize0;
    }

    // Procesar ubicación si existe
    if (body.Latitude && body.Longitude) {
      data.location.hasLocation = true;
      data.location.latitude = parseFloat(body.Latitude);
      data.location.longitude = parseFloat(body.Longitude);
      data.location.address = body.Address;
    }

    return data;
  } catch (error) {
    logger.error("Error extrayendo datos de WhatsApp", {
      error: error.message,
      body: JSON.stringify(body).substring(0, 300),
    });
    throw error;
  }
}

/**
 * Genera prompt contextual para OpenAI
 * @param {string} message - Mensaje del usuario
 * @param {string} phoneNumber - Número de teléfono del usuario
 * @param {array} context - Contexto de conversación anterior
 * @returns {string} - Prompt para OpenAI
 */
async function generateContextualPrompt(message, phoneNumber, context = []) {
  const businessInfo = {
    name: config.BUSINESS_NAME,
    phone: config.BUSINESS_PHONE,
    email: config.BUSINESS_EMAIL,
    address: config.BUSINESS_ADDRESS,
  };

  // Obtener información del cliente si existe
  let clientInfo = null;
  try {
    clientInfo = await supabaseService.getClientByPhone(phoneNumber);
  } catch (error) {
    logger.warn("No se pudo obtener información del cliente", {
      phoneNumber,
      error: error.message,
    });
  }

  let basePrompt = `Eres el asistente virtual autónomo de ${businessInfo.name}.

INFORMACIÓN DEL NEGOCIO:
- Nombre: ${businessInfo.name}
- Teléfono: ${businessInfo.phone}
- Email: ${businessInfo.email}
- Dirección: ${businessInfo.address}

INSTRUCCIONES:
- Responde en español de manera profesional, amigable y útil
- Puedes ayudar con reservas, información de servicios, consultas generales
- Si necesitas agendar una cita, puedes proporcionar el enlace de Calendly
- Mantén las respuestas concisas pero completas
- Si no puedes resolver algo, ofrece contactar directamente

`;

  // Agregar información del cliente si está disponible
  if (clientInfo) {
    basePrompt += `INFORMACIÓN DEL CLIENTE:
- Nombre: ${clientInfo.name || "No disponible"}
- Email: ${clientInfo.email || "No disponible"}
- Cliente desde: ${clientInfo.created_at ? new Date(clientInfo.created_at).toLocaleDateString("es-ES") : "Desconocido"}

`;
  }

  // Agregar contexto de conversación si existe
  if (context && context.length > 0) {
    basePrompt += `CONTEXTO DE CONVERSACIÓN ANTERIOR:\n`;
    context.slice(-5).forEach((msg, index) => {
      // Solo últimos 5 mensajes
      const role = msg.role === "user" ? "Cliente" : "Asistente";
      basePrompt += `${role}: ${msg.content}\n`;
    });
    basePrompt += "\n";
  }

  basePrompt += `MENSAJE ACTUAL DEL CLIENTE: "${message}"

Responde de manera apropiada al mensaje del cliente. Máximo 300 palabras.`;

  return basePrompt;
}

/**
 * Procesa mensaje de WhatsApp de forma asíncrona
 * @param {object} data - Datos del mensaje extraídos
 */
async function processMessageAsync(data) {
  try {
    logger.whatsapp("processing_message", data.from, data.body, {
      messageType: data.messageType,
      hasMedia: data.media.hasMedia,
      messageLength: data.body.length,
    });

    // 1. Obtener contexto de conversación
    const context = await contextService.getContext(data.from);

    // 2. Agregar mensaje del usuario al contexto
    await contextService.addMessage(data.from, "user", data.body, {
      messageId: data.messageId,
      messageType: data.messageType,
      hasMedia: data.media.hasMedia,
    });

    // 3. Generar prompt contextual
    const prompt = await generateContextualPrompt(
      data.body,
      data.from,
      context
    );

    // 4. Obtener respuesta de OpenAI
    const response = await openaiService.generateResponse(prompt, {
      maxTokens: 500,
      temperature: 0.8,
    });

    if (!response) {
      logger.error("OpenAI no generó respuesta para mensaje de WhatsApp", {
        from: data.from,
        messageBody: data.body.substring(0, 100),
      });

      // Respuesta de fallback
      const fallbackResponse = `Disculpa, estoy experimentando dificultades técnicas en este momento. Por favor, contacta directamente a ${config.BUSINESS_PHONE} o ${config.BUSINESS_EMAIL} para asistencia inmediata.`;

      await twilioService.sendWhatsAppMessage(data.from, fallbackResponse);
      return;
    }

    // 5. Enviar respuesta por WhatsApp
    const messageResult = await twilioService.sendWhatsAppMessage(
      data.from,
      response
    );

    if (messageResult.success) {
      // 6. Agregar respuesta del asistente al contexto
      await contextService.addMessage(data.from, "assistant", response, {
        messageId: messageResult.messageId,
        tokens: messageResult.tokens,
      });

      logger.whatsapp("response_sent", data.from, response, {
        messageId: messageResult.messageId,
        responseLength: response.length,
        tokens: messageResult.tokens,
      });
    } else {
      logger.error("Error enviando respuesta de WhatsApp", {
        error: messageResult.error,
        from: data.from,
        responseLength: response.length,
      });
    }

    // 7. Guardar conversación en base de datos
    await supabaseService.saveWhatsAppConversation({
      phone_number: data.from,
      message_in: data.body,
      message_out: response,
      message_in_id: data.messageId,
      message_out_id: messageResult.messageId,
      message_type: data.messageType,
      has_media: data.media.hasMedia,
      processed_at: new Date().toISOString(),
      success: messageResult.success,
    });
  } catch (error) {
    logger.error("Error procesando mensaje de WhatsApp de forma asíncrona", {
      error: error.message,
      stack: error.stack,
      from: data.from,
      messageBody: data.body.substring(0, 100),
    });

    // Intentar enviar mensaje de error al usuario
    try {
      const errorMessage = `Disculpa, ha ocurrido un error procesando tu mensaje. Por favor, intenta de nuevo o contacta directamente a ${config.BUSINESS_PHONE}.`;
      await twilioService.sendWhatsAppMessage(data.from, errorMessage);
    } catch (sendError) {
      logger.error("Error enviando mensaje de error", {
        sendError: sendError.message,
        from: data.from,
      });
    }
  }
}

/**
 * Controlador principal para mensajes entrantes de WhatsApp
 */
const handleIncomingMessage = async (req, res) => {
  const startTime = Date.now();

  try {
    // 1. Responder rápidamente a Twilio (importante para evitar reintentos)
    res
      .status(200)
      .send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

    // 2. Validar firma del webhook (si está habilitada)
    if (!validateTwilioSignature(req)) {
      logger.security("Webhook de Twilio con firma inválida rechazado", {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        from: req.body?.From,
      });
      return;
    }

    // 3. Extraer datos del webhook
    const data = extractWhatsAppData(req.body);

    // 4. Validar datos mínimos
    if (!data.from || !data.body.trim()) {
      logger.warn("Mensaje de WhatsApp con datos insuficientes", {
        from: data.from,
        hasBody: !!data.body,
        messageType: data.messageType,
      });
      return;
    }

    // 5. Filtrar mensajes del propio bot (evitar loops)
    if (data.from === config.TWILIO_WHATSAPP_NUMBER) {
      logger.info("Mensaje del propio bot ignorado", { from: data.from });
      return;
    }

    // 6. Procesar mensaje de forma asíncrona (no bloquear respuesta)
    setImmediate(() => processMessageAsync(data));

    // 7. Log de éxito
    const processingTime = Date.now() - startTime;
    logger.performance("whatsapp_message_handled", processingTime, {
      from: data.from,
      messageType: data.messageType,
      messageLength: data.body.length,
      hasMedia: data.media.hasMedia,
    });
  } catch (error) {
    logger.error("Error manejando mensaje entrante de WhatsApp", {
      error: error.message,
      stack: error.stack,
      body: JSON.stringify(req.body).substring(0, 500),
      ip: req.ip,
    });

    // No cambiar la respuesta ya enviada, solo loguear el error
  }
};

/**
 * Envío manual de mensajes (para administradores)
 */
const sendMessage = async (req, res) => {
  try {
    const { to, message, messageType = "text" } = req.body;

    // Validar datos de entrada
    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Los campos "to" y "message" son requeridos',
      });
    }

    // Formatear número de teléfono
    const formattedPhone = formatPhoneNumber(to);
    if (!formattedPhone) {
      return res.status(400).json({
        success: false,
        error: "Número de teléfono inválido",
      });
    }

    // Enviar mensaje
    const result = await twilioService.sendWhatsAppMessage(
      formattedPhone,
      message
    );

    if (result.success) {
      // Guardar en contexto como mensaje del asistente
      await contextService.addMessage(formattedPhone, "assistant", message, {
        messageId: result.messageId,
        manual: true,
        sentBy: "admin",
      });

      logger.whatsapp("manual_message_sent", formattedPhone, message, {
        messageId: result.messageId,
        sentBy: req.ip,
      });

      res.status(200).json({
        success: true,
        messageId: result.messageId,
        to: formattedPhone,
        message,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error("Error enviando mensaje manual de WhatsApp", {
      error: error.message,
      body: req.body,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Obtener conversaciones activas
 */
const getActiveConversations = async (req, res) => {
  try {
    const conversations = await contextService.getActiveConversations();

    res.status(200).json({
      success: true,
      data: conversations,
      count: conversations.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error obteniendo conversaciones activas", {
      error: error.message,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error obteniendo conversaciones",
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Obtener historial de conversación específica
 */
const getConversationHistory = async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (!formattedPhone) {
      return res.status(400).json({
        success: false,
        error: "Número de teléfono inválido",
      });
    }

    const history = await contextService.getContext(formattedPhone, {
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.status(200).json({
      success: true,
      data: history,
      phoneNumber: formattedPhone,
      count: history.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error obteniendo historial de conversación", {
      error: error.message,
      phoneNumber: req.params.phoneNumber,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error obteniendo historial",
      timestamp: new Date().toISOString(),
    });
  }
};

module.exports = {
  handleIncomingMessage,
  sendMessage,
  getActiveConversations,
  getConversationHistory,
  validateTwilioSignature,
  extractWhatsAppData,
  generateContextualPrompt,
};
