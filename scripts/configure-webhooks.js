#!/usr/bin/env node

/**
 * CONFIGURADOR DE WEBHOOKS
 *
 * Script para ayudar a configurar los webhooks de Twilio y Calendly
 * tanto en desarrollo como en producción
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
  cyan: "\x1b[36m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${colors.bold}${colors.blue}=== ${title} ===${colors.reset}`);
}

async function detectNgrokUrl() {
  try {
    // Intentar obtener la URL de ngrok desde su API local
    const response = await axios.get("http://localhost:4040/api/tunnels", {
      timeout: 2000,
    });
    const tunnels = response.data.tunnels;

    const httpsTunnel = tunnels.find(
      (tunnel) =>
        tunnel.proto === "https" && tunnel.config.addr === "localhost:3000"
    );

    if (httpsTunnel) {
      return httpsTunnel.public_url;
    }
  } catch (error) {
    // ngrok no está ejecutándose o no está disponible
  }

  return null;
}

async function configureWebhooks() {
  log(`${colors.bold}🔗 CONFIGURADOR DE WEBHOOKS${colors.reset}`, "blue");
  log(`Timestamp: ${new Date().toISOString()}\n`);

  const isProduction = process.env.NODE_ENV === "production";
  const productionUrl = "https://bot.ricardoburitica.eu";
  const developmentUrl = "https://ricardoburitica.ngrok.app"; // Tu URL fija de ngrok

  logSection("DETECCIÓN DEL ENTORNO");

  if (isProduction) {
    log("🌐 Entorno: PRODUCCIÓN", "green");
    log(`📡 URL base: ${productionUrl}`, "green");
  } else {
    log("🏠 Entorno: DESARROLLO", "yellow");
    log(`📡 URL fija configurada: ${developmentUrl}`, "green");

    // Verificar si ngrok está ejecutándose
    const ngrokUrl = await detectNgrokUrl();
    if (ngrokUrl) {
      log(`✅ Túnel ngrok activo: ${ngrokUrl}`, "green");
      if (ngrokUrl !== developmentUrl) {
        log(
          `⚠️  URL detectada (${ngrokUrl}) difiere de la configurada (${developmentUrl})`,
          "yellow"
        );
      }
    } else {
      log("⚠️  ngrok no detectado. Asegúrate de ejecutar:", "yellow");
      log("   ngrok http 3000 --domain=ricardoburitica.ngrok.app", "cyan");
    }
  }

  // ===== URLS DE WEBHOOKS =====
  logSection("URLS DE WEBHOOKS");

  let baseUrl;
  if (isProduction) {
    baseUrl = productionUrl;
  } else {
    baseUrl = developmentUrl; // Usar tu URL fija de ngrok
  }

  const webhookUrls = {
    whatsapp: `${baseUrl}/webhook/whatsapp`,
    calendly: `${baseUrl}/api/calendly/webhook`,
  };

  log("📋 URLs de webhooks configuradas:", "blue");
  log(`   🟢 WhatsApp (Twilio): ${webhookUrls.whatsapp}`, "green");
  log(`   🟡 Calendly: ${webhookUrls.calendly}`, "green");

  // ===== VERIFICAR CONECTIVIDAD =====
  logSection("VERIFICACIÓN DE CONECTIVIDAD");

  for (const [service, url] of Object.entries(webhookUrls)) {
    try {
      log(`🔄 Verificando ${service}...`, "blue");

      const response = await axios.get(url, {
        timeout: 5000,
        validateStatus: (status) => status < 500,
      });

      if (response.status === 200) {
        log(`✅ ${service}: Endpoint responde correctamente`, "green");
      } else if (response.status === 405) {
        log(
          `✅ ${service}: Endpoint disponible (405 Method Not Allowed es normal)`,
          "green"
        );
      } else if (response.status === 404) {
        log(`⚠️  ${service}: Endpoint no encontrado (404)`, "yellow");
      } else {
        log(
          `⚠️  ${service}: Respuesta inesperada (${response.status})`,
          "yellow"
        );
      }
    } catch (error) {
      if (error.code === "ECONNREFUSED") {
        log(`❌ ${service}: Servidor no está ejecutándose`, "red");
      } else if (error.code === "ENOTFOUND") {
        log(`❌ ${service}: URL no accesible`, "red");
      } else {
        log(`❌ ${service}: Error de conectividad - ${error.message}`, "red");
      }
    }
  }

  // ===== CONFIGURACIÓN DE TWILIO =====
  logSection("CONFIGURACIÓN DE TWILIO WHATSAPP");

  log("📱 Para configurar el webhook de WhatsApp en Twilio:", "blue");
  log("", "reset");
  log("1. Ve a Twilio Console:", "cyan");
  log(
    "   https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox",
    "cyan"
  );
  log("", "reset");
  log('2. En "Webhook URL for Incoming Messages", pega:', "cyan");
  log(`   ${webhookUrls.whatsapp}`, "green");
  log("", "reset");
  log("3. Método HTTP: POST", "cyan");
  log("4. Guarda la configuración", "cyan");

  // Verificar si Twilio está configurado
  const twilioConfigured =
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN;
  if (twilioConfigured) {
    log("✅ Credenciales de Twilio configuradas", "green");
  } else {
    log("⚠️  Credenciales de Twilio no configuradas en .env.local", "yellow");
  }

  // ===== CONFIGURACIÓN DE CALENDLY =====
  logSection("CONFIGURACIÓN DE CALENDLY");

  log("📅 Para configurar el webhook de Calendly:", "blue");
  log("", "reset");
  log("1. Ve a Calendly Developer Console:", "cyan");
  log("   https://developer.calendly.com/", "cyan");
  log("", "reset");
  log("2. Crea o edita un webhook con URL:", "cyan");
  log(`   ${webhookUrls.calendly}`, "green");
  log("", "reset");
  log("3. Eventos a suscribir:", "cyan");
  log("   - invitee.created", "cyan");
  log("   - invitee.canceled", "cyan");
  log("   - invitee_no_show.created", "cyan");
  log("4. Guarda la configuración", "cyan");

  // Verificar si Calendly está configurado
  const calendlyConfigured = process.env.CALENDLY_ACCESS_TOKEN;
  if (calendlyConfigured) {
    log("✅ Token de Calendly configurado", "green");
  } else {
    log("⚠️  Token de Calendly no configurado en .env.local", "yellow");
  }

  // ===== CONFIGURACIÓN AUTOMÁTICA (si es posible) =====
  logSection("CONFIGURACIÓN AUTOMÁTICA");

  if (twilioConfigured) {
    log(
      "🔄 Intentando configurar webhook de Twilio automáticamente...",
      "blue"
    );

    try {
      // Aquí podrías usar la API de Twilio para configurar automáticamente
      // Por ahora, solo mostramos las instrucciones
      log(
        "ℹ️  La configuración automática de Twilio requiere configuración adicional",
        "yellow"
      );
      log("   Usa las instrucciones manuales anteriores", "yellow");
    } catch (error) {
      log(`❌ Error configurando Twilio: ${error.message}`, "red");
    }
  }

  if (calendlyConfigured) {
    log("🔄 Verificando configuración de Calendly...", "blue");

    try {
      // Verificar que el token de Calendly funcione
      const calendlyResponse = await axios.get(
        "https://api.calendly.com/users/me",
        {
          headers: {
            Authorization: `Bearer ${process.env.CALENDLY_ACCESS_TOKEN}`,
          },
          timeout: 5000,
        }
      );

      if (calendlyResponse.status === 200) {
        log("✅ Token de Calendly válido", "green");
        log(`   Usuario: ${calendlyResponse.data.resource.name}`, "blue");
      }
    } catch (error) {
      log(`❌ Error verificando token de Calendly: ${error.message}`, "red");
    }
  }

  // ===== INSTRUCCIONES FINALES =====
  logSection("INSTRUCCIONES FINALES");

  log("📋 Pasos siguientes:", "blue");
  log("", "reset");

  if (!isProduction) {
    log("🏠 Para desarrollo:", "yellow");
    log(
      "1. Asegúrate de que ngrok esté ejecutándose con tu dominio fijo:",
      "cyan"
    );
    log("   ngrok http 3000 --domain=ricardoburitica.ngrok.app", "cyan");
    log(
      "2. Usa las URLs mostradas arriba para configurar los webhooks",
      "cyan"
    );
    log("3. El servidor debe estar ejecutándose: npm start", "cyan");
  } else {
    log("🌐 Para producción:", "green");
    log("1. Usa las URLs de producción para configurar los webhooks", "cyan");
    log("2. Asegúrate de que el servidor esté desplegado en Railway", "cyan");
  }

  log("", "reset");
  log("🧪 Para probar los webhooks:", "blue");
  log("1. Configura los webhooks según las instrucciones", "cyan");
  log("2. Ejecuta: npm run test:bot", "cyan");
  log("3. Envía un mensaje de prueba desde WhatsApp", "cyan");
  log("4. Crea una cita de prueba en Calendly", "cyan");

  log("\n✅ Configuración de webhooks completada!", "green");
}

// Ejecutar configuración
configureWebhooks().catch((error) => {
  log(`💥 Error durante la configuración: ${error.message}`, "red");
  console.error(error);
  process.exit(1);
});
