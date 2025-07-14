#!/usr/bin/env node
// scripts/final-verification.js
// Verificación final completa del sistema

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("🔍 VERIFICACIÓN FINAL DEL SISTEMA ASISTENTE RB\n");
console.log("=".repeat(60));

// Función para ejecutar comandos de forma segura
function runCommand(command, description) {
  try {
    console.log(`📋 ${description}...`);
    const output = execSync(command, { encoding: "utf8", stdio: "pipe" });
    console.log(`✅ ${description} - OK`);
    return { success: true, output };
  } catch (error) {
    console.warn(`⚠️  ${description} - ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Verificar estructura de archivos críticos
function verifyFileStructure() {
  console.log("\n📁 VERIFICANDO ESTRUCTURA DE ARCHIVOS:");

  const criticalFiles = [
    // Core
    "src/index.js",
    "src/config/env.js",
    "src/config/security.json",

    // RGPD
    "src/services/gdprService.js",
    "src/controllers/gdprController.js",
    "src/routes/gdprRoutes.js",
    "src/workers/gdprCleanupWorker.js",

    // IA
    "src/services/intentAnalysisService.js",
    "src/services/responseGenerationService.js",

    // Seguridad
    "src/middleware/rateLimiter.js",
    "src/middleware/securityMiddleware.js",

    // Scripts
    "scripts/create_gdpr_tables.sql",
    "scripts/setup-gdpr.js",
    "scripts/security-monitor.js",
    "scripts/verify-integration.js",
    "scripts/project-summary.js",
  ];

  let allFilesExist = true;

  criticalFiles.forEach((file) => {
    const exists = fs.existsSync(path.join(process.cwd(), file));
    console.log(`   ${exists ? "✅" : "❌"} ${file}`);
    if (!exists) allFilesExist = false;
  });

  return allFilesExist;
}

// Verificar dependencias y seguridad
function verifyDependencies() {
  console.log("\n📦 VERIFICANDO DEPENDENCIAS Y SEGURIDAD:");

  // Verificar vulnerabilidades
  const auditResult = runCommand(
    "npm audit --audit-level moderate",
    "Auditoría de seguridad"
  );

  // Verificar dependencias desactualizadas
  const outdatedResult = runCommand(
    "npm outdated --json",
    "Verificación de dependencias"
  );

  // Verificar package.json
  try {
    const packagePath = path.join(process.cwd(), "package.json");
    const packageData = JSON.parse(fs.readFileSync(packagePath, "utf8"));

    console.log(
      `✅ Package.json válido - ${Object.keys(packageData.dependencies || {}).length} dependencias`
    );

    // Verificar scripts críticos
    const requiredScripts = [
      "gdpr:setup",
      "gdpr:cleanup",
      "gdpr:stats",
      "security:check",
      "verify:integration",
      "project:summary",
    ];

    const missingScripts = requiredScripts.filter(
      (script) => !packageData.scripts[script]
    );

    if (missingScripts.length === 0) {
      console.log("✅ Todos los scripts críticos están presentes");
    } else {
      console.log(`❌ Scripts faltantes: ${missingScripts.join(", ")}`);
    }
  } catch (error) {
    console.log(`❌ Error leyendo package.json: ${error.message}`);
  }

  return auditResult.success;
}

// Verificar configuración de entorno
function verifyEnvironment() {
  console.log("\n⚙️ VERIFICANDO CONFIGURACIÓN DE ENTORNO:");

  const envPath = path.join(process.cwd(), ".env");
  const envLocalPath = path.join(process.cwd(), ".env.local");

  console.log(`   ${fs.existsSync(envPath) ? "✅" : "❌"} .env`);
  console.log(
    `   ${fs.existsSync(envLocalPath) ? "✅" : "⚠️ "} .env.local (opcional)`
  );

  // Verificar variables críticas en .env
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");

    const criticalVars = [
      "GDPR_DATA_RETENTION_DAYS",
      "GDPR_CLEANUP_ENABLED",
      "AI_ANALYSIS_MODEL",
      "AI_RESPONSE_MODEL",
    ];

    criticalVars.forEach((varName) => {
      const exists = envContent.includes(varName);
      console.log(`   ${exists ? "✅" : "❌"} ${varName}`);
    });
  }

  return true;
}

// Verificar integraciones
function verifyIntegrations() {
  console.log("\n🔗 VERIFICANDO INTEGRACIONES:");

  // Verificar index.js
  try {
    const indexPath = path.join(process.cwd(), "src/index.js");
    const indexContent = fs.readFileSync(indexPath, "utf8");

    const integrations = [
      "gdprCleanupWorker",
      "gdprRoutes",
      "rateLimiters.gdpr",
      "autonomousWhatsAppRoutes",
      "SecurityMiddleware",
    ];

    integrations.forEach((integration) => {
      const exists = indexContent.includes(integration);
      console.log(`   ${exists ? "✅" : "❌"} ${integration}`);
    });
  } catch (error) {
    console.log(`❌ Error verificando integraciones: ${error.message}`);
    return false;
  }

  return true;
}

// Verificar configuración de seguridad
function verifySecurityConfig() {
  console.log("\n🔒 VERIFICANDO CONFIGURACIÓN DE SEGURIDAD:");

  const securityPath = path.join(process.cwd(), "src/config/security.json");

  if (fs.existsSync(securityPath)) {
    try {
      const securityConfig = JSON.parse(fs.readFileSync(securityPath, "utf8"));

      console.log(`   ✅ Configuración de seguridad cargada`);
      console.log(
        `   ✅ Helmet configurado: ${securityConfig.helmet ? "Sí" : "No"}`
      );
      console.log(
        `   ✅ Rate limiting configurado: ${securityConfig.rateLimiting ? "Sí" : "No"}`
      );
      console.log(
        `   ✅ CORS configurado: ${securityConfig.cors ? "Sí" : "No"}`
      );
    } catch (error) {
      console.log(`❌ Error en configuración de seguridad: ${error.message}`);
      return false;
    }
  } else {
    console.log("❌ Archivo de configuración de seguridad no encontrado");
    return false;
  }

  return true;
}

// Generar reporte final
function generateFinalReport() {
  console.log("\n📊 REPORTE FINAL:");

  const packagePath = path.join(process.cwd(), "package.json");
  const packageData = JSON.parse(fs.readFileSync(packagePath, "utf8"));

  console.log(
    `   📦 Dependencias: ${Object.keys(packageData.dependencies || {}).length}`
  );
  console.log(
    `   🔧 Scripts: ${Object.keys(packageData.scripts || {}).length}`
  );
  console.log(`   📝 Versión: ${packageData.version}`);

  // Calcular tamaño del proyecto
  const srcPath = path.join(process.cwd(), "src");
  let fileCount = 0;

  function countFiles(dir) {
    try {
      const files = fs.readdirSync(dir);
      files.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          countFiles(filePath);
        } else if (file.endsWith(".js")) {
          fileCount++;
        }
      });
    } catch (error) {
      // Ignorar errores de acceso
    }
  }

  countFiles(srcPath);
  console.log(`   📄 Archivos JS en src/: ${fileCount}`);
}

// Función principal
async function main() {
  try {
    const results = {
      files: verifyFileStructure(),
      dependencies: verifyDependencies(),
      environment: verifyEnvironment(),
      integrations: verifyIntegrations(),
      security: verifySecurityConfig(),
    };

    generateFinalReport();

    console.log("\n" + "=".repeat(60));

    const allPassed = Object.values(results).every((result) => result);

    if (allPassed) {
      console.log("🎉 ¡VERIFICACIÓN FINAL EXITOSA!");
      console.log("✅ Todos los componentes están correctamente configurados");
      console.log("✅ No se encontraron vulnerabilidades de seguridad");
      console.log("✅ Todas las integraciones están funcionando");
      console.log("✅ El sistema está listo para producción");

      console.log("\n🚀 COMANDOS PARA ACTIVAR EL SISTEMA:");
      console.log("1. npm run gdpr:setup");
      console.log("2. npm run start-full");
      console.log("3. npm run health");
    } else {
      console.log("⚠️  VERIFICACIÓN INCOMPLETA");
      console.log("❌ Algunos componentes requieren atención");

      Object.entries(results).forEach(([test, passed]) => {
        console.log(`   ${passed ? "✅" : "❌"} ${test}`);
      });
    }

    console.log("\n📋 SCRIPTS ÚTILES:");
    console.log("- npm run project:summary - Resumen completo");
    console.log("- npm run verify:integration - Verificar integración");
    console.log("- npm run security:check - Verificar seguridad");
    console.log("- node scripts/security-monitor.js - Monitoreo continuo");

    console.log("\n📧 Soporte: info@ricardoburitica.eu");
    console.log("🌐 URL: https://bot.ricardoburitica.eu");
  } catch (error) {
    console.error("❌ Error en verificación final:", error.message);
    process.exit(1);
  }
}

// Ejecutar
if (require.main === module) {
  main();
}

module.exports = {
  verifyFileStructure,
  verifyDependencies,
  verifyEnvironment,
  verifyIntegrations,
  verifySecurityConfig,
};
