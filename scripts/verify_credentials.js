#!/usr/bin/env node
/**
 * @file Script para verificar y renovar credenciales
 * @description Verifica todas las credenciales y sugiere soluciones
 */

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const logger = require("../src/utils/logger");

async function verifyAllCredentials() {
  console.log("🔐 VERIFICACIÓN DE CREDENCIALES");
  console.log("=".repeat(50));

  const results = {
    openai: false,
    twilio: false,
    calendly: false,
    supabase: false,
  };

  // 1. Verificar OpenAI
  console.log("\n1️⃣ VERIFICANDO OPENAI...");
  try {
    const { OpenAI } = require("openai");
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: "Test" }],
      max_tokens: 5,
    });

    if (response.choices && response.choices.length > 0) {
      console.log("  ✅ OpenAI funcionando correctamente");
      results.openai = true;
    } else {
      console.log("  ❌ OpenAI respuesta vacía");
    }
  } catch (error) {
    console.log(`  ❌ OpenAI error: ${error.message}`);
    if (error.message.includes("401")) {
      console.log("  💡 Solución: Verificar OPENAI_API_KEY en .env.local");
    }
  }

  // 2. Verificar Twilio
  console.log("\n2️⃣ VERIFICANDO TWILIO...");
  try {
    const twilio = require("twilio");
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const account = await client.api
      .accounts(process.env.TWILIO_ACCOUNT_SID)
      .fetch();

    if (account && account.sid) {
      console.log(`  ✅ Twilio funcionando - Cuenta: ${account.friendlyName}`);
      console.log(`  📱 Status: ${account.status}`);
      results.twilio = true;
    } else {
      console.log("  ❌ Twilio respuesta inválida");
    }
  } catch (error) {
    console.log(`  ❌ Twilio error: ${error.message}`);
    if (error.message.includes("authenticate")) {
      console.log(
        "  💡 Solución: Verificar TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN"
      );
      console.log("  🔗 Ir a: https://console.twilio.com/");
    }
  }

  // 3. Verificar Calendly
  console.log("\n3️⃣ VERIFICANDO CALENDLY...");
  try {
    const fetch = require("node-fetch");

    const response = await fetch("https://api.calendly.com/users/me", {
      headers: {
        Authorization: `Bearer ${process.env.CALENDLY_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`  ✅ Calendly funcionando - Usuario: ${data.resource.name}`);
      results.calendly = true;
    } else {
      console.log(
        `  ❌ Calendly error: ${response.status} ${response.statusText}`
      );
      if (response.status === 401) {
        console.log("  💡 Solución: Renovar CALENDLY_ACCESS_TOKEN");
        console.log(
          "  🔗 Ir a: https://calendly.com/integrations/api_webhooks"
        );
      }
    }
  } catch (error) {
    console.log(`  ❌ Calendly error: ${error.message}`);
  }

  // 4. Verificar Supabase
  console.log("\n4️⃣ VERIFICANDO SUPABASE...");
  try {
    const { createClient } = require("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data, error } = await supabase
      .from("services")
      .select("count")
      .limit(1);

    if (!error) {
      console.log("  ✅ Supabase funcionando correctamente");
      results.supabase = true;
    } else {
      console.log(`  ❌ Supabase error: ${error.message}`);
      if (
        error.message.includes("relation") &&
        error.message.includes("does not exist")
      ) {
        console.log(
          "  💡 Solución: Ejecutar scripts/create_missing_tables.sql"
        );
      }
    }
  } catch (error) {
    console.log(`  ❌ Supabase error: ${error.message}`);
  }

  // Resumen
  console.log("\n" + "=".repeat(50));
  console.log("📊 RESUMEN DE CREDENCIALES");
  console.log("=".repeat(50));

  Object.entries(results).forEach(([service, status]) => {
    console.log(`  ${service.padEnd(10)}: ${status ? "✅ OK" : "❌ FAIL"}`);
  });

  const allOk = Object.values(results).every(Boolean);
  console.log(
    `\n🎯 ESTADO GENERAL: ${allOk ? "✅ TODAS OK" : "❌ REQUIERE ATENCIÓN"}`
  );

  if (!allOk) {
    console.log("\n🔧 ACCIONES RECOMENDADAS:");

    if (!results.openai) {
      console.log(
        "  • OpenAI: Verificar/renovar API key en https://platform.openai.com/"
      );
    }

    if (!results.twilio) {
      console.log(
        "  • Twilio: Verificar credenciales en https://console.twilio.com/"
      );
    }

    if (!results.calendly) {
      console.log(
        "  • Calendly: Renovar access token en https://calendly.com/integrations/"
      );
    }

    if (!results.supabase) {
      console.log("  • Supabase: Ejecutar SQL de configuración de tablas");
    }
  }

  return allOk;
}

// Función para generar nuevas credenciales
async function generateNewCredentials() {
  console.log("\n🔄 GENERANDO NUEVAS CREDENCIALES...");

  console.log(`
📝 PASOS PARA RENOVAR CREDENCIALES:

1. **OpenAI API Key:**
   → Ir a: https://platform.openai.com/api-keys
   → Crear nueva API key
   → Actualizar OPENAI_API_KEY en .env.local

2. **Twilio Credentials:**
   → Ir a: https://console.twilio.com/
   → Account → API keys & tokens
   → Verificar Account SID y Auth Token

3. **Calendly Access Token:**
   → Ir a: https://calendly.com/integrations/api_webhooks
   → Generate new personal access token
   → Actualizar CALENDLY_ACCESS_TOKEN en .env.local

4. **Supabase:**
   → Ir a: https://supabase.com/dashboard
   → Settings → API
   → Verificar URL y Service Role Key
`);
}

// Ejecutar según argumentos
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("--generate-new")) {
    generateNewCredentials();
  } else {
    verifyAllCredentials()
      .then((success) => {
        if (!success && !args.includes("--no-suggestions")) {
          generateNewCredentials();
        }
        process.exit(success ? 0 : 1);
      })
      .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
      });
  }
}

module.exports = {
  verifyAllCredentials,
  generateNewCredentials,
};
