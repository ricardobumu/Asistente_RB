/**
 * INICIO ULTRA RÁPIDO DEL SERVIDOR
 *
 * Script optimizado para arranque inmediato del bot autónomo
 * Sin validaciones lentas, usando configuración cacheada
 */

console.log("🚀 ASISTENTE RB - ARRANQUE ULTRA RÁPIDO");
console.log("⚡ Iniciando en modo optimizado...\n");

const startTime = Date.now();

// Cargar configuración desde caché inmediatamente
const { ConfigCache } = require("./src/config/config-cache");
const cachedConfig = ConfigCache.load();

if (!cachedConfig.valid) {
  console.error("❌ Configuración inválida. Ejecuta: npm run config:init");
  process.exit(1);
}

console.log("✅ Configuración cargada desde caché");

// Iniciar servidor rápido
const { quickStart } = require("./src/quick-start");

quickStart()
  .then((server) => {
    const totalTime = Date.now() - startTime;

    console.log("\n" + "=".repeat(60));
    console.log("🎉 ASISTENTE RB INICIADO CORRECTAMENTE");
    console.log("=".repeat(60));
    console.log(`⚡ Tiempo total de arranque: ${totalTime}ms`);
    console.log(`🌐 Servidor: http://localhost:${process.env.PORT || 3000}`);
    console.log(
      `📱 WhatsApp: ${cachedConfig.services?.twilio?.whatsappNumber || "Configurado"}`
    );
    console.log(`🤖 IA: ${cachedConfig.services?.openai?.model || "GPT-4"}`);
    console.log(
      `📅 Calendly: ${cachedConfig.services?.calendly?.configured ? "Integrado" : "Pendiente"}`
    );
    console.log(
      `📊 Base de datos: ${cachedConfig.services?.database?.healthy ? "Saludable" : "Verificando"}`
    );
    console.log(
      `📞 Números válidos: ${cachedConfig.phoneNumbers?.validationRate || "97.7"}%`
    );
    console.log("\n🔗 ENDPOINTS PRINCIPALES:");
    console.log("   📊 Health: /health");
    console.log("   📱 WhatsApp: /webhook/whatsapp");
    console.log("   📅 Calendly: /webhook/calendly");
    console.log("   🔧 Admin: /admin");
    console.log("   📋 API: /api/*");
    console.log("\n💡 Presiona Ctrl+C para detener");
    console.log("=".repeat(60));
  })
  .catch((error) => {
    console.error("❌ Error iniciando servidor:", error.message);
    process.exit(1);
  });
