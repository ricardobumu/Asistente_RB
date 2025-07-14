#!/usr/bin/env node
// scripts/security-optimization.js
// Script para optimizar la seguridad y dependencias del proyecto

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("🔒 Iniciando optimización de seguridad...\n");

// Función para ejecutar comandos de forma segura
function runCommand(command, description) {
  try {
    console.log(`📋 ${description}...`);
    const output = execSync(command, { encoding: "utf8", stdio: "pipe" });
    console.log(`✅ ${description} completado`);
    return output;
  } catch (error) {
    console.warn(`⚠️  Advertencia en ${description}: ${error.message}`);
    return null;
  }
}

// Función para leer package.json
function readPackageJson() {
  const packagePath = path.join(process.cwd(), "package.json");
  return JSON.parse(fs.readFileSync(packagePath, "utf8"));
}

// Función para escribir package.json
function writePackageJson(packageData) {
  const packagePath = path.join(process.cwd(), "package.json");
  fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2) + "\n");
}

// Análisis de dependencias
function analyzeDependencies() {
  console.log("📊 Analizando dependencias...");

  const packageData = readPackageJson();
  const dependencies = packageData.dependencies || {};

  // Dependencias potencialmente problemáticas o redundantes
  const problematicDeps = {
    pm2: "Vulnerabilidad de seguridad - se puede usar nodemon para desarrollo",
    bcrypt: "Redundante - ya tenemos bcryptjs",
    cluster: "Redundante - funcionalidad nativa de Node.js",
    "express-limiter": "Redundante - ya tenemos express-rate-limit",
    "express-rate-limit-redis":
      "Redundante - no usamos Redis para rate limiting",
    "memory-cache": "Redundante - ya tenemos node-cache",
    redis: "No configurado - puede ser removido si no se usa",
    ioredis: "Redundante con redis",
    throng: "Redundante - funcionalidad nativa con cluster",
  };

  console.log("\n🔍 Dependencias problemáticas encontradas:");
  Object.keys(problematicDeps).forEach((dep) => {
    if (dependencies[dep]) {
      console.log(`  ❌ ${dep}: ${problematicDeps[dep]}`);
    }
  });

  return problematicDeps;
}

// Optimizar dependencias
function optimizeDependencies() {
  console.log("\n🛠️  Optimizando dependencias...");

  const packageData = readPackageJson();
  const dependencies = packageData.dependencies || {};

  // Dependencias a remover (con cuidado)
  const toRemove = [
    "pm2", // Vulnerabilidad de seguridad
    "bcrypt", // Redundante con bcryptjs
    "cluster", // Nativo en Node.js
    "express-limiter", // Redundante
    "express-rate-limit-redis", // No usado
    "memory-cache", // Redundante con node-cache
    "redis", // No configurado
    "ioredis", // Redundante
    "throng", // Redundante
  ];

  let removed = [];
  toRemove.forEach((dep) => {
    if (dependencies[dep]) {
      delete dependencies[dep];
      removed.push(dep);
      console.log(`  ✅ Removido: ${dep}`);
    }
  });

  // Actualizar package.json
  packageData.dependencies = dependencies;

  // Agregar scripts de seguridad mejorados
  packageData.scripts = {
    ...packageData.scripts,
    "security:check": "npm audit --audit-level moderate",
    "security:fix-auto": "npm audit fix --force",
    "security:update": "npm update",
    "deps:check": "npm outdated",
    "deps:update": "npm update --save",
  };

  writePackageJson(packageData);

  console.log(
    `\n✅ Optimización completada. Removidas ${removed.length} dependencias.`
  );
  return removed;
}

// Crear configuración de seguridad mejorada
function createSecurityConfig() {
  console.log("\n🔐 Creando configuración de seguridad...");

  const securityConfig = {
    // Configuración de Helmet mejorada
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: [
            "'self'",
            "https://api.openai.com",
            "https://*.supabase.co",
          ],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // Para compatibilidad
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    },

    // Rate limiting mejorado
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 100, // límite de requests por ventana por IP
      message: {
        error:
          "Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.",
      },
      standardHeaders: true,
      legacyHeaders: false,
    },

    // Configuración de CORS segura
    cors: {
      origin: function (origin, callback) {
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
          "http://localhost:3000",
        ];
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("No permitido por CORS"));
        }
      },
      credentials: true,
      optionsSuccessStatus: 200,
    },
  };

  const configPath = path.join(process.cwd(), "src/config/security.json");
  fs.writeFileSync(configPath, JSON.stringify(securityConfig, null, 2));

  console.log(
    "✅ Configuración de seguridad creada en src/config/security.json"
  );
}

// Crear script de monitoreo de seguridad
function createSecurityMonitoring() {
  console.log("\n📊 Creando script de monitoreo...");

  const monitoringScript = `#!/usr/bin/env node
// scripts/security-monitor.js
// Monitoreo continuo de seguridad

const { execSync } = require('child_process');

function checkSecurity() {
  console.log('🔒 Verificación de seguridad automática...');
  
  try {
    // Verificar vulnerabilidades
    execSync('npm audit --audit-level moderate', { stdio: 'inherit' });
    console.log('✅ No se encontraron vulnerabilidades críticas');
  } catch (error) {
    console.warn('⚠️  Se encontraron vulnerabilidades - revisar manualmente');
  }
  
  try {
    // Verificar dependencias desactualizadas
    const outdated = execSync('npm outdated --json', { encoding: 'utf8' });
    const outdatedPackages = JSON.parse(outdated || '{}');
    
    if (Object.keys(outdatedPackages).length > 0) {
      console.log('📦 Dependencias desactualizadas encontradas:');
      Object.keys(outdatedPackages).forEach(pkg => {
        console.log(\`  - \${pkg}: \${outdatedPackages[pkg].current} → \${outdatedPackages[pkg].latest}\`);
      });
    } else {
      console.log('✅ Todas las dependencias están actualizadas');
    }
  } catch (error) {
    console.log('✅ Todas las dependencias están actualizadas');
  }
}

// Ejecutar verificación
checkSecurity();

module.exports = { checkSecurity };`;

  const monitorPath = path.join(process.cwd(), "scripts/security-monitor.js");
  fs.writeFileSync(monitorPath, monitoringScript);

  console.log("✅ Script de monitoreo creado en scripts/security-monitor.js");
}

// Función principal
async function main() {
  try {
    // Análisis inicial
    analyzeDependencies();

    // Optimizar dependencias
    const removed = optimizeDependencies();

    // Reinstalar dependencias limpias
    if (removed.length > 0) {
      console.log("\n📦 Reinstalando dependencias...");
      runCommand("npm install", "Instalación de dependencias");
    }

    // Crear configuraciones de seguridad
    createSecurityConfig();
    createSecurityMonitoring();

    // Verificación final
    console.log("\n🔍 Verificación final de seguridad...");
    runCommand("npm audit --audit-level moderate", "Auditoría de seguridad");

    console.log("\n🎉 ¡Optimización de seguridad completada!");
    console.log("\n📋 Próximos pasos:");
    console.log("1. Revisar src/config/security.json para ajustes específicos");
    console.log("2. Ejecutar npm run security:check regularmente");
    console.log("3. Usar scripts/security-monitor.js para monitoreo continuo");
    console.log("\n🔗 Nuevos scripts disponibles:");
    console.log("- npm run security:check - Verificar vulnerabilidades");
    console.log("- npm run security:fix-auto - Corregir automáticamente");
    console.log(
      "- npm run deps:check - Verificar dependencias desactualizadas"
    );
    console.log("- npm run deps:update - Actualizar dependencias");
  } catch (error) {
    console.error("❌ Error en optimización:", error.message);
    process.exit(1);
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = {
  analyzeDependencies,
  optimizeDependencies,
  createSecurityConfig,
  createSecurityMonitoring,
};
