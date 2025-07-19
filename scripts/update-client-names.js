/**
 * SCRIPT PARA ACTUALIZAR NOMBRES DE CLIENTES
 *
 * Extrae el primer nombre del full_name y lo guarda en el campo 'name'
 * para hacer las interacciones del bot más naturales y personales.
 *
 * Funcionalidades:
 * - Extrae el primer nombre del campo full_name
 * - Maneja nombres compuestos y caracteres especiales
 * - Normaliza mayúsculas/minúsculas para un formato consistente
 * - Actualiza solo clientes que no tengan el campo 'name' configurado
 *
 * Autor: Asistente RB - Ricardo Buriticá Beauty Consulting
 * Fecha: 2025-01-18
 */

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const { createClient } = require("@supabase/supabase-js");

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "❌ ERROR: Variables de entorno SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridas"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Extrae el primer nombre de un nombre completo
 * @param {string} fullName - Nombre completo del cliente
 * @returns {string} - Primer nombre normalizado
 */
function extractFirstName(fullName) {
  if (!fullName || typeof fullName !== "string") {
    return "";
  }

  // Limpiar y normalizar el nombre
  let cleanName = fullName
    .trim()
    .replace(/\s+/g, " ") // Múltiples espacios a uno solo
    .replace(/[^\w\sáéíóúüñç]/gi, " ") // Remover caracteres especiales excepto acentos
    .trim();

  if (!cleanName) {
    return "";
  }

  // Dividir por espacios y tomar el primer elemento
  const nameParts = cleanName.split(" ");
  let firstName = nameParts[0];

  // Normalizar capitalización: Primera letra mayúscula, resto minúsculas
  firstName =
    firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

  // Casos especiales para nombres compuestos comunes
  const compoundNames = {
    Maria: ["MARIA", "MARÍA"],
    Ana: ["ANA"],
    Jose: ["JOSE", "JOSÉ"],
    Juan: ["JUAN"],
    Luis: ["LUIS"],
    Carmen: ["CARMEN"],
  };

  // Si es un nombre compuesto común, verificar si el siguiente también lo es
  if (nameParts.length > 1) {
    const secondName =
      nameParts[1].charAt(0).toUpperCase() +
      nameParts[1].slice(1).toLowerCase();

    // Casos especiales de nombres compuestos
    if (
      firstName === "Maria" &&
      [
        "Jose",
        "José",
        "Teresa",
        "Carmen",
        "Luisa",
        "Angeles",
        "Eugenia",
        "Belen",
        "Belén",
      ].includes(secondName)
    ) {
      return `${firstName} ${secondName}`;
    }
    if (
      firstName === "Ana" &&
      ["Maria", "María", "Carolina", "Elisa"].includes(secondName)
    ) {
      return `${firstName} ${secondName}`;
    }
    if (firstName === "Jose" && ["Maria", "María"].includes(secondName)) {
      return `${firstName} ${secondName}`;
    }
    if (
      firstName === "Juan" &&
      ["Carlos", "Manuel", "Antonio"].includes(secondName)
    ) {
      return `${firstName} ${secondName}`;
    }
  }

  return firstName;
}

/**
 * Función principal para actualizar nombres de clientes
 */
async function updateClientNames() {
  console.log("🚀 INICIANDO ACTUALIZACIÓN DE NOMBRES DE CLIENTES");
  console.log("=".repeat(65));
  console.log(`📅 Fecha: ${new Date().toLocaleString("es-ES")}`);
  console.log(`🗄️ Base de datos: ${supabaseUrl}`);
  console.log("=".repeat(65));

  try {
    // Verificar conexión a Supabase
    console.log("🔗 Verificando conexión a Supabase...");
    const { data: testData, error: testError } = await supabase
      .from("clients")
      .select("count")
      .limit(1);

    if (testError) {
      throw new Error(`Error de conexión: ${testError.message}`);
    }
    console.log("✅ Conexión a Supabase exitosa");

    // Obtener todos los clientes
    console.log("📂 Obteniendo clientes de la base de datos...");
    const { data: clients, error: fetchError } = await supabase
      .from("clients")
      .select("id, email, full_name, name")
      .order("created_at", { ascending: false });

    if (fetchError) {
      throw new Error(`Error obteniendo clientes: ${fetchError.message}`);
    }

    console.log(`📊 Total de clientes encontrados: ${clients.length}`);
    console.log("");

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails = [];

    console.log("🔄 Procesando nombres de clientes...");
    console.log("");

    // Procesar cada cliente
    for (const client of clients) {
      processed++;

      try {
        // Verificar si ya tiene un nombre configurado y es diferente del full_name
        const hasValidName =
          client.name &&
          client.name.trim() !== "" &&
          client.name !== client.full_name &&
          client.name !== "nan" &&
          client.name !== "null";

        if (hasValidName) {
          console.log(
            `⏭️  ${client.email}: Ya tiene nombre configurado (${client.name})`
          );
          skipped++;
          continue;
        }

        // Extraer primer nombre
        const firstName = extractFirstName(client.full_name);

        if (!firstName) {
          console.log(
            `⚠️  ${client.email}: No se pudo extraer nombre de "${client.full_name}"`
          );
          skipped++;
          continue;
        }

        // Actualizar en la base de datos
        const { error: updateError } = await supabase
          .from("clients")
          .update({ name: firstName })
          .eq("id", client.id);

        if (updateError) {
          throw new Error(`Error actualizando: ${updateError.message}`);
        }

        console.log(
          `✅ ${client.email}: "${client.full_name}" → "${firstName}"`
        );
        updated++;

        // Pausa pequeña para no sobrecargar la base de datos
        if (processed % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.log(`❌ ${client.email}: Error - ${error.message}`);
        errors++;
        errorDetails.push({
          email: client.email,
          error: error.message,
        });
      }
    }

    // Estadísticas finales
    console.log("");
    console.log("=".repeat(65));
    console.log("📊 ESTADÍSTICAS FINALES");
    console.log("=".repeat(65));
    console.log(`📝 Total de clientes procesados: ${processed}`);
    console.log(`✅ Nombres actualizados: ${updated}`);
    console.log(`⏭️  Clientes omitidos (ya tenían nombre): ${skipped}`);
    console.log(`❌ Errores: ${errors}`);

    if (errorDetails.length > 0) {
      console.log("");
      console.log("📋 DETALLE DE ERRORES:");
      errorDetails.forEach((error, index) => {
        console.log(`${index + 1}. ${error.email}: ${error.error}`);
      });
    }

    console.log("");
    console.log("=".repeat(65));
    console.log("✅ PROCESO COMPLETADO EXITOSAMENTE");
  } catch (error) {
    console.error("❌ ERROR CRÍTICO:", error.message);
    process.exit(1);
  }
}

// Ejecutar el script
updateClientNames();
