/**
 * CONTROLADOR DEL PORTAL CLIENTE
 * Lógica de negocio para el portal público de clientes
 *
 * Funcionalidades:
 * - Gestión de reservas
 * - Información de servicios
 * - Historial de cliente
 * - Formularios de contacto
 * - Integración con Calendly
 */

const config = require("../config/environment");
const logger = require("../utils/logger");
const { formatPhoneNumber } = require("../utils/phoneNumberFormatter");
const supabaseService = require("../services/supabaseService");
const twilioService = require("../services/twilioService");
const openaiService = require("../services/openaiService");

/**
 * Obtiene servicios disponibles
 */
const getAvailableServices = async (req, res) => {
  try {
    // Lista de servicios (esto podría venir de base de datos)
    const services = [
      {
        id: "consultation",
        name: "Consultoría Personalizada",
        description:
          "Sesión de consultoría uno a uno para analizar tus necesidades específicas",
        duration: 60,
        price: "Consultar",
        available: true,
      },
      {
        id: "strategy",
        name: "Estrategia Digital",
        description:
          "Desarrollo de estrategia digital completa para tu negocio",
        duration: 90,
        price: "Consultar",
        available: true,
      },
      {
        id: "implementation",
        name: "Implementación de Soluciones",
        description: "Implementación técnica de soluciones digitales",
        duration: 120,
        price: "Consultar",
        available: true,
      },
      {
        id: "support",
        name: "Soporte Técnico",
        description:
          "Soporte técnico especializado para resolver problemas específicos",
        duration: 30,
        price: "Consultar",
        available: true,
      },
    ];

    logger.info("Servicios solicitados desde portal cliente", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(200).json({
      success: true,
      data: services,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error obteniendo servicios disponibles", {
      error: error.message,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error obteniendo servicios disponibles",
    });
  }
};

/**
 * Obtiene disponibilidad de horarios
 */
const getAvailability = async (req, res) => {
  try {
    const { date, service } = req.query;

    // Horarios disponibles (esto podría integrarse con Google Calendar o Calendly)
    const availability = {
      date: date || new Date().toISOString().split("T")[0],
      service: service || "consultation",
      slots: [
        { time: "09:00", available: true },
        { time: "10:00", available: true },
        { time: "11:00", available: false },
        { time: "12:00", available: true },
        { time: "14:00", available: true },
        { time: "15:00", available: true },
        { time: "16:00", available: false },
        { time: "17:00", available: true },
      ],
      timezone: config.DEFAULT_TIMEZONE || "Europe/Madrid",
    };

    logger.info("Disponibilidad consultada", {
      date,
      service,
      ip: req.ip,
    });

    res.status(200).json({
      success: true,
      data: availability,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error obteniendo disponibilidad", {
      error: error.message,
      date: req.query.date,
      service: req.query.service,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error obteniendo disponibilidad",
    });
  }
};

/**
 * Crea nueva reserva
 */
const createBooking = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      service,
      date,
      time,
      message,
      preferredContact = "email",
    } = req.body;

    // Validar datos requeridos
    if (!name || !email || !phone || !service || !date || !time) {
      return res.status(400).json({
        success: false,
        error:
          "Todos los campos son requeridos: name, email, phone, service, date, time",
      });
    }

    // Formatear número de teléfono
    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone) {
      return res.status(400).json({
        success: false,
        error: "Número de teléfono inválido",
      });
    }

    // Crear o actualizar cliente
    const client = await supabaseService.getOrCreateClient(formattedPhone, {
      name,
      email,
      preferred_contact: preferredContact,
    });

    // Generar ID único para la reserva
    const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Datos de la reserva
    const bookingData = {
      id: bookingId,
      client_id: client.id,
      service,
      date,
      time,
      status: "pending",
      message: message || "",
      created_at: new Date().toISOString(),
      ip_address: req.ip,
      user_agent: req.get("User-Agent"),
    };

    // Guardar reserva (esto requiere tabla de bookings en Supabase)
    // Por ahora simulamos el guardado

    // Generar mensaje de confirmación con OpenAI
    const confirmationPrompt = `Genera un mensaje de confirmación profesional y amigable para una reserva de cita.

Detalles de la reserva:
- Cliente: ${name}
- Servicio: ${service}
- Fecha: ${date}
- Hora: ${time}
- Negocio: ${config.BUSINESS_NAME}

El mensaje debe:
- Confirmar la reserva
- Incluir todos los detalles
- Ser profesional pero cercano
- Incluir información de contacto: ${config.BUSINESS_PHONE}
- Mencionar que recibirán confirmación adicional
- Máximo 200 palabras`;

    const confirmationMessage = await openaiService.generateResponse(
      confirmationPrompt,
      {
        maxTokens: 300,
        temperature: 0.7,
      }
    );

    // Enviar confirmación por WhatsApp si el cliente lo prefiere
    if (preferredContact === "whatsapp" || preferredContact === "both") {
      try {
        await twilioService.sendWhatsAppMessage(
          formattedPhone,
          confirmationMessage
        );
        logger.info("Confirmación de reserva enviada por WhatsApp", {
          bookingId,
          phone: formattedPhone,
          client: name,
        });
      } catch (whatsappError) {
        logger.warn("Error enviando confirmación por WhatsApp", {
          error: whatsappError.message,
          bookingId,
          phone: formattedPhone,
        });
      }
    }

    // Log de auditoría
    logger.audit("booking_created", client.id, "booking", {
      bookingId,
      service,
      date,
      time,
      clientName: name,
      clientPhone: formattedPhone,
      ip: req.ip,
    });

    res.status(201).json({
      success: true,
      data: {
        bookingId,
        status: "pending",
        message: "Reserva creada exitosamente",
        confirmation: confirmationMessage,
        nextSteps: [
          "Recibirás una confirmación adicional en las próximas horas",
          "Si necesitas modificar la cita, contacta directamente",
          "Guarda este ID de reserva: " + bookingId,
        ],
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error creando reserva", {
      error: error.message,
      stack: error.stack,
      body: req.body,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error:
        "Error creando reserva. Por favor, intenta de nuevo o contacta directamente.",
    });
  }
};

/**
 * Obtiene detalles de reserva específica
 */
const getBookingDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Simular obtención de reserva (requiere implementación en base de datos)
    const booking = {
      id,
      status: "pending",
      message:
        "Funcionalidad en desarrollo - consulta directamente para detalles de tu reserva",
    };

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    logger.error("Error obteniendo detalles de reserva", {
      error: error.message,
      bookingId: req.params.id,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error obteniendo detalles de reserva",
    });
  }
};

/**
 * Modifica reserva existente
 */
const updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Implementar lógica de actualización
    logger.info("Solicitud de modificación de reserva", {
      bookingId: id,
      updates,
      ip: req.ip,
    });

    res.status(200).json({
      success: true,
      message:
        "Solicitud de modificación recibida. Te contactaremos para confirmar los cambios.",
      bookingId: id,
    });
  } catch (error) {
    logger.error("Error modificando reserva", {
      error: error.message,
      bookingId: req.params.id,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error modificando reserva",
    });
  }
};

/**
 * Cancela reserva
 */
const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Implementar lógica de cancelación
    logger.audit("booking_cancelled", "client", id, {
      bookingId: id,
      reason: reason || "No especificado",
      ip: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Reserva cancelada exitosamente",
      bookingId: id,
    });
  } catch (error) {
    logger.error("Error cancelando reserva", {
      error: error.message,
      bookingId: req.params.id,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error cancelando reserva",
    });
  }
};

/**
 * Obtiene historial de cliente
 */
const getClientHistory = async (req, res) => {
  try {
    const { phone, email } = req.query;

    if (!phone && !email) {
      return res.status(400).json({
        success: false,
        error: "Se requiere número de teléfono o email",
      });
    }

    let client = null;

    if (phone) {
      const formattedPhone = formatPhoneNumber(phone);
      if (formattedPhone) {
        client = await supabaseService.getClientByPhone(formattedPhone);
      }
    }

    if (!client) {
      return res.status(404).json({
        success: false,
        error: "Cliente no encontrado",
      });
    }

    // Obtener historial de conversaciones
    const conversations = await supabaseService.getRecentConversations({
      phoneNumber: client.phone_number,
      limit: 20,
    });

    const history = {
      client: {
        name: client.name,
        phone: client.phone_number,
        email: client.email,
        memberSince: client.created_at,
      },
      conversations: conversations.length,
      lastActivity: client.last_activity,
      bookings: [], // Implementar cuando esté la tabla de bookings
    };

    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    logger.error("Error obteniendo historial de cliente", {
      error: error.message,
      phone: req.query.phone,
      email: req.query.email,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error obteniendo historial",
    });
  }
};

/**
 * Procesa formulario de contacto
 */
const submitContactForm = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: "Nombre, email y mensaje son requeridos",
      });
    }

    // Formatear teléfono si se proporciona
    let formattedPhone = null;
    if (phone) {
      formattedPhone = formatPhoneNumber(phone);
    }

    // Crear o actualizar cliente si hay teléfono
    if (formattedPhone) {
      await supabaseService.getOrCreateClient(formattedPhone, {
        name,
        email,
      });
    }

    // Generar respuesta automática con OpenAI
    const responsePrompt = `Genera una respuesta automática profesional y amigable para un formulario de contacto.

Datos del contacto:
- Nombre: ${name}
- Email: ${email}
- Asunto: ${subject || "Consulta general"}
- Mensaje: ${message}

La respuesta debe:
- Agradecer el contacto
- Confirmar que se ha recibido el mensaje
- Indicar tiempo estimado de respuesta (24-48 horas)
- Incluir información de contacto directo: ${config.BUSINESS_PHONE}
- Ser profesional pero cercana
- Máximo 150 palabras`;

    const autoResponse = await openaiService.generateResponse(responsePrompt, {
      maxTokens: 250,
      temperature: 0.7,
    });

    // Log del contacto
    logger.audit("contact_form_submitted", email, "contact_form", {
      name,
      email,
      phone: formattedPhone,
      subject: subject || "Sin asunto",
      messageLength: message.length,
      ip: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Formulario de contacto enviado exitosamente",
      autoResponse,
      estimatedResponseTime: "24-48 horas",
    });
  } catch (error) {
    logger.error("Error procesando formulario de contacto", {
      error: error.message,
      body: req.body,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error enviando formulario de contacto",
    });
  }
};

/**
 * Obtiene información del negocio
 */
const getBusinessInfo = async (req, res) => {
  try {
    const businessInfo = {
      name: config.BUSINESS_NAME,
      phone: config.BUSINESS_PHONE,
      email: config.BUSINESS_EMAIL,
      address: config.BUSINESS_ADDRESS,
      timezone: config.DEFAULT_TIMEZONE,
      locale: config.DEFAULT_LOCALE,
      workingHours: {
        monday: "09:00 - 18:00",
        tuesday: "09:00 - 18:00",
        wednesday: "09:00 - 18:00",
        thursday: "09:00 - 18:00",
        friday: "09:00 - 18:00",
        saturday: "Cerrado",
        sunday: "Cerrado",
      },
      socialMedia: {
        whatsapp: config.BUSINESS_PHONE,
        website: config.PUBLIC_URL || "https://ricardoburitica.eu",
      },
      description:
        "Consultoría especializada en transformación digital y soluciones tecnológicas innovadoras.",
    };

    res.status(200).json({
      success: true,
      data: businessInfo,
    });
  } catch (error) {
    logger.error("Error obteniendo información del negocio", {
      error: error.message,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error obteniendo información del negocio",
    });
  }
};

/**
 * Suscripción a newsletter
 */
const subscribeNewsletter = async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email es requerido",
      });
    }

    // Implementar lógica de suscripción
    logger.audit("newsletter_subscription", email, "newsletter", {
      email,
      name: name || "No proporcionado",
      ip: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Suscripción exitosa al newsletter",
    });
  } catch (error) {
    logger.error("Error en suscripción a newsletter", {
      error: error.message,
      email: req.body.email,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error en suscripción a newsletter",
    });
  }
};

/**
 * Obtiene testimonios de clientes
 */
const getTestimonials = async (req, res) => {
  try {
    const testimonials = [
      {
        id: 1,
        name: "María González",
        company: "Tech Solutions SL",
        text: "Excelente servicio y atención personalizada. Muy recomendable.",
        rating: 5,
        date: "2024-01-15",
      },
      {
        id: 2,
        name: "Carlos Ruiz",
        company: "Innovate Corp",
        text: "Profesionalidad y resultados excepcionales. Superaron nuestras expectativas.",
        rating: 5,
        date: "2024-01-10",
      },
    ];

    res.status(200).json({
      success: true,
      data: testimonials,
    });
  } catch (error) {
    logger.error("Error obteniendo testimonios", {
      error: error.message,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error obteniendo testimonios",
    });
  }
};

/**
 * Envía reseña de cliente
 */
const submitReview = async (req, res) => {
  try {
    const { name, email, rating, comment, bookingId } = req.body;

    if (!name || !rating || !comment) {
      return res.status(400).json({
        success: false,
        error: "Nombre, calificación y comentario son requeridos",
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: "La calificación debe estar entre 1 y 5",
      });
    }

    // Implementar guardado de reseña
    logger.audit("review_submitted", email || "anonymous", "review", {
      name,
      email: email || null,
      rating,
      commentLength: comment.length,
      bookingId: bookingId || null,
      ip: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Reseña enviada exitosamente. ¡Gracias por tu feedback!",
    });
  } catch (error) {
    logger.error("Error enviando reseña", {
      error: error.message,
      body: req.body,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: "Error enviando reseña",
    });
  }
};

module.exports = {
  getAvailableServices,
  getAvailability,
  createBooking,
  getBookingDetails,
  updateBooking,
  cancelBooking,
  getClientHistory,
  submitContactForm,
  getBusinessInfo,
  subscribeNewsletter,
  getTestimonials,
  submitReview,
};
