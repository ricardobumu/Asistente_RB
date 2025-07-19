#!/usr/bin/env node
/**
 * @file Script para verificar y corregir credenciales de Twilio
 * @description Ayuda a obtener las credenciales correctas de Twilio
 */

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const logger = require("../src/utils/logger");

async function checkTwilioCredentials() {
  console.log("🔐 VERIFICACIÓN DETALLADA DE TWILIO");
  console.log("=".repeat(50));

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  console.log(`📋 Credenciales actuales:`);
  console.log(
    `   Account SID: ${accountSid ? accountSid.substring(0, 10) + "..." : "NO CONFIGURADO"}`
  );
  console.log(
    `   Auth Token:  ${authToken ? authToken.substring(0, 10) + "..." : "NO CONFIGURADO"}`
  );
  console.log();

  if (!accountSid || !authToken) {
    console.log("❌ CREDENCIALES FALTANTES");
    console.log();
    console.log("📝 PASOS PARA OBTENER CREDENCIALES:");
    console.log("1. Ir a: https://console.twilio.com/");
    console.log("2. Hacer login con tu cuenta");
    console.log("3. En el Dashboard principal, buscar:");
    console.log("   • Account SID (empieza con 'AC')");
    console.log("   • Auth Token (hacer clic en 'Show' para verlo)");
    console.log();
    return false;
  }

  // Probar diferentes formas de autenticación
  console.log("🧪 PROBANDO AUTENTICACIÓN...");

  try {
    const twilio = require("twilio");

    // Método 1: Autenticación básica
    console.log("   Método 1: Autenticación básica...");
    const client1 = twilio(accountSid, authToken);

    const account = await client1.api.accounts(accountSid).fetch();

    if (account && account.sid) {
      console.log("   ✅ Autenticación exitosa!");
      console.log(`   📱 Cuenta: ${account.friendlyName}`);
      console.log(`   📊 Status: ${account.status}`);
      console.log(`   🆔 SID: ${account.sid}`);

      // Verificar servicios de WhatsApp
      console.log();
      console.log("📱 VERIFICANDO WHATSAPP...");

      try {
        const messages = await client1.messages.list({ limit: 1 });
        console.log("   ✅ Servicio de mensajes accesible");

        // Verificar número de WhatsApp
        const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;
        if (whatsappNumber) {
          console.log(`   📞 Número WhatsApp: ${whatsappNumber}`);
        } else {
          console.log("   ⚠️ TWILIO_WHATSAPP_NUMBER no configurado");
        }
      } catch (whatsappError) {
        console.log(
          `   ⚠️ Error accediendo a mensajes: ${whatsappError.message}`
        );
      }

      return true;
    } else {
      console.log("   ❌ Respuesta inválida de Twilio");
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);

    if (error.message.includes("authenticate")) {
      console.log();
      console.log("🔧 POSIBLES SOLUCIONES:");
      console.log("1. Verificar que Account SID empiece con 'AC'");
      console.log("2. Verificar que Auth Token sea el correcto");
      console.log("3. Ir a Twilio Console y generar nuevo Auth Token");
      console.log("4. Verificar que la cuenta no esté suspendida");
      console.log();
      console.log("🔗 Enlaces útiles:");
      console.log("   • Console: https://console.twilio.com/");
      console.log(
        "   • API Keys: https://console.twilio.com/us1/develop/api-keys"
      );
      console.log(
        "   • WhatsApp: https://console.twilio.com/us1/develop/sms/whatsapp/sandbox"
      );
    }

    return false;
  }
}

async function generateTwilioConfig() {
  console.log();
  console.log("📝 CONFIGURACIÓN RECOMENDADA PARA .env.local:");
  console.log("=".repeat(50));
  console.log();
  console.log("# Twilio (WhatsApp)");
  console.log("TWILIO_ACCOUNT_SID=TU_ACCOUNT_SID_AQUI");
  console.log("TWILIO_AUTH_TOKEN=TU_AUTH_TOKEN_AQUI");
  console.log("TWILIO_API_KEY_SID=TU_API_KEY_SID_AQUI");
  console.log("TWILIO_WHATSAPP_NUMBER=whatsapp:+TU_NUMERO_AQUI");
  console.log();
  console.log("📋 DONDE ENCONTRAR CADA VALOR:");
  console.log("1. ACCOUNT_SID: Dashboard principal de Twilio");
  console.log("2. AUTH_TOKEN: Dashboard principal (hacer clic en 'Show')");
  console.log("3. API_KEY_SID: Console → Develop → API keys & tokens");
  console.log("4. WHATSAPP_NUMBER: Console → Develop → Messaging → WhatsApp");
  console.log();
}

// Ejecutar
if (require.main === module) {
  checkTwilioCredentials()
    .then((success) => {
      if (!success) {
        generateTwilioConfig();
      }
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Error:", error);
      process.exit(1);
    });
}

module.exports = {
  checkTwilioCredentials,
  generateTwilioConfig,
};
