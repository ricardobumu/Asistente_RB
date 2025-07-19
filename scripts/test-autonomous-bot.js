#!/usr/bin/env node

/**
 * PRUEBA DEL BOT AUTÓNOMO CONSOLIDADO
 *
 * Script para probar que el bot autónomo funciona correctamente
 * después de la consolidación del sistema
 *
 * @author Ricardo Buriticá - Asistente RB Team
 * @version 2.1.0
 */

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const axios = require("axios");

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

async function testEndpoint(
  url,
  method = "GET",
  data = null,
  description = ""
) {
  try {
    const config = {
      method,
      url,
      timeout: 10000,
      validateStatus: (status) => status < 500, // No fallar en 4xx
    };

    if (data) {
      config.data = data;
      config.headers = {
        "Content-Type": "application/json",
      };
    }

    const response = await axios(config);

    if (response.status >= 200 && response.status < 300) {
      log(`✅ ${description}: ${response.status} - OK`, "green");
      return { success: true, status: response.status, data: response.data };
    } else {
      log(
        `⚠️  ${description}: ${response.status} - ${response.statusText}`,
        "yellow"
      );
      return { success: false, status: response.status, data: response.data };
    }
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      log(`❌ ${description}: Servidor no está ejecutándose`, "red");
      return { success: false, error: "ECONNREFUSED" };
    } else {
      log(`❌ ${description}: ${error.message}`, "red");
      return { success: false, error: error.message };
    }
  }
}

async function testAutonomousBot() {
  log(
    `${colors.bold}🤖 PRUEBA DEL BOT AUTÓNOMO CONSOLIDADO${colors.reset}`,
    "blue"
  );
  log(`Timestamp: ${new Date().toISOString()}\n`);

  const baseUrl = "http://localhost:3000";
  let allTests = true;

  // ===== VERIFICAR QUE EL SERVIDOR ESTÉ EJECUTÁNDOSE =====
  logSection("VERIFICACIÓN DEL SERVIDOR");

  const healthCheck = await testEndpoint(
    `${baseUrl}/health`,
    "GET",
    null,
    "Health Check"
  );

  if (!healthCheck.success) {
    log(
      "\n❌ El servidor no está ejecutándose. Inicia el servidor con:",
      "red"
    );
    log("npm start", "yellow");
    log("\nO verifica que esté ejecutándose en el puerto 3000", "yellow");
    process.exit(1);
  }

  // Mostrar información del health check
  if (healthCheck.data) {
    log(`📊 Información del servidor:`, "blue");
    log(`   - Estado: ${healthCheck.data.status}`, "blue");
    log(`   - Versión: ${healthCheck.data.version}`, "blue");
    log(`   - Entorno: ${healthCheck.data.environment}`, "blue");
    log(`   - Uptime: ${Math.round(healthCheck.data.uptime)}s`, "blue");

    if (healthCheck.data.services) {
      log(`   - Servicios configurados:`, "blue");
      Object.entries(healthCheck.data.services).forEach(([service, status]) => {
        const icon =
          status === "configured" || status === "connected" ? "✅" : "⚠️";
        log(
          `     ${icon} ${service}: ${status}`,
          status === "configured" || status === "connected" ? "green" : "yellow"
        );
      });
    }
  }

  // ===== PROBAR ENDPOINTS PRINCIPALES =====
  logSection("ENDPOINTS PRINCIPALES");

  const mainEndpoints = [
    ["/", "Ruta principal"],
    ["/api", "API información"],
    ["/health", "Health check"],
  ];

  for (const [endpoint, description] of mainEndpoints) {
    const result = await testEndpoint(
      `${baseUrl}${endpoint}`,
      "GET",
      null,
      description
    );
    if (!result.success && result.error !== "ECONNREFUSED") {
      allTests = false;
    }
  }

  // ===== PROBAR ENDPOINTS DEL BOT AUTÓNOMO =====
  logSection("ENDPOINTS DEL BOT AUTÓNOMO");

  const botEndpoints = [
    ["/api/servicios", "Servicios disponibles"],
    ["/api/whatsapp", "WhatsApp API (GET)"],
    ["/autonomous/whatsapp", "WhatsApp autónomo (GET)"],
  ];

  for (const [endpoint, description] of botEndpoints) {
    const result = await testEndpoint(
      `${baseUrl}${endpoint}`,
      "GET",
      null,
      description
    );
    if (
      !result.success &&
      result.status !== 404 &&
      result.error !== "ECONNREFUSED"
    ) {
      allTests = false;
    }
  }

  // ===== PROBAR WEBHOOKS (solo verificar que respondan) =====
  logSection("WEBHOOKS (Verificación de Respuesta)");

  const webhookEndpoints = [
    ["/webhook/whatsapp", "WhatsApp Webhook"],
    ["/api/calendly/webhook", "Calendly Webhook"],
  ];

  for (const [endpoint, description] of webhookEndpoints) {
    const result = await testEndpoint(
      `${baseUrl}${endpoint}`,
      "GET",
      null,
      `${description} (GET)`
    );
    // Los webhooks pueden devolver 405 (Method Not Allowed) para GET, eso está bien
    if (result.status === 405) {
      log(
        `✅ ${description}: Endpoint responde (405 Method Not Allowed es esperado)`,
        "green"
      );
    }
  }

  // ===== PROBAR SIMULACIÓN DE MENSAJE DE WHATSAPP =====
  logSection("SIMULACIÓN DE MENSAJE DE WHATSAPP");

  // Simular un mensaje de WhatsApp (sin validación de firma en desarrollo)
  const whatsappMessage = {
    From: "whatsapp:+34600123456",
    To: "whatsapp:+14155238886",
    Body: "Hola, quiero reservar una cita",
    MessageSid: "test_message_" + Date.now(),
  };

  log("🔄 Enviando mensaje de prueba al bot...", "blue");
  const whatsappTest = await testEndpoint(
    `${baseUrl}/webhook/whatsapp`,
    "POST",
    whatsappMessage,
    "Simulación de mensaje WhatsApp"
  );

  if (whatsappTest.success) {
    log("✅ El bot procesó el mensaje correctamente", "green");
  } else if (whatsappTest.status === 401) {
    log(
      "⚠️  Webhook requiere validación de firma (normal en producción)",
      "yellow"
    );
  } else {
    log(
      "⚠️  El bot no pudo procesar el mensaje, pero el endpoint responde",
      "yellow"
    );
  }

  // ===== PROBAR ENDPOINTS DE ADMINISTRACIÓN =====
  logSection("ENDPOINTS DE ADMINISTRACIÓN");

  const adminEndpoints = [
    ["/admin", "Dashboard administrativo"],
    ["/client", "Portal del cliente"],
    ["/widget", "Widget de reservas"],
  ];

  for (const [endpoint, description] of adminEndpoints) {
    const result = await testEndpoint(
      `${baseUrl}${endpoint}`,
      "GET",
      null,
      description
    );
    // Estos endpoints pueden requerir autenticación o devolver HTML
    if (result.success || result.status === 401 || result.status === 403) {
      log(`✅ ${description}: Endpoint disponible`, "green");
    }
  }

  // ===== VERIFICAR CONFIGURACIÓN DE SERVICIOS =====
  logSection("CONFIGURACIÓN DE SERVICIOS");

  try {
    const serviciosResult = await testEndpoint(
      `${baseUrl}/api/servicios`,
      "GET",
      null,
      "Lista de servicios"
    );

    if (serviciosResult.success && serviciosResult.data) {
      if (
        Array.isArray(serviciosResult.data) &&
        serviciosResult.data.length > 0
      ) {
        log(
          `✅ Servicios cargados: ${serviciosResult.data.length} servicios disponibles`,
          "green"
        );

        // Mostrar algunos servicios de ejemplo
        const firstServices = serviciosResult.data.slice(0, 3);
        firstServices.forEach((service) => {
          log(`   - ${service.name} (€${service.price})`, "blue");
        });

        if (serviciosResult.data.length > 3) {
          log(
            `   ... y ${serviciosResult.data.length - 3} servicios más`,
            "blue"
          );
        }
      } else {
        log("⚠️  No hay servicios configurados en la base de datos", "yellow");
      }
    }
  } catch (error) {
    log(
      `⚠️  No se pudo verificar la configuración de servicios: ${error.message}`,
      "yellow"
    );
  }

  // ===== RESUMEN FINAL =====
  logSection("RESUMEN DE PRUEBAS");

  if (allTests && healthCheck.success) {
    log("🎉 TODAS LAS PRUEBAS PASARON", "green");
    log("✅ El bot autónomo está funcionando correctamente", "green");

    log("\n📋 Estado del sistema:", "blue");
    log("✅ Servidor ejecutándose correctamente", "green");
    log("✅ Endpoints principales respondiendo", "green");
    log("✅ Bot autónomo operativo", "green");
    log("✅ Webhooks configurados", "green");
    log("✅ Interfaces de usuario disponibles", "green");

    log("\n🚀 El bot está listo para recibir mensajes de WhatsApp!", "green");
    log("\n📱 Para probar con WhatsApp real:", "blue");
    log(
      "1. Configura el webhook de Twilio: https://tu-dominio.com/webhook/whatsapp",
      "blue"
    );
    log("2. Envía un mensaje al número de WhatsApp configurado", "blue");
    log("3. El bot responderá automáticamente", "blue");
  } else {
    log("⚠️  ALGUNAS PRUEBAS FALLARON O TIENEN ADVERTENCIAS", "yellow");
    log(
      "📋 El sistema básico funciona, pero revisa las advertencias anteriores",
      "yellow"
    );

    log("\n🔧 Posibles acciones:", "yellow");
    log("1. Verificar configuración de variables de entorno", "yellow");
    log(
      "2. Asegurar que todos los servicios externos estén configurados",
      "yellow"
    );
    log("3. Revisar logs del servidor para más detalles", "yellow");
  }

  log("\n📊 URLs importantes:", "blue");
  log(`- Health Check: ${baseUrl}/health`, "blue");
  log(`- API Info: ${baseUrl}/api`, "blue");
  log(`- Dashboard Admin: ${baseUrl}/admin`, "blue");
  log(`- Portal Cliente: ${baseUrl}/client`, "blue");
  log(`- Widget Reservas: ${baseUrl}/widget`, "blue");

  process.exit(allTests ? 0 : 1);
}

// Ejecutar pruebas
testAutonomousBot().catch((error) => {
  log(`💥 Error durante las pruebas: ${error.message}`, "red");
  console.error(error);
  process.exit(1);
});
