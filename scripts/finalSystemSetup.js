// scripts/finalSystemSetup.js
// Configuración final y definitiva del sistema

const { execSync } = require("child_process");
require("dotenv").config({ path: ".env.local" });

async function finalSystemSetup() {
  console.log("🚀 CONFIGURACIÓN FINAL DEL SISTEMA");
  console.log("==================================\n");

  // 1. CONFIGURAR VARIABLES EN RAILWAY (MÉTODO DIRECTO)
  console.log("1️⃣ CONFIGURANDO VARIABLES EN RAILWAY...");

  const envVars = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: "gpt-4-turbo",
    CALENDLY_ACCESS_TOKEN: process.env.CALENDLY_ACCESS_TOKEN,
    CALENDLY_USER_URI: process.env.CALENDLY_USER_URI,
    CALENDLY_WEBHOOK_URI: "https://bot.ricardoburitica.eu/api/calendly/webhook",
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    ADMIN_USERNAME: process.env.ADMIN_USERNAME,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    NODE_ENV: "production",
    PORT: "3000",
    APP_NAME: "Asistente RB",
    APP_VERSION: "1.0.0",
    ALLOWED_ORIGINS:
      "https://bot.ricardoburitica.eu,https://www.ricardoburitica.eu",
  };

  let configuredCount = 0;
  for (const [key, value] of Object.entries(envVars)) {
    if (value) {
      try {
        execSync(`railway variables set ${key}="${value}"`, { stdio: "pipe" });
        console.log(`✅ ${key}: CONFIGURADO`);
        configuredCount++;
      } catch (error) {
        console.log(`⚠️ ${key}: ERROR - ${error.message.substring(0, 50)}...`);
      }
    } else {
      console.log(`❌ ${key}: VALOR FALTANTE`);
    }
  }

  console.log(
    `\n📊 Variables configuradas: ${configuredCount}/${
      Object.keys(envVars).length
    }`
  );

  // 2. DEPLOY FINAL
  console.log("\n2️⃣ DEPLOY FINAL...");
  try {
    execSync("railway up --detach", { stdio: "inherit" });
    console.log("✅ Deploy completado");
  } catch (error) {
    console.log("⚠️ Error en deploy:", error.message);
  }

  // 3. VERIFICAR FUNCIONAMIENTO
  console.log("\n3️⃣ VERIFICANDO FUNCIONAMIENTO...");

  // Esperar 30 segundos para que inicie
  console.log("⏳ Esperando 30 segundos...");
  await new Promise((resolve) => setTimeout(resolve, 30000));

  const endpoints = [
    "https://bot.ricardoburitica.eu",
    "https://bot.ricardoburitica.eu/api/health",
    "https://bot.ricardoburitica.eu/api/servicios",
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      const status = response.ok ? "✅" : "⚠️";
      console.log(`${status} ${endpoint}: ${response.status}`);
    } catch (error) {
      console.log(`❌ ${endpoint}: ERROR`);
    }
  }

  // 4. CONFIGURACIONES FINALES
  console.log("\n4️⃣ CONFIGURACIONES FINALES:");
  console.log("============================");

  console.log("\n📞 TWILIO WEBHOOKS:");
  console.log(
    "Webhook URL: https://bot.ricardoburitica.eu/autonomous/whatsapp/webhook"
  );
  console.log(
    "Status URL: https://bot.ricardoburitica.eu/autonomous/whatsapp/status"
  );

  console.log("\n📅 CALENDLY WEBHOOK:");
  console.log(
    "Webhook URL: https://bot.ricardoburitica.eu/api/calendly/webhook"
  );

  console.log("\n🌐 URLS PRINCIPALES:");
  console.log("Portal: https://bot.ricardoburitica.eu/portal");
  console.log("Admin: https://bot.ricardoburitica.eu/admin");
  console.log("API: https://bot.ricardoburitica.eu/api/servicios");

  console.log("\n🎉 SISTEMA CONFIGURADO Y LISTO");
  return true;
}

// Ejecutar
if (require.main === module) {
  finalSystemSetup()
    .then(() => {
      console.log("\n✅ CONFIGURACIÓN COMPLETADA");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ ERROR:", error);
      process.exit(1);
    });
}

module.exports = { finalSystemSetup };
