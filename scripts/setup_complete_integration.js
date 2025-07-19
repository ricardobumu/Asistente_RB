/**
 * @file Script de configuración completa para integración Calendly-Twilio-OpenAI
 * @description Configura y verifica toda la integración paso a paso
 */

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const logger = require("../src/utils/logger");

async function setupCompleteIntegration() {
  console.log("🚀 CONFIGURACIÓN COMPLETA DE INTEGRACIÓN");
  console.log("=".repeat(60));

  const results = {
    environment: false,
    database: false,
    openai: false,
    twilio: false,
    calendly: false,
    webhooks: false,
    integration: false,
  };

  try {
    // 1. Verificar variables de entorno
    console.log("\n1️⃣ VERIFICANDO VARIABLES DE ENTORNO...");
    results.environment = await checkEnvironmentVariables();

    // 2. Verificar base de datos
    console.log("\n2️⃣ VERIFICANDO BASE DE DATOS...");
    results.database = await checkDatabase();

    // 3. Verificar OpenAI
    console.log("\n3️⃣ VERIFICANDO OPENAI...");
    results.openai = await checkOpenAI();

    // 4. Verificar Twilio
    console.log("\n4️⃣ VERIFICANDO TWILIO...");
    results.twilio = await checkTwilio();

    // 5. Verificar Calendly
    console.log("\n5️⃣ VERIFICANDO CALENDLY...");
    results.calendly = await checkCalendly();

    // 6. Configurar webhooks
    console.log("\n6️⃣ CONFIGURANDO WEBHOOKS...");
    results.webhooks = await setupWebhooks();

    // 7. Probar integración completa
    console.log("\n7️⃣ PROBANDO INTEGRACIÓN COMPLETA...");
    results.integration = await testCompleteIntegration();

    // 8. Resumen final
    console.log("\n" + "=".repeat(60));
    console.log("📊 RESUMEN DE CONFIGURACIÓN");
    console.log("=".repeat(60));

    Object.entries(results).forEach(([component, status]) => {
      const icon = status ? "✅" : "❌";
      const statusText = status ? "OK" : "FAIL";
      console.log(`  ${component.padEnd(15)}: ${icon} ${statusText}`);
    });

    const allOk = Object.values(results).every(Boolean);
    console.log(
      `\n🎯 ESTADO GENERAL: ${allOk ? "✅ COMPLETADO" : "❌ REQUIERE ATENCIÓN"}`
    );

    if (!allOk) {
      console.log("\n🔧 ACCIONES REQUERIDAS:");
      if (!results.environment)
        console.log("  • Configurar variables de entorno faltantes");
      if (!results.database)
        console.log("  • Verificar conexión y esquema de base de datos");
      if (!results.openai) console.log("  • Verificar API key de OpenAI");
      if (!results.twilio) console.log("  • Verificar credenciales de Twilio");
      if (!results.calendly)
        console.log("  • Verificar configuración de Calendly");
      if (!results.webhooks)
        console.log("  • Configurar webhooks correctamente");
      if (!results.integration)
        console.log("  • Resolver problemas de integración");
    }

    return allOk;
  } catch (error) {
    console.error("\n❌ ERROR CRÍTICO EN CONFIGURACIÓN:", error);
    return false;
  }
}

async function checkEnvironmentVariables() {
  const requiredVars = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "OPENAI_API_KEY",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_WHATSAPP_NUMBER",
    "CALENDLY_ACCESS_TOKEN",
    "CALENDLY_USER_URI",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
  ];

  const missing = [];
  const weak = [];

  requiredVars.forEach((varName) => {
    const value = process.env[varName];
    if (!value) {
      missing.push(varName);
    } else if (varName.includes("SECRET") && value.length < 32) {
      weak.push(varName);
    }
  });

  if (missing.length > 0) {
    console.log(`  ❌ Variables faltantes: ${missing.join(", ")}`);
    return false;
  }

  if (weak.length > 0) {
    console.log(`  ⚠️ Variables débiles: ${weak.join(", ")}`);
  }

  console.log("  ✅ Todas las variables de entorno están configuradas");
  return true;
}

async function checkDatabase() {
  try {
    const { createClient } = require("@supabase/supabase-js");
    const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = require("../src/config/env");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Verificar conexión
    const { data: connectionTest, error: connectionError } = await supabase
      .from("services")
      .select("count")
      .limit(1);

    if (connectionError) {
      console.log(`  ❌ Error de conexión: ${connectionError.message}`);
      return false;
    }

    // Verificar tablas principales
    const tables = ["clients", "services", "appointments", "users"];
    const tableResults = {};

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select("count")
          .limit(1);

        tableResults[table] = !error;
        if (error) {
          console.log(`  ⚠️ Tabla ${table}: ${error.message}`);
        }
      } catch (err) {
        tableResults[table] = false;
        console.log(`  ❌ Tabla ${table}: Error de acceso`);
      }
    }

    const allTablesOk = Object.values(tableResults).every(Boolean);

    if (allTablesOk) {
      console.log("  ✅ Base de datos y tablas principales verificadas");
    } else {
      console.log("  ❌ Algunas tablas tienen problemas");
    }

    return allTablesOk;
  } catch (error) {
    console.log(`  ❌ Error verificando base de datos: ${error.message}`);
    return false;
  }
}

async function checkOpenAI() {
  try {
    const openaiClient = require("../src/integrations/openaiClient");

    const testResponse = await openaiClient.generateResponse(
      "Test de configuración",
      {
        max_tokens: 10,
      }
    );

    if (testResponse) {
      console.log("  ✅ OpenAI configurado y funcionando");
      return true;
    } else {
      console.log("  ❌ OpenAI no responde correctamente");
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Error con OpenAI: ${error.message}`);
    return false;
  }
}

async function checkTwilio() {
  try {
    const twilioClient = require("../src/integrations/twilioClient");

    const account = await twilioClient.api
      .accounts(twilioClient.accountSid)
      .fetch();

    if (account) {
      console.log(`  ✅ Twilio configurado - Cuenta: ${account.friendlyName}`);

      // Verificar número de WhatsApp
      const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;
      if (whatsappNumber) {
        console.log(`  ✅ Número WhatsApp configurado: ${whatsappNumber}`);
      } else {
        console.log("  ⚠️ Número de WhatsApp no configurado");
      }

      return true;
    } else {
      console.log("  ❌ No se pudo verificar cuenta de Twilio");
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Error con Twilio: ${error.message}`);
    return false;
  }
}

async function checkCalendly() {
  try {
    const calendlyClient = require("../src/integrations/calendlyClient");

    if (!calendlyClient.isInitialized()) {
      console.log("  ❌ Calendly no está inicializado");
      return false;
    }

    // Intentar obtener información del usuario
    const userUri = process.env.CALENDLY_USER_URI;
    if (userUri) {
      console.log(`  ✅ Calendly configurado - Usuario: ${userUri}`);
      return true;
    } else {
      console.log("  ❌ URI de usuario de Calendly no configurado");
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Error con Calendly: ${error.message}`);
    return false;
  }
}

async function setupWebhooks() {
  try {
    const webhookUrls = {
      calendly:
        process.env.NODE_ENV === "production"
          ? process.env.CALENDLY_WEBHOOK_URI
          : process.env.CALENDLY_WEBHOOK_URI_DEV,
      whatsapp: process.env.TWILIO_WEBHOOK_URL,
    };

    console.log("  📋 URLs de webhook configuradas:");
    console.log(`    • Calendly: ${webhookUrls.calendly}`);
    console.log(`    • WhatsApp: ${webhookUrls.whatsapp}`);

    // Verificar que los endpoints respondan
    let webhooksOk = true;

    for (const [service, url] of Object.entries(webhookUrls)) {
      if (url) {
        try {
          const response = await fetch(url.replace("/webhook", "/health"), {
            method: "GET",
            timeout: 5000,
          });

          if (response.ok) {
            console.log(`    ✅ ${service}: Endpoint responde`);
          } else {
            console.log(
              `    ⚠️ ${service}: Endpoint responde con status ${response.status}`
            );
          }
        } catch (error) {
          console.log(`    ❌ ${service}: No se puede conectar`);
          webhooksOk = false;
        }
      } else {
        console.log(`    ❌ ${service}: URL no configurada`);
        webhooksOk = false;
      }
    }

    return webhooksOk;
  } catch (error) {
    console.log(`  ❌ Error configurando webhooks: ${error.message}`);
    return false;
  }
}

async function testCompleteIntegration() {
  try {
    const integrationOrchestrator = require("../src/services/integrationOrchestrator");

    // Realizar health check
    const healthCheck = await integrationOrchestrator.performHealthChecks();

    console.log("  📊 Estado de servicios:");
    Object.entries(healthCheck.results).forEach(([service, status]) => {
      console.log(`    ${service}: ${status ? "✅" : "❌"}`);
    });

    if (healthCheck.allHealthy) {
      console.log("  ✅ Integración completa funcionando");
      return true;
    } else {
      console.log("  ❌ Algunos servicios tienen problemas");
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Error probando integración: ${error.message}`);
    return false;
  }
}

// Función para generar configuración de ejemplo
async function generateExampleConfig() {
  console.log("📝 GENERANDO CONFIGURACIÓN DE EJEMPLO");
  console.log("=".repeat(50));

  const exampleConfig = `
# =================================
# CONFIGURACIÓN DE EJEMPLO - .env.local
# =================================

# Servidor
PORT=3000
NODE_ENV=development

# Base de datos (Supabase)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_KEY=tu_service_key

# OpenAI
OPENAI_API_KEY=sk-proj-tu_api_key
OPENAI_MODEL=gpt-4-turbo
OPENAI_MAX_TOKENS=1000

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=tu_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Calendly
CALENDLY_ACCESS_TOKEN=tu_access_token
CALENDLY_USER_URI=https://api.calendly.com/users/tu_user_id
CALENDLY_CLIENT_ID=tu_client_id
CALENDLY_CLIENT_SECRET=tu_client_secret
CALENDLY_WEBHOOK_URI=https://tu-dominio.com/api/calendly/webhook

# Seguridad
JWT_SECRET=tu_jwt_secret_muy_largo_y_seguro
JWT_REFRESH_SECRET=tu_refresh_secret_muy_largo_y_seguro

# Webhooks
TWILIO_WEBHOOK_URL=https://tu-dominio.com/webhook/whatsapp
CALENDLY_WEBHOOK_SIGNING_KEY=tu_signing_key
`;

  console.log(exampleConfig);

  console.log("\n🔧 PASOS PARA CONFIGURAR:");
  console.log("1. Copia esta configuración a tu archivo .env.local");
  console.log(
    "2. Reemplaza todos los valores 'tu_*' con tus credenciales reales"
  );
  console.log("3. Ejecuta: node scripts/setup_complete_integration.js");
  console.log("4. Sigue las instrucciones para corregir cualquier problema");
}

// Ejecutar según argumentos
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("--example-config")) {
    generateExampleConfig();
  } else {
    setupCompleteIntegration()
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
  setupCompleteIntegration,
  checkEnvironmentVariables,
  checkDatabase,
  checkOpenAI,
  checkTwilio,
  checkCalendly,
  generateExampleConfig,
};
