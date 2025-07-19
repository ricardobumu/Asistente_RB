/**
 * @file Script para configurar webhook de Calendly con Pipedream
 * @description Configura la integración entre Calendly y el sistema usando Pipedream
 */

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const logger = require("../src/utils/logger");
const calendlyClient = require("../src/integrations/calendlyClient");

async function setupPipedreamCalendlyWebhook() {
  console.log("🔧 CONFIGURANDO WEBHOOK DE CALENDLY CON PIPEDREAM");
  console.log("=".repeat(60));

  try {
    // 1. Verificar configuración de Calendly
    console.log("\n1️⃣ VERIFICANDO CONFIGURACIÓN DE CALENDLY...");

    if (!calendlyClient.isInitialized()) {
      console.log("❌ Calendly no está configurado correctamente");
      console.log("\nVerifica estas variables de entorno:");
      console.log("  • CALENDLY_ACCESS_TOKEN");
      console.log("  • CALENDLY_USER_URI");
      console.log("  • CALENDLY_CLIENT_ID");
      console.log("  • CALENDLY_CLIENT_SECRET");
      return false;
    }

    console.log("✅ Calendly configurado correctamente");

    // 2. Mostrar información actual
    console.log("\n2️⃣ INFORMACIÓN ACTUAL DE CONFIGURACIÓN:");
    console.log(`  • User URI: ${process.env.CALENDLY_USER_URI}`);
    console.log(
      `  • Webhook URI (Dev): ${process.env.CALENDLY_WEBHOOK_URI_DEV}`
    );
    console.log(`  • Webhook URI (Prod): ${process.env.CALENDLY_WEBHOOK_URI}`);

    // 3. Configuración recomendada para Pipedream
    console.log("\n3️⃣ CONFIGURACIÓN RECOMENDADA PARA PIPEDREAM:");

    const pipedreamConfig = {
      name: "Calendly to Asistente RB Integration",
      description:
        "Webhook integration between Calendly and Asistente RB via Pipedream",
      events: [
        "invitee.created",
        "invitee.canceled",
        "invitee_no_show.created",
      ],
      endpoint:
        process.env.NODE_ENV === "production"
          ? process.env.CALENDLY_WEBHOOK_URI
          : process.env.CALENDLY_WEBHOOK_URI_DEV,
      signing_key: process.env.CALENDLY_WEBHOOK_SIGNING_KEY,
    };

    console.log("\n📋 CONFIGURACIÓN PARA PIPEDREAM:");
    console.log("```json");
    console.log(JSON.stringify(pipedreamConfig, null, 2));
    console.log("```");

    // 4. Código de ejemplo para Pipedream
    console.log("\n4️⃣ CÓDIGO DE EJEMPLO PARA PIPEDREAM:");

    const pipedreamCode = `
// Pipedream Workflow Code
export default defineComponent({
  name: "calendly-to-asistente-rb",
  version: "0.1.0",
  props: {
    calendly: {
      type: "app",
      app: "calendly",
    },
  },
  async run({ steps, $ }) {
    // 1. Recibir evento de Calendly
    const { event, payload } = steps.trigger.event.body;

    console.log("Calendly event received:", event);

    // 2. Transformar payload si es necesario
    const transformedPayload = {
      event: event,
      payload: {
        ...payload,
        // Agregar campos adicionales si es necesario
        processed_at: new Date().toISOString(),
        source: "pipedream"
      }
    };

    // 3. Enviar a Asistente RB
    const response = await fetch("${pipedreamConfig.endpoint}", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Pipedream-Calendly-Integration/1.0",
        // Agregar headers de autenticación si es necesario
      },
      body: JSON.stringify(transformedPayload)
    });

    // 4. Manejar respuesta
    if (response.ok) {
      const result = await response.json();
      console.log("Successfully processed:", result);
      return result;
    } else {
      const error = await response.text();
      console.error("Error processing webhook:", error);
      throw new Error(\`Webhook processing failed: \${response.status}\`);
    }
  }
});`;

    console.log("```javascript");
    console.log(pipedreamCode);
    console.log("```");

    // 5. Instrucciones paso a paso
    console.log("\n5️⃣ INSTRUCCIONES PASO A PASO:");
    console.log(`
📝 PASOS PARA CONFIGURAR EN PIPEDREAM:

1. **Crear nuevo Workflow en Pipedream:**
   - Ve a https://pipedream.com/workflows
   - Crea un nuevo workflow
   - Selecciona "HTTP / Webhook" como trigger

2. **Configurar Trigger:**
   - Tipo: HTTP POST
   - Generar URL única de Pipedream
   - Copiar la URL generada

3. **Configurar Webhook en Calendly:**
   - Ve a https://calendly.com/integrations/webhooks
   - Crear nuevo webhook
   - URL: [URL de Pipedream generada]
   - Eventos: invitee.created, invitee.canceled, invitee_no_show.created
   - Signing Key: ${process.env.CALENDLY_WEBHOOK_SIGNING_KEY || "[CONFIGURAR]"}

4. **Agregar Step de Procesamiento:**
   - Agregar nuevo step en Pipedream
   - Usar el código JavaScript proporcionado arriba
   - Configurar endpoint destino: ${pipedreamConfig.endpoint}

5. **Probar Integración:**
   - Crear evento de prueba en Calendly
   - Verificar que llegue a Pipedream
   - Verificar que se procese en Asistente RB

6. **Monitorear:**
   - Revisar logs en Pipedream
   - Revisar logs en Asistente RB
   - Configurar alertas si es necesario
`);

    // 6. Verificar endpoint destino
    console.log("\n6️⃣ VERIFICANDO ENDPOINT DESTINO...");

    try {
      const testResponse = await fetch(pipedreamConfig.endpoint + "/health", {
        method: "GET",
        headers: {
          "User-Agent": "Pipedream-Setup-Test/1.0",
        },
      });

      if (testResponse.ok) {
        console.log("✅ Endpoint destino responde correctamente");
      } else {
        console.log(
          `⚠️ Endpoint destino responde con status: ${testResponse.status}`
        );
      }
    } catch (error) {
      console.log(`❌ Error conectando con endpoint destino: ${error.message}`);
    }

    // 7. Configuración de seguridad
    console.log("\n7️⃣ CONFIGURACIÓN DE SEGURIDAD:");
    console.log(`
🔒 RECOMENDACIONES DE SEGURIDAD:

1. **Validación de Firma:**
   - Usar CALENDLY_WEBHOOK_SIGNING_KEY para validar requests
   - Implementar en Pipedream antes de reenviar

2. **Rate Limiting:**
   - Configurar límites en Pipedream
   - Implementar retry logic para fallos temporales

3. **Logging:**
   - Registrar todos los eventos procesados
   - Configurar alertas para errores

4. **Monitoreo:**
   - Configurar health checks
   - Alertas para fallos de integración

5. **Backup:**
   - Configurar webhook secundario si es crítico
   - Implementar queue para procesamiento asíncrono
`);

    console.log("\n" + "=".repeat(60));
    console.log("✅ CONFIGURACIÓN DE PIPEDREAM COMPLETADA");
    console.log("=".repeat(60));

    return true;
  } catch (error) {
    console.error("\n❌ ERROR EN CONFIGURACIÓN:", error);
    return false;
  }
}

// Función para probar webhook existente
async function testExistingWebhook() {
  console.log("🧪 PROBANDO WEBHOOK EXISTENTE");
  console.log("=".repeat(40));

  const testPayload = {
    event: "invitee.created",
    payload: {
      uri: "https://api.calendly.com/scheduled_events/test-pipedream-123",
      name: "Test Pipedream User",
      email: "test@pipedream.com",
      start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
      event_type: {
        name: "Test Event",
        duration: 60,
      },
      questions_and_answers: [
        {
          question: "¿Cuál es tu número de WhatsApp?",
          answer: "+34600999888",
        },
      ],
      source: "pipedream_test",
    },
  };

  const endpoint =
    process.env.NODE_ENV === "production"
      ? process.env.CALENDLY_WEBHOOK_URI
      : process.env.CALENDLY_WEBHOOK_URI_DEV;

  try {
    console.log(`Enviando test a: ${endpoint}`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Pipedream-Test/1.0",
      },
      body: JSON.stringify(testPayload),
    });

    const result = await response.text();

    console.log(`Status: ${response.status}`);
    console.log(`Response: ${result}`);

    return response.ok;
  } catch (error) {
    console.error("Error en test:", error.message);
    return false;
  }
}

// Ejecutar según argumentos
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("--test-webhook")) {
    testExistingWebhook()
      .then((success) => {
        process.exit(success ? 0 : 1);
      })
      .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
      });
  } else {
    setupPipedreamCalendlyWebhook()
      .then((success) => {
        process.exit(success ? 0 : 1);
      })
      .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
      });
  }
}

module.exports = {
  setupPipedreamCalendlyWebhook,
  testExistingWebhook,
};
