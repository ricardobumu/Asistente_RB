// src/services/clientService.js
const DatabaseAdapter = require("../adapters/databaseAdapter");
const logger = require("../utils/logger");
const {
  validateClientData,
  sanitizeClientData,
} = require("../utils/validators");

class ClientService {
  /**
   * Obtener todos los clientes con paginación
   */
  static async getAllClients(options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        search = "",
        sortBy = "created_at",
        sortOrder = "desc",
      } = options;
      const offset = (page - 1) * limit;

      let query = "SELECT * FROM clients";
      let countQuery = "SELECT COUNT(*) as total FROM clients";
      const params = [];

      // Filtro de búsqueda
      if (search) {
        const searchCondition =
          " WHERE (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)";
        query += searchCondition;
        countQuery += searchCondition;
        params.push(`%${search}%`);
      }

      // Ordenamiento
      query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

      // Paginación
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const [clientsResult, countResult] = await Promise.all([
        DatabaseAdapter.query(query, params),
        DatabaseAdapter.query(countQuery, search ? [`%${search}%`] : []),
      ]);

      if (clientsResult.error) throw new Error(clientsResult.error);
      if (countResult.error) throw new Error(countResult.error);

      const total = countResult.data[0]?.total || 0;
      const totalPages = Math.ceil(total / limit);

      logger.info("Clients retrieved", {
        count: clientsResult.data?.length || 0,
        total,
        page,
        search: search || "none",
      });

      return {
        success: true,
        data: clientsResult.data || [],
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error("Error getting all clients", {
        error: error.message,
        options,
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
   */
  static async findById(clientId) {
    try {
      if (!clientId) {
        throw new Error("Client ID is required");
      }

      const { data, error } = await DatabaseAdapter.select("clients", "*", {
        id: clientId,
      });

      if (error) throw error;

      const client = data?.[0] || null;

      logger.info("Client found by ID", {
        clientId,
        found: !!client,
        clientName: client ? `${client.first_name} ${client.last_name}` : null,
      });

      return {
        success: true,
        data: client,
      };
    } catch (error) {
      logger.error("Error finding client by ID", {
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
   * Buscar cliente por teléfono
   */
  static async findByPhone(phone) {
    try {
      if (!phone) {
        throw new Error("Phone number is required");
      }

      // Normalizar número de teléfono
      const normalizedPhone = phone.replace(/\s+/g, "").replace(/^\+/, "");

      const { data, error } = await DatabaseAdapter.select("clients", "*", {
        phone: normalizedPhone,
      });

      if (error) throw error;

      const client = data?.[0] || null;

      logger.info("Client search by phone", {
        phone: normalizedPhone,
        found: !!client,
        clientId: client?.id,
      });

      return {
        success: true,
        data: client,
      };
    } catch (error) {
      logger.error("Error finding client by phone", {
        error: error.message,
        phone,
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
  static async findByEmail(email) {
    try {
      if (!email) {
        throw new Error("Email is required");
      }

      const normalizedEmail = email.toLowerCase().trim();

      const { data, error } = await DatabaseAdapter.select("clients", "*", {
        email: normalizedEmail,
      });

      if (error) throw error;

      const client = data?.[0] || null;

      logger.info("Client search by email", {
        email: normalizedEmail,
        found: !!client,
        clientId: client?.id,
      });

      return {
        success: true,
        data: client,
      };
    } catch (error) {
      logger.error("Error finding client by email", {
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
   * Crear nuevo cliente con validaciones completas
   */
  static async createClient(clientData) {
    try {
      // Validar datos de entrada
      const validation = validateClientData(clientData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      // Sanitizar datos
      const sanitizedData = sanitizeClientData(clientData);

      // Verificar duplicados por teléfono
      if (sanitizedData.phone) {
        const existingByPhone = await this.findByPhone(sanitizedData.phone);
        if (existingByPhone.success && existingByPhone.data) {
          throw new Error("Client with this phone number already exists");
        }
      }

      // Verificar duplicados por email
      if (sanitizedData.email) {
        const existingByEmail = await this.findByEmail(sanitizedData.email);
        if (existingByEmail.success && existingByEmail.data) {
          throw new Error("Client with this email already exists");
        }
      }

      // Agregar campos de auditoría y RGPD
      const clientToCreate = {
        ...sanitizedData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        lgpd_accepted: sanitizedData.lgpd_accepted || false,
        lgpd_accepted_at: sanitizedData.lgpd_accepted
          ? new Date().toISOString()
          : null,
        registration_complete: sanitizedData.registration_complete || false,
        status: "active",
      };

      const { data, error } = await DatabaseAdapter.insert(
        "clients",
        clientToCreate
      );

      if (error) throw error;

      const newClient = data?.[0] || null;

      logger.info("Client created successfully", {
        clientId: newClient?.id,
        phone: sanitizedData.phone,
        email: sanitizedData.email,
        name: `${sanitizedData.first_name} ${sanitizedData.last_name}`,
        lgpdAccepted: sanitizedData.lgpd_accepted,
      });

      return {
        success: true,
        data: newClient,
        message: "Client created successfully",
      };
    } catch (error) {
      logger.error("Error creating client", {
        error: error.message,
        clientData: {
          phone: clientData?.phone,
          email: clientData?.email,
          name: clientData?.first_name,
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
  static async updateClient(clientId, updateData) {
    try {
      if (!clientId) {
        throw new Error("Client ID is required");
      }

      // Verificar que el cliente existe
      const existingClient = await this.findById(clientId);
      if (!existingClient.success || !existingClient.data) {
        throw new Error("Client not found");
      }

      // Validar datos de actualización
      const validation = validateClientData(updateData, false); // false = partial validation
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      // Sanitizar datos
      const sanitizedData = sanitizeClientData(updateData);

      // Verificar duplicados si se actualiza teléfono o email
      if (
        sanitizedData.phone &&
        sanitizedData.phone !== existingClient.data.phone
      ) {
        const existingByPhone = await this.findByPhone(sanitizedData.phone);
        if (
          existingByPhone.success &&
          existingByPhone.data &&
          existingByPhone.data.id !== clientId
        ) {
          throw new Error(
            "Another client with this phone number already exists"
          );
        }
      }

      if (
        sanitizedData.email &&
        sanitizedData.email !== existingClient.data.email
      ) {
        const existingByEmail = await this.findByEmail(sanitizedData.email);
        if (
          existingByEmail.success &&
          existingByEmail.data &&
          existingByEmail.data.id !== clientId
        ) {
          throw new Error("Another client with this email already exists");
        }
      }

      // Agregar timestamp de actualización
      const dataToUpdate = {
        ...sanitizedData,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await DatabaseAdapter.update(
        "clients",
        dataToUpdate,
        { id: clientId }
      );

      if (error) throw error;

      const updatedClient = data?.[0] || null;

      logger.info("Client updated successfully", {
        clientId,
        updatedFields: Object.keys(sanitizedData),
        name: `${updatedClient?.first_name} ${updatedClient?.last_name}`,
      });

      return {
        success: true,
        data: updatedClient,
        message: "Client updated successfully",
      };
    } catch (error) {
      logger.error("Error updating client", {
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
  static async deleteClient(clientId, reason = "") {
    try {
      if (!clientId) {
        throw new Error("Client ID is required");
      }

      // Verificar que el cliente existe
      const existingClient = await this.findById(clientId);
      if (!existingClient.success || !existingClient.data) {
        throw new Error("Client not found");
      }

      // Verificar si tiene reservas activas
      const activeBookingsQuery = `
        SELECT COUNT(*) as count 
        FROM bookings 
        WHERE client_id = $1 
        AND status IN ('confirmed', 'pending') 
        AND service_date >= NOW()
      `;

      const bookingsResult = await DatabaseAdapter.query(activeBookingsQuery, [
        clientId,
      ]);

      if (bookingsResult.error) {
        throw new Error("Error checking active bookings");
      }

      const activeBookings = bookingsResult.data[0]?.count || 0;

      if (activeBookings > 0) {
        throw new Error(
          `Cannot delete client with ${activeBookings} active booking(s). Cancel bookings first.`
        );
      }

      // Soft delete
      const deleteData = {
        status: "deleted",
        deleted_at: new Date().toISOString(),
        deletion_reason: reason,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await DatabaseAdapter.update(
        "clients",
        deleteData,
        { id: clientId }
      );

      if (error) throw error;

      logger.info("Client soft deleted", {
        clientId,
        reason,
        clientName: `${existingClient.data.first_name} ${existingClient.data.last_name}`,
      });

      return {
        success: true,
        data: data?.[0] || null,
        message: "Client deleted successfully",
      };
    } catch (error) {
      logger.error("Error deleting client", {
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
   * Obtener estadísticas de clientes
   */
  static async getClientStats() {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_clients,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_clients,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_clients_30d,
          COUNT(CASE WHEN lgpd_accepted = true THEN 1 END) as lgpd_accepted,
          COUNT(CASE WHEN registration_complete = true THEN 1 END) as complete_registrations
        FROM clients
        WHERE status != 'deleted'
      `;

      const result = await DatabaseAdapter.query(statsQuery);

      if (result.error) throw new Error(result.error);

      const stats = result.data[0] || {};

      logger.info("Client stats retrieved", stats);

      return {
        success: true,
        data: {
          totalClients: parseInt(stats.total_clients) || 0,
          activeClients: parseInt(stats.active_clients) || 0,
          newClients30d: parseInt(stats.new_clients_30d) || 0,
          lgpdAccepted: parseInt(stats.lgpd_accepted) || 0,
          completeRegistrations: parseInt(stats.complete_registrations) || 0,
          lgpdComplianceRate:
            stats.total_clients > 0
              ? (
                  (parseInt(stats.lgpd_accepted) /
                    parseInt(stats.total_clients)) *
                  100
                ).toFixed(2)
              : 0,
        },
      };
    } catch (error) {
      logger.error("Error getting client stats", { error: error.message });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }
}

module.exports = ClientService;

module.exports = ClientService;
