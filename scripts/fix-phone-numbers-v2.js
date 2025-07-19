/**
 * SCRIPT MEJORADO PARA CORRECCIÓN DE NÚMEROS DE TELÉFONO
 *
 * Este script utiliza la configuración centralizada y el gestor de base de datos
 * para corregir números de teléfono de forma consistente y segura
 *
 * Uso: node scripts/fix-phone-numbers-v2.js
 */

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

/**
 * Estadísticas del proceso
 */
const stats = {
  total: 0,
  processed: 0,
  updated: 0,
  invalid: 0,
  unchanged: 0,
  errors: 0,
  skipped: 0,
  byCountry: {},
  errorDetails: [],
};

/**
 * Procesa un cliente individual
 */
async function processClient(client, index) {
  try {
    console.log(
      `[${index + 1}/${stats.total}] Procesando cliente ${client.id}...`
    );

    const originalPhone = client.phone;

    // Verificar si tiene número de teléfono
    if (!originalPhone || originalPhone === null || originalPhone === "") {
      console.log(`⚠️  Cliente ${client.id} sin número de teléfono`);
      stats.skipped++;
      return { success: true, reason: "Sin teléfono", clientId: client.id };
    }

    // Validar y formatear el número
    const validation = validatePhoneNumber(originalPhone);

    if (!validation.isValid) {
      console.log(
        `❌ Número inválido para cliente ${client.id}: ${originalPhone}`
      );
      stats.invalid++;
      stats.errorDetails.push({
        clientId: client.id,
        originalPhone,
        result: {
          success: false,
          reason: "Número inválido",
          original: originalPhone,
        },
      });
      return {
        success: false,
        reason: "Número inválido",
        original: originalPhone,
      };
    }

    const formattedPhone = formatPhoneNumber(originalPhone);

    if (!formattedPhone) {
      console.log(
        `❌ No se pudo formatear el número para cliente ${client.id}: ${originalPhone}`
      );
      stats.invalid++;
      stats.errorDetails.push({
        clientId: client.id,
        originalPhone,
        result: {
          success: false,
          reason: "Error de formateo",
          original: originalPhone,
        },
      });
      return {
        success: false,
        reason: "Error de formateo",
        original: originalPhone,
      };
    }

    // Si el número ya está correcto, no actualizar
    if (originalPhone === formattedPhone) {
      console.log(
        `✅ Número ya correcto para cliente ${client.id}: ${formattedPhone}`
      );
      stats.unchanged++;
      return { success: true, reason: "Sin cambios", phone: formattedPhone };
    }

    // Obtener información del país
    const countryInfo = getCountryInfo(formattedPhone);
    const countryCode = countryInfo?.code || "UNKNOWN";

    // Actualizar estadísticas por país
    if (!stats.byCountry[countryCode]) {
      stats.byCountry[countryCode] = 0;
    }
    stats.byCountry[countryCode]++;

    // Actualizar en la base de datos
    const result = await dbManager.updateClientPhone(client.id, formattedPhone);

    if (result.error) {
      console.error(
        `❌ Error actualizando cliente ${client.id}:`,
        result.error.message
      );
      stats.errors++;
      stats.errorDetails.push({
        clientId: client.id,
        originalPhone,
        result: {
          success: false,
          reason: "Error de base de datos",
          error: result.error.message,
        },
      });
      return {
        success: false,
        reason: "Error de base de datos",
        error: result.error.message,
      };
    }

    console.log(
      `✅ Actualizado cliente ${client.id}: ${originalPhone} → ${formattedPhone} (${countryInfo?.name || "País desconocido"})`
    );
    stats.updated++;

    return {
      success: true,
      reason: "Actualizado",
      original: originalPhone,
      formatted: formattedPhone,
      country: countryInfo?.name || "Desconocido",
    };
  } catch (error) {
    console.error(`❌ Error procesando cliente ${client.id}:`, error.message);
    stats.errors++;
    stats.errorDetails.push({
      clientId: client.id,
      originalPhone: client.phone,
      result: {
        success: false,
        reason: "Error de procesamiento",
        error: error.message,
      },
    });

    logger.error("Error procesando cliente", {
      clientId: client.id,
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
 * Obtiene todos los clientes
 */
async function getAllClients() {
  try {
    console.log("📋 Obteniendo todos los clientes...");

    const result = await dbManager.getAll("clients", {
      orderBy: { column: "created_at", ascending: false },
    });

    if (result.error) {
      throw new Error(`Error obteniendo clientes: ${result.error.message}`);
    }

    console.log(`📊 Encontrados ${result.data.length} clientes`);
    return result.data;
  } catch (error) {
    console.error("❌ Error obteniendo clientes:", error.message);
    logger.error("Error obteniendo clientes", { error: error.message });
    throw error;
  }
}

/**
 * Muestra estadísticas finales
 */
function showFinalStats() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 ESTADÍSTICAS FINALES");
  console.log("=".repeat(60));
  console.log(`📋 Total de clientes: ${stats.total}`);
  console.log(`🔄 Procesados: ${stats.processed}`);
  console.log(`✅ Actualizados: ${stats.updated}`);
  console.log(`⚪ Sin cambios: ${stats.unchanged}`);
  console.log(`⚠️  Sin teléfono: ${stats.skipped}`);
  console.log(`❌ Números inválidos: ${stats.invalid}`);
  console.log(`💥 Errores: ${stats.errors}`);

  if (Object.keys(stats.byCountry).length > 0) {
    console.log("\n📍 Por país:");
    Object.entries(stats.byCountry)
      .sort(([, a], [, b]) => b - a)
      .forEach(([country, count]) => {
        console.log(`   ${country}: ${count}`);
      });
  }

  if (stats.errorDetails.length > 0) {
    console.log(`\n❌ Detalles de errores (${stats.errorDetails.length}):`);
    stats.errorDetails.slice(0, 10).forEach((error, index) => {
      console.log(
        `   ${index + 1}. Cliente ${error.clientId}: ${error.result.reason}`
      );
      if (error.result.error) {
        console.log(`      Error: ${error.result.error}`);
      }
    });

    if (stats.errorDetails.length > 10) {
      console.log(`   ... y ${stats.errorDetails.length - 10} errores más`);
    }
  }

  // Calcular porcentajes
  const successRate =
    stats.total > 0
      ? (((stats.updated + stats.unchanged) / stats.total) * 100).toFixed(1)
      : 0;
  const errorRate =
    stats.total > 0 ? ((stats.errors / stats.total) * 100).toFixed(1) : 0;

  console.log(`\n📈 Tasa de éxito: ${successRate}%`);
  console.log(`📉 Tasa de error: ${errorRate}%`);
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log("🚀 Iniciando corrección de números de teléfono...\n");

    // Verificar salud de la base de datos
    const healthCheck = await dbManager.healthCheck();
    if (!healthCheck.healthy) {
      throw new Error(`Base de datos no disponible: ${healthCheck.error}`);
    }
    console.log("✅ Conexión a base de datos verificada\n");

    // Obtener todos los clientes
    const clients = await getAllClients();
    stats.total = clients.length;

    if (stats.total === 0) {
      console.log("⚠️  No se encontraron clientes para procesar");
      return;
    }

    console.log(`\n🔄 Procesando ${stats.total} clientes...\n`);

    // Procesar clientes en lotes pequeños
    const batchSize = 10;
    const results = [];

    for (let i = 0; i < clients.length; i += batchSize) {
      const batch = clients.slice(i, i + batchSize);

      for (let j = 0; j < batch.length; j++) {
        const client = batch[j];
        const globalIndex = i + j;

        const result = await processClient(client, globalIndex);
        results.push({
          clientId: client.id,
          originalPhone: client.phone,
          result,
        });

        stats.processed++;

        // Pequeña pausa entre clientes
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Pausa más larga entre lotes
      if (i + batchSize < clients.length) {
        console.log(`⏸️  Pausa breve después de ${i + batchSize} clientes...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Mostrar estadísticas finales
    showFinalStats();

    // Log del resumen
    logger.info("Corrección de números completada", {
      total: stats.total,
      updated: stats.updated,
      unchanged: stats.unchanged,
      errors: stats.errors,
      invalid: stats.invalid,
      skipped: stats.skipped,
      byCountry: stats.byCountry,
    });

    console.log("\n✅ Proceso completado exitosamente");
  } catch (error) {
    console.error("\n❌ Error en el proceso principal:", error.message);
    logger.error("Error en corrección de números", { error: error.message });
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = { processClient, getAllClients, main };
