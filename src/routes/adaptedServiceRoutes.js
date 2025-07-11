// src/routes/adaptedServiceRoutes.js
// Rutas de servicios adaptadas a la estructura real

const express = require("express");
const router = express.Router();
const adaptedServiceController = require("../controllers/adaptedServiceController");
const logger = require("../utils/logger");

// Middleware de logging para todas las rutas de servicios
router.use((req, res, next) => {
  logger.info(`Servicio API Request: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    params: req.params,
    query: req.query,
  });
  next();
});

/**
 * @route GET /api/services/adapted
 * @desc Obtener todos los servicios
 * @access Public
 */
router.get("/", adaptedServiceController.getAllServices);

/**
 * @route GET /api/services/adapted/active
 * @desc Obtener servicios activos
 * @access Public
 */
router.get("/active", adaptedServiceController.getActiveServices);

/**
 * @route GET /api/services/adapted/stats
 * @desc Obtener estadísticas de servicios
 * @access Public
 */
router.get("/stats", adaptedServiceController.getServiceStats);

/**
 * @route GET /api/services/adapted/categories
 * @desc Obtener categorías válidas
 * @access Public
 */
router.get("/categories", adaptedServiceController.getValidCategories);

/**
 * @route GET /api/services/adapted/search
 * @desc Buscar servicios por nombre o descripción
 * @query q - término de búsqueda
 * @access Public
 */
router.get("/search", adaptedServiceController.searchServices);

/**
 * @route GET /api/services/adapted/list
 * @desc Listar servicios con paginación y filtros
 * @query page, limit, categoria, activo, sortBy, sortOrder
 * @access Public
 */
router.get("/list", adaptedServiceController.listServices);

/**
 * @route GET /api/services/adapted/category/:categoria
 * @desc Obtener servicios por categoría
 * @param categoria - Categoría del servicio (CORTE, TRATAMIENTO, etc.)
 * @access Public
 */
router.get(
  "/category/:categoria",
  adaptedServiceController.getServicesByCategory,
);

/**
 * @route GET /api/services/adapted/:id
 * @desc Obtener servicio por ID
 * @param id - ID del servicio (UUID)
 * @access Public
 */
router.get("/:id", adaptedServiceController.getServiceById);

// Middleware de manejo de errores específico para servicios
router.use((error, req, res, next) => {
  logger.error("Error en rutas de servicios adaptadas", {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  res.status(500).json({
    success: false,
    error: "Error interno en el servicio de servicios",
    data: null,
  });
});

module.exports = router;
