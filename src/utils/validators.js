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
      if (!clientData.full_name || clientData.full_name.trim().length < 2) {
        errors.push("El nombre completo debe tener al menos 2 caracteres");
      }

      if (!clientData.phone || !this.isValidPhone(clientData.phone)) {
        errors.push("Teléfono inválido o requerido");
      }
    }

    // Validaciones opcionales pero si están presentes deben ser válidas
    if (clientData.full_name && clientData.full_name.trim().length < 2) {
      errors.push("El nombre completo debe tener al menos 2 caracteres");
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

  // Validar datos de cita (estructura real)
  static validateAppointmentData(appointmentData, isFullValidation = true) {
    const errors = [];

    // Validaciones obligatorias
    if (isFullValidation) {
      // Debe tener client_id O client_phone
      if (!appointmentData.client_id && !appointmentData.client_phone) {
        errors.push("client_id o client_phone es requerido");
      }

      if (!appointmentData.service_id) {
        errors.push("service_id es requerido");
      }

      if (!appointmentData.start_time) {
        errors.push("start_time es requerido");
      }
    }

    // Validar start_time si está presente
    if (appointmentData.start_time) {
      const startTime = new Date(appointmentData.start_time);
      if (isNaN(startTime.getTime())) {
        errors.push("start_time debe ser una fecha válida");
      }
    }

    // Validar end_time si está presente
    if (appointmentData.end_time) {
      const endTime = new Date(appointmentData.end_time);
      if (isNaN(endTime.getTime())) {
        errors.push("end_time debe ser una fecha válida");
      }

      // Validar que end_time sea después de start_time
      if (appointmentData.start_time) {
        const startTime = new Date(appointmentData.start_time);
        if (endTime <= startTime) {
          errors.push("end_time debe ser posterior a start_time");
        }
      }
    }

    // Validar precios
    if (appointmentData.original_price !== undefined) {
      if (isNaN(appointmentData.original_price) || appointmentData.original_price < 0) {
        errors.push("original_price debe ser un número positivo");
      }
    }

    if (appointmentData.final_price !== undefined) {
      if (isNaN(appointmentData.final_price) || appointmentData.final_price < 0) {
        errors.push("final_price debe ser un número positivo");
      }
    }

    // Validar estado
    if (appointmentData.status) {
      const validStatuses = [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ];
      if (!validStatuses.includes(appointmentData.status)) {
        errors.push("status inválido");
      }
    }

    // Validar timezone
    if (appointmentData.timezone && typeof appointmentData.timezone !== "string") {
      errors.push("timezone debe ser una cadena válida");
    }

    // Validar email del cliente si se proporciona
    if (
      appointmentData.client_email &&
      !this.isValidEmail(appointmentData.client_email)
    ) {
      errors.push("client_email inválido");
    }

    // Validar teléfono del cliente si se proporciona
    if (
      appointmentData.client_phone &&
      !this.isValidPhone(appointmentData.client_phone)
    ) {
      errors.push("client_phone inválido");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Sanitizar datos de cita
  static sanitizeAppointmentData(appointmentData) {
    const sanitized = {};

    // IDs y referencias
    if (appointmentData.client_id) {
      sanitized.client_id = appointmentData.client_id;
    }

    if (appointmentData.service_id) {
      sanitized.service_id = appointmentData.service_id;
    }

    if (appointmentData.staff_id) {
      sanitized.staff_id = appointmentData.staff_id;
    }

    // Fechas y horarios
    if (appointmentData.start_time) {
      sanitized.start_time = new Date(appointmentData.start_time).toISOString();
    }

    if (appointmentData.end_time) {
      sanitized.end_time = new Date(appointmentData.end_time).toISOString();
    }

    if (appointmentData.timezone) {
      sanitized.timezone = this.sanitizeText(appointmentData.timezone);
    }

    // Información del cliente (para creación automática)
    if (appointmentData.client_phone) {
      sanitized.client_phone = appointmentData.client_phone
        .replace(/\s+/g, "")
        .replace(/^\+/, "");
    }

    if (appointmentData.client_email) {
      sanitized.client_email = appointmentData.client_email.toLowerCase().trim();
    }

    if (appointmentData.client_name) {
      sanitized.client_name = this.sanitizeText(appointmentData.client_name);
    }

    if (appointmentData.client_last_name) {
      sanitized.client_last_name = this.sanitizeText(
        appointmentData.client_last_name
      );
    }

    // Textos
    if (appointmentData.notes) {
      sanitized.notes = this.sanitizeText(appointmentData.notes);
    }

    if (appointmentData.client_notes) {
      sanitized.client_notes = this.sanitizeText(appointmentData.client_notes);
    }

    if (appointmentData.staff_notes) {
      sanitized.staff_notes = this.sanitizeText(appointmentData.staff_notes);
    }

    if (appointmentData.cancellation_reason) {
      sanitized.cancellation_reason = this.sanitizeText(
        appointmentData.cancellation_reason
      );
    }

    // Precios
    if (appointmentData.original_price !== undefined) {
      sanitized.original_price = parseFloat(appointmentData.original_price);
    }

    if (appointmentData.final_price !== undefined) {
      sanitized.final_price = parseFloat(appointmentData.final_price);
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
      if (appointmentData[field] !== undefined) {
        sanitized[field] = appointmentData[field];
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
      serviceData.max_advance_appointment_days &&
      (isNaN(serviceData.max_advance_appointment_days) ||
        serviceData.max_advance_appointment_days < 1)
    ) {
      errors.push("Los días máximos de anticipación deben ser mayor a 0");
    }

    if (
      serviceData.min_advance_appointment_hours &&
      (isNaN(serviceData.min_advance_appointment_hours) ||
        serviceData.min_advance_appointment_hours < 0)
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
      typeof serviceData.online_appointment_enabled !== "undefined" &&
      typeof serviceData.online_appointment_enabled !== "boolean"
    ) {
      errors.push("El campo 'online_appointment_enabled' debe ser boolean");
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

    if (serviceData.max_advance_appointment_days !== undefined) {
      sanitized.max_advance_appointment_days = parseInt(
        serviceData.max_advance_appointment_days
      );
    }

    if (serviceData.min_advance_appointment_hours !== undefined) {
      sanitized.min_advance_appointment_hours = parseInt(
        serviceData.min_advance_appointment_hours
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
      "online_appointment_enabled",
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
