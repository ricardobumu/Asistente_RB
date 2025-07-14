// src/routes/widgetRoutes.js
// Rutas para el widget de reservas público

const express = require("express");
const router = express.Router();
const widgetController = require("../controllers/widgetController");
const rateLimiter = require("../middleware/rateLimiter");
const cors = require("cors");
const {
  servicesCache,
  availabilityCache,
  widgetInfoCache,
  invalidateBookingCache,
  httpCacheHeaders,
  staticFileCache
} = require("../middleware/cacheMiddleware");

// Configurar CORS específico para el widget (permite embebido en otras webs)
const widgetCorsOptions = {
  origin: true, // Permite cualquier origen para el widget
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
};

// Aplicar CORS a todas las rutas del widget
router.use(cors(widgetCorsOptions));

// Rate limiting específico para el widget (más permisivo)
const widgetRateLimit = rateLimiter.createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50, // 50 requests por IP cada 15 minutos
  message: {
    success: false,
    error: "Demasiadas solicitudes. Inténtalo de nuevo en unos minutos."
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting más estricto para creación de reservas
const bookingRateLimit = rateLimiter.createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // 5 reservas por IP cada hora
  message: {
    success: false,
    error: "Límite de reservas alcanzado. Inténtalo de nuevo en una hora."
  }
});

/**
 * @route GET /widget/booking
 * @desc Servir el widget HTML
 * @access Public
 */
router.get("/booking", widgetRateLimit, widgetController.serveWidget);

/**
 * @route GET /widget/demo
 * @desc Servir página de demostración del widget
 * @access Public
 */
router.get("/demo", widgetRateLimit, (req, res) => {
  const path = require('path');
  res.sendFile(path.join(__dirname, '../../public/widget/demo.html'));
});

/**
 * @route GET /widget/info
 * @desc Obtener información del negocio para el widget
 * @access Public
 */
router.get("/info", widgetRateLimit, widgetInfoCache, httpCacheHeaders(1800), widgetController.getWidgetInfo);

/**
 * @route GET /widget/services
 * @desc Obtener servicios públicos para el widget
 * @access Public
 */
router.get("/services", widgetRateLimit, servicesCache, httpCacheHeaders(600), widgetController.getPublicServices);

/**
 * @route GET /widget/availability/:serviceId
 * @desc Obtener disponibilidad para un servicio en una fecha específica
 * @access Public
 */
router.get("/availability/:serviceId", widgetRateLimit, availabilityCache, httpCacheHeaders(120), widgetController.getAvailability);

/**
 * @route POST /widget/booking
 * @desc Crear nueva reserva desde el widget
 * @access Public
 */
router.post("/booking", bookingRateLimit, invalidateBookingCache, widgetController.createBooking);

/**
 * @route GET /widget/embed
 * @desc Generar código de embebido para el widget
 * @access Public
 */
router.get("/embed", widgetRateLimit, widgetController.getEmbedCode);

// Middleware de manejo de errores específico para el widget
router.use((error, req, res, next) => {
  console.error("Widget Error:", error);
  
  res.status(500).json({
    success: false,
    error: "Error interno del widget. Por favor, inténtalo de nuevo."
  });
});

module.exports = router;