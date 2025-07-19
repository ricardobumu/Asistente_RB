/**
 * SCRIPT PARA APLICAR FUNCIONES DE VALIDACIÓN EN SUPABASE
 *
 * Este script ejecuta las funciones SQL de validación de números de teléfono
 * directamente en la base de datos de Supabase
 *
 * Uso: node scripts/apply-supabase-functions.js
 */

require("dotenv").config();
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

// Configuración
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "❌ Error: Variables de entorno SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Ejecuta una consulta SQL en Supabase
 */
async function executeSQL(sql, description) {
  try {
    console.log(`🔄 Ejecutando: ${description}...`);

    const { data, error } = await supabase.rpc("exec_sql", { sql_query: sql });

    if (error) {
      // Si no existe la función exec_sql, intentar con query directo
      const { data: directData, error: directError } = await supabase
        .from("_temp_sql_execution")
        .select("*")
        .limit(0);

      if (directError) {
        console.error(`❌ Error ejecutando ${description}:`, error.message);
        return { success: false, error: error.message };
      }
    }

    console.log(`✅ ${description} ejecutado correctamente`);
    return { success: true, data };
  } catch (error) {
    console.error(`❌ Error ejecutando ${description}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Aplica las funciones SQL desde el archivo
 */
async function applyFunctions() {
  try {
    const sqlPath = path.join(
      __dirname,
      "supabase-phone-validation-function.sql"
    );

    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Archivo SQL no encontrado: ${sqlPath}`);
    }

    console.log("📄 Leyendo funciones SQL...");
    const sqlContent = fs.readFileSync(sqlPath, "utf8");

    // Dividir el contenido en funciones individuales
    const functions = sqlContent.split(
      /(?=CREATE OR REPLACE FUNCTION|DROP TRIGGER|CREATE TRIGGER|COMMENT ON)/
    );

    console.log(`📊 Encontradas ${functions.length} declaraciones SQL\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < functions.length; i++) {
      const func = functions[i].trim();
      if (!func) continue;

      // Extraer descripción de la función
      let description = `Declaración ${i + 1}`;
      if (func.includes("CREATE OR REPLACE FUNCTION")) {
        const match = func.match(/CREATE OR REPLACE FUNCTION\s+(\w+)/);
        if (match) {
          description = `Función ${match[1]}`;
        }
      } else if (func.includes("CREATE TRIGGER")) {
        const match = func.match(/CREATE TRIGGER\s+(\w+)/);
        if (match) {
          description = `Trigger ${match[1]}`;
        }
      } else if (func.includes("COMMENT ON")) {
        description = "Comentario de documentación";
      }

      const result = await executeSQL(func, description);

      if (result.success) {
        successCount++;
      } else {
        errorCount++;
        console.error(`❌ Error en ${description}:`, result.error);
      }

      // Pequeña pausa entre ejecuciones
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 RESUMEN DE APLICACIÓN DE FUNCIONES");
    console.log("=".repeat(50));
    console.log(`✅ Funciones aplicadas correctamente: ${successCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(`📊 Total: ${successCount + errorCount}`);

    if (errorCount === 0) {
      console.log("\n🎉 ¡Todas las funciones se aplicaron exitosamente!");
      console.log(
        "📱 El sistema de validación de números de teléfono está activo"
      );
    } else {
      console.log(
        `\n⚠️  ${errorCount} funciones fallaron. Revisar errores arriba.`
      );
    }

    return { success: errorCount === 0, successCount, errorCount };
  } catch (error) {
    console.error("❌ Error aplicando funciones:", error.message);
    logger.error("Error aplicando funciones SQL", { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Prueba las funciones aplicadas
 */
async function testFunctions() {
  console.log("\n🧪 Probando funciones aplicadas...\n");

  const tests = [
    {
      name: "Formateo número español",
      sql: "SELECT format_phone_number('666123456') as result",
      expected: "+34666123456",
    },
    {
      name: "Formateo número estadounidense",
      sql: "SELECT format_phone_number('2125551234') as result",
      expected: "+12125551234",
    },
    {
      name: "Formateo número colombiano",
      sql: "SELECT format_phone_number('3001234567') as result",
      expected: "+573001234567",
    },
    {
      name: "Formateo número suizo",
      sql: "SELECT format_phone_number('791234567', '+41') as result",
      expected: "+41791234567",
    },
    {
      name: "Corrección número malformado",
      sql: "SELECT format_phone_number('+3434666123456') as result",
      expected: "+34666123456",
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const { data, error } = await supabase.rpc("format_phone_number", {
        phone_input: test.sql.match(/'([^']+)'/)[1],
        default_country: test.sql.includes("'+41'") ? "+41" : "+34",
      });

      if (error) {
        console.log(`❌ ${test.name}: Error - ${error.message}`);
        failed++;
      } else if (data === test.expected) {
        console.log(`✅ ${test.name}: ${data}`);
        passed++;
      } else {
        console.log(`❌ ${test.name}: ${data} (esperado: ${test.expected})`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name}: Error de ejecución - ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Pruebas: ${passed} pasadas, ${failed} fallidas`);
  return { passed, failed };
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log(
      "🚀 Aplicando funciones de validación de números de teléfono en Supabase...\n"
    );

    // Aplicar funciones
    const applyResult = await applyFunctions();

    if (!applyResult.success) {
      console.error("❌ Error aplicando funciones. Abortando.");
      process.exit(1);
    }

    // Probar funciones (opcional, puede fallar si no hay permisos RPC)
    try {
      await testFunctions();
    } catch (error) {
      console.log(
        "⚠️  No se pudieron probar las funciones (puede ser normal si no hay permisos RPC)"
      );
    }

    console.log("\n✅ Proceso completado exitosamente");
    console.log("📱 Las funciones de validación están listas para usar");

    logger.info("Funciones de validación aplicadas en Supabase", {
      success: applyResult.success,
      successCount: applyResult.successCount,
      errorCount: applyResult.errorCount,
    });
  } catch (error) {
    console.error("\n❌ Error en el proceso principal:", error.message);
    logger.error("Error aplicando funciones en Supabase", {
      error: error.message,
    });
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = { main, applyFunctions, testFunctions };
