/**
 * INICIALIZACIÓN DEL CACHÉ DE CONFIGURACIÓN
 *
 * Crea y valida el caché de configuración para arranque rápido
 * Ejecutar una vez para configurar el sistema
 */

const { ConfigCache } = require("../src/config/config-cache");
const {
  ConfigManager,
  ConfigValidator,
} = require("../src/config/integrations");
const { dbManager } = require("../src/config/database");
const logger = require("../src/utils/logger");

/**
 * Valida la conectividad de servicios críticos
 */
async function validateServiceConnectivity() {
  const results = {
    database: { available: false, error: null },
    twilio: { available: false, error: null },
    openai: { available: false, error: null },
    calendly: { available: false, error: null },
  };

  console.log("🔍 Validando conectividad de servicios...");

  // Validar base de datos
  try {
    const healthCheck = await dbManager.healthCheck();
    results.database.available = healthCheck.healthy;
    if (!healthCheck.healthy) {
      results.database.error = healthCheck.error;
    }
    console.log(`   📊 Base de datos: ${healthCheck.healthy ? "✅" : "❌"}`);
  } catch (error) {
    results.database.error = error.message;
    console.log(`   📊 Base de datos: ❌ ${error.message}`);
  }

  // Validar Twilio (sin hacer llamadas reales)
  try {
    const twilioConfig = ConfigManager.getConfig("twilio");
    results.twilio.available = !!(
      twilioConfig.accountSid && twilioConfig.authToken
    );
    console.log(`   📱 Twilio: ${results.twilio.available ? "✅" : "❌"}`);
  } catch (error) {
    results.twilio.error = error.message;
    console.log(`   📱 Twilio: ❌ ${error.message}`);
  }

  // Validar OpenAI (sin hacer llamadas reales)
  try {
    const openaiConfig = ConfigManager.getConfig("openai");
    results.openai.available = !!openaiConfig.apiKey;
    console.log(`   🤖 OpenAI: ${results.openai.available ? "✅" : "❌"}`);
  } catch (error) {
    results.openai.error = error.message;
    console.log(`   🤖 OpenAI: ❌ ${error.message}`);
  }

  // Validar Calendly (sin hacer llamadas reales)
  try {
    const calendlyConfig = ConfigManager.getConfig("calendly");
    results.calendly.available = !!calendlyConfig.accessToken;
    console.log(`   📅 Calendly: ${results.calendly.available ? "✅" : "❌"}`);
  } catch (error) {
    results.calendly.error = error.message;
    console.log(`   📅 Calendly: ❌ ${error.message}`);
  }

  return results;
}

/**
 * Obtiene estadísticas de números de teléfono
 */
async function getPhoneNumberStats() {
  try {
    console.log("📱 Obteniendo estadísticas de números de teléfono...");

    const clientsResult = await dbManager.getAll("clients");
    if (clientsResult.error) {
      throw new Error(
        `Error obteniendo clientes: ${clientsResult.error.message}`
      );
    }

    const clientsWithPhone = clientsResult.data.filter((c) => c.phone);

    // Importar validador de números
    const { validatePhoneNumber } = require("../utils/phoneNumberFormatter");

    let validCount = 0;
    const countryStats = {};

    for (const client of clientsWithPhone) {
      const validation = validatePhoneNumber(client.phone);
      if (validation.isValid) {
        validCount++;
        const countryCode = validation.countryCode || "UNKNOWN";
        countryStats[countryCode] = (countryStats[countryCode] || 0) + 1;
      }
    }

    const stats = {
      total: clientsWithPhone.length,
      valid: validCount,
      invalid: clientsWithPhone.length - validCount,
      validationRate:
        clientsWithPhone.length > 0
          ? ((validCount / clientsWithPhone.length) * 100).toFixed(1)
          : 0,
      byCountry: countryStats,
    };

    console.log(`   📊 Total: ${stats.total}`);
    console.log(`   ✅ Válidos: ${stats.valid} (${stats.validationRate}%)`);
    console.log(`   ❌ Inválidos: ${stats.invalid}`);

    return stats;
  } catch (error) {
    console.error(`   ❌ Error obteniendo estadísticas: ${error.message}`);
    return {
      total: 0,
      valid: 0,
      invalid: 0,
      validationRate: 0,
      byCountry: {},
      error: error.message,
    };
  }
}

/**
 * Crea la configuración completa del caché
 */
async function createCompleteConfig() {
  try {
    console.log("🔧 Creando configuración completa...");

    // Validar configuración básica
    const validation = ConfigValidator.validate(false);
    console.log(`   🔍 Validación básica: ${validation.valid ? "✅" : "❌"}`);

    if (!validation.valid) {
      console.error("   ❌ Errores encontrados:");
      validation.errors.forEach((error) => console.error(`      - ${error}`));
      return null;
    }

    // Validar conectividad de servicios
    const serviceResults = await validateServiceConnectivity();

    // Obtener estadísticas de números
    const phoneStats = await getPhoneNumberStats();

    // Crear configuración completa
    const completeConfig = {
      timestamp: Date.now(),
      valid: validation.valid,
      services: {
        supabase: {
          configured: !!(
            process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
          ),
          available: serviceResults.database.available,
          url: process.env.SUPABASE_URL,
          hasKey: !!process.env.SUPABASE_SERVICE_KEY,
          error: serviceResults.database.error,
        },
        twilio: {
          configured: !!(
            process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
          ),
          available: serviceResults.twilio.available,
          accountSid: process.env.TWILIO_ACCOUNT_SID,
          hasToken: !!process.env.TWILIO_AUTH_TOKEN,
          whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER,
          error: serviceResults.twilio.error,
        },
        openai: {
          configured: !!process.env.OPENAI_API_KEY,
          available: serviceResults.openai.available,
          hasKey: !!process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL || "gpt-4-turbo",
          error: serviceResults.openai.error,
        },
        calendly: {
          configured: !!process.env.CALENDLY_ACCESS_TOKEN,
          available: serviceResults.calendly.available,
          hasToken: !!process.env.CALENDLY_ACCESS_TOKEN,
          userUri: process.env.CALENDLY_USER_URI,
          error: serviceResults.calendly.error,
        },
        database: {
          configured: true,
          available: serviceResults.database.available,
          healthy: serviceResults.database.available,
          error: serviceResults.database.error,
        },
      },
      phoneNumbers: phoneStats,
      lastValidation: Date.now(),
      environment: process.env.NODE_ENV || "development",
      createdBy: "init-script",
      version: "1.0.0",
    };

    return completeConfig;
  } catch (error) {
    console.error("❌ Error creando configuración:", error.message);
    return null;
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log("🚀 Inicializando caché de configuración...\n");

    // Mostrar estadísticas del caché actual
    const currentStats = ConfigCache.getStats();
    console.log("📊 Estado actual del caché:");
    console.log(`   Existe: ${currentStats.exists ? "✅" : "❌"}`);
    if (currentStats.exists) {
      console.log(`   Edad: ${currentStats.age}`);
      console.log(`   Expirado: ${currentStats.expired ? "❌" : "✅"}`);
      console.log(`   Válido: ${currentStats.valid ? "✅" : "❌"}`);
    }
    console.log("");

    // Crear nueva configuración
    const newConfig = await createCompleteConfig();

    if (!newConfig) {
      console.error("❌ No se pudo crear la configuración");
      process.exit(1);
    }

    // Guardar en caché
    const saved = ConfigCache.save(newConfig);

    if (!saved) {
      console.error("❌ No se pudo guardar la configuración en caché");
      process.exit(1);
    }

    // Mostrar resumen
    console.log("\n" + "=".repeat(60));
    console.log("📋 RESUMEN DE CONFIGURACIÓN GUARDADA");
    console.log("=".repeat(60));

    console.log(`✅ Configuración válida: ${newConfig.valid ? "SÍ" : "NO"}`);
    console.log(`🌍 Entorno: ${newConfig.environment}`);
    console.log(`📅 Creado: ${new Date(newConfig.timestamp).toLocaleString()}`);

    console.log("\n🔗 Servicios configurados:");
    Object.entries(newConfig.services).forEach(([name, config]) => {
      const status = config.configured && config.available ? "✅" : "❌";
      console.log(
        `   ${status} ${name.toUpperCase()}: ${config.configured ? "Configurado" : "No configurado"} | ${config.available ? "Disponible" : "No disponible"}`
      );
      if (config.error) {
        console.log(`      ⚠️  Error: ${config.error}`);
      }
    });

    if (newConfig.phoneNumbers && newConfig.phoneNumbers.total > 0) {
      console.log("\n📱 Números de teléfono:");
      console.log(`   📊 Total: ${newConfig.phoneNumbers.total}`);
      console.log(
        `   ✅ Válidos: ${newConfig.phoneNumbers.valid} (${newConfig.phoneNumbers.validationRate}%)`
      );
      console.log(`   ❌ Inválidos: ${newConfig.phoneNumbers.invalid}`);
    }

    // Log del resultado
    logger.info("Caché de configuración inicializado", {
      valid: newConfig.valid,
      services: Object.keys(newConfig.services),
      phoneStats: newConfig.phoneNumbers,
    });

    console.log("\n✅ Caché de configuración inicializado correctamente");
    console.log("🚀 El servidor ahora puede arrancar rápidamente");
  } catch (error) {
    console.error("\n❌ Error en la inicialización:", error.message);
    logger.error("Error inicializando caché de configuración", {
      error: error.message,
    });
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = { createCompleteConfig, validateServiceConnectivity, main };
