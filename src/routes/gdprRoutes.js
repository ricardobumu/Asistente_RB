// src/routes/gdprRoutes.js
// Rutas para gestión de compliance RGPD

const express = require("express");
const router = express.Router();
const gdprController = require("../controllers/gdprController");
const rateLimiter = require("../middleware/rateLimiter");
const logger = require("../utils/logger");
const cors = require("cors");

// CORS específico para RGPD (más permisivo para acceso de usuarios)
const gdprCorsOptions = {
  origin: true,
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

router.use(cors(gdprCorsOptions));

// Rate limiting específico para RGPD
const gdprRateLimit = rateLimiter.createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 requests por IP cada 15 minutos
  message: {
    success: false,
    error: "Demasiadas solicitudes RGPD. Inténtalo de nuevo en 15 minutos.",
  },
});

const strictRateLimit = rateLimiter.createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 requests por IP cada hora para operaciones críticas
  message: {
    success: false,
    error:
      "Límite de solicitudes críticas alcanzado. Inténtalo de nuevo en 1 hora.",
  },
});

/**
 * @route POST /gdpr/consent
 * @desc Registrar consentimiento del usuario
 * @access Public
 */
router.post("/consent", gdprRateLimit, gdprController.recordConsent);

/**
 * @route GET /gdpr/consent/:clientId/:consentType
 * @desc Verificar consentimiento del usuario
 * @access Public
 */
router.get(
  "/consent/:clientId/:consentType",
  gdprRateLimit,
  gdprController.checkConsent
);

/**
 * @route GET /gdpr/export/:clientId
 * @desc Exportar datos del usuario (derecho de portabilidad)
 * @access Public
 * @query format - json, csv, xml
 */
router.get("/export/:clientId", strictRateLimit, gdprController.exportUserData);

/**
 * @route DELETE /gdpr/delete/:clientId
 * @desc Eliminar datos del usuario (derecho al olvido)
 * @access Public
 */
router.delete(
  "/delete/:clientId",
  strictRateLimit,
  gdprController.deleteUserData
);

/**
 * @route GET /gdpr/compliance-report
 * @desc Generar reporte de compliance RGPD
 * @access Admin
 */
router.get(
  "/compliance-report",
  gdprRateLimit,
  gdprController.generateComplianceReport
);

/**
 * @route GET /gdpr/rights-info
 * @desc Obtener información sobre derechos RGPD
 * @access Public
 */
router.get("/rights-info", gdprController.getRightsInfo);

/**
 * @route POST /gdpr/whatsapp-consent
 * @desc Procesar consentimiento desde WhatsApp
 * @access Public
 */
router.post(
  "/whatsapp-consent",
  gdprRateLimit,
  gdprController.processWhatsAppConsent
);

/**
 * @route GET /gdpr/privacy-policy
 * @desc Servir política de privacidad
 * @access Public
 */
router.get("/privacy-policy", (req, res) => {
  const privacyPolicy = {
    lastUpdated: "2024-01-01",
    version: "1.0",
    dataController: {
      name: "Ricardo Buriticá Beauty Consulting",
      email: "info@ricardoburitica.eu",
      phone: "+34 XXX XXX XXX",
      address: "España",
    },
    dataProcessing: {
      purposes: [
        "Prestación de servicios de belleza y estética",
        "Gestión de citas y reservas",
        "Comunicación con clientes",
        "Mejora de servicios",
        "Cumplimiento de obligaciones legales",
      ],
      legalBases: [
        "Consentimiento del interesado",
        "Ejecución de contrato",
        "Interés legítimo",
        "Obligación legal",
      ],
      dataTypes: [
        "Datos de identificación (nombre, teléfono, email)",
        "Datos de contacto",
        "Historial de servicios",
        "Preferencias de comunicación",
        "Datos de navegación (cookies)",
      ],
    },
    dataRetention: {
      clientData: "3 años desde la última interacción",
      bookingData: "7 años (obligación fiscal)",
      conversationData: "1 año",
      marketingData: "2 años o hasta retirada del consentimiento",
    },
    dataSubjectRights: [
      "Derecho de acceso",
      "Derecho de rectificación",
      "Derecho de supresión",
      "Derecho a la limitación del tratamiento",
      "Derecho a la portabilidad",
      "Derecho de oposición",
      "Derechos relacionados con decisiones automatizadas",
    ],
    cookies: {
      essential: "Cookies necesarias para el funcionamiento del sitio",
      analytics: "Cookies para análisis de uso (requiere consentimiento)",
      marketing: "Cookies para marketing (requiere consentimiento)",
    },
    contact: {
      dataProtectionOfficer: "info@ricardoburitica.eu",
      supervisoryAuthority: "Agencia Española de Protección de Datos (AEPD)",
    },
  };

  res.json({
    success: true,
    data: privacyPolicy,
  });
});

/**
 * @route GET /gdpr/cookie-policy
 * @desc Servir política de cookies
 * @access Public
 */
router.get("/cookie-policy", (req, res) => {
  const cookiePolicy = {
    lastUpdated: "2024-01-01",
    version: "1.0",
    cookieTypes: {
      essential: {
        description:
          "Cookies estrictamente necesarias para el funcionamiento del sitio",
        examples: [
          "Sesión de usuario",
          "Preferencias de idioma",
          "Carrito de compras",
        ],
        legalBasis: "Interés legítimo",
        retention: "Sesión o hasta 1 año",
      },
      analytics: {
        description: "Cookies para análisis de uso y mejora del sitio",
        examples: ["Google Analytics", "Métricas de rendimiento"],
        legalBasis: "Consentimiento",
        retention: "Hasta 2 años",
      },
      marketing: {
        description: "Cookies para personalización y marketing",
        examples: ["Publicidad dirigida", "Redes sociales"],
        legalBasis: "Consentimiento",
        retention: "Hasta 2 años",
      },
    },
    thirdPartyServices: [
      {
        name: "Google Analytics",
        purpose: "Análisis de tráfico web",
        privacyPolicy: "https://policies.google.com/privacy",
      },
      {
        name: "Twilio",
        purpose: "Comunicaciones WhatsApp",
        privacyPolicy: "https://www.twilio.com/legal/privacy",
      },
    ],
    userControls: {
      consentManagement: "Panel de gestión de cookies disponible en el sitio",
      browserSettings: "Configuración del navegador para bloquear cookies",
      optOut: "Enlaces de exclusión de servicios de terceros",
    },
  };

  res.json({
    success: true,
    data: cookiePolicy,
  });
});

/**
 * @route POST /gdpr/data-breach-notification
 * @desc Notificar violación de datos (uso interno)
 * @access Admin
 */
router.post("/data-breach-notification", strictRateLimit, async (req, res) => {
  try {
    const {
      incidentType,
      affectedData,
      affectedUsers,
      riskLevel,
      containmentMeasures,
      description,
    } = req.body;

    // Validar parámetros requeridos
    if (!incidentType || !affectedData || !riskLevel) {
      return res.status(400).json({
        success: false,
        error: "incidentType, affectedData y riskLevel son requeridos",
      });
    }

    const breachNotification = {
      id: `breach_${Date.now()}`,
      timestamp: new Date().toISOString(),
      incidentType,
      affectedData,
      affectedUsers: affectedUsers || 0,
      riskLevel, // low, medium, high
      containmentMeasures: containmentMeasures || [],
      description,
      reportedBy: req.user?.id || "system",
      status: "reported",
      requiresAuthorityNotification: riskLevel === "high",
      requiresUserNotification: riskLevel === "high" || riskLevel === "medium",
    };

    // Log del incidente
    logger.error("Data breach notification", breachNotification);

    // En un sistema real, aquí se enviarían notificaciones automáticas
    // a las autoridades de protección de datos si es necesario

    res.json({
      success: true,
      message: "Notificación de violación de datos registrada",
      data: {
        breachId: breachNotification.id,
        timestamp: breachNotification.timestamp,
        requiresAuthorityNotification:
          breachNotification.requiresAuthorityNotification,
        requiresUserNotification: breachNotification.requiresUserNotification,
      },
    });
  } catch (error) {
    logger.error("Error in data breach notification", {
      error: error.message,
      body: req.body,
    });

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

/**
 * @route GET /gdpr/consent-banner
 * @desc Obtener configuración del banner de consentimiento
 * @access Public
 */
router.get("/consent-banner", (req, res) => {
  const bannerConfig = {
    enabled: true,
    position: "bottom",
    theme: "light",
    texts: {
      title: "Gestión de Cookies y Privacidad",
      description:
        "Utilizamos cookies para mejorar tu experiencia. Puedes aceptar todas las cookies o gestionar tus preferencias.",
      acceptAll: "Aceptar todas",
      rejectAll: "Rechazar opcionales",
      customize: "Personalizar",
      save: "Guardar preferencias",
    },
    categories: {
      essential: {
        name: "Cookies esenciales",
        description: "Necesarias para el funcionamiento del sitio",
        required: true,
        enabled: true,
      },
      analytics: {
        name: "Cookies de análisis",
        description: "Nos ayudan a mejorar el sitio web",
        required: false,
        enabled: false,
      },
      marketing: {
        name: "Cookies de marketing",
        description: "Para personalizar contenido y anuncios",
        required: false,
        enabled: false,
      },
    },
    links: {
      privacyPolicy: "/gdpr/privacy-policy",
      cookiePolicy: "/gdpr/cookie-policy",
    },
  };

  res.json({
    success: true,
    data: bannerConfig,
  });
});

// Middleware de manejo de errores específico para RGPD
router.use((error, req, res, next) => {
  logger.error("GDPR route error", {
    error: error.message,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: "Error interno del sistema RGPD",
  });
});

module.exports = router;
