// src/services/conversationContextService.js
/**
 * Servicio para la Gestión de Contexto de Conversaciones
 *
 * Centraliza la lógica para almacenar, recuperar y limpiar el estado
 * de las conversaciones activas del asistente.
 *
 * @class ConversationContextService
 */
class ConversationContextService {
  constructor() {
    /** @type {Map<string, Object>} Cache de conversaciones activas por número de teléfono */
    this.conversations = new Map();

    /** @type {number} Límite máximo de conversaciones en memoria */
    this.maxConversations = 1000;
  }

  /**
   * Obtiene el contexto de una conversación con límites de memoria.
   * Si el contexto no existe, lo crea.
   * @param {string} phoneNumber - El número de teléfono del usuario.
   * @returns {Object} El contexto de la conversación.
   */
  getConversationContext(phoneNumber) {
    if (!this.conversations.has(phoneNumber)) {
      // Verificar límite de conversaciones para evitar memory leaks
      if (this.conversations.size >= this.maxConversations) {
        this.cleanupOldContexts(Math.floor(this.maxConversations * 0.1)); // Eliminar el 10% más antiguo
      }

      this.conversations.set(phoneNumber, {
        extractedData: {},
        messages: [],
        createdAt: new Date(),
        lastActivity: new Date(),
      });
    }

    const context = this.conversations.get(phoneNumber);
    context.lastActivity = new Date();
    return context;
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
    analysis
  ) {
    const context = this.getConversationContext(phoneNumber);

    if (userMessage || assistantResponse) {
      context.messages.push({
        user: userMessage,
        assistant: assistantResponse,
        analysis,
        timestamp: new Date(),
      });
    }

    // Actualizar datos extraídos si vienen en el análisis
    if (analysis?.extractedData) {
      context.extractedData = {
        ...context.extractedData,
        ...analysis.extractedData,
      };
    }

    context.lastActivity = new Date();

    // Mantener solo los últimos 10 mensajes para no agotar memoria
    if (context.messages.length > 10) {
      context.messages = context.messages.slice(-10);
    }
  }

  /**
   * Limpia el contexto de una conversación específica.
   * @param {string} phoneNumber - El número de teléfono a limpiar.
   */
  clearConversationContext(phoneNumber) {
    this.conversations.delete(phoneNumber);
  }

  /**
   * Limpia contextos antiguos que superen el tiempo máximo de inactividad.
   */
  cleanupOldContexts() {
    const now = new Date();
    const maxAge = 2 * 60 * 60 * 1000; // 2 horas de inactividad

    for (const [phoneNumber, context] of this.conversations.entries()) {
      if (now - context.lastActivity > maxAge) {
        this.conversations.delete(phoneNumber);
      }
    }
  }
}

module.exports = new ConversationContextService();
