// scripts/check_table_schema.js
// Script para verificar el esquema real de las tablas en Supabase

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const supabase = require("../src/integrations/supabaseClient");

async function checkTableSchema() {
  console.log("🔍 VERIFICANDO ESQUEMA DE TABLAS EN SUPABASE");
  console.log("============================================");

  try {
    // 1. Verificar tabla clients
    console.log("\n1️⃣ TABLA CLIENTS:");
    console.log("------------------");

    const { data: clientsData, error: clientsError } = await supabase
      .from("clients")
      .select("*")
      .limit(1);

    if (clientsError) {
      console.log(`❌ Error accediendo a clients: ${clientsError.message}`);
    } else if (clientsData && clientsData.length > 0) {
      const sampleClient = clientsData[0];
      console.log("✅ Campos disponibles en clients:");
      Object.keys(sampleClient).forEach((field) => {
        console.log(
          `  - ${field}: ${typeof sampleClient[field]} (${sampleClient[field]})`
        );
      });
    } else {
      console.log(
        "⚠️ Tabla clients está vacía, intentando crear un registro de prueba..."
      );

      const testClient = {
        full_name: "Test Client",
        email: "test@example.com",
        phone: "123456789",
      };

      const { data: insertData, error: insertError } = await supabase
        .from("clients")
        .insert([testClient])
        .select()
        .single();

      if (insertError) {
        console.log(
          `❌ Error creando cliente de prueba: ${insertError.message}`
        );
        console.log("Detalles del error:", insertError);
      } else {
        console.log("✅ Cliente de prueba creado. Campos disponibles:");
        Object.keys(insertData).forEach((field) => {
          console.log(`  - ${field}: ${typeof insertData[field]}`);
        });

        // Eliminar el cliente de prueba
        await supabase.from("clients").delete().eq("id", insertData.id);
        console.log("🗑️ Cliente de prueba eliminado");
      }
    }

    // 2. Verificar tabla services
    console.log("\n2️⃣ TABLA SERVICES:");
    console.log("-------------------");

    const { data: servicesData, error: servicesError } = await supabase
      .from("services")
      .select("*")
      .limit(1);

    if (servicesError) {
      console.log(`❌ Error accediendo a services: ${servicesError.message}`);
    } else if (servicesData && servicesData.length > 0) {
      const sampleService = servicesData[0];
      console.log("✅ Campos disponibles en services:");
      Object.keys(sampleService).forEach((field) => {
        console.log(`  - ${field}: ${typeof sampleService[field]}`);
      });
    } else {
      console.log("⚠️ Tabla services está vacía");
    }

    // 3. Verificar tabla appointments
    console.log("\n3️⃣ TABLA APPOINTMENTS:");
    console.log("----------------------");

    const { data: appointmentsData, error: appointmentsError } = await supabase
      .from("appointments")
      .select("*")
      .limit(1);

    if (appointmentsError) {
      console.log(
        `❌ Error accediendo a appointments: ${appointmentsError.message}`
      );
    } else if (appointmentsData && appointmentsData.length > 0) {
      const sampleAppointment = appointmentsData[0];
      console.log("✅ Campos disponibles en appointments:");
      Object.keys(sampleAppointment).forEach((field) => {
        console.log(`  - ${field}: ${typeof sampleAppointment[field]}`);
      });
    } else {
      console.log("⚠️ Tabla appointments está vacía");
    }

    console.log("\n✅ VERIFICACIÓN COMPLETADA");
  } catch (error) {
    console.error("\n💥 ERROR EN VERIFICACIÓN:");
    console.error("Mensaje:", error.message);
    console.error("Stack:", error.stack);
  }
}

// Ejecutar verificación
if (require.main === module) {
  checkTableSchema()
    .then(() => {
      console.log("\n🎯 Script completado");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Script falló:", error.message);
      process.exit(1);
    });
}

module.exports = { checkTableSchema };
