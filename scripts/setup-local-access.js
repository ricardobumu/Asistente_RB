#!/usr/bin/env node
// scripts/setup-local-access.js
// Script para configurar acceso local y port forwarding

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("🌐 CONFIGURANDO ACCESO LOCAL AL SISTEMA\n");
console.log("=".repeat(60));

// Función para obtener información del sistema
function getSystemInfo() {
  console.log("📋 INFORMACIÓN DEL SISTEMA:");

  const packagePath = path.join(process.cwd(), "package.json");
  const packageData = JSON.parse(fs.readFileSync(packagePath, "utf8"));

  console.log(`   📦 Proyecto: ${packageData.name}`);
  console.log(`   📝 Versión: ${packageData.version}`);
  console.log(`   🔧 Puerto por defecto: 3000`);
  console.log("");
}

// Función para verificar el puerto configurado
function checkPortConfiguration() {
  console.log("🔍 VERIFICANDO CONFIGURACIÓN DE PUERTO:");

  // Verificar .env
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const portMatch = envContent.match(/PORT=(\d+)/);

    if (portMatch) {
      console.log(`   ✅ Puerto configurado en .env: ${portMatch[1]}`);
    } else {
      console.log(
        "   ⚠️  Puerto no especificado en .env (usando 3000 por defecto)"
      );
    }
  } else {
    console.log("   ❌ Archivo .env no encontrado");
  }

  // Verificar .env.local
  const envLocalPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envLocalPath)) {
    const envLocalContent = fs.readFileSync(envLocalPath, "utf8");
    const portMatch = envLocalContent.match(/PORT=(\d+)/);

    if (portMatch) {
      console.log(`   ✅ Puerto configurado en .env.local: ${portMatch[1]}`);
    }
  }

  console.log("");
}

// Función para mostrar opciones de acceso
function showAccessOptions() {
  console.log("🌐 OPCIONES DE ACCESO LOCAL:");
  console.log("");

  console.log("   📍 ACCESO DIRECTO:");
  console.log("      http://localhost:3000 - Aplicación principal");
  console.log("      http://localhost:3000/health - Health check");
  console.log("      http://localhost:3000/admin - Panel de administración");
  console.log("      http://localhost:3000/portal - Portal del cliente");
  console.log("      http://localhost:3000/widget - Widget de reservas");
  console.log("");

  console.log("   🔗 ENDPOINTS API:");
  console.log("      http://localhost:3000/api/health - API health");
  console.log(
    "      http://localhost:3000/gdpr/privacy-policy - Política RGPD"
  );
  console.log(
    "      http://localhost:3000/admin/gdpr/stats - Estadísticas RGPD"
  );
  console.log("");

  console.log("   🤖 WEBHOOK WHATSAPP:");
  console.log("      http://localhost:3000/autonomous/whatsapp/webhook");
  console.log("      (Requiere túnel para acceso externo)");
  console.log("");
}

// Función para mostrar opciones de túnel
function showTunnelOptions() {
  console.log("🚇 OPCIONES DE TÚNEL PARA ACCESO EXTERNO:");
  console.log("");

  console.log("   1️⃣  NGROK (Recomendado):");
  console.log("      npm install -g ngrok");
  console.log("      ngrok http 3000");
  console.log("      → Proporciona URL pública temporal");
  console.log("");

  console.log("   2️⃣  LOCALTUNNEL:");
  console.log("      npm install -g localtunnel");
  console.log("      lt --port 3000");
  console.log("      → URL pública con subdominio aleatorio");
  console.log("");

  console.log("   3️⃣  SERVEO (Sin instalación):");
  console.log("      ssh -R 80:localhost:3000 serveo.net");
  console.log("      → Túnel SSH directo");
  console.log("");

  console.log("   4️⃣  CLOUDFLARE TUNNEL:");
  console.log("      cloudflared tunnel --url http://localhost:3000");
  console.log("      → Túnel seguro de Cloudflare");
  console.log("");
}

// Función para crear script de inicio con túnel
function createTunnelScript() {
  console.log("📝 CREANDO SCRIPTS DE TÚNEL:");

  // Script para ngrok
  const ngrokScript = `#!/usr/bin/env node
// scripts/start-with-ngrok.js
// Iniciar servidor con túnel ngrok

const { spawn } = require('child_process');

console.log('🚀 Iniciando servidor con túnel ngrok...');

// Iniciar el servidor
const server = spawn('npm', ['run', 'start'], {
  stdio: 'inherit',
  shell: true
});

// Esperar un poco para que el servidor inicie
setTimeout(() => {
  console.log('🚇 Iniciando túnel ngrok...');
  
  // Iniciar ngrok
  const ngrok = spawn('ngrok', ['http', '3000'], {
    stdio: 'inherit',
    shell: true
  });
  
  ngrok.on('error', (error) => {
    console.log('❌ Error iniciando ngrok:', error.message);
    console.log('💡 Instala ngrok: npm install -g ngrok');
  });
  
}, 3000);

// Manejar cierre
process.on('SIGINT', () => {
  console.log('\\n🛑 Cerrando servidor y túnel...');
  server.kill();
  process.exit();
});`;

  const ngrokPath = path.join(process.cwd(), "scripts/start-with-ngrok.js");
  fs.writeFileSync(ngrokPath, ngrokScript);
  console.log("   ✅ scripts/start-with-ngrok.js creado");

  // Script para localtunnel
  const ltScript = `#!/usr/bin/env node
// scripts/start-with-localtunnel.js
// Iniciar servidor con localtunnel

const { spawn } = require('child_process');

console.log('🚀 Iniciando servidor con localtunnel...');

// Iniciar el servidor
const server = spawn('npm', ['run', 'start'], {
  stdio: 'inherit',
  shell: true
});

// Esperar un poco para que el servidor inicie
setTimeout(() => {
  console.log('🚇 Iniciando localtunnel...');
  
  // Iniciar localtunnel
  const lt = spawn('lt', ['--port', '3000'], {
    stdio: 'inherit',
    shell: true
  });
  
  lt.on('error', (error) => {
    console.log('❌ Error iniciando localtunnel:', error.message);
    console.log('💡 Instala localtunnel: npm install -g localtunnel');
  });
  
}, 3000);

// Manejar cierre
process.on('SIGINT', () => {
  console.log('\\n🛑 Cerrando servidor y túnel...');
  server.kill();
  process.exit();
});`;

  const ltPath = path.join(process.cwd(), "scripts/start-with-localtunnel.js");
  fs.writeFileSync(ltPath, ltScript);
  console.log("   ✅ scripts/start-with-localtunnel.js creado");

  console.log("");
}

// Función para actualizar package.json con scripts de túnel
function updatePackageScripts() {
  console.log("📦 ACTUALIZANDO SCRIPTS EN PACKAGE.JSON:");

  const packagePath = path.join(process.cwd(), "package.json");
  const packageData = JSON.parse(fs.readFileSync(packagePath, "utf8"));

  // Agregar scripts de túnel
  packageData.scripts = {
    ...packageData.scripts,
    "start:ngrok": "node scripts/start-with-ngrok.js",
    "start:tunnel": "node scripts/start-with-localtunnel.js",
    "tunnel:ngrok": "ngrok http 3000",
    "tunnel:lt": "lt --port 3000",
  };

  fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2) + "\\n");
  console.log("   ✅ Scripts de túnel agregados a package.json");
  console.log("");
}

// Función para mostrar comandos útiles
function showUsefulCommands() {
  console.log("🔧 COMANDOS ÚTILES:");
  console.log("");

  console.log("   🚀 INICIAR SERVIDOR:");
  console.log("      npm run start - Servidor normal");
  console.log("      npm run dev - Modo desarrollo");
  console.log("      npm run start-full - Con workers RGPD");
  console.log("");

  console.log("   🚇 INICIAR CON TÚNEL:");
  console.log("      npm run start:ngrok - Con ngrok");
  console.log("      npm run start:tunnel - Con localtunnel");
  console.log("");

  console.log("   🔍 VERIFICACIÓN:");
  console.log("      npm run health - Health check");
  console.log("      npm run gdpr:stats - Estadísticas RGPD");
  console.log("      npm run final:verify - Verificación completa");
  console.log("");

  console.log("   📊 MONITOREO:");
  console.log("      npm run security:check - Verificar seguridad");
  console.log("      npm run project:summary - Resumen del proyecto");
  console.log("");
}

// Función para crear archivo de configuración de desarrollo
function createDevConfig() {
  console.log("⚙️ CREANDO CONFIGURACIÓN DE DESARROLLO:");

  const devConfig = {
    server: {
      port: 3000,
      host: "localhost",
      cors: {
        origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
        credentials: true,
      },
    },
    tunnel: {
      preferred: "ngrok",
      alternatives: ["localtunnel", "serveo", "cloudflare"],
    },
    endpoints: {
      health: "/health",
      admin: "/admin",
      api: "/api",
      webhook: "/autonomous/whatsapp/webhook",
    },
    development: {
      hotReload: true,
      debugMode: true,
      logLevel: "debug",
    },
  };

  const configPath = path.join(process.cwd(), "config/development.json");

  // Crear directorio config si no existe
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(devConfig, null, 2));
  console.log("   ✅ config/development.json creado");
  console.log("");
}

// Función principal
function main() {
  try {
    getSystemInfo();
    checkPortConfiguration();
    showAccessOptions();
    showTunnelOptions();
    createTunnelScript();
    updatePackageScripts();
    createDevConfig();
    showUsefulCommands();

    console.log("=".repeat(60));
    console.log("🎉 CONFIGURACIÓN DE ACCESO LOCAL COMPLETADA");
    console.log("=".repeat(60));
    console.log("");

    console.log("📋 PRÓXIMOS PASOS:");
    console.log("1. Iniciar el servidor: npm run start");
    console.log("2. Acceder localmente: http://localhost:3000");
    console.log("3. Para acceso externo: npm run start:ngrok");
    console.log("4. Verificar funcionamiento: npm run health");
    console.log("");

    console.log("💡 CONSEJOS:");
    console.log("- Para webhooks de Twilio, usa ngrok o localtunnel");
    console.log("- Configura la URL del webhook en Twilio Console");
    console.log("- Usa HTTPS para webhooks en producción");
    console.log("");

    console.log("📧 Soporte: info@ricardoburitica.eu");
  } catch (error) {
    console.error("❌ Error configurando acceso local:", error.message);
    process.exit(1);
  }
}

// Ejecutar
if (require.main === module) {
  main();
}

module.exports = {
  getSystemInfo,
  checkPortConfiguration,
  showAccessOptions,
  createTunnelScript,
};
