/**
 * SERVICIO DE OPENAI
 * Cliente para interactuar con la API de OpenAI
 *
 * Funcionalidades:
 * - Generación de respuestas conversacionales
 * - Análisis de intenciones
 * - Gestión de tokens y costos
 * - Retry automático con backoff
 * - Cache de respuestas frecuentes
 */

const OpenAI = require("openai");
const config = require("../config/environment");
const logger = require("../utils/logger");

// Inicializar cliente de OpenAI
let openaiClient = null;

if (config.OPENAI_API_KEY) {
  openaiClient = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
    timeout: 30000, // 30 segundos timeout
    maxRetries: 3,
  });
} else {
  logger.warn("OpenAI API Key no configurada - servicio deshabilitado");
}

// Cache simple para respuestas frecuentes
const responseCache = new Map();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutos
const MAX_CACHE_SIZE = 100;

/**
 * Limpia el cache de respuestas expiradas
 */
function cleanCache() {
  const now = Date.now();
  for (const [key, value] of responseCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      responseCache.delete(key);
    }
  }
}

/**
 * Genera una clave de cache para un prompt
 * @param {string} prompt - Prompt para generar clave
 * @returns {string} - Clave de cache
 */
function generateCacheKey(prompt) {
  // Usar hash simple del prompt (primeros y últimos 50 caracteres)
  const start = prompt.substring(0, 50);
  const end = prompt.substring(Math.max(0, prompt.length - 50));
  return `${start}_${end}`.replace(/\s+/g, "_").toLowerCase();
}

/**
 * Obtiene respuesta del cache si existe y es válida
 * @param {string} prompt - Prompt a buscar
 * @returns {string|null} - Respuesta cacheada o null
 */
function getCachedResponse(prompt) {
  const key = generateCacheKey(prompt);
  const cached = responseCache.get(key);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.info("Respuesta obtenida del cache", {
      cacheKey: key.substring(0, 20) + "...",
      age: Math.round((Date.now() - cached.timestamp) / 1000) + "s",
    });
    return cached.response;
  }

  return null;
}

/**
 * Guarda respuesta en cache
 * @param {string} prompt - Prompt original
 * @param {string} response - Respuesta a cachear
 */
function setCachedResponse(prompt, response) {
  if (responseCache.size >= MAX_CACHE_SIZE) {
    // Limpiar cache si está lleno
    cleanCache();

    // Si sigue lleno, eliminar el más antiguo
    if (responseCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = responseCache.keys().next().value;
      responseCache.delete(oldestKey);
    }
  }

  const key = generateCacheKey(prompt);
  responseCache.set(key, {
    response,
    timestamp: Date.now(),
  });
}

/**
 * Calcula el costo aproximado de una llamada a OpenAI
 * @param {string} model - Modelo utilizado
 * @param {number} inputTokens - Tokens de entrada
 * @param {number} outputTokens - Tokens de salida
 * @returns {number} - Costo en USD
 */
function calculateCost(model, inputTokens, outputTokens) {
  // Precios aproximados por 1K tokens (actualizar según precios actuales)
  const pricing = {
    "gpt-4": { input: 0.03, output: 0.06 },
    "gpt-4-turbo": { input: 0.01, output: 0.03 },
    "gpt-3.5-turbo": { input: 0.001, output: 0.002 },
    "gpt-3.5-turbo-16k": { input: 0.003, output: 0.004 },
  };

  const modelPricing = pricing[model] || pricing["gpt-3.5-turbo"];

  const inputCost = (inputTokens / 1000) * modelPricing.input;
  const outputCost = (outputTokens / 1000) * modelPricing.output;

  return inputCost + outputCost;
}

/**
 * Valida y sanitiza el prompt antes de enviarlo a OpenAI
 * @param {string} prompt - Prompt a validar
 * @returns {string} - Prompt sanitizado
 */
function sanitizePrompt(prompt) {
  if (!prompt || typeof prompt !== "string") {
    throw new Error("Prompt debe ser un string no vacío");
  }

  // Limitar longitud del prompt
  const maxLength = 8000; // Aproximadamente 2000 tokens
  if (prompt.length > maxLength) {
    logger.warn("Prompt truncado por exceder longitud máxima", {
      originalLength: prompt.length,
      maxLength,
    });
    prompt = prompt.substring(0, maxLength) + "...";
  }

  // Remover caracteres problemáticos
  prompt = prompt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  return prompt.trim();
}

/**
 * Genera respuesta usando OpenAI
 * @param {string} prompt - Prompt para generar respuesta
 * @param {object} options - Opciones de configuración
 * @returns {string|null} - Respuesta generada o null si hay error
 */
async function generateResponse(prompt, options = {}) {
  const startTime = Date.now();

  try {
    // Validar que OpenAI esté configurado
    if (!openaiClient) {
      logger.error("OpenAI no está configurado");
      return null;
    }

    // Sanitizar prompt
    const sanitizedPrompt = sanitizePrompt(prompt);

    // Verificar cache primero
    const cachedResponse = getCachedResponse(sanitizedPrompt);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Configuración por defecto
    const defaultOptions = {
      model: config.OPENAI_MODEL || "gpt-3.5-turbo",
      maxTokens: config.OPENAI_MAX_TOKENS || 500,
      temperature: config.OPENAI_TEMPERATURE || 0.7,
      topP: 1,
      frequencyPenalty: 0.1,
      presencePenalty: 0.1,
    };

    const finalOptions = { ...defaultOptions, ...options };

    logger.openai("generating_response", 0, finalOptions.model, {
      promptLength: sanitizedPrompt.length,
      maxTokens: finalOptions.maxTokens,
      temperature: finalOptions.temperature,
    });

    // Llamada a OpenAI
    const completion = await openaiClient.chat.completions.create({
      model: finalOptions.model,
      messages: [
        {
          role: "user",
          content: sanitizedPrompt,
        },
      ],
      max_tokens: finalOptions.maxTokens,
      temperature: finalOptions.temperature,
      top_p: finalOptions.topP,
      frequency_penalty: finalOptions.frequencyPenalty,
      presence_penalty: finalOptions.presencePenalty,
      stream: false,
    });

    // Extraer respuesta
    const response = completion.choices[0]?.message?.content?.trim();

    if (!response) {
      logger.error("OpenAI no devolvió respuesta válida", {
        completion: completion,
        model: finalOptions.model,
      });
      return null;
    }

    // Calcular métricas
    const processingTime = Date.now() - startTime;
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;
    const totalTokens = completion.usage?.total_tokens || 0;
    const cost = calculateCost(finalOptions.model, inputTokens, outputTokens);

    // Log de éxito
    logger.openai("response_generated", totalTokens, finalOptions.model, {
      processingTime,
      inputTokens,
      outputTokens,
      totalTokens,
      cost: cost.toFixed(6),
      responseLength: response.length,
      promptLength: sanitizedPrompt.length,
    });

    // Guardar en cache
    setCachedResponse(sanitizedPrompt, response);

    return response;
  } catch (error) {
    const processingTime = Date.now() - startTime;

    logger.error("Error generando respuesta con OpenAI", {
      error: error.message,
      code: error.code,
      type: error.type,
      processingTime,
      promptLength: prompt?.length || 0,
      model: options.model || config.OPENAI_MODEL,
    });

    // Manejar errores específicos
    if (error.code === "rate_limit_exceeded") {
      logger.warn("Rate limit de OpenAI excedido");
      return "Disculpa, estoy experimentando alta demanda en este momento. Por favor, intenta de nuevo en unos minutos.";
    }

    if (error.code === "insufficient_quota") {
      logger.error("Cuota de OpenAI agotada");
      return "Servicio temporalmente no disponible. Por favor, contacta directamente para asistencia.";
    }

    if (error.code === "invalid_request_error") {
      logger.error("Request inválido a OpenAI", { error: error.message });
      return null;
    }

    return null;
  }
}

/**
 * Analiza la intención de un mensaje
 * @param {string} message - Mensaje a analizar
 * @returns {object} - Análisis de intención
 */
async function analyzeIntent(message) {
  try {
    const prompt = `Analiza la siguiente consulta de un cliente y determina su intención principal.

Mensaje del cliente: "${message}"

Responde SOLO con un JSON válido con esta estructura:
{
  "intent": "booking|information|complaint|greeting|goodbye|other",
  "confidence": 0.0-1.0,
  "entities": {
    "service": "nombre del servicio si se menciona",
    "date": "fecha si se menciona",
    "time": "hora si se menciona"
  },
  "urgency": "low|medium|high",
  "sentiment": "positive|neutral|negative"
}`;

    const response = await generateResponse(prompt, {
      maxTokens: 200,
      temperature: 0.3,
    });

    if (!response) {
      return {
        intent: "other",
        confidence: 0.5,
        entities: {},
        urgency: "medium",
        sentiment: "neutral",
      };
    }

    try {
      return JSON.parse(response);
    } catch (parseError) {
      logger.warn("Error parseando análisis de intención", {
        response,
        error: parseError.message,
      });

      return {
        intent: "other",
        confidence: 0.5,
        entities: {},
        urgency: "medium",
        sentiment: "neutral",
      };
    }
  } catch (error) {
    logger.error("Error analizando intención", {
      error: error.message,
      message: message.substring(0, 100),
    });

    return {
      intent: "other",
      confidence: 0.0,
      entities: {},
      urgency: "medium",
      sentiment: "neutral",
    };
  }
}

/**
 * Obtiene estadísticas del servicio OpenAI
 * @returns {object} - Estadísticas del servicio
 */
function getStats() {
  return {
    cacheSize: responseCache.size,
    maxCacheSize: MAX_CACHE_SIZE,
    cacheTTL: CACHE_TTL / 1000 / 60, // en minutos
    configured: !!openaiClient,
    model: config.OPENAI_MODEL,
    maxTokens: config.OPENAI_MAX_TOKENS,
    temperature: config.OPENAI_TEMPERATURE,
  };
}

/**
 * Limpia el cache manualmente
 */
function clearCache() {
  const oldSize = responseCache.size;
  responseCache.clear();
  logger.info("Cache de OpenAI limpiado", {
    clearedEntries: oldSize,
  });
}

/**
 * Inicializa el servicio
 */
async function initialize() {
  if (!openaiClient) {
    throw new Error("OpenAI API Key no configurada");
  }

  try {
    // Hacer una llamada de prueba para validar la configuración
    await openaiClient.models.list();
    logger.info("Servicio OpenAI inicializado correctamente");

    // Configurar limpieza automática del cache
    setInterval(cleanCache, CACHE_TTL);
  } catch (error) {
    logger.error("Error inicializando servicio OpenAI", {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Cierra el servicio
 */
async function close() {
  clearCache();
  logger.info("Servicio OpenAI cerrado");
}

module.exports = {
  generateResponse,
  analyzeIntent,
  getStats,
  clearCache,
  initialize,
  close,
};
