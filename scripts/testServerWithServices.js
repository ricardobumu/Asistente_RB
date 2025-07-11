// scripts/testServerWithServices.js
// Probar el servidor con las nuevas rutas de servicios

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const axios = require("axios");

async function testServerWithServices() {
  try {
    console.log("🚀 PROBANDO SERVIDOR CON RUTAS DE SERVICIOS\n");
    console.log("=".repeat(50));

    const baseURL = `http://localhost:${process.env.PORT || 3000}`;

    // Test 1: Health check general
    console.log("📋 Test 1: Health check general");
    try {
      const healthResponse = await axios.get(`${baseURL}/health`);
      console.log(`✅ Servidor funcionando: ${healthResponse.data.status}`);
      console.log(`📊 Servicios:`, healthResponse.data.services);
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    console.log("");

    // Test 2: Health check API
    console.log("📋 Test 2: Health check API");
    try {
      const apiHealthResponse = await axios.get(`${baseURL}/api/health`);
      console.log(`✅ API funcionando: ${apiHealthResponse.data.success}`);
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    console.log("");

    // Test 3: Obtener todos los servicios
    console.log("📋 Test 3: GET /api/services/");
    try {
      const servicesResponse = await axios.get(`${baseURL}/api/services/`);
      console.log(
        `✅ Servicios obtenidos: ${servicesResponse.data.count} servicios`,
      );
      if (servicesResponse.data.data.length > 0) {
        const firstService = servicesResponse.data.data[0];
        console.log(
          `📌 Primer servicio: ${firstService.nombre} - €${firstService.precio}`,
        );
      }
    } catch (error) {
      console.log(`❌ Error: ${error.response?.data?.error || error.message}`);
    }
    console.log("");

    // Test 4: Obtener servicios activos
    console.log("📋 Test 4: GET /api/services/active");
    try {
      const activeResponse = await axios.get(`${baseURL}/api/services/active`);
      console.log(
        `✅ Servicios activos: ${activeResponse.data.count} servicios`,
      );
    } catch (error) {
      console.log(`❌ Error: ${error.response?.data?.error || error.message}`);
    }
    console.log("");

    // Test 5: Obtener estadísticas
    console.log("📋 Test 5: GET /api/services/stats");
    try {
      const statsResponse = await axios.get(`${baseURL}/api/services/stats`);
      console.log(`✅ Estadísticas obtenidas:`);
      console.log(`📊 Total: ${statsResponse.data.data.total}`);
      console.log(`📊 Activos: ${statsResponse.data.data.active}`);
      console.log(`📊 Categorías:`, statsResponse.data.data.categories);
    } catch (error) {
      console.log(`❌ Error: ${error.response?.data?.error || error.message}`);
    }
    console.log("");

    // Test 6: Obtener categorías válidas
    console.log("📋 Test 6: GET /api/services/categories");
    try {
      const categoriesResponse = await axios.get(
        `${baseURL}/api/services/categories`,
      );
      console.log(
        `✅ Categorías válidas:`,
        categoriesResponse.data.data.categories,
      );
    } catch (error) {
      console.log(`❌ Error: ${error.response?.data?.error || error.message}`);
    }
    console.log("");

    // Test 7: Buscar servicios
    console.log("📋 Test 7: GET /api/services/search?q=corte");
    try {
      const searchResponse = await axios.get(
        `${baseURL}/api/services/search?q=corte`,
      );
      console.log(
        `✅ Búsqueda exitosa: ${searchResponse.data.count} resultados`,
      );
    } catch (error) {
      console.log(`❌ Error: ${error.response?.data?.error || error.message}`);
    }
    console.log("");

    // Test 8: Listar con paginación
    console.log("📋 Test 8: GET /api/services/list?page=1&limit=3");
    try {
      const listResponse = await axios.get(
        `${baseURL}/api/services/list?page=1&limit=3`,
      );
      console.log(
        `✅ Lista paginada: ${listResponse.data.data.length} servicios`,
      );
      console.log(`📊 Paginación:`, listResponse.data.pagination);
    } catch (error) {
      console.log(`❌ Error: ${error.response?.data?.error || error.message}`);
    }
    console.log("");

    // Test 9: Obtener por categoría
    console.log("📋 Test 9: GET /api/services/category/CORTE");
    try {
      const categoryResponse = await axios.get(
        `${baseURL}/api/services/category/CORTE`,
      );
      console.log(
        `✅ Servicios de CORTE: ${categoryResponse.data.count} servicios`,
      );
    } catch (error) {
      console.log(`❌ Error: ${error.response?.data?.error || error.message}`);
    }
    console.log("");

    console.log("🎉 TODOS LOS TESTS DE SERVIDOR COMPLETADOS!");
  } catch (error) {
    console.error("💥 Error general en tests de servidor:", error.message);
  }
}

// Función para iniciar servidor temporalmente para tests
async function startServerForTests() {
  console.log("🔧 Iniciando servidor para tests...");

  // Importar y iniciar el servidor
  const app = require("../src/index");
  const PORT = process.env.PORT || 3000;

  return new Promise((resolve) => {
    const server = app.listen(PORT, () => {
      console.log(`✅ Servidor de prueba iniciado en puerto ${PORT}`);
      resolve(server);
    });
  });
}

// Ejecutar tests
if (require.main === module) {
  console.log(
    "⚠️  NOTA: Asegúrate de que el servidor esté ejecutándose en otro terminal:",
  );
  console.log("   npm start  o  node src/index.js\n");

  // Esperar un poco antes de ejecutar tests
  setTimeout(() => {
    testServerWithServices();
  }, 2000);
}

module.exports = { testServerWithServices };
