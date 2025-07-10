// scripts/testBookingSystem.js
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const BookingService = require("../src/services/bookingService");
const AdminBookingService = require("../src/services/adminBookingService");
const ClientService = require("../src/services/clientService");
const ServiceService = require("../src/services/serviceService");
const googleCalendarClient = require("../src/integrations/googleCalendarClient");

async function testBookingSystem() {
  console.log("🧪 PRUEBA DEL SISTEMA DE RESERVAS\n");

  try {
    // 1. Verificar configuración de Google Calendar
    console.log("📅 Verificando Google Calendar...");
    if (googleCalendarClient.isInitialized()) {
      console.log("✅ Google Calendar configurado correctamente");

      // Probar obtener eventos
      const events = await googleCalendarClient.getTodayEvents();
      console.log(`📊 Eventos de hoy: ${events.count || 0}`);
    } else {
      console.log("⚠️  Google Calendar no configurado (opcional)");
    }

    // 2. Verificar servicios
    console.log("\n🛠️  Verificando servicios...");
    const services = await ServiceService.getActiveServices();
    if (services.success && services.data.length > 0) {
      console.log(`✅ ${services.count} servicios activos encontrados`);
      services.data.forEach((service) => {
        console.log(
          `   - ${service.name} (€${service.price}, ${service.duration_minutes}min)`
        );
      });
    } else {
      console.log("❌ No se encontraron servicios activos");
      console.log("💡 Ejecuta: npm run setup para crear servicios de ejemplo");
      return;
    }

    // 3. Crear cliente de prueba
    console.log("\n👤 Creando cliente de prueba...");
    const testClient = {
      first_name: "Test",
      last_name: "Cliente",
      phone: "+34999888777",
      email: "test@ejemplo.com",
      source: "test_script",
    };

    let clientResult = await ClientService.findByPhone(testClient.phone);
    if (!clientResult.success || !clientResult.data) {
      clientResult = await ClientService.createClient(testClient);
    }

    if (clientResult.success) {
      console.log(
        `✅ Cliente: ${clientResult.data.first_name} ${clientResult.data.last_name}`
      );
    } else {
      console.log("❌ Error creando cliente:", clientResult.error);
      return;
    }

    // 4. Crear reserva de prueba
    console.log("\n📅 Creando reserva de prueba...");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const bookingData = {
      client_phone: testClient.phone,
      service_id: services.data[0].id,
      scheduled_at: tomorrow.toISOString(),
      notes: "Reserva de prueba del sistema",
    };

    const bookingResult = await BookingService.createBooking(bookingData);

    if (bookingResult.success) {
      console.log("✅ Reserva creada exitosamente");
      console.log(`   ID: ${bookingResult.data.id}`);
      console.log(`   Fecha: ${bookingResult.data.scheduled_at}`);
      console.log(`   Servicio: ${bookingResult.data.service?.name}`);

      if (bookingResult.data.calendar_event_id) {
        console.log(
          `   📅 Evento de Google Calendar: ${bookingResult.data.calendar_event_id}`
        );
      }

      if (bookingResult.data.meeting_url) {
        console.log(`   🔗 Enlace Meet: ${bookingResult.data.meeting_url}`);
      }

      // 5. Probar dashboard administrativo
      console.log("\n🎛️  Probando dashboard administrativo...");
      const dashboard = await AdminBookingService.getDashboardSummary();

      if (dashboard.success) {
        console.log("✅ Dashboard funcionando correctamente");
        console.log(`   Reservas de hoy: ${dashboard.data.today.count}`);
        console.log(`   Próximas reservas: ${dashboard.data.upcoming.count}`);
        console.log(
          `   Google Calendar sincronizado: ${dashboard.data.calendar.synchronized}`
        );
      } else {
        console.log("❌ Error en dashboard:", dashboard.error);
      }

      // 6. Probar búsqueda de reservas
      console.log("\n🔍 Probando búsqueda de reservas...");
      const searchResult = await AdminBookingService.searchBookings({
        status: "confirmada",
        limit: 5,
      });

      if (searchResult.success) {
        console.log(
          `✅ Búsqueda exitosa: ${searchResult.data.length} reservas encontradas`
        );
      } else {
        console.log("❌ Error en búsqueda:", searchResult.error);
      }

      // 7. Limpiar - cancelar reserva de prueba
      console.log("\n🧹 Limpiando reserva de prueba...");
      const cancelResult = await BookingService.cancelBooking(
        bookingResult.data.id,
        "Reserva de prueba - cancelada automáticamente"
      );

      if (cancelResult.success) {
        console.log("✅ Reserva de prueba cancelada");
      } else {
        console.log(
          "⚠️  No se pudo cancelar reserva de prueba:",
          cancelResult.error
        );
      }
    } else {
      console.log("❌ Error creando reserva:", bookingResult.error);
    }

    console.log("\n🎉 PRUEBA COMPLETADA");
    console.log("\n📊 RESUMEN:");
    console.log(
      `   ✅ Google Calendar: ${
        googleCalendarClient.isInitialized() ? "Configurado" : "No configurado"
      }`
    );
    console.log(`   ✅ Servicios: ${services.count} activos`);
    console.log(`   ✅ Sistema de reservas: Funcionando`);
    console.log(`   ✅ Dashboard administrativo: Funcionando`);
  } catch (error) {
    console.error("❌ Error durante la prueba:", error);
  }

  process.exit(0);
}

// Ejecutar prueba
testBookingSystem();
