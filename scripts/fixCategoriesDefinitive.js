// scripts/fixCategoriesDefinitive.js
// Script definitivo para corregir categorías usando SERVICE_KEY

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });

const { createClient } = require("@supabase/supabase-js");

async function fixCategoriesDefinitive() {
  console.log("🔧 CORRECCIÓN DEFINITIVA DE CATEGORÍAS - USANDO SERVICE_KEY");
  console.log("========================================================\n");

  // Usar SERVICE_KEY para operaciones administrativas
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
  );

  try {
    // 1. Obtener estado actual
    console.log("📊 Obteniendo estado actual...");
    const { data: services, error: fetchError } = await supabaseAdmin
      .from("servicios")
      .select("id_servicio, nombre, categoria")
      .order("categoria, nombre");

    if (fetchError) throw fetchError;

    console.log(`✅ ${services.length} servicios encontrados\n`);

    // 2. Agrupar por categoría actual
    const categoryGroups = {};
    services.forEach((service) => {
      if (!categoryGroups[service.categoria]) {
        categoryGroups[service.categoria] = [];
      }
      categoryGroups[service.categoria].push(service);
    });

    console.log("📋 Estado actual:");
    Object.entries(categoryGroups).forEach(([categoria, servicios]) => {
      const status = [
        "ASESORÍA",
        "COLORACIÓN",
        "CORTE",
        "TRATAMIENTO",
      ].includes(categoria)
        ? "✅"
        : "❌";
      console.log(`${status} ${categoria}: ${servicios.length} servicios`);
    });

    // 3. Definir correcciones específicas por ID
    const corrections = [
      // Asesoría → ASESORÍA
      { id: "c930e9c1-95f5-4c0c-a232-a9260a969b4e", newCategory: "ASESORÍA" },

      // Hidratación → TRATAMIENTO
      {
        id: "eddce199-8c88-437b-8789-f732de565908",
        newCategory: "TRATAMIENTO",
      },

      // tratamientos_capilares → TRATAMIENTO
      {
        id: "1d77fc2e-9eb5-41b0-b640-5d0836488a51",
        newCategory: "TRATAMIENTO",
      },
      {
        id: "4ce7e627-0a02-412f-90ab-d7cbfa7c9d99",
        newCategory: "TRATAMIENTO",
      },

      // cortes → CORTE
      { id: "97e0d1e5-9f01-46e3-a300-3c6da2ba4509", newCategory: "CORTE" },

      // coloracion → COLORACIÓN
      { id: "2d5d4beb-39d1-4fdf-a9e8-a93e78eeee5b", newCategory: "COLORACIÓN" },
      { id: "ab0af74b-eb45-4d7d-aa82-754b915fb16f", newCategory: "COLORACIÓN" },
      { id: "491828ba-edee-431b-bfec-fdb434a17d30", newCategory: "COLORACIÓN" },
      { id: "baf2e4c6-90d0-4418-9ef3-7617b47b5daa", newCategory: "COLORACIÓN" },
    ];

    console.log("\n🔄 Aplicando correcciones específicas...\n");

    let successCount = 0;
    let errorCount = 0;

    for (const correction of corrections) {
      const service = services.find((s) => s.id_servicio === correction.id);

      if (!service) {
        console.log(`⚠️ Servicio no encontrado: ${correction.id}`);
        continue;
      }

      console.log(`📝 ${service.nombre}`);
      console.log(`   ${service.categoria} → ${correction.newCategory}`);

      const { data, error } = await supabaseAdmin
        .from("servicios")
        .update({ categoria: correction.newCategory })
        .eq("id_servicio", correction.id)
        .select("id_servicio, nombre, categoria");

      if (error) {
        console.log(`   ❌ Error: ${error.message}`);
        errorCount++;
      } else {
        console.log(`   ✅ Actualizado correctamente`);
        successCount++;
      }
      console.log("");
    }

    // 4. Verificar resultado final
    console.log("🔍 Verificando resultado final...\n");

    const { data: finalServices, error: finalError } = await supabaseAdmin
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
      const status = [
        "ASESORÍA",
        "COLORACIÓN",
        "CORTE",
        "TRATAMIENTO",
      ].includes(cat)
        ? "✅"
        : "❌";
      console.log(`   ${status} ${cat}: ${count} servicios`);
    });

    // 5. Resultado final
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
    console.log(`✅ Servicios actualizados exitosamente: ${successCount}`);
    console.log(`❌ Errores durante actualización: ${errorCount}`);

    if (unexpectedCategories.length === 0) {
      console.log("\n🎉 ¡ÉXITO COMPLETO!");
      console.log("✅ Todas las categorías están normalizadas");
      console.log("✅ Solo existen las 4 categorías estándar");
      console.log("✅ El portal cliente funcionará perfectamente");

      // Mostrar distribución final
      console.log("\n📈 Distribución final:");
      expectedCategories.forEach((cat) => {
        const count = finalCategories[cat] || 0;
        console.log(`   ${cat}: ${count} servicios`);
      });
    } else {
      console.log("\n⚠️ Aún hay categorías no estándar:");
      unexpectedCategories.forEach((cat) => {
        console.log(`   - ${cat}: ${finalCategories[cat]} servicios`);
      });
    }
  } catch (error) {
    console.error("❌ Error fatal:", error);
    throw error;
  }
}

// Ejecutar
if (require.main === module) {
  fixCategoriesDefinitive()
    .then(() => {
      console.log("\n✅ Corrección definitiva completada");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Error en corrección definitiva:", error);
      process.exit(1);
    });
}

module.exports = { fixCategoriesDefinitive };
