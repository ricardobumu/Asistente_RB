// src/controllers/widgetController.js
// Controlador para el widget de reservas público

const logger = require("../utils/logger");
const Validators = require("../utils/validators");
const ServiceModel = require("../models/serviceModel");
const AppointmentModel = require("../models/appointmentModel");
const ClientModel = require("../models/clientModel");
const notificationScheduler = require("../services/notificationScheduler");

class WidgetController {
  constructor() {
    this.serviceModel = new ServiceModel();
    this.appointmentModel = new AppointmentModel();
    this.clientModel = new ClientModel();
  }

  /**
   * Obtener servicios públicos para el widget
   */
  async getPublicServices(req, res) {
    try {
      logger.info("Widget: Obteniendo servicios públicos");

      const result = await this.serviceModel.getActive();

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: "Error obteniendo servicios",
        });
      }

      // Filtrar solo servicios públicos y formatear para el widget
      const publicServices = result.data
        .filter((service) => service.is_active && !service.is_private)
        .map((service) => ({
          id: service.id,
          name: service.name,
          description: service.description,
          price: service.price,
          duration: service.duration,
          category: service.category,
          image_url: service.image_url,
        }));

      logger.info("Widget: Servicios públicos obtenidos", {
        count: publicServices.length,
      });

      res.json({
        success: true,
        data: publicServices,
      });
    } catch (error) {
      logger.error("Error obteniendo servicios públicos para widget", {
        error: error.message,
        stack: error.stack,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Obtener disponibilidad para una fecha específica
   */
  async getAvailability(req, res) {
    try {
      const { serviceId } = req.params;
      const { date } = req.query;

      logger.info("Widget: Obteniendo disponibilidad", {
        serviceId,
        date,
      });

      // Validar parámetros
      if (!serviceId || !date) {
        return res.status(400).json({
          success: false,
          error: "Service ID y fecha son requeridos",
        });
      }

      // Validar formato de fecha
      if (!Validators.isValidDate(date)) {
        return res.status(400).json({
          success: false,
          error: "Formato de fecha inválido",
        });
      }

      // Verificar que la fecha no sea en el pasado
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        return res.status(400).json({
          success: false,
          error: "No se pueden hacer reservas en fechas pasadas",
        });
      }

      // TODO: Implementar lógica de disponibilidad en appointmentModel
      // const result = await this.appointmentModel.getAvailableTimeSlots(serviceId, date);
      const result = { success: false, error: "Método no implementado aún" };

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: "Error obteniendo disponibilidad",
        });
      }

      logger.info("Widget: Disponibilidad obtenida", {
        serviceId,
        date,
        availableSlots: result.data.length,
      });

      res.json({
        success: true,
        data: result.data,
        summary: result.summary,
      });
    } catch (error) {
      logger.error("Error obteniendo disponibilidad para widget", {
        error: error.message,
        serviceId: req.params.serviceId,
        date: req.query.date,
        stack: error.stack,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Crear reserva desde el widget
   */
  async createBooking(req, res) {
    try {
      const {
        service_id,
        appointment_date,
        appointment_time,
        client_data,
        source,
      } = req.body;

      logger.info("Widget: Creando nueva reserva", {
        service_id,
        appointment_date,
        appointment_time,
        client_name: client_data?.name,
        source,
      });

      // Validar datos requeridos
      const validation = this.validateBookingData({
        service_id,
        appointment_date,
        appointment_time,
        client_data,
      });

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: validation.errors.join(", "),
        });
      }

      // TODO: Implementar verificación de disponibilidad en appointmentModel
      // const availabilityResult = await this.appointmentModel.checkAvailability(
      //   appointment_date,
      //   appointment_time,
      //   service_id
      // );
      const availabilityResult = { success: true, available: true };

      if (!availabilityResult.success || !availabilityResult.available) {
        return res.status(409).json({
          success: false,
          error: "El horario seleccionado ya no está disponible",
        });
      }

      // Crear o buscar cliente
      let client = await this.findOrCreateClient(client_data);
      if (!client) {
        return res.status(500).json({
          success: false,
          error: "Error procesando datos del cliente",
        });
      }

      // Obtener información del servicio
      const serviceResult = await this.serviceModel.getById(service_id);
      if (!serviceResult.success) {
        return res.status(404).json({
          success: false,
          error: "Servicio no encontrado",
        });
      }

      const service = serviceResult.data;

      // Crear la cita
      const appointmentData = {
        client_id: client.id,
        service_id: service_id,
        service_name: service.name,
        appointment_date,
        appointment_time,
        status: "confirmed",
        source: source || "widget",
        total_amount: service.price,
        notes: client_data.notes
          ? `Comentarios del cliente: ${client_data.notes}`
          : null,
        metadata: {
          widget_appointment: true,
          accept_whatsapp: client_data.acceptWhatsApp || false,
          created_via: "public_widget",
        },
      };

      const appointmentResult =
        await this.appointmentModel.create(appointmentData);

      if (!appointmentResult.success) {
        logger.error("Error creando cita desde widget", {
          error: appointmentResult.error,
          appointmentData,
        });
        return res.status(500).json({
          success: false,
          error: "Error creando la cita",
        });
      }

      const appointment = appointmentResult.data;

      // Programar notificaciones automáticas
      try {
        await notificationScheduler.scheduleImmediateAppointmentNotifications(
          appointment,
          client
        );
        logger.info("Notificaciones programadas para cita de widget", {
          appointmentId: appointment.id,
        });
      } catch (notificationError) {
        logger.error("Error programando notificaciones para cita de widget", {
          appointmentId: appointment.id,
          error: notificationError.message,
        });
        // No fallar la reserva por errores de notificación
      }

      logger.info("Widget: Cita creada exitosamente", {
        appointmentId: appointment.id,
        clientId: client.id,
        service: service.name,
        date: appointment_date,
        time: appointment_time,
      });

      // Respuesta exitosa
      res.status(201).json({
        success: true,
        data: {
          id: appointment.id,
          appointment_date,
          appointment_time,
          service_name: service.name,
          client_name: client.name,
          status: appointment.status,
          total_amount: appointment.total_amount,
        },
        message: "Cita creada exitosamente",
      });
    } catch (error) {
      logger.error("Error creando cita desde widget", {
        error: error.message,
        body: req.body,
        stack: error.stack,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Validar datos de reserva
   */
  validateBookingData(data) {
    const errors = [];

    // Validar service_id
    if (!data.service_id || !Number.isInteger(Number(data.service_id))) {
      errors.push("ID de servicio inválido");
    }

    // Validar fecha
    if (
      !data.appointment_date ||
      !Validators.isValidDate(data.appointment_date)
    ) {
      errors.push("Fecha de cita inválida");
    }

    // Validar hora
    if (
      !data.appointment_time ||
      !Validators.isValidTime(data.appointment_time)
    ) {
      errors.push("Hora de cita inválida");
    }

    // Validar datos del cliente
    if (!data.client_data) {
      errors.push("Datos del cliente requeridos");
    } else {
      const { name, phone, email } = data.client_data;

      if (!name || name.trim().length < 2) {
        errors.push("Nombre del cliente debe tener al menos 2 caracteres");
      }

      if (!phone || !Validators.isValidPhone(phone)) {
        errors.push("Teléfono del cliente inválido");
      }

      if (email && !Validators.isValidEmail(email)) {
        errors.push("Email del cliente inválido");
      }
    }

    // Verificar que la fecha no sea en el pasado
    if (data.appointment_date) {
      const appointmentDate = new Date(data.appointment_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (appointmentDate < today) {
        errors.push("No se pueden hacer reservas en fechas pasadas");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Buscar o crear cliente
   */
  async findOrCreateClient(clientData) {
    try {
      const { name, phone, email, acceptWhatsApp } = clientData;

      // Buscar cliente existente por teléfono
      const existingClientResult = await this.clientModel.getByPhone(phone);

      if (existingClientResult.success && existingClientResult.data) {
        // Cliente existe, actualizar información si es necesario
        const existingClient = existingClientResult.data;
        const updateData = {};

        if (name && name !== existingClient.name) {
          updateData.name = name;
        }

        if (email && email !== existingClient.email) {
          updateData.email = email;
        }

        if (Object.keys(updateData).length > 0) {
          const updateResult = await this.clientModel.update(
            existingClient.id,
            updateData
          );
          if (updateResult.success) {
            return { ...existingClient, ...updateData };
          }
        }

        return existingClient;
      }

      // Cliente no existe, crear nuevo
      const newClientData = {
        name: Validators.sanitizeText(name),
        phone: Validators.sanitizeText(phone),
        whatsapp_number: phone,
        email: email ? Validators.sanitizeText(email) : null,
        preferred_contact_method: acceptWhatsApp ? "whatsapp" : "phone",
        source: "widget",
        notes: `Cliente creado desde widget público el ${new Date().toLocaleDateString()}`,
      };

      const createResult = await this.clientModel.create(newClientData);

      if (createResult.success) {
        return createResult.data;
      }

      logger.error("Error creando cliente desde widget", {
        error: createResult.error,
        clientData: newClientData,
      });

      return null;
    } catch (error) {
      logger.error("Error en findOrCreateClient", {
        error: error.message,
        clientData,
      });
      return null;
    }
  }

  /**
   * Obtener información del widget (configuración pública)
   */
  async getWidgetInfo(req, res) {
    try {
      logger.info("Widget: Obteniendo información del widget");

      const widgetInfo = {
        business_name: "Ricardo Buriticá Beauty Consulting",
        business_description: "Peluquería Consciente",
        business_phone: process.env.BUSINESS_PHONE || "+34 XXX XXX XXX",
        business_email: process.env.BUSINESS_EMAIL || "info@ricardoburitica.eu",
        business_address: "Madrid, España",
        appointment_policies: {
          advance_appointment_days: 30,
          cancellation_hours: 24,
          min_appointment_notice_hours: 2,
        },
        working_hours: {
          monday: "9:00-18:00",
          tuesday: "9:00-18:00",
          wednesday: "9:00-18:00",
          thursday: "9:00-18:00",
          friday: "9:00-18:00",
          saturday: "10:00-16:00",
          sunday: "Cerrado",
        },
      };

      res.json({
        success: true,
        data: widgetInfo,
      });
    } catch (error) {
      logger.error("Error obteniendo información del widget", {
        error: error.message,
        stack: error.stack,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Servir el widget HTML
   */
  serveWidget(req, res) {
    try {
      logger.info("Widget: Sirviendo widget HTML");

      const path = require("path");
      const widgetPath = path.join(
        __dirname,
        "../../public/widget/appointment-widget.html"
      );

      res.sendFile(widgetPath, {
        headers: {
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=3600", // Cache por 1 hora
          "X-Frame-Options": "ALLOWALL", // Permitir embebido en iframes
        },
      });
    } catch (error) {
      logger.error("Error sirviendo widget HTML", {
        error: error.message,
      });

      res.status(500).send("Error cargando el widget de reservas");
    }
  }

  /**
   * Generar código de embebido para el widget
   */
  getEmbedCode(req, res) {
    try {
      const { width = "480", height = "600", theme = "light" } = req.query;
      const baseUrl = `${req.protocol}://${req.get("host")}`;

      const embedCode = `<!-- Widget de Citas - Ricardo Buriticá Beauty Consulting -->
<iframe 
  src="${baseUrl}/widget/appointment"
  width="${width}" 
  height="${height}"
  frameborder="0"
  style="border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.2);"
  title="Reservar Cita - Ricardo Buriticá Beauty"
  data-theme="${theme}">
</iframe>

<script>
// Opcional: Comunicación con el widget
window.addEventListener('message', function(event) {
  if (event.data.type === 'closeBookingWidget') {
    // Manejar cierre del widget
    console.log('Widget cerrado');
  }
});
</script>`;

      logger.info("Widget: Código de embebido generado", {
        width,
        height,
        theme,
      });

      res.json({
        success: true,
        data: {
          embed_code: embedCode,
          widget_url: `${baseUrl}/widget/booking`,
          configuration: {
            width,
            height,
            theme,
          },
        },
      });
    } catch (error) {
      logger.error("Error generando código de embebido", {
        error: error.message,
        query: req.query,
      });

      res.status(500).json({
        success: false,
        error: "Error generando código de embebido",
      });
    }
  }
}

module.exports = new WidgetController();
