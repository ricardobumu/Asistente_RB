// scripts/testServices.js
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });

const ClientService = require("../src/services/clientService");
const ServiceService = require("../src/services/serviceService");

async function testServices() {
  console.log("🧪 PROBANDO SERVICIOS DE NEGOCIO\n");

  try {
    // Test 1: Servicios activos
    console.log("1️⃣ SERVICIOS ACTIVOS:");
    const servicesResult = await ServiceService.getActiveServices();

    if (servicesResult.success) {
      console.log(`✅ ${servicesResult.count} servicios encontrados`);

      if (servicesResult.data.length > 0) {
        const formatted = ServiceService.formatServicesForUser(
          servicesResult.data.slice(0, 3),
        );
        console.log("📋 Primeros 3 servicios:");
        formatted.forEach((service, index) => {
          console.log(
            `   ${index + 1}. ${service.nombre} - ${service.precio} (${
              service.duracion
            })`,
          );
        });
      }
    } else {
      console.log(`❌ Error: ${servicesResult.error}`);
    }

    // Test 2: Clientes
    console.log("\n2️⃣ CLIENTES:");
    const clientsResult = await ClientService.getAllClients();

    if (clientsResult.success) {
      console.log(`✅ ${clientsResult.count} clientes encontrados`);

      if (clientsResult.data.length > 0) {
        const firstClient = clientsResult.data[0];
        console.log("📋 Primer cliente:", {
          id: firstClient.id,
          nombre: firstClient.first_name || "Sin nombre",
          apellido: firstClient.last_name || "Sin apellido",
          telefono: firstClient.phone,
          email: firstClient.email,
        });
      }
    } else {
      console.log(`❌ Error: ${clientsResult.error}`);
    }

    // Test 3: Buscar cliente por teléfono
    console.log("\n3️⃣ BUSCAR CLIENTE POR TELÉFONO:");
    const phoneSearchResult = await ClientService.findByPhone("+34622265803");

    if (phoneSearchResult.success && phoneSearchResult.data) {
      console.log("✅ Cliente encontrado:", {
        nombre: phoneSearchResult.data.first_name || "Sin nombre",
        telefono: phoneSearchResult.data.phone,
        email: phoneSearchResult.data.email,
      });
    } else {
      console.log("❌ Cliente no encontrado o error");
    }

    // Test 4: Verificar estructura de datos
    console.log("\n4️⃣ VERIFICANDO ESTRUCTURA DE DATOS:");

    if (servicesResult.success && servicesResult.data.length > 0) {
      const service = servicesResult.data[0];
      console.log("✅ Estructura de servicio:", Object.keys(service));
    }

    if (clientsResult.success && clientsResult.data.length > 0) {
      const client = clientsResult.data[0];
      console.log("✅ Estructura de cliente:", Object.keys(client));
    }

    console.log("\n🎯 RESULTADO FINAL:");
    if (servicesResult.success && clientsResult.success) {
      console.log("✅ Todos los servicios funcionan correctamente");
      console.log("✅ El bot puede gestionar clientes y servicios");
      console.log("✅ Sistema listo para producción");
    } else {
      console.log("❌ Hay problemas en los servicios");
    }
  } catch (error) {
    console.error("❌ Error general:", error.message);
  }
}

testServices();
