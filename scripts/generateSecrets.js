// scripts/generateSecrets.js
const crypto = require("crypto");

/**
 * Script para generar secretos JWT seguros
 */

function generateSecureSecret(length = 64) {
  return crypto.randomBytes(length).toString("hex");
}

function generateSecrets() {
  console.log("🔐 Generando secretos JWT seguros...\n");

  const jwtSecret = generateSecureSecret(64);
  const jwtRefreshSecret = generateSecureSecret(64);

  console.log("Agrega estas variables a tu archivo .env:\n");
  console.log("# =================================");
  console.log("# SEGURIDAD JWT");
  console.log("# =================================");
  console.log(`JWT_SECRET=${jwtSecret}`);
  console.log(`JWT_REFRESH_SECRET=${jwtRefreshSecret}`);
  console.log("");

  console.log("⚠️  IMPORTANTE:");
  console.log("- Guarda estos secretos de forma segura");
  console.log("- NO los compartas en repositorios públicos");
  console.log(
    "- Usa secretos diferentes para cada entorno (dev, staging, prod)",
  );
  console.log("- Cambia los secretos regularmente en producción");

  return {
    jwtSecret,
    jwtRefreshSecret,
  };
}

// Ejecutar si se llama directamente
if (require.main === module) {
  generateSecrets();
}

module.exports = { generateSecrets, generateSecureSecret };
