// scripts/verifyExistingTables.js
// Verificar estructura de las tablas existentes en Supabase

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const supabase = require("../src/integrations/supabaseClient");

async function verifyExistingTables() {
  try {
    console.log("🔍 Verificando estructura de tablas existentes...\n");

    const tables = [
      "servicios",
      "clientes",
      "reservas",
      "appointments",
      "conversaciones",
      "conversations",
      "messages",
      "errores",
      "chatbot_settings",
      "solicitudes_soporte",
    ];

    for (const table of tables) {
      console.log(`📋 Tabla: ${table}`);

      try {
        // Intentar obtener un registro para ver la estructura
        const { data, error } = await supabase.from(table).select("*").limit(1);

        if (error) {
          console.log(`❌ Error: ${error.message}`);
        } else {
          console.log(`✅ Accesible`);
          if (data && data.length > 0) {
            console.log(`📊 Campos:`, Object.keys(data[0]).join(", "));
            console.log(`📈 Estado: Con datos (${data.length} registro)`);
          } else {
            console.log(`📊 Estado: Vacía pero funcional`);
          }
        }
      } catch (err) {
        console.log(`💥 Error: ${err.message}`);
      }

      console.log(""); // Línea en blanco
    }

    // Probar inserción de datos de prueba en servicios
    console.log("🧪 Probando inserción en tabla 'servicios'...\n");

    try {
      const { data: serviceData, error: serviceError } = await supabase
        .from("servicios")
        .insert({
          nombre: "Servicio de Prueba",
          descripcion: "Servicio de prueba para verificar funcionalidad",
          duracion: 60, // Campo correcto es 'duracion', no 'duracion_minutos'
          precio: 50.0,
          activo: true,
        })
        .select();

      if (serviceError) {
        console.log(`❌ Error insertando servicio: ${serviceError.message}`);
        console.log(`📝 Detalles:`, serviceError);
      } else {
        console.log(`✅ Servicio insertado correctamente:`, serviceData[0]?.id);

        // Limpiar datos de prueba
        if (serviceData && serviceData[0]) {
          await supabase
            .from("servicios")
            .delete()
            .eq("id_servicio", serviceData[0].id_servicio);

          console.log(`🧹 Datos de prueba limpiados`);
        }
      }
    } catch (err) {
      console.log(`💥 Error en prueba de inserción: ${err.message}`);
    }

    // Probar inserción en clientes
    console.log("\n🧪 Probando inserción en tabla 'clientes'...\n");

    try {
      const { data: clientData, error: clientError } = await supabase
        .from("clientes")
        .insert({
          nombre: "Cliente de Prueba",
          email: "test@example.com",
          telefono: "+34600000000",
        })
        .select();

      if (clientError) {
        console.log(`❌ Error insertando cliente: ${clientError.message}`);
        console.log(`📝 Detalles:`, clientError);
      } else {
        console.log(`✅ Cliente insertado correctamente:`, clientData[0]?.id);

        // Limpiar datos de prueba
        if (clientData && clientData[0]) {
          await supabase.from("clientes").delete().eq("id", clientData[0].id);

          console.log(`🧹 Datos de prueba limpiados`);
        }
      }
    } catch (err) {
      console.log(`💥 Error en prueba de inserción: ${err.message}`);
    }

    console.log("\n🎉 Verificación completada!");
  } catch (error) {
    console.error("💥 Error general:", error.message);
  }
}

// Ejecutar
if (require.main === module) {
  verifyExistingTables();
}

module.exports = { verifyExistingTables };
