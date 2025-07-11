// scripts/initializeServices.js
require("dotenv").config();
const ServiceModel = require("../src/models/serviceModel");

async function initializeServices() {
  try {
    console.log(
      "🚀 Inicializando servicios de Ricardo Buriticá Beauty Consulting...",
    );

    const serviceModel = new ServiceModel();
    const result = await serviceModel.initializeRicardoServices();

    if (result.success) {
      console.log("✅ Servicios inicializados exitosamente");
      console.log(`📊 Total de servicios procesados: ${result.data.length}`);
      console.log(`📝 ${result.message}`);
    } else {
      console.error("❌ Error en la inicialización:", result.error);
    }
  } catch (error) {
    console.error("❌ Error inicializando servicios:", error);
    console.error("📋 Detalles del error:", {
      message: error.message,
      stack: error.stack,
    });
  }
}

initializeServices();
