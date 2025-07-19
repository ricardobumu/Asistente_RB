/**
 * CONTROLADOR DE CALENDLY
 * Lógica de negocio para el manejo de webhooks de Calendly
 *
 * Funcionalidades:
 * - Validación de firma de webhook
 * - Procesamiento de eventos de Calendly
 * - Generación de mensajes con OpenAI
 * - Envío de notificaciones por WhatsApp
 */

const crypto = require("crypto");
const config = require("../config/environment");
const logger = require("../utils/logger");
const { formatPhoneNumber } = require("../utils/phoneNumberFormatter");
const openaiService = require("../services/openaiService");
const twilioService = require("../services/twilioService");
const supabaseService = require("../services/supabaseService");

/**
 * Valida la firma del webhook de Calendly
 * @param {string} payload - Cuerpo del webhook en string
 * @param {string} signature - Firma del header X-Hook-Signature
 * @returns {boolean} - true si la firma es válida
 */
function validateCalendlySignature(payload, signature) {
  if (!config.CALENDLY_SIGNING_KEY || !config.VALIDATE_CALENDLY_SIGNATURE) {
    logger.warn("Validación de firma de Calendly deshabilitada");
    return true;
  }

  if (!signature) {
    logger.security("Calendly webhook sin firma", {
      payload: payload.substring(0, 100),
    });
    return false;
  }

  try {
    // Calendly usa HMAC-SHA256 con el formato: sha256=<hash>
    const expectedSignature = crypto
      .createHmac("sha256", config.CALENDLY_SIGNING_KEY)
      .update(payload, "utf8")
      .digest("hex");

    const receivedSignature = signature.replace("sha256=", "");

    // Comparación segura contra timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(receivedSignature, "hex")
    );

    if (!isValid) {
      logger.security("Firma de Calendly inválida", {
        receivedSignature: receivedSignature.substring(0, 10) + "...",
        expectedSignature: expectedSignature.substring(0, 10) + "...",
      });
    }

    return isValid;
  } catch (error) {
    logger.error("Error validando firma de Calendly", {
      error: error.message,
      signature: signature?.substring(0, 20) + "...",
    });
    return false;
  }
}

/**
 * Extrae datos relevantes del payload de Calendly
 * @param {object} payload - Payload del webhook
 * @returns {object} - Datos extraídos y normalizados
 */
function extractCalendlyData(payload) {
  try {
    const data = {
      event: null,
      invitee: {
        name: null,
        email: null,
        phone_number: null,
      },
      eventDetails: {
        name: null,
        start_time: null,
        end_time: null,
        timezone: null,
      },
      links: {
        cancel_url: null,
        reschedule_url: null,
      },
      raw: payload,
    };

    // Extraer tipo de evento
    data.event = payload.event;

    // Extraer datos del invitado
    if (payload.payload && payload.payload.invitee) {
      const invitee = payload.payload.invitee;
      data.invitee.name = invitee.name;
      data.invitee.email = invitee.email;
      data.invitee.phone_number = invitee.phone_number;
    }

    // Extraer datos del evento
    if (payload.payload && payload.payload.event) {
      const event = payload.payload.event;
      data.eventDetails.name = event.name;
      data.eventDetails.start_time = event.start_time;
      data.eventDetails.end_time = event.end_time;
      data.eventDetails.timezone = event.timezone;
    }

    // Extraer enlaces de cancelación y reprogramación
    if (payload.payload && payload.payload.invitee) {
      data.links.cancel_url = payload.payload.invitee.cancel_url;
      data.links.reschedule_url = payload.payload.invitee.reschedule_url;
    }

    return data;
  } catch (error) {
    logger.error("Error extrayendo datos de Calendly", {
      error: error.message,
      payload: JSON.stringify(payload).substring(0, 500),
    });
    throw error;
  }
}

/**
 * Genera prompt para OpenAI basado en el tipo de evento
 * @param {string} eventType - Tipo de evento (invitee.created, invitee.canceled, etc.)
 * @param {object} data - Datos extraídos del webhook
 * @returns {string} - Prompt para OpenAI
 */
function generatePrompt(eventType, data) {
  const businessInfo = {
    name: config.BUSINESS_NAME,
    phone: config.BUSINESS_PHONE,
    email: config.BUSINESS_EMAIL,
  };

  const basePrompt = `Eres el asistente virtual de ${businessInfo.name}. Responde de manera profesional, amigable y en español. `;

  switch (eventType) {
    case "invitee.created":
      return `${basePrompt}
Un cliente ha reservado una cita. Genera un mensaje de confirmación que incluya:
- Saludo personalizado con el nombre: ${data.invitee.name}
- Confirmación de la cita: ${data.eventDetails.name}
- Fecha y hora: ${data.eventDetails.start_time}
- Enlaces para cancelar o reprogramar si es necesario
- Ofrecimiento de ayuda adicional
- Información de contacto: ${businessInfo.phone}

Mantén un tono profesional pero cercano. Máximo 200 palabras.`;

    case "invitee.canceled":
      return `${basePrompt}
Un cliente ha cancelado su cita. Genera un mensaje que incluya:
- Saludo personalizado con el nombre: ${data.invitee.name}
- Confirmación de la cancelación
- Expresión de comprensión y flexibilidad
- Invitación a reagendar cuando sea conveniente
- Enlace para nueva reserva si está disponible
- Información de contacto: ${businessInfo.phone}

Mantén un tono comprensivo y positivo. Máximo 150 palabras.`;

    case "invitee.rescheduled":
      return `${basePrompt}
Un cliente ha reprogramado su cita. Genera un mensaje que incluya:
- Saludo personalizado con el nombre: ${data.invitee.name}
- Confirmación del cambio de fecha/hora
- Nueva fecha y hora: ${data.eventDetails.start_time}
- Agradecimiento por avisar del cambio
- Enlaces para futuras modificaciones si es necesario
- Información de contacto: ${businessInfo.phone}

Mantén un tono agradecido y profesional. Máximo 180 palabras.`;

    default:
      return `${basePrompt}
Ha ocurrido un evento relacionado con una cita (${eventType}). Genera un mensaje profesional y apropiado para el cliente ${data.invitee.name}.
Incluye información de contacto: ${businessInfo.phone}
Máximo 150 palabras.`;
  }
}

/**
 * Procesa el webhook de Calendly de forma asíncrona
 * @param {object} data - Datos extraídos del webhook
 */
async function processWebhookAsync(data) {
  try {
    logger.calendly("processing_webhook", data.invitee.email, data.event, {
      inviteeName: data.invitee.name,
      eventName: data.eventDetails.name,
      startTime: data.eventDetails.start_time,
    });

    // 1. Formatear número de teléfono
    const formattedPhone = formatPhoneNumber(data.invitee.phone_number);

    if (!formattedPhone) {
      logger.warn("Número de teléfono inválido en webhook de Calendly", {
        originalPhone: data.invitee.phone_number,
        inviteeName: data.invitee.name,
        inviteeEmail: data.invitee.email,
      });
      return;
    }

    // 2. Generar prompt para OpenAI
    const prompt = generatePrompt(data.event, data);

    // 3. Obtener respuesta de OpenAI
    const messageContent = await openaiService.generateResponse(prompt, {
      maxTokens: 300,
      temperature: 0.7,
    });

    if (!messageContent) {
      logger.error("OpenAI no generó respuesta para webhook de Calendly", {
        event: data.event,
        inviteeName: data.invitee.name,
      });
      return;
    }

    // 4. Enviar mensaje por WhatsApp
    const messageResult = await twilioService.sendWhatsAppMessage(
      formattedPhone,
      messageContent
    );

    if (messageResult.success) {
      logger.calendly("message_sent", data.invitee.email, data.event, {
        phoneNumber: formattedPhone,
        messageId: messageResult.messageId,
        messageLength: messageContent.length,
      });
    } else {
      logger.error("Error enviando mensaje de WhatsApp para Calendly", {
        error: messageResult.error,
        phoneNumber: formattedPhone,
        event: data.event,
      });
    }

    // 5. Guardar en base de datos para auditoría
    await supabaseService.saveCalendlyEvent({
      event_type: data.event,
      invitee_name: data.invitee.name,
      invitee_email: data.invitee.email,
      invitee_phone: formattedPhone,
      event_name: data.eventDetails.name,
      event_start_time: data.eventDetails.start_time,
      message_sent: messageResult.success,
      message_content: messageContent,
      message_id: messageResult.messageId,
      processed_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error procesando webhook de Calendly de forma asíncrona", {
      error: error.message,
      stack: error.stack,
      event: data.event,
      inviteeName: data.invitee.name,
    });
  }
}

/**
 * Controlador principal para manejar webhooks de Calendly
 */
const handleWebhook = async (req, res) => {
  const startTime = Date.now();

  try {
    // 1. Responder rápidamente a Calendly (importante para evitar reintentos)
    res.status(200).json({
      success: true,
      message: "Webhook recibido correctamente",
      timestamp: new Date().toISOString(),
    });

    // 2. Validar firma del webhook (si está habilitada)
    const signature = req.get("X-Hook-Signature");
    const payload = JSON.stringify(req.body);

    if (!validateCalendlySignature(payload, signature)) {
      logger.security("Webhook de Calendly con firma inválida rechazado", {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        hasSignature: !!signature,
      });
      return;
    }

    // 3. Extraer datos del webhook
    const data = extractCalendlyData(req.body);

    // 4. Validar que tenemos los datos mínimos necesarios
    if (!data.event || !data.invitee.name) {
      logger.warn("Webhook de Calendly con datos insuficientes", {
        event: data.event,
        hasInviteeName: !!data.invitee.name,
        hasPhone: !!data.invitee.phone_number,
      });
      return;
    }

    // 5. Procesar solo eventos que nos interesan
    const supportedEvents = [
      "invitee.created",
      "invitee.canceled",
      "invitee.rescheduled",
    ];

    if (!supportedEvents.includes(data.event)) {
      logger.info("Evento de Calendly no soportado ignorado", {
        event: data.event,
        supportedEvents,
      });
      return;
    }

    // 6. Procesar webhook de forma asíncrona (no bloquear respuesta)
    setImmediate(() => processWebhookAsync(data));

    // 7. Log de éxito
    const processingTime = Date.now() - startTime;
    logger.performance("calendly_webhook_handled", processingTime, {
      event: data.event,
      inviteeName: data.invitee.name,
      hasPhone: !!data.invitee.phone_number,
    });
  } catch (error) {
    logger.error("Error manejando webhook de Calendly", {
      error: error.message,
      stack: error.stack,
      body: JSON.stringify(req.body).substring(0, 500),
      ip: req.ip,
    });

    // No cambiar la respuesta ya enviada, solo loguear el error
  }
};

/**
 * Obtener estadísticas de webhooks procesados
 */
const getWebhookStats = async (req, res) => {
  try {
    const stats = await supabaseService.getCalendlyStats();

    res.status(200).json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error obteniendo estadísticas de Calendly", {
      error: error.message,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error obteniendo estadísticas",
      timestamp: new Date().toISOString(),
    });
  }
};

module.exports = {
  handleWebhook,
  getWebhookStats,
  validateCalendlySignature,
  extractCalendlyData,
  generatePrompt,
};
