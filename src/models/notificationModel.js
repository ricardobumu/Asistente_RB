// src/models/notificationModel.js
const supabase = require("../integrations/supabaseClient");
const logger = require("../utils/logger");
const Validators = require("../utils/validators");

/**
 * NotificationModel - Sistema de notificaciones para Ricardo Buriticá Beauty Consulting
 *
 * Especializado en Peluquería Consciente:
 * - Mensajes personalizados con filosofía consciente
 * - Recordatorios específicos para servicios de peluquería
 * - Instrucciones de preparación y cuidado posterior
 * - Comunicación educativa sobre cuidado capilar
 * - Integración con Calendly para reservas automáticas
 * - Seguimiento post-servicio consciente
 * - Promoción de servicios basada en necesidades reales
 */
class NotificationModel {
  constructor() {
    this.tableName = "notifications";
    this.templatesTableName = "notification_templates";
    this.metricsTableName = "notification_metrics";

    // Tipos de notificación específicos para Ricardo Buriticá
    this.validTypes = [
      "booking_confirmation", // Confirmación de cita
      "booking_reminder_24h", // Recordatorio 24h antes
      "booking_reminder_2h", // Recordatorio 2h antes
      "preparation_instructions", // Instrucciones de preparación
      "booking_cancellation", // Cancelación de cita
      "booking_rescheduled", // Reprogramación de cita
      "aftercare_instructions", // Cuidados posteriores
      "conscious_education", // Educación sobre peluquería consciente
      "service_feedback", // Solicitud de feedback
      "maintenance_reminder", // Recordatorio de mantenimiento
      "seasonal_care_tips", // Tips de cuidado estacional
      "new_service_announcement", // Anuncio de nuevos servicios
      "conscious_philosophy_share", // Compartir filosofía consciente
      "birthday_greeting", // Saludo de cumpleaños personalizado
      "loyalty_appreciation", // Agradecimiento por fidelidad
    ];

    // Canales de comunicación preferidos para peluquería
    this.validChannels = [
      "whatsapp", // Principal para Ricardo
      "email", // Confirmaciones y educación
      "sms", // Recordatorios urgentes
      "calendly_notification", // Notificaciones de Calendly
    ];

    // Estados específicos para el flujo de Ricardo
    this.validStatuses = [
      "pending", // Pendiente de envío
      "scheduled", // Programada
      "sent", // Enviada
      "delivered", // Entregada
      "read", // Leída
      "failed", // Falló el envío
      "cancelled", // Cancelada
    ];

    // Prioridades para peluquería consciente
    this.validPriorities = [
      "critical", // Cancelaciones de último momento
      "high", // Recordatorios de cita
      "normal", // Confirmaciones, educación
      "low", // Tips, filosofía
    ];

    // Plantillas de mensajes conscientes
    this.consciousTemplates = {
      booking_confirmation: {
        whatsapp: `¡Hola {client_name}! 🌟 Tu cita para {service_name} está confirmada para el {booking_date} a las {booking_time}.

✨ *Peluquería Consciente* significa que trabajaremos respetando la biología natural de tu cabello.

📝 *Preparación*: {preparation_instructions}

📍 *Ubicación*: Ricardo Buriticá Beauty Consulting
🕐 *Duración estimada*: {duration} minutos
💰 *Inversión*: {price}€

¡Nos vemos pronto para cuidar tu cabello de forma consciente! 💚`,

        email: `Estimado/a {client_name},

Tu cita para {service_name} ha sido confirmada exitosamente.

DETALLES DE LA CITA:
📅 Fecha: {booking_date}
🕐 Hora: {booking_time}
⏱️ Duración: {duration} minutos
💰 Inversión: {price}€

PREPARACIÓN CONSCIENTE:
{preparation_instructions}

FILOSOFÍA DE PELUQUERÍA CONSCIENTE:
Este servicio está diseñado para respetar la biología natural de tu cabello y cuero cabelludo. Trabajaremos juntos para que entiendas las necesidades reales de tu cabello, alejándonos del marketing deshonesto y enfocándonos en el cuidado consciente.

El conocimiento te dará la libertad de elección para el cuidado de tu cabello.

¡Esperamos verte pronto!

Ricardo Buriticá Beauty Consulting
Peluquería Consciente`,
      },

      booking_reminder_24h: {
        whatsapp: `¡Hola {client_name}! 😊 

Te recordamos tu cita de *{service_name}* programada para mañana {booking_date} a las {booking_time}.

🧠 *Recordatorio Consciente*:
{preparation_instructions}

💡 *¿Sabías que...?* {conscious_tip}

Nos vemos mañana para cuidar tu cabello de forma consciente 💚

Ricardo Buriticá Beauty Consulting`,

        sms: `Hola {client_name}! Recordatorio: {service_name} mañana {booking_date} a las {booking_time}. {preparation_instructions}. Ricardo Buriticá Beauty Consulting`,
      },

      booking_reminder_2h: {
        whatsapp: `¡Hola {client_name}! ⏰

Tu cita de *{service_name}* es en 2 horas ({booking_time}).

🚗 *Recuerda*: Llegar puntual nos permite dedicar el tiempo completo a tu cabello
📱 Si necesitas reprogramar, avísame cuanto antes

¡Nos vemos pronto! 💚`,

        sms: `{client_name}, tu cita de {service_name} es en 2 horas ({booking_time}). Nos vemos pronto! - Ricardo`,
      },

      aftercare_instructions: {
        whatsapp: `¡Hola {client_name}! ✨

Espero que estés disfrutando de tu nuevo look después de {service_name}.

🌿 *Cuidados Conscientes Post-Servicio*:
{aftercare_instructions}

💡 *Recuerda*: Estos cuidados están diseñados específicamente para mantener la salud de tu cabello respetando su biología natural.

Si tienes dudas sobre el cuidado consciente, no dudes en escribirme 💚

Ricardo Buriticá Beauty Consulting`,

        email: `Estimado/a {client_name},

Esperamos que estés disfrutando de los resultados de tu {service_name}.

CUIDADOS CONSCIENTES POST-SERVICIO:
{aftercare_instructions}

FILOSOFÍA DEL CUIDADO CONSCIENTE:
Los productos y técnicas que te recomendamos están basados en el respeto por la biología de tu cabello. Evitamos el marketing deshonesto y nos enfocamos en lo que realmente necesita tu cabello.

PRÓXIMA CITA RECOMENDADA:
Basándome en tu tipo de cabello y el servicio realizado, te recomiendo programar tu próxima cita en {recommended_next_visit} semanas.

¡Gracias por confiar en la Peluquería Consciente!

Ricardo Buriticá Beauty Consulting`,
      },

      conscious_education: {
        whatsapp: `¡Hola {client_name}! 🧠💚

*Tip de Peluquería Consciente*:

{educational_content}

💡 *¿Por qué es importante?*
{why_important}

🚫 *Evita*: {what_to_avoid}
✅ *Prefiere*: {what_to_prefer}

El conocimiento te da la libertad de elección para el cuidado de tu cabello 🌟

Ricardo Buriticá Beauty Consulting`,

        email: `Estimado/a {client_name},

EDUCACIÓN EN PELUQUERÍA CONSCIENTE

{educational_content}

FUNDAMENTO CIENTÍFICO:
{scientific_basis}

APLICACIÓN PRÁCTICA:
{practical_application}

PRODUCTOS RECOMENDADOS:
{recommended_products}

Recuerda: La Peluquería Consciente se basa en el conocimiento de las condiciones biológicas del cabello y cuero cabelludo. Esto te permite tomar decisiones informadas y evitar caer en el marketing deshonesto.

¡Sigue aprendiendo sobre el cuidado consciente de tu cabello!

Ricardo Buriticá Beauty Consulting`,
      },

      maintenance_reminder: {
        whatsapp: `¡Hola {client_name}! 🌟

Han pasado {weeks_since_service} semanas desde tu {last_service}.

🔄 *Recordatorio de Mantenimiento Consciente*:
Basándome en tu tipo de cabello y el servicio anterior, es momento de considerar:

{maintenance_recommendations}

📅 *¿Programamos tu próxima cita?*
Puedes reservar directamente en: {calendly_link}

💚 Cuidar tu cabello de forma consciente es una inversión a largo plazo

Ricardo Buriticá Beauty Consulting`,
      },

      new_service_announcement: {
        whatsapp: `¡Hola {client_name}! ✨

*Novedad en Peluquería Consciente*

🆕 {new_service_name}
💰 {new_service_price}€
⏱️ {new_service_duration} minutos

🌿 *¿Por qué es consciente?*
{conscious_benefits}

👤 *Ideal para ti si*:
{ideal_for}

📅 Reserva tu cita: {calendly_link}

¡Sigamos cuidando tu cabello de forma consciente! 💚

Ricardo Buriticá Beauty Consulting`,
      },
    };

    // Tips de peluquería consciente por categoría
    this.consciousTips = {
      tratamientos_capilares: [
        "La hidratación real viene de dentro: bebe agua y usa productos que respeten el pH natural",
        "Los tratamientos químicos agresivos pueden dar resultados inmediatos pero dañan a largo plazo",
        "Tu cabello tiene memoria: los cuidados conscientes se acumulan positivamente con el tiempo",
      ],
      cortes: [
        "Un buen corte respeta la dirección natural de crecimiento de tu cabello",
        "El corte consciente potencia tu belleza natural sin forzar formas antinaturales",
        "La frecuencia de corte depende de tu cabello, no de modas o marketing",
      ],
      coloracion: [
        "La coloración consciente respeta los tiempos de descanso del cuero cabelludo",
        "Los colores que mejor te quedan son los que armonizan con tu tono natural de piel",
        "La decoloración progresiva es más saludable que los cambios drásticos",
      ],
    };

    logger.info(
      "NotificationModel inicializado para Ricardo Buriticá Beauty Consulting",
      {
        validTypes: this.validTypes.length,
        validChannels: this.validChannels.length,
        consciousTemplates: Object.keys(this.consciousTemplates).length,
      }
    );
  }

  /**
   * Crear notificación con personalización consciente
   */
  async create(notificationData, createdBy = "ricardo_system") {
    const startTime = Date.now();

    try {
      // Validar datos básicos
      if (!notificationData.client_id || !notificationData.type) {
        return { success: false, error: "client_id y type son requeridos" };
      }

      // Obtener información del cliente para personalización
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select(
          "id, name, email, phone, whatsapp_number, preferred_contact_method, metadata"
        )
        .eq("id", notificationData.client_id)
        .single();

      if (clientError || !client) {
        return { success: false, error: "Cliente no encontrado" };
      }

      // Obtener información del servicio si hay booking_id
      let service = null;
      let booking = null;
      if (notificationData.booking_id) {
        const { data: bookingData, error: bookingError } = await supabase
          .from("bookings")
          .select(
            `
            *,
            services (
              id, name, category, price, duration, metadata
            )
          `
          )
          .eq("id", notificationData.booking_id)
          .single();

        if (!bookingError && bookingData) {
          booking = bookingData;
          service = bookingData.services;
        }
      }

      // Generar mensaje personalizado consciente
      const personalizedMessage = await this._generateConsciousMessage(
        notificationData.type,
        notificationData.channel ||
          client.preferred_contact_method ||
          "whatsapp",
        {
          client,
          service,
          booking,
          customData: notificationData.custom_data || {},
        }
      );

      // Preparar datos para inserción
      const insertData = {
        client_id: notificationData.client_id,
        booking_id: notificationData.booking_id || null,
        type: notificationData.type,
        channel:
          notificationData.channel ||
          client.preferred_contact_method ||
          "whatsapp",
        priority:
          notificationData.priority ||
          this._determinePriority(notificationData.type),
        title:
          notificationData.title ||
          this._generateTitle(notificationData.type, service),
        message: personalizedMessage,
        status: notificationData.status || "pending",
        scheduled_for:
          notificationData.scheduled_for || new Date().toISOString(),
        metadata: {
          ...notificationData.metadata,
          ricardo_specialized: true,
          conscious_philosophy: true,
          service_category: service?.category,
          personalization_applied: true,
        },
        created_by: createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from(this.tableName)
        .insert([insertData])
        .select();

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Notificación consciente creada", {
        notification_id: data[0].id,
        type: data[0].type,
        channel: data[0].channel,
        client_name: client.name,
        service_name: service?.name,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: data[0],
        message: "Notificación consciente creada exitosamente",
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error creando notificación consciente", error, {
        client_id: notificationData.client_id,
        type: notificationData.type,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generar mensaje personalizado con filosofía consciente
   */
  async _generateConsciousMessage(type, channel, context) {
    try {
      const { client, service, booking, customData } = context;

      // Obtener plantilla base
      const template =
        this.consciousTemplates[type]?.[channel] ||
        this.consciousTemplates[type]?.whatsapp ||
        "Mensaje de {service_name} para {client_name}";

      // Variables de reemplazo
      const variables = {
        client_name: client.name,
        service_name: service?.name || "servicio",
        booking_date: booking ? this._formatDate(booking.booking_date) : "",
        booking_time: booking?.booking_time || "",
        duration: service?.duration || "",
        price: service?.price || "",
        preparation_instructions:
          service?.metadata?.preparation_instructions ||
          "Llegar con cabello limpio",
        aftercare_instructions:
          service?.metadata?.aftercare_instructions ||
          "Seguir las recomendaciones dadas",
        conscious_tip: this._getRandomConsciousTip(service?.category),
        calendly_link: "https://calendly.com/ricardo-buritica",
        ...customData,
      };

      // Reemplazar variables en la plantilla
      let message = template;
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{${key}}`, "g");
        message = message.replace(regex, value || "");
      });

      return message;
    } catch (error) {
      logger.error("Error generando mensaje consciente", error, {
        type,
        channel,
      });
      return `Hola ${context.client.name}, tienes una notificación sobre ${
        context.service?.name || "tu servicio"
      }.`;
    }
  }

  /**
   * Obtener tip consciente aleatorio por categoría
   */
  _getRandomConsciousTip(category) {
    if (!category || !this.consciousTips[category]) {
      const allTips = Object.values(this.consciousTips).flat();
      return allTips[Math.floor(Math.random() * allTips.length)];
    }

    const categoryTips = this.consciousTips[category];
    return categoryTips[Math.floor(Math.random() * categoryTips.length)];
  }

  /**
   * Determinar prioridad basada en el tipo de notificación
   */
  _determinePriority(type) {
    const priorityMap = {
      booking_cancellation: "critical",
      booking_reminder_2h: "high",
      booking_reminder_24h: "high",
      booking_confirmation: "normal",
      preparation_instructions: "normal",
      aftercare_instructions: "normal",
      conscious_education: "low",
      maintenance_reminder: "normal",
      seasonal_care_tips: "low",
      birthday_greeting: "low",
    };

    return priorityMap[type] || "normal";
  }

  /**
   * Generar título para la notificación
   */
  _generateTitle(type, service) {
    const titleMap = {
      booking_confirmation: `Cita confirmada - ${service?.name || "Servicio"}`,
      booking_reminder_24h: `Recordatorio: Cita mañana - ${
        service?.name || "Servicio"
      }`,
      booking_reminder_2h: `Recordatorio: Cita en 2 horas - ${
        service?.name || "Servicio"
      }`,
      preparation_instructions: `Preparación para ${
        service?.name || "tu servicio"
      }`,
      aftercare_instructions: `Cuidados posteriores - ${
        service?.name || "Servicio"
      }`,
      conscious_education: "Tip de Peluquería Consciente",
      maintenance_reminder: "Recordatorio de mantenimiento",
      seasonal_care_tips: "Cuidados estacionales para tu cabello",
      birthday_greeting: "¡Feliz cumpleaños!",
      new_service_announcement: "Nuevo servicio disponible",
    };

    return (
      titleMap[type] || "Notificación de Ricardo Buriticá Beauty Consulting"
    );
  }

  /**
   * Formatear fecha para mostrar
   */
  _formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      return dateString;
    }
  }

  /**
   * Crear recordatorio consciente para cita
   */
  async createConsciousReminder(bookingId, reminderType = "24h") {
    const startTime = Date.now();

    try {
      // Obtener información completa de la reserva
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select(
          `
          *,
          clients (
            id, name, email, phone, whatsapp_number, preferred_contact_method
          ),
          services (
            id, name, category, price, duration, metadata
          )
        `
        )
        .eq("id", bookingId)
        .single();

      if (bookingError || !booking) {
        return { success: false, error: "Reserva no encontrada" };
      }

      // Calcular cuándo enviar el recordatorio
      const bookingDateTime = new Date(
        `${booking.booking_date}T${booking.booking_time}`
      );
      let reminderTime = new Date(bookingDateTime);

      switch (reminderType) {
        case "24h":
          reminderTime.setHours(reminderTime.getHours() - 24);
          break;
        case "2h":
          reminderTime.setHours(reminderTime.getHours() - 2);
          break;
        case "30min":
          reminderTime.setMinutes(reminderTime.getMinutes() - 30);
          break;
        default:
          reminderTime.setHours(reminderTime.getHours() - 24);
      }

      // Verificar que no sea en el pasado
      if (reminderTime < new Date()) {
        return {
          success: false,
          error: "El tiempo de recordatorio calculado está en el pasado",
        };
      }

      // Crear la notificación
      const notificationData = {
        client_id: booking.client_id,
        booking_id: bookingId,
        type: `booking_reminder_${reminderType}`,
        channel: booking.clients.preferred_contact_method || "whatsapp",
        scheduled_for: reminderTime.toISOString(),
        custom_data: {
          conscious_tip: this._getRandomConsciousTip(booking.services.category),
          reminder_type: reminderType,
        },
      };

      const result = await this.create(
        notificationData,
        "ricardo_reminder_system"
      );

      if (result.success) {
        const duration = Date.now() - startTime;
        logger.info("Recordatorio consciente creado", {
          notification_id: result.data.id,
          booking_id: bookingId,
          reminder_type: reminderType,
          scheduled_for: reminderTime.toISOString(),
          duration: `${duration}ms`,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error creando recordatorio consciente", error, {
        booking_id: bookingId,
        reminder_type: reminderType,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Enviar educación consciente personalizada
   */
  async sendConsciousEducation(clientId, educationalContent) {
    const startTime = Date.now();

    try {
      const notificationData = {
        client_id: clientId,
        type: "conscious_education",
        custom_data: {
          educational_content: educationalContent.content,
          why_important: educationalContent.importance,
          what_to_avoid: educationalContent.avoid,
          what_to_prefer: educationalContent.prefer,
          scientific_basis: educationalContent.science,
          practical_application: educationalContent.practice,
          recommended_products: educationalContent.products,
        },
      };

      const result = await this.create(
        notificationData,
        "ricardo_education_system"
      );

      if (result.success) {
        const duration = Date.now() - startTime;
        logger.info("Educación consciente enviada", {
          notification_id: result.data.id,
          client_id: clientId,
          content_type: educationalContent.type,
          duration: `${duration}ms`,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error enviando educación consciente", error, {
        client_id: clientId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Crear recordatorio de mantenimiento basado en el último servicio
   */
  async createMaintenanceReminder(clientId, lastServiceDate, serviceCategory) {
    const startTime = Date.now();

    try {
      // Determinar cuándo enviar el recordatorio basado en el tipo de servicio
      const maintenanceIntervals = {
        cortes: 6, // 6 semanas
        coloracion: 8, // 8 semanas
        tratamientos_capilares: 4, // 4 semanas
      };

      const weeksInterval = maintenanceIntervals[serviceCategory] || 6;
      const reminderDate = new Date(lastServiceDate);
      reminderDate.setDate(reminderDate.getDate() + weeksInterval * 7);

      // Crear recomendaciones de mantenimiento
      const maintenanceRecommendations =
        this._generateMaintenanceRecommendations(serviceCategory);

      const notificationData = {
        client_id: clientId,
        type: "maintenance_reminder",
        scheduled_for: reminderDate.toISOString(),
        custom_data: {
          weeks_since_service: weeksInterval,
          last_service: serviceCategory,
          maintenance_recommendations: maintenanceRecommendations,
          calendly_link: "https://calendly.com/ricardo-buritica",
        },
      };

      const result = await this.create(
        notificationData,
        "ricardo_maintenance_system"
      );

      if (result.success) {
        const duration = Date.now() - startTime;
        logger.info("Recordatorio de mantenimiento creado", {
          notification_id: result.data.id,
          client_id: clientId,
          service_category: serviceCategory,
          scheduled_for: reminderDate.toISOString(),
          duration: `${duration}ms`,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error creando recordatorio de mantenimiento", error, {
        client_id: clientId,
        service_category: serviceCategory,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generar recomendaciones de mantenimiento por categoría
   */
  _generateMaintenanceRecommendations(serviceCategory) {
    const recommendations = {
      cortes: [
        "Retoque de corte para mantener la forma",
        "Evaluación del crecimiento natural",
        "Ajustes según cambios estacionales",
      ],
      coloracion: [
        "Retoque de raíz si es necesario",
        "Evaluación del estado del color",
        "Tratamiento de mantenimiento del color",
        "Hidratación post-coloración",
      ],
      tratamientos_capilares: [
        "Evaluación de la salud capilar",
        "Refuerzo del tratamiento anterior",
        "Ajuste de rutina de cuidado en casa",
      ],
    };

    return recommendations[serviceCategory] || recommendations["cortes"];
  }

  // Métodos de compatibilidad
  async getById(notificationId) {
    const startTime = Date.now();

    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select(
          `
          *,
          clients (
            id, name, email, phone, whatsapp_number, preferred_contact_method
          )
        `
        )
        .eq("id", notificationId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return { success: false, error: "Notificación no encontrada" };
        }
        throw error;
      }

      const duration = Date.now() - startTime;
      logger.info("Notificación obtenida por ID", {
        notification_id: notificationId,
        type: data.type,
        duration: `${duration}ms`,
      });

      return { success: true, data };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error obteniendo notificación por ID", error, {
        notification_id: notificationId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  async getPendingNotifications() {
    const startTime = Date.now();

    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from(this.tableName)
        .select(
          `
          *,
          clients (
            id, name, email, phone, whatsapp_number, preferred_contact_method
          )
        `
        )
        .eq("status", "pending")
        .lte("scheduled_for", now)
        .order("priority", { ascending: false })
        .order("scheduled_for", { ascending: true });

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Notificaciones pendientes obtenidas", {
        count: data.length,
        duration: `${duration}ms`,
      });

      return { success: true, data };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error obteniendo notificaciones pendientes", error, {
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  async markAsSent(notificationId, sentData = {}) {
    const startTime = Date.now();

    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          metadata: { ...sentData, sent_by_ricardo_system: true },
          updated_at: new Date().toISOString(),
        })
        .eq("id", notificationId)
        .select();

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Notificación marcada como enviada", {
        notification_id: notificationId,
        duration: `${duration}ms`,
      });

      return { success: true, data: data[0] };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error marcando notificación como enviada", error, {
        notification_id: notificationId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Buscar notificación existente para evitar duplicados
   */
  async findExisting(bookingId, clientId, notificationType) {
    const startTime = Date.now();

    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("booking_id", bookingId)
        .eq("client_id", clientId)
        .eq("notification_type", notificationType)
        .in("status", ["sent", "pending"])
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows found
        throw error;
      }

      const duration = Date.now() - startTime;
      logger.debug("Búsqueda de notificación existente", {
        bookingId,
        clientId,
        notificationType,
        found: !!data,
        duration: `${duration}ms`,
      });

      return { success: true, data };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error buscando notificación existente", error, {
        bookingId,
        clientId,
        notificationType,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Actualizar estado de notificación
   */
  async updateStatus(notificationId, status, errorMessage = null) {
    const startTime = Date.now();

    try {
      const updateData = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === "sent") {
        updateData.sent_at = new Date().toISOString();
      } else if (status === "failed" || status === "failed_max_retries") {
        updateData.error_message = errorMessage;
        updateData.failed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .update(updateData)
        .eq("id", notificationId)
        .select();

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Estado de notificación actualizado", {
        notificationId,
        status,
        duration: `${duration}ms`,
      });

      return { success: true, data: data[0] };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error actualizando estado de notificación", error, {
        notificationId,
        status,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Eliminar notificaciones antiguas
   */
  async deleteOldNotifications(beforeDate) {
    const startTime = Date.now();

    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .delete()
        .lt("created_at", beforeDate.toISOString())
        .in("status", ["sent", "failed", "failed_max_retries"]);

      if (error) throw error;

      const duration = Date.now() - startTime;
      const deletedCount = data ? data.length : 0;

      logger.info("Notificaciones antiguas eliminadas", {
        deletedCount,
        beforeDate: beforeDate.toISOString(),
        duration: `${duration}ms`,
      });

      return { success: true, deletedCount };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error eliminando notificaciones antiguas", error, {
        beforeDate: beforeDate.toISOString(),
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener estadísticas de notificaciones
   */
  async getStats(dateFrom, dateTo) {
    const startTime = Date.now();

    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("status, notification_type, channel, created_at")
        .gte("created_at", dateFrom.toISOString())
        .lte("created_at", dateTo.toISOString());

      if (error) throw error;

      // Procesar estadísticas
      const stats = {
        total: data.length,
        by_status: {},
        by_type: {},
        by_channel: {},
        success_rate: 0,
      };

      data.forEach((notification) => {
        // Por estado
        stats.by_status[notification.status] =
          (stats.by_status[notification.status] || 0) + 1;

        // Por tipo
        stats.by_type[notification.notification_type] =
          (stats.by_type[notification.notification_type] || 0) + 1;

        // Por canal
        stats.by_channel[notification.channel] =
          (stats.by_channel[notification.channel] || 0) + 1;
      });

      // Calcular tasa de éxito
      const sent = stats.by_status.sent || 0;
      stats.success_rate =
        stats.total > 0 ? Math.round((sent / stats.total) * 100) : 0;

      const duration = Date.now() - startTime;
      logger.info("Estadísticas de notificaciones obtenidas", {
        total: stats.total,
        success_rate: stats.success_rate,
        duration: `${duration}ms`,
      });

      return { success: true, data: stats };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error obteniendo estadísticas de notificaciones", error, {
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }
}

module.exports = NotificationModel;
