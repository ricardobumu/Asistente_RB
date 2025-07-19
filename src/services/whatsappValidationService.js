// src/services/whatsappValidationService.js
// Servicio especializado para validaciones de WhatsApp con Twilio

const logger = require("../utils/logger");

class WhatsAppValidationService {
  constructor() {
    // Códigos de error específicos de Twilio WhatsApp
    this.twilioErrorCodes = {
      // Errores del número remitente (FROM)
      63016: "Número de Twilio no habilitado para WhatsApp",
      63017: "Número de Twilio no aprobado para WhatsApp Business",
      63018: "Número de Twilio suspendido",

      // Errores del número destinatario (TO)
      63003: "Número destinatario no es WhatsApp válido",
      63004: "Número destinatario bloqueado",
      63005: "Número destinatario inválido o no existe",
      63006: "Número destinatario fuera del horario permitido",
      63007: "Número destinatario ha optado por no recibir mensajes",

      // Errores de formato
      21211: "Número de teléfono inválido (formato E.164)",
      21214: "Número de teléfono no válido para WhatsApp",

      // Errores de contenido
      63015: "Mensaje contiene contenido no permitido",
      63019: "Plantilla de mensaje no aprobada",

      // Errores de límites
      63020: "Límite de mensajes excedido",
      63021: "Ventana de conversación cerrada (24h)",
    };
  }

  /**
   * Validar número de teléfono antes de enviar
   */
  validatePhoneNumber(phone) {
    try {
      // Limpiar número
      const cleaned = phone.replace(/\D/g, "");

      // Validaciones básicas
      if (!cleaned || cleaned.length < 8 || cleaned.length > 15) {
        return {
          valid: false,
          error: "Número de teléfono debe tener entre 8 y 15 dígitos",
          code: "INVALID_LENGTH",
        };
      }

      // Validar formato E.164
      const formatted = this.formatToE164(phone);
      if (!formatted.startsWith("+")) {
        return {
          valid: false,
          error: "No se pudo formatear a E.164",
          code: "INVALID_FORMAT",
        };
      }

      // Validar códigos de país comunes
      const countryCode = this.extractCountryCode(formatted);
      if (!this.isValidCountryCode(countryCode)) {
        return {
          valid: false,
          error: `Código de país no válido: ${countryCode}`,
          code: "INVALID_COUNTRY_CODE",
        };
      }

      return {
        valid: true,
        formatted: formatted,
        countryCode: countryCode,
      };
    } catch (error) {
      logger.error("Error validando número de teléfono:", error);
      return {
        valid: false,
        error: "Error interno validando número",
        code: "VALIDATION_ERROR",
      };
    }
  }

  /**
   * Formatear número a E.164
   */
  formatToE164(phone) {
    // Remover todos los caracteres no numéricos
    let cleaned = phone.replace(/\D/g, "");

    // Si empieza con 00, remover y agregar +
    if (cleaned.startsWith("00")) {
      cleaned = cleaned.substring(2);
    }

    // Si no tiene código de país y parece español (9 dígitos)
    if (cleaned.length === 9 && cleaned.match(/^[6-9]/)) {
      cleaned = "34" + cleaned;
    }

    // Si no empieza con +, agregarlo
    if (!cleaned.startsWith("+")) {
      cleaned = "+" + cleaned;
    }

    return cleaned;
  }

  /**
   * Extraer código de país
   */
  extractCountryCode(e164Number) {
    const number = e164Number.replace("+", "");

    // Códigos de país más comunes (1-3 dígitos)
    const countryCodes = {
      1: "US/CA",
      34: "ES",
      33: "FR",
      49: "DE",
      44: "GB",
      39: "IT",
      351: "PT",
      52: "MX",
      54: "AR",
      55: "BR",
      57: "CO",
    };

    // Probar códigos de 3, 2 y 1 dígito
    for (let len = 3; len >= 1; len--) {
      const code = number.substring(0, len);
      if (countryCodes[code]) {
        return code;
      }
    }

    return number.substring(0, 2); // Fallback
  }

  /**
   * Validar si el código de país es válido
   */
  isValidCountryCode(code) {
    const validCodes = [
      "1",
      "7",
      "20",
      "27",
      "30",
      "31",
      "32",
      "33",
      "34",
      "36",
      "39",
      "40",
      "41",
      "43",
      "44",
      "45",
      "46",
      "47",
      "48",
      "49",
      "51",
      "52",
      "53",
      "54",
      "55",
      "56",
      "57",
      "58",
      "60",
      "61",
      "62",
      "63",
      "64",
      "65",
      "66",
      "81",
      "82",
      "84",
      "86",
      "90",
      "91",
      "92",
      "93",
      "94",
      "95",
      "98",
      "212",
      "213",
      "216",
      "218",
      "220",
      "221",
      "222",
      "223",
      "224",
      "225",
      "226",
      "227",
      "228",
      "229",
      "230",
      "231",
      "232",
      "233",
      "234",
      "235",
      "236",
      "237",
      "238",
      "239",
      "240",
      "241",
      "242",
      "243",
      "244",
      "245",
      "246",
      "248",
      "249",
      "250",
      "251",
      "252",
      "253",
      "254",
      "255",
      "256",
      "257",
      "258",
      "260",
      "261",
      "262",
      "263",
      "264",
      "265",
      "266",
      "267",
      "268",
      "269",
      "290",
      "291",
      "297",
      "298",
      "299",
      "350",
      "351",
      "352",
      "353",
      "354",
      "355",
      "356",
      "357",
      "358",
      "359",
      "370",
      "371",
      "372",
      "373",
      "374",
      "375",
      "376",
      "377",
      "378",
      "380",
      "381",
      "382",
      "383",
      "385",
      "386",
      "387",
      "389",
      "420",
      "421",
      "423",
      "500",
      "501",
      "502",
      "503",
      "504",
      "505",
      "506",
      "507",
      "508",
      "509",
      "590",
      "591",
      "592",
      "593",
      "594",
      "595",
      "596",
      "597",
      "598",
      "599",
      "670",
      "672",
      "673",
      "674",
      "675",
      "676",
      "677",
      "678",
      "679",
      "680",
      "681",
      "682",
      "683",
      "684",
      "685",
      "686",
      "687",
      "688",
      "689",
      "690",
      "691",
      "692",
      "850",
      "852",
      "853",
      "855",
      "856",
      "880",
      "886",
      "960",
      "961",
      "962",
      "963",
      "964",
      "965",
      "966",
      "967",
      "968",
      "970",
      "971",
      "972",
      "973",
      "974",
      "975",
      "976",
      "977",
      "992",
      "993",
      "994",
      "995",
      "996",
      "998",
    ];

    return validCodes.includes(code);
  }

  /**
   * Interpretar error de Twilio y proporcionar mensaje amigable
   */
  interpretTwilioError(error) {
    try {
      // Extraer código de error de Twilio
      let errorCode = null;
      let errorMessage = error.message || error.toString();

      // Buscar código de error en el mensaje
      const codeMatch = errorMessage.match(/Error (\d+):/);
      if (codeMatch) {
        errorCode = codeMatch[1];
      }

      // Buscar en propiedades del error
      if (!errorCode && error.code) {
        errorCode = error.code.toString();
      }

      // Interpretar código específico
      if (errorCode && this.twilioErrorCodes[errorCode]) {
        return {
          code: errorCode,
          type: this.getErrorType(errorCode),
          message: this.twilioErrorCodes[errorCode],
          userMessage: this.getUserFriendlyMessage(errorCode),
          canRetry: this.canRetryError(errorCode),
          action: this.getRecommendedAction(errorCode),
        };
      }

      // Error genérico
      return {
        code: errorCode || "UNKNOWN",
        type: "UNKNOWN",
        message: errorMessage,
        userMessage:
          "No se pudo enviar el mensaje. Por favor, verifica tu número de WhatsApp.",
        canRetry: true,
        action: "Verificar número de teléfono",
      };
    } catch (interpretError) {
      logger.error("Error interpretando error de Twilio:", interpretError);
      return {
        code: "INTERPRETATION_ERROR",
        type: "SYSTEM",
        message: "Error interpretando respuesta de Twilio",
        userMessage: "Error técnico. Contacta al administrador.",
        canRetry: false,
        action: "Contactar soporte técnico",
      };
    }
  }

  /**
   * Obtener tipo de error
   */
  getErrorType(errorCode) {
    const senderErrors = ["63016", "63017", "63018"];
    const recipientErrors = ["63003", "63004", "63005", "63006", "63007"];
    const formatErrors = ["21211", "21214"];
    const contentErrors = ["63015", "63019"];
    const limitErrors = ["63020", "63021"];

    if (senderErrors.includes(errorCode)) return "SENDER";
    if (recipientErrors.includes(errorCode)) return "RECIPIENT";
    if (formatErrors.includes(errorCode)) return "FORMAT";
    if (contentErrors.includes(errorCode)) return "CONTENT";
    if (limitErrors.includes(errorCode)) return "LIMITS";

    return "UNKNOWN";
  }

  /**
   * Obtener mensaje amigable para el usuario
   */
  getUserFriendlyMessage(errorCode) {
    const messages = {
      63003: "Este número no tiene WhatsApp activo. Verifica que sea correcto.",
      63004: "Este número ha bloqueado los mensajes comerciales.",
      63005: "El número de teléfono no existe o no es válido.",
      63006: "No se pueden enviar mensajes en este horario.",
      63007: "Este contacto ha optado por no recibir mensajes.",
      21211: "El formato del número de teléfono no es válido.",
      21214: "Este número no es compatible con WhatsApp.",
      63015: "El mensaje contiene contenido no permitido.",
      63020: "Se ha excedido el límite de mensajes.",
      63021: "La ventana de conversación ha expirado (24h).",
      63016: "Error de configuración del servicio WhatsApp.",
      63017: "Número de servicio no aprobado para WhatsApp Business.",
      63018: "Servicio WhatsApp temporalmente suspendido.",
    };

    return (
      messages[errorCode] ||
      "No se pudo enviar el mensaje. Inténtalo más tarde."
    );
  }

  /**
   * Determinar si se puede reintentar el envío
   */
  canRetryError(errorCode) {
    const noRetryErrors = [
      "63003",
      "63004",
      "63005",
      "63007",
      "21211",
      "21214",
      "63015",
    ];
    return !noRetryErrors.includes(errorCode);
  }

  /**
   * Obtener acción recomendada
   */
  getRecommendedAction(errorCode) {
    const actions = {
      63003: "Verificar que el número tenga WhatsApp activo",
      63004: "Contactar por otro medio",
      63005: "Verificar y corregir el número de teléfono",
      63006: "Reintentar en horario comercial",
      63007: "Respetar la decisión del usuario",
      21211: "Corregir formato del número (incluir código de país)",
      21214: "Usar un número compatible con WhatsApp",
      63015: "Revisar contenido del mensaje",
      63020: "Esperar antes de enviar más mensajes",
      63021: "Iniciar nueva conversación",
      63016: "Contactar administrador del sistema",
      63017: "Verificar configuración de WhatsApp Business",
      63018: "Contactar soporte de Twilio",
    };

    return actions[errorCode] || "Verificar configuración y reintentar";
  }

  /**
   * Validar mensaje antes de enviar
   */
  validateMessage(message) {
    if (!message || typeof message !== "string") {
      return {
        valid: false,
        error: "Mensaje vacío o inválido",
      };
    }

    if (message.length > 1600) {
      return {
        valid: false,
        error: "Mensaje demasiado largo (máximo 1600 caracteres)",
      };
    }

    // Validar caracteres problemáticos
    const problematicChars = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
    if (problematicChars.test(message)) {
      return {
        valid: false,
        error: "Mensaje contiene caracteres no válidos",
      };
    }

    return { valid: true };
  }

  /**
   * Log estructurado de errores de WhatsApp
   */
  logWhatsAppError(error, context = {}) {
    const interpretation = this.interpretTwilioError(error);

    logger.error("❌ Error WhatsApp detallado", {
      ...context,
      error: {
        original: error.message,
        code: interpretation.code,
        type: interpretation.type,
        interpretation: interpretation.message,
        canRetry: interpretation.canRetry,
        action: interpretation.action,
      },
    });

    return interpretation;
  }
}

module.exports = new WhatsAppValidationService();
