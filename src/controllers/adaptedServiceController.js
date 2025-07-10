// src/controllers/adaptedServiceController.js
// Controlador de servicios adaptado a la estructura real

const adaptedServiceModel = require("../models/adaptedServiceModel");
const logger = require("../utils/logger");

/**
 * AdaptedServiceController - Controlador adaptado a la estructura real
 */
class AdaptedServiceController {
  /**
   * Obtener todos los servicios
   */
  async getAllServices(req, res) {
    try {
      logger.info("Obteniendo todos los servicios", {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      const result = await adaptedServiceModel.getAll();

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          data: null,
        });
      }

      // Formatear servicios para respuesta
      const formattedServices = adaptedServiceModel.formatServices(result.data);

      res.json({
        success: true,
        error: null,
        data: formattedServices,
        count: formattedServices.length,
      });
    } catch (error) {
      logger.error("Error en getAllServices", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        data: null,
      });
    }
  }

  /**
   * Obtener servicio por ID
   */
  async getServiceById(req, res) {
    try {
      const { id } = req.params;

      logger.info("Obteniendo servicio por ID", {
        serviceId: id,
        ip: req.ip,
      });

      const result = await adaptedServiceModel.getById(id);

      if (!result.success) {
        const statusCode =
          result.error === "Servicio no encontrado" ? 404 : 400;
        return res.status(statusCode).json({
          success: false,
          error: result.error,
          data: null,
        });
      }

      // Formatear servicio para respuesta
      const formattedService = adaptedServiceModel.formatService(result.data);

      res.json({
        success: true,
        error: null,
        data: formattedService,
      });
    } catch (error) {
      logger.error("Error en getServiceById", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        data: null,
      });
    }
  }

  /**
   * Obtener servicios activos
   */
  async getActiveServices(req, res) {
    try {
      logger.info("Obteniendo servicios activos", {
        ip: req.ip,
      });

      const result = await adaptedServiceModel.getActive();

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          data: null,
        });
      }

      // Formatear servicios para respuesta
      const formattedServices = adaptedServiceModel.formatServices(result.data);

      res.json({
        success: true,
        error: null,
        data: formattedServices,
        count: formattedServices.length,
      });
    } catch (error) {
      logger.error("Error en getActiveServices", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        data: null,
      });
    }
  }

  /**
   * Obtener servicios por categoría
   */
  async getServicesByCategory(req, res) {
    try {
      const { categoria } = req.params;

      logger.info("Obteniendo servicios por categoría", {
        categoria,
        ip: req.ip,
      });

      const result = await adaptedServiceModel.getByCategory(categoria);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          data: null,
        });
      }

      // Formatear servicios para respuesta
      const formattedServices = adaptedServiceModel.formatServices(result.data);

      res.json({
        success: true,
        error: null,
        data: formattedServices,
        count: formattedServices.length,
        categoria: categoria.toUpperCase(),
      });
    } catch (error) {
      logger.error("Error en getServicesByCategory", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        data: null,
      });
    }
  }

  /**
   * Buscar servicios
   */
  async searchServices(req, res) {
    try {
      const { q } = req.query;

      if (!q) {
        return res.status(400).json({
          success: false,
          error: 'Parámetro de búsqueda "q" es requerido',
          data: null,
        });
      }

      logger.info("Buscando servicios", {
        searchTerm: q,
        ip: req.ip,
      });

      const result = await adaptedServiceModel.searchByName(q);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          data: null,
        });
      }

      // Formatear servicios para respuesta
      const formattedServices = adaptedServiceModel.formatServices(result.data);

      res.json({
        success: true,
        error: null,
        data: formattedServices,
        count: formattedServices.length,
        searchTerm: q,
      });
    } catch (error) {
      logger.error("Error en searchServices", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        data: null,
      });
    }
  }

  /**
   * Listar servicios con paginación
   */
  async listServices(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        categoria = null,
        activo = null,
        sortBy = "created_at",
        sortOrder = "desc",
      } = req.query;

      logger.info("Listando servicios con paginación", {
        page,
        limit,
        categoria,
        activo,
        ip: req.ip,
      });

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        categoria,
        activo: activo !== null ? activo === "true" : null,
        sortBy,
        sortOrder,
      };

      const result = await adaptedServiceModel.list(options);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          data: null,
          pagination: null,
        });
      }

      // Formatear servicios para respuesta
      const formattedServices = adaptedServiceModel.formatServices(result.data);

      res.json({
        success: true,
        error: null,
        data: formattedServices,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error("Error en listServices", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        data: null,
        pagination: null,
      });
    }
  }

  /**
   * Obtener estadísticas de servicios
   */
  async getServiceStats(req, res) {
    try {
      logger.info("Obteniendo estadísticas de servicios", {
        ip: req.ip,
      });

      const result = await adaptedServiceModel.getStats();

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          data: null,
        });
      }

      res.json({
        success: true,
        error: null,
        data: result.data,
      });
    } catch (error) {
      logger.error("Error en getServiceStats", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        data: null,
      });
    }
  }

  /**
   * Obtener categorías válidas
   */
  async getValidCategories(req, res) {
    try {
      res.json({
        success: true,
        error: null,
        data: {
          categories: adaptedServiceModel.validCategories,
          count: adaptedServiceModel.validCategories.length,
        },
      });
    } catch (error) {
      logger.error("Error en getValidCategories", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        data: null,
      });
    }
  }
}

module.exports = new AdaptedServiceController();
