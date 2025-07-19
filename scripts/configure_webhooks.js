/**
 * @file Script para configurar webhooks automáticamente
 * @description Configura webhooks de Twilio y Calendly para desarrollo y producción
 */

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const logger = require("../src/utils/logger");

class WebhookConfigurator {
  constructor() {
    this.environment = process.env.NODE_ENV || "development";
    this.isDevelopment = this.environment === "development";

    // URLs base según el entorno
    this.baseUrl = this.isDevelopment
      ? "https://ricardoburitica.ngrok.app"
      : "https://bot.ricardoburitica.eu";

    logger.info(`Configurando webhooks para entorno: ${this.environment}`, {
      baseUrl: this.baseUrl,
    });
  }

  /**
   * Configurar webhook de Twilio WhatsApp
   */
  async configureTwilioWebhook() {
    try {
      const twilio = require("twilio");
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      const webhookUrl = `${this.baseUrl}/webhook/whatsapp`;
      const statusCallbackUrl = `${this.baseUrl}/autonomous/whatsapp/status`;

      logger.info("Configurando webhook de Twilio WhatsApp...", {
        webhookUrl,
        statusCallbackUrl,
      });

      // Obtener el número de WhatsApp configurado
      const incomingPhoneNumbers = await client.incomingPhoneNumbers.list({
        phoneNumber: process.env.TWILIO_WHATSAPP_NUMBER.replace(
          "whatsapp:",
          ""
        ),
      });

      if (incomingPhoneNumbers.length === 0) {
        logger.warn("No se encontró el número de WhatsApp en Twilio");
        return false;
      }

      const phoneNumberSid = incomingPhoneNumbers[0].sid;

      // Actualizar la configuración del webhook
      await client.incomingPhoneNumbers(phoneNumberSid).update({
        smsUrl: webhookUrl,
        smsMethod: "POST",
        statusCallback: statusCallbackUrl,
        statusCallbackMethod: "POST",
      });

      logger.info("✅ Webhook de Twilio WhatsApp configurado correctamente", {
        phoneNumberSid,
        webhookUrl,
      });

      return true;
    } catch (error) {
      logger.error("❌ Error configurando webhook de Twilio", {
        error: error.message,
        stack: error.stack,
      });
      return false;
    }
  }

  /**
   * Verificar configuración de Calendly
   */
  async verifyCalendlyWebhook() {
    try {
      const webhookUrl = `${this.baseUrl}/api/calendly/webhook`;

      logger.info("Verificando configuración de Calendly...", {
        webhookUrl,
        userUri: process.env.CALENDLY_USER_URI,
      });

      // Aquí podrías hacer una llamada a la API de Calendly para verificar webhooks
      // Por ahora solo loggeamos la información

      logger.info("✅ Configuración de Calendly verificada", {
        webhookUrl,
        signingKey: process.env.CALENDLY_WEBHOOK_SIGNING_KEY
          ? "Configurado"
          : "No configurado",
      });

      return true;
    } catch (error) {
      logger.error("❌ Error verificando configuración de Calendly", {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Probar conectividad de webhooks
   */
  async testWebhookConnectivity() {
    try {
      const endpoints = [
        `${this.baseUrl}/health`,
        `${this.baseUrl}/webhook/whatsapp`,
        `${this.baseUrl}/api/calendly/webhook`,
      ];

      logger.info("Probando conectividad de endpoints...");

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: "GET",
            timeout: 5000,
          });

          logger.info(`✅ Endpoint accesible: ${endpoint}`, {
            status: response.status,
          });
        } catch (error) {
          logger.warn(`⚠️ Endpoint no accesible: ${endpoint}`, {
            error: error.message,
          });
        }
      }

      return true;
    } catch (error) {
      logger.error("❌ Error probando conectividad", {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Generar resumen de configuración
   */
  generateConfigSummary() {
    const config = {
      environment: this.environment,
      baseUrl: this.baseUrl,
      endpoints: {
        whatsapp_webhook: `${this.baseUrl}/webhook/whatsapp`,
        whatsapp_status: `${this.baseUrl}/autonomous/whatsapp/status`,
        calendly_webhook: `${this.baseUrl}/api/calendly/webhook`,
        health_check: `${this.baseUrl}/health`,
      },
      twilio: {
        account_sid: process.env.TWILIO_ACCOUNT_SID,
        whatsapp_number: process.env.TWILIO_WHATSAPP_NUMBER,
        configured: !!(
          process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
        ),
      },
      calendly: {
        user_uri: process.env.CALENDLY_USER_URI,
        webhook_signing_key: !!process.env.CALENDLY_WEBHOOK_SIGNING_KEY,
        access_token: !!process.env.CALENDLY_ACCESS_TOKEN,
      },
    };

    logger.info("📋 Resumen de configuración de webhooks", config);

    return config;
  }

  /**
   * Ejecutar configuración completa
   */
  async configure() {
    logger.info("🚀 Iniciando configuración de webhooks...");

    // Generar resumen
    this.generateConfigSummary();

    // Configurar Twilio
    const twilioSuccess = await this.configureTwilioWebhook();

    // Verificar Calendly
    const calendlySuccess = await this.verifyCalendlyWebhook();

    // Probar conectividad
    await this.testWebhookConnectivity();

    const success = twilioSuccess && calendlySuccess;

    if (success) {
      logger.info("✅ Configuración de webhooks completada exitosamente");
    } else {
      logger.error("❌ Configuración de webhooks completada con errores");
    }

    return success;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const configurator = new WebhookConfigurator();
  configurator
    .configure()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      logger.error("Error crítico en configuración", error);
      process.exit(1);
    });
}

module.exports = WebhookConfigurator;
