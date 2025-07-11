// scripts/fixCategoriesV2.js
// Script mejorado para corregir categorías de servicios

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });

const supabaseClient = require("../src/integrations/supabaseClient");

async function fixCategoriesV2() {
  console.log("🔧 CORRECCIÓN AVANZADA DE CATEGORÍAS DE SERVICIOS");
  console.log("================================================\n");

  try {
    // 1. Obtener todos los servicios
    console.log("📊 Obteniendo todos los servicios...");
    const { data: services, error: fetchError } = await supabaseClient
      .from("servicios")
      .select("id_servicio, nombre, categoria")
      .order("nombre");

    if (fetchError) {
      console.error("❌ Error obteniendo servicios:", fetchError);
      throw fetchError;
    }

    console.log(`✅ ${services.length} servicios encontrados\n`);

    // 2. Mostrar estado actual
    console.log("📋 Estado actual por categoría:");
    const categoryGroups = {};
    services.forEach((service) => {
      if (!categoryGroups[service.categoria]) {
        categoryGroups[service.categoria] = [];
      }
      categoryGroups[service.categoria].push(service);
    });

    Object.entries(categoryGroups).forEach(([categoria, servicios]) => {
      console.log(`\n🏷️  ${categoria} (${servicios.length} servicios):`);
      servicios.forEach((s) => console.log(`   - ${s.nombre}`));
    });

    // 3. Definir correcciones específicas
    const corrections = [
      { from: "Asesoría", to: "ASESORÍA" },
      { from: "Hidratación", to: "TRATAMIENTO" },
      { from: "tratamientos_capilares", to: "TRATAMIENTO" },
      { from: "cortes", to: "CORTE" },
      { from: "coloracion", to: "COLORACIÓN" },
    ];

    console.log("\n🔄 Aplicando correcciones individuales...\n");

    let totalUpdated = 0;

    for (const correction of corrections) {
      const servicesToUpdate = services.filter(
        (s) => s.categoria === correction.from,
      );

      if (servicesToUpdate.length > 0) {
        console.log(`📝 Corrigiendo "${correction.from}" → "${correction.to}"`);
        console.log(`   Servicios a actualizar: ${servicesToUpdate.length}`);

        for (const service of servicesToUpdate) {
          console.log(`   🔄 Actualizando: ${service.nombre}`);

          const { data, error } = await supabaseClient
            .from("servicios")
            .update({ categoria: correction.to })
            .eq("id_servicio", service.id_servicio)
            .select();

          if (error) {
            console.error(`   ❌ Error: ${error.message}`);
            console.error(`   Detalles:`, error);
          } else {
            console.log(`   ✅ Actualizado correctamente`);
            totalUpdated++;
          }
        }
        console.log("");
      }
    }

    // 4. Verificar resultado final
    console.log("🔍 Verificando resultado final...\n");

    const { data: finalServices, error: finalError } = await supabaseClient
      .from("servicios")
      .select("categoria")
      .order("categoria");

    if (finalError) throw finalError;

    const finalCategories = {};
    finalServices.forEach((service) => {
      finalCategories[service.categoria] =
        (finalCategories[service.categoria] || 0) + 1;
    });

    console.log("📊 Categorías finales:");
    Object.entries(finalCategories).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count} servicios`);
    });

    // 5. Validar resultado
    const expectedCategories = [
      "ASESORÍA",
      "COLORACIÓN",
      "CORTE",
      "TRATAMIENTO",
    ];
    const actualCategories = Object.keys(finalCategories);
    const unexpectedCategories = actualCategories.filter(
      (cat) => !expectedCategories.includes(cat),
    );

    console.log("\n🎯 RESULTADO FINAL:");
    console.log(`✅ Total de servicios actualizados: ${totalUpdated}`);

    if (unexpectedCategories.length === 0) {
      console.log("🎉 ¡ÉXITO COMPLETO!");
      console.log("✅ Todas las categorías están normalizadas");
      console.log("✅ Solo existen las 4 categorías estándar");
    } else {
      console.log("⚠️ Aún hay categorías no estándar:");
      unexpectedCategories.forEach((cat) => console.log(`   - ${cat}`));
    }
  } catch (error) {
    console.error("❌ Error fatal:", error);
    throw error;
  }
}

// Ejecutar
if (require.main === module) {
  fixCategoriesV2()
    .then(() => {
      console.log("\n✅ Script completado exitosamente");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Script falló:", error);
      process.exit(1);
    });
}

module.exports = { fixCategoriesV2 };
