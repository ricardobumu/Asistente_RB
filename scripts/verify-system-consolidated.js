#!/usr/bin/env node

/**
 * VERIFICACIÓN DEL SISTEMA CONSOLIDADO
 *
 * Script para verificar que todas las configuraciones y dependencias
 * estén correctamente configuradas después de la consolidación
 *
 * @author Ricardo Buriticá - Asistente RB Team
 * @version 2.1.0
 */

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const fs = require("fs");
const path = require("path");

// Colores para la consola
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${colors.bold}${colors.blue}=== ${title} ===${colors.reset}`);
}

function checkFile(filePath, description) {
  const fullPath = path.join(__dirname, "..", filePath);
  const exists = fs.existsSync(fullPath);

  if (exists) {
    log(`✅ ${description}: ${filePath}`, "green");
    return true;
  } else {
    log(`❌ ${description}: ${filePath} - NO ENCONTRADO`, "red");
    return false;
  }
}

function checkEnvVar(varName, required = false) {
  const value = process.env[varName];
  const hasValue = value && value.trim() !== "";

  if (hasValue) {
    log(`✅ ${varName}: Configurado`, "green");
    return true;
  } else if (required) {
    log(`❌ ${varName}: REQUERIDO - No configurado`, "red");
    return false;
  } else {
    log(`⚠️  ${varName}: Opcional - No configurado`, "yellow");
    return true;
  }
}

async function verifySystemConsolidation() {
  log(
    `${colors.bold}🔍 VERIFICACIÓN DEL SISTEMA CONSOLIDADO${colors.reset}`,
    "blue"
  );
  log(`Timestamp: ${new Date().toISOString()}\n`);

  let allChecks = true;

  // ===== VERIFICAR ARCHIVOS PRINCIPALES =====
  logSection("ARCHIVOS PRINCIPALES");

  const mainFiles = [
    ["src/index.js", "Archivo principal consolidado"],
    ["package.json", "Configuración del proyecto"],
    ["src/config/env.js", "Configuración de entorno"],
    [".env.example", "Plantilla de variables de entorno"],
  ];

  mainFiles.forEach(([file, desc]) => {
    if (!checkFile(file, desc)) allChecks = false;
  });

  // ===== VERIFICAR PACKAGE.JSON =====
  logSection("CONFIGURACIÓN DE PACKAGE.JSON");

  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
    );

    if (packageJson.main === "src/index.js") {
      log("✅ main: Apunta a src/index.js", "green");
    } else {
      log(
        `❌ main: Debería ser "src/index.js", actual: "${packageJson.main}"`,
        "red"
      );
      allChecks = false;
    }

    if (packageJson.scripts.start === "node src/index.js") {
      log("✅ start script: Configurado correctamente", "green");
    } else {
      log(
        `❌ start script: Debería ser "node src/index.js", actual: "${packageJson.scripts.start}"`,
        "red"
      );
      allChecks = false;
    }

    if (
      packageJson.scripts.dev &&
      packageJson.scripts.dev.includes("src/index.js")
    ) {
      log("✅ dev script: Configurado correctamente", "green");
    } else {
      log("⚠️  dev script: Podría necesitar actualización", "yellow");
    }
  } catch (error) {
    log(`❌ Error leyendo package.json: ${error.message}`, "red");
    allChecks = false;
  }

  // ===== VERIFICAR VARIABLES DE ENTORNO CRÍTICAS =====
  logSection("VARIABLES DE ENTORNO CRÍTICAS");

  const requiredVars = ["SUPABASE_URL", "SUPABASE_ANON_KEY"];

  const productionVars = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "OPENAI_API_KEY",
    "CALENDLY_ACCESS_TOKEN",
  ];

  const optionalVars = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "CALENDLY_SIGNING_KEY",
    "PUBLIC_URL",
  ];

  // Verificar variables requeridas
  requiredVars.forEach((varName) => {
    if (!checkEnvVar(varName, true)) allChecks = false;
  });

  // Verificar variables de producción
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    log("\n📋 Verificando variables para PRODUCCIÓN:", "yellow");
    productionVars.forEach((varName) => {
      if (!checkEnvVar(varName, true)) allChecks = false;
    });
  } else {
    log("\n📋 Variables de producción (opcionales en desarrollo):", "blue");
    productionVars.forEach((varName) => {
      checkEnvVar(varName, false);
    });
  }

  // Verificar variables opcionales
  log("\n📋 Variables opcionales:", "blue");
  optionalVars.forEach((varName) => {
    checkEnvVar(varName, false);
  });

  // ===== VERIFICAR ESTRUCTURA DE DIRECTORIOS =====
  logSection("ESTRUCTURA DE DIRECTORIOS");

  const directories = [
    "src",
    "src/config",
    "src/controllers",
    "src/integrations",
    "src/middleware",
    "src/models",
    "src/routes",
    "src/services",
    "src/utils",
    "public",
    "public/admin",
    "public/client",
    "public/widget",
    "scripts",
  ];

  directories.forEach((dir) => {
    const dirPath = path.join(__dirname, "..", dir);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      log(`✅ Directorio: ${dir}`, "green");
    } else {
      log(`❌ Directorio faltante: ${dir}`, "red");
      allChecks = false;
    }
  });

  // ===== VERIFICAR ARCHIVOS CRÍTICOS =====
  logSection("ARCHIVOS CRÍTICOS DEL SISTEMA");

  const criticalFiles = [
    ["src/integrations/supabaseClient.js", "Cliente de Supabase"],
    ["src/integrations/twilioClient.js", "Cliente de Twilio"],
    ["src/integrations/openaiClient.js", "Cliente de OpenAI"],
    ["src/integrations/calendlyClient.js", "Cliente de Calendly"],
    ["src/middleware/securityMiddleware.js", "Middleware de seguridad"],
    ["src/services/autonomousAssistant.js", "Asistente autónomo"],
    ["src/models/serviceModel.js", "Modelo de servicios"],
    ["src/utils/logger.js", "Sistema de logging"],
  ];

  criticalFiles.forEach(([file, desc]) => {
    if (!checkFile(file, desc)) allChecks = false;
  });

  // ===== VERIFICAR DEPENDENCIAS =====
  logSection("DEPENDENCIAS CRÍTICAS");

  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
    );
    const criticalDeps = [
      "express",
      "helmet",
      "cors",
      "express-rate-limit",
      "@supabase/supabase-js",
      "twilio",
      "openai",
      "jsonwebtoken",
      "winston",
      "dotenv",
    ];

    criticalDeps.forEach((dep) => {
      if (packageJson.dependencies[dep]) {
        log(`✅ ${dep}: v${packageJson.dependencies[dep]}`, "green");
      } else {
        log(`❌ Dependencia faltante: ${dep}`, "red");
        allChecks = false;
      }
    });
  } catch (error) {
    log(`❌ Error verificando dependencias: ${error.message}`, "red");
    allChecks = false;
  }

  // ===== VERIFICAR CONFIGURACIÓN DE SEGURIDAD =====
  logSection("CONFIGURACIÓN DE SEGURIDAD");

  // Verificar JWT secrets en producción
  if (isProduction) {
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret && jwtSecret.length >= 64) {
      log("✅ JWT_SECRET: Longitud adecuada para producción", "green");
    } else {
      log(
        "❌ JWT_SECRET: Debe tener al menos 64 caracteres en producción",
        "red"
      );
      allChecks = false;
    }

    if (jwtSecret && !jwtSecret.includes("default")) {
      log("✅ JWT_SECRET: No contiene valores por defecto", "green");
    } else {
      log(
        "❌ JWT_SECRET: No debe contener valores por defecto en producción",
        "red"
      );
      allChecks = false;
    }
  }

  // Verificar CORS
  const allowedOrigins = process.env.ALLOWED_ORIGINS;
  if (allowedOrigins) {
    log(
      `✅ ALLOWED_ORIGINS: Configurado (${allowedOrigins.split(",").length} orígenes)`,
      "green"
    );
  } else {
    log(
      "⚠️  ALLOWED_ORIGINS: No configurado, usando valores por defecto",
      "yellow"
    );
  }

  // ===== RESUMEN FINAL =====
  logSection("RESUMEN DE VERIFICACIÓN");

  if (allChecks) {
    log("🎉 TODAS LAS VERIFICACIONES PASARON", "green");
    log(
      "✅ El sistema está correctamente consolidado y listo para usar",
      "green"
    );

    log("\n📋 Próximos pasos:", "blue");
    log("1. Ejecutar: npm install (si no se ha hecho)", "blue");
    log("2. Configurar variables en .env.local", "blue");
    log("3. Ejecutar: npm start", "blue");
    log("4. Verificar: http://localhost:3000/health", "blue");

    process.exit(0);
  } else {
    log("❌ ALGUNAS VERIFICACIONES FALLARON", "red");
    log("⚠️  Revisa los errores anteriores antes de continuar", "yellow");

    log("\n🔧 Acciones recomendadas:", "yellow");
    log("1. Corregir archivos faltantes", "yellow");
    log("2. Configurar variables de entorno requeridas", "yellow");
    log("3. Ejecutar este script nuevamente", "yellow");

    process.exit(1);
  }
}

// Ejecutar verificación
verifySystemConsolidation().catch((error) => {
  log(`💥 Error durante la verificación: ${error.message}`, "red");
  console.error(error);
  process.exit(1);
});
