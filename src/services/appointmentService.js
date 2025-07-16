// src/services/appointmentService.js
const DatabaseAdapter = require("../adapters/databaseAdapter");
const ClientService = require("./clientService");
const ServiceService = require("./serviceService");
const googleCalendarClient = require("../integrations/googleCalendarClient");
const calendlyClient = require("../integrations/calendlyClient");
const logger = require("../utils/logger");
const {
  validateAppointmentData,
  sanitizeAppointmentData,
} = require("../utils/validators");

class AppointmentService {
  /**
   * Generar número de cita único
   */
  static async generateAppointmentNumber() {
    const prefix = "BK";
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * Generar código de confirmación
   */
  static generateConfirmationCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  /**
   * Crear nueva cita con validaciones completas
   */
  static async createAppointment(appointmentData) {
    try {
      // Validar datos de entrada
      const validation = validateAppointmentData(appointmentData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      // Sanitizar datos
      const sanitizedData = sanitizeAppointmentData(appointmentData);

      // Obtener cliente (por ID o crear si viene por teléfono)
      let client = null;
      if (sanitizedData.client_id) {
        const clientResult = await ClientService.findById(
          sanitizedData.client_id
        );
        if (!clientResult.success || !clientResult.data) {
          throw new Error("Cliente no encontrado");
        }
        client = clientResult.data;
      } else if (sanitizedData.client_phone) {
        // Buscar por teléfono o crear cliente temporal
        const clientResult = await ClientService.findByPhone(
          sanitizedData.client_phone
        );
        if (clientResult.success && clientResult.data) {
          client = clientResult.data;
        } else {
          // Crear cliente temporal
          const createResult = await ClientService.createClient({
            first_name: sanitizedData.client_name || "Cliente",
            last_name: sanitizedData.client_last_name || "",
            phone: sanitizedData.client_phone,
            email: sanitizedData.client_email || null,
            whatsapp_phone: sanitizedData.client_phone,
            lgpd_accepted: true,
            registration_complete: false,
            status: "active",
          });

          if (!createResult.success) {
            throw new Error(`Error creating client: ${createResult.error}`);
          }
          client = createResult.data;
        }
      } else {
        throw new Error("client_id or client_phone is required");
      }

      // Validar que el servicio existe
      const serviceResult = await ServiceService.getServiceById(
        sanitizedData.service_id
      );
      if (!serviceResult.success || !serviceResult.data) {
        throw new Error("Servicio no encontrado");
      }
      const service = serviceResult.data;

      // Calcular fechas
      const startDate = new Date(sanitizedData.start_time);
      const endDate = sanitizedData.end_time
        ? new Date(sanitizedData.end_time)
        : new Date(
            startDate.getTime() + (service.duration_minutes || 60) * 60000
          );

      // Validar que la fecha no sea en el pasado
      if (startDate < new Date()) {
        throw new Error("No se pueden crear citas en fechas pasadas");
      }

      // Verificar disponibilidad en Google Calendar
      if (googleCalendarClient.isInitialized()) {
        const availability = await googleCalendarClient.checkAvailability(
          startDate.toISOString(),
          endDate.toISOString()
        );

        if (!availability.available) {
          throw new Error("El horario solicitado no está disponible");
        }
      }

      // Generar número de cita único
      const appointmentNumber = await this.generateAppointmentNumber();

      // Generar código de confirmación
      const confirmationCode = this.generateConfirmationCode();

      // Preparar datos para insertar
      const appointmentToCreate = {
        appointment_number: appointmentNumber,
        client_id: client.id,
        service_id: sanitizedData.service_id,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        timezone: sanitizedData.timezone || "Europe/Madrid",
        status: sanitizedData.status || "pending",
        confirmation_code: confirmationCode,
        notes: sanitizedData.notes || null,
        client_notes: sanitizedData.client_notes || null,
        original_price: service.price || 0,
        final_price: sanitizedData.final_price || service.price || 0,
        currency: "EUR",
        external_id: sanitizedData.external_id || null,
        external_platform: sanitizedData.external_platform || null,
        metadata: sanitizedData.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Crear la cita en la base de datos
      const { data, error } = await DatabaseAdapter.insert(
        "appointments",
        appointmentToCreate
      );

      if (error) throw error;

      const appointment = data?.[0];
      if (!appointment) throw new Error("Error al crear la cita");

      // Crear evento en Google Calendar
      let calendarEventId = null;
      let meetLink = null;

      if (googleCalendarClient.isInitialized()) {
        const eventData = {
          title: `${service.name} - ${client.first_name} ${client.last_name}`,
          description: `
Cita #${appointmentNumber}
Servicio: ${service.name}
Cliente: ${client.first_name} ${client.last_name}
Teléfono: ${client.phone}
Email: ${client.email || "No proporcionado"}
Precio: €${appointment.final_price}
Duración: ${service.duration_minutes} minutos
Código: ${confirmationCode}

${service.description || ""}

${appointment.notes ? `Notas: ${appointment.notes}` : ""}
          `.trim(),
          startDateTime: startDate.toISOString(),
          endDateTime: endDate.toISOString(),
          attendeeEmail: client.email,
          attendeeName: `${client.first_name} ${client.last_name}`,
          location: service.location || "Por confirmar",
        };

        const calendarResult =
          await googleCalendarClient.createEvent(eventData);

        if (calendarResult.success) {
          calendarEventId = calendarResult.data.id;
          meetLink = calendarResult.data.meetLink;

          // Actualizar la cita con el ID del evento de calendario
          await DatabaseAdapter.update(
            "appointments",
            {
              external_id: calendarEventId,
              external_platform: "google_calendar",
              metadata: {
                ...appointment.metadata,
                calendar_event_id: calendarEventId,
                meet_link: meetLink,
              },
            },
            { id: appointment.id }
          );

          logger.info("Appointment created with Google Calendar event", {
            appointmentId: appointment.id,
            appointmentNumber: appointmentNumber,
            calendarEventId: calendarEventId,
            clientName: `${client.first_name} ${client.last_name}`,
            serviceName: service.name,
            startTime: startDate.toISOString(),
          });
        } else {
          logger.warn("Could not create Google Calendar event", {
            error: calendarResult.error,
            appointmentId: appointment.id,
          });
        }
      }

      // Crear evento en Calendly si está configurado
      if (calendlyClient.isInitialized()) {
        try {
          const calendlyResult = await calendlyClient.createAppointment({
            event_type_uri: service.calendly_event_type || null,
            start_time: startDate.toISOString(),
            invitee_name: `${client.first_name} ${client.last_name}`,
            invitee_email: client.email,
            invitee_phone: client.phone,
            additional_info: appointment.notes,
          });

          if (calendlyResult.success) {
            await DatabaseAdapter.update(
              "appointments",
              {
                metadata: {
                  ...appointment.metadata,
                  calendly_appointment: calendlyResult.data,
                },
              },
              { id: appointment.id }
            );
          }
        } catch (calendlyError) {
          logger.warn("Calendly appointment creation failed", {
            error: calendlyError.message,
            appointmentId: appointment.id,
          });
        }
      }

      logger.info("Appointment created successfully", {
        appointmentId: appointment.id,
        appointmentNumber: appointmentNumber,
        clientId: client.id,
        serviceId: service.id,
        startTime: startDate.toISOString(),
        status: appointment.status,
      });

      return {
        success: true,
        data: {
          ...appointment,
          client: client,
          service: service,
          calendar_event_id: calendarEventId,
          meet_link: meetLink,
        },
        message: "Appointment created successfully",
      };
    } catch (error) {
      logger.error("Error creating appointment", {
        error: error.message,
        appointmentData: {
          client_id: appointmentData?.client_id,
          service_id: appointmentData?.service_id,
          start_time: appointmentData?.start_time,
        },
      });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Obtener citas de un cliente con información completa
   */
  static async getClientAppointments(clientId, options = {}) {
    try {
      if (!clientId) {
        throw new Error("Client ID is required");
      }

      const {
        status = null,
        limit = 50,
        offset = 0,
        includeExpired = false,
        sortBy = "start_time",
        sortOrder = "desc",
      } = options;

      let query = `
        SELECT 
          b.*,
          c.first_name, c.last_name, c.email, c.phone,
          s.name as service_name, s.price as service_price, s.duration_minutes
        FROM appointments b
        LEFT JOIN clients c ON b.client_id = c.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.client_id = $1
      `;

      const params = [clientId];
      let paramIndex = 2;

      // Filtrar por estado
      if (status) {
        query += ` AND b.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      // Filtrar citas expiradas
      if (!includeExpired) {
        query += ` AND b.start_time >= NOW()`;
      }

      // Ordenamiento
      query += ` ORDER BY b.${sortBy} ${sortOrder.toUpperCase()}`;

      // Paginación
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await DatabaseAdapter.query(query, params);

      if (result.error) throw new Error(result.error);

      const appointments = result.data || [];

      logger.info("Client appointments retrieved", {
        clientId,
        count: appointments.length,
        status: status || "all",
        includeExpired,
      });

      return {
        success: true,
        data: appointments,
        count: appointments.length,
      };
    } catch (error) {
      logger.error("Error getting client appointments", {
        error: error.message,
        clientId,
        options,
      });
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Obtener citas por estado con información completa
   */
  static async getAppointmentsByStatus(status, options = {}) {
    try {
      if (!status) {
        throw new Error("Status is required");
      }

      const {
        limit = 100,
        offset = 0,
        sortBy = "start_time",
        sortOrder = "asc",
        includeExpired = true,
      } = options;

      let query = `
        SELECT 
          b.*,
          c.first_name, c.last_name, c.email, c.phone,
          s.name as service_name, s.price as service_price, s.duration_minutes
        FROM appointments b
        LEFT JOIN clients c ON b.client_id = c.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.status = $1
      `;

      const params = [status];
      let paramIndex = 2;

      // Filtrar citas expiradas
      if (!includeExpired) {
        query += ` AND b.start_time >= NOW()`;
      }

      // Ordenamiento
      query += ` ORDER BY b.${sortBy} ${sortOrder.toUpperCase()}`;

      // Paginación
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await DatabaseAdapter.query(query, params);

      if (result.error) throw new Error(result.error);

      const appointments = result.data || [];

      logger.info("Appointments by status retrieved", {
        status,
        count: appointments.length,
        includeExpired,
      });

      return {
        success: true,
        data: appointments,
        count: appointments.length,
      };
    } catch (error) {
      logger.error("Error getting appointments by status", {
        error: error.message,
        status,
        options,
      });
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Actualizar estado de cita con validaciones
   */
  static async updateAppointmentStatus(
    appointmentId,
    status,
    notes = null,
    reason = null
  ) {
    try {
      if (!appointmentId) {
        throw new Error("Appointment ID is required");
      }

      if (!status) {
        throw new Error("Status is required");
      }

      // Validar estado
      const validStatuses = [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ];
      if (!validStatuses.includes(status)) {
        throw new Error("Invalid status");
      }

      // Verificar que la cita existe
      const existingResult = await DatabaseAdapter.select("appointments", "*", {
        id: appointmentId,
      });
      if (
        existingResult.error ||
        !existingResult.data ||
        existingResult.data.length === 0
      ) {
        throw new Error("Appointment not found");
      }

      const existingAppointment = existingResult.data[0];

      // Preparar datos de actualización
      const updateData = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (notes) {
        updateData.staff_notes = notes;
      }

      if (reason) {
        updateData.cancellation_reason = reason;
      }

      // Agregar timestamps específicos según el estado
      if (status === "cancelled") {
        updateData.cancelled_at = new Date().toISOString();
      } else if (status === "completed") {
        updateData.completed_at = new Date().toISOString();
      }

      const { data, error } = await DatabaseAdapter.update(
        "appointments",
        updateData,
        { id: appointmentId }
      );

      if (error) throw error;

      const updatedAppointment = data?.[0] || null;

      logger.info("Appointment status updated", {
        appointmentId,
        oldStatus: existingAppointment.status,
        newStatus: status,
        reason: reason || "none",
        notes: notes || "none",
      });

      return {
        success: true,
        data: updatedAppointment,
        message: "Appointment status updated successfully",
      };
    } catch (error) {
      logger.error("Error updating appointment status", {
        error: error.message,
        appointmentId,
        status,
        notes,
        reason,
      });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Obtener citas del día
   */
  static async getTodayAppointments() {
    try {
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const query = `
        SELECT 
          b.*,
          c.first_name, c.last_name, c.email, c.phone,
          s.name as service_name, s.price as service_price, s.duration_minutes
        FROM appointments b
        LEFT JOIN clients c ON b.client_id = c.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.start_time >= $1 AND b.start_time < $2
        ORDER BY b.start_time ASC
      `;

      const result = await DatabaseAdapter.query(query, [
        startOfDay.toISOString(),
        endOfDay.toISOString(),
      ]);

      if (result.error) throw new Error(result.error);

      const appointments = result.data || [];

      logger.info("Today's appointments retrieved", {
        date: today.toISOString().split("T")[0],
        count: appointments.length,
      });

      return {
        success: true,
        data: appointments,
        count: appointments.length,
      };
    } catch (error) {
      logger.error("Error getting today's appointments", { error: error.message });
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Obtener próximas citas (siguientes N días)
   */
  static async getUpcomingAppointments(days = 7) {
    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + days);

      const query = `
        SELECT 
          b.*,
          c.first_name, c.last_name, c.email, c.phone,
          s.name as service_name, s.price as service_price, s.duration_minutes
        FROM appointments b
        LEFT JOIN clients c ON b.client_id = c.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.start_time >= $1 AND b.start_time <= $2
        AND b.status IN ('pending', 'confirmed')
        ORDER BY b.start_time ASC
      `;

      const result = await DatabaseAdapter.query(query, [
        today.toISOString(),
        futureDate.toISOString(),
      ]);

      if (result.error) throw new Error(result.error);

      const appointments = result.data || [];

      logger.info("Upcoming appointments retrieved", {
        days,
        count: appointments.length,
        dateRange: {
          from: today.toISOString().split("T")[0],
          to: futureDate.toISOString().split("T")[0],
        },
      });

      return {
        success: true,
        data: appointments,
        count: appointments.length,
      };
    } catch (error) {
      logger.error("Error getting upcoming appointments", {
        error: error.message,
        days,
      });
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Cancelar cita con sincronización completa
   */
  static async cancelAppointment(appointmentId, reason = null, cancelledBy = null) {
    try {
      if (!appointmentId) {
        throw new Error("Appointment ID is required");
      }

      // Obtener la cita actual
      const { data: appointments, error } = await DatabaseAdapter.select(
        "appointments",
        "*",
        { id: appointmentId }
      );

      if (error || !appointments || appointments.length === 0) {
        throw new Error("Appointment not found");
      }

      const appointment = appointments[0];

      // Verificar que se puede cancelar
      if (appointment.status === "cancelled") {
        throw new Error("Appointment is already cancelled");
      }

      if (appointment.status === "completed") {
        throw new Error("Cannot cancel completed appointment");
      }

      // Cancelar evento en Google Calendar si existe
      const calendarEventId =
        appointment.external_id || appointment.metadata?.calendar_event_id;
      if (calendarEventId && googleCalendarClient.isInitialized()) {
        const cancelResult = await googleCalendarClient.cancelEvent(
          calendarEventId,
          reason || "Appointment cancelled"
        );

        if (!cancelResult.success) {
          logger.warn("Could not cancel Google Calendar event", {
            error: cancelResult.error,
            appointmentId,
            calendarEventId,
          });
        } else {
          logger.info("Google Calendar event cancelled", {
            appointmentId,
            calendarEventId,
          });
        }
      }

      // Actualizar estado en la base de datos
      const result = await this.updateAppointmentStatus(
        appointmentId,
        "cancelled",
        `Cancelled by ${cancelledBy || "system"}`,
        reason
      );

      if (result.success) {
        logger.info("Appointment cancelled successfully", {
          appointmentId,
          reason: reason || "no reason provided",
          cancelledBy: cancelledBy || "system",
        });
      }

      return result;
    } catch (error) {
      logger.error("Error cancelling appointment", {
        error: error.message,
        appointmentId,
        reason,
        cancelledBy,
      });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Reprogramar cita
   */
  static async rescheduleAppointment(appointmentId, newDateTime, reason = null) {
    try {
      // Obtener la cita actual con datos del cliente y servicio
      const query = `
        SELECT 
          b.*,
          c.first_name, c.last_name, c.email, c.phone,
          s.name as service_name, s.price as service_price, s.duration_minutes
        FROM appointments b
        LEFT JOIN clients c ON b.client_id = c.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.id = $1
      `;

      const result = await DatabaseAdapter.query(query, [appointmentId]);

      if (result.error || !result.data || result.data.length === 0) {
        throw new Error("Appointment not found");
      }

      const appointment = result.data[0];

      // Calcular nueva fecha de fin
      const newStartDate = new Date(newDateTime);
      const newEndDate = new Date(
        newStartDate.getTime() + (appointment.duration_minutes || 60) * 60000
      );

      // Verificar disponibilidad en el nuevo horario
      const availabilityCheck = await this.checkAvailability(
        newStartDate.toISOString(),
        newEndDate.toISOString(),
        appointmentId
      );

      if (!availabilityCheck.available) {
        throw new Error("El nuevo horario solicitado no está disponible");
      }

      // Verificar disponibilidad en Google Calendar
      if (googleCalendarClient.isInitialized()) {
        const availability = await googleCalendarClient.checkAvailability(
          newStartDate.toISOString(),
          newEndDate.toISOString()
        );

        if (!availability.available) {
          throw new Error(
            "El nuevo horario solicitado no está disponible en Google Calendar"
          );
        }
      }

      // Actualizar evento en Google Calendar
      const calendarEventId =
        appointment.external_id || appointment.metadata?.calendar_event_id;
      if (calendarEventId && googleCalendarClient.isInitialized()) {
        const updateData = {
          start: {
            dateTime: newStartDate.toISOString(),
            timeZone: "Europe/Madrid",
          },
          end: {
            dateTime: newEndDate.toISOString(),
            timeZone: "Europe/Madrid",
          },
          description: `${appointment.notes || ""}

${reason ? `Reprogramada: ${reason}` : "Cita reprogramada"}`,
        };

        const updateResult = await googleCalendarClient.updateEvent(
          calendarEventId,
          updateData
        );

        if (!updateResult.success) {
          logger.warn("No se pudo actualizar evento en Google Calendar", {
            error: updateResult.error,
            appointmentId,
            calendarEventId,
          });
        }
      }

      // Actualizar en la base de datos
      const notes = reason ? `Reprogramada: ${reason}` : "Reprogramada";
      const updateData = {
        start_time: newStartDate.toISOString(),
        end_time: newEndDate.toISOString(),
        notes: notes,
        status: "confirmed",
        updated_at: new Date().toISOString(),
      };

      const { data, error: updateError } = await DatabaseAdapter.update(
        "appointments",
        updateData,
        { id: appointmentId }
      );

      if (updateError) throw updateError;

      logger.info("Appointment rescheduled successfully", {
        appointmentId: appointmentId,
        oldDateTime: appointment.start_time,
        newDateTime: newDateTime,
        reason: reason || "no reason provided",
      });

      return {
        success: true,
        data: data?.[0] || null,
        message: "Appointment rescheduled successfully",
      };
    } catch (error) {
      logger.error("Error rescheduling appointment", {
        error: error.message,
        appointmentId,
        newDateTime,
        reason,
      });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Sincronizar citas con Google Calendar
   */
  static async syncWithGoogleCalendar() {
    try {
      if (!googleCalendarClient.isInitialized()) {
        return {
          success: false,
          error: "Google Calendar no está configurado",
          data: { synced: 0, errors: 0 },
        };
      }

      // Obtener citas sin evento de calendario
      const query = `
        SELECT 
          b.*,
          c.first_name, c.last_name, c.email, c.phone,
          s.name as service_name, s.price as service_price, s.duration_minutes, s.description
        FROM appointments b
        LEFT JOIN clients c ON b.client_id = c.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE (b.external_id IS NULL OR b.external_id = '')
        AND b.status = 'confirmed'
        AND b.start_time >= $1
      `;

      const result = await DatabaseAdapter.query(query, [
        new Date().toISOString(),
      ]);

      if (result.error) throw new Error(result.error);

      const appointments = result.data || [];
      let synced = 0;
      let errors = 0;

      for (const appointment of appointments) {
        try {
          const startDate = new Date(appointment.start_time);
          const endDate = new Date(appointment.end_time);

          const eventData = {
            title: `${appointment.service_name} - ${appointment.first_name} ${appointment.last_name}`,
            description: `
Servicio: ${appointment.service_name}
Cliente: ${appointment.first_name} ${appointment.last_name}
Teléfono: ${appointment.phone}
Email: ${appointment.email || "No proporcionado"}
Precio: €${appointment.service_price}
Duración: ${appointment.duration_minutes} minutos

${appointment.description || ""}
            `.trim(),
            startDateTime: startDate.toISOString(),
            endDateTime: endDate.toISOString(),
            attendeeEmail: appointment.email,
            attendeeName: `${appointment.first_name} ${appointment.last_name}`,
            location: "Consulta Virtual",
          };

          const calendarResult =
            await googleCalendarClient.createEvent(eventData);

          if (calendarResult.success) {
            // Actualizar cita con ID del evento
            await DatabaseAdapter.update(
              "appointments",
              {
                external_id: calendarResult.data.id,
                external_platform: "google_calendar",
                metadata: {
                  ...appointment.metadata,
                  calendar_event_id: calendarResult.data.id,
                  meet_link: calendarResult.data.meetLink,
                },
              },
              { id: appointment.id }
            );
            synced++;
          } else {
            errors++;
            logger.warn("Error sincronizando cita", {
              appointmentId: appointment.id,
              error: calendarResult.error,
            });
          }
        } catch (syncError) {
          errors++;
          logger.error("Error sincronizando cita", {
            appointmentId: appointment.id,
            error: syncError.message,
          });
        }
      }

      logger.info("Sincronización con Google Calendar completada", {
        total: appointments.length,
        synced: synced,
        errors: errors,
      });

      return {
        success: true,
        data: {
          total: appointments.length,
          synced: synced,
          errors: errors,
        },
      };
    } catch (error) {
      logger.error("Error syncing with Google Calendar", {
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
        data: { synced: 0, errors: 0 },
      };
    }
  }

  /**
   * Buscar cita por ID
   */
  static async findById(appointmentId) {
    try {
      if (!appointmentId) {
        throw new Error("Appointment ID is required");
      }

      const query = `
        SELECT 
          b.*,
          c.first_name, c.last_name, c.email, c.phone,
          s.name as service_name, s.price as service_price, s.duration_minutes
        FROM appointments b
        LEFT JOIN clients c ON b.client_id = c.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.id = $1
      `;

      const result = await DatabaseAdapter.query(query, [appointmentId]);

      if (result.error) throw new Error(result.error);

      const appointment = result.data?.[0] || null;

      logger.info("Appointment found by ID", {
        appointmentId,
        found: !!appointment,
        appointmentNumber: appointment?.appointment_number,
      });

      return {
        success: true,
        data: appointment,
      };
    } catch (error) {
      logger.error("Error finding appointment by ID", {
        error: error.message,
        appointmentId,
      });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Buscar cita por número de cita
   */
  static async findByAppointmentNumber(appointmentNumber) {
    try {
      if (!appointmentNumber) {
        throw new Error("Appointment number is required");
      }

      const query = `
        SELECT 
          b.*,
          c.first_name, c.last_name, c.email, c.phone,
          s.name as service_name, s.price as service_price, s.duration_minutes
        FROM appointments b
        LEFT JOIN clients c ON b.client_id = c.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.appointment_number = $1
      `;

      const result = await DatabaseAdapter.query(query, [appointmentNumber]);

      if (result.error) throw new Error(result.error);

      const appointment = result.data?.[0] || null;

      logger.info("Appointment found by number", {
        appointmentNumber,
        found: !!appointment,
        appointmentId: appointment?.id,
      });

      return {
        success: true,
        data: appointment,
      };
    } catch (error) {
      logger.error("Error finding appointment by number", {
        error: error.message,
        appointmentNumber,
      });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Obtener estadísticas de citas
   */
  static async getAppointmentStats(dateRange = null) {
    try {
      let dateFilter = "";
      const params = [];

      if (dateRange && dateRange.from && dateRange.to) {
        dateFilter = "WHERE b.start_time >= $1 AND b.start_time <= $2";
        params.push(dateRange.from, dateRange.to);
      }

      const query = `
        SELECT 
          COUNT(*) as total_appointments,
          COUNT(CASE WHEN b.status = 'pending' THEN 1 END) as pending_appointments,
          COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END) as confirmed_appointments,
          COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END) as cancelled_appointments,
          COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_appointments,
          COUNT(CASE WHEN b.status = 'no_show' THEN 1 END) as no_show_appointments,
          AVG(b.final_price) as average_price,
          SUM(CASE WHEN b.status = 'completed' THEN b.final_price ELSE 0 END) as total_revenue
        FROM appointments b
        ${dateFilter}
      `;

      const result = await DatabaseAdapter.query(query, params);

      if (result.error) throw new Error(result.error);

      const stats = result.data[0] || {};

      logger.info("Appointment stats retrieved", {
        dateRange: dateRange || "all time",
        totalAppointments: parseInt(stats.total_appointments) || 0,
      });

      return {
        success: true,
        data: {
          totalAppointments: parseInt(stats.total_appointments) || 0,
          pendingAppointments: parseInt(stats.pending_appointments) || 0,
          confirmedAppointments: parseInt(stats.confirmed_appointments) || 0,
          cancelledAppointments: parseInt(stats.cancelled_appointments) || 0,
          completedAppointments: parseInt(stats.completed_appointments) || 0,
          noShowAppointments: parseInt(stats.no_show_appointments) || 0,
          averagePrice: parseFloat(stats.average_price) || 0,
          totalRevenue: parseFloat(stats.total_revenue) || 0,
          cancellationRate:
            stats.total_appointments > 0
              ? (
                  (parseInt(stats.cancelled_appointments) /
                    parseInt(stats.total_appointments)) *
                  100
                ).toFixed(2)
              : 0,
          completionRate:
            stats.total_appointments > 0
              ? (
                  (parseInt(stats.completed_appointments) /
                    parseInt(stats.total_appointments)) *
                  100
                ).toFixed(2)
              : 0,
        },
      };
    } catch (error) {
      logger.error("Error getting appointment stats", {
        error: error.message,
        dateRange,
      });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Verificar disponibilidad de horario
   */
  static async checkAvailability(startTime, endTime, excludeAppointmentId = null) {
    try {
      if (!startTime || !endTime) {
        throw new Error("Start time and end time are required");
      }

      let query = `
        SELECT COUNT(*) as conflicting_appointments
        FROM appointments
        WHERE status IN ('pending', 'confirmed')
        AND (
          (start_time <= $1 AND end_time > $1) OR
          (start_time < $2 AND end_time >= $2) OR
          (start_time >= $1 AND end_time <= $2)
        )
      `;

      const params = [startTime, endTime];

      if (excludeAppointmentId) {
        query += " AND id != $3";
        params.push(excludeAppointmentId);
      }

      const result = await DatabaseAdapter.query(query, params);

      if (result.error) throw new Error(result.error);

      const conflictingAppointments =
        parseInt(result.data[0]?.conflicting_appointments) || 0;
      const available = conflictingAppointments === 0;

      logger.info("Availability checked", {
        startTime,
        endTime,
        available,
        conflictingAppointments,
        excludeAppointmentId: excludeAppointmentId || "none",
      });

      return {
        success: true,
        available,
        conflictingAppointments,
      };
    } catch (error) {
      logger.error("Error checking availability", {
        error: error.message,
        startTime,
        endTime,
        excludeAppointmentId,
      });
      return {
        success: false,
        error: error.message,
        available: false,
        conflictingAppointments: 0,
      };
    }
  }
}

module.exports = AppointmentService;
