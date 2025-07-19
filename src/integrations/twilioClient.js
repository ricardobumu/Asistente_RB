// src/integrations/twilioClient.js
const twilio = require("twilio");
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = require("../config/env");
const logger = require("../utils/logger");

// Verificar si Twilio está deshabilitado para pruebas
const DISABLE_TWILIO = process.env.DISABLE_TWILIO === "true";

let twilioClient;

if (DISABLE_TWILIO) {
  logger.warn("🚨 TWILIO DESHABILITADO - Modo de prueba activo");

  // Cliente mock para pruebas
  twilioClient = {
    messages: {
      create: async (options) => {
        logger.info("📱 [MOCK] Mensaje WhatsApp simulado:", {
          to: options.to,
          body: options.body?.substring(0, 100) + "...",
        });

        return {
          sid: "mock_message_" + Date.now(),
          status: "sent",
          to: options.to,
          from: options.from,
          body: options.body,
        };
      },

      list: async (options = {}) => {
        logger.info("📱 [MOCK] Listando mensajes simulados");
        return [];
      },
    },

    // Mock para otros métodos que puedan ser necesarios
    api: {
      accounts: () => ({
        fetch: async () => ({
          sid: "mock_account",
          friendlyName: "Mock Account",
          status: "active",
        }),
      }),
    },
  };
} else {
  try {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    logger.info("✅ Cliente Twilio inicializado correctamente");
  } catch (error) {
    logger.error("❌ Error inicializando cliente Twilio:", error.message);

    // Fallback a cliente mock si hay error
    twilioClient = {
      messages: {
        create: async (options) => {
          logger.error(
            "📱 [ERROR] No se pudo enviar mensaje WhatsApp - Twilio no disponible"
          );
          throw new Error("Twilio no disponible - verificar credenciales");
        },
      },
    };
  }
}

module.exports = twilioClient;
