// scripts/checkRLS.js
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });

const supabaseAdmin = require("../src/integrations/supabaseAdmin");

async function checkRLS() {
  console.log("🔍 Verificando estado actual de las tablas...\n");

  try {
    // Verificar tablas principales
    const tables = [
      "users",
      "clients",
      "services",
      "bookings",
      "notifications",
      "activity_logs",
      "whatsapp_conversations",
      "whatsapp_messages",
    ];

    console.log("📊 ESTADO DE TABLAS:");
    for (const table of tables) {
      try {
        const { data, error } = await supabaseAdmin
          .from(table)
          .select("*")
          .limit(1);

        if (error) {
          if (error.code === "42P01") {
            console.log(`❌ ${table}: NO EXISTE`);
          } else if (error.code === "42501") {
            console.log(
              `🔒 ${table}: EXISTE - RLS BLOQUEANDO (necesita políticas)`,
            );
          } else {
            console.log(`⚠️ ${table}: ERROR - ${error.message}`);
          }
        } else {
          console.log(
            `✅ ${table}: ACCESIBLE (${data?.length || 0} registros)`,
          );
        }
      } catch (err) {
        console.log(`❌ ${table}: ERROR - ${err.message}`);
      }
    }

    console.log("\n🔐 VERIFICANDO CONFIGURACIÓN SUPABASE:");
    console.log(
      `✅ URL: ${process.env.SUPABASE_URL ? "Configurada" : "❌ Falta"}`,
    );
    console.log(
      `✅ ANON_KEY: ${
        process.env.SUPABASE_ANON_KEY ? "Configurada" : "❌ Falta"
      }`,
    );
    console.log(
      `✅ SERVICE_KEY: ${
        process.env.SUPABASE_SERVICE_KEY ? "Configurada" : "❌ Falta"
      }`,
    );
  } catch (error) {
    console.error("❌ Error general:", error.message);
  }
}

checkRLS();
