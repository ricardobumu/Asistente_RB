/**
 * SERVICIO DE CONTEXTO CONVERSACIONAL
 * Gestión de contexto y memoria para conversaciones de WhatsApp
 *
 * Funcionalidades:
 * - Almacenamiento de contexto en memoria y base de datos
 * - Gestión de sesiones de conversación
 * - Limpieza automática de contextos antiguos
 * - Análisis de patrones conversacionales
 * - Cumplimiento GDPR
 */

const config = require("../config/environment");
const logger = require("../utils/logger");
const supabaseService = require("./supabaseService");

// Cache en memoria para contextos activos
const contextCache = new Map();
const sessionMetadata = new Map();

// Configuración
const MAX_CONTEXT_MESSAGES = config.MAX_CONTEXT_MESSAGES || 50;
const CONTEXT_RETENTION_HOURS = config.CONTEXT_RETENTION_HOURS || 24;
const CACHE_CLEANUP_INTERVAL = 1000 * 60 * 30; // 30 minutos
const SESSION_TIMEOUT = 1000 * 60 * 60 * 2; // 2 horas de inactividad

/**
 * Genera clave de contexto para un número de teléfono
 * @param {string} phoneNumber - Número de teléfono
 * @returns {string} - Clave de contexto
 */
function generateContextKey(phoneNumber) {
  return `context_${phoneNumber}`;
}

/**
 * Obtiene timestamp de expiración para contexto
 * @returns {number} - Timestamp de expiración
 */
function getExpirationTimestamp() {
  return Date.now() + CONTEXT_RETENTION_HOURS * 60 * 60 * 1000;
}

/**
 * Valida si un contexto está expirado
 * @param {object} contextData - Datos del contexto
 * @returns {boolean} - true si está expirado
 */
function isContextExpired(contextData) {
  if (!contextData || !contextData.expiresAt) {
    return true;
  }
  return Date.now() > contextData.expiresAt;
}

/**
 * Limpia contextos expirados del cache
 */
function cleanExpiredContexts() {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [key, contextData] of contextCache.entries()) {
    if (isContextExpired(contextData)) {
      contextCache.delete(key);
      sessionMetadata.delete(key);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logger.info("Contextos expirados limpiados del cache", {
      cleanedCount,
      remainingContexts: contextCache.size,
    });
  }
}

/**
 * Obtiene contexto de conversación para un número de teléfono
 * @param {string} phoneNumber - Número de teléfono
 * @param {object} options - Opciones de consulta
 * @returns {array} - Array de mensajes del contexto
 */
async function getContext(phoneNumber, options = {}) {
  try {
    const contextKey = generateContextKey(phoneNumber);
    const { limit = MAX_CONTEXT_MESSAGES, includeMetadata = false } = options;

    // Verificar cache primero
    const cachedContext = contextCache.get(contextKey);

    if (cachedContext && !isContextExpired(cachedContext)) {
      logger.info("Contexto obtenido del cache", {
        phoneNumber,
        messageCount: cachedContext.messages.length,
      });

      const messages = cachedContext.messages.slice(-limit);
      return includeMetadata
        ? {
            messages,
            metadata: sessionMetadata.get(contextKey) || {},
          }
        : messages;
    }

    // Si no está en cache o está expirado, obtener de base de datos
    const conversations = await supabaseService.getRecentConversations({
      phoneNumber,
      limit,
      offset: 0,
    });

    // Convertir conversaciones a formato de contexto
    const messages = [];

    conversations.reverse().forEach((conv) => {
      if (conv.message_in) {
        messages.push({
          role: "user",
          content: conv.message_in,
          timestamp: conv.processed_at,
          messageId: conv.message_in_id,
          messageType: conv.message_type,
          hasMedia: conv.has_media,
        });
      }

      if (conv.message_out) {
        messages.push({
          role: "assistant",
          content: conv.message_out,
          timestamp: conv.processed_at,
          messageId: conv.message_out_id,
        });
      }
    });

    // Guardar en cache
    const contextData = {
      messages: messages.slice(-MAX_CONTEXT_MESSAGES),
      expiresAt: getExpirationTimestamp(),
      lastAccessed: Date.now(),
    };

    contextCache.set(contextKey, contextData);

    // Inicializar metadata de sesión si no existe
    if (!sessionMetadata.has(contextKey)) {
      sessionMetadata.set(contextKey, {
        phoneNumber,
        startTime: Date.now(),
        messageCount: messages.length,
        lastActivity: Date.now(),
      });
    }

    logger.info("Contexto cargado desde base de datos", {
      phoneNumber,
      messageCount: messages.length,
    });

    const resultMessages = messages.slice(-limit);
    return includeMetadata
      ? {
          messages: resultMessages,
          metadata: sessionMetadata.get(contextKey),
        }
      : resultMessages;
  } catch (error) {
    logger.error("Error obteniendo contexto", {
      error: error.message,
      phoneNumber,
    });
    return [];
  }
}

/**
 * Agrega un mensaje al contexto
 * @param {string} phoneNumber - Número de teléfono
 * @param {string} role - Rol del mensaje ('user' o 'assistant')
 * @param {string} content - Contenido del mensaje
 * @param {object} metadata - Metadata adicional
 */
async function addMessage(phoneNumber, role, content, metadata = {}) {
  try {
    const contextKey = generateContextKey(phoneNumber);

    // Obtener contexto actual
    let contextData = contextCache.get(contextKey);

    if (!contextData || isContextExpired(contextData)) {
      // Crear nuevo contexto
      contextData = {
        messages: [],
        expiresAt: getExpirationTimestamp(),
        lastAccessed: Date.now(),
      };
    }

    // Crear mensaje
    const message = {
      role,
      content,
      timestamp: new Date().toISOString(),
      messageId: metadata.messageId || null,
      messageType: metadata.messageType || "text",
      hasMedia: metadata.hasMedia || false,
      tokens: metadata.tokens || null,
      manual: metadata.manual || false,
      sentBy: metadata.sentBy || null,
    };

    // Agregar mensaje al contexto
    contextData.messages.push(message);

    // Mantener solo los últimos N mensajes
    if (contextData.messages.length > MAX_CONTEXT_MESSAGES) {
      contextData.messages = contextData.messages.slice(-MAX_CONTEXT_MESSAGES);
    }

    // Actualizar timestamps
    contextData.lastAccessed = Date.now();
    contextData.expiresAt = getExpirationTimestamp();

    // Guardar en cache
    contextCache.set(contextKey, contextData);

    // Actualizar metadata de sesión
    let sessionMeta = sessionMetadata.get(contextKey);
    if (!sessionMeta) {
      sessionMeta = {
        phoneNumber,
        startTime: Date.now(),
        messageCount: 0,
        lastActivity: Date.now(),
      };
    }

    sessionMeta.messageCount++;
    sessionMeta.lastActivity = Date.now();
    sessionMetadata.set(contextKey, sessionMeta);

    logger.info("Mensaje agregado al contexto", {
      phoneNumber,
      role,
      messageLength: content.length,
      totalMessages: contextData.messages.length,
      messageType: metadata.messageType,
    });
  } catch (error) {
    logger.error("Error agregando mensaje al contexto", {
      error: error.message,
      phoneNumber,
      role,
      contentLength: content?.length || 0,
    });
  }
}

/**
 * Obtiene conversaciones activas
 * @param {object} options - Opciones de consulta
 * @returns {array} - Lista de conversaciones activas
 */
async function getActiveConversations(options = {}) {
  try {
    const { limit = 50, minMessages = 1 } = options;
    const activeConversations = [];

    // Obtener de cache primero
    for (const [contextKey, contextData] of contextCache.entries()) {
      if (
        !isContextExpired(contextData) &&
        contextData.messages.length >= minMessages
      ) {
        const phoneNumber = contextKey.replace("context_", "");
        const sessionMeta = sessionMetadata.get(contextKey) || {};

        activeConversations.push({
          phoneNumber,
          messageCount: contextData.messages.length,
          lastActivity: new Date(contextData.lastAccessed).toISOString(),
          sessionStart: sessionMeta.startTime
            ? new Date(sessionMeta.startTime).toISOString()
            : null,
          isActive: Date.now() - contextData.lastAccessed < SESSION_TIMEOUT,
        });
      }
    }

    // Ordenar por última actividad
    activeConversations.sort(
      (a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)
    );

    // Si necesitamos más conversaciones, obtener de base de datos
    if (activeConversations.length < limit) {
      const recentConversations = await supabaseService.getRecentConversations({
        limit: limit * 2,
      });

      // Agrupar por número de teléfono
      const phoneGroups = {};
      recentConversations.forEach((conv) => {
        if (!phoneGroups[conv.phone_number]) {
          phoneGroups[conv.phone_number] = {
            phoneNumber: conv.phone_number,
            messageCount: 0,
            lastActivity: conv.processed_at,
            clientName: conv.clients?.name || null,
          };
        }
        phoneGroups[conv.phone_number].messageCount++;
      });

      // Agregar conversaciones que no están en cache
      Object.values(phoneGroups).forEach((group) => {
        if (
          !activeConversations.find(
            (ac) => ac.phoneNumber === group.phoneNumber
          )
        ) {
          activeConversations.push({
            ...group,
            isActive: false,
            sessionStart: null,
          });
        }
      });
    }

    return activeConversations.slice(0, limit);
  } catch (error) {
    logger.error("Error obteniendo conversaciones activas", {
      error: error.message,
    });
    return [];
  }
}

/**
 * Analiza patrones en una conversación
 * @param {string} phoneNumber - Número de teléfono
 * @returns {object} - Análisis de patrones
 */
async function analyzeConversationPatterns(phoneNumber) {
  try {
    const context = await getContext(phoneNumber, { limit: 100 });

    if (context.length === 0) {
      return {
        totalMessages: 0,
        userMessages: 0,
        assistantMessages: 0,
        averageMessageLength: 0,
        conversationDuration: 0,
        responseTime: 0,
        topics: [],
        sentiment: "neutral",
      };
    }

    const userMessages = context.filter((msg) => msg.role === "user");
    const assistantMessages = context.filter((msg) => msg.role === "assistant");

    // Calcular duración de conversación
    const firstMessage = context[0];
    const lastMessage = context[context.length - 1];
    const conversationDuration =
      new Date(lastMessage.timestamp) - new Date(firstMessage.timestamp);

    // Calcular tiempo de respuesta promedio
    let totalResponseTime = 0;
    let responseCount = 0;

    for (let i = 0; i < context.length - 1; i++) {
      if (context[i].role === "user" && context[i + 1].role === "assistant") {
        const responseTime =
          new Date(context[i + 1].timestamp) - new Date(context[i].timestamp);
        totalResponseTime += responseTime;
        responseCount++;
      }
    }

    const averageResponseTime =
      responseCount > 0 ? totalResponseTime / responseCount : 0;

    // Calcular longitud promedio de mensajes
    const totalLength = context.reduce(
      (sum, msg) => sum + msg.content.length,
      0
    );
    const averageMessageLength =
      context.length > 0 ? totalLength / context.length : 0;

    // Análisis básico de temas (palabras clave frecuentes)
    const allText = userMessages
      .map((msg) => msg.content)
      .join(" ")
      .toLowerCase();
    const words = allText.split(/\s+/).filter((word) => word.length > 3);
    const wordCount = {};

    words.forEach((word) => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    const topics = Object.entries(wordCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([word, count]) => ({ word, count }));

    return {
      totalMessages: context.length,
      userMessages: userMessages.length,
      assistantMessages: assistantMessages.length,
      averageMessageLength: Math.round(averageMessageLength),
      conversationDuration: Math.round(conversationDuration / 1000), // en segundos
      responseTime: Math.round(averageResponseTime / 1000), // en segundos
      topics,
      sentiment: "neutral", // Placeholder - se podría integrar análisis de sentimiento
    };
  } catch (error) {
    logger.error("Error analizando patrones de conversación", {
      error: error.message,
      phoneNumber,
    });
    return null;
  }
}

/**
 * Limpia contexto de un número específico
 * @param {string} phoneNumber - Número de teléfono
 */
async function clearContext(phoneNumber) {
  try {
    const contextKey = generateContextKey(phoneNumber);

    contextCache.delete(contextKey);
    sessionMetadata.delete(contextKey);

    logger.info("Contexto limpiado", { phoneNumber });
  } catch (error) {
    logger.error("Error limpiando contexto", {
      error: error.message,
      phoneNumber,
    });
  }
}

/**
 * Obtiene estadísticas del servicio de contexto
 * @returns {object} - Estadísticas
 */
function getContextStats() {
  const now = Date.now();
  let activeContexts = 0;
  let expiredContexts = 0;
  let totalMessages = 0;

  for (const [key, contextData] of contextCache.entries()) {
    if (isContextExpired(contextData)) {
      expiredContexts++;
    } else {
      activeContexts++;
      totalMessages += contextData.messages.length;
    }
  }

  return {
    totalContexts: contextCache.size,
    activeContexts,
    expiredContexts,
    totalMessages,
    averageMessagesPerContext:
      activeContexts > 0 ? Math.round(totalMessages / activeContexts) : 0,
    maxContextMessages: MAX_CONTEXT_MESSAGES,
    retentionHours: CONTEXT_RETENTION_HOURS,
    sessionTimeout: SESSION_TIMEOUT / 1000 / 60, // en minutos
    memoryUsage: {
      contextCache: contextCache.size,
      sessionMetadata: sessionMetadata.size,
    },
  };
}

/**
 * Exporta contexto para backup o análisis
 * @param {string} phoneNumber - Número de teléfono (opcional)
 * @returns {object} - Datos de contexto exportados
 */
async function exportContext(phoneNumber = null) {
  try {
    const exportData = {
      timestamp: new Date().toISOString(),
      contexts: [],
    };

    if (phoneNumber) {
      // Exportar contexto específico
      const context = await getContext(phoneNumber, { includeMetadata: true });
      const contextKey = generateContextKey(phoneNumber);
      const sessionMeta = sessionMetadata.get(contextKey);

      exportData.contexts.push({
        phoneNumber,
        messages: context.messages || context,
        metadata: sessionMeta || {},
      });
    } else {
      // Exportar todos los contextos activos
      for (const [contextKey, contextData] of contextCache.entries()) {
        if (!isContextExpired(contextData)) {
          const phone = contextKey.replace("context_", "");
          const sessionMeta = sessionMetadata.get(contextKey);

          exportData.contexts.push({
            phoneNumber: phone,
            messages: contextData.messages,
            metadata: sessionMeta || {},
          });
        }
      }
    }

    logger.info("Contexto exportado", {
      phoneNumber: phoneNumber || "all",
      contextCount: exportData.contexts.length,
    });

    return exportData;
  } catch (error) {
    logger.error("Error exportando contexto", {
      error: error.message,
      phoneNumber,
    });
    throw error;
  }
}

/**
 * Inicializa el servicio de contexto
 */
async function initialize() {
  logger.info("Inicializando servicio de contexto conversacional", {
    maxContextMessages: MAX_CONTEXT_MESSAGES,
    retentionHours: CONTEXT_RETENTION_HOURS,
    sessionTimeoutMinutes: SESSION_TIMEOUT / 1000 / 60,
  });

  // Configurar limpieza automática
  setInterval(cleanExpiredContexts, CACHE_CLEANUP_INTERVAL);

  logger.info("Servicio de contexto inicializado correctamente");
}

/**
 * Cierra el servicio de contexto
 */
async function close() {
  // Limpiar caches
  contextCache.clear();
  sessionMetadata.clear();

  logger.info("Servicio de contexto cerrado");
}

module.exports = {
  getContext,
  addMessage,
  getActiveConversations,
  analyzeConversationPatterns,
  clearContext,
  getContextStats,
  exportContext,
  initialize,
  close,
};
