/**
 * GENERADOR DE SECRETOS PARA PRODUCCIÓN
 *
 * Genera secretos criptográficamente seguros para usar en producción
 * Incluye JWT secrets, API keys y otros valores sensibles
 *
 * @author Ricardo Buriticá - Asistente RB Team
 * @version 2.1.0
 * @since 2024
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

console.log("🔐 GENERADOR DE SECRETOS PARA PRODUCCIÓN");
console.log("=".repeat(60));

// ===== FUNCIONES AUXILIARES =====

const generateSecret = (length = 64) => {
  return crypto.randomBytes(length).toString("hex");
};

const generateApiKey = () => {
  const prefix = "rb_";
  const randomPart = crypto.randomBytes(32).toString("hex");
  return prefix + randomPart;
};

const generatePassword = (length = 16) => {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";

  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }

  return password;
};

// ===== GENERAR SECRETOS =====

console.log("🔑 Generando secretos seguros...\n");

const secrets = {
  // JWT Secrets (64 bytes = 128 caracteres hex)
  JWT_SECRET: generateSecret(64),
  JWT_REFRESH_SECRET: generateSecret(64),

  // API Keys
  API_KEY: generateApiKey(),
  WEBHOOK_SECRET: generateSecret(32),

  // Admin Credentials
  ADMIN_PASSWORD: generatePassword(20),

  // Session Secret
  SESSION_SECRET: generateSecret(32),

  // Encryption Key
  ENCRYPTION_KEY: generateSecret(32),

  // CSRF Token Secret
  CSRF_SECRET: generateSecret(32),
};

// ===== MOSTRAR SECRETOS =====

console.log("✅ Secretos generados exitosamente:\n");

Object.entries(secrets).forEach(([key, value]) => {
  console.log(`${key}=${value}`);
});

console.log("\n" + "=".repeat(60));

// ===== GUARDAR EN ARCHIVO =====

const secretsFile = path.join(__dirname, "..", "production-secrets.txt");
const timestamp = new Date().toISOString();

let fileContent = `# SECRETOS DE PRODUCCIÓN GENERADOS
# Generado el: ${timestamp}
# IMPORTANTE: Mantén este archivo seguro y no lo subas a Git
#
# Instrucciones:
# 1. Copia estas variables al dashboard de Railway
# 2. Elimina este archivo después de configurar Railway
# 3. Nunca compartas estos secretos

`;

Object.entries(secrets).forEach(([key, value]) => {
  fileContent += `${key}=${value}\n`;
});

fileContent += `
# CONFIGURACIÓN ADICIONAL REQUERIDA:
#
# SUPABASE_URL=https://tu-proyecto.supabase.co
# SUPABASE_ANON_KEY=tu_supabase_anon_key_aqui
# SUPABASE_SERVICE_ROLE_KEY=tu_supabase_service_role_key_aqui
#
# TWILIO_ACCOUNT_SID=tu_twilio_account_sid
# TWILIO_AUTH_TOKEN=tu_twilio_auth_token
# TWILIO_WHATSAPP_NUMBER=+14155238886
#
# OPENAI_API_KEY=sk-tu_openai_api_key
#
# CALENDLY_ACCESS_TOKEN=tu_calendly_access_token
# CALENDLY_USER_URI=https://api.calendly.com/users/tu_user_id
#
# ALLOWED_ORIGINS=https://bot.ricardoburitica.eu,https://ricardoburitica.eu
# PUBLIC_URL=https://bot.ricardoburitica.eu
`;

try {
  fs.writeFileSync(secretsFile, fileContent);
  console.log(`📄 Secretos guardados en: ${secretsFile}`);
  console.log(
    "⚠️ IMPORTANTE: Elimina este archivo después de configurar Railway"
  );
} catch (error) {
  console.log("❌ Error guardando archivo:", error.message);
}

// ===== INSTRUCCIONES =====

console.log("\n📋 INSTRUCCIONES DE CONFIGURACIÓN:");
console.log("=".repeat(60));

console.log("\n1. 🚂 CONFIGURAR EN RAILWAY:");
console.log("   - Ve a https://railway.app/dashboard");
console.log("   - Selecciona tu proyecto Asistente RB");
console.log("   - Ve a Variables > Add Variable");
console.log("   - Copia cada variable de arriba");

console.log("\n2. 🔐 VARIABLES CRÍTICAS:");
console.log("   ✅ JWT_SECRET (para autenticación)");
console.log("   ✅ JWT_REFRESH_SECRET (para refresh tokens)");
console.log("   ✅ API_KEY (para integraciones)");
console.log("   ✅ ADMIN_PASSWORD (para dashboard)");

console.log("\n3. 🔗 VARIABLES EXTERNAS (debes obtenerlas):");
console.log("   🔹 SUPABASE_* (desde tu proyecto Supabase)");
console.log("   🔹 TWILIO_* (desde Twilio Console)");
console.log("   🔹 OPENAI_API_KEY (desde OpenAI Platform)");
console.log("   🔹 CALENDLY_* (desde Calendly Developer)");

console.log("\n4. 🌐 CONFIGURAR WEBHOOKS:");
console.log("   📱 Twilio WhatsApp:");
console.log("      URL: https://bot.ricardoburitica.eu/webhook/whatsapp");
console.log("   📅 Calendly:");
console.log("      URL: https://bot.ricardoburitica.eu/api/calendly/webhook");

console.log("\n5. ✅ VERIFICAR CONFIGURACIÓN:");
console.log("   npm run deploy:check");

console.log("\n6. 🚀 DESPLEGAR:");
console.log("   npm run deploy");

console.log("\n⚠️ SEGURIDAD:");
console.log("   - Nunca subas production-secrets.txt a Git");
console.log("   - Elimina el archivo después de configurar Railway");
console.log("   - Cambia los secretos si se comprometen");
console.log("   - Usa HTTPS siempre en producción");

console.log("\n" + "=".repeat(60));
console.log("🎯 ¡Secretos generados! Configura Railway y despliega.");
console.log("=".repeat(60));
