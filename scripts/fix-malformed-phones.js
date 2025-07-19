/**
 * SCRIPT ESPECÍFICO PARA CORREGIR NÚMEROS MALFORMADOS
 *
 * Este script corrige específicamente los números con formato +3434XXXXXXXXX
 * que son comunes en la base de datos actual
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
  corrected: 0,
  alreadyCorrect: 0,
  invalid: 0,
  errors: 0,
  corrections: [],
};

/**
 * Corrige un número malformado específico
 */
function correctMalformedPhone(phone) {
  if (!phone || typeof phone !== "string") {
    return null;
  }

  let corrected = phone.trim();

  // Caso 1: +3434XXXXXXXXX -> +34XXXXXXXXX
  if (corrected.startsWith("+3434") && corrected.length >= 13) {
    corrected = "+34" + corrected.substring(5);
    return { corrected, reason: "Eliminado +3434 duplicado" };
  }

  // Caso 2: Números sin + al inicio pero que empiezan con 3434
  if (corrected.startsWith("3434") && corrected.length >= 12) {
    corrected = "+34" + corrected.substring(4);
    return { corrected, reason: "Agregado + y eliminado 34 duplicado" };
  }

  // Caso 3: Números muy largos con +34 seguido de otro 34
  if (corrected.startsWith("+34") && corrected.length > 12) {
    const withoutCountryCode = corrected.substring(3);
    if (withoutCountryCode.startsWith("34")) {
      corrected = "+34" + withoutCountryCode.substring(2);
      return { corrected, reason: "Eliminado código de país duplicado" };
    }
  }

  return null; // No necesita corrección
}

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
      return { success: true, reason: "Sin teléfono" };
    }

    // Intentar corregir el número malformado
    const correction = correctMalformedPhone(originalPhone);

    if (!correction) {
      // Verificar si ya está en formato correcto
      const validation = validatePhoneNumber(originalPhone);
      if (validation.isValid) {
        console.log(`✅ Número ya correcto: ${originalPhone}`);
        stats.alreadyCorrect++;
        return { success: true, reason: "Ya correcto" };
      } else {
        console.log(
          `⚠️  Número no se puede corregir: ${originalPhone} - ${validation.reason}`
        );
        stats.invalid++;
        return { success: true, reason: "No corregible" };
      }
    }

    const correctedPhone = correction.corrected;

    // Validar el número corregido
    const validation = validatePhoneNumber(correctedPhone);
    if (!validation.isValid) {
      console.log(
        `❌ Número corregido sigue siendo inválido: ${correctedPhone} - ${validation.reason}`
      );
      stats.invalid++;
      return { success: false, reason: "Corrección inválida" };
    }

    // Formatear el número corregido
    const formattedPhone = formatPhoneNumber(correctedPhone);
    if (!formattedPhone) {
      console.log(
        `❌ No se pudo formatear el número corregido: ${correctedPhone}`
      );
      stats.invalid++;
      return { success: false, reason: "Error de formateo" };
    }

    // Actualizar en la base de datos
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
      `✅ Corregido: ${originalPhone} → ${formattedPhone} (${correction.reason})`
    );
    stats.corrected++;
    stats.corrections.push({
      clientId: client.id,
      original: originalPhone,
      corrected: formattedPhone,
      reason: correction.reason,
    });

    return {
      success: true,
      reason: "Corregido",
      original: originalPhone,
      corrected: formattedPhone,
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
 * Obtiene clientes con números potencialmente malformados
 */
async function getMalformedClients() {
  try {
    console.log(
      "📋 Obteniendo clientes con números potencialmente malformados..."
    );

    const result = await dbManager.getAll("clients", {
      orderBy: { column: "created_at", ascending: false },
    });

    if (result.error) {
      throw new Error(`Error obteniendo clientes: ${result.error.message}`);
    }

    // Filtrar solo clientes con números que podrían estar malformados
    const malformedClients = result.data.filter((client) => {
      if (!client.phone) return false;

      const phone = client.phone.toString();

      // Buscar patrones malformados
      return (
        phone.startsWith("+3434") || // +3434XXXXXXXXX
        phone.startsWith("3434") || // 3434XXXXXXXXX
        (phone.startsWith("+34") && phone.length > 12) || // +34 con números extra
        phone.includes("3434") // Cualquier duplicación de 34
      );
    });

    console.log(`📊 Total de clientes: ${result.data.length}`);
    console.log(
      `🔍 Clientes con números potencialmente malformados: ${malformedClients.length}`
    );

    return malformedClients;
  } catch (error) {
    console.error("❌ Error obteniendo clientes:", error.message);
    logger.error("Error obteniendo clientes malformados", {
      error: error.message,
    });
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
  console.log(`📋 Total procesados: ${stats.total}`);
  console.log(`✅ Corregidos: ${stats.corrected}`);
  console.log(`✅ Ya correctos: ${stats.alreadyCorrect}`);
  console.log(`⚠️  Inválidos: ${stats.invalid}`);
  console.log(`💥 Errores: ${stats.errors}`);

  if (stats.corrections.length > 0) {
    console.log(`\n🔧 Correcciones realizadas (${stats.corrections.length}):`);
    stats.corrections.slice(0, 10).forEach((correction, index) => {
      console.log(
        `   ${index + 1}. ${correction.original} → ${correction.corrected}`
      );
      console.log(`      Razón: ${correction.reason}`);
    });

    if (stats.corrections.length > 10) {
      console.log(`   ... y ${stats.corrections.length - 10} correcciones más`);
    }
  }

  // Calcular porcentajes
  const successRate =
    stats.total > 0
      ? (
          ((stats.corrected + stats.alreadyCorrect) / stats.total) *
          100
        ).toFixed(1)
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
    console.log("🚀 Iniciando corrección de números malformados...\n");

    // Verificar salud de la base de datos
    const healthCheck = await dbManager.healthCheck();
    if (!healthCheck.healthy) {
      throw new Error(`Base de datos no disponible: ${healthCheck.error}`);
    }
    console.log("✅ Conexión a base de datos verificada\n");

    // Obtener clientes con números malformados
    const clients = await getMalformedClients();
    stats.total = clients.length;

    if (stats.total === 0) {
      console.log("✅ No se encontraron números malformados para corregir");
      return;
    }

    console.log(
      `\n🔄 Procesando ${stats.total} clientes con números malformados...\n`
    );

    // Procesar clientes
    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];

      await processClient(client, i);
      stats.processed++;

      // Pequeña pausa entre clientes
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Pausa más larga cada 20 clientes
      if ((i + 1) % 20 === 0 && i + 1 < clients.length) {
        console.log(`⏸️  Pausa breve después de ${i + 1} clientes...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Mostrar estadísticas finales
    showFinalStats();

    // Log del resumen
    logger.info("Corrección de números malformados completada", {
      total: stats.total,
      corrected: stats.corrected,
      alreadyCorrect: stats.alreadyCorrect,
      invalid: stats.invalid,
      errors: stats.errors,
      corrections: stats.corrections.length,
    });

    console.log("\n✅ Proceso completado exitosamente");
  } catch (error) {
    console.error("\n❌ Error en el proceso principal:", error.message);
    logger.error("Error en corrección de números malformados", {
      error: error.message,
    });
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = { correctMalformedPhone, processClient, main };
