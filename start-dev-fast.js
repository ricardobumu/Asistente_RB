/**
 * DESARROLLO RÁPIDO CON NGROK
 *
 * Inicia el servidor en modo desarrollo con ngrok automático
 * Compatible con el flujo de trabajo existente
 */

const { spawn } = require("child_process");
const path = require("path");

console.log("🚀 ASISTENTE RB - DESARROLLO RÁPIDO CON NGROK");
console.log("⚡ Iniciando servidor y túnel...\n");

// Verificar configuración
const { ConfigCache } = require("./src/config/config-cache");
const cachedConfig = ConfigCache.load();

if (!cachedConfig.valid) {
  console.error("❌ Configuración inválida. Ejecuta: npm run config:init");
  process.exit(1);
}

console.log("✅ Configuración válida");

// Función para iniciar ngrok
function startNgrok() {
  console.log("🌐 Iniciando túnel ngrok...");

  const ngrokProcess = spawn(
    "cmd",
    [
      "/k",
      "echo 🌐 INICIANDO TUNEL NGROK... && " +
        "echo 📱 URL: https://ricardoburitica.ngrok.app && " +
        "ngrok http 3000 --domain=ricardoburitica.ngrok.app",
    ],
    {
      detached: true,
      stdio: "ignore",
    }
  );

  ngrokProcess.unref();

  console.log("✅ Túnel ngrok iniciado en ventana separada");
  return ngrokProcess;
}

// Función para iniciar el servidor
function startServer() {
  console.log("🚀 Iniciando servidor de desarrollo...");

  const serverProcess = spawn("node", ["src/quick-start.js"], {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development" },
  });

  return serverProcess;
}

// Función principal
async function main() {
  try {
    // Esperar un poco para que ngrok se establezca
    console.log("⏳ Esperando 3 segundos para sincronización...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Iniciar ngrok primero
    const ngrokProcess = startNgrok();

    // Esperar un poco más para que ngrok se establezca
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Iniciar servidor
    const serverProcess = startServer();

    // Mostrar información
    setTimeout(() => {
      console.log("\n" + "=".repeat(60));
      console.log("🎉 DESARROLLO INICIADO CORRECTAMENTE");
      console.log("=".repeat(60));
      console.log("🌐 Local: http://localhost:3000");
      console.log("🌍 Público: https://ricardoburitica.ngrok.app");
      console.log("📱 WhatsApp: Configurado");
      console.log("📅 Calendly: Integrado");
      console.log("🤖 IA: OpenAI GPT-4");
      console.log("\n🔗 ENDPOINTS PRINCIPALES:");
      console.log("   📊 Health: /health");
      console.log("   📱 WhatsApp: /webhook/whatsapp");
      console.log("   📅 Calendly: /api/calendly/webhook");
      console.log("   🔧 Admin: /admin");
      console.log("\n💡 Presiona Ctrl+C para detener ambos servicios");
      console.log("=".repeat(60));
    }, 5000);

    // Manejo de cierre
    process.on("SIGINT", () => {
      console.log("\n🛑 Cerrando servicios...");

      if (serverProcess) {
        serverProcess.kill("SIGTERM");
      }

      // Intentar cerrar ngrok (aunque esté en ventana separada)
      try {
        spawn("taskkill", ["/f", "/im", "ngrok.exe"], { stdio: "ignore" });
      } catch (error) {
        // Ignorar errores al cerrar ngrok
      }

      console.log("✅ Servicios cerrados");
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      console.log("\n🛑 Cerrando servicios...");

      if (serverProcess) {
        serverProcess.kill("SIGTERM");
      }

      process.exit(0);
    });

    // Mantener el proceso principal vivo
    serverProcess.on("exit", (code) => {
      if (code !== 0) {
        console.error(`❌ Servidor cerrado con código ${code}`);
        process.exit(code);
      }
    });
  } catch (error) {
    console.error("❌ Error iniciando desarrollo:", error.message);
    process.exit(1);
  }
}

// Ejecutar
main();
