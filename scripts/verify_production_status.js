/**
 * @file Verificador de estado de producción
 * @description Verifica que todos los servicios estén funcionando correctamente en producción
 */

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const logger = require("../src/utils/logger");

class ProductionStatusVerifier {
  constructor() {
    this.productionUrl = "https://bot.ricardoburitica.eu";
    this.ngrokUrl = "https://ricardo-beauty-bot.ngrok.io";
    this.currentUrl =
      process.env.NODE_ENV === "production"
        ? this.productionUrl
        : this.ngrokUrl;
  }

  /**
   * Verificar endpoints principales
   */
  async verifyMainEndpoints() {
    const endpoints = [
      { url: `${this.currentUrl}/health`, name: "Health Check", method: "GET" },
      { url: `${this.currentUrl}/`, name: "Root Endpoint", method: "GET" },
      {
        url: `${this.currentUrl}/admin`,
        name: "Admin Dashboard",
        method: "GET",
      },
      {
        url: `${this.currentUrl}/portal`,
        name: "Client Portal",
        method: "GET",
      },
      {
        url: `${this.currentUrl}/widget/static/booking-widget.html`,
        name: "Booking Widget",
        method: "GET",
      },
    ];

    logger.info("🔍 Verificando endpoints principales...");

    const results = [];
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          method: endpoint.method,
          timeout: 10000,
          headers: {
            "User-Agent": "ProductionStatusVerifier/1.0",
          },
        });

        const status = {
          name: endpoint.name,
          url: endpoint.url,
          status: response.status,
          ok: response.ok,
          responseTime: Date.now(),
        };

        if (response.ok) {
          logger.info(`✅ ${endpoint.name}: OK (${response.status})`);
        } else {
          logger.warn(`⚠️ ${endpoint.name}: ${response.status}`);
        }

        results.push(status);
      } catch (error) {
        logger.error(`❌ ${endpoint.name}: Error`, {
          url: endpoint.url,
          error: error.message,
        });

        results.push({
          name: endpoint.name,
          url: endpoint.url,
          status: 0,
          ok: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Verificar webhooks
   */
  async verifyWebhooks() {
    logger.info("🔗 Verificando configuración de webhooks...");

    const webhooks = [
      {
        name: "WhatsApp Webhook",
        url: `${this.currentUrl}/webhook/whatsapp`,
        service: "Twilio",
      },
      {
        name: "WhatsApp Status",
        url: `${this.currentUrl}/autonomous/whatsapp/status`,
        service: "Twilio",
      },
      {
        name: "Calendly Webhook",
        url: `${this.currentUrl}/api/calendly/webhook`,
        service: "Calendly",
      },
    ];

    const results = [];
    for (const webhook of webhooks) {
      try {
        // Para webhooks, solo verificamos que el endpoint responda
        const response = await fetch(webhook.url, {
          method: "GET",
          timeout: 5000,
          headers: {
            "User-Agent": "ProductionStatusVerifier/1.0",
          },
        });

        const accessible = response.status !== 404;

        if (accessible) {
          logger.info(`✅ ${webhook.name}: Accesible`);
        } else {
          logger.warn(`⚠️ ${webhook.name}: No encontrado`);
        }

        results.push({
          name: webhook.name,
          url: webhook.url,
          service: webhook.service,
          accessible,
          status: response.status,
        });
      } catch (error) {
        logger.error(`❌ ${webhook.name}: Error`, {
          error: error.message,
        });

        results.push({
          name: webhook.name,
          url: webhook.url,
          service: webhook.service,
          accessible: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Verificar base de datos
   */
  async verifyDatabase() {
    logger.info("🗄️ Verificando conexión a base de datos...");

    try {
      const supabase = require("../src/integrations/supabaseClient");

      // Hacer una consulta simple para verificar conectividad
      const { data, error } = await supabase
        .from("services")
        .select("count")
        .limit(1);

      if (error) {
        logger.error("❌ Error conectando a Supabase", {
          error: error.message,
        });
        return { connected: false, error: error.message };
      }

      logger.info("✅ Conexión a Supabase: OK");
      return { connected: true };
    } catch (error) {
      logger.error("❌ Error crítico con base de datos", {
        error: error.message,
      });
      return { connected: false, error: error.message };
    }
  }

  /**
   * Verificar servicios externos
   */
  async verifyExternalServices() {
    logger.info("🌐 Verificando servicios externos...");

    const services = [
      {
        name: "Twilio",
        check: async () => {
          const twilio = require("twilio");
          const client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
          );

          try {
            await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
            return { connected: true };
          } catch (error) {
            return { connected: false, error: error.message };
          }
        },
      },
      {
        name: "OpenAI",
        check: async () => {
          try {
            const openai = require("../src/integrations/openaiClient");
            // Hacer una llamada simple para verificar la API key
            const response = await openai.chat.completions.create({
              model: "gpt-3.5-turbo",
              messages: [{ role: "user", content: "test" }],
              max_tokens: 1,
            });
            return { connected: true };
          } catch (error) {
            return { connected: false, error: error.message };
          }
        },
      },
    ];

    const results = [];
    for (const service of services) {
      try {
        const result = await service.check();

        if (result.connected) {
          logger.info(`✅ ${service.name}: Conectado`);
        } else {
          logger.error(`❌ ${service.name}: Error`, {
            error: result.error,
          });
        }

        results.push({
          name: service.name,
          ...result,
        });
      } catch (error) {
        logger.error(`❌ ${service.name}: Error crítico`, {
          error: error.message,
        });

        results.push({
          name: service.name,
          connected: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Generar reporte completo
   */
  async generateReport() {
    logger.info("📊 Generando reporte de estado de producción...");

    const report = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      baseUrl: this.currentUrl,
      endpoints: await this.verifyMainEndpoints(),
      webhooks: await this.verifyWebhooks(),
      database: await this.verifyDatabase(),
      externalServices: await this.verifyExternalServices(),
    };

    // Calcular estadísticas
    const endpointsOk = report.endpoints.filter((e) => e.ok).length;
    const webhooksOk = report.webhooks.filter((w) => w.accessible).length;
    const servicesOk = report.externalServices.filter(
      (s) => s.connected
    ).length;

    const summary = {
      endpoints: `${endpointsOk}/${report.endpoints.length}`,
      webhooks: `${webhooksOk}/${report.webhooks.length}`,
      database: report.database.connected ? "OK" : "ERROR",
      externalServices: `${servicesOk}/${report.externalServices.length}`,
      overallHealth:
        endpointsOk === report.endpoints.length &&
        webhooksOk === report.webhooks.length &&
        report.database.connected &&
        servicesOk === report.externalServices.length
          ? "HEALTHY"
          : "ISSUES_DETECTED",
    };

    logger.info("📋 Resumen del estado del sistema", summary);

    if (summary.overallHealth === "HEALTHY") {
      logger.info("🎉 Sistema completamente operativo");
    } else {
      logger.warn("⚠️ Se detectaron problemas en el sistema");
    }

    return { ...report, summary };
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const verifier = new ProductionStatusVerifier();
  verifier
    .generateReport()
    .then((report) => {
      console.log("\n" + "=".repeat(50));
      console.log("REPORTE DE ESTADO DE PRODUCCIÓN");
      console.log("=".repeat(50));
      console.log(JSON.stringify(report, null, 2));

      process.exit(report.summary.overallHealth === "HEALTHY" ? 0 : 1);
    })
    .catch((error) => {
      logger.error("Error generando reporte", error);
      process.exit(1);
    });
}

module.exports = ProductionStatusVerifier;
