// scripts/testWebhookUrls.js
const axios = require("axios");

const BASE_URL = "https://bot.ricardoburitica.eu";

const webhookUrls = {
  "Twilio WhatsApp Webhook": `${BASE_URL}/autonomous/whatsapp/webhook`,
  "Twilio WhatsApp Status": `${BASE_URL}/autonomous/whatsapp/status`,
  "Calendly Webhook": `${BASE_URL}/api/calendly/webhook`,
  "Health Check": `${BASE_URL}/health`,
  "Admin Health": `${BASE_URL}/admin/health`,
};

async function testWebhookUrls() {
  console.log("🔗 PROBANDO URLS DE WEBHOOKS\n");

  for (const [name, url] of Object.entries(webhookUrls)) {
    try {
      console.log(`🧪 Probando: ${name}`);
      console.log(`   URL: ${url}`);

      // Probar GET request
      const response = await axios.get(url, {
        timeout: 10000,
        validateStatus: function (status) {
          // Aceptar códigos 200, 405 (Method Not Allowed), 404
          return status < 500;
        },
      });

      if (response.status === 200) {
        console.log(`   ✅ GET: ${response.status} - OK`);
      } else if (response.status === 405) {
        console.log(
          `   ✅ GET: ${response.status} - Method Not Allowed (normal para webhooks POST)`
        );
      } else if (response.status === 404) {
        console.log(`   ❌ GET: ${response.status} - Not Found`);
      } else {
        console.log(`   ⚠️  GET: ${response.status} - ${response.statusText}`);
      }

      // Para webhooks, también probar POST
      if (name.includes("Webhook")) {
        try {
          const postResponse = await axios.post(
            url,
            {
              test: true,
            },
            {
              timeout: 10000,
              validateStatus: function (status) {
                return status < 500;
              },
            }
          );

          if (postResponse.status === 200) {
            console.log(`   ✅ POST: ${postResponse.status} - OK`);
          } else if (postResponse.status === 400) {
            console.log(
              `   ✅ POST: ${postResponse.status} - Bad Request (normal sin datos válidos)`
            );
          } else {
            console.log(
              `   ⚠️  POST: ${postResponse.status} - ${postResponse.statusText}`
            );
          }
        } catch (postError) {
          if (postError.response) {
            console.log(
              `   ⚠️  POST: ${postError.response.status} - ${postError.response.statusText}`
            );
          } else {
            console.log(`   ❌ POST: Error de conexión`);
          }
        }
      }
    } catch (error) {
      if (error.response) {
        console.log(
          `   ❌ ${error.response.status} - ${error.response.statusText}`
        );
      } else if (error.code === "ECONNREFUSED") {
        console.log(`   ❌ Conexión rechazada - Servidor no está ejecutándose`);
      } else if (error.code === "ENOTFOUND") {
        console.log(`   ❌ Dominio no encontrado`);
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    console.log("");
  }

  console.log("📋 URLS PARA CONFIGURAR EN TWILIO:");
  console.log("");
  console.log("🔗 Webhook URL (para recibir mensajes):");
  console.log(`   ${BASE_URL}/autonomous/whatsapp/webhook`);
  console.log("");
  console.log("🔗 Status Callback URL (para estados de mensajes):");
  console.log(`   ${BASE_URL}/autonomous/whatsapp/status`);
  console.log("");
  console.log("📋 URLS PARA CONFIGURAR EN CALENDLY:");
  console.log("");
  console.log("🔗 Webhook URL:");
  console.log(`   ${BASE_URL}/api/calendly/webhook`);
  console.log("");
  console.log("💡 NOTAS:");
  console.log("- Las URLs deben responder con código 200 o 405");
  console.log("- Twilio valida que la URL esté accesible antes de guardarla");
  console.log(
    "- Si obtienes error 404, verifica que el servidor esté ejecutándose"
  );
  console.log("- Si obtienes error de conexión, verifica el dominio y SSL");
}

// Ejecutar pruebas
testWebhookUrls().catch(console.error);
