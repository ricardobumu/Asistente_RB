// scripts/createBasicTables.js
// Crear tablas básicas directamente usando Supabase client

// Cargar variables de entorno de forma segura
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const supabase = require("../src/integrations/supabaseClient");

async function createBasicTables() {
  try {
    console.log("🚀 Creando tablas básicas en Supabase...\n");

    // Primero, vamos a crear las tablas usando INSERT directo
    // Esto nos permitirá verificar si podemos crear datos

    console.log("📋 Intentando crear tabla 'services' con datos...");

    // Intentar insertar un servicio básico
    const { data: serviceData, error: serviceError } = await supabase
      .from("services")
      .insert({
        name: "Consulta General",
        description: "Consulta médica general",
        duration_minutes: 30,
        price: 40.0,
        active: true,
        created_at: new Date().toISOString(),
      })
      .select();

    if (serviceError) {
      console.log(`❌ Error creando servicio: ${serviceError.message}`);
      console.log("📝 Detalles del error:", serviceError);
    } else {
      console.log(`✅ Servicio creado exitosamente:`, serviceData);
    }

    console.log("\n📋 Intentando crear tabla 'clients' con datos...");

    // Intentar insertar un cliente básico
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .insert({
        email: "test@example.com",
        name: "Cliente de Prueba",
        phone: "+34600000000",
        created_at: new Date().toISOString(),
      })
      .select();

    if (clientError) {
      console.log(`❌ Error creando cliente: ${clientError.message}`);
      console.log("📝 Detalles del error:", clientError);
    } else {
      console.log(`✅ Cliente creado exitosamente:`, clientData);
    }

    console.log("\n📋 Intentando crear tabla 'bookings' con datos...");

    // Solo si tenemos cliente y servicio
    if (serviceData && clientData) {
      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          client_id: clientData[0].id,
          service_id: serviceData[0].id,
          start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Mañana
          end_time: new Date(
            Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000
          ).toISOString(), // Mañana + 30 min
          status: "pending",
          created_at: new Date().toISOString(),
        })
        .select();

      if (bookingError) {
        console.log(`❌ Error creando reserva: ${bookingError.message}`);
        console.log("📝 Detalles del error:", bookingError);
      } else {
        console.log(`✅ Reserva creada exitosamente:`, bookingData);
      }
    }

    console.log("\n📋 Intentando crear tabla 'notifications' con datos...");

    const { data: notificationData, error: notificationError } = await supabase
      .from("notifications")
      .insert({
        title: "Notificación de Prueba",
        message: "Esta es una notificación de prueba del sistema",
        type: "system_alert",
        read: false,
        created_at: new Date().toISOString(),
      })
      .select();

    if (notificationError) {
      console.log(
        `❌ Error creando notificación: ${notificationError.message}`
      );
      console.log("📝 Detalles del error:", notificationError);
    } else {
      console.log(`✅ Notificación creada exitosamente:`, notificationData);
    }

    console.log("\n🎉 Proceso de creación de tablas completado!");
  } catch (error) {
    console.error("💥 Error general:", error.message);
    console.error("📝 Stack trace:", error.stack);
  }
}

// Función para limpiar datos de prueba
async function cleanupTestData() {
  try {
    console.log("🧹 Limpiando datos de prueba...");

    // Limpiar en orden inverso por las dependencias
    await supabase.from("bookings").delete().eq("status", "pending");
    await supabase.from("notifications").delete().eq("type", "system_alert");
    await supabase.from("clients").delete().eq("email", "test@example.com");
    await supabase.from("services").delete().eq("name", "Consulta General");

    console.log("✅ Datos de prueba limpiados");
  } catch (error) {
    console.error("❌ Error limpiando datos:", error.message);
  }
}

// Ejecutar
if (require.main === module) {
  createBasicTables();
}

module.exports = { createBasicTables, cleanupTestData };
