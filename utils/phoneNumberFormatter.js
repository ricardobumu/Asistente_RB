/**
 * UTILIDAD DE FORMATEO DE NÚMEROS DE TELÉFONO
 * Limpia y formatea números de teléfono a formato E.164
 *
 * Cumple con estándares internacionales y maneja casos edge
 * Optimizado para España (+34) como país por defecto
 */

const logger = require("./logger");

/**
 * Códigos de país más comunes para el negocio
 * Priorizados: España, Estados Unidos, Colombia, Suiza
 */
const COUNTRY_CODES = {
  ES: "+34", // España (por defecto)
  US: "+1", // Estados Unidos
  CO: "+57", // Colombia
  CH: "+41", // Suiza
  FR: "+33", // Francia
  IT: "+39", // Italia
  PT: "+351", // Portugal
  UK: "+44", // Reino Unido
  DE: "+49", // Alemania
  MX: "+52", // México
  AR: "+54", // Argentina
};

/**
 * Patrones de validación por país
 * Actualizados con patrones más precisos para los países prioritarios
 */
const VALIDATION_PATTERNS = {
  "+34": /^\+34[6-9]\d{8}$/, // España: móviles 6xx, 7xx, 8xx, 9xx
  "+1": /^\+1[2-9]\d{2}[2-9]\d{6}$/, // Estados Unidos/Canadá: formato más estricto
  "+57": /^\+57[13]\d{9}$/, // Colombia: móviles 3xx, fijos 1xx
  "+41": /^\+41[1-9]\d{8}$/, // Suiza: 9 dígitos después del código
  "+33": /^\+33[1-9]\d{8}$/, // Francia
  "+39": /^\+39\d{6,11}$/, // Italia
  "+351": /^\+351[1-9]\d{8}$/, // Portugal
  "+44": /^\+44[1-9]\d{8,9}$/, // Reino Unido
  "+49": /^\+49[1-9]\d{10,11}$/, // Alemania
  "+52": /^\+52[1-9]\d{9}$/, // México
  "+54": /^\+54[1-9]\d{9}$/, // Argentina
};

/**
 * Configuración detallada de países prioritarios
 * Para detección automática y corrección de números
 */
const PRIORITY_COUNTRIES = {
  ES: {
    code: "ES",
    name: "España",
    countryCode: "+34",
    nationalLength: 9, // Longitud sin código de país
    patterns: {
      mobile: /^[6-7]\d{8}$/, // Móviles: 6xx xxx xxx, 7xx xxx xxx
      fixed: /^[8-9]\d{8}$/, // Fijos: 8xx xxx xxx, 9xx xxx xxx
    },
  },
  US: {
    code: "US",
    name: "Estados Unidos",
    countryCode: "+1",
    nationalLength: 10, // Longitud sin código de país
    patterns: {
      mobile: /^[2-9]\d{2}[2-9]\d{6}$/, // NXX-NXX-XXXX (N=2-9, X=0-9)
      fixed: /^[2-9]\d{2}[2-9]\d{6}$/, // Mismo patrón para fijos
    },
  },
  CO: {
    code: "CO",
    name: "Colombia",
    countryCode: "+57",
    nationalLength: [10, 8], // Móviles 10, fijos 8
    patterns: {
      mobile: /^3\d{9}$/, // Móviles: 3xx xxx xxxx
      fixed: /^[1-8]\d{7}$/, // Fijos: 1 xxx xxxx (Bogotá), 4 xxx xxxx (Medellín), etc.
    },
  },
  CH: {
    code: "CH",
    name: "Suiza",
    countryCode: "+41",
    nationalLength: 9, // Longitud sin código de país
    patterns: {
      mobile: /^[7-9]\d{8}$/, // Móviles: 7x xxx xx xx, 8x xxx xx xx, 9x xxx xx xx
      fixed: /^[1-6]\d{8}$/, // Fijos: 1x xxx xx xx, etc.
    },
  },
};

/**
 * Limpia un número de teléfono eliminando caracteres no numéricos
 * @param {string} phoneNumber - Número de teléfono a limpiar
 * @returns {string} - Número limpio solo con dígitos y +
 */
function cleanPhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== "string") {
    return "";
  }

  // Eliminar todos los caracteres excepto dígitos, + y espacios
  let cleaned = phoneNumber.replace(/[^\d+\s]/g, "");

  // Eliminar espacios
  cleaned = cleaned.replace(/\s/g, "");

  // Si empieza con 00, reemplazar por +
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.substring(2);
  }

  return cleaned;
}

/**
 * Detecta el código de país de un número de teléfono
 * @param {string} phoneNumber - Número de teléfono limpio
 * @returns {string|null} - Código de país detectado o null
 */
function detectCountryCode(phoneNumber) {
  if (!phoneNumber.startsWith("+")) {
    return null;
  }

  // Buscar el código de país más largo que coincida
  const sortedCodes = Object.values(COUNTRY_CODES).sort(
    (a, b) => b.length - a.length
  );

  for (const code of sortedCodes) {
    if (phoneNumber.startsWith(code)) {
      return code;
    }
  }

  return null;
}

/**
 * Detecta automáticamente el país basado en patrones de número
 * @param {string} phoneNumber - Número sin código de país
 * @returns {string|null} - Código de país detectado o null
 */
function detectCountryFromPattern(phoneNumber) {
  // Limpiar número
  const cleaned = phoneNumber.replace(/\D/g, "");

  // Patrones de detección automática mejorados

  // España: móviles 6xx-9xx con 9 dígitos
  if (/^[6-9]\d{8}$/.test(cleaned) && cleaned.length === 9) {
    return "+34";
  }

  // Estados Unidos: 10 dígitos con formato NXX-NXX-XXXX
  if (/^[2-9]\d{2}[2-9]\d{6}$/.test(cleaned) && cleaned.length === 10) {
    return "+1";
  }

  // Estados Unidos: números que empiezan con 1 seguido de 10 dígitos válidos
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    const withoutOne = cleaned.substring(1);
    if (/^[2-9]\d{2}[2-9]\d{6}$/.test(withoutOne)) {
      return "+1";
    }
  }

  // Colombia: móviles 3xxxxxxxxx (10 dígitos)
  if (/^3\d{9}$/.test(cleaned) && cleaned.length === 10) {
    return "+57";
  }

  // Colombia: fijos 1xxxxxxx, 4xxxxxxx, etc. (8 dígitos)
  if (/^[1-8]\d{7}$/.test(cleaned) && cleaned.length === 8) {
    return "+57";
  }

  // Suiza: 9 dígitos empezando con 1-9
  if (/^[1-9]\d{8}$/.test(cleaned) && cleaned.length === 9) {
    return "+41";
  }

  // Si no se puede detectar, devolver null
  return null;
}

/**
 * Intenta corregir números sin código de país basándose en patrones conocidos
 * @param {string} phoneNumber - Número original
 * @returns {string|null} - Número corregido con código de país o null
 */
function correctNumberWithoutCountryCode(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== "string") {
    return null;
  }

  const cleaned = cleanPhoneNumber(phoneNumber);
  if (!cleaned || cleaned.startsWith("+")) {
    return null; // Ya tiene código o no se puede limpiar
  }

  // Detectar país por patrón
  const detectedCountry = detectCountryFromPattern(cleaned);
  if (!detectedCountry) {
    return null;
  }

  let corrected = null;

  switch (detectedCountry) {
    case "+34": // España
      corrected = "+34" + cleaned;
      break;

    case "+1": // Estados Unidos
      if (cleaned.length === 11 && cleaned.startsWith("1")) {
        // Remover el 1 inicial duplicado
        corrected = "+1" + cleaned.substring(1);
      } else if (cleaned.length === 10) {
        corrected = "+1" + cleaned;
      }
      break;

    case "+57": // Colombia
      corrected = "+57" + cleaned;
      break;

    case "+41": // Suiza
      corrected = "+41" + cleaned;
      break;
  }

  // Validar el número corregido
  if (corrected) {
    const validation = validatePhoneNumber(corrected);
    if (validation.isValid) {
      return corrected;
    }
  }

  return null;
}

/**
 * Valida un número de teléfono según su código de país
 * @param {string} phoneNumber - Número de teléfono en formato E.164
 * @returns {boolean} - true si es válido, false si no
 */
function validatePhoneNumber(phoneNumber) {
  try {
    if (!phoneNumber || typeof phoneNumber !== "string") {
      return { isValid: false, reason: "Entrada inválida" };
    }

    // Limpiar el número primero
    const cleaned = cleanPhoneNumber(phoneNumber);

    if (!cleaned) {
      return { isValid: false, reason: "No se pudo limpiar el número" };
    }

    // Verificar que empiece con +
    if (!cleaned.startsWith("+")) {
      return { isValid: false, reason: "Debe empezar con código de país" };
    }

    // Verificar longitud mínima y máxima
    if (cleaned.length < 8 || cleaned.length > 16) {
      return { isValid: false, reason: "Longitud inválida" };
    }

    // Detectar código de país
    const countryCode = detectCountryCode(cleaned);

    if (!countryCode) {
      // Validación genérica para códigos no reconocidos
      const isValid = /^\+\d{7,15}$/.test(cleaned);
      return {
        isValid,
        reason: isValid ? "Válido (genérico)" : "Formato inválido",
        countryCode: "UNKNOWN",
      };
    }

    // Validación específica por país
    const pattern = VALIDATION_PATTERNS[countryCode];
    if (!pattern) {
      // Validación genérica si no hay patrón específico
      const isValid = /^\+\d{7,15}$/.test(cleaned);
      return {
        isValid,
        reason: isValid ? "Válido (sin patrón específico)" : "Formato inválido",
        countryCode,
      };
    }

    const isValid = pattern.test(cleaned);
    return {
      isValid,
      reason: isValid ? "Válido" : "No cumple patrón del país",
      countryCode,
      pattern: pattern.toString(),
    };
  } catch (error) {
    logger.error("Error validando número de teléfono", {
      phoneNumber,
      error: error.message,
    });
    return {
      isValid: false,
      reason: "Error de validación",
      error: error.message,
    };
  }
}

/**
 * Formatea un número de teléfono a formato E.164
 * @param {string} phoneNumber - Número de teléfono a formatear
 * @param {string} defaultCountryCode - Código de país por defecto (default: +34)
 * @returns {string|null} - Número formateado o null si es inválido
 */
function formatPhoneNumber(phoneNumber, defaultCountryCode = "+34") {
  try {
    // Validar entrada
    if (!phoneNumber || typeof phoneNumber !== "string") {
      logger.warn("Número de teléfono inválido: entrada vacía o no string", {
        phoneNumber,
      });
      return null;
    }

    // Limpiar número
    let cleaned = cleanPhoneNumber(phoneNumber);

    if (!cleaned) {
      logger.warn("Número de teléfono inválido: no se pudo limpiar", {
        phoneNumber,
      });
      return null;
    }

    // Corregir números malformados comunes
    // Caso específico: +3434XXXXXXXXX -> +34XXXXXXXXX (cualquier longitud)
    if (cleaned.startsWith("+3434") && cleaned.length >= 13) {
      cleaned = "+34" + cleaned.substring(5);
      logger.info("Corregido número malformado +3434 -> +34", {
        original: phoneNumber,
        corrected: cleaned,
      });
    }

    // Caso específico: números muy largos con +34 duplicado
    if (cleaned.startsWith("+34") && cleaned.length > 12) {
      // Verificar si hay duplicación del código de país
      const withoutCountryCode = cleaned.substring(3);
      if (withoutCountryCode.startsWith("34")) {
        cleaned = "+34" + withoutCountryCode.substring(2);
        logger.info("Corregido número con código duplicado", {
          original: phoneNumber,
          corrected: cleaned,
        });
      }
    }

    // Si ya tiene código de país, validar y devolver
    if (cleaned.startsWith("+")) {
      const validation = validatePhoneNumber(cleaned);
      if (validation.isValid) {
        logger.info("Número de teléfono formateado correctamente", {
          original: phoneNumber,
          formatted: cleaned,
        });
        return cleaned;
      } else {
        logger.warn("Número de teléfono inválido: no pasa validación", {
          phoneNumber,
          cleaned,
          reason: validation.reason,
        });
        return null;
      }
    }

    // Intentar corregir número sin código de país usando detección inteligente
    const correctedNumber = correctNumberWithoutCountryCode(phoneNumber);
    if (correctedNumber) {
      logger.info("Número corregido automáticamente", {
        original: phoneNumber,
        corrected: correctedNumber,
      });
      return correctedNumber;
    }

    // Fallback: usar método anterior
    const detectedCountry = detectCountryFromPattern(cleaned);
    const countryCodeToUse = detectedCountry || defaultCountryCode;

    // Si no tiene código de país, agregar el detectado o por defecto
    let withCountryCode = countryCodeToUse + cleaned;

    // Casos especiales por país
    if (countryCodeToUse === "+34") {
      // España: casos especiales
      if (cleaned.startsWith("0")) {
        cleaned = cleaned.substring(1);
        withCountryCode = countryCodeToUse + cleaned;
      }
      if (cleaned.startsWith("34")) {
        withCountryCode = "+" + cleaned;
      }
    } else if (countryCodeToUse === "+1") {
      // Estados Unidos: remover 1 inicial si existe
      if (cleaned.startsWith("1") && cleaned.length === 11) {
        cleaned = cleaned.substring(1);
        withCountryCode = countryCodeToUse + cleaned;
      }
    } else if (countryCodeToUse === "+57") {
      // Colombia: casos especiales
      if (cleaned.startsWith("57") && cleaned.length === 12) {
        withCountryCode = "+" + cleaned;
      }
    } else if (countryCodeToUse === "+41") {
      // Suiza: casos especiales
      if (cleaned.startsWith("0")) {
        cleaned = cleaned.substring(1);
        withCountryCode = countryCodeToUse + cleaned;
      }
      if (cleaned.startsWith("41") && cleaned.length === 11) {
        withCountryCode = "+" + cleaned;
      }
    }

    // Validar número final
    const finalValidation = validatePhoneNumber(withCountryCode);
    if (finalValidation.isValid) {
      logger.info("Número de teléfono formateado correctamente", {
        original: phoneNumber,
        formatted: withCountryCode,
        detectedCountry: detectedCountry,
      });
      return withCountryCode;
    } else {
      logger.warn("Número de teléfono inválido después del formateo", {
        phoneNumber,
        cleaned,
        withCountryCode,
        detectedCountry,
        reason: finalValidation.reason,
      });
      return null;
    }
  } catch (error) {
    logger.error("Error formateando número de teléfono", {
      phoneNumber,
      error: error.message,
    });
    return null;
  }
}

/**
 * Formatea un número para mostrar de forma legible
 * @param {string} phoneNumber - Número en formato E.164
 * @returns {string} - Número formateado para mostrar
 */
function formatForDisplay(phoneNumber) {
  if (!phoneNumber || !phoneNumber.startsWith("+")) {
    return phoneNumber;
  }

  const countryCode = detectCountryCode(phoneNumber);
  const number = phoneNumber.substring(countryCode?.length || 0);

  // Formateo específico por país
  switch (countryCode) {
    case "+34": // España: +34 XXX XXX XXX
      return `${countryCode} ${number.substring(0, 3)} ${number.substring(3, 6)} ${number.substring(6)}`;
    case "+1": // US/Canadá: +1 (XXX) XXX-XXXX
      return `${countryCode} (${number.substring(0, 3)}) ${number.substring(3, 6)}-${number.substring(6)}`;
    case "+57": // Colombia: +57 XXX XXX XXXX
      return `${countryCode} ${number.substring(0, 3)} ${number.substring(3, 6)} ${number.substring(6)}`;
    case "+41": // Suiza: +41 XX XXX XX XX
      return `${countryCode} ${number.substring(0, 2)} ${number.substring(2, 5)} ${number.substring(5, 7)} ${number.substring(7)}`;
    case "+33": // Francia: +33 X XX XX XX XX
      return `${countryCode} ${number.substring(0, 1)} ${number.substring(1, 3)} ${number.substring(3, 5)} ${number.substring(5, 7)} ${number.substring(7)}`;
    default:
      // Formato genérico
      if (number.length >= 9) {
        return `${countryCode} ${number.substring(0, 3)} ${number.substring(3, 6)} ${number.substring(6)}`;
      }
      return phoneNumber;
  }
}

/**
 * Extrae números de teléfono de un texto
 * @param {string} text - Texto que puede contener números de teléfono
 * @returns {string[]} - Array de números de teléfono encontrados
 */
function extractPhoneNumbers(text) {
  if (!text || typeof text !== "string") {
    return [];
  }

  // Patrones para detectar números de teléfono
  const patterns = [
    /\+\d{1,4}[\s\-]?\d{6,14}/g, // Formato internacional
    /\b\d{9,15}\b/g, // Números largos
    /\b[6-9]\d{8}\b/g, // Móviles españoles
  ];

  const foundNumbers = [];

  patterns.forEach((pattern) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach((match) => {
        const formatted = formatPhoneNumber(match);
        if (formatted && !foundNumbers.includes(formatted)) {
          foundNumbers.push(formatted);
        }
      });
    }
  });

  return foundNumbers;
}

/**
 * Valida si un número pertenece a WhatsApp Business
 * @param {string} phoneNumber - Número en formato E.164
 * @returns {boolean} - true si es un número de WhatsApp Business
 */
function isWhatsAppBusinessNumber(phoneNumber) {
  // Números conocidos de WhatsApp Business API
  const whatsappBusinessNumbers = [
    "+14155238886", // Twilio Sandbox
    "+34600000000", // Ejemplo España
  ];

  return whatsappBusinessNumbers.includes(phoneNumber);
}

/**
 * Obtiene información del país basada en el código de país
 * @param {string} phoneNumber - Número en formato E.164
 * @returns {object|null} - Información del país o null
 */
function getCountryInfo(phoneNumber) {
  const countryCode = detectCountryCode(phoneNumber);
  if (!countryCode) return null;

  const countryMap = {
    "+34": { code: "ES", name: "España", timezone: "Europe/Madrid" },
    "+1": { code: "US", name: "Estados Unidos", timezone: "America/New_York" },
    "+57": { code: "CO", name: "Colombia", timezone: "America/Bogota" },
    "+41": { code: "CH", name: "Suiza", timezone: "Europe/Zurich" },
    "+33": { code: "FR", name: "Francia", timezone: "Europe/Paris" },
    "+39": { code: "IT", name: "Italia", timezone: "Europe/Rome" },
    "+351": { code: "PT", name: "Portugal", timezone: "Europe/Lisbon" },
    "+44": { code: "UK", name: "Reino Unido", timezone: "Europe/London" },
    "+49": { code: "DE", name: "Alemania", timezone: "Europe/Berlin" },
    "+52": { code: "MX", name: "México", timezone: "America/Mexico_City" },
    "+54": {
      code: "AR",
      name: "Argentina",
      timezone: "America/Argentina/Buenos_Aires",
    },
  };

  return countryMap[countryCode] || null;
}

module.exports = {
  formatPhoneNumber,
  cleanPhoneNumber,
  validatePhoneNumber,
  formatForDisplay,
  extractPhoneNumbers,
  detectCountryCode,
  detectCountryFromPattern,
  correctNumberWithoutCountryCode,
  isWhatsAppBusinessNumber,
  getCountryInfo,
  COUNTRY_CODES,
  PRIORITY_COUNTRIES,
};
