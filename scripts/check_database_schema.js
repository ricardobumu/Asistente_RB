// scripts/check_database_schema.js
// Script para verificar el esquema actual de la base de datos

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const supabase = require("../src/integrations/supabaseClient");

async function checkDatabaseSchema() {
  console.log("🔍 VERIFICANDO ESQUEMA DE BASE DE DATOS");
  console.log("=====================================");

  try {
    // Verificar tabla clients
    console.log("\n1️⃣ TABLA CLIENTS:");
    const { data: clientsData, error: clientsError } = await supabase
      .from("clients")
      .select("*")
      .limit(1);

    if (clientsError) {
      console.log("❌ Error accediendo a tabla clients:", clientsError.message);
    } else {
      console.log("✅ Tabla clients accesible");
      if (clientsData && clientsData.length > 0) {
        console.log("📋 Columnas disponibles:", Object.keys(clientsData[0]));
      } else {
        console.log(
          "📋 Tabla vacía, intentando insertar registro de prueba..."
        );

        // Intentar insertar con diferentes esquemas
        const testData1 = {
          full_name: "Test User",
          email: "test@example.com",
          phone: "123456789",
          is_active: true,
        };

        const { error: insertError1 } = await supabase
          .from("clients")
          .insert([testData1])
          .select();

        if (insertError1) {
          console.log("❌ Error con esquema full_name:", insertError1.message);

          // Probar con first_name/last_name
          const testData2 = {
            first_name: "Test",
            last_name: "User",
            email: "test2@example.com",
            phone: "123456789",
            is_active: true,
          };

          const { error: insertError2 } = await supabase
            .from("clients")
            .insert([testData2])
            .select();

          if (insertError2) {
            console.log(
              "❌ Error con esquema first_name/last_name:",
              insertError2.message
            );
          } else {
            console.log("✅ Esquema first_name/last_name funciona");
          }
        } else {
          console.log("✅ Esquema full_name funciona");
        }
      }
    }

    // Verificar tabla services
    console.log("\n2️⃣ TABLA SERVICES:");
    const { data: servicesData, error: servicesError } = await supabase
      .from("services")
      .select("*")
      .limit(5);

    if (servicesError) {
      console.log(
        "❌ Error accediendo a tabla services:",
        servicesError.message
      );
    } else {
      console.log("✅ Tabla services accesible");
      console.log("📊 Servicios encontrados:", servicesData.length);
      if (servicesData.length > 0) {
        console.log("📋 Columnas disponibles:", Object.keys(servicesData[0]));
        console.log("🔍 Primeros servicios:");
        servicesData.forEach((service) => {
          console.log(`  - ${service.name} (ID: ${service.id})`);
        });
      }
    }

    // Verificar tabla appointments
    console.log("\n3️⃣ TABLA APPOINTMENTS:");
    const { data: appointmentsData, error: appointmentsError } = await supabase
      .from("appointments")
      .select("*")
      .limit(3);

    if (appointmentsError) {
      console.log(
        "❌ Error accediendo a tabla appointments:",
        appointmentsError.message
      );
    } else {
      console.log("✅ Tabla appointments accesible");
      console.log("📊 Citas encontradas:", appointmentsData.length);
      if (appointmentsData.length > 0) {
        console.log(
          "📋 Columnas disponibles:",
          Object.keys(appointmentsData[0])
        );
      }
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
  checkDatabaseSchema()
    .then(() => {
      console.log("\n🎯 Script completado");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Script falló:", error.message);
      process.exit(1);
    });
}

module.exports = { checkDatabaseSchema };
