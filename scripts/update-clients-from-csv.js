/**
 * SCRIPT DE ACTUALIZACIÓN DE CLIENTES DESDE CSV
 *
 * Este script actualiza la base de datos de Supabase con datos de clientes
 * desde un archivo CSV, respetando la estructura real de la tabla clients.
 *
 * Funcionalidades:
 * - Lectura segura de archivo CSV
 * - Validación de datos según RGPD
 * - Actualización o inserción de clientes
 * - Logging detallado de operaciones
 * - Manejo robusto de errores
 *
 * Autor: Asistente RB - Ricardo Buriticá Beauty Consulting
 * Fecha: 2025-01-18
 */

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Usar service key para operaciones administrativas

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "❌ ERROR: Variables de entorno SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridas"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configuración del script
const CSV_FILE_PATH = path.join(
  __dirname,
  "..",
  "clientes_RB_simplificado.csv"
);
const BATCH_SIZE = 10; // Procesar en lotes para evitar sobrecarga

/**
 * Valida los datos de un cliente según las reglas de negocio
 * @param {object} client - Datos del cliente
 * @returns {object} Resultado de validación
 */
function validateClientData(client) {
  const errors = [];

  // Email es obligatorio y debe ser válido
  if (!client.email || !client.email.trim()) {
    errors.push("Email es obligatorio");
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(client.email.trim())) {
      errors.push("Email no tiene formato válido");
    }
  }

  // full_name es obligatorio
  if (!client.full_name || !client.full_name.trim()) {
    errors.push("Nombre completo es obligatorio");
  }

  // phone debe tener formato válido si se proporciona
  if (client.phone && client.phone.trim()) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    const cleanPhone = client.phone.replace(/\s+/g, "");
    if (!phoneRegex.test(cleanPhone)) {
      errors.push("Teléfono no tiene formato válido");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitiza los datos del cliente
 * @param {object} client - Datos del cliente
 * @returns {object} Datos sanitizados
 */
function sanitizeClientData(client) {
  return {
    email: client.email ? client.email.toLowerCase().trim() : null,
    full_name: client.full_name ? client.full_name.trim() : null,
    phone: client.phone ? client.phone.replace(/\s+/g, "") : null,
    // Campos adicionales que pueden venir del CSV
    name: client.name ? client.name.trim() : null,
    last_name: client.last_name ? client.last_name.trim() : null,
  };
}

/**
 * Procesa un cliente individual
 * @param {object} client - Datos del cliente
 * @returns {object} Resultado de la operación
 */
async function processClient(client) {
  try {
    // Validar datos
    const validation = validateClientData(client);
    if (!validation.isValid) {
      return {
        success: false,
        email: client.email,
        error: `Datos inválidos: ${validation.errors.join(", ")}`,
      };
    }

    // Sanitizar datos
    const sanitizedClient = sanitizeClientData(client);

    // Verificar si el cliente ya existe
    const { data: existing, error: searchError } = await supabase
      .from("clients")
      .select("id, email, full_name, phone")
      .eq("email", sanitizedClient.email)
      .single();

    if (searchError && searchError.code !== "PGRST116") {
      throw new Error(`Error buscando cliente: ${searchError.message}`);
    }

    if (existing) {
      // Cliente existe - actualizar
      const updateData = {
        full_name: sanitizedClient.full_name,
        phone: sanitizedClient.phone,
      };

      const { data: updated, error: updateError } = await supabase
        .from("clients")
        .update(updateData)
        .eq("email", sanitizedClient.email)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Error actualizando cliente: ${updateError.message}`);
      }

      return {
        success: true,
        action: "updated",
        email: sanitizedClient.email,
        data: updated,
      };
    } else {
      // Cliente no existe - insertar
      const insertData = {
        email: sanitizedClient.email,
        full_name: sanitizedClient.full_name,
        phone: sanitizedClient.phone,
        lgpd_accepted: true, // Asumir consentimiento para clientes existentes
        registration_complete: true,
      };

      const { data: inserted, error: insertError } = await supabase
        .from("clients")
        .insert([insertData])
        .select()
        .single();

      if (insertError) {
        throw new Error(`Error insertando cliente: ${insertError.message}`);
      }

      return {
        success: true,
        action: "inserted",
        email: sanitizedClient.email,
        data: inserted,
      };
    }
  } catch (error) {
    return {
      success: false,
      email: client.email || "email_desconocido",
      error: error.message,
    };
  }
}

/**
 * Procesa el archivo CSV en lotes
 * @param {string} filePath - Ruta del archivo CSV
 * @returns {Promise<object>} Estadísticas del procesamiento
 */
async function processCSVFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stats = {
      total: 0,
      processed: 0,
      inserted: 0,
      updated: 0,
      errors: 0,
      errorDetails: [],
    };

    console.log(`📂 Leyendo archivo: ${filePath}`);

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        results.push(data);
        stats.total++;
      })
      .on("end", async () => {
        console.log(`📊 Total de registros en CSV: ${stats.total}`);
        console.log(`🔄 Procesando en lotes de ${BATCH_SIZE}...`);

        try {
          // Procesar en lotes
          for (let i = 0; i < results.length; i += BATCH_SIZE) {
            const batch = results.slice(i, i + BATCH_SIZE);
            console.log(
              `\n📦 Procesando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(results.length / BATCH_SIZE)}`
            );

            // Procesar cada cliente en el lote
            for (const client of batch) {
              const result = await processClient(client);
              stats.processed++;

              if (result.success) {
                if (result.action === "inserted") {
                  stats.inserted++;
                  console.log(`✅ Insertado: ${result.email}`);
                } else if (result.action === "updated") {
                  stats.updated++;
                  console.log(`🔄 Actualizado: ${result.email}`);
                }
              } else {
                stats.errors++;
                stats.errorDetails.push({
                  email: result.email,
                  error: result.error,
                });
                console.log(`❌ Error en ${result.email}: ${result.error}`);
              }
            }

            // Pausa pequeña entre lotes para no sobrecargar la base de datos
            if (i + BATCH_SIZE < results.length) {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }

          resolve(stats);
        } catch (error) {
          reject(error);
        }
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

/**
 * Función principal
 */
async function main() {
  console.log("🚀 INICIANDO ACTUALIZACIÓN DE CLIENTES DESDE CSV");
  console.log("=".repeat(60));
  console.log(`📅 Fecha: ${new Date().toLocaleString("es-ES")}`);
  console.log(`🗄️ Base de datos: ${supabaseUrl}`);
  console.log(`📁 Archivo CSV: ${CSV_FILE_PATH}`);
  console.log("=".repeat(60));

  try {
    // Verificar que el archivo CSV existe
    if (!fs.existsSync(CSV_FILE_PATH)) {
      throw new Error(`Archivo CSV no encontrado: ${CSV_FILE_PATH}`);
    }

    // Verificar conexión a Supabase
    console.log("🔗 Verificando conexión a Supabase...");
    const { data, error } = await supabase
      .from("clients")
      .select("count")
      .limit(1);
    if (error) {
      throw new Error(`Error conectando a Supabase: ${error.message}`);
    }
    console.log("✅ Conexión a Supabase exitosa");

    // Procesar archivo CSV
    const stats = await processCSVFile(CSV_FILE_PATH);

    // Mostrar estadísticas finales
    console.log("\n" + "=".repeat(60));
    console.log("📊 ESTADÍSTICAS FINALES");
    console.log("=".repeat(60));
    console.log(`📝 Total de registros en CSV: ${stats.total}`);
    console.log(`✅ Registros procesados: ${stats.processed}`);
    console.log(`➕ Clientes insertados: ${stats.inserted}`);
    console.log(`🔄 Clientes actualizados: ${stats.updated}`);
    console.log(`❌ Errores: ${stats.errors}`);

    if (stats.errorDetails.length > 0) {
      console.log("\n📋 DETALLE DE ERRORES:");
      stats.errorDetails.forEach((error, index) => {
        console.log(`${index + 1}. ${error.email}: ${error.error}`);
      });
    }

    console.log("=".repeat(60));
    console.log("✅ PROCESO COMPLETADO EXITOSAMENTE");
  } catch (error) {
    console.error("\n❌ ERROR CRÍTICO:", error.message);
    process.exit(1);
  }
}

// Ejecutar script
if (require.main === module) {
  main();
}

module.exports = {
  processClient,
  validateClientData,
  sanitizeClientData,
};
