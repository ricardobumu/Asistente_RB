// src/api/servicios.js
// API endpoint para servicios del portal cliente

const express = require("express");
const router = express.Router();
const serviceModel = require("../models/serviceModel");

/**
 * GET /api/servicios
 * Obtener todos los servicios activos para el portal cliente
 */
router.get("/", async (req, res) => {
  try {
    console.log("📋 API: Obteniendo servicios para portal cliente");

    const result = await serviceModel.getAll();

    if (!result.success) {
      console.error("❌ Error obteniendo servicios:", result.error);
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        message: "No se pudieron obtener los servicios",
      });
    }

    // Filtrar solo servicios activos y formatear para el cliente
    const activeServices = result.data
      .filter((service) => service.activo === true)
      .map((service) => ({
        id_servicio: service.id_servicio,
        nombre: service.nombre,
        descripcion: service.descripcion,
        precio: service.precio,
        duracion: service.duracion,
        categoria: service.categoria,
        imagen_url: service.imagen_url,
        activo: service.activo,
      }))
      .sort((a, b) => {
        // Ordenar por categoría y luego por precio
        if (a.categoria !== b.categoria) {
          return a.categoria.localeCompare(b.categoria);
        }
        return a.precio - b.precio;
      });

    console.log(`✅ API: ${activeServices.length} servicios activos enviados`);

    res.json({
      success: true,
      data: activeServices,
      total: activeServices.length,
      categories: [...new Set(activeServices.map((s) => s.categoria))].sort(),
    });
  } catch (error) {
    console.error("❌ Error en API servicios:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: error.message,
    });
  }
});

/**
 * GET /api/servicios/categorias
 * Obtener servicios agrupados por categoría
 */
router.get("/categorias", async (req, res) => {
  try {
    console.log("📋 API: Obteniendo servicios por categorías");

    const result = await serviceModel.getAll();

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: "Error obteniendo servicios",
      });
    }

    // Agrupar por categoría
    const servicesByCategory = {};
    result.data
      .filter((service) => service.activo === true)
      .forEach((service) => {
        if (!servicesByCategory[service.categoria]) {
          servicesByCategory[service.categoria] = [];
        }
        servicesByCategory[service.categoria].push({
          id_servicio: service.id_servicio,
          nombre: service.nombre,
          descripcion: service.descripcion,
          precio: service.precio,
          duracion: service.duracion,
          imagen_url: service.imagen_url,
        });
      });

    // Ordenar servicios dentro de cada categoría por precio
    Object.keys(servicesByCategory).forEach((categoria) => {
      servicesByCategory[categoria].sort((a, b) => a.precio - b.precio);
    });

    console.log(
      `✅ API: Servicios agrupados en ${
        Object.keys(servicesByCategory).length
      } categorías`
    );

    res.json({
      success: true,
      data: servicesByCategory,
      categories: Object.keys(servicesByCategory).sort(),
    });
  } catch (error) {
    console.error("❌ Error en API servicios/categorias:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: error.message,
    });
  }
});

/**
 * GET /api/servicios/:id
 * Obtener un servicio específico por ID
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📋 API: Obteniendo servicio ${id}`);

    const result = await serviceModel.getById(id);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: "Servicio no encontrado",
      });
    }

    console.log(`✅ API: Servicio ${result.data.nombre} enviado`);

    res.json({
      success: true,
      data: {
        id_servicio: result.data.id_servicio,
        nombre: result.data.nombre,
        descripcion: result.data.descripcion,
        precio: result.data.precio,
        duracion: result.data.duracion,
        categoria: result.data.categoria,
        imagen_url: result.data.imagen_url,
        activo: result.data.activo,
      },
    });
  } catch (error) {
    console.error("❌ Error en API servicios/:id:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: error.message,
    });
  }
});

module.exports = router;
