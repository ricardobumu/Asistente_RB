/**
 * SCRIPT DE SINCRONIZACIÓN DE CLIENTES DESDE CSV
 *
 * Este script sincroniza los datos de clientes desde el CSV original
 * asegurando consistencia en todos los módulos del sistema
 */

const fs = require("fs");
const path = require("path");
const { dbManager } = require("../src/config/database");
const { ConfigManager } = require("../src/config/integrations");
const {
  formatPhoneNumber,
  validatePhoneNumber,
  getCountryInfo,
} = require("../utils/phoneNumberFormatter");
const logger = require("../utils/logger");

// Verificar configuración
if (!ConfigManager.isServiceConfigured("supabase")) {
  console.error("❌ Error: Configuración de Supabase incompleta");
  process.exit(1);
}

// Ruta del CSV
const CSV_PATH = path.join(__dirname, "..", "clientes_RB_simplificado.csv");

/**
 * Estadísticas del proceso
 */
const stats = {
  csvRecords: 0,
  processed: 0,
  updated: 0,
  created: 0,
  phoneUpdated: 0,
  phoneInvalid: 0,
  errors: 0,
  skipped: 0,
  byCountry: {},
  errorDetails: [],
};

/**
 * Lee y parsea el archivo CSV
 */
function parseCSV(filePath) {
  try {
    console.log(`📄 Leyendo archivo CSV: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Archivo CSV no encontrado: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());

    if (lines.length === 0) {
      throw new Error("Archivo CSV vacío");
    }

    // Parsear header
    const header = lines[0].split(",").map((col) => col.trim());
    console.log(`📋 Columnas encontradas: ${header.join(", ")}`);

    // Parsear datos
    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(",").map((val) => val.trim());

      if (values.length !== header.length) {
        console.warn(
          `⚠️  Línea ${i + 1} tiene ${values.length} columnas, esperadas ${header.length}`
        );
        continue;
      }

      const record = {};
      header.forEach((col, index) => {
        record[col] = values[index] || null;
      });

      records.push(record);
    }

    console.log(`📊 Registros parseados: ${records.length}`);
    return records;
  } catch (error) {
    console.error(`❌ Error leyendo CSV: ${error.message}`);
    throw error;
  }
}

/**
 * Busca un cliente existente por email
 */
async function findClientByEmail(email) {
  try {
    if (!email || email === "nan" || email === "") return null;

    const result = await dbManager.getAll("clients", {
      filters: { email: email.toLowerCase() },
    });

    return result.data && result.data.length > 0 ? result.data[0] : null;
  } catch (error) {
    logger.error("Error buscando cliente por email", {
      email,
      error: error.message,
    });
    return null;
  }
}

/**
 * Procesa un registro del CSV
 */
async function processCSVRecord(record, index) {
  try {
    console.log(
      `[${index + 1}/${stats.csvRecords}] Procesando: ${record.email || "Sin email"}`
    );

    // Validar datos mínimos
    if (!record.email || record.email === "nan" || record.email === "") {
      console.log(`⚠️  Registro sin email válido, saltando`);
      stats.skipped++;
      return { success: true, reason: "Sin email" };
    }

    if (
      !record.full_name ||
      record.full_name === "nan" ||
      record.full_name === ""
    ) {
      console.log(`⚠️  Registro sin nombre válido, saltando`);
      stats.skipped++;
      return { success: true, reason: "Sin nombre" };
    }

    // Buscar cliente existente
    const existingClient = await findClientByEmail(record.email);

    // Preparar datos del cliente
    const clientData = {
      email: record.email.toLowerCase(),
      full_name: record.full_name,
      name: record.name || record.full_name.split(" ")[0] || null,
      phone: null, // Se procesará después
    };

    // Procesar teléfono si existe
    if (record.phone && record.phone !== "nan" && record.phone !== "") {
      const validation = validatePhoneNumber(record.phone);

      if (validation.isValid) {
        const formatted = formatPhoneNumber(record.phone);
        if (formatted) {
          clientData.phone = formatted;

          // Estadísticas por país
          const countryInfo = getCountryInfo(formatted);
          const countryCode = countryInfo?.code || "UNKNOWN";
          if (!stats.byCountry[countryCode]) {
            stats.byCountry[countryCode] = 0;
          }
          stats.byCountry[countryCode]++;
        } else {
          console.log(`⚠️  No se pudo formatear teléfono: ${record.phone}`);
          stats.phoneInvalid++;
        }
      } else {
        console.log(
          `⚠️  Teléfono inválido: ${record.phone} - ${validation.reason}`
        );
        stats.phoneInvalid++;
      }
    }

    let result;

    if (existingClient) {
      // Actualizar cliente existente
      const updateData = {};
      let hasChanges = false;

      // Verificar cambios en nombre
      if (existingClient.full_name !== clientData.full_name) {
        updateData.full_name = clientData.full_name;
        hasChanges = true;
      }

      if (existingClient.name !== clientData.name) {
        updateData.name = clientData.name;
        hasChanges = true;
      }

      // Verificar cambios en teléfono
      if (clientData.phone && existingClient.phone !== clientData.phone) {
        updateData.phone = clientData.phone;
        hasChanges = true;
        stats.phoneUpdated++;
      }

      if (hasChanges) {
        result = await dbManager.updateRecord(
          "clients",
          existingClient.id,
          updateData
        );
        if (result.error) {
          console.error(
            `❌ Error actualizando cliente: ${result.error.message}`
          );
          stats.errors++;
          return {
            success: false,
            reason: "Error de actualización",
            error: result.error.message,
          };
        }

        console.log(`✅ Cliente actualizado: ${clientData.email}`);
        stats.updated++;
      } else {
        console.log(`✅ Cliente sin cambios: ${clientData.email}`);
      }
    } else {
      // Crear nuevo cliente
      result = await dbManager.insertRecord("clients", clientData);
      if (result.error) {
        console.error(`❌ Error creando cliente: ${result.error.message}`);
        stats.errors++;
        return {
          success: false,
          reason: "Error de creación",
          error: result.error.message,
        };
      }

      console.log(`✅ Cliente creado: ${clientData.email}`);
      stats.created++;
    }

    stats.processed++;
    return { success: true, reason: existingClient ? "Actualizado" : "Creado" };
  } catch (error) {
    console.error(`❌ Error procesando registro:`, error.message);
    stats.errors++;
    stats.errorDetails.push({
      record: record.email || "Sin email",
      error: error.message,
    });

    return {
      success: false,
      reason: "Error de procesamiento",
      error: error.message,
    };
  }
}

/**
 * Muestra estadísticas finales
 */
function showFinalStats() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 ESTADÍSTICAS FINALES");
  console.log("=".repeat(60));
  console.log(`📄 Registros en CSV: ${stats.csvRecords}`);
  console.log(`🔄 Procesados: ${stats.processed}`);
  console.log(`✅ Actualizados: ${stats.updated}`);
  console.log(`🆕 Creados: ${stats.created}`);
  console.log(`📱 Teléfonos actualizados: ${stats.phoneUpdated}`);
  console.log(`❌ Teléfonos inválidos: ${stats.phoneInvalid}`);
  console.log(`⚠️  Saltados: ${stats.skipped}`);
  console.log(`💥 Errores: ${stats.errors}`);

  if (Object.keys(stats.byCountry).length > 0) {
    console.log("\n📍 Teléfonos por país:");
    Object.entries(stats.byCountry)
      .sort(([, a], [, b]) => b - a)
      .forEach(([country, count]) => {
        console.log(`   ${country}: ${count}`);
      });
  }

  if (stats.errorDetails.length > 0) {
    console.log(`\n❌ Detalles de errores (${stats.errorDetails.length}):`);
    stats.errorDetails.slice(0, 10).forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.record}: ${error.error}`);
    });

    if (stats.errorDetails.length > 10) {
      console.log(`   ... y ${stats.errorDetails.length - 10} errores más`);
    }
  }

  // Calcular porcentajes
  const successRate =
    stats.csvRecords > 0
      ? ((stats.processed / stats.csvRecords) * 100).toFixed(1)
      : 0;
  const errorRate =
    stats.csvRecords > 0
      ? ((stats.errors / stats.csvRecords) * 100).toFixed(1)
      : 0;

  console.log(`\n📈 Tasa de éxito: ${successRate}%`);
  console.log(`📉 Tasa de error: ${errorRate}%`);
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log("🚀 Iniciando sincronización desde CSV...\n");

    // Verificar salud de la base de datos
    const healthCheck = await dbManager.healthCheck();
    if (!healthCheck.healthy) {
      throw new Error(`Base de datos no disponible: ${healthCheck.error}`);
    }
    console.log("✅ Conexión a base de datos verificada\n");

    // Leer y parsear CSV
    const csvRecords = parseCSV(CSV_PATH);
    stats.csvRecords = csvRecords.length;

    if (stats.csvRecords === 0) {
      console.log("⚠️  No se encontraron registros para procesar");
      return;
    }

    console.log(`\n🔄 Procesando ${stats.csvRecords} registros...\n`);

    // Procesar registros en lotes
    const batchSize = 5;
    for (let i = 0; i < csvRecords.length; i += batchSize) {
      const batch = csvRecords.slice(i, i + batchSize);

      for (let j = 0; j < batch.length; j++) {
        const record = batch[j];
        const globalIndex = i + j;

        await processCSVRecord(record, globalIndex);

        // Pequeña pausa entre registros
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Pausa más larga entre lotes
      if (i + batchSize < csvRecords.length) {
        console.log(`⏸️  Pausa breve después de ${i + batchSize} registros...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Mostrar estadísticas finales
    showFinalStats();

    // Log del resumen
    logger.info("Sincronización desde CSV completada", {
      csvRecords: stats.csvRecords,
      processed: stats.processed,
      updated: stats.updated,
      created: stats.created,
      phoneUpdated: stats.phoneUpdated,
      phoneInvalid: stats.phoneInvalid,
      errors: stats.errors,
      skipped: stats.skipped,
      byCountry: stats.byCountry,
    });

    console.log("\n✅ Sincronización completada exitosamente");
  } catch (error) {
    console.error("\n❌ Error en el proceso principal:", error.message);
    logger.error("Error en sincronización desde CSV", { error: error.message });
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = { parseCSV, processCSVRecord, main };
