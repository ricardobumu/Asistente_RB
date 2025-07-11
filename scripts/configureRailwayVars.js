// scripts/configureRailwayVars.js
// Script para configurar variables de entorno en Railway

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });
const { execSync } = require("child_process");

async function configureRailwayVariables() {
  console.log("🔧 CONFIGURANDO VARIABLES DE ENTORNO EN RAILWAY");
  console.log("===============================================\n");

  // Variables críticas del sistema
  const variables = {
    // Sistema
    NODE_ENV: "production",
    APP_BASE_URL: process.env.APP_BASE_URL,
    PORT: "3000",

    // Supabase
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,

    // Twilio
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER,

    // OpenAI
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4-turbo",
    OPENAI_MAX_TOKENS: process.env.OPENAI_MAX_TOKENS || "1000",

    // Calendly
    CALENDLY_ACCESS_TOKEN: process.env.CALENDLY_ACCESS_TOKEN,
    CALENDLY_USER_URI: process.env.CALENDLY_USER_URI,
    CALENDLY_WEBHOOK_URI: `${process.env.APP_BASE_URL}/api/calendly/webhook`,

    // JWT
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,

    // Admin
    ADMIN_USERNAME: process.env.ADMIN_USERNAME,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,

    // CORS
    ALLOWED_ORIGINS: `${process.env.APP_BASE_URL},https://ricardoburitica.com,http://localhost:3000`,

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS || "900000",
    RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS || "100",
    AUTH_RATE_LIMIT_MAX: process.env.AUTH_RATE_LIMIT_MAX || "5",
    REGISTER_RATE_LIMIT_MAX: process.env.REGISTER_RATE_LIMIT_MAX || "3",

    // App Info
    APP_NAME: process.env.APP_NAME || "Asistente RB",
    APP_VERSION: process.env.APP_VERSION || "1.0.0",
  };

  console.log("📋 Variables a configurar:");
  let configured = 0;
  let errors = 0;

  for (const [key, value] of Object.entries(variables)) {
    if (value && value !== "undefined") {
      try {
        // Escapar caracteres especiales para la shell
        const escapedValue = value.replace(/"/g, '\\"');
        const command = `railway variables set "${key}=${escapedValue}"`;

        execSync(command, { stdio: "pipe" });
        console.log(`   ✅ ${key}`);
        configured++;
      } catch (error) {
        console.log(`   ❌ ${key} - Error: ${error.message}`);
        errors++;
      }
    } else {
      console.log(`   ⚠️ ${key} - Valor no encontrado`);
      errors++;
    }
  }

  console.log(`\n📊 RESUMEN:`);
  console.log(`✅ Configuradas: ${configured}`);
  console.log(`❌ Errores: ${errors}`);
  console.log(`📝 Total: ${Object.keys(variables).length}`);

  if (configured > 0) {
    console.log("\n🔄 Reiniciando aplicación en Railway...");
    try {
      execSync("railway restart", { stdio: "pipe" });
      console.log("✅ Aplicación reiniciada");
    } catch (error) {
      console.log("⚠️ Error reiniciando, hazlo manualmente");
    }
  }

  console.log("\n🌐 URLs de verificación:");
  console.log(`- Aplicación: ${process.env.APP_BASE_URL}`);
  console.log(`- Health Check: ${process.env.APP_BASE_URL}/health`);
  console.log(`- Portal Cliente: ${process.env.APP_BASE_URL}/portal`);
  console.log(`- Admin Panel: ${process.env.APP_BASE_URL}/admin`);
  console.log(
    "- Dashboard Railway: https://railway.app/project/2806399e-7537-46ce-acc7-fa043193e2a9"
  );

  return { configured, errors, total: Object.keys(variables).length };
}

// Ejecutar
if (require.main === module) {
  configureRailwayVariables()
    .then((result) => {
      if (result.errors === 0) {
        console.log("\n🎉 ¡TODAS LAS VARIABLES CONFIGURADAS EXITOSAMENTE!");
        process.exit(0);
      } else {
        console.log("\n⚠️ Algunas variables necesitan configuración manual");
        console.log(
          "Ve al Dashboard de Railway para completar la configuración"
        );
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("\n❌ Error configurando variables:", error);
      process.exit(1);
    });
}

module.exports = { configureRailwayVariables };
