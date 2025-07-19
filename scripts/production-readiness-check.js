/**
 * VERIFICACIÓN DE PREPARACIÓN PARA PRODUCCIÓN
 *
 * Script que verifica que todos los componentes críticos estén
 * correctamente configurados para el despliegue en Railway
 *
 * @author Ricardo Buriticá - Asistente RB Team
 * @version 2.1.0
 * @since 2024
 */

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const fs = require("fs");
const path = require("path");

console.log("🔍 VERIFICACIÓN DE PREPARACIÓN PARA PRODUCCIÓN");
console.log("=".repeat(60));

let allChecksPass = true;
const warnings = [];
const errors = [];

// ===== VERIFICACIÓN DE ARCHIVOS CRÍTICOS =====
console.log("\n📁 Verificando archivos críticos...");

const criticalFiles = [
  "src/index-production.js",
  "src/index.js",
  "package.json",
  "railway.toml",
  ".env.example",
  "src/config/env.js",
  "src/services/autonomousAssistant.js",
  "src/integrations/supabaseClient.js",
  "src/integrations/twilioClient.js",
  "src/integrations/calendlyClient.js",
  "src/integrations/openaiClient.js",
];

criticalFiles.forEach((file) => {
  const filePath = path.join(__dirname, "..", file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - FALTANTE`);
    errors.push(`Archivo crítico faltante: ${file}`);
    allChecksPass = false;
  }
});

// ===== VERIFICACIÓN DE VARIABLES DE ENTORNO =====
console.log("\n🔐 Verificando variables de entorno...");

const requiredEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
];

const optionalEnvVars = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_WHATSAPP_NUMBER",
  "OPENAI_API_KEY",
  "CALENDLY_ACCESS_TOKEN",
  "CALENDLY_USER_URI",
];

requiredEnvVars.forEach((envVar) => {
  if (process.env[envVar]) {
    console.log(`✅ ${envVar}`);
  } else {
    console.log(`❌ ${envVar} - REQUERIDA`);
    errors.push(`Variable de entorno requerida faltante: ${envVar}`);
    allChecksPass = false;
  }
});

optionalEnvVars.forEach((envVar) => {
  if (process.env[envVar]) {
    console.log(`✅ ${envVar}`);
  } else {
    console.log(`⚠️ ${envVar} - OPCIONAL (funcionalidad limitada)`);
    warnings.push(`Variable opcional no configurada: ${envVar}`);
  }
});

// ===== VERIFICACIÓN DE CONFIGURACIÓN DE RAILWAY =====
console.log("\n🚂 Verificando configuración de Railway...");

try {
  const railwayConfig = fs.readFileSync(
    path.join(__dirname, "..", "railway.toml"),
    "utf8"
  );

  if (railwayConfig.includes('startCommand = "npm start"')) {
    console.log("✅ Comando de inicio configurado correctamente");
  } else {
    console.log("❌ Comando de inicio no configurado");
    errors.push("railway.toml debe tener startCommand = 'npm start'");
    allChecksPass = false;
  }

  if (railwayConfig.includes('healthcheckPath = "/health"')) {
    console.log("✅ Health check configurado correctamente");
  } else {
    console.log("⚠️ Health check no configurado");
    warnings.push("Se recomienda configurar healthcheckPath en railway.toml");
  }

  if (railwayConfig.includes("bot.ricardoburitica.eu")) {
    console.log("✅ Dominio personalizado configurado");
  } else {
    console.log("⚠️ Dominio personalizado no configurado");
    warnings.push("Considera configurar un dominio personalizado");
  }
} catch (error) {
  console.log("❌ Error leyendo railway.toml");
  errors.push("No se pudo leer railway.toml");
  allChecksPass = false;
}

// ===== VERIFICACIÓN DE PACKAGE.JSON =====
console.log("\n📦 Verificando package.json...");

try {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
  );

  if (packageJson.scripts && packageJson.scripts.start) {
    console.log(`✅ Script de inicio: ${packageJson.scripts.start}`);
  } else {
    console.log("❌ Script de inicio no configurado");
    errors.push("package.json debe tener script 'start'");
    allChecksPass = false;
  }

  if (packageJson.main) {
    console.log(`✅ Archivo principal: ${packageJson.main}`);
  } else {
    console.log("⚠️ Archivo principal no especificado");
    warnings.push("Se recomienda especificar 'main' en package.json");
  }

  // Verificar dependencias críticas
  const criticalDeps = [
    "express",
    "@supabase/supabase-js",
    "twilio",
    "openai",
    "helmet",
    "cors",
    "express-rate-limit",
  ];

  criticalDeps.forEach((dep) => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`✅ Dependencia: ${dep}`);
    } else {
      console.log(`❌ Dependencia faltante: ${dep}`);
      errors.push(`Dependencia crítica faltante: ${dep}`);
      allChecksPass = false;
    }
  });
} catch (error) {
  console.log("❌ Error leyendo package.json");
  errors.push("No se pudo leer package.json");
  allChecksPass = false;
}

// ===== VERIFICACIÓN DE SEGURIDAD =====
console.log("\n🔒 Verificando configuración de seguridad...");

// Verificar longitud de JWT secrets
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 64) {
  console.log("✅ JWT_SECRET tiene longitud adecuada");
} else if (process.env.JWT_SECRET) {
  console.log("⚠️ JWT_SECRET debería tener al menos 64 caracteres");
  warnings.push("JWT_SECRET debería ser más largo para mayor seguridad");
} else {
  console.log("❌ JWT_SECRET no configurado");
}

if (
  process.env.JWT_REFRESH_SECRET &&
  process.env.JWT_REFRESH_SECRET.length >= 64
) {
  console.log("✅ JWT_REFRESH_SECRET tiene longitud adecuada");
} else if (process.env.JWT_REFRESH_SECRET) {
  console.log("⚠️ JWT_REFRESH_SECRET debería tener al menos 64 caracteres");
  warnings.push(
    "JWT_REFRESH_SECRET debería ser más largo para mayor seguridad"
  );
} else {
  console.log("❌ JWT_REFRESH_SECRET no configurado");
}

// Verificar que no se usen valores por defecto
const defaultValues = ["admin123", "default", "changeme", "test"];
defaultValues.forEach((defaultVal) => {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.includes(defaultVal)) {
    console.log(`⚠️ JWT_SECRET contiene valor por defecto: ${defaultVal}`);
    warnings.push(`JWT_SECRET no debería contener '${defaultVal}'`);
  }
});

// ===== VERIFICACIÓN DE CONECTIVIDAD =====
console.log("\n🌐 Verificando conectividad de servicios...");

const testConnections = async () => {
  // Test Supabase
  try {
    const supabase = require("../src/integrations/supabaseClient");
    const { data, error } = await supabase
      .from("services")
      .select("count")
      .limit(1);
    if (error) throw error;
    console.log("✅ Conexión a Supabase exitosa");
  } catch (error) {
    console.log("❌ Error conectando a Supabase:", error.message);
    errors.push("No se pudo conectar a Supabase");
    allChecksPass = false;
  }

  // Test OpenAI (si está configurado)
  if (process.env.OPENAI_API_KEY) {
    try {
      const openaiClient = require("../src/integrations/openaiClient");
      // Test básico sin hacer llamada real
      console.log("✅ Cliente OpenAI inicializado");
    } catch (error) {
      console.log("❌ Error inicializando cliente OpenAI:", error.message);
      warnings.push("Cliente OpenAI no se pudo inicializar");
    }
  }

  // Test Twilio (si está configurado)
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    try {
      const twilioClient = require("../src/integrations/twilioClient");
      console.log("✅ Cliente Twilio inicializado");
    } catch (error) {
      console.log("❌ Error inicializando cliente Twilio:", error.message);
      warnings.push("Cliente Twilio no se pudo inicializar");
    }
  }

  // Test Calendly (si está configurado)
  if (process.env.CALENDLY_ACCESS_TOKEN) {
    try {
      const calendlyClient = require("../src/integrations/calendlyClient");
      console.log("✅ Cliente Calendly inicializado");
    } catch (error) {
      console.log("❌ Error inicializando cliente Calendly:", error.message);
      warnings.push("Cliente Calendly no se pudo inicializar");
    }
  }
};

// ===== RESUMEN FINAL =====
const showSummary = () => {
  console.log("\n" + "=".repeat(60));
  console.log("📊 RESUMEN DE VERIFICACIÓN");
  console.log("=".repeat(60));

  if (allChecksPass && errors.length === 0) {
    console.log("🎉 ¡TODAS LAS VERIFICACIONES PASARON!");
    console.log("✅ Tu aplicación está lista para despliegue en producción");

    if (warnings.length > 0) {
      console.log(`\n⚠️ ${warnings.length} advertencia(s) encontrada(s):`);
      warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
    }

    console.log("\n🚀 PRÓXIMOS PASOS PARA DESPLIEGUE:");
    console.log("1. Configura las variables de entorno en Railway");
    console.log("2. Conecta tu repositorio GitHub a Railway");
    console.log("3. Despliega usando: git push origin main");
    console.log(
      "4. Verifica el health check en: https://bot.ricardoburitica.eu/health"
    );
    console.log(
      "5. Configura los webhooks de Twilio y Calendly con la URL de producción"
    );
  } else {
    console.log("❌ VERIFICACIÓN FALLIDA");
    console.log(`${errors.length} error(es) crítico(s) encontrado(s):`);
    errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });

    if (warnings.length > 0) {
      console.log(`\n⚠️ ${warnings.length} advertencia(s) encontrada(s):`);
      warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
    }

    console.log("\n🔧 ACCIONES REQUERIDAS:");
    console.log("1. Corrige todos los errores listados arriba");
    console.log("2. Ejecuta este script nuevamente");
    console.log("3. Solo despliega cuando todas las verificaciones pasen");
  }

  console.log("\n📚 DOCUMENTACIÓN:");
  console.log("- Railway: https://docs.railway.app/");
  console.log("- Configuración: README.md");
  console.log("- Variables de entorno: .env.example");

  console.log("\n" + "=".repeat(60));

  process.exit(allChecksPass && errors.length === 0 ? 0 : 1);
};

// Ejecutar verificaciones
testConnections()
  .then(showSummary)
  .catch((error) => {
    console.log("❌ Error durante las verificaciones:", error.message);
    errors.push("Error durante verificaciones de conectividad");
    allChecksPass = false;
    showSummary();
  });
