// scripts/testAdaptedServices.js
// Probar el modelo de servicios adaptado

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const adaptedServiceModel = require("../src/models/adaptedServiceModel");

async function testAdaptedServices() {
  try {
    console.log("🧪 PROBANDO MODELO DE SERVICIOS ADAPTADO\n");
    console.log("=".repeat(50));

    // Test 1: Obtener todos los servicios
    console.log("📋 Test 1: Obtener todos los servicios");
    const allServicesResult = await adaptedServiceModel.getAll();

    if (allServicesResult.success) {
      console.log(
        `✅ Éxito: ${allServicesResult.data.length} servicios encontrados`,
      );
      if (allServicesResult.data.length > 0) {
        const firstService = allServicesResult.data[0];
        console.log(
          `📌 Primer servicio: ${firstService.nombre} - €${firstService.precio}`,
        );
      }
    } else {
      console.log(`❌ Error: ${allServicesResult.error}`);
    }
    console.log("");

    // Test 2: Obtener servicios activos
    console.log("📋 Test 2: Obtener servicios activos");
    const activeServicesResult = await adaptedServiceModel.getActive();

    if (activeServicesResult.success) {
      console.log(
        `✅ Éxito: ${activeServicesResult.data.length} servicios activos`,
      );
    } else {
      console.log(`❌ Error: ${activeServicesResult.error}`);
    }
    console.log("");

    // Test 3: Obtener estadísticas
    console.log("📋 Test 3: Obtener estadísticas");
    const statsResult = await adaptedServiceModel.getStats();

    if (statsResult.success) {
      console.log(`✅ Éxito: Estadísticas obtenidas`);
      console.log(`📊 Total: ${statsResult.data.total}`);
      console.log(`📊 Activos: ${statsResult.data.active}`);
      console.log(`📊 Inactivos: ${statsResult.data.inactive}`);
      console.log(`📊 Categorías:`, statsResult.data.categories);
    } else {
      console.log(`❌ Error: ${statsResult.error}`);
    }
    console.log("");

    // Test 4: Buscar por categoría (si hay servicios)
    if (allServicesResult.success && allServicesResult.data.length > 0) {
      const firstService = allServicesResult.data[0];
      const categoria = firstService.categoria;

      console.log(`📋 Test 4: Buscar por categoría "${categoria}"`);
      const categoryResult = await adaptedServiceModel.getByCategory(categoria);

      if (categoryResult.success) {
        console.log(
          `✅ Éxito: ${categoryResult.data.length} servicios en categoría ${categoria}`,
        );
      } else {
        console.log(`❌ Error: ${categoryResult.error}`);
      }
      console.log("");

      // Test 5: Obtener por ID
      const serviceId = firstService.id_servicio;
      console.log(`📋 Test 5: Obtener por ID "${serviceId}"`);
      const byIdResult = await adaptedServiceModel.getById(serviceId);

      if (byIdResult.success) {
        console.log(
          `✅ Éxito: Servicio encontrado - ${byIdResult.data.nombre}`,
        );
      } else {
        console.log(`❌ Error: ${byIdResult.error}`);
      }
      console.log("");

      // Test 6: Buscar por nombre
      const searchTerm = firstService.nombre.substring(0, 5);
      console.log(`📋 Test 6: Buscar por término "${searchTerm}"`);
      const searchResult = await adaptedServiceModel.searchByName(searchTerm);

      if (searchResult.success) {
        console.log(
          `✅ Éxito: ${searchResult.data.length} servicios encontrados`,
        );
      } else {
        console.log(`❌ Error: ${searchResult.error}`);
      }
      console.log("");
    }

    // Test 7: Listar con paginación
    console.log("📋 Test 7: Listar con paginación");
    const listResult = await adaptedServiceModel.list({
      page: 1,
      limit: 5,
      sortBy: "nombre",
      sortOrder: "asc",
    });

    if (listResult.success) {
      console.log(`✅ Éxito: ${listResult.data.length} servicios en página 1`);
      console.log(`📊 Paginación:`, listResult.pagination);
    } else {
      console.log(`❌ Error: ${listResult.error}`);
    }
    console.log("");

    // Test 8: Formateo de servicios
    if (allServicesResult.success && allServicesResult.data.length > 0) {
      console.log("📋 Test 8: Formateo de servicios");
      const rawService = allServicesResult.data[0];
      const formattedService = adaptedServiceModel.formatService(rawService);

      console.log("✅ Servicio formateado:");
      console.log(`📌 ID: ${formattedService.id}`);
      console.log(`📌 Nombre: ${formattedService.nombre}`);
      console.log(`📌 Precio: €${formattedService.precio}`);
      console.log(`📌 Duración: ${formattedService.duracion} min`);
      console.log(`📌 Categoría: ${formattedService.categoria}`);
      console.log(`📌 Activo: ${formattedService.activo}`);
      console.log("");
    }

    console.log("🎉 TODOS LOS TESTS COMPLETADOS!");
  } catch (error) {
    console.error("💥 Error general en tests:", error.message);
    console.error("📝 Stack:", error.stack);
  }
}

// Ejecutar
if (require.main === module) {
  testAdaptedServices();
}

module.exports = { testAdaptedServices };
