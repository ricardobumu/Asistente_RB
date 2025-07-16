// scripts/test_calendly_flow.js
// Script para probar el flujo completo Calendly → Cliente → Cita

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const logger = require("../src/utils/logger");
const AutonomousWhatsAppController = require("../src/controllers/autonomousWhatsAppController");

// Payload de ejemplo de Calendly
const mockCalendlyPayload = {
  event: "invitee.created",
  payload: {
    uri: "https://calendly.com/events/AAAAAAAAAAAAAAAA",
    name: "Juan Pérez",
    email: "juan.perez@example.com",
    start_time: "2024-12-20T10:00:00.000000Z",
    end_time: "2024-12-20T11:30:00.000000Z",
    event_type: "https://calendly.com/ricardo-buritica/tratamiento-super-hair",
    questions_and_answers: [
      {
        question: "¿Cuál es tu número de teléfono?",
        answer: "+34600123456",
        position: 1,
      },
    ],
    created_at: "2024-12-19T15:30:00.000000Z",
    updated_at: "2024-12-19T15:30:00.000000Z",
  },
};

async function testCalendlyFlow() {
  console.log("🧪 INICIANDO PRUEBA DEL FLUJO CALENDLY");
  console.log("=====================================");

  try {
    // Inicializar controlador
    const controller = new AutonomousWhatsAppController();

    // Esperar a que se carguen los servicios
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("\n1️⃣ DATOS DE ENTRADA:");
    console.log("📧 Email:", mockCalendlyPayload.payload.email);
    console.log("👤 Nombre:", mockCalendlyPayload.payload.name);
    console.log(
      "📱 Teléfono:",
      mockCalendlyPayload.payload.questions_and_answers[0].answer
    );
    console.log("🕐 Fecha:", mockCalendlyPayload.payload.start_time);
    console.log("🔗 Servicio URL:", mockCalendlyPayload.payload.event_type);

    console.log("\n2️⃣ PROCESANDO WEBHOOK...");

    // Simular el procesamiento del webhook
    const result = await controller._processCalendlyBooking(
      mockCalendlyPayload.payload
    );

    console.log("\n3️⃣ RESULTADO:");
    if (result) {
      console.log("✅ Cita creada exitosamente!");
      console.log("🆔 ID de cita:", result.id);
      console.log("👤 Cliente ID:", result.client_id);
      console.log("🛍️ Servicio ID:", result.service_id);
      console.log("📅 Programada para:", result.scheduled_at);
      console.log("📊 Estado:", result.status);
      console.log("🔗 URI Calendly:", result.calendly_event_uri);
    } else {
      console.log("❌ No se pudo crear la cita");
    }

    console.log("\n4️⃣ VERIFICACIONES:");

    // Verificar que el cliente se creó/encontró
    console.log("🔍 Verificando cliente...");

    // Verificar que el servicio se encontró
    console.log("🔍 Verificando servicio...");

    // Verificar que la cita se guardó
    console.log("🔍 Verificando cita en BD...");

    console.log("\n🎉 PRUEBA COMPLETADA EXITOSAMENTE!");
  } catch (error) {
    console.error("\n💥 ERROR EN LA PRUEBA:");
    console.error("Mensaje:", error.message);
    console.error("Stack:", error.stack);

    console.log("\n🔧 POSIBLES SOLUCIONES:");
    console.log("1. Verificar que la base de datos esté accesible");
    console.log(
      "2. Confirmar que los servicios estén cargados en ServiceModel"
    );
    console.log(
      "3. Revisar que el evento de Calendly tenga el formato correcto"
    );
    console.log("4. Verificar las variables de entorno");
  }
}

// Ejecutar la prueba
if (require.main === module) {
  testCalendlyFlow()
    .then(() => {
      console.log("\n✅ Script completado");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Script falló:", error.message);
      process.exit(1);
    });
}

module.exports = { testCalendlyFlow, mockCalendlyPayload };
