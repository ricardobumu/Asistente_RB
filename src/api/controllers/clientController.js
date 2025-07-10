// src/api/controllers/clientController.js
const clientModel = require("../../models/clientModel");
const logger = require("../../utils/logger");
const Validators = require("../../utils/validators");

/**
 * ClientController - API REST para gestión de clientes
 *
 * Funcionalidades:
 * - CRUD completo de clientes
 * - Búsquedas avanzadas con filtros
 * - Gestión de perfil del cliente
 * - Historial de actividades
 * - Estadísticas personalizadas
 */
class ClientController {
  constructor() {
    this.clientModel = clientModel;

    logger.info("ClientController inicializado");
  }

  /**
   * Obtener perfil del cliente autenticado
   * GET /api/clients/me
   */
  async getMyProfile(req, res) {
    try {
      const clientId = req.user.id;

      const result = await this.clientModel.getById(clientId);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: "Cliente no encontrado",
        });
      }

      // Remover datos sensibles
      const clientData = { ...result.data };
      delete clientData.password_hash;
      delete clientData.token_version;

      res.json({
        success: true,
        data: clientData,
      });
    } catch (error) {
      logger.error("Error obteniendo perfil de cliente", error, {
        clientId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Actualizar perfil del cliente autenticado
   * PUT /api/clients/me
   */
  async updateMyProfile(req, res) {
    try {
      const clientId = req.user.id;
      const updateData = req.body;

      // Campos permitidos para actualización por el cliente
      const allowedFields = [
        "name",
        "phone",
        "whatsapp_number",
        "preferred_contact_method",
        "notes",
        "birth_date",
        "gender",
        "address",
      ];

      // Filtrar solo campos permitidos
      const filteredData = {};
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          filteredData[field] = updateData[field];
        }
      }

      if (Object.keys(filteredData).length === 0) {
        return res.status(400).json({
          success: false,
          error: "No hay campos válidos para actualizar",
        });
      }

      // Validar datos si están presentes
      if (filteredData.phone && !Validators.validatePhone(filteredData.phone)) {
        return res.status(400).json({
          success: false,
          error: "Formato de teléfono inválido",
        });
      }

      const result = await this.clientModel.update(clientId, filteredData);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      // Remover datos sensibles
      const clientData = { ...result.data };
      delete clientData.password_hash;
      delete clientData.token_version;

      logger.info("Perfil de cliente actualizado", {
        clientId,
        updatedFields: Object.keys(filteredData),
      });

      res.json({
        success: true,
        data: clientData,
        message: "Perfil actualizado exitosamente",
      });
    } catch (error) {
      logger.error("Error actualizando perfil de cliente", error, {
        clientId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Obtener historial de reservas del cliente
   * GET /api/clients/me/bookings
   */
  async getMyBookings(req, res) {
    try {
      const clientId = req.user.id;
      const { page = 1, limit = 10, status, from_date, to_date } = req.query;

      const offset = (page - 1) * limit;

      // Construir filtros
      const filters = { client_id: clientId };
      if (status) filters.status = status;
      if (from_date) filters.from_date = from_date;
      if (to_date) filters.to_date = to_date;

      const result = await this.clientModel.getClientBookings(clientId, {
        limit: parseInt(limit),
        offset,
        filters,
      });

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: "Error obteniendo historial de reservas",
        });
      }

      res.json({
        success: true,
        data: result.data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.total || result.data.length,
        },
      });
    } catch (error) {
      logger.error("Error obteniendo historial de reservas", error, {
        clientId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Obtener estadísticas del cliente
   * GET /api/clients/me/stats
   */
  async getMyStats(req, res) {
    try {
      const clientId = req.user.id;

      const result = await this.clientModel.getClientStats(clientId);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: "Error obteniendo estadísticas",
        });
      }

      res.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      logger.error("Error obteniendo estadísticas de cliente", error, {
        clientId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  // ===== MÉTODOS PARA ADMINISTRADORES =====

  /**
   * Obtener todos los clientes (solo admin)
   * GET /api/clients
   */
  async getAllClients(req, res) {
    try {
      const { page = 1, limit = 20, search, vip_only, status } = req.query;

      const offset = (page - 1) * limit;

      let result;

      if (search) {
        result = await this.clientModel.searchClients(search, {
          limit: parseInt(limit),
          offset,
        });
      } else if (vip_only === "true") {
        result = await this.clientModel.getVipClients();
      } else {
        result = await this.clientModel.getAll(parseInt(limit), offset);
      }

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: "Error obteniendo clientes",
        });
      }

      // Remover datos sensibles de todos los clientes
      const sanitizedData = result.data.map((client) => {
        const sanitized = { ...client };
        delete sanitized.password_hash;
        delete sanitized.token_version;
        return sanitized;
      });

      res.json({
        success: true,
        data: sanitizedData,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.total || sanitizedData.length,
        },
      });
    } catch (error) {
      logger.error("Error obteniendo lista de clientes", error, {
        adminId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Obtener cliente específico (solo admin)
   * GET /api/clients/:id
   */
  async getClientById(req, res) {
    try {
      const { id } = req.params;

      const result = await this.clientModel.getById(id);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: "Cliente no encontrado",
        });
      }

      // Remover datos sensibles
      const clientData = { ...result.data };
      delete clientData.password_hash;
      delete clientData.token_version;

      res.json({
        success: true,
        data: clientData,
      });
    } catch (error) {
      logger.error("Error obteniendo cliente por ID", error, {
        clientId: req.params.id,
        adminId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Actualizar cliente (solo admin)
   * PUT /api/clients/:id
   */
  async updateClient(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Campos que solo admin puede modificar
      const adminOnlyFields = ["email", "vip_status", "status", "notes_admin"];

      const result = await this.clientModel.update(id, updateData);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      // Remover datos sensibles
      const clientData = { ...result.data };
      delete clientData.password_hash;
      delete clientData.token_version;

      logger.info("Cliente actualizado por admin", {
        clientId: id,
        adminId: req.user.id,
        updatedFields: Object.keys(updateData),
      });

      res.json({
        success: true,
        data: clientData,
        message: "Cliente actualizado exitosamente",
      });
    } catch (error) {
      logger.error("Error actualizando cliente", error, {
        clientId: req.params.id,
        adminId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Suspender cliente (solo admin)
   * POST /api/clients/:id/suspend
   */
  async suspendClient(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const result = await this.clientModel.suspendClient(id, reason);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      logger.warn("Cliente suspendido", {
        clientId: id,
        adminId: req.user.id,
        reason,
      });

      res.json({
        success: true,
        data: result.data,
        message: "Cliente suspendido exitosamente",
      });
    } catch (error) {
      logger.error("Error suspendiendo cliente", error, {
        clientId: req.params.id,
        adminId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Reactivar cliente (solo admin)
   * POST /api/clients/:id/reactivate
   */
  async reactivateClient(req, res) {
    try {
      const { id } = req.params;

      const result = await this.clientModel.reactivateClient(id);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      logger.info("Cliente reactivado", {
        clientId: id,
        adminId: req.user.id,
      });

      res.json({
        success: true,
        data: result.data,
        message: "Cliente reactivado exitosamente",
      });
    } catch (error) {
      logger.error("Error reactivando cliente", error, {
        clientId: req.params.id,
        adminId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Eliminar cliente (solo super admin)
   * DELETE /api/clients/:id
   */
  async deleteClient(req, res) {
    try {
      const { id } = req.params;

      const result = await this.clientModel.delete(id);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      logger.warn("Cliente eliminado", {
        clientId: id,
        adminId: req.user.id,
      });

      res.json({
        success: true,
        message: "Cliente eliminado exitosamente",
      });
    } catch (error) {
      logger.error("Error eliminando cliente", error, {
        clientId: req.params.id,
        adminId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
}

module.exports = ClientController;
