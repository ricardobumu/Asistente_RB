/**
 * RUTAS DEL PORTAL CLIENTE
 * Portal público para que los clientes gestionen sus reservas
 *
 * Endpoints:
 * - GET / - Portal principal del cliente
 * - GET /booking - Formulario de reserva
 * - POST /booking - Crear nueva reserva
 * - GET /history - Historial de reservas del cliente
 */

const express = require("express");
const path = require("path");
const rateLimit = require("express-rate-limit");
const clientController = require("../controllers/clientController");
const logger = require("../utils/logger");

const router = express.Router();

// Rate limiting para portal cliente
const clientLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // máximo 200 requests por ventana
  message: {
    error: "Demasiadas solicitudes desde esta IP",
    retryAfter: "15 minutos",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return `client_${req.ip}`;
  },
  skip: (req) => {
    // No aplicar rate limiting a archivos estáticos
    return req.path.includes("/static/");
  },
});

// Rate limiting más estricto para creación de reservas
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // máximo 5 reservas por hora por IP
  message: {
    error: "Demasiadas reservas desde esta IP",
    retryAfter: "1 hora",
  },
});

// Middleware de logging para portal cliente
const clientLogger = (req, res, next) => {
  logger.info("Portal cliente accedido", {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    referer: req.get("Referer"),
  });
  next();
};

// Aplicar rate limiting y logging
router.use(clientLimiter);
router.use(clientLogger);

// ===== RUTAS DE ARCHIVOS ESTÁTICOS =====

/**
 * GET /
 * Portal principal del cliente
 */
router.get("/", (req, res) => {
  try {
    res.sendFile(path.join(__dirname, "../public/client/index.html"));
  } catch (error) {
    logger.error("Error sirviendo portal cliente", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Error cargando portal cliente",
    });
  }
});

/**
 * GET /booking
 * Página de reservas
 */
router.get("/booking", (req, res) => {
  try {
    res.sendFile(path.join(__dirname, "../public/client/booking.html"));
  } catch (error) {
    logger.error("Error sirviendo página de reservas", {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: "Error cargando página de reservas",
    });
  }
});

/**
 * GET /history
 * Página de historial de reservas
 */
router.get("/history", (req, res) => {
  try {
    res.sendFile(path.join(__dirname, "../public/client/history.html"));
  } catch (error) {
    logger.error("Error sirviendo página de historial", {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: "Error cargando página de historial",
    });
  }
});

// ===== API ENDPOINTS =====

/**
 * GET /api/services
 * Lista de servicios disponibles
 */
router.get("/api/services", clientController.getAvailableServices);

/**
 * GET /api/availability
 * Disponibilidad de horarios
 */
router.get("/api/availability", clientController.getAvailability);

/**
 * POST /api/booking
 * Crear nueva reserva
 */
router.post("/api/booking", bookingLimiter, clientController.createBooking);

/**
 * GET /api/booking/:id
 * Obtener detalles de reserva específica
 */
router.get("/api/booking/:id", clientController.getBookingDetails);

/**
 * PUT /api/booking/:id
 * Modificar reserva existente
 */
router.put("/api/booking/:id", clientController.updateBooking);

/**
 * DELETE /api/booking/:id
 * Cancelar reserva
 */
router.delete("/api/booking/:id", clientController.cancelBooking);

/**
 * GET /api/history
 * Historial de reservas del cliente
 */
router.get("/api/history", clientController.getClientHistory);

/**
 * POST /api/contact
 * Formulario de contacto
 */
router.post("/api/contact", clientController.submitContactForm);

/**
 * GET /api/business-info
 * Información del negocio
 */
router.get("/api/business-info", clientController.getBusinessInfo);

/**
 * POST /api/newsletter
 * Suscripción a newsletter
 */
router.post("/api/newsletter", clientController.subscribeNewsletter);

/**
 * GET /api/testimonials
 * Testimonios de clientes
 */
router.get("/api/testimonials", clientController.getTestimonials);

/**
 * POST /api/review
 * Enviar reseña
 */
router.post("/api/review", clientController.submitReview);

// ===== RUTAS DE UTILIDAD =====

/**
 * GET /health
 * Health check del portal cliente
 */
router.get("/health", (req, res) => {
  res.status(200).json({
    service: "Client Portal",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /info
 * Información del portal
 */
router.get("/info", (req, res) => {
  const config = require("../config/environment");
  res.status(200).json({
    portal: "Portal Cliente",
    business: config.BUSINESS_NAME,
    version: config.APP_VERSION,
    contact: {
      phone: config.BUSINESS_PHONE,
      email: config.BUSINESS_EMAIL,
      address: config.BUSINESS_ADDRESS,
    },
    timestamp: new Date().toISOString(),
  });
});

// ===== RUTAS DE INTEGRACIÓN =====

/**
 * GET /calendly
 * Redirección a Calendly
 */
router.get("/calendly", (req, res) => {
  const config = require("../config/environment");

  if (config.CALENDLY_USER_URI) {
    // Extraer el enlace público de Calendly del URI
    const calendlyLink = config.CALENDLY_USER_URI.replace("/users/", "/");
    res.redirect(calendlyLink);
  } else {
    res.status(404).json({
      success: false,
      error: "Enlace de Calendly no configurado",
    });
  }
});

/**
 * GET /whatsapp
 * Enlace directo a WhatsApp
 */
router.get("/whatsapp", (req, res) => {
  const config = require("../config/environment");
  const { message = "Hola, me gustaría información sobre sus servicios." } =
    req.query;

  if (config.BUSINESS_PHONE) {
    const whatsappNumber = config.BUSINESS_PHONE.replace("+", "");
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

    res.redirect(whatsappUrl);
  } else {
    res.status(404).json({
      success: false,
      error: "Número de WhatsApp no configurado",
    });
  }
});

// ===== MANEJO DE ERRORES =====

// Middleware de manejo de errores específico para portal cliente
router.use((error, req, res, next) => {
  logger.error("Error en portal cliente", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  const statusCode = error.status || error.statusCode || 500;
  const errorMessage =
    process.env.NODE_ENV === "production"
      ? "Error interno del servidor"
      : error.message;

  // Si es una solicitud de API, devolver JSON
  if (req.path.startsWith("/api/")) {
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  } else {
    // Si es una página, redirigir a página de error
    res.status(statusCode).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error - ${require("../config/environment").BUSINESS_NAME}</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .error { color: #e74c3c; }
          .back-link { margin-top: 20px; }
          .back-link a { color: #3498db; text-decoration: none; }
        </style>
      </head>
      <body>
        <h1 class="error">Error ${statusCode}</h1>
        <p>${errorMessage}</p>
        <div class="back-link">
          <a href="/client">← Volver al portal</a>
        </div>
      </body>
      </html>
    `);
  }
});

module.exports = router;
