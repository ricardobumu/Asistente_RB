/**
 * ANÁLISIS DE NÚMEROS INVÁLIDOS
 *
 * Este script analiza los números marcados como inválidos
 * para entender qué patrones necesitamos soportar
 */

const { dbManager } = require("../src/config/database");
const { ConfigManager } = require("../src/config/integrations");
const {
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
 * Analiza números inválidos
 */
async function analyzeInvalidPhones() {
  try {
    console.log("🔍 Analizando números de teléfono inválidos...\n");

    // Obtener todos los clientes
    const clientsResult = await dbManager.getAll("clients");
    if (clientsResult.error) {
      throw new Error(
        `Error obteniendo clientes: ${clientsResult.error.message}`
      );
    }

    const clientsWithPhone = clientsResult.data.filter((c) => c.phone);
    console.log(
      `📊 Total de clientes con teléfono: ${clientsWithPhone.length}`
    );

    const invalidNumbers = [];
    const validNumbers = [];

    // Analizar cada número
    for (const client of clientsWithPhone) {
      const validation = validatePhoneNumber(client.phone);

      if (validation.isValid) {
        const countryInfo = getCountryInfo(client.phone);
        validNumbers.push({
          phone: client.phone,
          country: countryInfo?.code || "UNKNOWN",
          countryName: countryInfo?.name || "Desconocido",
        });
      } else {
        invalidNumbers.push({
          clientId: client.id,
          email: client.email,
          phone: client.phone,
          reason: validation.reason,
          length: client.phone ? client.phone.toString().length : 0,
        });
      }
    }

    console.log(`✅ Números válidos: ${validNumbers.length}`);
    console.log(`❌ Números inválidos: ${invalidNumbers.length}\n`);

    // Mostrar números inválidos
    if (invalidNumbers.length > 0) {
      console.log("🔍 NÚMEROS INVÁLIDOS ENCONTRADOS:");
      console.log("=".repeat(80));

      invalidNumbers.forEach((invalid, index) => {
        console.log(`${index + 1}. Cliente: ${invalid.email}`);
        console.log(`   Teléfono: "${invalid.phone}"`);
        console.log(`   Longitud: ${invalid.length}`);
        console.log(`   Razón: ${invalid.reason}`);
        console.log(`   ID: ${invalid.clientId}`);
        console.log("");
      });

      // Agrupar por razón
      const reasonGroups = {};
      invalidNumbers.forEach((invalid) => {
        if (!reasonGroups[invalid.reason]) {
          reasonGroups[invalid.reason] = [];
        }
        reasonGroups[invalid.reason].push(invalid);
      });

      console.log("📊 AGRUPACIÓN POR RAZÓN:");
      console.log("=".repeat(50));
      Object.entries(reasonGroups).forEach(([reason, numbers]) => {
        console.log(`${reason}: ${numbers.length} números`);
        numbers.slice(0, 3).forEach((num) => {
          console.log(`   - "${num.phone}" (${num.length} dígitos)`);
        });
        if (numbers.length > 3) {
          console.log(`   ... y ${numbers.length - 3} más`);
        }
        console.log("");
      });
    }

    // Mostrar estadísticas de países válidos
    if (validNumbers.length > 0) {
      console.log("🌍 PAÍSES DE NÚMEROS VÁLIDOS:");
      console.log("=".repeat(40));

      const countryStats = {};
      validNumbers.forEach((valid) => {
        if (!countryStats[valid.country]) {
          countryStats[valid.country] = {
            count: 0,
            name: valid.countryName,
          };
        }
        countryStats[valid.country].count++;
      });

      Object.entries(countryStats)
        .sort(([, a], [, b]) => b.count - a.count)
        .forEach(([code, data]) => {
          console.log(`${code} (${data.name}): ${data.count} números`);
        });
    }

    return {
      total: clientsWithPhone.length,
      valid: validNumbers.length,
      invalid: invalidNumbers.length,
      invalidDetails: invalidNumbers,
      countryStats: validNumbers.reduce((acc, valid) => {
        acc[valid.country] = (acc[valid.country] || 0) + 1;
        return acc;
      }, {}),
    };
  } catch (error) {
    console.error("❌ Error analizando números:", error.message);
    logger.error("Error en análisis de números inválidos", {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    // Verificar salud de la base de datos
    const healthCheck = await dbManager.healthCheck();
    if (!healthCheck.healthy) {
      throw new Error(`Base de datos no disponible: ${healthCheck.error}`);
    }

    const analysis = await analyzeInvalidPhones();

    // Log del resumen
    logger.info("Análisis de números inválidos completado", analysis);

    console.log("\n✅ Análisis completado");
  } catch (error) {
    console.error("\n❌ Error en el análisis:", error.message);
    logger.error("Error en análisis de números", { error: error.message });
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = { analyzeInvalidPhones, main };
