// src/api/index.js
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const logger = require("../utils/logger");

// Importar rutas
const authRoutes = require("./routes/authRoutes");
const clientRoutes = require("./routes/clientRoutes");
const adaptedServiceRoutes = require("../routes/adaptedServiceRoutes");

// Middleware de seguridad
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * Configuración de seguridad para API
 */

// CORS configurado de forma segura
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
      "http://localhost:3001",
    ];

    // En producción, NO permitir requests sin origin
    if (!origin) {
      if (process.env.NODE_ENV === "production") {
        return callback(new Error("Origin requerido en producción"));
      }
      return callback(null, true); // Solo en desarrollo
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn("CORS: Origin no permitido", { origin, allowedOrigins });
      callback(new Error("No permitido por CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  maxAge: 86400, // Cache preflight por 24 horas
};

// Aplicar middleware de seguridad
router.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

router.use(cors(corsOptions));

/**
 * Rutas de la API
 */

// Ruta de salud específica para API
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "API funcionando correctamente",
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || "1.0.0",
  });
});

// Rutas de autenticación (públicas)
router.use("/auth", authRoutes);

// Rutas de clientes
router.use("/clients", clientRoutes);

// Rutas futuras (placeholder)
router.use("/bookings", (req, res) => {
  res.status(501).json({
    success: false,
    error: "Endpoint de reservas en desarrollo",
  });
});

// Rutas de servicios adaptadas (funcionando con estructura real)
router.use("/services", adaptedServiceRoutes);

router.use("/notifications", (req, res) => {
  res.status(501).json({
    success: false,
    error: "Endpoint de notificaciones en desarrollo",
  });
});

// Middleware para rutas no encontradas en API
router.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint de API no encontrado",
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
