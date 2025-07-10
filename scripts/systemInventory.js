// scripts/systemInventory.js
// Inventario completo del sistema para verificar que todo existe

const fs = require("fs");
const path = require("path");

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return Math.round(stats.size / 1024);
  } catch {
    return 0;
  }
}

function checkFileExists(filePath) {
  return fs.existsSync(filePath) ? "✅" : "❌";
}

async function systemInventory() {
  console.log("🔍 INVENTARIO COMPLETO DEL SISTEMA RICARDO BURITICÁ");
  console.log("==================================================\n");

  const baseDir = process.cwd();

  // 1. CONFIGURACIÓN CRÍTICA
  console.log("🔐 CONFIGURACIÓN CRÍTICA:");
  const configFiles = [".env", ".env.local", "package.json", "railway.toml"];

  configFiles.forEach((file) => {
    const fullPath = path.join(baseDir, file);
    const status = checkFileExists(fullPath);
    const size = getFileSize(fullPath);
    console.log(`   ${status} ${file} (${size} KB)`);
  });

  // 2. MODELOS DE DATOS
  console.log("\n📊 MODELOS DE DATOS:");
  const models = [
    "src/models/bookingModel.js",
    "src/models/clientModel.js",
    "src/models/serviceModel.js",
    "src/models/userModel.js",
    "src/models/notificationModel.js",
    "src/models/adaptedServiceModel.js",
  ];

  models.forEach((file) => {
    const fullPath = path.join(baseDir, file);
    const status = checkFileExists(fullPath);
    const size = getFileSize(fullPath);
    console.log(`   ${status} ${file} (${size} KB)`);
  });

  // 3. INTEGRACIONES EXTERNAS
  console.log("\n🔌 INTEGRACIONES EXTERNAS:");
  const integrations = [
    "src/integrations/supabaseClient.js",
    "src/integrations/supabaseAdmin.js",
    "src/integrations/twilioClient.js",
    "src/integrations/calendlyClient.js",
    "src/integrations/openaiClient.js",
  ];

  integrations.forEach((file) => {
    const fullPath = path.join(baseDir, file);
    const status = checkFileExists(fullPath);
    const size = getFileSize(fullPath);
    console.log(`   ${status} ${file} (${size} KB)`);
  });

  // 4. API Y RUTAS
  console.log("\n🌐 API Y RUTAS:");
  const apiFiles = [
    "src/api/index.js",
    "src/api/servicios.js",
    "src/routes/autonomousWhatsAppRoutes.js",
    "src/routes/bookingWidgetRoutes.js",
    "src/routes/adminRoutes.js",
    "src/routes/calendlyWebhookRoutes.js",
    "src/routes/clientPortalRoutes.js",
  ];

  apiFiles.forEach((file) => {
    const fullPath = path.join(baseDir, file);
    const status = checkFileExists(fullPath);
    const size = getFileSize(fullPath);
    console.log(`   ${status} ${file} (${size} KB)`);
  });

  // 5. PORTAL CLIENTE
  console.log("\n🎨 PORTAL CLIENTE:");
  const clientFiles = [
    "public/client/ricardo-portal.html",
    "public/client/client-ricardo.js",
    "public/client/index.html",
    "public/client/client.js",
  ];

  clientFiles.forEach((file) => {
    const fullPath = path.join(baseDir, file);
    const status = checkFileExists(fullPath);
    const size = getFileSize(fullPath);
    console.log(`   ${status} ${file} (${size} KB)`);
  });

  // 6. PANEL ADMINISTRATIVO
  console.log("\n👨‍💼 PANEL ADMINISTRATIVO:");
  const adminFiles = [
    "public/admin/index.html",
    "public/admin/dashboard.js",
    "public/admin/login.html",
  ];

  adminFiles.forEach((file) => {
    const fullPath = path.join(baseDir, file);
    const status = checkFileExists(fullPath);
    const size = getFileSize(fullPath);
    console.log(`   ${status} ${file} (${size} KB)`);
  });

  // 7. SERVICIOS Y CONTROLADORES
  console.log("\n⚙️ SERVICIOS Y CONTROLADORES:");
  const services = [
    "src/services/bookingService.js",
    "src/services/notificationService.js",
    "src/services/whatsappService.js",
    "src/controllers/bookingController.js",
    "src/controllers/clientController.js",
  ];

  services.forEach((file) => {
    const fullPath = path.join(baseDir, file);
    const status = checkFileExists(fullPath);
    const size = getFileSize(fullPath);
    console.log(`   ${status} ${file} (${size} KB)`);
  });

  // 8. MIDDLEWARE Y SEGURIDAD
  console.log("\n🛡️ MIDDLEWARE Y SEGURIDAD:");
  const middleware = [
    "src/middleware/securityMiddleware.js",
    "src/middleware/auditMiddleware.js",
    "src/middleware/errorHandler.js",
    "src/middleware/authMiddleware.js",
  ];

  middleware.forEach((file) => {
    const fullPath = path.join(baseDir, file);
    const status = checkFileExists(fullPath);
    const size = getFileSize(fullPath);
    console.log(`   ${status} ${file} (${size} KB)`);
  });

  // 9. SCRIPTS Y UTILIDADES
  console.log("\n🔧 SCRIPTS Y UTILIDADES:");
  const scripts = [
    "scripts/checkMyServices.js",
    "scripts/fixCategoriesDefinitive.js",
    "scripts/cleanupBackupFiles.js",
    "src/utils/logger.js",
    "src/utils/validators.js",
  ];

  scripts.forEach((file) => {
    const fullPath = path.join(baseDir, file);
    const status = checkFileExists(fullPath);
    const size = getFileSize(fullPath);
    console.log(`   ${status} ${file} (${size} KB)`);
  });

  // 10. DOCUMENTACIÓN
  console.log("\n📚 DOCUMENTACIÓN:");
  const docs = [
    "docs/SYSTEM_INTEGRITY_FINAL_REPORT.md",
    "docs/SUPABASE_CONFIG_BACKUP.md",
    "README.md",
  ];

  docs.forEach((file) => {
    const fullPath = path.join(baseDir, file);
    const status = checkFileExists(fullPath);
    const size = getFileSize(fullPath);
    console.log(`   ${status} ${file} (${size} KB)`);
  });

  // 11. ARCHIVO PRINCIPAL
  console.log("\n🚀 ARCHIVO PRINCIPAL:");
  const mainFile = "src/index.js";
  const mainPath = path.join(baseDir, mainFile);
  const mainStatus = checkFileExists(mainPath);
  const mainSize = getFileSize(mainPath);
  console.log(`   ${mainStatus} ${mainFile} (${mainSize} KB)`);

  // RESUMEN FINAL
  console.log("\n📊 RESUMEN DEL INVENTARIO:");
  console.log("================================");

  const allFiles = [
    ...configFiles,
    ...models,
    ...integrations,
    ...apiFiles,
    ...clientFiles,
    ...adminFiles,
    ...services,
    ...middleware,
    ...scripts,
    ...docs,
    mainFile,
  ];

  let existingFiles = 0;
  let totalSize = 0;

  allFiles.forEach((file) => {
    const fullPath = path.join(baseDir, file);
    if (fs.existsSync(fullPath)) {
      existingFiles++;
      totalSize += getFileSize(fullPath);
    }
  });

  console.log(`✅ Archivos existentes: ${existingFiles}/${allFiles.length}`);
  console.log(`📦 Tamaño total: ${totalSize} KB`);
  console.log(
    `📈 Integridad del sistema: ${Math.round(
      (existingFiles / allFiles.length) * 100
    )}%`
  );

  if (existingFiles === allFiles.length) {
    console.log("\n🎉 ¡SISTEMA COMPLETAMENTE ÍNTEGRO!");
    console.log("✅ Todos los archivos críticos están presentes");
    console.log("✅ El sistema está listo para funcionar");
  } else {
    console.log("\n⚠️ ARCHIVOS FALTANTES DETECTADOS");
    console.log("🔧 Se requiere revisión y restauración");
  }
}

// Ejecutar
if (require.main === module) {
  systemInventory()
    .then(() => {
      console.log("\n✅ Inventario completado");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Error en inventario:", error);
      process.exit(1);
    });
}

module.exports = { systemInventory };
