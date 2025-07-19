/**
 * DESCUBRIR ESQUEMA REAL DE SUPABASE
 * Script para obtener la estructura real de todas las tablas
 */

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const { createClient } = require("@supabase/supabase-js");

console.log("🔍 DESCUBRIENDO ESQUEMA REAL DE SUPABASE\n");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function discoverTableSchema(tableName) {
  console.log(`🔍 Analizando tabla: ${tableName}`);

  try {
    // Método 1: Intentar obtener datos existentes
    const { data, error } = await supabase.from(tableName).select("*").limit(1);

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
      return { exists: false, error: error.message };
    }

    if (data && data.length > 0) {
      const fields = Object.keys(data[0]);
      console.log(
        `   ✅ Campos detectados (${fields.length}): ${fields.join(", ")}`
      );

      // Mostrar tipos de datos
      console.log("   📋 Estructura detallada:");
      fields.forEach((field) => {
        const value = data[0][field];
        const type = value === null ? "null" : typeof value;
        console.log(`      • ${field}: ${type}`);
      });

      return {
        exists: true,
        hasData: true,
        fields,
        sample: data[0],
      };
    } else {
      console.log("   ℹ️  Tabla existe pero está vacía");

      // Método 2: Intentar insertar datos mínimos para descubrir estructura
      const testCases = [
        // Caso 1: Solo ID
        { id: "test-id" },
        // Caso 2: Campos comunes
        { name: "Test", email: "test@test.com" },
        // Caso 3: Con teléfono
        { phone: "+34600000000" },
        { phone_number: "+34600000000" },
        // Caso 4: Estructura mínima
        {},
      ];

      for (const testData of testCases) {
        try {
          const { data: insertData, error: insertError } = await supabase
            .from(tableName)
            .insert(testData)
            .select();

          if (!insertError && insertData && insertData.length > 0) {
            const fields = Object.keys(insertData[0]);
            console.log(`   ✅ Estructura descubierta: ${fields.join(", ")}`);

            // Limpiar el registro de prueba
            if (insertData[0].id) {
              await supabase
                .from(tableName)
                .delete()
                .eq("id", insertData[0].id);
            }

            return {
              exists: true,
              hasData: false,
              fields,
              discoveredWith: testData,
            };
          }
        } catch (testError) {
          // Continuar con el siguiente test
        }
      }

      return {
        exists: true,
        hasData: false,
        fields: "unknown",
        note: "No se pudo determinar estructura",
      };
    }
  } catch (err) {
    console.log(`   ❌ Error general: ${err.message}`);
    return { exists: false, error: err.message };
  }
}

async function main() {
  try {
    const tables = [
      "clients",
      "services",
      "appointments",
      "conversations",
      "messages",
    ];
    const results = {};

    console.log("📊 ANALIZANDO TODAS LAS TABLAS...\n");

    for (const table of tables) {
      results[table] = await discoverTableSchema(table);
      console.log(""); // Línea en blanco
    }

    console.log("=".repeat(70));
    console.log("📊 RESUMEN DEL ESQUEMA REAL");
    console.log("=".repeat(70));

    for (const [tableName, result] of Object.entries(results)) {
      console.log(`\n📋 TABLA: ${tableName.toUpperCase()}`);

      if (result.exists) {
        console.log("   ✅ Existe: Sí");
        console.log(`   📊 Datos: ${result.hasData ? "Sí" : "No"}`);

        if (result.fields && Array.isArray(result.fields)) {
          console.log(
            `   🔧 Campos (${result.fields.length}): ${result.fields.join(", ")}`
          );

          // Análisis específico para clients
          if (tableName === "clients") {
            const phoneFields = result.fields.filter(
              (f) =>
                f.toLowerCase().includes("phone") ||
                f.toLowerCase().includes("tel") ||
                f.toLowerCase().includes("mobile")
            );

            if (phoneFields.length > 0) {
              console.log(
                `   📞 Campos de teléfono: ${phoneFields.join(", ")}`
              );
            } else {
              console.log("   ⚠️  No se encontraron campos de teléfono");
            }
          }
        } else {
          console.log(`   🔧 Campos: ${result.fields}`);
        }

        if (result.note) {
          console.log(`   💡 Nota: ${result.note}`);
        }
      } else {
        console.log("   ❌ Existe: No");
        console.log(`   🚨 Error: ${result.error}`);
      }
    }

    console.log("\n" + "=".repeat(70));
    console.log("🎯 RECOMENDACIONES");
    console.log("=".repeat(70));

    // Generar recomendaciones específicas
    if (results.clients && results.clients.exists && results.clients.fields) {
      console.log("\n📋 PARA TABLA CLIENTS:");
      if (Array.isArray(results.clients.fields)) {
        const fields = results.clients.fields;

        if (fields.includes("phone_number")) {
          console.log("   ✅ Usar campo: phone_number");
        } else if (fields.includes("phone")) {
          console.log("   ✅ Usar campo: phone");
        } else {
          console.log("   ⚠️  Necesitas añadir un campo para teléfono");
        }

        console.log(
          `   🔧 Actualizar supabaseService.js con campos: ${fields.join(", ")}`
        );
      }
    }

    console.log("=".repeat(70));
  } catch (error) {
    console.log("\n❌ ERROR GENERAL:", error.message);
  }
}

main();
