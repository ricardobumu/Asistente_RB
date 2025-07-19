/**
 * CORRECCIÓN DE NÚMEROS INVÁLIDOS ESPECÍFICOS
 *
 * Este script corrige los 12 números inválidos identificados
 * aplicando detección automática de país mejorada
 */

const { dbManager } = require("../src/config/database");
const { ConfigManager } = require("../src/config/integrations");
const {
  formatPhoneNumber,
  validatePhoneNumber,
  correctNumberWithoutCountryCode,
  getCountryInfo,
} = require("../utils/phoneNumberFormatter");
const logger = require("../utils/logger");

// Verificar configuración
if (!ConfigManager.isServiceConfigured("supabase")) {
  console.error("❌ Error: Configuración de Supabase incompleta");
  process.exit(1);
}

/**
 * Lista de números inválidos identificados con sus correcciones esperadas
 */
const INVALID_NUMBERS = [
  {
    clientId: "0e72beb6-0551-4bfa-b198-3aa633803f2b",
    email: "raquelhijano@hotmail.com",
    phone: "16100369061",
    expectedCountry: "+1", // Estados Unidos
    reason: "Debe empezar con código de país",
  },
  {
    clientId: "7c8335ad-bb29-4828-a94b-4411471cddf1",
    email: "rouan.sylvie@yahoo.fr",
    phone: "16068240539",
    expectedCountry: "+1", // Estados Unidos
    reason: "Debe empezar con código de país",
  },
  {
    clientId: "2cce5feb-a766-4421-b950-c16a020d2cb1",
    email: "melolua38@gmail.com",
    phone: "14179176793",
    expectedCountry: "+1", // Estados Unidos
    reason: "Debe empezar con código de país",
  },
  {
    clientId: "06a1da58-3e7d-4a46-a90a-0634c5125a13",
    email: "abarreramedrano@gmail.com",
    phone: "16453036454",
    expectedCountry: "+1", // Estados Unidos
    reason: "Debe empezar con código de país",
  },
  {
    clientId: "b3e2a408-dffe-4a4e-8a42-b34f04fcf528",
    email: "paulamco@yahoo.com",
    phone: "15731126258",
    expectedCountry: "+1", // Estados Unidos
    reason: "Debe empezar con código de país",
  },
  // Números con +3434 malformados que aún no se corrigieron
  {
    clientId: "ada5e3bf-b939-44f3-aaf7-d103739d5383",
    email: "sunybasanta@gmail.com",
    phone: "+3434346704204",
    expectedCountry: "+34", // España
    reason: "No cumple patrón del país",
  },
  {
    clientId: "7364d812-d893-4821-9c4d-19ff183e8fac",
    email: "susanacastilla@hotmail.com",
    phone: "+3434491706161",
    expectedCountry: "+34", // España
    reason: "No cumple patrón del país",
  },
  {
    clientId: "f1dfc708-412c-46e0-af0d-4ecca5144819",
    email: "aitanasjp@gmail.com",
    phone: "+3434346655447",
    expectedCountry: "+34", // España
    reason: "No cumple patrón del país",
  },
  {
    clientId: "8d69121e-9150-44d7-b8ad-ae22bdefdb1a",
    email: "aleirigoin@aol.com",
    phone: "+3434447403224",
    expectedCountry: "+34", // España
    reason: "No cumple patrón del país",
  },
  {
    clientId: "d92a6262-a16f-485f-8ccc-9cdd0f7b227c",
    email: "mtusell@xtec.cat",
    phone: "+3434346771828",
    expectedCountry: "+34", // España
    reason: "No cumple patrón del país",
  },
  {
    clientId: "09bda63a-dd2e-4c10-b4d2-ac4c471c35f7",
    email: "martinasanstre@hotmail.com",
    phone: "+3434324704578",
    expectedCountry: "+34", // España
    reason: "No cumple patrón del país",
  },
  {
    clientId: "ea071225-d227-4268-abdb-660df7511440",
    email: "mjbsol@hotmail.com",
    phone: "+3434346373077",
    expectedCountry: "+34", // España
    reason: "No cumple patrón del país",
  },
];

/**
 * Estadísticas del proceso
 */
const stats = {
  total: INVALID_NUMBERS.length,
  processed: 0,
  corrected: 0,
  failed: 0,
  corrections: [],
};

/**
 * Corrige un número específico usando lógica mejorada
 */
function correctSpecificNumber(phoneNumber, expectedCountry) {
  if (!phoneNumber) return null;

  let corrected = null;

  // Caso 1: Números sin código de país (Estados Unidos)
  if (expectedCountry === "+1" && !phoneNumber.startsWith("+")) {
    const cleaned = phoneNumber.replace(/\D/g, "");

    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      // Formato: 1XXXXXXXXXX -> +1XXXXXXXXXX
      corrected = "+" + cleaned;
    } else if (cleaned.length === 10) {
      // Formato: XXXXXXXXXX -> +1XXXXXXXXXX
      corrected = "+1" + cleaned;
    }
  }

  // Caso 2: Números con +3434 malformados (España)
  else if (expectedCountry === "+34" && phoneNumber.startsWith("+3434")) {
    const withoutPrefix = phoneNumber.substring(5); // Remover +3434
    corrected = "+34" + withoutPrefix;
  }

  // Validar el número corregido
  if (corrected) {
    const validation = validatePhoneNumber(corrected);
    if (validation.isValid) {
      return corrected;
    }
  }

  // Fallback: usar la función automática
  return (
    correctNumberWithoutCountryCode(phoneNumber) ||
    formatPhoneNumber(phoneNumber)
  );
}

/**
 * Procesa un número inválido específico
 */
async function processInvalidNumber(invalidNumber, index) {
  try {
    console.log(
      `[${index + 1}/${stats.total}] Procesando: ${invalidNumber.email}`
    );
    console.log(`   Número original: "${invalidNumber.phone}"`);
    console.log(`   Razón: ${invalidNumber.reason}`);

    // Intentar corregir el número
    const correctedPhone = correctSpecificNumber(
      invalidNumber.phone,
      invalidNumber.expectedCountry
    );

    if (!correctedPhone) {
      console.log(`❌ No se pudo corregir el número`);
      stats.failed++;
      return { success: false, reason: "No se pudo corregir" };
    }

    console.log(`   Número corregido: "${correctedPhone}"`);

    // Verificar que realmente sea válido
    const validation = validatePhoneNumber(correctedPhone);
    if (!validation.isValid) {
      console.log(
        `❌ El número corregido sigue siendo inválido: ${validation.reason}`
      );
      stats.failed++;
      return { success: false, reason: "Corrección inválida" };
    }

    // Actualizar en la base de datos
    const result = await dbManager.updateClientPhone(
      invalidNumber.clientId,
      correctedPhone
    );

    if (result.error) {
      console.error(`❌ Error actualizando cliente:`, result.error.message);
      stats.failed++;
      return {
        success: false,
        reason: "Error de base de datos",
        error: result.error.message,
      };
    }

    // Obtener información del país
    const countryInfo = getCountryInfo(correctedPhone);
    const countryName = countryInfo?.name || "Desconocido";

    console.log(`✅ Corregido exitosamente (${countryName})`);
    stats.corrected++;
    stats.corrections.push({
      clientId: invalidNumber.clientId,
      email: invalidNumber.email,
      original: invalidNumber.phone,
      corrected: correctedPhone,
      country: countryInfo?.code || "UNKNOWN",
      countryName,
    });

    return {
      success: true,
      reason: "Corregido",
      original: invalidNumber.phone,
      corrected: correctedPhone,
      country: countryInfo?.code,
    };
  } catch (error) {
    console.error(`❌ Error procesando ${invalidNumber.email}:`, error.message);
    stats.failed++;

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
  console.log(`📋 Total procesados: ${stats.total}`);
  console.log(`✅ Corregidos: ${stats.corrected}`);
  console.log(`❌ Fallidos: ${stats.failed}`);

  if (stats.corrections.length > 0) {
    console.log(`\n🔧 Correcciones realizadas (${stats.corrections.length}):`);

    // Agrupar por país
    const byCountry = {};
    stats.corrections.forEach((correction) => {
      if (!byCountry[correction.countryName]) {
        byCountry[correction.countryName] = [];
      }
      byCountry[correction.countryName].push(correction);
    });

    Object.entries(byCountry).forEach(([country, corrections]) => {
      console.log(`\n   🌍 ${country} (${corrections.length}):`);
      corrections.forEach((correction, index) => {
        console.log(`      ${index + 1}. ${correction.email}`);
        console.log(
          `         ${correction.original} → ${correction.corrected}`
        );
      });
    });
  }

  // Calcular porcentajes
  const successRate =
    stats.total > 0 ? ((stats.corrected / stats.total) * 100).toFixed(1) : 0;
  const errorRate =
    stats.total > 0 ? ((stats.failed / stats.total) * 100).toFixed(1) : 0;

  console.log(`\n📈 Tasa de éxito: ${successRate}%`);
  console.log(`📉 Tasa de error: ${errorRate}%`);
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log(
      "🚀 Iniciando corrección de números inválidos específicos...\n"
    );

    // Verificar salud de la base de datos
    const healthCheck = await dbManager.healthCheck();
    if (!healthCheck.healthy) {
      throw new Error(`Base de datos no disponible: ${healthCheck.error}`);
    }
    console.log("✅ Conexión a base de datos verificada\n");

    console.log(
      `🔄 Procesando ${stats.total} números inválidos identificados...\n`
    );

    // Procesar cada número inválido
    for (let i = 0; i < INVALID_NUMBERS.length; i++) {
      const invalidNumber = INVALID_NUMBERS[i];

      await processInvalidNumber(invalidNumber, i);
      stats.processed++;

      // Pequeña pausa entre números
      await new Promise((resolve) => setTimeout(resolve, 200));

      if ((i + 1) % 5 === 0 && i + 1 < INVALID_NUMBERS.length) {
        console.log(`⏸️  Pausa breve después de ${i + 1} números...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Mostrar estadísticas finales
    showFinalStats();

    // Log del resumen
    logger.info("Corrección de números inválidos completada", {
      total: stats.total,
      corrected: stats.corrected,
      failed: stats.failed,
      corrections: stats.corrections,
    });

    console.log("\n✅ Proceso completado exitosamente");
  } catch (error) {
    console.error("\n❌ Error en el proceso principal:", error.message);
    logger.error("Error en corrección de números inválidos", {
      error: error.message,
    });
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = { correctSpecificNumber, processInvalidNumber, main };
