// src/controllers/clientController.js
// Controlador para gestión de clientes con validaciones y lógica de negocio

const clientModel = require("../models/clientModel");
const bookingService = require("../services/bookingService");
const logger = require("../utils/logger");
const {
  validateClientData,
  validateEmail,
  validatePhone,
} = require("../utils/validators");

class ClientController {
  /**
   * Crear nuevo cliente
   * POST /api/clients
   */
  async createClient(req, res) {
    try {
      logger.info("👤 Creando nuevo cliente", {
        body: req.body,
        ip: req.ip,
      });

      // Validar datos de entrada
      const validation = validateClientData(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: "Datos de cliente inválidos",
          details: validation.errors,
        });
      }

      const { nombre, email, telefono, fecha_nacimiento, notas } = req.body;

      // Verificar si el cliente ya existe (por teléfono o email)
      if (telefono) {
        const existingByPhone = await clientModel.findByPhone(telefono);
        if (existingByPhone.success && existingByPhone.data) {
          return res.status(409).json({
            success: false,
            error: "Ya existe un cliente con este teléfono",
          });
        }
      }

      if (email) {
        const existingByEmail = await clientModel.findByEmail(email);
        if (existingByEmail.success && existingByEmail.data) {
          return res.status(409).json({
            success: false,
            error: "Ya existe un cliente con este email",
          });
        }
      }

      // Crear el cliente
      const clientData = {
        nombre,
        email,
        telefono,
        fecha_nacimiento,
        notas: notas || "",
        fecha_registro: new Date().toISOString(),
        activo: true,
      };

      const result = await clientModel.create(clientData);

      if (result.success) {
        logger.info("✅ Cliente creado exitosamente", {
          clientId: result.data.id_cliente,
          nombre,
          telefono,
        });

        res.status(201).json({
          success: true,
          data: result.data,
          message: "Cliente creado exitosamente",
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("❌ Error creando cliente:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Obtener todos los clientes con filtros
   * GET /api/clients
   */
  async getClients(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        activo,
        order_by = "fecha_registro",
        order_direction = "DESC",
      } = req.query;

      logger.info("📋 Obteniendo clientes", {
        filters: req.query,
        ip: req.ip,
      });

      const filters = {
        search,
        activo: activo !== undefined ? activo === "true" : undefined,
      };

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        orderBy: order_by,
        orderDirection: order_direction.toUpperCase(),
      };

      const result = await clientModel.getAll(filters, options);

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          pagination: result.pagination,
          total: result.total,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("❌ Error obteniendo clientes:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Obtener cliente por ID
   * GET /api/clients/:id
   */
  async getClientById(req, res) {
    try {
      const { id } = req.params;

      logger.info("👤 Obteniendo cliente por ID", {
        clientId: id,
        ip: req.ip,
      });

      const result = await clientModel.getById(id);

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
        });
      } else {
        res.status(404).json({
          success: false,
          error: "Cliente no encontrado",
        });
      }
    } catch (error) {
      logger.error("❌ Error obteniendo cliente:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Buscar cliente por teléfono
   * GET /api/clients/phone/:phone
   */
  async getClientByPhone(req, res) {
    try {
      const { phone } = req.params;

      logger.info("📱 Buscando cliente por teléfono", {
        phone,
        ip: req.ip,
      });

      // Validar formato de teléfono
      const phoneValidation = validatePhone(phone);
      if (!phoneValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: "Formato de teléfono inválido",
          details: phoneValidation.errors,
        });
      }

      const result = await clientModel.findByPhone(phone);

      if (result.success && result.data) {
        res.json({
          success: true,
          data: result.data,
        });
      } else {
        res.status(404).json({
          success: false,
          error: "Cliente no encontrado",
        });
      }
    } catch (error) {
      logger.error("❌ Error buscando cliente por teléfono:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Buscar cliente por email
   * GET /api/clients/email/:email
   */
  async getClientByEmail(req, res) {
    try {
      const { email } = req.params;

      logger.info("📧 Buscando cliente por email", {
        email,
        ip: req.ip,
      });

      // Validar formato de email
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: "Formato de email inválido",
          details: emailValidation.errors,
        });
      }

      const result = await clientModel.findByEmail(email);

      if (result.success && result.data) {
        res.json({
          success: true,
          data: result.data,
        });
      } else {
        res.status(404).json({
          success: false,
          error: "Cliente no encontrado",
        });
      }
    } catch (error) {
      logger.error("❌ Error buscando cliente por email:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Actualizar cliente
   * PUT /api/clients/:id
   */
  async updateClient(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      logger.info("📝 Actualizando cliente", {
        clientId: id,
        updateData,
        ip: req.ip,
      });

      // Verificar que el cliente existe
      const existingClient = await clientModel.getById(id);
      if (!existingClient.success) {
        return res.status(404).json({
          success: false,
          error: "Cliente no encontrado",
        });
      }

      // Validar datos de actualización
      if (updateData.email) {
        const emailValidation = validateEmail(updateData.email);
        if (!emailValidation.isValid) {
          return res.status(400).json({
            success: false,
            error: "Formato de email inválido",
            details: emailValidation.errors,
          });
        }

        // Verificar que el email no esté en uso por otro cliente
        const existingByEmail = await clientModel.findByEmail(updateData.email);
        if (
          existingByEmail.success &&
          existingByEmail.data &&
          existingByEmail.data.id_cliente !== id
        ) {
          return res.status(409).json({
            success: false,
            error: "El email ya está en uso por otro cliente",
          });
        }
      }

      if (updateData.telefono) {
        const phoneValidation = validatePhone(updateData.telefono);
        if (!phoneValidation.isValid) {
          return res.status(400).json({
            success: false,
            error: "Formato de teléfono inválido",
            details: phoneValidation.errors,
          });
        }

        // Verificar que el teléfono no esté en uso por otro cliente
        const existingByPhone = await clientModel.findByPhone(
          updateData.telefono
        );
        if (
          existingByPhone.success &&
          existingByPhone.data &&
          existingByPhone.data.id_cliente !== id
        ) {
          return res.status(409).json({
            success: false,
            error: "El teléfono ya está en uso por otro cliente",
          });
        }
      }

      const result = await clientModel.update(id, updateData);

      if (result.success) {
        logger.info("✅ Cliente actualizado", {
          clientId: id,
          changes: Object.keys(updateData),
        });

        res.json({
          success: true,
          data: result.data,
          message: "Cliente actualizado exitosamente",
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("❌ Error actualizando cliente:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Desactivar cliente (soft delete)
   * DELETE /api/clients/:id
   */
  async deactivateClient(req, res) {
    try {
      const { id } = req.params;

      logger.info("🗑️ Desactivando cliente", {
        clientId: id,
        ip: req.ip,
      });

      // Verificar que el cliente existe
      const existingClient = await clientModel.getById(id);
      if (!existingClient.success) {
        return res.status(404).json({
          success: false,
          error: "Cliente no encontrado",
        });
      }

      // Verificar si tiene reservas activas
      const activeBookings = await bookingService.getBookings({
        client_id: id,
        status: ["pending", "confirmed"],
      });

      if (activeBookings.success && activeBookings.data.length > 0) {
        return res.status(400).json({
          success: false,
          error: "No se puede desactivar un cliente con reservas activas",
          activeBookings: activeBookings.data.length,
        });
      }

      const result = await clientModel.update(id, { activo: false });

      if (result.success) {
        logger.info("✅ Cliente desactivado", { clientId: id });

        res.json({
          success: true,
          message: "Cliente desactivado exitosamente",
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("❌ Error desactivando cliente:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Obtener historial de reservas del cliente
   * GET /api/clients/:id/bookings
   */
  async getClientBookings(req, res) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 10, status } = req.query;

      logger.info("📅 Obteniendo reservas del cliente", {
        clientId: id,
        filters: req.query,
        ip: req.ip,
      });

      // Verificar que el cliente existe
      const clientResult = await clientModel.getById(id);
      if (!clientResult.success) {
        return res.status(404).json({
          success: false,
          error: "Cliente no encontrado",
        });
      }

      const filters = {
        client_id: id,
        status,
      };

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
      };

      const result = await bookingService.getBookings(filters, options);

      if (result.success) {
        res.json({
          success: true,
          client: clientResult.data,
          bookings: result.data,
          pagination: result.pagination,
          total: result.total,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("❌ Error obteniendo reservas del cliente:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Obtener estadísticas del cliente
   * GET /api/clients/:id/stats
   */
  async getClientStats(req, res) {
    try {
      const { id } = req.params;

      logger.info("📊 Obteniendo estadísticas del cliente", {
        clientId: id,
        ip: req.ip,
      });

      // Verificar que el cliente existe
      const clientResult = await clientModel.getById(id);
      if (!clientResult.success) {
        return res.status(404).json({
          success: false,
          error: "Cliente no encontrado",
        });
      }

      const result = await clientModel.getClientStats(id);

      if (result.success) {
        res.json({
          success: true,
          client: clientResult.data,
          stats: result.data,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("❌ Error obteniendo estadísticas del cliente:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }

  /**
   * Buscar clientes
   * GET /api/clients/search
   */
  async searchClients(req, res) {
    try {
      const { q, limit = 10 } = req.query;

      logger.info("🔍 Buscando clientes", {
        query: q,
        limit,
        ip: req.ip,
      });

      if (!q || q.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: "La búsqueda debe tener al menos 2 caracteres",
        });
      }

      const result = await clientModel.search(q.trim(), parseInt(limit));

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          total: result.data.length,
          query: q.trim(),
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("❌ Error buscando clientes:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: error.message,
      });
    }
  }
}

module.exports = new ClientController();
