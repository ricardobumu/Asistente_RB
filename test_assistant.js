// Test para verificar que autonomousAssistant funciona
try {
  console.log("🔄 Cargando AutonomousAssistant...");
  const assistant = require("./src/services/autonomousAssistant");
  console.log("✅ AutonomousAssistant cargado correctamente");
  console.log("📋 Tipo:", typeof assistant);
  console.log(
    "🔧 Métodos disponibles:",
    Object.getOwnPropertyNames(Object.getPrototypeOf(assistant)).filter(
      (name) => name !== "constructor"
    )
  );
  process.exit(0);
} catch (error) {
  console.error("❌ Error cargando AutonomousAssistant:", error.message);
  console.error("📍 Stack:", error.stack);
  process.exit(1);
}
