// src/utils/sanitizers.js
// Utilidades para sanitización de datos de entrada

const logger = require("./logger");

/**
 * Sanitizar texto general
 * @param {string} text - Texto a sanitizar
 * @param {Object} options - Opciones de sanitización
 * @returns {string} - Texto sanitizado
 */
function sanitizeText(text, options = {}) {
  if (!text || typeof text !== "string") {
    return "";
  }

  const {
    maxLength = 1000,
    allowHtml = false,
    allowEmojis = true,
    trimWhitespace = true,
  } = options;

  let sanitized = text;

  // Trim whitespace si está habilitado
  if (trimWhitespace) {
    sanitized = sanitized.trim();
  }

  // Limitar longitud
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
    logger.warn("Text truncated due to length limit", {
      originalLength: text.length,
      maxLength,
      truncated: true,
    });
  }

  // Remover HTML si no está permitido
  if (!allowHtml) {
    sanitized = sanitized.replace(/<[^>]*>/g, "");
  }

  // Remover caracteres de control peligrosos
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Remover emojis si no están permitidos
  if (!allowEmojis) {
    sanitized = sanitized.replace(
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu,
      ""
    );
  }

  // Escapar caracteres especiales para prevenir inyección
  sanitized = sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");

  return sanitized;
}

/**
 * Sanitizar número de teléfono
 * @param {string} phone - Número de teléfono a sanitizar
 * @returns {string} - Número sanitizado
 */
function sanitizePhone(phone) {
  if (!phone || typeof phone !== "string") {
    return "";
  }

  // Remover todos los caracteres que no sean dígitos, +, espacios, guiones o paréntesis
  let sanitized = phone.replace(/[^\d\+\s\-\(\)]/g, "");

  // Trim whitespace
  sanitized = sanitized.trim();

  // Normalizar formato internacional
  if (sanitized.startsWith("00")) {
    sanitized = "+" + sanitized.substring(2);
  }

  // Validar longitud básica (entre 7 y 15 dígitos según ITU-T E.164)
  const digitsOnly = sanitized.replace(/[^\d]/g, "");
  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    logger.warn("Phone number length outside valid range", {
      phone: sanitized,
      digitsCount: digitsOnly.length,
    });
  }

  return sanitized;
}

/**
 * Sanitizar email
 * @param {string} email - Email a sanitizar
 * @returns {string} - Email sanitizado
 */
function sanitizeEmail(email) {
  if (!email || typeof email !== "string") {
    return "";
  }

  // Convertir a minúsculas y trim
  let sanitized = email.toLowerCase().trim();

  // Remover caracteres peligrosos
  sanitized = sanitized.replace(/[<>'"]/g, "");

  // Validar formato básico
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    logger.warn("Invalid email format detected", {
      email: sanitized,
    });
  }

  return sanitized;
}

/**
 * Sanitizar nombre
 * @param {string} name - Nombre a sanitizar
 * @returns {string} - Nombre sanitizado
 */
function sanitizeName(name) {
  if (!name || typeof name !== "string") {
    return "";
  }

  // Trim y capitalizar primera letra de cada palabra
  let sanitized = name.trim();

  // Remover caracteres especiales excepto espacios, guiones y apostrofes
  sanitized = sanitized.replace(/[^a-zA-ZÀ-ÿ\u00f1\u00d1\s\-']/g, "");

  // Capitalizar primera letra de cada palabra
  sanitized = sanitized.replace(/\b\w/g, (l) => l.toUpperCase());

  // Limitar longitud
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100);
  }

  return sanitized;
}

/**
 * Sanitizar URL
 * @param {string} url - URL a sanitizar
 * @returns {string} - URL sanitizada
 */
function sanitizeUrl(url) {
  if (!url || typeof url !== "string") {
    return "";
  }

  let sanitized = url.trim();

  // Validar que sea una URL válida
  try {
    const urlObj = new URL(sanitized);

    // Solo permitir protocolos seguros
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      logger.warn("Unsafe URL protocol detected", {
        url: sanitized,
        protocol: urlObj.protocol,
      });
      return "";
    }

    return urlObj.toString();
  } catch (error) {
    logger.warn("Invalid URL format", {
      url: sanitized,
      error: error.message,
    });
    return "";
  }
}

/**
 * Sanitizar datos de entrada de WhatsApp
 * @param {Object} data - Datos a sanitizar
 * @returns {Object} - Datos sanitizados
 */
function sanitizeWhatsAppData(data) {
  if (!data || typeof data !== "object") {
    return {};
  }

  const sanitized = {};

  // Sanitizar campos comunes
  if (data.Body) {
    sanitized.Body = sanitizeText(data.Body, {
      maxLength: 4096,
      allowEmojis: true,
      allowHtml: false,
    });
  }

  if (data.From) {
    sanitized.From = sanitizePhone(data.From);
  }

  if (data.To) {
    sanitized.To = sanitizePhone(data.To);
  }

  if (data.ProfileName) {
    sanitized.ProfileName = sanitizeName(data.ProfileName);
  }

  // Copiar otros campos seguros
  const safeFields = [
    "MessageSid",
    "AccountSid",
    "MessagingServiceSid",
    "NumMedia",
    "MediaContentType0",
    "MediaUrl0",
  ];
  safeFields.forEach((field) => {
    if (data[field]) {
      sanitized[field] = String(data[field]).trim();
    }
  });

  return sanitized;
}

/**
 * Sanitizar datos de formulario
 * @param {Object} formData - Datos del formulario
 * @returns {Object} - Datos sanitizados
 */
function sanitizeFormData(formData) {
  if (!formData || typeof formData !== "object") {
    return {};
  }

  const sanitized = {};

  Object.keys(formData).forEach((key) => {
    const value = formData[key];

    if (typeof value === "string") {
      switch (key.toLowerCase()) {
        case "email":
          sanitized[key] = sanitizeEmail(value);
          break;
        case "phone":
        case "telefono":
          sanitized[key] = sanitizePhone(value);
          break;
        case "name":
        case "nombre":
          sanitized[key] = sanitizeName(value);
          break;
        case "url":
        case "website":
          sanitized[key] = sanitizeUrl(value);
          break;
        default:
          sanitized[key] = sanitizeText(value);
      }
    } else if (typeof value === "number") {
      sanitized[key] = value;
    } else if (typeof value === "boolean") {
      sanitized[key] = value;
    } else if (value === null || value === undefined) {
      sanitized[key] = value;
    } else {
      // Para otros tipos, convertir a string y sanitizar
      sanitized[key] = sanitizeText(String(value));
    }
  });

  return sanitized;
}

module.exports = {
  sanitizeText,
  sanitizePhone,
  sanitizeEmail,
  sanitizeName,
  sanitizeUrl,
  sanitizeWhatsAppData,
  sanitizeFormData,
};
