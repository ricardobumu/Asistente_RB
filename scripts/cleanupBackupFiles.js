// scripts/cleanupBackupFiles.js
// Script para limpiar archivos backup y duplicados

const fs = require("fs");
const path = require("path");

async function cleanupBackupFiles() {
  console.log("🧹 LIMPIEZA DE ARCHIVOS BACKUP Y DUPLICADOS");
  console.log("==========================================\n");

  const backupFiles = [
    "src/models/bookingModel_backup.js",
    "src/models/notificationModel_backup.js",
    "src/models/serviceModel_backup.js",
    "src/models/userModel_backup.js",
  ];

  const genericFiles = [
    "src/models/notificationModel_generic.js",
    "src/models/serviceModel_generic.js",
  ];

  console.log("📋 Archivos backup a eliminar:");
  backupFiles.forEach((file) => {
    console.log(`   - ${file}`);
  });

  console.log("\n📋 Archivos generic a revisar:");
  genericFiles.forEach((file) => {
    console.log(`   - ${file}`);
  });

  // Eliminar archivos backup
  console.log("\n🗑️ Eliminando archivos backup...");
  let deletedCount = 0;

  for (const file of backupFiles) {
    const fullPath = path.join(process.cwd(), file);

    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`   ✅ Eliminado: ${file}`);
        deletedCount++;
      } else {
        console.log(`   ⚠️ No existe: ${file}`);
      }
    } catch (error) {
      console.log(`   ❌ Error eliminando ${file}: ${error.message}`);
    }
  }

  // Revisar archivos generic
  console.log("\n🔍 Revisando archivos generic...");

  for (const file of genericFiles) {
    const fullPath = path.join(process.cwd(), file);

    try {
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        const sizeKB = Math.round(stats.size / 1024);
        console.log(`   📄 ${file} (${sizeKB} KB) - REVISAR MANUALMENTE`);
      } else {
        console.log(`   ⚠️ No existe: ${file}`);
      }
    } catch (error) {
      console.log(`   ❌ Error revisando ${file}: ${error.message}`);
    }
  }

  console.log("\n🎯 RESULTADO:");
  console.log(`✅ Archivos backup eliminados: ${deletedCount}`);
  console.log("⚠️ Archivos generic requieren revisión manual");

  console.log("\n📝 PRÓXIMOS PASOS:");
  console.log("1. Revisar archivos *_generic.js");
  console.log("2. Integrar funcionalidades útiles");
  console.log("3. Eliminar duplicados");
  console.log("4. Actualizar imports si es necesario");
}

// Ejecutar
if (require.main === module) {
  cleanupBackupFiles()
    .then(() => {
      console.log("\n✅ Limpieza completada");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Error en limpieza:", error);
      process.exit(1);
    });
}

module.exports = { cleanupBackupFiles };
