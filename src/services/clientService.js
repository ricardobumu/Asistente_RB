// src/services/clientService.js
const ClientModel = require("../models/clientModel");
const logger = require("../utils/logger");

/**
 * ClientService - Servicio de gestión de clientes para Ricardo Buriticá Beauty Consulting
 *
 * Funcionalidades:
 * - Integración con WhatsApp Bot (findOrCreateByPhone)
 * - Gestión completa de clientes para portal web
 * - Validaciones RGPD/GDPR
 * - Auditoría de interacciones
 * - Búsquedas optimizadas
 */
class ClientService {
  constructor() {
    this.clientModel = new ClientModel();
    logger.info(
      "ClientService inicializado para Ricardo Buriticá Beauty Consulting"
    );
  }

  /**
   * MÉTODO ESENCIAL PARA EL BOT DE WHATSAPP
   * Busca un cliente por teléfono, si no existe lo crea
   * @param {string} phone - Número de teléfono
   * @param {object} clientData - Datos adicionales del cliente
   * @returns {object} Cliente encontrado o creado
   */
  async findOrCreateByPhone(phone, clientData = {}) {
    try {
      // Validación de entrada
      if (!phone || typeof phone !== "string") {
        throw new Error("Número de teléfono requerido y debe ser string");
      }

      // Normalizar teléfono - remover todos los caracteres no numéricos
      const normalizedPhone = phone.replace(/\D/g, "");

      // Validar que el teléfono normalizado tenga al menos 10 dígitos
      if (normalizedPhone.length < 10) {
        throw new Error("Número de teléfono debe tener al menos 10 dígitos");
      }

      // Buscar cliente existente
      const existingResult =
        await this.clientModel.findByPhone(normalizedPhone);

      if (existingResult && existingResult.success && existingResult.data) {
        logger.info("Cliente encontrado por teléfono", {
          clientId: existingResult.data.id,
          phone: normalizedPhone,
          name: existingResult.data.full_name,
        });
        return existingResult.data;
      }

      // Si no existe, crear nuevo cliente
      const fullName =
        clientData.full_name || clientData.name || "Cliente WhatsApp";

      // Preparar datos básicos que funcionan con el esquema actual de Supabase
      const newClientData = {
        phone: normalizedPhone,
        full_name: fullName,
        email: clientData.email || null,
        source: clientData.source || "whatsapp_bot",
        is_active: true,
        notes: "Cliente creado automáticamente desde WhatsApp Bot",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // No agregar first_name/last_name - usar solo full_name para compatibilidad con Supabase

      const createResult = await this.clientModel.create(newClientData);

      if (createResult && createResult.success && createResult.data) {
        logger.info("Nuevo cliente creado desde WhatsApp Bot", {
          clientId: createResult.data.id,
          phone: normalizedPhone,
          name: createResult.data.full_name,
        });
        return createResult.data;
      } else {
        const errorMsg =
          createResult?.error || "Error desconocido creando cliente";
        throw new Error(`Error creando cliente: ${errorMsg}`);
      }
    } catch (error) {
      logger.error("Error en findOrCreateByPhone", {
        error: error.message,
        phone: phone ? phone.substring(0, 5) + "***" : "undefined", // Ofuscar teléfono en logs
        clientDataKeys: clientData ? Object.keys(clientData) : [],
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Obtener todos los clientes con paginación
   * @param {object} options - Opciones de paginación y filtros
   * @returns {object} Resultado con clientes y paginación
   */
  async getAllClients(options = {}) {
    try {
      const result = await this.clientModel.getAll(options);
      return (
        result || {
          success: false,
          error: "No se pudo obtener la lista de clientes",
          data: [],
          pagination: null,
        }
      );
    } catch (error) {
      logger.error("Error en ClientService.getAllClients", {
        error: error.message,
        options: Object.keys(options),
        stack: error.stack,
      });
      return {
        success: false,
        error: error.message,
        data: [],
        pagination: null,
      };
    }
  }

  /**
   * Buscar cliente por ID
   * @param {string|number} clientId - ID del cliente
   * @returns {object} Resultado con datos del cliente
   */
  async findById(clientId) {
    try {
      if (!clientId) {
        throw new Error("ID de cliente requerido");
      }

      const result = await this.clientModel.findById(clientId);
      return (
        result || {
          success: false,
          error: "Cliente no encontrado",
          data: null,
        }
      );
    } catch (error) {
      logger.error("Error en ClientService.findById", {
        error: error.message,
        clientId,
        stack: error.stack,
      });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Buscar cliente por teléfono
   * @param {string} phone - Número de teléfono
   * @returns {object} Resultado con datos del cliente
   */
  async findByPhone(phone) {
    try {
      if (!phone || typeof phone !== "string") {
        throw new Error("Número de teléfono requerido y debe ser string");
      }

      // Normalizar teléfono
      const normalizedPhone = phone.replace(/\D/g, "");

      const result = await this.clientModel.findByPhone(normalizedPhone);
      return (
        result || {
          success: false,
          error: "Cliente no encontrado",
          data: null,
        }
      );
    } catch (error) {
      logger.error("Error en ClientService.findByPhone", {
        error: error.message,
        phone: phone ? phone.substring(0, 5) + "***" : "undefined",
        stack: error.stack,
      });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Buscar cliente por email
   */
  async findByEmail(email) {
    try {
      return await this.clientModel.findByEmail(email);
    } catch (error) {
      logger.error("Error en ClientService.findByEmail", {
        error: error.message,
        email,
      });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Buscar cliente por WhatsApp ID (para compatibilidad con bot)
   */
  async findByWhatsAppId(whatsappId) {
    try {
      // WhatsApp ID es el mismo que el teléfono normalizado
      return await this.findByPhone(whatsappId);
    } catch (error) {
      logger.error("Error en ClientService.findByWhatsAppId", {
        error: error.message,
        whatsappId,
      });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Crear nuevo cliente con validaciones completas
   */
  async createClient(clientData) {
    try {
      return await this.clientModel.create(clientData);
    } catch (error) {
      logger.error("Error en ClientService.createClient", {
        error: error.message,
        clientData: {
          phone: clientData?.phone,
          email: clientData?.email,
          full_name: clientData?.full_name,
        },
      });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Actualizar cliente con validaciones
   */
  async updateClient(clientId, updateData) {
    try {
      return await this.clientModel.update(clientId, updateData);
    } catch (error) {
      logger.error("Error en ClientService.updateClient", {
        error: error.message,
        clientId,
        updateFields: Object.keys(updateData || {}),
      });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Eliminar cliente (soft delete)
   */
  async deleteClient(clientId, reason = "") {
    try {
      return await this.clientModel.deactivate(clientId, reason);
    } catch (error) {
      logger.error("Error en ClientService.deleteClient", {
        error: error.message,
        clientId,
        reason,
      });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Actualizar consentimiento RGPD
   */
  async updateGdprConsent(clientId, consentData) {
    try {
      return await this.clientModel.updateGdprConsent(clientId, consentData);
    } catch (error) {
      logger.error("Error en ClientService.updateGdprConsent", {
        error: error.message,
        clientId,
      });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * MÉTODO PRINCIPAL PARA EL FLUJO DEL BOT DE WHATSAPP
   * Maneja todo el flujo: reconocimiento, RGPD, ARCO, acompañamiento y registro
   * @param {string} whatsappPhone - Número de WhatsApp del cliente
   * @param {object} messageData - Datos del mensaje recibido
   * @returns {object} Información del cliente y estado del flujo
   */
  async handleWhatsAppClientFlow(whatsappPhone, messageData = {}) {
    try {
      if (!whatsappPhone) {
        throw new Error("Número de WhatsApp requerido");
      }

      // Normalizar número de WhatsApp
      const normalizedPhone = whatsappPhone.replace(/\D/g, "");

      // Buscar cliente existente
      const existingResult =
        await this.clientModel.findByPhone(normalizedPhone);

      if (existingResult && existingResult.success && existingResult.data) {
        const client = existingResult.data;

        logger.info("Cliente reconocido en WhatsApp", {
          clientId: client.id,
          phone: normalizedPhone,
          name: client.full_name,
          // gdprConsent: client.gdpr_consent, // Campo no disponible en esquema actual
          isActive: client.is_active,
        });

        return {
          success: true,
          isExistingClient: true,
          client: client,
          needsGdprConsent: false, // Temporalmente deshabilitado hasta actualizar esquema
          canProceedWithService: client.is_active,
          welcomeMessage: `¡Hola ${client.full_name}! 👋 Me alegra verte de nuevo.`,
          flowStatus: "ready_for_service", // Temporalmente simplificado
        };
      }

      // Cliente nuevo - crear con datos mínimos para el flujo RGPD
      const newClientData = {
        phone: normalizedPhone,
        full_name: messageData.senderName || "Cliente WhatsApp",
        email: null,
        source: "whatsapp_bot",
        is_active: true,
        // gdpr_consent: false, // Campo no disponible en esquema actual
        // marketing_consent: false,
        notes: `Cliente nuevo desde WhatsApp Bot - ${new Date().toISOString()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const createResult = await this.clientModel.create(newClientData);

      if (createResult && createResult.success && createResult.data) {
        const newClient = createResult.data;

        logger.info("Nuevo cliente creado para flujo WhatsApp", {
          clientId: newClient.id,
          phone: normalizedPhone,
          name: newClient.full_name,
        });

        return {
          success: true,
          isExistingClient: false,
          client: newClient,
          needsGdprConsent: true,
          canProceedWithService: false,
          welcomeMessage: `¡Hola! 👋 Soy el asistente de Ricardo Buriticá Beauty Consulting.`,
          flowStatus: "new_client_needs_gdpr",
        };
      } else {
        throw new Error(
          `Error creando cliente: ${createResult?.error || "Error desconocido"}`
        );
      }
    } catch (error) {
      logger.error("Error en handleWhatsAppClientFlow", {
        error: error.message,
        phone: whatsappPhone
          ? whatsappPhone.substring(0, 5) + "***"
          : "undefined",
        messageData: messageData ? Object.keys(messageData) : [],
        stack: error.stack,
      });

      return {
        success: false,
        error: error.message,
        isExistingClient: false,
        client: null,
        needsGdprConsent: true,
        canProceedWithService: false,
        welcomeMessage:
          "Lo siento, ha ocurrido un error. Por favor, inténtalo de nuevo.",
        flowStatus: "error",
      };
    }
  }

  /**
   * Actualizar consentimiento RGPD desde WhatsApp
   * @param {string} clientId - ID del cliente
   * @param {boolean} gdprConsent - Consentimiento RGPD
   * @param {boolean} marketingConsent - Consentimiento marketing (opcional)
   * @returns {object} Resultado de la actualización
   */
  async updateWhatsAppGdprConsent(
    clientId,
    gdprConsent,
    marketingConsent = false
  ) {
    try {
      const consentData = {
        gdpr_consent: gdprConsent, // Mantenemos para lógica interna
        marketing_consent: marketingConsent,
        // gdpr_consent_date: gdprConsent ? new Date().toISOString() : null, // Campo no disponible
        // gdpr_consent_source: "whatsapp_bot",
        updated_at: new Date().toISOString(),
      };

      const result = await this.clientModel.updateGdprConsent(
        clientId,
        consentData
      );

      if (result && result.success) {
        logger.info("Consentimiento RGPD actualizado desde WhatsApp", {
          clientId,
          gdprConsent,
          marketingConsent,
        });
      }

      return result;
    } catch (error) {
      logger.error("Error actualizando consentimiento RGPD desde WhatsApp", {
        error: error.message,
        clientId,
        gdprConsent,
        marketingConsent,
      });

      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  // Métodos estáticos para compatibilidad con código existente
  static async getAllClients(options = {}) {
    const service = new ClientService();
    return await service.getAllClients(options);
  }

  static async findById(clientId) {
    const service = new ClientService();
    return await service.findById(clientId);
  }

  static async findByPhone(phone) {
    const service = new ClientService();
    return await service.findByPhone(phone);
  }

  static async findByEmail(email) {
    const service = new ClientService();
    return await service.findByEmail(email);
  }

  static async findByWhatsAppId(whatsappId) {
    const service = new ClientService();
    return await service.findByWhatsAppId(whatsappId);
  }

  static async createClient(clientData) {
    const service = new ClientService();
    return await service.createClient(clientData);
  }

  static async updateClient(clientId, updateData) {
    const service = new ClientService();
    return await service.updateClient(clientId, updateData);
  }

  static async deleteClient(clientId, reason = "") {
    const service = new ClientService();
    return await service.deleteClient(clientId, reason);
  }

  static async handleWhatsAppClientFlow(whatsappPhone, messageData = {}) {
    const service = new ClientService();
    return await service.handleWhatsAppClientFlow(whatsappPhone, messageData);
  }

  static async updateWhatsAppGdprConsent(
    clientId,
    gdprConsent,
    marketingConsent = false
  ) {
    const service = new ClientService();
    return await service.updateWhatsAppGdprConsent(
      clientId,
      gdprConsent,
      marketingConsent
    );
  }

  static async findOrCreateByPhone(phone, clientData = {}) {
    const service = new ClientService();
    return await service.findOrCreateByPhone(phone, clientData);
  }
}

module.exports = ClientService;
