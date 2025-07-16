// src/services/ConversationContextService.js
const logger = require("../utils/logger");

/**
 * Servicio para la Gestión de Contexto de Conversaciones
 * Ricardo Buriticá Beauty Consulting - WhatsApp Bot
 *
 * Centraliza la lógica para almacenar, recuperar y limpiar el estado
 * de las conversaciones activas del asistente autónomo.
 *
 * Funcionalidades:
 * - Gestión de contexto de conversaciones
 * - Límites de memoria y cleanup automático
 * - Integración con análisis de IA
 * - Persistencia de datos extraídos
 *
 * @class ConversationContextService
 */
class ConversationContextService {
  constructor() {
    /** @type {Map<string, Object>} Cache de conversaciones activas por número de teléfono */
    this.conversations = new Map();

    /** @type {number} Límite máximo de conversaciones en memoria */
    this.maxConversations = 1000;

    /** @type {number} Tiempo máximo de inactividad (2 horas) */
    this.maxInactivityTime = 2 * 60 * 60 * 1000;

    // Inicializar cleanup automático cada 30 minutos
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupOldContexts();
      },
      30 * 60 * 1000
    );

    logger.info("ConversationContextService inicializado", {
      maxConversations: this.maxConversations,
      maxInactivityHours: this.maxInactivityTime / (60 * 60 * 1000),
    });
  }

  /**
   * Obtiene el contexto de una conversación con límites de memoria.
   * Si el contexto no existe, lo crea.
   * @param {string} phoneNumber - El número de teléfono del usuario.
   * @returns {Object} El contexto de la conversación.
   */
  getConversationContext(phoneNumber) {
    try {
      // Validar parámetro de entrada
      if (!phoneNumber || typeof phoneNumber !== "string") {
        throw new Error("Número de teléfono requerido y debe ser string");
      }

      // Normalizar número de teléfono
      const normalizedPhone = phoneNumber.replace(/\D/g, "");

      if (!this.conversations.has(normalizedPhone)) {
        // Verificar límite de conversaciones para evitar memory leaks
        if (this.conversations.size >= this.maxConversations) {
          const toRemove = Math.floor(this.maxConversations * 0.1);
          this.cleanupOldContexts(toRemove);
          logger.warn(
            "Límite de conversaciones alcanzado, limpiando contextos antiguos",
            {
              removed: toRemove,
              remaining: this.conversations.size,
            }
          );
        }

        // Crear nuevo contexto
        const newContext = {
          phoneNumber: normalizedPhone,
          extractedData: {},
          messages: [],
          createdAt: new Date(),
          lastActivity: new Date(),
          clientInfo: null, // Para almacenar info del cliente
          currentFlow: "initial", // Estado del flujo de conversación
          gdprConsent: false,
          awaitingResponse: null, // Para manejar respuestas esperadas
        };

        this.conversations.set(normalizedPhone, newContext);

        logger.info("Nuevo contexto de conversación creado", {
          phone: normalizedPhone.substring(0, 5) + "***",
          totalContexts: this.conversations.size,
        });
      }

      const context = this.conversations.get(normalizedPhone);
      context.lastActivity = new Date();
      return context;
    } catch (error) {
      logger.error("Error obteniendo contexto de conversación", {
        error: error.message,
        phone: phoneNumber ? phoneNumber.substring(0, 5) + "***" : "undefined",
      });

      // Retornar contexto básico en caso de error
      return {
        phoneNumber: phoneNumber,
        extractedData: {},
        messages: [],
        createdAt: new Date(),
        lastActivity: new Date(),
        clientInfo: null,
        currentFlow: "error",
        gdprConsent: false,
        awaitingResponse: null,
      };
    }
  }

  /**
   * Actualiza el contexto de una conversación.
   * @param {string} phoneNumber - El número de teléfono del usuario.
   * @param {string|null} userMessage - El mensaje del usuario.
   * @param {string|null} assistantResponse - La respuesta del asistente.
   * @param {Object} analysis - El resultado del análisis de IA.
   */
  updateConversationContext(
    phoneNumber,
    userMessage,
    assistantResponse,
    analysis = {}
  ) {
    try {
      const context = this.getConversationContext(phoneNumber);

      // Agregar mensaje si existe contenido
      if (userMessage || assistantResponse) {
        const messageEntry = {
          user: userMessage || null,
          assistant: assistantResponse || null,
          analysis: analysis || {},
          timestamp: new Date(),
          messageId: Date.now() + Math.random(), // ID único para el mensaje
        };

        context.messages.push(messageEntry);

        logger.info("Mensaje agregado al contexto", {
          phone: phoneNumber.substring(0, 5) + "***",
          hasUserMessage: !!userMessage,
          hasAssistantResponse: !!assistantResponse,
          totalMessages: context.messages.length,
        });
      }

      // Actualizar datos extraídos si vienen en el análisis
      if (analysis?.extractedData) {
        context.extractedData = {
          ...context.extractedData,
          ...analysis.extractedData,
        };
      }

      // Actualizar flujo de conversación si se especifica
      if (analysis?.currentFlow) {
        context.currentFlow = analysis.currentFlow;
      }

      // Actualizar información del cliente si se proporciona
      if (analysis?.clientInfo) {
        context.clientInfo = {
          ...context.clientInfo,
          ...analysis.clientInfo,
        };
      }

      // Actualizar consentimiento GDPR si se especifica
      if (analysis?.gdprConsent !== undefined) {
        context.gdprConsent = analysis.gdprConsent;
      }

      // Actualizar respuesta esperada
      if (analysis?.awaitingResponse !== undefined) {
        context.awaitingResponse = analysis.awaitingResponse;
      }

      context.lastActivity = new Date();

      // Mantener solo los últimos 15 mensajes para no agotar memoria
      if (context.messages.length > 15) {
        context.messages = context.messages.slice(-15);
        logger.info("Mensajes antiguos eliminados del contexto", {
          phone: phoneNumber.substring(0, 5) + "***",
          remainingMessages: context.messages.length,
        });
      }

      return context;
    } catch (error) {
      logger.error("Error actualizando contexto de conversación", {
        error: error.message,
        phone: phoneNumber ? phoneNumber.substring(0, 5) + "***" : "undefined",
        hasUserMessage: !!userMessage,
        hasAssistantResponse: !!assistantResponse,
      });
      throw error;
    }
  }

  /**
   * Limpia el contexto de una conversación específica.
   * @param {string} phoneNumber - El número de teléfono a limpiar.
   */
  clearConversationContext(phoneNumber) {
    try {
      if (!phoneNumber) {
        throw new Error("Número de teléfono requerido");
      }

      const normalizedPhone = phoneNumber.replace(/\D/g, "");
      const existed = this.conversations.has(normalizedPhone);

      if (existed) {
        this.conversations.delete(normalizedPhone);
        logger.info("Contexto de conversación eliminado", {
          phone: normalizedPhone.substring(0, 5) + "***",
          remainingContexts: this.conversations.size,
        });
      }

      return existed;
    } catch (error) {
      logger.error("Error limpiando contexto de conversación", {
        error: error.message,
        phone: phoneNumber ? phoneNumber.substring(0, 5) + "***" : "undefined",
      });
      return false;
    }
  }

  /**
   * Limpia contextos antiguos que superen el tiempo máximo de inactividad.
   * @param {number} maxToRemove - Máximo número de contextos a eliminar (opcional)
   */
  cleanupOldContexts(maxToRemove = null) {
    try {
      const now = new Date();
      let removedCount = 0;
      const contextsToRemove = [];

      // Identificar contextos a eliminar
      for (const [phoneNumber, context] of this.conversations.entries()) {
        const inactiveTime = now - context.lastActivity;

        if (inactiveTime > this.maxInactivityTime) {
          contextsToRemove.push(phoneNumber);
        }
      }

      // Si se especifica un máximo, ordenar por antigüedad y tomar solo los más antiguos
      if (maxToRemove && contextsToRemove.length > maxToRemove) {
        const sortedContexts = contextsToRemove
          .map((phone) => ({
            phone,
            lastActivity: this.conversations.get(phone).lastActivity,
          }))
          .sort((a, b) => a.lastActivity - b.lastActivity)
          .slice(0, maxToRemove)
          .map((item) => item.phone);

        contextsToRemove.length = 0;
        contextsToRemove.push(...sortedContexts);
      }

      // Eliminar contextos identificados
      for (const phoneNumber of contextsToRemove) {
        this.conversations.delete(phoneNumber);
        removedCount++;
      }

      if (removedCount > 0) {
        logger.info("Cleanup de contextos antiguos completado", {
          removedContexts: removedCount,
          remainingContexts: this.conversations.size,
          maxInactivityHours: this.maxInactivityTime / (60 * 60 * 1000),
        });
      }

      return removedCount;
    } catch (error) {
      logger.error("Error en cleanup de contextos antiguos", {
        error: error.message,
        totalContexts: this.conversations.size,
      });
      return 0;
    }
  }

  /**
   * Obtiene estadísticas del servicio de contexto
   * @returns {Object} Estadísticas del servicio
   */
  getStats() {
    try {
      const now = new Date();
      let activeContexts = 0;
      let oldestContext = now;
      let newestContext = new Date(0);

      for (const context of this.conversations.values()) {
        const inactiveTime = now - context.lastActivity;

        if (inactiveTime <= this.maxInactivityTime) {
          activeContexts++;
        }

        if (context.createdAt < oldestContext) {
          oldestContext = context.createdAt;
        }

        if (context.createdAt > newestContext) {
          newestContext = context.createdAt;
        }
      }

      return {
        totalContexts: this.conversations.size,
        activeContexts,
        inactiveContexts: this.conversations.size - activeContexts,
        maxConversations: this.maxConversations,
        utilizationPercentage:
          (this.conversations.size / this.maxConversations) * 100,
        oldestContextAge: oldestContext !== now ? now - oldestContext : 0,
        newestContextAge: newestContext.getTime() > 0 ? now - newestContext : 0,
      };
    } catch (error) {
      logger.error("Error obteniendo estadísticas de contexto", {
        error: error.message,
      });
      return {
        totalContexts: 0,
        activeContexts: 0,
        inactiveContexts: 0,
        maxConversations: this.maxConversations,
        utilizationPercentage: 0,
        oldestContextAge: 0,
        newestContextAge: 0,
      };
    }
  }

  /**
   * Destructor para limpiar recursos
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.conversations.clear();

    logger.info("ConversationContextService destruido");
  }
}

module.exports = new ConversationContextService();
