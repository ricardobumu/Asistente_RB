// scripts/setupCalendlyWebhook.js
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const axios = require("axios");

class CalendlyWebhookManager {
  constructor() {
    this.accessToken = process.env.CALENDLY_ACCESS_TOKEN;
    this.userUri = process.env.CALENDLY_USER_URI;
    this.webhookUrl = process.env.CALENDLY_WEBHOOK_URI;
    this.baseUrl = "https://api.calendly.com";

    if (!this.accessToken) {
      throw new Error("CALENDLY_ACCESS_TOKEN no encontrado en .env.local");
    }

    if (!this.userUri) {
      throw new Error("CALENDLY_USER_URI no encontrado en .env.local");
    }

    if (!this.webhookUrl) {
      throw new Error("CALENDLY_WEBHOOK_URI no encontrado en .env.local");
    }
  }

  async makeRequest(method, endpoint, data = null) {
    try {
      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(
          `Calendly API Error: ${error.response.status} - ${JSON.stringify(
            error.response.data
          )}`
        );
      }
      throw error;
    }
  }

  async listWebhooks() {
    console.log("📋 LISTANDO WEBHOOKS EXISTENTES...\n");

    try {
      const response = await this.makeRequest("GET", "/webhook_subscriptions");

      if (response.collection && response.collection.length > 0) {
        console.log("🔗 Webhooks configurados:");
        response.collection.forEach((webhook, index) => {
          console.log(`\n${index + 1}. ${webhook.uri}`);
          console.log(`   URL: ${webhook.callback_url}`);
          console.log(`   Estado: ${webhook.state}`);
          console.log(`   Eventos: ${webhook.events.join(", ")}`);
          console.log(
            `   Creado: ${new Date(webhook.created_at).toLocaleString()}`
          );
        });
      } else {
        console.log("📭 No hay webhooks configurados");
      }

      return response.collection || [];
    } catch (error) {
      console.error("❌ Error listando webhooks:", error.message);
      return [];
    }
  }

  async createWebhook() {
    console.log("🔧 CREANDO WEBHOOK DE CALENDLY...\n");

    try {
      // Eventos que queremos escuchar
      const events = ["invitee.created", "invitee.canceled"];

      const webhookData = {
        url: this.webhookUrl,
        events: events,
        organization: this.userUri.replace("/users/", "/organizations/"),
        user: this.userUri,
        scope: "user",
      };

      console.log(`📡 Configurando webhook para: ${this.webhookUrl}`);
      console.log(`👤 Usuario: ${this.userUri}`);
      console.log(`📅 Eventos: ${events.join(", ")}`);

      const response = await this.makeRequest(
        "POST",
        "/webhook_subscriptions",
        webhookData
      );

      console.log("\n✅ ¡Webhook creado exitosamente!");
      console.log(`🆔 ID: ${response.resource.uri}`);
      console.log(`🔗 URL: ${response.resource.callback_url}`);
      console.log(`📅 Eventos: ${response.resource.events.join(", ")}`);
      console.log(`✅ Estado: ${response.resource.state}`);

      return response.resource;
    } catch (error) {
      console.error("❌ Error creando webhook:", error.message);

      if (error.message.includes("already exists")) {
        console.log(
          "\n💡 El webhook ya existe. Listando webhooks existentes..."
        );
        await this.listWebhooks();
      } else if (error.message.includes("401")) {
        console.log("\n💡 SOLUCIÓN:");
        console.log("1. Verifica que CALENDLY_ACCESS_TOKEN esté correcto");
        console.log(
          "2. El token puede haber expirado - genera uno nuevo en Calendly"
        );
      } else if (error.message.includes("403")) {
        console.log("\n💡 SOLUCIÓN:");
        console.log("1. Verifica que tengas permisos para crear webhooks");
        console.log("2. Asegúrate de tener una cuenta Calendly Premium/Pro");
      }

      return null;
    }
  }

  async deleteWebhook(webhookUri) {
    console.log(`🗑️ Eliminando webhook: ${webhookUri}`);

    try {
      await this.makeRequest(
        "DELETE",
        `/webhook_subscriptions/${webhookUri.split("/").pop()}`
      );
      console.log("✅ Webhook eliminado exitosamente");
      return true;
    } catch (error) {
      console.error("❌ Error eliminando webhook:", error.message);
      return false;
    }
  }

  async setupWebhook() {
    console.log("🚀 CONFIGURACIÓN DE WEBHOOK CALENDLY\n");

    try {
      // 1. Listar webhooks existentes
      const existingWebhooks = await this.listWebhooks();

      // 2. Verificar si ya existe un webhook para nuestra URL
      const existingWebhook = existingWebhooks.find(
        (webhook) => webhook.callback_url === this.webhookUrl
      );

      if (existingWebhook) {
        console.log("\n✅ ¡Webhook ya configurado correctamente!");
        console.log(`🔗 URL: ${existingWebhook.callback_url}`);
        console.log(`✅ Estado: ${existingWebhook.state}`);
        return existingWebhook;
      }

      // 3. Si hay webhooks antiguos, preguntar si eliminarlos
      if (existingWebhooks.length > 0) {
        console.log("\n⚠️   Se encontraron webhooks existentes");
        console.log(
          "💡 Recomendación: Eliminar webhooks antiguos antes de crear uno nuevo"
        );

        // Para este script, vamos a crear el nuevo webhook sin eliminar los antiguos
        console.log("📝 Creando nuevo webhook...");
      }

      // 4. Crear nuevo webhook
      const newWebhook = await this.createWebhook();

      if (newWebhook) {
        console.log("\n🎉 ¡CONFIGURACIÓN COMPLETADA!");
        console.log("\n📋 RESUMEN:");
        console.log(`✅ Webhook URL: ${this.webhookUrl}`);
        console.log(
          `✅ Eventos configurados: invitee.created, invitee.canceled`
        );
        console.log(`✅ Estado: Activo`);

        console.log("\n🔄 PRÓXIMOS PASOS:");
        console.log("1. El webhook está configurado y activo");
        console.log("2. Calendly enviará notificaciones a tu aplicación");
        console.log("3. Prueba creando una cita en Calendly");
        console.log("4. Verifica los logs de tu aplicación");
      }

      return newWebhook;
    } catch (error) {
      console.error("❌ Error en configuración:", error.message);
      return null;
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "setup";

  try {
    const manager = new CalendlyWebhookManager();

    switch (command) {
      case "setup":
        await manager.setupWebhook();
        break;
      case "list":
        await manager.listWebhooks();
        break;
      case "create":
        await manager.createWebhook();
        break;
      case "delete":
        const webhookId = args[1];
        if (!webhookId) {
          console.log("❌ Especifica el ID del webhook a eliminar");
          console.log("Uso: npm run calendly:delete <webhook-id>");
          return;
        }
        await manager.deleteWebhook(webhookId);
        break;
      default:
        console.log("Comandos disponibles:");
        console.log("   setup   - Configurar webhook (por defecto)");
        console.log("   list    - Listar webhooks existentes");
        console.log("   create - Crear nuevo webhook");
        console.log("   delete - Eliminar webhook específico");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main();
