// scripts/testAdapter.js
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });

const DatabaseAdapter = require("../src/adapters/databaseAdapter");

async function testAdapter() {
  console.log("🧪 PROBANDO ADAPTADOR DE BASE DE DATOS\n");

  try {
    // Test 1: Listar servicios
    console.log("1️⃣ PROBANDO SERVICIOS:");
    const { data: services, error: servicesError } =
      await DatabaseAdapter.select("services");

    if (servicesError) {
      console.log(`❌ Error: ${servicesError.message}`);
    } else {
      console.log(`✅ Servicios encontrados: ${services?.length || 0}`);
      if (services?.length > 0) {
        console.log("📋 Primer servicio:", {
          id: services[0].service_id || services[0].id,
          name: services[0].name || services[0].nombre,
          price: services[0].price || services[0].precio,
        });
      }
    }

    // Test 2: Listar clientes
    console.log("\n2️⃣ PROBANDO CLIENTES:");
    const { data: clients, error: clientsError } =
      await DatabaseAdapter.select("clients");

    if (clientsError) {
      console.log(`❌ Error: ${clientsError.message}`);
    } else {
      console.log(`✅ Clientes encontrados: ${clients?.length || 0}`);
      if (clients?.length > 0) {
        console.log("📋 Primer cliente:", {
          id: clients[0].id,
          first_name: clients[0].first_name,
          phone: clients[0].phone,
        });
      }
    }

    // Test 3: Probar reservas
    console.log("\n3️⃣ PROBANDO RESERVAS:");
    const { data: bookings, error: bookingsError } =
      await DatabaseAdapter.select("bookings");

    if (bookingsError) {
      console.log(`❌ Error: ${bookingsError.message}`);
    } else {
      console.log(`✅ Reservas encontradas: ${bookings?.length || 0}`);
    }

    // Test 4: Acceso directo para verificar tablas
    console.log("\n4️⃣ VERIFICANDO TABLAS DIRECTAMENTE:");
    const directTables = ["clientes", "servicios", "reservas", "conversations"];

    for (const table of directTables) {
      try {
        const { data, error } = await DatabaseAdapter.client
          .from(table)
          .select("*")
          .limit(1);

        if (error) {
          console.log(`❌ ${table}: ${error.message}`);
        } else {
          console.log(`✅ ${table}: OK (${data?.length || 0} registros)`);
        }
      } catch (err) {
        console.log(`❌ ${table}: ${err.message}`);
      }
    }

    console.log("\n🎯 RESULTADO:");
    if (!servicesError && !clientsError) {
      console.log("✅ Adaptador funcionando correctamente");
      console.log("✅ El bot puede acceder a los datos");
      console.log("✅ Listo para producción");
    } else {
      console.log("❌ Hay problemas con el adaptador");
      console.log("🔧 Revisar configuración de RLS");
    }
  } catch (error) {
    console.error("❌ Error general:", error.message);
  }
}

testAdapter();
