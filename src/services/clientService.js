// src/services/clientService.js
const DatabaseAdapter = require("../adapters/databaseAdapter");

class ClientService {
  /**
   * Obtener todos los clientes
   */
  static async getAllClients() {
    try {
      const { data, error } = await DatabaseAdapter.select("clients");

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        count: data?.length || 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Buscar cliente por teléfono
   */
  static async findByPhone(phone) {
    try {
      const { data, error } = await DatabaseAdapter.select("clients", "*", {
        phone,
      });

      if (error) throw error;

      return {
        success: true,
        data: data?.[0] || null,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Buscar cliente por WhatsApp ID
   */
  static async findByWhatsAppId(whatsappId) {
    try {
      const { data, error } = await DatabaseAdapter.select("clients", "*", {
        whatsapp_phone: whatsappId,
      });

      if (error) throw error;

      return {
        success: true,
        data: data?.[0] || null,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Crear nuevo cliente
   */
  static async createClient(clientData) {
    try {
      const { data, error } = await DatabaseAdapter.insert(
        "clients",
        clientData
      );

      if (error) throw error;

      return {
        success: true,
        data: data?.[0] || null,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Actualizar cliente
   */
  static async updateClient(clientId, updateData) {
    try {
      const { data, error } = await DatabaseAdapter.update(
        "clients",
        updateData,
        { id: clientId }
      );

      if (error) throw error;

      return {
        success: true,
        data: data?.[0] || null,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }
}

module.exports = ClientService;
