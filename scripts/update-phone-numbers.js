/**
 * SCRIPT DE ACTUALIZACIÓN DE NÚMEROS DE TELÉFONO EN SUPABASE
 *
 * Este script:
 * 1. Lee todos los clientes de la base de datos
 * 2. Valida y formatea sus números de teléfono
 * 3. Actualiza los números corregidos en Supabase
 * 4. Genera un reporte de cambios
 *
 * Países soportados: España (+34), Estados Unidos (+1), Colombia (+57), Suiza (+41)
 *
 * Uso: node scripts/update-phone-numbers.js
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
const supabaseConfig = ConfigManager.getConfig("supabase");
if (!ConfigManager.isServiceConfigured("supabase")) {
  console.error("❌ Error: Configuración de Supabase incompleta");
  process.exit(1);
}

/**
 * Estadísticas del proceso
 */
const stats = {
  total: 0,
  updated: 0,
  invalid: 0,
  unchanged: 0,
  errors: 0,
  byCountry: {},
};

/**
 * Actualiza un número de teléfono individual
 */
async function updatePhoneNumber(client) {
  try {
    const originalPhone = client.phone || client.phone_number;

    if (!originalPhone) {
      console.log(`⚠️  Cliente ${client.id} sin número de teléfono`);
      stats.invalid++;
      return { success: false, reason: "Sin número de teléfono" };
    }

    // Formatear número
    const formattedPhone = formatPhoneNumber(originalPhone);

    if (!formattedPhone) {
      console.log(
        `❌ Número inválido para cliente ${client.id}: ${originalPhone}`
      );
      stats.invalid++;
      return {
        success: false,
        reason: "Número inválido",
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

    // Actualizar en Supabase usando el manager centralizado
    const result = await dbManager.updateClientPhone(client.id, formattedPhone);

    if (result.error) {
      console.error(
        `❌ Error actualizando cliente ${client.id}:`,
        result.error.message
      );
      stats.errors++;
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
    return {
      success: false,
      reason: "Error de procesamiento",
      error: error.message,
    };
  }
}

/**
 * Obtiene todos los clientes de la base de datos
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
    throw error;
  }
}

/**
 * Genera reporte final
 */
function generateReport() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 REPORTE FINAL DE ACTUALIZACIÓN DE NÚMEROS DE TELÉFONO");
  console.log("=".repeat(60));
  console.log(`📱 Total de clientes procesados: ${stats.total}`);
  console.log(`✅ Números actualizados: ${stats.updated}`);
  console.log(`🔄 Sin cambios necesarios: ${stats.unchanged}`);
  console.log(`❌ Números inválidos: ${stats.invalid}`);
  console.log(`⚠️  Errores: ${stats.errors}`);

  console.log("\n📍 Distribución por países:");
  Object.entries(stats.byCountry).forEach(([country, count]) => {
    const countryNames = {
      ES: "🇪🇸 España",
      US: "🇺🇸 Estados Unidos",
      CO: "🇨🇴 Colombia",
      CH: "🇨🇭 Suiza",
      UNKNOWN: "❓ Desconocido",
    };
    console.log(`  ${countryNames[country] || country}: ${count}`);
  });

  const successRate = (
    ((stats.updated + stats.unchanged) / stats.total) *
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
    console.log("🚀 Iniciando actualización de números de teléfono...\n");

    // Obtener todos los clientes
    const clients = await getAllClients();
    stats.total = clients.length;

    if (clients.length === 0) {
      console.log("⚠️  No se encontraron clientes para procesar");
      return;
    }

    console.log(`\n🔄 Procesando ${clients.length} clientes...\n`);

    // Procesar cada cliente
    const results = [];
    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      console.log(
        `[${i + 1}/${clients.length}] Procesando cliente ${client.id}...`
      );

      const result = await updatePhoneNumber(client);
      results.push({ client, result });

      // Pequeña pausa para no sobrecargar la base de datos
      if (i % 10 === 0 && i > 0) {
        console.log(`⏸️  Pausa breve después de ${i} clientes...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Generar reporte
    generateReport();

    // Guardar log detallado
    const detailedLog = {
      timestamp: new Date().toISOString(),
      stats,
      results: results.map((r) => ({
        clientId: r.client.id,
        originalPhone: r.client.phone || r.client.phone_number,
        result: r.result,
      })),
    };

    logger.info("Actualización de números de teléfono completada", detailedLog);

    console.log("\n✅ Proceso completado exitosamente");
  } catch (error) {
    console.error("\n❌ Error en el proceso principal:", error.message);
    logger.error("Error en actualización de números de teléfono", {
      error: error.message,
    });
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = { main, updatePhoneNumber };
