/**
 * SCRIPT DE DESPLIEGUE AUTOMATIZADO A RAILWAY
 *
 * Automatiza el proceso completo de despliegue:
 * 1. Verificación de preparación
 * 2. Commit y push a GitHub
 * 3. Monitoreo del despliegue
 * 4. Verificación post-despliegue
 *
 * @author Ricardo Buriticá - Asistente RB Team
 * @version 2.1.0
 * @since 2024
 */

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

console.log("🚀 DESPLIEGUE AUTOMATIZADO A RAILWAY");
console.log("=".repeat(60));

const PRODUCTION_URL = "https://bot.ricardoburitica.eu";
const HEALTH_ENDPOINT = `${PRODUCTION_URL}/health`;

// ===== FUNCIONES AUXILIARES =====

const executeCommand = (command, description) => {
  try {
    console.log(`\n🔄 ${description}...`);
    const output = execSync(command, { encoding: "utf8", stdio: "pipe" });
    console.log(`✅ ${description} completado`);
    return output;
  } catch (error) {
    console.log(`❌ Error en ${description}:`);
    console.log(error.message);
    throw error;
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const checkHealth = async (url, maxRetries = 10, delay = 30000) => {
  console.log(`\n🏥 Verificando health check en: ${url}`);

  for (let i = 1; i <= maxRetries; i++) {
    try {
      console.log(`   Intento ${i}/${maxRetries}...`);
      const response = await axios.get(url, { timeout: 10000 });

      if (response.status === 200 && response.data.status === "OK") {
        console.log("✅ Health check exitoso!");
        console.log(`   Status: ${response.data.status}`);
        console.log(`   Version: ${response.data.version}`);
        console.log(`   Environment: ${response.data.environment}`);
        console.log(`   Uptime: ${response.data.uptime}s`);
        return true;
      }
    } catch (error) {
      console.log(`   ❌ Intento ${i} falló: ${error.message}`);

      if (i < maxRetries) {
        console.log(
          `   ⏳ Esperando ${delay / 1000}s antes del siguiente intento...`
        );
        await sleep(delay);
      }
    }
  }

  return false;
};

// ===== PROCESO PRINCIPAL =====

const deployToRailway = async () => {
  try {
    console.log("📋 Iniciando proceso de despliegue...");

    // 1. Verificación de preparación
    console.log("\n" + "=".repeat(40));
    console.log("PASO 1: VERIFICACIÓN DE PREPARACIÓN");
    console.log("=".repeat(40));

    try {
      executeCommand(
        "node scripts/production-readiness-check.js",
        "Verificación de preparación"
      );
    } catch (error) {
      console.log("❌ La verificación de preparación falló.");
      console.log(
        "🔧 Corrige los errores antes de continuar con el despliegue."
      );
      process.exit(1);
    }

    // 2. Verificar estado de Git
    console.log("\n" + "=".repeat(40));
    console.log("PASO 2: VERIFICACIÓN DE GIT");
    console.log("=".repeat(40));

    try {
      const gitStatus = executeCommand(
        "git status --porcelain",
        "Verificando estado de Git"
      );

      if (gitStatus.trim()) {
        console.log("📝 Cambios detectados, preparando commit...");

        // Agregar todos los archivos
        executeCommand("git add .", "Agregando archivos al staging");

        // Crear commit con timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const commitMessage = `Deploy to production - ${timestamp}`;
        executeCommand(`git commit -m "${commitMessage}"`, "Creando commit");

        console.log(`✅ Commit creado: ${commitMessage}`);
      } else {
        console.log("✅ No hay cambios pendientes");
      }
    } catch (error) {
      console.log("⚠️ Error en Git, continuando...");
    }

    // 3. Push a GitHub
    console.log("\n" + "=".repeat(40));
    console.log("PASO 3: PUSH A GITHUB");
    console.log("=".repeat(40));

    try {
      executeCommand("git push origin main", "Pushing a GitHub");
      console.log("✅ Código enviado a GitHub exitosamente");
    } catch (error) {
      console.log("❌ Error haciendo push a GitHub");
      console.log("🔧 Verifica tu configuración de Git y conexión a internet");
      throw error;
    }

    // 4. Esperar despliegue en Railway
    console.log("\n" + "=".repeat(40));
    console.log("PASO 4: ESPERANDO DESPLIEGUE EN RAILWAY");
    console.log("=".repeat(40));

    console.log(
      "⏳ Railway detectará automáticamente el push y comenzará el despliegue..."
    );
    console.log(
      "📱 Puedes monitorear el progreso en: https://railway.app/dashboard"
    );
    console.log("⏱️ El despliegue típicamente toma 2-5 minutos...");

    // Esperar un tiempo inicial para que Railway comience el build
    console.log(
      "\n⏳ Esperando 60 segundos para que Railway inicie el build..."
    );
    await sleep(60000);

    // 5. Verificación post-despliegue
    console.log("\n" + "=".repeat(40));
    console.log("PASO 5: VERIFICACIÓN POST-DESPLIEGUE");
    console.log("=".repeat(40));

    const healthCheckSuccess = await checkHealth(HEALTH_ENDPOINT);

    if (healthCheckSuccess) {
      console.log("\n🎉 ¡DESPLIEGUE EXITOSO!");
      console.log(
        "✅ La aplicación está funcionando correctamente en producción"
      );

      // 6. Verificaciones adicionales
      console.log("\n" + "=".repeat(40));
      console.log("PASO 6: VERIFICACIONES ADICIONALES");
      console.log("=".repeat(40));

      const endpoints = [
        `${PRODUCTION_URL}/`,
        `${PRODUCTION_URL}/api`,
        `${PRODUCTION_URL}/admin`,
        `${PRODUCTION_URL}/client`,
        `${PRODUCTION_URL}/widget`,
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await axios.get(endpoint, { timeout: 5000 });
          console.log(`✅ ${endpoint} - Status: ${response.status}`);
        } catch (error) {
          console.log(`⚠️ ${endpoint} - Error: ${error.message}`);
        }
      }

      // 7. Instrucciones finales
      console.log("\n" + "=".repeat(60));
      console.log("🎯 CONFIGURACIÓN FINAL REQUERIDA");
      console.log("=".repeat(60));

      console.log("\n📱 WEBHOOKS DE TWILIO:");
      console.log(`   URL: ${PRODUCTION_URL}/webhook/whatsapp`);
      console.log("   Método: POST");
      console.log("   Configura en: https://console.twilio.com/");

      console.log("\n📅 WEBHOOKS DE CALENDLY:");
      console.log(`   URL: ${PRODUCTION_URL}/api/calendly/webhook`);
      console.log("   Eventos: invitee.created, invitee.canceled");
      console.log(
        "   Configura en: https://calendly.com/integrations/webhooks"
      );

      console.log("\n🔐 VARIABLES DE ENTORNO:");
      console.log(
        "   Verifica que todas las variables estén configuradas en Railway"
      );
      console.log("   Dashboard: https://railway.app/dashboard");

      console.log("\n📊 MONITOREO:");
      console.log(`   Health Check: ${HEALTH_ENDPOINT}`);
      console.log(`   Logs: https://railway.app/dashboard`);
      console.log(`   Métricas: ${PRODUCTION_URL}/metrics`);

      console.log("\n✅ DESPLIEGUE COMPLETADO EXITOSAMENTE");
    } else {
      console.log("\n❌ DESPLIEGUE FALLÓ");
      console.log("🔧 El health check no pasó después de múltiples intentos");
      console.log(
        "📱 Revisa los logs en Railway: https://railway.app/dashboard"
      );
      console.log("🔍 Posibles causas:");
      console.log("   - Variables de entorno faltantes o incorrectas");
      console.log("   - Error en el código");
      console.log("   - Problemas de conectividad con servicios externos");
      console.log("   - Timeout durante el startup");

      process.exit(1);
    }
  } catch (error) {
    console.log("\n💥 ERROR DURANTE EL DESPLIEGUE");
    console.log("=".repeat(40));
    console.log("Error:", error.message);
    console.log("\n🔧 ACCIONES RECOMENDADAS:");
    console.log("1. Revisa los logs de error arriba");
    console.log("2. Corrige los problemas identificados");
    console.log("3. Ejecuta el script nuevamente");
    console.log("4. Si persiste, revisa los logs en Railway");

    process.exit(1);
  }
};

// ===== VERIFICACIONES INICIALES =====

console.log("🔍 Verificando requisitos previos...");

// Verificar que estamos en el directorio correcto
if (!fs.existsSync("package.json")) {
  console.log("❌ No se encontró package.json");
  console.log("🔧 Ejecuta este script desde el directorio raíz del proyecto");
  process.exit(1);
}

// Verificar que Git esté configurado
try {
  executeCommand("git --version", "Verificando Git");
} catch (error) {
  console.log("❌ Git no está instalado o configurado");
  console.log("🔧 Instala Git y configura tu repositorio");
  process.exit(1);
}

// Verificar conexión a internet
console.log("🌐 Verificando conexión a internet...");
axios
  .get("https://api.github.com", { timeout: 5000 })
  .then(() => {
    console.log("✅ Conexión a internet verificada");
    deployToRailway();
  })
  .catch((error) => {
    console.log("❌ No hay conexión a internet");
    console.log("🔧 Verifica tu conexión y vuelve a intentar");
    process.exit(1);
  });
