// scripts/setupGoogleCalendarDB.js
// Script para configurar campos de Google Calendar en la base de datos

const fs = require("fs");
const path = require("path");
const DatabaseAdapter = require("../src/adapters/databaseAdapter");
const logger = require("../src/utils/logger");

async function setupGoogleCalendarDB() {
  try {
    logger.info(
      "🔧 Configurando campos de Google Calendar en la base de datos...",
    );

    // Leer el script SQL
    const sqlPath = path.join(__dirname, "addGoogleCalendarFields.sql");
    const sqlScript = fs.readFileSync(sqlPath, "utf8");

    // Ejecutar el script
    const result = await DatabaseAdapter.query(sqlScript);

    if (result.success) {
      logger.info("✅ Campos de Google Calendar configurados exitosamente");

      // Verificar que las columnas se crearon
      const verifyResult = await DatabaseAdapter.query(`
        SELECT 
          column_name, 
          data_type, 
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'users' 
          AND column_name LIKE 'google_%'
        ORDER BY column_name;
      `);

      if (verifyResult.success && verifyResult.data.length > 0) {
        logger.info("📋 Columnas de Google Calendar creadas:");
        verifyResult.data.forEach((col) => {
          logger.info(
            `  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`,
          );
        });
      } else {
        logger.warn("⚠️ No se pudieron verificar las columnas creadas");
      }

      // Verificar índices
      const indexResult = await DatabaseAdapter.query(`
        SELECT 
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE tablename = 'users' 
          AND indexname LIKE '%google%'
        ORDER BY indexname;
      `);

      if (indexResult.success && indexResult.data.length > 0) {
        logger.info("📋 Índices de Google Calendar creados:");
        indexResult.data.forEach((idx) => {
          logger.info(`  - ${idx.indexname}`);
        });
      }
    } else {
      logger.error(
        "❌ Error configurando campos de Google Calendar:",
        result.error,
      );
      process.exit(1);
    }
  } catch (error) {
    logger.error("❌ Error ejecutando script de configuración:", error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  setupGoogleCalendarDB()
    .then(() => {
      logger.info("🎉 Configuración de Google Calendar completada");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("💥 Error en configuración:", error);
      process.exit(1);
    });
}

module.exports = setupGoogleCalendarDB;
