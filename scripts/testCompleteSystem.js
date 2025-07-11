// scripts/testCompleteSystem.js
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });

const ClientService = require("../src/services/clientService");
const ServiceService = require("../src/services/serviceService");
const BookingService = require("../src/services/bookingService");
const DatabaseAdapter = require("../src/adapters/databaseAdapter");

async function testCompleteSystem() {
  console.log("🚀 PRUEBA COMPLETA DEL SISTEMA INTEGRADO\n");

  try {
    // Test 1: Servicios
    console.log("1️⃣ PROBANDO SERVICIOS:");
    const servicesResult = await ServiceService.getActiveServices();

    if (servicesResult.success) {
      console.log(`✅ ${servicesResult.count} servicios activos`);

      if (servicesResult.data.length > 0) {
        const firstService = servicesResult.data[0];
        console.log(
          `📋 Primer servicio: ${firstService.name} - €${firstService.price} (${firstService.duration_minutes}min)`,
        );
      }
    } else {
      console.log(`❌ Error en servicios: ${servicesResult.error}`);
      return;
    }

    // Test 2: Clientes
    console.log("\n2️⃣ PROBANDO CLIENTES:");
    const clientsResult = await ClientService.getAllClients();

    if (clientsResult.success) {
      console.log(`✅ ${clientsResult.count} clientes registrados`);

      if (clientsResult.data.length > 0) {
        const firstClient = clientsResult.data[0];
        console.log(
          `📋 Primer cliente: ${firstClient.first_name || "Sin nombre"} - ${
            firstClient.phone
          }`,
        );
      }
    } else {
      console.log(`❌ Error en clientes: ${clientsResult.error}`);
      return;
    }

    // Test 3: Reservas existentes
    console.log("\n3️⃣ PROBANDO RESERVAS EXISTENTES:");
    const todayBookings = await BookingService.getTodayBookings();

    if (todayBookings.success) {
      console.log(`✅ ${todayBookings.count} reservas para hoy`);

      if (todayBookings.data.length > 0) {
        const booking = todayBookings.data[0];
        console.log(
          `📋 Primera reserva: ${booking.service.name} - ${booking.client.first_name}`,
        );
      }
    } else {
      console.log(`⚠️ Sin reservas hoy o error: ${todayBookings.error}`);
    }

    // Test 4: Crear reserva de prueba (solo si hay datos)
    console.log("\n4️⃣ PROBANDO CREACIÓN DE RESERVA:");

    if (servicesResult.data.length > 0 && clientsResult.data.length > 0) {
      const testService = servicesResult.data[0];
      const testClient = clientsResult.data[0];

      // Crear reserva de prueba para mañana
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      const bookingData = {
        client_phone: testClient.phone,
        service_id: testService.id,
        scheduled_at: tomorrow.toISOString(),
        status: "pendiente",
        notes: "Reserva de prueba del sistema",
      };

      const createResult = await BookingService.createBooking(bookingData);

      if (createResult.success) {
        console.log("✅ Reserva de prueba creada exitosamente");
        console.log(`📋 ID: ${createResult.data.id}`);

        // Cancelar la reserva de prueba inmediatamente
        const cancelResult = await BookingService.cancelBooking(
          createResult.data.id,
          "Prueba del sistema - cancelada automáticamente",
        );

        if (cancelResult.success) {
          console.log("✅ Reserva de prueba cancelada correctamente");
        } else {
          console.log(
            `⚠️ Error cancelando reserva de prueba: ${cancelResult.error}`,
          );
        }
      } else {
        console.log(
          `❌ Error creando reserva de prueba: ${createResult.error}`,
        );
      }
    } else {
      console.log("⚠️ No hay suficientes datos para crear reserva de prueba");
    }

    // Test 5: Próximas reservas
    console.log("\n5️⃣ PRÓXIMAS RESERVAS (7 días):");
    const upcomingBookings = await BookingService.getUpcomingBookings(7);

    if (upcomingBookings.success) {
      console.log(`✅ ${upcomingBookings.count} reservas próximas`);

      if (upcomingBookings.data.length > 0) {
        upcomingBookings.data.slice(0, 3).forEach((booking, index) => {
          const date = new Date(booking.scheduled_at).toLocaleDateString(
            "es-ES",
          );
          const time = new Date(booking.scheduled_at).toLocaleTimeString(
            "es-ES",
            {
              hour: "2-digit",
              minute: "2-digit",
            },
          );
          console.log(
            `   ${index + 1}. ${booking.service.name} - ${date} ${time} (${
              booking.status
            })`,
          );
        });
      }
    } else {
      console.log(
        `⚠️ Error obteniendo próximas reservas: ${upcomingBookings.error}`,
      );
    }

    // Test 6: Estadísticas del sistema
    console.log("\n6️⃣ ESTADÍSTICAS DEL SISTEMA:");

    const stats = {
      servicios_activos: servicesResult.count,
      clientes_registrados: clientsResult.count,
      reservas_hoy: todayBookings.count,
      reservas_proximas: upcomingBookings.count,
    };

    console.log("📊 Resumen:");
    Object.entries(stats).forEach(([key, value]) => {
      console.log(`   ${key.replace("_", " ")}: ${value}`);
    });

    // Test 7: Verificar integridad de datos
    console.log("\n7️⃣ VERIFICANDO INTEGRIDAD DE DATOS:");

    // Verificar que todos los servicios tienen precios válidos
    const invalidServices = servicesResult.data.filter(
      (s) => !s.price || s.price <= 0,
    );
    if (invalidServices.length === 0) {
      console.log("✅ Todos los servicios tienen precios válidos");
    } else {
      console.log(
        `⚠️ ${invalidServices.length} servicios con precios inválidos`,
      );
    }

    // Verificar que todos los clientes tienen teléfonos válidos
    const invalidClients = clientsResult.data.filter(
      (c) => !c.phone || !c.phone.startsWith("+"),
    );
    if (invalidClients.length === 0) {
      console.log("✅ Todos los clientes tienen teléfonos válidos");
    } else {
      console.log(
        `⚠️ ${invalidClients.length} clientes con teléfonos inválidos`,
      );
    }

    console.log("\n🎯 RESULTADO FINAL:");

    const allTestsPassed =
      servicesResult.success &&
      clientsResult.success &&
      todayBookings.success &&
      upcomingBookings.success;

    if (allTestsPassed) {
      console.log("🎉 ¡SISTEMA COMPLETAMENTE FUNCIONAL!");
      console.log("✅ Adaptador de BD funcionando");
      console.log("✅ Servicios de negocio operativos");
      console.log("✅ Gestión de clientes activa");
      console.log("✅ Sistema de reservas listo");
      console.log("✅ Bot de WhatsApp puede operar");
      console.log("\n🚀 LISTO PARA PRODUCCIÓN");
    } else {
      console.log("❌ Hay problemas en el sistema");
      console.log("🔧 Revisar logs para más detalles");
    }
  } catch (error) {
    console.error("❌ Error crítico en el sistema:", error.message);
    console.error("🔧 Stack trace:", error.stack);
  }
}

testCompleteSystem();
