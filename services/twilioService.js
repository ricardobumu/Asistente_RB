/**
 * SERVICIO DE TWILIO
 * Cliente para enviar mensajes de WhatsApp a través de Twilio
 *
 * Funcionalidades:
 * - Envío de mensajes de WhatsApp
 * - Validación de números de teléfono
 * - Retry automático con backoff exponencial
 * - Rate limiting interno
 * - Métricas y logging
 */

const twilio = require("twilio");
const config = require("../config/environment");
const logger = require("../utils/logger");
const {
  formatPhoneNumber,
  validatePhoneNumber,
} = require("../utils/phoneNumberFormatter");

// Inicializar cliente de Twilio
let twilioClient = null;

if (config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
} else {
  logger.warn(
    "Credenciales de Twilio no configuradas - servicio deshabilitado"
  );
}

// Rate limiting interno para evitar exceder límites de Twilio
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto
const MAX_MESSAGES_PER_MINUTE = 10; // Por número de teléfono

// Métricas del servicio
const metrics = {
  messagesSent: 0,
  messagesSuccessful: 0,
  messagesFailed: 0,
  totalCost: 0,
  lastReset: Date.now(),
};

/**
 * Verifica si un número está dentro del rate limit
 * @param {string} phoneNumber - Número de teléfono
 * @returns {boolean} - true si puede enviar, false si está limitado
 */
function checkRateLimit(phoneNumber) {
  const now = Date.now();
  const key = phoneNumber;

  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, { count: 0, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  const limit = rateLimitMap.get(key);

  // Resetear contador si ha pasado la ventana
  if (now > limit.resetTime) {
    limit.count = 0;
    limit.resetTime = now + RATE_LIMIT_WINDOW;
  }

  // Verificar si está dentro del límite
  if (limit.count >= MAX_MESSAGES_PER_MINUTE) {
    logger.warn("Rate limit alcanzado para número", {
      phoneNumber,
      count: limit.count,
      resetIn: Math.round((limit.resetTime - now) / 1000) + "s",
    });
    return false;
  }

  limit.count++;
  return true;
}

/**
 * Limpia entradas expiradas del rate limit
 */
function cleanRateLimit() {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

/**
 * Calcula el costo aproximado de un mensaje
 * @param {string} messageBody - Contenido del mensaje
 * @param {string} countryCode - Código de país del destinatario
 * @returns {number} - Costo estimado en USD
 */
function calculateMessageCost(messageBody, countryCode = "+34") {
  // Precios aproximados de WhatsApp Business API (actualizar según precios actuales)
  const baseCosts = {
    "+34": 0.0042, // España
    "+33": 0.0055, // Francia
    "+1": 0.0055, // Estados Unidos
    "+52": 0.0065, // México
    default: 0.005,
  };

  const baseCost = baseCosts[countryCode] || baseCosts.default;

  // Costo adicional por caracteres (aproximado)
  const messageLength = messageBody.length;
  const segments = Math.ceil(messageLength / 160); // SMS segments

  return baseCost * segments;
}

/**
 * Implementa retry con backoff exponencial
 * @param {function} fn - Función a ejecutar
 * @param {number} maxRetries - Número máximo de reintentos
 * @param {number} baseDelay - Delay base en ms
 * @returns {Promise} - Resultado de la función
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      // Calcular delay con backoff exponencial + jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;

      logger.warn(
        `Intento ${attempt + 1} fallido, reintentando en ${Math.round(delay)}ms`,
        {
          error: error.message,
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
        }
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Envía un mensaje de WhatsApp
 * @param {string} to - Número de teléfono destinatario
 * @param {string} body - Contenido del mensaje
 * @param {object} options - Opciones adicionales
 * @returns {object} - Resultado del envío
 */
async function sendWhatsAppMessage(to, body, options = {}) {
  const startTime = Date.now();

  try {
    // Validar que Twilio esté configurado
    if (!twilioClient) {
      logger.error("Twilio no está configurado");
      return {
        success: false,
        error: "Servicio de mensajería no configurado",
        messageId: null,
      };
    }

    // Validar y formatear número de teléfono
    const formattedTo = formatPhoneNumber(to);
    if (!formattedTo || !validatePhoneNumber(formattedTo)) {
      logger.error("Número de teléfono inválido", { to, formattedTo });
      return {
        success: false,
        error: "Número de teléfono inválido",
        messageId: null,
      };
    }

    // Validar contenido del mensaje
    if (!body || typeof body !== "string" || body.trim().length === 0) {
      logger.error("Contenido del mensaje inválido", { body });
      return {
        success: false,
        error: "Contenido del mensaje inválido",
        messageId: null,
      };
    }

    // Verificar rate limit
    if (!checkRateLimit(formattedTo)) {
      return {
        success: false,
        error: "Rate limit excedido para este número",
        messageId: null,
      };
    }

    // Preparar mensaje
    const messageBody = body.trim();
    const whatsappTo = `whatsapp:${formattedTo}`;
    const whatsappFrom = `whatsapp:${config.TWILIO_WHATSAPP_NUMBER}`;

    // Configuración del mensaje
    const messageConfig = {
      body: messageBody,
      from: whatsappFrom,
      to: whatsappTo,
      ...options,
    };

    logger.info("Enviando mensaje de WhatsApp", {
      to: formattedTo,
      messageLength: messageBody.length,
      from: config.TWILIO_WHATSAPP_NUMBER,
    });

    // Enviar mensaje con retry
    const message = await retryWithBackoff(
      async () => {
        return await twilioClient.messages.create(messageConfig);
      },
      3,
      1000
    );

    // Calcular métricas
    const processingTime = Date.now() - startTime;
    const cost = calculateMessageCost(messageBody, formattedTo.substring(0, 3));

    // Actualizar métricas
    metrics.messagesSent++;
    metrics.messagesSuccessful++;
    metrics.totalCost += cost;

    // Log de éxito
    logger.info("Mensaje de WhatsApp enviado exitosamente", {
      messageId: message.sid,
      to: formattedTo,
      status: message.status,
      processingTime,
      cost: cost.toFixed(6),
      messageLength: messageBody.length,
    });

    return {
      success: true,
      messageId: message.sid,
      status: message.status,
      to: formattedTo,
      cost,
      processingTime,
      error: null,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;

    // Actualizar métricas de error
    metrics.messagesSent++;
    metrics.messagesFailed++;

    // Log detallado del error
    logger.error("Error enviando mensaje de WhatsApp", {
      error: error.message,
      code: error.code,
      status: error.status,
      moreInfo: error.moreInfo,
      to: to,
      processingTime,
      messageLength: body?.length || 0,
    });

    // Manejar errores específicos de Twilio
    let errorMessage = "Error enviando mensaje";

    if (error.code === 21211) {
      errorMessage = "Número de teléfono inválido";
    } else if (error.code === 21408) {
      errorMessage = "No se puede enviar a este número (opt-out)";
    } else if (error.code === 21610) {
      errorMessage = "Mensaje bloqueado por filtros de contenido";
    } else if (error.code === 21614) {
      errorMessage = "Número no válido para WhatsApp";
    } else if (error.code === 63007) {
      errorMessage = "Número no registrado en WhatsApp";
    } else if (error.status === 429) {
      errorMessage = "Rate limit de Twilio excedido";
    } else if (error.status >= 500) {
      errorMessage = "Error temporal del servicio";
    }

    return {
      success: false,
      error: errorMessage,
      messageId: null,
      code: error.code,
      status: error.status,
      processingTime,
    };
  }
}

/**
 * Envía múltiples mensajes de forma eficiente
 * @param {array} messages - Array de objetos {to, body, options}
 * @returns {array} - Array de resultados
 */
async function sendBulkMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("Messages debe ser un array no vacío");
  }

  logger.info("Enviando mensajes en lote", { count: messages.length });

  const results = [];
  const batchSize = 5; // Procesar en lotes de 5 para evitar rate limits

  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);

    const batchPromises = batch.map(async (msg, index) => {
      try {
        // Delay entre mensajes para evitar rate limits
        if (index > 0) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        return await sendWhatsAppMessage(msg.to, msg.body, msg.options);
      } catch (error) {
        return {
          success: false,
          error: error.message,
          messageId: null,
          to: msg.to,
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Delay entre lotes
    if (i + batchSize < messages.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.length - successful;

  logger.info("Envío en lote completado", {
    total: results.length,
    successful,
    failed,
    successRate: ((successful / results.length) * 100).toFixed(1) + "%",
  });

  return results;
}

/**
 * Obtiene el estado de un mensaje
 * @param {string} messageId - ID del mensaje
 * @returns {object} - Estado del mensaje
 */
async function getMessageStatus(messageId) {
  try {
    if (!twilioClient) {
      throw new Error("Twilio no está configurado");
    }

    const message = await twilioClient.messages(messageId).fetch();

    return {
      success: true,
      messageId: message.sid,
      status: message.status,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
      dateCreated: message.dateCreated,
      dateSent: message.dateSent,
      dateUpdated: message.dateUpdated,
      price: message.price,
      priceUnit: message.priceUnit,
    };
  } catch (error) {
    logger.error("Error obteniendo estado del mensaje", {
      messageId,
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
      messageId,
    };
  }
}

/**
 * Obtiene métricas del servicio
 * @returns {object} - Métricas del servicio
 */
function getMetrics() {
  const uptime = Date.now() - metrics.lastReset;

  return {
    ...metrics,
    uptime: Math.round(uptime / 1000), // en segundos
    successRate:
      metrics.messagesSent > 0
        ? ((metrics.messagesSuccessful / metrics.messagesSent) * 100).toFixed(
            1
          ) + "%"
        : "0%",
    averageCost:
      metrics.messagesSuccessful > 0
        ? (metrics.totalCost / metrics.messagesSuccessful).toFixed(6)
        : 0,
    rateLimitEntries: rateLimitMap.size,
    configured: !!twilioClient,
  };
}

/**
 * Resetea las métricas
 */
function resetMetrics() {
  metrics.messagesSent = 0;
  metrics.messagesSuccessful = 0;
  metrics.messagesFailed = 0;
  metrics.totalCost = 0;
  metrics.lastReset = Date.now();

  logger.info("Métricas de Twilio reseteadas");
}

/**
 * Inicializa el servicio
 */
async function initialize() {
  if (!twilioClient) {
    throw new Error("Credenciales de Twilio no configuradas");
  }

  try {
    // Validar credenciales haciendo una llamada de prueba
    await twilioClient.api.accounts(config.TWILIO_ACCOUNT_SID).fetch();

    logger.info("Servicio Twilio inicializado correctamente", {
      accountSid: config.TWILIO_ACCOUNT_SID.substring(0, 10) + "...",
      whatsappNumber: config.TWILIO_WHATSAPP_NUMBER,
    });

    // Configurar limpieza automática del rate limit
    setInterval(cleanRateLimit, RATE_LIMIT_WINDOW);
  } catch (error) {
    logger.error("Error inicializando servicio Twilio", {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Cierra el servicio
 */
async function close() {
  rateLimitMap.clear();
  logger.info("Servicio Twilio cerrado");
}

module.exports = {
  sendWhatsAppMessage,
  sendBulkMessages,
  getMessageStatus,
  getMetrics,
  resetMetrics,
  initialize,
  close,
};
