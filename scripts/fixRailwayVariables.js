// scripts/fixRailwayVariables.js
// Script para mostrar las variables correctas para Railway

require("dotenv").config({ path: ".env.local" });

function showCorrectVariables() {
  console.log("🔧 VARIABLES CORRECTAS PARA RAILWAY DASHBOARD");
  console.log("=============================================\n");

  console.log("🚨 PROBLEMA DETECTADO:");
  console.log("Una variable tiene formato incorrecto en Railway");
  console.log(
    'ERROR: invalid key-value pair "="ALLOWED_ORIGINS=...": empty key\n',
  );

  console.log("✅ SOLUCIÓN:");
  console.log("1. Ve a Railway Dashboard → Settings → Variables");
  console.log('2. ELIMINA cualquier variable que tenga "=" al inicio');
  console.log("3. Configura estas variables EXACTAMENTE así:\n");

  // Variables críticas del sistema
  const variables = {
    // Sistema
    NODE_ENV: "production",
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
    OPENAI_MODEL: "gpt-4-turbo",

    // Calendly
    CALENDLY_ACCESS_TOKEN: process.env.CALENDLY_ACCESS_TOKEN,
    CALENDLY_USER_URI: process.env.CALENDLY_USER_URI,

    // JWT
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,

    // Admin
    ADMIN_USERNAME: process.env.ADMIN_USERNAME,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,

    // CORS (ESTA ES LA PROBLEMÁTICA)
    ALLOWED_ORIGINS:
      "https://bot.ricardoburitica.eu,https://ricardoburitica.com",
  };

  console.log("📋 FORMATO CORRECTO:");
  console.log("====================\n");

  for (const [key, value] of Object.entries(variables)) {
    if (value && value !== "undefined" && value !== "") {
      console.log(`Variable Name: ${key}`);
      console.log(`Variable Value: ${value}`);
      console.log("---");
    }
  }

  console.log("\n🚨 ESPECIAL ATENCIÓN A:");
  console.log("======================");
  console.log("Variable Name: ALLOWED_ORIGINS");
  console.log(
    "Variable Value: https://bot.ricardoburitica.eu,https://ricardoburitica.com",
  );
  console.log("(SIN comillas, SIN espacios extra, SIN = al inicio)\n");

  console.log("🔄 PASOS PARA ARREGLAR:");
  console.log("======================");
  console.log(
    "1. Ir a: https://railway.app/project/2806399e-7537-46ce-acc7-fa043193e2a9",
  );
  console.log("2. Settings → Variables");
  console.log('3. ELIMINAR variables con "=" al inicio');
  console.log("4. Agregar variables con formato correcto");
  console.log("5. Hacer Deploy");
  console.log("6. Verificar: https://bot.ricardoburitica.eu/health\n");

  return true;
}

// Ejecutar
if (require.main === module) {
  showCorrectVariables();
  console.log("🎯 Sigue los pasos y el sistema funcionará correctamente.");
}

module.exports = { showCorrectVariables };
