// src/config/env.js
const logger = require("../utils/logger");

// Validar variables de entorno críticas
const validateEnvVars = () => {
  const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY"];

  const missing = required.filter((key) => !process.env[key]);
  const warnings = [];

  // Validaciones de seguridad para producción
  if (process.env.NODE_ENV === "production") {
    const productionRequired = [
      "SUPABASE_SERVICE_ROLE_KEY",
      "JWT_SECRET",
      "JWT_REFRESH_SECRET",
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN",
      "OPENAI_API_KEY",
      "CALENDLY_ACCESS_TOKEN",
    ];

    const missingProd = productionRequired.filter((key) => !process.env[key]);
    if (missingProd.length > 0) {
      missing.push(...missingProd);
    }

    // Validar que los secretos JWT sean lo suficientemente fuertes en producción
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 64) {
      warnings.push(
        "JWT_SECRET debe tener al menos 64 caracteres en producción"
      );
    }

    if (
      process.env.JWT_REFRESH_SECRET &&
      process.env.JWT_REFRESH_SECRET.length < 64
    ) {
      warnings.push(
        "JWT_REFRESH_SECRET debe tener al menos 64 caracteres en producción"
      );
    }

    // Validar que no se usen secretos por defecto
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.includes("default")) {
      warnings.push(
        "JWT_SECRET no debe contener valores por defecto en producción"
      );
    }
  }

  if (missing.length > 0) {
    const errorMsg = `Variables de entorno requeridas faltantes: ${missing.join(", ")}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  if (warnings.length > 0) {
    warnings.forEach((warning) => logger.warn(warning));
  }

  logger.info("Variables de entorno validadas correctamente", {
    environment: process.env.NODE_ENV || "development",
    requiredCount: required.length,
    warningsCount: warnings.length,
  });
};

// Ejecutar validación
validateEnvVars();

const env = {
  // Configuración del servidor
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT) || 3000,

  // Base de datos (requeridas)
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,

  // Seguridad JWT (requeridas)
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,

  // Servicios externos (opcionales)
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER,
  CALENDLY_ACCESS_TOKEN: process.env.CALENDLY_ACCESS_TOKEN,
  CALENDLY_CLIENT_ID: process.env.CALENDLY_CLIENT_ID,
  CALENDLY_CLIENT_SECRET: process.env.CALENDLY_CLIENT_SECRET,
  CALENDLY_USER_URI: process.env.CALENDLY_USER_URI,
  CALENDLY_WEBHOOK_URI: process.env.CALENDLY_WEBHOOK_URI,
  // Google Calendar OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,

  // Google Calendar Service Account (fallback)
  GOOGLE_CALENDAR_CREDENTIALS: process.env.GOOGLE_CALENDAR_CREDENTIALS,
  GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID || "primary",
  GOOGLE_CALENDAR_TIMEZONE:
    process.env.GOOGLE_CALENDAR_TIMEZONE || "Europe/Madrid",
  GOOGLE_CALENDAR_ENABLED: process.env.GOOGLE_CALENDAR_ENABLED === "true",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4-turbo-preview",
  OPENAI_MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS) || 1000,

  // Dashboard administrativo
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || "admin",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "admin123",

  // CORS y seguridad
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "http://localhost:3000",

  // Configuración de la aplicación
  APP_NAME: process.env.APP_NAME || "Asistente RB",
  APP_VERSION: process.env.APP_VERSION || "1.0.0",

  // Configuración RGPD
  GDPR_DATA_RETENTION_DAYS:
    parseInt(process.env.GDPR_DATA_RETENTION_DAYS) || 365,
  GDPR_CLEANUP_ENABLED: process.env.GDPR_CLEANUP_ENABLED === "true",
  GDPR_NOTIFICATION_EMAIL:
    process.env.GDPR_NOTIFICATION_EMAIL || "info@ricardoburitica.eu",
  GDPR_DPO_EMAIL: process.env.GDPR_DPO_EMAIL || "info@ricardoburitica.eu",
  GDPR_COMPANY_NAME:
    process.env.GDPR_COMPANY_NAME || "Ricardo Buriticá Beauty Consulting",
  GDPR_COMPANY_ADDRESS: process.env.GDPR_COMPANY_ADDRESS || "España",
  GDPR_SUPERVISORY_AUTHORITY:
    process.env.GDPR_SUPERVISORY_AUTHORITY ||
    "Agencia Española de Protección de Datos (AEPD)",

  // Configuración de IA
  AI_ANALYSIS_MODEL: process.env.AI_ANALYSIS_MODEL || "gpt-4-turbo-preview",
  AI_RESPONSE_MODEL: process.env.AI_RESPONSE_MODEL || "gpt-3.5-turbo",
  AI_MAX_TOKENS: parseInt(process.env.AI_MAX_TOKENS) || 800,
  AI_TEMPERATURE: parseFloat(process.env.AI_TEMPERATURE) || 0.1,
  AI_CONFIDENCE_THRESHOLD:
    parseFloat(process.env.AI_CONFIDENCE_THRESHOLD) || 0.6,

  // Pipedream Workflows
  PIPEDREAM_CALENDLY_DISPATCHER_URL:
    process.env.PIPEDREAM_CALENDLY_DISPATCHER_URL,
  PIPEDREAM_WHATSAPP_INBOUND_HANDLER_URL:
    process.env.PIPEDREAM_WHATSAPP_INBOUND_HANDLER_URL,

  // Helpers
  isDevelopment: () => env.NODE_ENV === "development",
  isProduction: () => env.NODE_ENV === "production",
};

// Log de configuración (sin datos sensibles)
logger.info("Configuración cargada", {
  NODE_ENV: env.NODE_ENV,
  PORT: env.PORT,
  APP_NAME: env.APP_NAME,
  hasSupabaseConfig: !!(
    env.SUPABASE_URL &&
    env.SUPABASE_ANON_KEY &&
    env.SUPABASE_SERVICE_KEY
  ),
  hasTwilioConfig: !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN),
  hasCalendlyConfig: !!(env.CALENDLY_ACCESS_TOKEN && env.CALENDLY_USER_URI),
  hasGoogleCalendarConfig: !!(
    (env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.GOOGLE_REDIRECT_URI) ||
    (env.GOOGLE_CALENDAR_CREDENTIALS && env.GOOGLE_CALENDAR_ID)
  ),
  hasOpenAIConfig: !!env.OPENAI_API_KEY,
  hasJWTConfig: !!(env.JWT_SECRET && env.JWT_REFRESH_SECRET),
  hasAdminConfig: !!(env.ADMIN_USERNAME && env.ADMIN_PASSWORD),
  hasGDPRConfig: !!(env.GDPR_NOTIFICATION_EMAIL && env.GDPR_COMPANY_NAME),
  gdprCleanupEnabled: env.GDPR_CLEANUP_ENABLED,
  aiModels: {
    analysis: env.AI_ANALYSIS_MODEL,
    response: env.AI_RESPONSE_MODEL,
  },
});

module.exports = env;
