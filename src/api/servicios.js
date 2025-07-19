// src/api/servicios.js
const express = require("express");
const router = express.Router();
const logger = require("../utils/logger");
const ServiceModel = require("../models/serviceModel");

// Instancia del modelo de servicios
const serviceModel = new ServiceModel();

// Middleware de logging específico para servicios
router.use((req, res, next) => {
  logger.info(`Servicios API Request: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });
  next();
});

// ===== RUTAS DE SERVICIOS PÚBLICAS (PARA PORTAL CLIENTE) =====

/**
 * GET /api/servicios
 * Obtener todos los servicios activos
 */
router.get("/", async (req, res) => {
  try {
    const result = await serviceModel.getAllActive();

    if (result.success) {
      // Filtrar información sensible para el cliente
      const publicServices = result.data.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        duration: service.duration,
        price: service.price,
        currency: service.currency || "EUR",
        category: service.category,
        is_active: service.is_active,
        calendly_url: service.calendly_url,
        created_at: service.created_at,
      }));

      res.status(200).json({
        success: true,
        data: publicServices,
        count: publicServices.length,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Error obteniendo servicios",
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error("Error en GET /api/servicios:", {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/servicios/:id
 * Obtener un servicio específico por ID
 */
router.get("/:id", async (req, res) => {
  try {
    const serviceId = req.params.id;

    if (!serviceId || isNaN(serviceId)) {
      return res.status(400).json({
        success: false,
        error: "ID de servicio inválido",
        timestamp: new Date().toISOString(),
      });
    }

    const result = await serviceModel.findById(parseInt(serviceId));

    if (result.success && result.data) {
      // Filtrar información sensible
      const publicService = {
        id: result.data.id,
        name: result.data.name,
        description: result.data.description,
        duration: result.data.duration,
        price: result.data.price,
        currency: result.data.currency || "EUR",
        category: result.data.category,
        is_active: result.data.is_active,
        calendly_url: result.data.calendly_url,
        created_at: result.data.created_at,
      };

      res.status(200).json({
        success: true,
        data: publicService,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(404).json({
        success: false,
        error: "Servicio no encontrado",
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error(`Error en GET /api/servicios/${req.params.id}:`, {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/servicios/categoria/:categoria
 * Obtener servicios por categoría
 */
router.get("/categoria/:categoria", async (req, res) => {
  try {
    const categoria = req.params.categoria;

    if (!categoria) {
      return res.status(400).json({
        success: false,
        error: "Categoría requerida",
        timestamp: new Date().toISOString(),
      });
    }

    const result = await serviceModel.findByCategory(categoria);

    if (result.success) {
      // Filtrar información sensible
      const publicServices = result.data.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        duration: service.duration,
        price: service.price,
        currency: service.currency || "EUR",
        category: service.category,
        is_active: service.is_active,
        calendly_url: service.calendly_url,
        created_at: service.created_at,
      }));

      res.status(200).json({
        success: true,
        data: publicServices,
        count: publicServices.length,
        category: categoria,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Error obteniendo servicios por categoría",
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error(
      `Error en GET /api/servicios/categoria/${req.params.categoria}:`,
      {
        error: error.message,
        stack: error.stack,
        ip: req.ip,
      }
    );

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      timestamp: new Date().toISOString(),
    });
  }
});

// ===== MANEJO DE ERRORES =====
router.use((error, req, res, next) => {
  logger.error("Error en API de servicios:", {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  res.status(error.status || 500).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? "Error interno del servidor"
        : error.message,
    timestamp: new Date().toISOString(),
  });
});

// ===== RUTA NO ENCONTRADA =====
router.use("*", (req, res) => {
  logger.warn(
    `Servicios API endpoint no encontrado: ${req.method} ${req.originalUrl}`,
    {
      ip: req.ip,
    }
  );

  res.status(404).json({
    success: false,
    error: "Endpoint de servicios no encontrado",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
