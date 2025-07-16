// scripts/clean_duplicate_services.js
// Script para limpiar servicios duplicados en Supabase

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const supabase = require("../src/integrations/supabaseClient");

async function cleanDuplicateServices() {
  console.log("🧹 LIMPIANDO SERVICIOS DUPLICADOS");
  console.log("=================================");

  try {
    // 1. Obtener todos los servicios
    console.log("\n1️⃣ Obteniendo todos los servicios...");
    const { data: allServices, error: fetchError } = await supabase
      .from("services")
      .select("*")
      .order("created_at", { ascending: true });

    if (fetchError) {
      throw new Error(`Error obteniendo servicios: ${fetchError.message}`);
    }

    console.log(`📊 Total servicios encontrados: ${allServices.length}`);

    // 2. Identificar duplicados por nombre
    const servicesByName = {};
    const duplicates = [];
    const toKeep = [];

    allServices.forEach((service) => {
      const key = service.name.toLowerCase().trim();

      if (!servicesByName[key]) {
        servicesByName[key] = [];
      }
      servicesByName[key].push(service);
    });

    // 3. Procesar duplicados
    Object.entries(servicesByName).forEach(([name, services]) => {
      if (services.length > 1) {
        console.log(
          `🔍 Duplicados encontrados para "${name}": ${services.length} servicios`
        );

        // Mantener el más antiguo (primer creado)
        const oldest = services[0];
        const duplicatesToDelete = services.slice(1);

        toKeep.push(oldest);
        duplicates.push(...duplicatesToDelete);

        console.log(`  ✅ Mantener: ID ${oldest.id} (${oldest.created_at})`);
        duplicatesToDelete.forEach((dup) => {
          console.log(`  ❌ Eliminar: ID ${dup.id} (${dup.created_at})`);
        });
      } else {
        toKeep.push(services[0]);
      }
    });

    console.log(`\n📈 RESUMEN:`);
    console.log(`  - Servicios únicos a mantener: ${toKeep.length}`);
    console.log(`  - Servicios duplicados a eliminar: ${duplicates.length}`);

    // 4. Eliminar duplicados
    if (duplicates.length > 0) {
      console.log(
        `\n2️⃣ Eliminando ${duplicates.length} servicios duplicados...`
      );

      for (const duplicate of duplicates) {
        const { error: deleteError } = await supabase
          .from("services")
          .delete()
          .eq("id", duplicate.id);

        if (deleteError) {
          console.log(
            `❌ Error eliminando servicio ${duplicate.id}: ${deleteError.message}`
          );
        } else {
          console.log(`✅ Eliminado: ${duplicate.name} (ID: ${duplicate.id})`);
        }
      }
    } else {
      console.log("\n✅ No se encontraron servicios duplicados");
    }

    // 5. Verificar resultado final
    console.log("\n3️⃣ Verificando resultado...");
    const { data: finalServices, error: finalError } = await supabase
      .from("services")
      .select("id, name, category, is_active")
      .order("category", { ascending: true });

    if (finalError) {
      throw new Error(`Error verificando resultado: ${finalError.message}`);
    }

    console.log(`\n📊 SERVICIOS FINALES (${finalServices.length}):`);
    const servicesByCategory = {};

    finalServices.forEach((service) => {
      if (!servicesByCategory[service.category]) {
        servicesByCategory[service.category] = [];
      }
      servicesByCategory[service.category].push(service);
    });

    Object.entries(servicesByCategory).forEach(([category, services]) => {
      console.log(`\n📂 ${category.toUpperCase()}:`);
      services.forEach((service) => {
        const status = service.is_active ? "✅" : "❌";
        console.log(`  ${status} ${service.name} (ID: ${service.id})`);
      });
    });

    console.log("\n✅ LIMPIEZA COMPLETADA");
  } catch (error) {
    console.error("\n💥 ERROR EN LIMPIEZA:");
    console.error("Mensaje:", error.message);
    console.error("Stack:", error.stack);
  }
}

// Ejecutar limpieza
if (require.main === module) {
  cleanDuplicateServices()
    .then(() => {
      console.log("\n🎯 Script completado");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Script falló:", error.message);
      process.exit(1);
    });
}

module.exports = { cleanDuplicateServices };
