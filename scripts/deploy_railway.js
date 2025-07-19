/**
 * @file Script de despliegue automatizado para Railway
 * @description Automatiza el proceso de despliegue y configuración en Railway
 */

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const { execSync } = require("child_process");
const logger = require("../src/utils/logger");

class RailwayDeployer {
  constructor() {
    this.projectId = process.env.RAILWAY_PROJECT_ID;
    this.accessToken = process.env.RAILWAY_ACCESS_TOKEN;
    this.productionUrl = "https://bot.ricardoburitica.eu";

    if (!this.projectId || !this.accessToken) {
      throw new Error(
        "RAILWAY_PROJECT_ID y RAILWAY_ACCESS_TOKEN son requeridos"
      );
    }
  }

  /**
   * Verificar que Railway CLI esté instalado
   */
  checkRailwayCLI() {
    try {
      execSync("railway --version", { stdio: "pipe" });
      logger.info("✅ Railway CLI está instalado");
      return true;
    } catch (error) {
      logger.error("❌ Railway CLI no está instalado");
      logger.info("Instala Railway CLI: npm install -g @railway/cli");
      return false;
    }
  }

  /**
   * Autenticar con Railway
   */
  authenticateRailway() {
    try {
      logger.info("🔐 Autenticando con Railway...");

      // Usar el token de acceso para autenticar
      process.env.RAILWAY_TOKEN = this.accessToken;

      execSync(`railway login --token ${this.accessToken}`, {
        stdio: "pipe",
        env: { ...process.env, RAILWAY_TOKEN: this.accessToken },
      });

      logger.info("✅ Autenticación con Railway exitosa");
      return true;
    } catch (error) {
      logger.error("❌ Error en autenticación con Railway", {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Configurar variables de entorno en Railway
   */
  async configureEnvironmentVariables() {
    try {
      logger.info("⚙️ Configurando variables de entorno en Railway...");

      const envVars = {
        NODE_ENV: "production",
        PORT: "3000",

        // Supabase
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,

        // Twilio
        TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
        TWILIO_API_KEY_SID: process.env.TWILIO_API_KEY_SID,
        TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER,

        // Calendly
        CALENDLY_CLIENT_ID: process.env.CALENDLY_CLIENT_ID,
        CALENDLY_CLIENT_SECRET: process.env.CALENDLY_CLIENT_SECRET,
        CALENDLY_WEBHOOK_SIGNING_KEY: process.env.CALENDLY_WEBHOOK_SIGNING_KEY,
        CALENDLY_ACCESS_TOKEN: process.env.CALENDLY_ACCESS_TOKEN,
        CALENDLY_USER_URI: process.env.CALENDLY_USER_URI,
        CALENDLY_WEBHOOK_URI: `${this.productionUrl}/api/calendly/webhook`,

        // OpenAI
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        OPENAI_MODEL: process.env.OPENAI_MODEL,
        OPENAI_MAX_TOKENS: process.env.OPENAI_MAX_TOKENS,

        // JWT
        JWT_SECRET: process.env.JWT_SECRET,
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,

        // Admin
        ADMIN_USERNAME: process.env.ADMIN_USERNAME,
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,

        // CORS
        ALLOWED_ORIGINS: `${this.productionUrl},https://ricardoburitica.com`,

        // Rate Limiting
        RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
        RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
        AUTH_RATE_LIMIT_MAX: process.env.AUTH_RATE_LIMIT_MAX,
        REGISTER_RATE_LIMIT_MAX: process.env.REGISTER_RATE_LIMIT_MAX,

        // Google
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI: `${this.productionUrl}/auth/google/callback`,
        GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID,
        GOOGLE_CALENDAR_TIMEZONE: process.env.GOOGLE_CALENDAR_TIMEZONE,
        GOOGLE_CALENDAR_ENABLED: process.env.GOOGLE_CALENDAR_ENABLED,
      };

      // Configurar cada variable de entorno
      for (const [key, value] of Object.entries(envVars)) {
        if (value) {
          try {
            execSync(`railway variables set ${key}="${value}"`, {
              stdio: "pipe",
              env: { ...process.env, RAILWAY_TOKEN: this.accessToken },
            });
            logger.debug(`✅ Variable configurada: ${key}`);
          } catch (error) {
            logger.warn(
              `⚠️ Error configurando variable ${key}:`,
              error.message
            );
          }
        }
      }

      logger.info("✅ Variables de entorno configuradas en Railway");
      return true;
    } catch (error) {
      logger.error("❌ Error configurando variables de entorno", {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Desplegar aplicación
   */
  async deployApplication() {
    try {
      logger.info("🚀 Desplegando aplicación en Railway...");

      // Conectar al proyecto
      execSync(`railway link ${this.projectId}`, {
        stdio: "pipe",
        env: { ...process.env, RAILWAY_TOKEN: this.accessToken },
      });

      // Desplegar
      execSync("railway up", {
        stdio: "inherit",
        env: { ...process.env, RAILWAY_TOKEN: this.accessToken },
      });

      logger.info("✅ Aplicación desplegada exitosamente");
      return true;
    } catch (error) {
      logger.error("❌ Error desplegando aplicación", {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Verificar despliegue
   */
  async verifyDeployment() {
    try {
      logger.info("🔍 Verificando despliegue...");

      const endpoints = [
        `${this.productionUrl}/health`,
        `${this.productionUrl}/`,
        `${this.productionUrl}/webhook/whatsapp`,
        `${this.productionUrl}/api/calendly/webhook`,
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: "GET",
            timeout: 10000,
          });

          if (response.ok) {
            logger.info(`✅ Endpoint funcionando: ${endpoint}`);
          } else {
            logger.warn(
              `⚠️ Endpoint con problemas: ${endpoint} (${response.status})`
            );
          }
        } catch (error) {
          logger.warn(`❌ Endpoint no accesible: ${endpoint}`, {
            error: error.message,
          });
        }
      }

      return true;
    } catch (error) {
      logger.error("❌ Error verificando despliegue", {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Actualizar webhooks para producción
   */
  async updateWebhooksForProduction() {
    try {
      logger.info("🔗 Actualizando webhooks para producción...");

      // Importar el configurador de webhooks
      const WebhookConfigurator = require("./configure_webhooks");

      // Cambiar temporalmente el entorno a producción
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const configurator = new WebhookConfigurator();
      const success = await configurator.configure();

      // Restaurar entorno original
      process.env.NODE_ENV = originalEnv;

      if (success) {
        logger.info("✅ Webhooks actualizados para producción");
      } else {
        logger.warn("⚠️ Algunos webhooks no se pudieron actualizar");
      }

      return success;
    } catch (error) {
      logger.error("❌ Error actualizando webhooks", {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Ejecutar despliegue completo
   */
  async deploy() {
    logger.info("🚀 Iniciando despliegue completo en Railway...");

    try {
      // Verificar CLI
      if (!this.checkRailwayCLI()) {
        return false;
      }

      // Autenticar
      if (!this.authenticateRailway()) {
        return false;
      }

      // Configurar variables de entorno
      await this.configureEnvironmentVariables();

      // Desplegar aplicación
      const deploySuccess = await this.deployApplication();
      if (!deploySuccess) {
        return false;
      }

      // Esperar un momento para que el despliegue se complete
      logger.info("⏳ Esperando que el despliegue se complete...");
      await new Promise((resolve) => setTimeout(resolve, 30000));

      // Verificar despliegue
      await this.verifyDeployment();

      // Actualizar webhooks
      await this.updateWebhooksForProduction();

      logger.info("🎉 Despliegue completo exitoso!");
      logger.info(`🌐 Aplicación disponible en: ${this.productionUrl}`);

      return true;
    } catch (error) {
      logger.error("❌ Error en despliegue completo", {
        error: error.message,
        stack: error.stack,
      });
      return false;
    }
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const deployer = new RailwayDeployer();
  deployer
    .deploy()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      logger.error("Error crítico en despliegue", error);
      process.exit(1);
    });
}

module.exports = RailwayDeployer;
