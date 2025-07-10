// scripts/initializeRicardoServices.js
require("dotenv").config();
const serviceModel = require("../src/models/serviceModel");
const logger = require("../src/utils/logger");

/**
 * Script para inicializar los servicios específicos de Ricardo Buriticá Beauty Consulting
 * Ejecutar con: node scripts/initializeRicardoServices.js
 */

async function initializeServices() {
  try {
    console.log(
      "🚀 Inicializando servicios de Ricardo Buriticá Beauty Consulting...\n"
    );

    // Inicializar servicios usando el método del modelo
    const result = await serviceModel.initializeRicardoServices();

    if (result.success) {
      console.log("✅ Servicios inicializados exitosamente!");
      console.log(`📊 ${result.data.length} servicios creados/actualizados`);
      console.log("\n📋 Servicios de Peluquería Consciente:");

      // Mostrar resumen por categoría
      const categories = {
        tratamientos_capilares: "Tratamientos Capilares",
        cortes: "Cortes",
        coloracion: "Coloración",
        asesoria: "Asesoría",
        especializados: "Especializados",
      };

      for (const [key, name] of Object.entries(categories)) {
        const categoryResult = await serviceModel.getServicesByCategory(key);
        if (categoryResult.success && categoryResult.data.length > 0) {
          console.log(`\n🎯 ${name}:`);
          categoryResult.data.forEach((service) => {
            console.log(
              `   • ${service.name} - ${service.price}€ (${service.duration}min)`
            );
          });
        }
      }

      console.log(
        "\n💚 Filosofía de Peluquería Consciente integrada en todos los servicios"
      );
      console.log(
        "🔗 Integración con Calendly configurada para reservas automáticas"
      );
    } else {
      console.error("❌ Error inicializando servicios:", result.error);
    }
  } catch (error) {
    console.error("❌ Error ejecutando script:", error.message);
    logger.error("Error en script de inicialización", error);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  initializeServices()
    .then(() => {
      console.log("\n🎉 Inicialización completada!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Error fatal:", error);
      process.exit(1);
    });
}

module.exports = { initializeServices };
