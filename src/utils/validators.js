// src/utils/validators.js
const logger = require("./logger");

class Validators {
  // Validar email
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validar teléfono
  static isValidPhone(phone) {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  }

  // Validar fecha (YYYY-MM-DD)
  static isValidDate(dateString) {
    const date = new Date(dateString);
    return (
      date instanceof Date &&
      !isNaN(date) &&
      dateString.match(/^\d{4}-\d{2}-\d{2}$/)
    );
  }

  // Validar hora (HH:MM)
  static isValidTime(timeString) {
    return timeString.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/);
  }

  // Validar datos de cliente
  static validateClientData(clientData) {
    const errors = [];

    if (!clientData.name || clientData.name.trim().length < 2) {
      errors.push("El nombre debe tener al menos 2 caracteres");
    }

    if (!clientData.email || !this.isValidEmail(clientData.email)) {
      errors.push("Email inválido");
    }

    if (!clientData.phone || !this.isValidPhone(clientData.phone)) {
      errors.push("Teléfono inválido");
    }

    if (
      clientData.preferred_contact_method &&
      !["whatsapp", "email", "sms"].includes(
        clientData.preferred_contact_method
      )
    ) {
      errors.push("Método de contacto inválido");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Validar datos de reserva
  static validateBookingData(bookingData) {
    const errors = [];

    if (!bookingData.client_id) {
      errors.push("ID de cliente requerido");
    }

    if (!bookingData.service_id) {
      errors.push("ID de servicio requerido");
    }

    if (
      !bookingData.booking_date ||
      !this.isValidDate(bookingData.booking_date)
    ) {
      errors.push("Fecha de reserva inválida");
    }

    if (
      !bookingData.booking_time ||
      !this.isValidTime(bookingData.booking_time)
    ) {
      errors.push("Hora de reserva inválida");
    }

    if (
      bookingData.total_price &&
      (isNaN(bookingData.total_price) || bookingData.total_price < 0)
    ) {
      errors.push("Precio total inválido");
    }

    // Validar que la fecha no sea en el pasado
    if (bookingData.booking_date) {
      const bookingDate = new Date(bookingData.booking_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (bookingDate < today) {
        errors.push("No se pueden crear reservas en fechas pasadas");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Sanitizar entrada de texto
  static sanitizeText(text) {
    if (typeof text !== "string") return text;
    return text.trim().replace(/[<>]/g, "");
  }

  // Validar paginación
  static validatePagination(limit, offset) {
    const errors = [];

    if (limit && (isNaN(limit) || limit < 1 || limit > 100)) {
      errors.push("Límite debe estar entre 1 y 100");
    }

    if (offset && (isNaN(offset) || offset < 0)) {
      errors.push("Offset debe ser mayor o igual a 0");
    }

    return {
      isValid: errors.length === 0,
      errors,
      limit: Math.min(parseInt(limit) || 20, 100),
      offset: parseInt(offset) || 0,
    };
  }
}

module.exports = Validators;
