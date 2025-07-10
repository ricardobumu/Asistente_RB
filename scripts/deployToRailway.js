// scripts/deployToRailway.js
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🚀 DEPLOYMENT A RAILWAY - ASISTENTE RB\n");

// Verificar que estamos en el directorio correcto
const packageJsonPath = path.join(__dirname, "..", "package.json");
if (!fs.existsSync(packageJsonPath)) {
  console.error("❌ Error: No se encuentra package.json");
  console.error(
    "   Asegúrate de ejecutar este script desde el directorio raíz del proyecto"
  );
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
console.log(`📦 Proyecto: ${packageJson.name} v${packageJson.version}`);

// Verificar variables críticas
console.log("\n🔍 Verificando configuración local...");

const criticalVars = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_KEY",
  "JWT_SECRET",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
];

let missingVars = [];
criticalVars.forEach((varName) => {
  if (!process.env[varName]) {
    missingVars.push(varName);
  }
});

if (missingVars.length > 0) {
  console.log("❌ Variables críticas faltantes:");
  missingVars.forEach((varName) => {
    console.log(`   - ${varName}`);
  });
  console.log(
    "\n💡 Configura estas variables en .env.local antes de continuar"
  );
  process.exit(1);
}

console.log("✅ Variables críticas configuradas");

// Verificar que Railway CLI esté instalado
try {
  execSync("railway --version", { stdio: "pipe" });
  console.log("✅ Railway CLI disponible");
} catch (error) {
  console.log("❌ Railway CLI no encontrado");
  console.log("💡 Instalando Railway CLI...");
  try {
    execSync("npm install -g @railway/cli", { stdio: "inherit" });
    console.log("✅ Railway CLI instalado");
  } catch (installError) {
    console.error("❌ Error instalando Railway CLI:", installError.message);
    process.exit(1);
  }
}

// Función para ejecutar comandos de Railway
function runRailwayCommand(command, description) {
  console.log(`\n🔧 ${description}...`);
  try {
    const output = execSync(`railway ${command}`, {
      encoding: "utf8",
      stdio: "pipe",
    });
    console.log("✅ Completado");
    return output;
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    if (error.stdout) {
      console.log("Salida:", error.stdout);
    }
    if (error.stderr) {
      console.log("Error:", error.stderr);
    }
    return null;
  }
}

// Proceso de deployment
async function deploy() {
  console.log("\n🚀 INICIANDO DEPLOYMENT...\n");

  // 1. Verificar conexión
  const status = runRailwayCommand("whoami", "Verificando autenticación");
  if (!status) {
    console.log("💡 Ejecuta: railway login");
    return;
  }

  // 2. Verificar proyecto vinculado
  const projectStatus = runRailwayCommand(
    "status",
    "Verificando proyecto vinculado"
  );
  if (!projectStatus) {
    console.log("💡 Vinculando proyecto...");
    console.log("   Ejecuta: railway link");
    console.log("   Selecciona: Asistente RB");
    return;
  }

  // 3. Hacer deployment
  console.log("\n📤 Desplegando aplicación...");
  const deployResult = runRailwayCommand("up", "Desplegando a Railway");

  if (deployResult) {
    console.log("\n🎉 ¡DEPLOYMENT COMPLETADO!");

    // 4. Verificar deployment
    console.log("\n⏳ Esperando que el servicio esté disponible...");
    console.log("   Esto puede tomar 1-2 minutos...");

    setTimeout(() => {
      console.log("\n🧪 Verificando deployment...");
      console.log("   Ejecuta: npm run check:deployment");
      console.log("");
      console.log("📋 URLs para configurar en Twilio:");
      console.log(
        "   Webhook: https://bot.ricardoburitica.eu/autonomous/whatsapp/webhook"
      );
      console.log(
        "   Status:  https://bot.ricardoburitica.eu/autonomous/whatsapp/status"
      );
      console.log("");
      console.log("📋 URL para configurar en Calendly:");
      console.log(
        "   Webhook: https://bot.ricardoburitica.eu/api/calendly/webhook"
      );
    }, 5000);
  } else {
    console.log("\n❌ Error en el deployment");
    console.log("💡 Verifica los logs con: railway logs");
  }
}

// Ejecutar deployment
deploy().catch(console.error);
