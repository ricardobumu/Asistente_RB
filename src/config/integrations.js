/**
 * CONFIGURACIÓN CENTRALIZADA DE INTEGRACIONES
 *
 * Este módulo centraliza la configuración de todas las integraciones externas
 * (Supabase, Twilio, Calendly, OpenAI) y proporciona métodos consistentes
 */

require("dotenv").config();
require("dotenv").config({ path: ".env.local" });
const logger = require("../utils/logger");
const { ConfigCache } = require("./config-cache");

/**
 * Configuración de Supabase
 */
const SUPABASE_CONFIG = {
  url: process.env.SUPABASE_URL,
  serviceKey:
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  anonKey: process.env.SUPABASE_ANON_KEY,
  get key() {
    return this.serviceKey || this.anonKey;
  },
};

/**
 * Configuración de Twilio
 */
const TWILIO_CONFIG = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  apiKeySid: process.env.TWILIO_API_KEY_SID,
  whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER,
  webhookUrl: process.env.TWILIO_WEBHOOK_URL,
};

/**
 * Configuración de Calendly
 */
const CALENDLY_CONFIG = {
  clientId: process.env.CALENDLY_CLIENT_ID,
  clientSecret: process.env.CALENDLY_CLIENT_SECRET,
  accessToken: process.env.CALENDLY_ACCESS_TOKEN,
  webhookSigningKey: process.env.CALENDLY_WEBHOOK_SIGNING_KEY,
  userUri: process.env.CALENDLY_USER_URI,
  webhookUri:
    process.env.NODE_ENV === "production"
      ? process.env.CALENDLY_WEBHOOK_URI
      : process.env.CALENDLY_WEBHOOK_URI_DEV,
  redirectUri:
    process.env.NODE_ENV === "production"
      ? process.env.CALENDLY_REDIRECT_URI_MI_WEBHOOK
      : process.env.CALENDLY_REDIRECT_URI_MI_WEBHOOK_DEV,
};

/**
 * Configuración de OpenAI
 */
const OPENAI_CONFIG = {
  apiKey: process.env.OPENAI_API_KEY,
  model:
    process.env.OPENAI_MODEL || process.env.AI_RESPONSE_MODEL || "gpt-4-turbo",
  analysisModel: process.env.AI_ANALYSIS_MODEL || "gpt-4-turbo-preview",
  maxTokens: parseInt(
    process.env.OPENAI_MAX_TOKENS || process.env.AI_MAX_TOKENS || "1000"
  ),
  temperature: parseFloat(process.env.AI_TEMPERATURE || "0.1"),
  confidenceThreshold: parseFloat(process.env.AI_CONFIDENCE_THRESHOLD || "0.6"),
};

/**
 * Configuración de Google (para futuras integraciones)
 */
const GOOGLE_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
  calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
  timezone: process.env.GOOGLE_CALENDAR_TIMEZONE || "Europe/Madrid",
  enabled: process.env.GOOGLE_CALENDAR_ENABLED === "true",
};

/**
 * Configuración de Pipedream
 */
const PIPEDREAM_CONFIG = {
  calendlyDispatcherUrl: process.env.PIPEDREAM_CALENDLY_DISPATCHER_URL,
  whatsappInboundHandlerUrl: process.env.PIPEDREAM_WHATSAPP_INBOUND_HANDLER_URL,
};

/**
 * Configuración de seguridad
 */
const SECURITY_CONFIG = {
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  adminUsername: process.env.ADMIN_USERNAME,
  adminPassword: process.env.ADMIN_PASSWORD,
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") || [],
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
  authRateLimitMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || "5"),
  registerRateLimitMax: parseInt(process.env.REGISTER_RATE_LIMIT_MAX || "3"),
};

/**
 * Configuración RGPD
 */
const GDPR_CONFIG = {
  dataRetentionDays: parseInt(process.env.GDPR_DATA_RETENTION_DAYS || "365"),
  cleanupEnabled: process.env.GDPR_CLEANUP_ENABLED === "true",
  notificationEmail: process.env.GDPR_NOTIFICATION_EMAIL,
  dpoEmail: process.env.GDPR_DPO_EMAIL,
  companyName: process.env.GDPR_COMPANY_NAME,
  companyAddress: process.env.GDPR_COMPANY_ADDRESS,
  supervisoryAuthority: process.env.GDPR_SUPERVISORY_AUTHORITY,
};

/**
 * Configuración de la aplicación
 */
const APP_CONFIG = {
  name: process.env.APP_NAME || "Asistente RB",
  version: process.env.APP_VERSION || "1.0.0",
  port: parseInt(process.env.PORT || "3000"),
  nodeEnv: process.env.NODE_ENV || "development",
  get isDevelopment() {
    return this.nodeEnv === "development";
  },
  get isProduction() {
    return this.nodeEnv === "production";
  },
};

/**
 * Validador de configuración optimizado con caché
 */
class ConfigValidator {
  static validate(useCache = true) {
    // Si usamos caché y es válido, devolver resultado cacheado
    if (useCache) {
      const cachedValidation = ConfigCache.isValid();
      if (cachedValidation.valid) {
        return {
          valid: true,
          errors: [],
          warnings: [],
          fromCache: true,
        };
      }
    }

    const errors = [];
    const warnings = [];

    // Validar Supabase (crítico)
    if (!SUPABASE_CONFIG.url) {
      errors.push("SUPABASE_URL es requerida");
    }
    if (!SUPABASE_CONFIG.key) {
      errors.push("SUPABASE_SERVICE_KEY o SUPABASE_ANON_KEY es requerida");
    }

    // Validar Twilio (crítico para WhatsApp)
    if (!TWILIO_CONFIG.accountSid) {
      errors.push("TWILIO_ACCOUNT_SID es requerida");
    }
    if (!TWILIO_CONFIG.authToken) {
      errors.push("TWILIO_AUTH_TOKEN es requerida");
    }
    if (!TWILIO_CONFIG.whatsappNumber) {
      warnings.push("TWILIO_WHATSAPP_NUMBER no configurado");
    }

    // Validar OpenAI (crítico para IA)
    if (!OPENAI_CONFIG.apiKey) {
      errors.push("OPENAI_API_KEY es requerida");
    }

    // Validar Calendly (importante pero no crítico)
    if (!CALENDLY_CONFIG.accessToken) {
      warnings.push("CALENDLY_ACCESS_TOKEN no configurado");
    }

    // Validar seguridad
    if (!SECURITY_CONFIG.jwtSecret) {
      errors.push("JWT_SECRET es requerido");
    }

    // Actualizar caché si la validación es exitosa
    if (errors.length === 0) {
      ConfigCache.markAllServicesAvailable();
    }

    return { valid: errors.length === 0, errors, warnings, fromCache: false };
  }

  static logValidation(useCache = true) {
    const { valid, errors, warnings, fromCache } = this.validate(useCache);

    if (fromCache) {
      logger.info("Configuración validada desde caché");
      console.log("✅ Configuración validada correctamente (desde caché)");
      return { valid: true, errors: [], warnings: [], fromCache: true };
    }

    if (errors.length > 0) {
      logger.error("Errores críticos de configuración", { errors });
      console.error("❌ Errores críticos de configuración:");
      errors.forEach((error) => console.error(`   - ${error}`));
    }

    if (warnings.length > 0) {
      logger.warn("Advertencias de configuración", { warnings });
      console.warn("⚠️  Advertencias de configuración:");
      warnings.forEach((warning) => console.warn(`   - ${warning}`));
    }

    if (errors.length === 0 && warnings.length === 0) {
      logger.info("Configuración validada correctamente");
      console.log("✅ Configuración validada correctamente");
    }

    return { valid: errors.length === 0, errors, warnings, fromCache: false };
  }

  /**
   * Validación rápida solo para arranque
   */
  static quickValidation() {
    const cachedValidation = ConfigCache.isValid();

    if (cachedValidation.valid) {
      console.log("⚡ Configuración válida (verificación rápida)");
      return { valid: true, fromCache: true };
    }

    // Solo verificar variables críticas sin conexiones externas
    const critical = !!(
      SUPABASE_CONFIG.url &&
      SUPABASE_CONFIG.key &&
      TWILIO_CONFIG.accountSid &&
      TWILIO_CONFIG.authToken &&
      OPENAI_CONFIG.apiKey &&
      SECURITY_CONFIG.jwtSecret
    );

    if (critical) {
      console.log("⚡ Configuración crítica válida");
      ConfigCache.markAllServicesAvailable();
    }

    return { valid: critical, fromCache: false };
  }
}

/**
 * Gestor de configuración optimizado con caché
 */
class ConfigManager {
  static getConfig(service) {
    const configs = {
      supabase: SUPABASE_CONFIG,
      twilio: TWILIO_CONFIG,
      calendly: CALENDLY_CONFIG,
      openai: OPENAI_CONFIG,
      google: GOOGLE_CONFIG,
      pipedream: PIPEDREAM_CONFIG,
      security: SECURITY_CONFIG,
      gdpr: GDPR_CONFIG,
      app: APP_CONFIG,
    };

    return configs[service.toLowerCase()] || null;
  }

  static getAllConfigs() {
    return {
      supabase: SUPABASE_CONFIG,
      twilio: TWILIO_CONFIG,
      calendly: CALENDLY_CONFIG,
      openai: OPENAI_CONFIG,
      google: GOOGLE_CONFIG,
      pipedream: PIPEDREAM_CONFIG,
      security: SECURITY_CONFIG,
      gdpr: GDPR_CONFIG,
      app: APP_CONFIG,
    };
  }

  static isServiceConfigured(service, useCache = true) {
    // Verificar desde caché primero
    if (useCache) {
      const cachedStatus = ConfigCache.getServiceStatus(service);
      if (cachedStatus.configured !== undefined) {
        return cachedStatus.configured;
      }
    }

    const config = this.getConfig(service);
    if (!config) return false;

    // Verificar campos críticos por servicio
    let configured = false;
    switch (service.toLowerCase()) {
      case "supabase":
        configured = !!(config.url && config.key);
        break;
      case "twilio":
        configured = !!(config.accountSid && config.authToken);
        break;
      case "calendly":
        configured = !!(config.clientId && config.clientSecret);
        break;
      case "openai":
        configured = !!config.apiKey;
        break;
      case "google":
        configured = !!(config.clientId && config.clientSecret);
        break;
      default:
        configured = true;
    }

    // Actualizar caché
    if (useCache) {
      ConfigCache.updateService(service, {
        configured,
        available: true,
        lastCheck: Date.now(),
      });
    }

    return configured;
  }

  static getServiceStatus(useCache = true) {
    if (useCache) {
      const cachedConfig = ConfigCache.load();
      if (cachedConfig.services) {
        return cachedConfig.services;
      }
    }

    const services = ["supabase", "twilio", "calendly", "openai", "google"];
    const status = {};

    services.forEach((service) => {
      status[service] = {
        configured: this.isServiceConfigured(service, false),
        available: true, // Asumimos disponible para evitar checks lentos
        config: this.getConfig(service),
        lastCheck: Date.now(),
      };
    });

    // Guardar en caché
    if (useCache) {
      const cachedConfig = ConfigCache.load();
      cachedConfig.services = status;
      ConfigCache.save(cachedConfig);
    }

    return status;
  }

  /**
   * Inicialización rápida para arranque
   */
  static quickInit() {
    console.log("⚡ Inicialización rápida de configuración...");

    // Cargar desde caché
    const cachedConfig = ConfigCache.load();

    // Verificar solo variables críticas
    const criticalValid = !!(
      SUPABASE_CONFIG.url &&
      SUPABASE_CONFIG.key &&
      TWILIO_CONFIG.accountSid &&
      TWILIO_CONFIG.authToken &&
      OPENAI_CONFIG.apiKey
    );

    if (criticalValid) {
      console.log("✅ Configuración crítica válida");
      ConfigCache.markAllServicesAvailable();
      return { valid: true, fromCache: true };
    }

    console.log("❌ Configuración crítica inválida");
    return { valid: false, fromCache: false };
  }

  /**
   * Obtiene estadísticas del caché
   */
  static getCacheStats() {
    return ConfigCache.getStats();
  }

  /**
   * Limpia el caché de configuración
   */
  static clearCache() {
    return ConfigCache.clear();
  }
}

// Inicialización rápida al cargar el módulo (sin validaciones lentas)
const validation = ConfigValidator.quickValidation();

module.exports = {
  SUPABASE_CONFIG,
  TWILIO_CONFIG,
  CALENDLY_CONFIG,
  OPENAI_CONFIG,
  GOOGLE_CONFIG,
  PIPEDREAM_CONFIG,
  SECURITY_CONFIG,
  GDPR_CONFIG,
  APP_CONFIG,
  ConfigValidator,
  ConfigManager,
  validation,
};
