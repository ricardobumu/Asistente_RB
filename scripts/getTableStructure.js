// scripts/getTableStructure.js
// Obtener estructura detallada de las tablas principales

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const supabase = require("../src/integrations/supabaseClient");

async function getTableStructure() {
  try {
    console.log(
      "🔍 Obteniendo estructura detallada de tablas principales...\n",
    );

    const mainTables = ["servicios", "clientes", "reservas", "appointments"];

    for (const table of mainTables) {
      console.log(`📋 TABLA: ${table.toUpperCase()}`);
      console.log("=".repeat(50));

      try {
        // Intentar insertar un registro vacío para ver qué campos son requeridos
        const { data, error } = await supabase.from(table).insert({}).select();

        if (error) {
          console.log(`📝 Campos requeridos detectados:`);
          console.log(`❌ Error: ${error.message}`);

          // Analizar el mensaje de error para extraer campos requeridos
          if (error.message.includes("null value in column")) {
            const match = error.message.match(/null value in column "([^"]+)"/);
            if (match) {
              console.log(`🔴 Campo requerido: ${match[1]}`);
            }
          }
        }

        // Intentar obtener un registro existente para ver la estructura
        const { data: existingData, error: selectError } = await supabase
          .from(table)
          .select("*")
          .limit(1);

        if (!selectError && existingData && existingData.length > 0) {
          console.log(`✅ Estructura de campos:`);
          const fields = Object.keys(existingData[0]);
          fields.forEach((field) => {
            const value = existingData[0][field];
            const type = typeof value;
            console.log(`  📌 ${field}: ${type} = ${value}`);
          });
        } else if (!selectError) {
          console.log(`📊 Tabla vacía pero accesible`);
        }
      } catch (err) {
        console.log(`💥 Error: ${err.message}`);
      }

      console.log("\n");
    }

    // Probar inserción con campos mínimos en clientes
    console.log("🧪 PROBANDO INSERCIÓN EN CLIENTES...\n");

    const clientTestCases = [
      // Caso 1: Solo nombre
      { nombre: "Test Cliente 1" },

      // Caso 2: Nombre y email
      { nombre: "Test Cliente 2", email: "test2@example.com" },

      // Caso 3: Campos comunes
      {
        nombre: "Test Cliente 3",
        email: "test3@example.com",
        phone: "+34600000000",
      },

      // Caso 4: Con teléfono alternativo
      {
        nombre: "Test Cliente 4",
        email: "test4@example.com",
        telefono: "+34600000001",
      },
    ];

    for (let i = 0; i < clientTestCases.length; i++) {
      const testData = clientTestCases[i];
      console.log(`Caso ${i + 1}: ${JSON.stringify(testData)}`);

      try {
        const { data: clientData, error: clientError } = await supabase
          .from("clientes")
          .insert(testData)
          .select();

        if (clientError) {
          console.log(`❌ Error: ${clientError.message}`);
        } else {
          console.log(
            `✅ Éxito: Cliente creado con ID ${clientData[0]?.id || "N/A"}`,
          );

          // Limpiar inmediatamente
          if (clientData && clientData[0]) {
            const idField = Object.keys(clientData[0]).find((key) =>
              key.includes("id"),
            );
            if (idField) {
              await supabase
                .from("clientes")
                .delete()
                .eq(idField, clientData[0][idField]);
              console.log(`🧹 Limpiado`);
            }
          }
        }
      } catch (err) {
        console.log(`💥 Error: ${err.message}`);
      }

      console.log("");
    }

    console.log("🎉 Análisis de estructura completado!");
  } catch (error) {
    console.error("💥 Error general:", error.message);
  }
}

// Ejecutar
if (require.main === module) {
  getTableStructure();
}

module.exports = { getTableStructure };
