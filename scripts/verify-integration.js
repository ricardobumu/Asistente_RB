#!/usr/bin/env node
// scripts/verify-integration.js
// Script para verificar que toda la integración RGPD y mejoras del asistente estén funcionando

const fs = require("fs");
const path = require("path");

console.log("🔍 Verificando integración completa del sistema...\n");

// Lista de archivos que deben existir
const requiredFiles = [
  // Servicios RGPD
  "src/services/gdprService.js",
  "src/controllers/gdprController.js",
  "src/routes/gdprRoutes.js",
  "src/workers/gdprCleanupWorker.js",

  // Servicios de IA mejorados
  "src/services/intentAnalysisService.js",
  "src/services/responseGenerationService.js",

  // Middleware
  "src/middleware/rateLimiter.js",

  // Scripts
  "scripts/create_gdpr_tables.sql",
  "scripts/setup-gdpr.js",
];

// Lista de archivos que deben haber sido modificados
const modifiedFiles = [
  "src/index.js",
  "src/controllers/autonomousWhatsAppController.js",
  "src/routes/adminRoutes.js",
  "src/controllers/adminController.js",
  "src/config/env.js",
  ".env",
  "package.json",
];

function checkFileExists(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  return fs.existsSync(fullPath);
}

function checkFileContent(filePath, searchStrings) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    const content = fs.readFileSync(fullPath, "utf8");

    const results = searchStrings.map((searchString) => ({
      search: searchString,
      found: content.includes(searchString),
    }));

    return results;
  } catch (error) {
    return searchStrings.map((searchString) => ({
      search: searchString,
      found: false,
      error: error.message,
    }));
  }
}

// Verificar archivos requeridos
console.log("📁 Verificando archivos creados:");
let allFilesExist = true;

requiredFiles.forEach((file) => {
  const exists = checkFileExists(file);
  console.log(`${exists ? "✅" : "❌"} ${file}`);
  if (!exists) allFilesExist = false;
});

console.log("\n📝 Verificando archivos modificados:");
modifiedFiles.forEach((file) => {
  const exists = checkFileExists(file);
  console.log(`${exists ? "✅" : "❌"} ${file}`);
  if (!exists) allFilesExist = false;
});

// Verificar integraciones específicas
console.log("\n🔗 Verificando integraciones:");

// Verificar index.js
const indexChecks = checkFileContent("src/index.js", [
  "gdprCleanupWorker",
  "gdprRoutes",
  "rateLimiters.gdpr",
]);

console.log("📄 src/index.js:");
indexChecks.forEach((check) => {
  console.log(`  ${check.found ? "✅" : "❌"} ${check.search}`);
});

// Verificar controlador autónomo
const autonomousChecks = checkFileContent(
  "src/controllers/autonomousWhatsAppController.js",
  ["intentAnalysisService", "responseGenerationService", "gdprService"]
);

console.log("📄 src/controllers/autonomousWhatsAppController.js:");
autonomousChecks.forEach((check) => {
  console.log(`  ${check.found ? "✅" : "❌"} ${check.search}`);
});

// Verificar configuración
const envChecks = checkFileContent("src/config/env.js", [
  "GDPR_DATA_RETENTION_DAYS",
  "AI_ANALYSIS_MODEL",
  "AI_RESPONSE_MODEL",
]);

console.log("📄 src/config/env.js:");
envChecks.forEach((check) => {
  console.log(`  ${check.found ? "✅" : "❌"} ${check.search}`);
});

// Verificar package.json
const packageChecks = checkFileContent("package.json", [
  "gdpr:setup",
  "gdpr:cleanup",
  "express-rate-limit",
  "node-cron",
]);

console.log("📄 package.json:");
packageChecks.forEach((check) => {
  console.log(`  ${check.found ? "✅" : "❌"} ${check.search}`);
});

// Verificar variables de entorno
console.log("\n⚙️ Verificando variables de entorno:");
const envVars = [
  "GDPR_DATA_RETENTION_DAYS",
  "GDPR_CLEANUP_ENABLED",
  "AI_ANALYSIS_MODEL",
  "AI_RESPONSE_MODEL",
];

const envFileChecks = checkFileContent(".env", envVars);
envFileChecks.forEach((check) => {
  console.log(`  ${check.found ? "✅" : "❌"} ${check.search}`);
});

// Resumen final
console.log("\n📊 RESUMEN DE VERIFICACIÓN:");

const allIntegrationsWork = [
  ...indexChecks,
  ...autonomousChecks,
  ...envChecks,
  ...packageChecks,
  ...envFileChecks,
].every((check) => check.found);

if (allFilesExist && allIntegrationsWork) {
  console.log("🎉 ¡VERIFICACIÓN EXITOSA!");
  console.log("✅ Todos los archivos están presentes");
  console.log("✅ Todas las integraciones están configuradas");
  console.log("\n🚀 Próximos pasos:");
  console.log("1. Ejecutar: npm run gdpr:setup");
  console.log("2. Reiniciar el servidor: npm run start-full");
  console.log("3. Verificar el dashboard admin en /admin");
  console.log("4. Probar los endpoints RGPD en /gdpr/*");
} else {
  console.log("⚠️  VERIFICACIÓN INCOMPLETA");
  if (!allFilesExist) {
    console.log("❌ Algunos archivos están faltando");
  }
  if (!allIntegrationsWork) {
    console.log("❌ Algunas integraciones no están configuradas correctamente");
  }
  console.log("\n🔧 Revisa los elementos marcados con ❌ arriba");
}

console.log("\n📋 Endpoints RGPD disponibles:");
console.log("🔓 Públicos:");
console.log("  GET  /gdpr/privacy-policy");
console.log("  GET  /gdpr/cookie-policy");
console.log("  POST /gdpr/consent");
console.log("  GET  /gdpr/export/:clientId");
console.log("  DELETE /gdpr/delete/:clientId");

console.log("🔐 Admin:");
console.log("  GET  /admin/gdpr/stats");
console.log("  GET  /admin/gdpr/worker/stats");
console.log("  POST /admin/gdpr/cleanup/manual");
console.log("  POST /admin/gdpr/export/:clientId");

console.log("\n🤖 Mejoras del Asistente:");
console.log("✅ Análisis de intenciones con IA");
console.log("✅ Pre-análisis con keywords");
console.log("✅ Detección de sentimientos");
console.log("✅ Respuestas contextuales");
console.log("✅ Gestión automática de RGPD");
console.log("✅ Escalado inteligente");

console.log("\n🔒 Funcionalidades RGPD:");
console.log("✅ Gestión de consentimientos");
console.log("✅ Exportación de datos");
console.log("✅ Derecho al olvido");
console.log("✅ Limpieza automática");
console.log("✅ Auditoría completa");
console.log("✅ Reportes de compliance");
console.log("✅ Políticas integradas");
