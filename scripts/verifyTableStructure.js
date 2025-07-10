// scripts/verifyTableStructure.js
// Verificar estructura actual de las tablas en Supabase

// Cargar variables de entorno de forma segura
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const supabase = require("../src/integrations/supabaseClient");

async function verifyTableStructure() {
  try {
    console.log("🔍 Verificando estructura de tablas en Supabase...\n");

    const tables = [
      "users",
      "clients",
      "services",
      "bookings",
      "notifications",
    ];

    for (const table of tables) {
      console.log(`📋 Tabla: ${table}`);

      try {
        // Intentar obtener un registro para ver la estructura
        const { data, error } = await supabase.from(table).select("*").limit(1);

        if (error) {
          console.log(`❌ Error: ${error.message}`);
        } else {
          console.log(`✅ Estructura disponible`);
          if (data && data.length > 0) {
            console.log(
              `📊 Campos disponibles:`,
              Object.keys(data[0]).join(", ")
            );
            console.log(
              `📈 Registros: ${data.length > 0 ? "Con datos" : "Vacía"}`
            );
          } else {
            console.log(`📊 Tabla vacía pero funcional`);
          }
        }
      } catch (err) {
        console.log(`💥 Error: ${err.message}`);
      }

      console.log(""); // Línea en blanco
    }

    // Probar inserción de datos de prueba
    console.log("🧪 Probando inserción de datos de prueba...\n");

    // Probar inserción en services
    try {
      const { data: serviceData, error: serviceError } = await supabase
        .from("services")
        .insert({
          name: "Consulta de Prueba",
          description: "Servicio de prueba para verificar funcionalidad",
          duration_minutes: 60,
          price: 50.0,
          active: true,
        })
        .select();

      if (serviceError) {
        console.log(`❌ Error insertando servicio: ${serviceError.message}`);
      } else {
        console.log(`✅ Servicio insertado correctamente:`, serviceData[0]?.id);

        // Limpiar datos de prueba
        await supabase.from("services").delete().eq("id", serviceData[0].id);

        console.log(`🧹 Datos de prueba limpiados`);
      }
    } catch (err) {
      console.log(`💥 Error en prueba de inserción: ${err.message}`);
    }

    console.log("\n🎉 Verificación de estructura completada!");
  } catch (error) {
    console.error("💥 Error general:", error.message);
  }
}

// Ejecutar
if (require.main === module) {
  verifyTableStructure();
}

module.exports = { verifyTableStructure };
