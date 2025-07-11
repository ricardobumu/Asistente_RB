// scripts/deployToRailwayFinal.js
// Script definitivo para deploy a Railway con configuración completa

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Configuración del proyecto Railway
const RAILWAY_CONFIG = {
  APP_BASE_URL: process.env.APP_BASE_URL || "https://bot.ricardoburitica.eu",
  PROJECT_ID: "2806399e-7537-46ce-acc7-fa043193e2a9",
  PROJECT_NAME: "Asistente RB",
  DOMAIN: new URL(process.env.APP_BASE_URL || "https://bot.ricardoburitica.eu")
    .hostname,
  ENVIRONMENT: "production",
};

async function deployToRailway() {
  console.log("🚀 DEPLOY DEFINITIVO A RAILWAY");
  console.log("==============================\n");

  try {
    // 1. Verificar que Railway CLI está instalado
    console.log("1️⃣ Verificando Railway CLI...");
    try {
      execSync("railway --version", { stdio: "pipe" });
      console.log("   ✅ Railway CLI instalado");
    } catch (error) {
      console.log("   ❌ Railway CLI no encontrado");
      console.log("   📥 Instalando Railway CLI...");
      execSync("npm install -g @railway/cli", { stdio: "inherit" });
      console.log("   ✅ Railway CLI instalado");
    }

    // 2. Login a Railway
    console.log("\n2️⃣ Verificando autenticación Railway...");
    try {
      execSync("railway whoami", { stdio: "pipe" });
      console.log("   ✅ Ya autenticado en Railway");
    } catch (error) {
      console.log("   🔐 Iniciando sesión en Railway...");
      console.log("   👆 Se abrirá el navegador para autenticación");
      execSync("railway login", { stdio: "inherit" });
    }

    // 3. Conectar al proyecto
    console.log("\n3️⃣ Conectando al proyecto Railway...");
    try {
      execSync(`railway link ${RAILWAY_CONFIG.PROJECT_ID}`, { stdio: "pipe" });
      console.log("   ✅ Conectado al proyecto Asistente RB");
    } catch (error) {
      console.log("   ⚠️ Error conectando, intentando crear conexión...");
      execSync("railway link", { stdio: "inherit" });
    }

    // 4. Verificar variables de entorno
    console.log("\n4️⃣ Configurando variables de entorno...");

    const envVars = {
      NODE_ENV: "production",
      APP_BASE_URL: RAILWAY_CONFIG.APP_BASE_URL,
      PORT: "3000",
      // Supabase
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
      // Twilio
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
      TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER,
      // OpenAI
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4-turbo",
      // Calendly
      CALENDLY_ACCESS_TOKEN: process.env.CALENDLY_ACCESS_TOKEN,
      CALENDLY_USER_URI: process.env.CALENDLY_USER_URI,
      // JWT
      JWT_SECRET: process.env.JWT_SECRET,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
      // Admin
      ADMIN_USERNAME: process.env.ADMIN_USERNAME,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
      // CORS
      ALLOWED_ORIGINS: `${RAILWAY_CONFIG.APP_BASE_URL},https://ricardoburitica.com,http://localhost:3000`,
    };

    console.log("   📝 Configurando variables críticas...");

    for (const [key, value] of Object.entries(envVars)) {
      if (value) {
        try {
          execSync(`railway variables set ${key}="${value}"`, {
            stdio: "pipe",
          });
          console.log(`   ✅ ${key} configurada`);
        } catch (error) {
          console.log(`   ⚠️ Error configurando ${key}`);
        }
      } else {
        console.log(`   ❌ ${key} no encontrada en .env.local`);
      }
    }

    // 5. Verificar archivos críticos
    console.log("\n5️⃣ Verificando archivos críticos...");
    const criticalFiles = [
      "src/index.js",
      "package.json",
      "railway.toml",
      ".env",
    ];

    criticalFiles.forEach((file) => {
      if (fs.existsSync(path.join(process.cwd(), file))) {
        console.log(`   ✅ ${file}`);
      } else {
        console.log(`   ❌ ${file} FALTANTE`);
        throw new Error(`Archivo crítico faltante: ${file}`);
      }
    });

    // 6. Crear .railwayignore si no existe
    console.log("\n6️⃣ Configurando archivos de deploy...");
    const railwayIgnore = `
# Railway ignore file
node_modules/
.env.local
.git/
logs/
*.log
.DS_Store
Thumbs.db
scripts/test*
scripts/debug*
docs/
README.md
`;

    fs.writeFileSync(".railwayignore", railwayIgnore.trim());
    console.log("   ✅ .railwayignore creado");

    // 7. Deploy
    console.log("\n7️⃣ Iniciando deploy...");
    console.log("   🚀 Desplegando a Railway...");

    execSync("railway up --detach", { stdio: "inherit" });

    console.log("\n✅ DEPLOY COMPLETADO");
    console.log("===================");
    console.log(`🌐 URL: ${RAILWAY_CONFIG.APP_BASE_URL}`);
    console.log(
      `📊 Dashboard: https://railway.app/project/${RAILWAY_CONFIG.PROJECT_ID}`
    );

    // 8. Verificar deploy
    console.log("\n8️⃣ Verificando deploy...");
    setTimeout(async () => {
      try {
        // Usar fetch que está disponible en Node.js 18+
        const response = await fetch(`${RAILWAY_CONFIG.APP_BASE_URL}/health`);
        if (response.ok) {
          console.log("   ✅ Aplicación funcionando correctamente");
          console.log(
            `   🔗 Portal Cliente: ${RAILWAY_CONFIG.APP_BASE_URL}/portal`
          );
          console.log(
            `   🔗 Admin Panel: ${RAILWAY_CONFIG.APP_BASE_URL}/admin`
          );
        } else {
          console.log("   ⚠️ Aplicación desplegada pero con errores");
        }
      } catch (error) {
        console.log("   ⏳ Aplicación aún iniciando... (normal)");
      }
    }, 30000);

    // 9. Mostrar logs
    console.log("\n9️⃣ Mostrando logs de deploy...");
    console.log("   📋 Ejecuta: railway logs --tail");

    return {
      success: true,
      url: RAILWAY_CONFIG.APP_BASE_URL,
      projectId: RAILWAY_CONFIG.PROJECT_ID,
    };
  } catch (error) {
    console.error("\n❌ ERROR EN DEPLOY:", error.message);
    console.log("\n🔧 SOLUCIONES:");
    console.log(
      "1. Verificar que Railway CLI esté instalado: npm install -g @railway/cli"
    );
    console.log("2. Hacer login: railway login");
    console.log("3. Verificar variables de entorno en .env.local");
    console.log("4. Revisar logs: railway logs");

    return {
      success: false,
      error: error.message,
    };
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  deployToRailway()
    .then((result) => {
      if (result.success) {
        console.log("\n🎉 DEPLOY EXITOSO");
        process.exit(0);
      } else {
        console.log("\n💥 DEPLOY FALLÓ");
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("Error fatal:", error);
      process.exit(1);
    });
}

module.exports = { deployToRailway, RAILWAY_CONFIG };
