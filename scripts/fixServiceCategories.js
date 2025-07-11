// scripts/fixServiceCategories.js
// Script para corregir inconsistencias en categorías de servicios

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });

const supabaseClient = require("../src/integrations/supabaseClient");

async function fixServiceCategories() {
  console.log("🔧 CORRIGIENDO INCONSISTENCIAS EN CATEGORÍAS DE SERVICIOS");
  console.log("=====================================================\n");

  try {
    // 1. Verificar estado actual
    console.log("📊 Estado actual de categorías:");
    const { data: currentServices, error: fetchError } = await supabaseClient
      .from("servicios")
      .select("id_servicio, nombre, categoria")
      .order("categoria");

    if (fetchError) throw fetchError;

    // Contar por categoría
    const categoryCount = {};
    currentServices.forEach((service) => {
      categoryCount[service.categoria] =
        (categoryCount[service.categoria] || 0) + 1;
    });

    console.log("Categorías encontradas:");
    Object.entries(categoryCount).forEach(([cat, count]) => {
      console.log(`  - ${cat}: ${count} servicios`);
    });
    console.log("");

    // 2. Definir mapeo de correcciones
    const categoryMapping = {
      Asesoría: "ASESORÍA",
      Hidratación: "TRATAMIENTO",
      tratamientos_capilares: "TRATAMIENTO",
      cortes: "CORTE",
      coloracion: "COLORACIÓN",
    };

    // 3. Aplicar correcciones
    console.log("🔄 Aplicando correcciones:");

    for (const [oldCategory, newCategory] of Object.entries(categoryMapping)) {
      const servicesToUpdate = currentServices.filter(
        (s) => s.categoria === oldCategory,
      );

      if (servicesToUpdate.length > 0) {
        console.log(
          `\n📝 Actualizando "${oldCategory}" → "${newCategory}" (${servicesToUpdate.length} servicios)`,
        );

        for (const service of servicesToUpdate) {
          console.log(`   - ${service.nombre}`);
        }

        const { error: updateError } = await supabaseClient
          .from("servicios")
          .update({ categoria: newCategory })
          .eq("categoria", oldCategory);

        if (updateError) {
          console.error(`❌ Error actualizando ${oldCategory}:`, updateError);
        } else {
          console.log(
            `✅ ${servicesToUpdate.length} servicios actualizados correctamente`,
          );
        }
      }
    }

    // 4. Verificar resultado final
    console.log("\n📊 Estado final de categorías:");
    const { data: finalServices, error: finalError } = await supabaseClient
      .from("servicios")
      .select("categoria")
      .order("categoria");

    if (finalError) throw finalError;

    const finalCategoryCount = {};
    finalServices.forEach((service) => {
      finalCategoryCount[service.categoria] =
        (finalCategoryCount[service.categoria] || 0) + 1;
    });

    console.log("Categorías finales:");
    Object.entries(finalCategoryCount).forEach(([cat, count]) => {
      console.log(`  ✅ ${cat}: ${count} servicios`);
    });

    // 5. Validar que solo tenemos las 4 categorías correctas
    const expectedCategories = [
      "ASESORÍA",
      "COLORACIÓN",
      "CORTE",
      "TRATAMIENTO",
    ];
    const actualCategories = Object.keys(finalCategoryCount);

    const unexpectedCategories = actualCategories.filter(
      (cat) => !expectedCategories.includes(cat),
    );

    if (unexpectedCategories.length === 0) {
      console.log("\n🎉 ¡CORRECCIÓN COMPLETADA EXITOSAMENTE!");
      console.log("✅ Todas las categorías están normalizadas");
      console.log("✅ Solo existen las 4 categorías estándar");
      console.log("✅ El portal cliente funcionará correctamente");
    } else {
      console.log("\n⚠️ Aún hay categorías no estándar:");
      unexpectedCategories.forEach((cat) => {
        console.log(`   - ${cat}`);
      });
    }
  } catch (error) {
    console.error("❌ Error durante la corrección:", error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  fixServiceCategories()
    .then(() => {
      console.log("\n✅ Script completado");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Error fatal:", error);
      process.exit(1);
    });
}

module.exports = { fixServiceCategories };
