/**
 * SCRIPT DE IMPORTACIÓN DE CLIENTES DESDE CSV CON VALIDACIÓN DE NÚMEROS
 *
 * Este script:
 * 1. Lee el archivo CSV de clientes
 * 2. Valida y formatea números de teléfono
 * 3. Importa o actualiza clientes en Supabase
 * 4. Genera reporte detallado de la importación
 *
 * Uso: node scripts/import-clients-from-csv.js [ruta-al-csv]
 */

require("dotenv").config();
require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { createClient } = require("@supabase/supabase-js");
const {
  formatPhoneNumber,
  validatePhoneNumber,
  getCountryInfo,
} = require("../utils/phoneNumberFormatter");
const logger = require("../utils/logger");

// Configuración
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "❌ Error: Variables de entorno SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Estadísticas
const stats = {
  total: 0,
  imported: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
  invalidPhones: 0,
  byCountry: {},
};

/**
 * Procesa una fila del CSV
 */
function processCSVRow(row) {
  // Limpiar y normalizar datos
  const client = {
    email: row.email?.trim().toLowerCase() || null,
    full_name: row.full_name?.trim() || null,
    name: row.name?.trim() || null,
    last_name: row.last_name?.trim() || null,
    phone: row.phone?.trim() || null,
  };

  // Validar datos mínimos
  if (!client.email && !client.phone) {
    return { valid: false, error: "Sin email ni teléfono" };
  }

  // Formatear número de teléfono
  if (client.phone) {
    const formattedPhone = formatPhoneNumber(client.phone);
    if (!formattedPhone) {
      return {
        valid: false,
        error: `Número de teléfono inválido: ${client.phone}`,
        client,
      };
    }
    client.phone = formattedPhone;

    // Obtener información del país
    const countryInfo = getCountryInfo(formattedPhone);
    if (countryInfo) {
      client.country_code = countryInfo.code;
      client.country_name = countryInfo.name;
    }
  }

  // Construir nombre completo si no existe
  if (!client.full_name && client.name && client.last_name) {
    client.full_name = `${client.name} ${client.last_name}`;
  }

  return { valid: true, client };
}

/**
 * Busca cliente existente por email o teléfono
 */
async function findExistingClient(client) {
  try {
    let query = supabase.from("clients").select("*");

    // Buscar por teléfono primero (más confiable)
    if (client.phone) {
      const { data: phoneData, error: phoneError } = await query
        .eq("phone", client.phone)
        .single();

      if (!phoneError && phoneData) {
        return { found: true, client: phoneData, matchedBy: "phone" };
      }
    }

    // Buscar por email si no se encontró por teléfono
    if (client.email) {
      const { data: emailData, error: emailError } = await query
        .eq("email", client.email)
        .single();

      if (!emailError && emailData) {
        return { found: true, client: emailData, matchedBy: "email" };
      }
    }

    return { found: false };
  } catch (error) {
    logger.error("Error buscando cliente existente", {
      error: error.message,
      client,
    });
    return { found: false, error: error.message };
  }
}

/**
 * Importa o actualiza un cliente
 */
async function importClient(clientData) {
  try {
    stats.total++;

    // Procesar datos del CSV
    const processed = processCSVRow(clientData);
    if (!processed.valid) {
      console.log(`⚠️  [${stats.total}] Fila inválida: ${processed.error}`);
      if (processed.error.includes("teléfono inválido")) {
        stats.invalidPhones++;
      }
      stats.skipped++;
      return { success: false, reason: processed.error };
    }

    const client = processed.client;

    // Actualizar estadísticas por país
    if (client.country_code) {
      if (!stats.byCountry[client.country_code]) {
        stats.byCountry[client.country_code] = 0;
      }
      stats.byCountry[client.country_code]++;
    }

    // Buscar cliente existente
    const existing = await findExistingClient(client);
    if (existing.error) {
      stats.errors++;
      return { success: false, reason: "Error de búsqueda" };
    }

    if (existing.found) {
      // Actualizar cliente existente
      const updateData = {
        ...client,
        updated_at: new Date().toISOString(),
      };

      // Remover campos que no deben actualizarse si están vacíos
      Object.keys(updateData).forEach((key) => {
        if (updateData[key] === null || updateData[key] === "") {
          delete updateData[key];
        }
      });

      const { data, error } = await supabase
        .from("clients")
        .update(updateData)
        .eq("id", existing.client.id)
        .select()
        .single();

      if (error) {
        console.error(
          `❌ [${stats.total}] Error actualizando cliente:`,
          error.message
        );
        stats.errors++;
        return { success: false, reason: error.message };
      }

      console.log(
        `🔄 [${stats.total}] Cliente actualizado: ${client.full_name || client.email} (${existing.matchedBy})`
      );
      stats.updated++;
      return { success: true, action: "updated", data };
    } else {
      // Crear nuevo cliente
      const newClient = {
        ...client,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
        source: "csv_import",
      };

      const { data, error } = await supabase
        .from("clients")
        .insert([newClient])
        .select()
        .single();

      if (error) {
        console.error(
          `❌ [${stats.total}] Error creando cliente:`,
          error.message
        );
        stats.errors++;
        return { success: false, reason: error.message };
      }

      console.log(
        `✅ [${stats.total}] Cliente creado: ${client.full_name || client.email} (${client.country_name || "País desconocido"})`
      );
      stats.imported++;
      return { success: true, action: "created", data };
    }
  } catch (error) {
    console.error(
      `❌ [${stats.total}] Error procesando cliente:`,
      error.message
    );
    stats.errors++;
    return { success: false, reason: error.message };
  }
}

/**
 * Lee y procesa el archivo CSV
 */
async function processCSV(csvPath) {
  return new Promise((resolve, reject) => {
    const results = [];

    if (!fs.existsSync(csvPath)) {
      reject(new Error(`Archivo CSV no encontrado: ${csvPath}`));
      return;
    }

    console.log(`📄 Leyendo archivo CSV: ${csvPath}`);

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on("data", (data) => {
        results.push(data);
      })
      .on("end", () => {
        console.log(`📊 Leídas ${results.length} filas del CSV`);
        resolve(results);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

/**
 * Genera reporte final
 */
function generateReport() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 REPORTE DE IMPORTACIÓN DE CLIENTES DESDE CSV");
  console.log("=".repeat(60));
  console.log(`📄 Total de filas procesadas: ${stats.total}`);
  console.log(`✅ Clientes nuevos importados: ${stats.imported}`);
  console.log(`🔄 Clientes actualizados: ${stats.updated}`);
  console.log(`⚠️  Filas omitidas: ${stats.skipped}`);
  console.log(`📞 Números de teléfono inválidos: ${stats.invalidPhones}`);
  console.log(`❌ Errores: ${stats.errors}`);

  console.log("\n📍 Distribución por países:");
  Object.entries(stats.byCountry).forEach(([country, count]) => {
    const countryNames = {
      ES: "🇪🇸 España",
      US: "🇺🇸 Estados Unidos",
      CO: "🇨🇴 Colombia",
      CH: "🇨🇭 Suiza",
    };
    console.log(`  ${countryNames[country] || country}: ${count}`);
  });

  const successRate = (
    ((stats.imported + stats.updated) / stats.total) *
    100
  ).toFixed(1);
  console.log(`\n🎯 Tasa de éxito: ${successRate}%`);
  console.log("=".repeat(60));
}

/**
 * Función principal
 */
async function main() {
  try {
    // Obtener ruta del CSV
    const csvPath =
      process.argv[2] ||
      path.join(__dirname, "..", "clientes_RB_simplificado.csv");

    console.log("🚀 Iniciando importación de clientes desde CSV...\n");
    console.log(`📂 Archivo CSV: ${csvPath}\n`);

    // Leer CSV
    const csvData = await processCSV(csvPath);

    if (csvData.length === 0) {
      console.log("⚠️  No se encontraron datos en el CSV");
      return;
    }

    console.log(`\n🔄 Procesando ${csvData.length} clientes...\n`);

    // Procesar cada cliente
    const results = [];
    for (let i = 0; i < csvData.length; i++) {
      const clientData = csvData[i];
      const result = await importClient(clientData);
      results.push(result);

      // Pausa cada 20 clientes para no sobrecargar la base de datos
      if (i % 20 === 0 && i > 0) {
        console.log(`⏸️  Pausa breve después de ${i} clientes...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Generar reporte
    generateReport();

    // Log detallado
    const detailedLog = {
      timestamp: new Date().toISOString(),
      csvPath,
      stats,
      summary: {
        totalProcessed: stats.total,
        successful: stats.imported + stats.updated,
        failed: stats.skipped + stats.errors,
      },
    };

    logger.info("Importación de clientes desde CSV completada", detailedLog);

    console.log("\n✅ Importación completada exitosamente");
  } catch (error) {
    console.error("\n❌ Error en la importación:", error.message);
    logger.error("Error en importación de CSV", { error: error.message });
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = { main, importClient, processCSVRow };
