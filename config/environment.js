/**
 * CONFIGURACIÓN DE ENTORNO
 * Gestión centralizada y segura de variables de entorno
 *
 * IMPORTANTE: Todas las claves sensibles deben estar en .env.local
 * Nunca hardcodear secretos en el código
 */

const path = require("path");

// Validar que las variables críticas estén definidas
const requiredEnvVars = ["SUPABASE_URL", "SUPABASE_ANON_KEY"];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error("❌ Variables de entorno requeridas faltantes:", missingVars);
  console.error("📝 Asegúrate de configurar tu archivo .env.local");
  process.exit(1);
}

// Configuración del entorno
const config = {
  // ===== CONFIGURACIÓN DEL SERVIDOR =====
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT) || 3000,
  HOST: process.env.HOST || "0.0.0.0",

  // ===== INFORMACIÓN DE LA APLICACIÓN =====
  APP_NAME: process.env.APP_NAME || "Asistente RB",
  APP_VERSION: process.env.APP_VERSION || "2.0.0",

  // ===== BASE DE DATOS SUPABASE (REQUERIDO) =====
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // ===== TWILIO WHATSAPP (REQUERIDO PARA MENSAJERÍA) =====
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER || "+14155238886",

  // ===== OPENAI (REQUERIDO PARA IA) =====
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4",
  OPENAI_MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS) || 1000,
  OPENAI_TEMPERATURE: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,

  // ===== CALENDLY (REQUERIDO PARA WEBHOOKS) =====
  CALENDLY_ACCESS_TOKEN: process.env.CALENDLY_ACCESS_TOKEN,
  CALENDLY_USER_URI: process.env.CALENDLY_USER_URI,
  CALENDLY_WEBHOOK_URI: process.env.CALENDLY_WEBHOOK_URI,
  CALENDLY_SIGNING_KEY: process.env.CALENDLY_SIGNING_KEY,

  // ===== GOOGLE CALENDAR (OPCIONAL) =====
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID || "primary",
  GOOGLE_CALENDAR_TIMEZONE:
    process.env.GOOGLE_CALENDAR_TIMEZONE || "Europe/Madrid",

  // ===== SEGURIDAD =====
  JWT_SECRET:
    process.env.JWT_SECRET || "default-jwt-secret-change-in-production",
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET ||
    "default-refresh-secret-change-in-production",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "24h",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",

  // ===== CORS =====
  ALLOWED_ORIGINS:
    process.env.ALLOWED_ORIGINS ||
    "http://localhost:3000,http://localhost:3001",

  // ===== CONFIGURACIÓN DE LOGS =====
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  LOG_FILE: process.env.LOG_FILE || "logs/app.log",
  LOG_ERROR_FILE: process.env.LOG_ERROR_FILE || "logs/error.log",

  // ===== CONFIGURACIÓN DE RATE LIMITING =====
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutos
  RATE_LIMIT_MAX_REQUESTS:
    parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
  WEBHOOK_RATE_LIMIT_MAX: parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX) || 100,

  // ===== CONFIGURACIÓN DE CONTEXTO CONVERSACIONAL =====
  CONTEXT_RETENTION_HOURS: parseInt(process.env.CONTEXT_RETENTION_HOURS) || 24,
  MAX_CONTEXT_MESSAGES: parseInt(process.env.MAX_CONTEXT_MESSAGES) || 50,

  // ===== CONFIGURACIÓN DE NOTIFICACIONES =====
  NOTIFICATION_RETRY_ATTEMPTS:
    parseInt(process.env.NOTIFICATION_RETRY_ATTEMPTS) || 3,
  NOTIFICATION_RETRY_DELAY:
    parseInt(process.env.NOTIFICATION_RETRY_DELAY) || 5000,

  // ===== CONFIGURACIÓN DE ARCHIVOS =====
  UPLOAD_MAX_SIZE: parseInt(process.env.UPLOAD_MAX_SIZE) || 10485760, // 10MB
  UPLOAD_ALLOWED_TYPES:
    process.env.UPLOAD_ALLOWED_TYPES ||
    "image/jpeg,image/png,image/gif,application/pdf",

  // ===== CONFIGURACIÓN DE CACHE =====
  CACHE_TTL: parseInt(process.env.CACHE_TTL) || 3600, // 1 hora
  CACHE_MAX_KEYS: parseInt(process.env.CACHE_MAX_KEYS) || 1000,

  // ===== CONFIGURACIÓN DE WEBHOOK VALIDATION =====
  VALIDATE_TWILIO_SIGNATURE: process.env.VALIDATE_TWILIO_SIGNATURE === "true",
  VALIDATE_CALENDLY_SIGNATURE:
    process.env.VALIDATE_CALENDLY_SIGNATURE === "true",

  // ===== CONFIGURACIÓN DE DEPLOYMENT =====
  RAILWAY_PROJECT_ID: process.env.RAILWAY_PROJECT_ID,
  RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
  PUBLIC_URL: process.env.PUBLIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN,

  // ===== CONFIGURACIÓN DE TIMEZONE =====
  DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE || "Europe/Madrid",
  DEFAULT_LOCALE: process.env.DEFAULT_LOCALE || "es-ES",

  // ===== CONFIGURACIÓN DE BUSINESS =====
  BUSINESS_NAME: process.env.BUSINESS_NAME || "Asistente RB",
  BUSINESS_PHONE: process.env.BUSINESS_PHONE || "+34600000000",
  BUSINESS_EMAIL: process.env.BUSINESS_EMAIL || "info@ricardoburitica.eu",
  BUSINESS_ADDRESS: process.env.BUSINESS_ADDRESS || "Madrid, España",

  // ===== CONFIGURACIÓN DE GDPR =====
  GDPR_RETENTION_DAYS: parseInt(process.env.GDPR_RETENTION_DAYS) || 365,
  GDPR_CLEANUP_ENABLED: process.env.GDPR_CLEANUP_ENABLED === "true",
  GDPR_CONTACT_EMAIL:
    process.env.GDPR_CONTACT_EMAIL || "privacy@ricardoburitica.eu",
};

// Validaciones adicionales para producción
if (config.NODE_ENV === "production") {
  const productionRequiredVars = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "OPENAI_API_KEY",
    "CALENDLY_ACCESS_TOKEN",
  ];

  const missingProdVars = productionRequiredVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingProdVars.length > 0) {
    console.error(
      "❌ Variables requeridas para producción faltantes:",
      missingProdVars
    );
    process.exit(1);
  }

  // Validar que los secretos JWT no sean los por defecto
  if (
    config.JWT_SECRET.includes("default") ||
    config.JWT_REFRESH_SECRET.includes("default")
  ) {
    console.error("❌ Los secretos JWT deben cambiarse en producción");
    process.exit(1);
  }
}

// Función para obtener la URL pública del webhook
config.getWebhookUrl = (endpoint) => {
  const baseUrl = config.PUBLIC_URL || `http://localhost:${config.PORT}`;
  return `${baseUrl}${endpoint}`;
};

// Función para validar configuración
config.validate = () => {
  const errors = [];

  // Validar URL de Supabase
  if (!config.SUPABASE_URL.startsWith("https://")) {
    errors.push("SUPABASE_URL debe ser una URL HTTPS válida");
  }

  // Validar configuración de Twilio si está presente
  if (
    config.TWILIO_ACCOUNT_SID &&
    !config.TWILIO_ACCOUNT_SID.startsWith("AC")
  ) {
    errors.push('TWILIO_ACCOUNT_SID debe comenzar con "AC"');
  }

  // Validar configuración de OpenAI si está presente
  if (config.OPENAI_API_KEY && !config.OPENAI_API_KEY.startsWith("sk-")) {
    errors.push('OPENAI_API_KEY debe comenzar con "sk-"');
  }

  // Validar puerto
  if (config.PORT < 1 || config.PORT > 65535) {
    errors.push("PORT debe estar entre 1 y 65535");
  }

  if (errors.length > 0) {
    console.error("❌ Errores de configuración:", errors);
    return false;
  }

  return true;
};

// Función para mostrar resumen de configuración (sin secretos)
config.getSummary = () => {
  return {
    app: {
      name: config.APP_NAME,
      version: config.APP_VERSION,
      environment: config.NODE_ENV,
      port: config.PORT,
    },
    services: {
      supabase: !!config.SUPABASE_URL,
      twilio: !!config.TWILIO_ACCOUNT_SID,
      openai: !!config.OPENAI_API_KEY,
      calendly: !!config.CALENDLY_ACCESS_TOKEN,
      google: !!config.GOOGLE_CLIENT_ID,
    },
    features: {
      webhookValidation: {
        twilio: config.VALIDATE_TWILIO_SIGNATURE,
        calendly: config.VALIDATE_CALENDLY_SIGNATURE,
      },
      gdpr: config.GDPR_CLEANUP_ENABLED,
      contextRetention: `${config.CONTEXT_RETENTION_HOURS}h`,
    },
  };
};

module.exports = config;
