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

  // Validar datos de cliente (estructura real)
  static validateClientData(clientData, isFullValidation = true) {
    const errors = [];

    // Validaciones obligatorias para creación
    if (isFullValidation) {
      if (!clientData.first_name || clientData.first_name.trim().length < 2) {
        errors.push("El nombre debe tener al menos 2 caracteres");
      }

      if (!clientData.phone || !this.isValidPhone(clientData.phone)) {
        errors.push("Teléfono inválido o requerido");
      }
    }

    // Validaciones opcionales pero si están presentes deben ser válidas
    if (clientData.first_name && clientData.first_name.trim().length < 2) {
      errors.push("El nombre debe tener al menos 2 caracteres");
    }

    if (clientData.last_name && clientData.last_name.trim().length < 1) {
      errors.push("El apellido no puede estar vacío si se proporciona");
    }

    if (clientData.email && !this.isValidEmail(clientData.email)) {
      errors.push("Email inválido");
    }

    if (clientData.phone && !this.isValidPhone(clientData.phone)) {
      errors.push("Teléfono inválido");
    }

    if (
      clientData.whatsapp_phone &&
      !this.isValidPhone(clientData.whatsapp_phone)
    ) {
      errors.push("Número de WhatsApp inválido");
    }

    if (
      clientData.preferred_contact_method &&
      !["whatsapp", "email", "sms", "phone"].includes(
        clientData.preferred_contact_method
      )
    ) {
      errors.push("Método de contacto inválido");
    }

    if (clientData.birth_date && !this.isValidDate(clientData.birth_date)) {
      errors.push("Fecha de nacimiento inválida");
    }

    if (
      clientData.gender &&
      !["male", "female", "other", "prefer_not_to_say"].includes(
        clientData.gender
      )
    ) {
      errors.push("Género inválido");
    }

    if (
      clientData.status &&
      !["active", "inactive", "blocked", "deleted"].includes(clientData.status)
    ) {
      errors.push("Estado inválido");
    }

    // Validar RGPD
    if (
      typeof clientData.lgpd_accepted !== "undefined" &&
      typeof clientData.lgpd_accepted !== "boolean"
    ) {
      errors.push("LGPD acceptance debe ser boolean");
    }

    if (
      typeof clientData.registration_complete !== "undefined" &&
      typeof clientData.registration_complete !== "boolean"
    ) {
      errors.push("Registration complete debe ser boolean");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Sanitizar datos de cliente
  static sanitizeClientData(clientData) {
    const sanitized = {};

    // Sanitizar strings
    if (clientData.first_name) {
      sanitized.first_name = this.sanitizeText(clientData.first_name);
    }

    if (clientData.last_name) {
      sanitized.last_name = this.sanitizeText(clientData.last_name);
    }

    if (clientData.email) {
      sanitized.email = clientData.email.toLowerCase().trim();
    }

    if (clientData.phone) {
      sanitized.phone = clientData.phone.replace(/\s+/g, "").replace(/^\+/, "");
    }

    if (clientData.whatsapp_phone) {
      sanitized.whatsapp_phone = clientData.whatsapp_phone
        .replace(/\s+/g, "")
        .replace(/^\+/, "");
    }

    if (clientData.address) {
      sanitized.address = this.sanitizeText(clientData.address);
    }

    if (clientData.notes) {
      sanitized.notes = this.sanitizeText(clientData.notes);
    }

    if (clientData.emergency_contact_name) {
      sanitized.emergency_contact_name = this.sanitizeText(
        clientData.emergency_contact_name
      );
    }

    if (clientData.emergency_contact_phone) {
      sanitized.emergency_contact_phone = clientData.emergency_contact_phone
        .replace(/\s+/g, "")
        .replace(/^\+/, "");
    }

    // Campos que no necesitan sanitización pero se copian si están presentes
    const directCopyFields = [
      "birth_date",
      "gender",
      "preferred_contact_method",
      "status",
      "lgpd_accepted",
      "lgpd_accepted_at",
      "registration_complete",
      "last_login",
      "preferences",
    ];

    directCopyFields.forEach((field) => {
      if (clientData[field] !== undefined) {
        sanitized[field] = clientData[field];
      }
    });

    return sanitized;
  }

  // Validar datos de reserva (estructura real)
  static validateBookingData(bookingData, isFullValidation = true) {
    const errors = [];

    // Validaciones obligatorias
    if (isFullValidation) {
      // Debe tener client_id O client_phone
      if (!bookingData.client_id && !bookingData.client_phone) {
        errors.push("client_id o client_phone es requerido");
      }

      if (!bookingData.service_id) {
        errors.push("service_id es requerido");
      }

      if (!bookingData.start_time) {
        errors.push("start_time es requerido");
      }
    }

    // Validar start_time si está presente
    if (bookingData.start_time) {
      const startTime = new Date(bookingData.start_time);
      if (isNaN(startTime.getTime())) {
        errors.push("start_time debe ser una fecha válida");
      }
    }

    // Validar end_time si está presente
    if (bookingData.end_time) {
      const endTime = new Date(bookingData.end_time);
      if (isNaN(endTime.getTime())) {
        errors.push("end_time debe ser una fecha válida");
      }

      // Validar que end_time sea después de start_time
      if (bookingData.start_time) {
        const startTime = new Date(bookingData.start_time);
        if (endTime <= startTime) {
          errors.push("end_time debe ser posterior a start_time");
        }
      }
    }

    // Validar precios
    if (bookingData.original_price !== undefined) {
      if (isNaN(bookingData.original_price) || bookingData.original_price < 0) {
        errors.push("original_price debe ser un número positivo");
      }
    }

    if (bookingData.final_price !== undefined) {
      if (isNaN(bookingData.final_price) || bookingData.final_price < 0) {
        errors.push("final_price debe ser un número positivo");
      }
    }

    // Validar estado
    if (bookingData.status) {
      const validStatuses = [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ];
      if (!validStatuses.includes(bookingData.status)) {
        errors.push("status inválido");
      }
    }

    // Validar timezone
    if (bookingData.timezone && typeof bookingData.timezone !== "string") {
      errors.push("timezone debe ser una cadena válida");
    }

    // Validar email del cliente si se proporciona
    if (
      bookingData.client_email &&
      !this.isValidEmail(bookingData.client_email)
    ) {
      errors.push("client_email inválido");
    }

    // Validar teléfono del cliente si se proporciona
    if (
      bookingData.client_phone &&
      !this.isValidPhone(bookingData.client_phone)
    ) {
      errors.push("client_phone inválido");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Sanitizar datos de reserva
  static sanitizeBookingData(bookingData) {
    const sanitized = {};

    // IDs y referencias
    if (bookingData.client_id) {
      sanitized.client_id = bookingData.client_id;
    }

    if (bookingData.service_id) {
      sanitized.service_id = bookingData.service_id;
    }

    if (bookingData.staff_id) {
      sanitized.staff_id = bookingData.staff_id;
    }

    // Fechas y horarios
    if (bookingData.start_time) {
      sanitized.start_time = new Date(bookingData.start_time).toISOString();
    }

    if (bookingData.end_time) {
      sanitized.end_time = new Date(bookingData.end_time).toISOString();
    }

    if (bookingData.timezone) {
      sanitized.timezone = this.sanitizeText(bookingData.timezone);
    }

    // Información del cliente (para creación automática)
    if (bookingData.client_phone) {
      sanitized.client_phone = bookingData.client_phone
        .replace(/\s+/g, "")
        .replace(/^\+/, "");
    }

    if (bookingData.client_email) {
      sanitized.client_email = bookingData.client_email.toLowerCase().trim();
    }

    if (bookingData.client_name) {
      sanitized.client_name = this.sanitizeText(bookingData.client_name);
    }

    if (bookingData.client_last_name) {
      sanitized.client_last_name = this.sanitizeText(
        bookingData.client_last_name
      );
    }

    // Textos
    if (bookingData.notes) {
      sanitized.notes = this.sanitizeText(bookingData.notes);
    }

    if (bookingData.client_notes) {
      sanitized.client_notes = this.sanitizeText(bookingData.client_notes);
    }

    if (bookingData.staff_notes) {
      sanitized.staff_notes = this.sanitizeText(bookingData.staff_notes);
    }

    if (bookingData.cancellation_reason) {
      sanitized.cancellation_reason = this.sanitizeText(
        bookingData.cancellation_reason
      );
    }

    // Precios
    if (bookingData.original_price !== undefined) {
      sanitized.original_price = parseFloat(bookingData.original_price);
    }

    if (bookingData.final_price !== undefined) {
      sanitized.final_price = parseFloat(bookingData.final_price);
    }

    // Campos directos
    const directCopyFields = [
      "status",
      "confirmation_code",
      "currency",
      "external_id",
      "external_platform",
      "metadata",
      "reminder_sent",
      "confirmation_sent",
    ];

    directCopyFields.forEach((field) => {
      if (bookingData[field] !== undefined) {
        sanitized[field] = bookingData[field];
      }
    });

    return sanitized;
  }

  // Validar datos de servicio
  static validateServiceData(serviceData, isFullValidation = true) {
    const errors = [];

    // Validaciones obligatorias para creación
    if (isFullValidation) {
      if (!serviceData.name || serviceData.name.trim().length < 2) {
        errors.push("El nombre del servicio debe tener al menos 2 caracteres");
      }

      if (!serviceData.category) {
        errors.push("La categoría es requerida");
      }

      if (!serviceData.duration_minutes || serviceData.duration_minutes < 1) {
        errors.push("La duración debe ser mayor a 0 minutos");
      }

      if (serviceData.price === undefined || serviceData.price < 0) {
        errors.push("El precio debe ser mayor o igual a 0");
      }
    }

    // Validaciones opcionales pero si están presentes deben ser válidas
    if (serviceData.name && serviceData.name.trim().length < 2) {
      errors.push("El nombre del servicio debe tener al menos 2 caracteres");
    }

    if (serviceData.slug && serviceData.slug.trim().length < 2) {
      errors.push("El slug debe tener al menos 2 caracteres");
    }

    if (
      serviceData.short_description &&
      serviceData.short_description.length > 500
    ) {
      errors.push("La descripción corta no puede exceder 500 caracteres");
    }

    if (
      serviceData.duration_minutes &&
      (isNaN(serviceData.duration_minutes) || serviceData.duration_minutes < 1)
    ) {
      errors.push("La duración debe ser un número mayor a 0");
    }

    if (
      serviceData.price !== undefined &&
      (isNaN(serviceData.price) || serviceData.price < 0)
    ) {
      errors.push("El precio debe ser un número mayor o igual a 0");
    }

    if (
      serviceData.max_advance_booking_days &&
      (isNaN(serviceData.max_advance_booking_days) ||
        serviceData.max_advance_booking_days < 1)
    ) {
      errors.push("Los días máximos de anticipación deben ser mayor a 0");
    }

    if (
      serviceData.min_advance_booking_hours &&
      (isNaN(serviceData.min_advance_booking_hours) ||
        serviceData.min_advance_booking_hours < 0)
    ) {
      errors.push(
        "Las horas mínimas de anticipación deben ser mayor o igual a 0"
      );
    }

    if (
      serviceData.max_cancellation_hours &&
      (isNaN(serviceData.max_cancellation_hours) ||
        serviceData.max_cancellation_hours < 0)
    ) {
      errors.push(
        "Las horas máximas de cancelación deben ser mayor o igual a 0"
      );
    }

    // Validar categorías válidas (esto debería coincidir con el enum de la BD)
    if (serviceData.category) {
      const validCategories = [
        "consultation",
        "therapy",
        "assessment",
        "workshop",
        "other",
      ];
      if (!validCategories.includes(serviceData.category)) {
        errors.push("Categoría inválida");
      }
    }

    // Validar moneda
    if (serviceData.currency && serviceData.currency.length !== 3) {
      errors.push("La moneda debe ser un código de 3 letras (ej: EUR, USD)");
    }

    // Validar booleanos
    if (
      typeof serviceData.active !== "undefined" &&
      typeof serviceData.active !== "boolean"
    ) {
      errors.push("El campo 'active' debe ser boolean");
    }

    if (
      typeof serviceData.online_booking_enabled !== "undefined" &&
      typeof serviceData.online_booking_enabled !== "boolean"
    ) {
      errors.push("El campo 'online_booking_enabled' debe ser boolean");
    }

    if (
      typeof serviceData.requires_approval !== "undefined" &&
      typeof serviceData.requires_approval !== "boolean"
    ) {
      errors.push("El campo 'requires_approval' debe ser boolean");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Sanitizar datos de servicio
  static sanitizeServiceData(serviceData) {
    const sanitized = {};

    // Sanitizar strings
    if (serviceData.name) {
      sanitized.name = this.sanitizeText(serviceData.name);
    }

    if (serviceData.slug) {
      sanitized.slug = serviceData.slug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]/g, "");
    }

    if (serviceData.description) {
      sanitized.description = this.sanitizeText(serviceData.description);
    }

    if (serviceData.short_description) {
      sanitized.short_description = this.sanitizeText(
        serviceData.short_description
      );
    }

    if (serviceData.category) {
      sanitized.category = serviceData.category.toLowerCase().trim();
    }

    if (serviceData.currency) {
      sanitized.currency = serviceData.currency.toUpperCase().trim();
    }

    // Sanitizar números
    if (serviceData.duration_minutes !== undefined) {
      sanitized.duration_minutes = parseInt(serviceData.duration_minutes);
    }

    if (serviceData.price !== undefined) {
      sanitized.price = parseFloat(serviceData.price);
    }

    if (serviceData.max_advance_booking_days !== undefined) {
      sanitized.max_advance_booking_days = parseInt(
        serviceData.max_advance_booking_days
      );
    }

    if (serviceData.min_advance_booking_hours !== undefined) {
      sanitized.min_advance_booking_hours = parseInt(
        serviceData.min_advance_booking_hours
      );
    }

    if (serviceData.max_cancellation_hours !== undefined) {
      sanitized.max_cancellation_hours = parseInt(
        serviceData.max_cancellation_hours
      );
    }

    // Campos que no necesitan sanitización pero se copian si están presentes
    const directCopyFields = [
      "active",
      "online_booking_enabled",
      "requires_approval",
      "assigned_staff",
      "metadata",
    ];

    directCopyFields.forEach((field) => {
      if (serviceData[field] !== undefined) {
        sanitized[field] = serviceData[field];
      }
    });

    return sanitized;
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
