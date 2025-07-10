// scripts/testSupabaseConnection.js
// Cargar variables de entorno de forma segura
require("dotenv").config({ path: ".env" }); // Configuración base
require("dotenv").config({ path: ".env.local", override: true }); // Secretos locales

const supabase = require("../src/integrations/supabaseClient");

async function testConnection() {
  try {
    console.log("🔍 Probando conexión a Supabase...");

    // Probar conexión básica
    const { data, error } = await supabase
      .from("services")
      .select("count", { count: "exact", head: true });

    if (error) {
      console.error("❌ Error conectando a la tabla services:", error.message);

      // Intentar listar todas las tablas disponibles
      console.log("\n🔍 Intentando obtener información del esquema...");
      const { data: tables, error: schemaError } = await supabase.rpc(
        "get_schema_info"
      );

      if (schemaError) {
        console.error("❌ Error obteniendo esquema:", schemaError.message);
      } else {
        console.log("📋 Tablas disponibles:", tables);
      }
    } else {
      console.log("✅ Conexión exitosa a Supabase!");
      console.log(`📊 Tabla 'services' existe y tiene ${data || 0} registros`);

      // Probar otras tablas
      const tablesToTest = ["clients", "bookings", "notifications"];

      for (const table of tablesToTest) {
        try {
          const { data: tableData, error: tableError } = await supabase
            .from(table)
            .select("count", { count: "exact", head: true });

          if (tableError) {
            console.log(`❌ Tabla '${table}': ${tableError.message}`);
          } else {
            console.log(`✅ Tabla '${table}': ${tableData || 0} registros`);
          }
        } catch (err) {
          console.log(`❌ Error probando tabla '${table}':`, err.message);
        }
      }
    }
  } catch (error) {
    console.error("💥 Error general:", error.message);
  }
}

testConnection();
