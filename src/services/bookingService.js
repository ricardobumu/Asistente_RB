// src/services/bookingService.js
const DatabaseAdapter = require("../adapters/databaseAdapter");
const ClientService = require("./clientService");
const ServiceService = require("./serviceService");
const googleCalendarClient = require("../integrations/googleCalendarClient");
const calendlyClient = require("../integrations/calendlyClient");
const logger = require("../utils/logger");
const {
  validateBookingData,
  sanitizeBookingData,
} = require("../utils/validators");

class BookingService {
  /**
   * Generar número de reserva único
   */
  static async generateBookingNumber() {
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
   * Crear nueva reserva con validaciones completas
   */
  static async createBooking(bookingData) {
    try {
      // Validar datos de entrada
      const validation = validateBookingData(bookingData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      // Sanitizar datos
      const sanitizedData = sanitizeBookingData(bookingData);

      // Obtener cliente (por ID o crear si viene por teléfono)
      let client = null;
      if (sanitizedData.client_id) {
        const clientResult = await ClientService.findById(
          sanitizedData.client_id,
        );
        if (!clientResult.success || !clientResult.data) {
          throw new Error("Cliente no encontrado");
        }
        client = clientResult.data;
      } else if (sanitizedData.client_phone) {
        // Buscar por teléfono o crear cliente temporal
        const clientResult = await ClientService.findByPhone(
          sanitizedData.client_phone,
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
        sanitizedData.service_id,
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
            startDate.getTime() + (service.duration_minutes || 60) * 60000,
          );

      // Validar que la fecha no sea en el pasado
      if (startDate < new Date()) {
        throw new Error("No se pueden crear reservas en fechas pasadas");
      }

      // Verificar disponibilidad en Google Calendar
      if (googleCalendarClient.isInitialized()) {
        const availability = await googleCalendarClient.checkAvailability(
          startDate.toISOString(),
          endDate.toISOString(),
        );

        if (!availability.available) {
          throw new Error("El horario solicitado no está disponible");
        }
      }

      // Generar número de reserva único
      const bookingNumber = await this.generateBookingNumber();

      // Generar código de confirmación
      const confirmationCode = this.generateConfirmationCode();

      // Preparar datos para insertar
      const bookingToCreate = {
        booking_number: bookingNumber,
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

      // Crear la reserva en la base de datos
      const { data, error } = await DatabaseAdapter.insert(
        "bookings",
        bookingToCreate,
      );

      if (error) throw error;

      const booking = data?.[0];
      if (!booking) throw new Error("Error al crear la reserva");

      // Crear evento en Google Calendar
      let calendarEventId = null;
      let meetLink = null;

      if (googleCalendarClient.isInitialized()) {
        const eventData = {
          title: `${service.name} - ${client.first_name} ${client.last_name}`,
          description: `
Reserva #${bookingNumber}
Servicio: ${service.name}
Cliente: ${client.first_name} ${client.last_name}
Teléfono: ${client.phone}
Email: ${client.email || "No proporcionado"}
Precio: €${booking.final_price}
Duración: ${service.duration_minutes} minutos
Código: ${confirmationCode}

${service.description || ""}

${booking.notes ? `Notas: ${booking.notes}` : ""}
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

          // Actualizar la reserva con el ID del evento de calendario
          await DatabaseAdapter.update(
            "bookings",
            {
              external_id: calendarEventId,
              external_platform: "google_calendar",
              metadata: {
                ...booking.metadata,
                calendar_event_id: calendarEventId,
                meet_link: meetLink,
              },
            },
            { id: booking.id },
          );

          logger.info("Booking created with Google Calendar event", {
            bookingId: booking.id,
            bookingNumber: bookingNumber,
            calendarEventId: calendarEventId,
            clientName: `${client.first_name} ${client.last_name}`,
            serviceName: service.name,
            startTime: startDate.toISOString(),
          });
        } else {
          logger.warn("Could not create Google Calendar event", {
            error: calendarResult.error,
            bookingId: booking.id,
          });
        }
      }

      // Crear evento en Calendly si está configurado
      if (calendlyClient.isInitialized()) {
        try {
          const calendlyResult = await calendlyClient.createBooking({
            event_type_uri: service.calendly_event_type || null,
            start_time: startDate.toISOString(),
            invitee_name: `${client.first_name} ${client.last_name}`,
            invitee_email: client.email,
            invitee_phone: client.phone,
            additional_info: booking.notes,
          });

          if (calendlyResult.success) {
            await DatabaseAdapter.update(
              "bookings",
              {
                metadata: {
                  ...booking.metadata,
                  calendly_booking: calendlyResult.data,
                },
              },
              { id: booking.id },
            );
          }
        } catch (calendlyError) {
          logger.warn("Calendly booking creation failed", {
            error: calendlyError.message,
            bookingId: booking.id,
          });
        }
      }

      logger.info("Booking created successfully", {
        bookingId: booking.id,
        bookingNumber: bookingNumber,
        clientId: client.id,
        serviceId: service.id,
        startTime: startDate.toISOString(),
        status: booking.status,
      });

      return {
        success: true,
        data: {
          ...booking,
          client: client,
          service: service,
          calendar_event_id: calendarEventId,
          meet_link: meetLink,
        },
        message: "Booking created successfully",
      };
    } catch (error) {
      logger.error("Error creating booking", {
        error: error.message,
        bookingData: {
          client_id: bookingData?.client_id,
          service_id: bookingData?.service_id,
          start_time: bookingData?.start_time,
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
   * Obtener reservas de un cliente con información completa
   */
  static async getClientBookings(clientId, options = {}) {
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
        FROM bookings b
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

      // Filtrar reservas expiradas
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

      const bookings = result.data || [];

      logger.info("Client bookings retrieved", {
        clientId,
        count: bookings.length,
        status: status || "all",
        includeExpired,
      });

      return {
        success: true,
        data: bookings,
        count: bookings.length,
      };
    } catch (error) {
      logger.error("Error getting client bookings", {
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
   * Obtener reservas por estado con información completa
   */
  static async getBookingsByStatus(status, options = {}) {
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
        FROM bookings b
        LEFT JOIN clients c ON b.client_id = c.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.status = $1
      `;

      const params = [status];
      let paramIndex = 2;

      // Filtrar reservas expiradas
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

      const bookings = result.data || [];

      logger.info("Bookings by status retrieved", {
        status,
        count: bookings.length,
        includeExpired,
      });

      return {
        success: true,
        data: bookings,
        count: bookings.length,
      };
    } catch (error) {
      logger.error("Error getting bookings by status", {
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
   * Actualizar estado de reserva con validaciones
   */
  static async updateBookingStatus(
    bookingId,
    status,
    notes = null,
    reason = null,
  ) {
    try {
      if (!bookingId) {
        throw new Error("Booking ID is required");
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

      // Verificar que la reserva existe
      const existingResult = await DatabaseAdapter.select("bookings", "*", {
        id: bookingId,
      });
      if (
        existingResult.error ||
        !existingResult.data ||
        existingResult.data.length === 0
      ) {
        throw new Error("Booking not found");
      }

      const existingBooking = existingResult.data[0];

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
        "bookings",
        updateData,
        { id: bookingId },
      );

      if (error) throw error;

      const updatedBooking = data?.[0] || null;

      logger.info("Booking status updated", {
        bookingId,
        oldStatus: existingBooking.status,
        newStatus: status,
        reason: reason || "none",
        notes: notes || "none",
      });

      return {
        success: true,
        data: updatedBooking,
        message: "Booking status updated successfully",
      };
    } catch (error) {
      logger.error("Error updating booking status", {
        error: error.message,
        bookingId,
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
   * Obtener reservas del día
   */
  static async getTodayBookings() {
    try {
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const query = `
        SELECT 
          b.*,
          c.first_name, c.last_name, c.email, c.phone,
          s.name as service_name, s.price as service_price, s.duration_minutes
        FROM bookings b
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

      const bookings = result.data || [];

      logger.info("Today's bookings retrieved", {
        date: today.toISOString().split("T")[0],
        count: bookings.length,
      });

      return {
        success: true,
        data: bookings,
        count: bookings.length,
      };
    } catch (error) {
      logger.error("Error getting today's bookings", { error: error.message });
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Obtener próximas reservas (siguientes N días)
   */
  static async getUpcomingBookings(days = 7) {
    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + days);

      const query = `
        SELECT 
          b.*,
          c.first_name, c.last_name, c.email, c.phone,
          s.name as service_name, s.price as service_price, s.duration_minutes
        FROM bookings b
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

      const bookings = result.data || [];

      logger.info("Upcoming bookings retrieved", {
        days,
        count: bookings.length,
        dateRange: {
          from: today.toISOString().split("T")[0],
          to: futureDate.toISOString().split("T")[0],
        },
      });

      return {
        success: true,
        data: bookings,
        count: bookings.length,
      };
    } catch (error) {
      logger.error("Error getting upcoming bookings", {
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
   * Cancelar reserva con sincronización completa
   */
  static async cancelBooking(bookingId, reason = null, cancelledBy = null) {
    try {
      if (!bookingId) {
        throw new Error("Booking ID is required");
      }

      // Obtener la reserva actual
      const { data: bookings, error } = await DatabaseAdapter.select(
        "bookings",
        "*",
        { id: bookingId },
      );

      if (error || !bookings || bookings.length === 0) {
        throw new Error("Booking not found");
      }

      const booking = bookings[0];

      // Verificar que se puede cancelar
      if (booking.status === "cancelled") {
        throw new Error("Booking is already cancelled");
      }

      if (booking.status === "completed") {
        throw new Error("Cannot cancel completed booking");
      }

      // Cancelar evento en Google Calendar si existe
      const calendarEventId =
        booking.external_id || booking.metadata?.calendar_event_id;
      if (calendarEventId && googleCalendarClient.isInitialized()) {
        const cancelResult = await googleCalendarClient.cancelEvent(
          calendarEventId,
          reason || "Booking cancelled",
        );

        if (!cancelResult.success) {
          logger.warn("Could not cancel Google Calendar event", {
            error: cancelResult.error,
            bookingId,
            calendarEventId,
          });
        } else {
          logger.info("Google Calendar event cancelled", {
            bookingId,
            calendarEventId,
          });
        }
      }

      // Actualizar estado en la base de datos
      const result = await this.updateBookingStatus(
        bookingId,
        "cancelled",
        `Cancelled by ${cancelledBy || "system"}`,
        reason,
      );

      if (result.success) {
        logger.info("Booking cancelled successfully", {
          bookingId,
          reason: reason || "no reason provided",
          cancelledBy: cancelledBy || "system",
        });
      }

      return result;
    } catch (error) {
      logger.error("Error cancelling booking", {
        error: error.message,
        bookingId,
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
   * Reprogramar reserva
   */
  static async rescheduleBooking(bookingId, newDateTime, reason = null) {
    try {
      // Obtener la reserva actual con datos del cliente y servicio
      const { data: bookings, error } = await DatabaseAdapter.client
        .from("reservas")
        .select(
          `
          *,
          clientes(nombre, apellido, telefono_movil, email),
          servicios(nombre, precio, duracion, descripcion)
        `,
        )
        .eq("id_reserva", bookingId)
        .single();

      if (error || !bookings) {
        throw new Error("Reserva no encontrada");
      }

      const booking = bookings;
      const client = booking.clientes;
      const service = booking.servicios;

      // Calcular nueva fecha de fin
      const newStartDate = new Date(newDateTime);
      const newEndDate = new Date(
        newStartDate.getTime() + service.duracion * 60000,
      );

      // Verificar disponibilidad en el nuevo horario
      if (googleCalendarClient.isInitialized()) {
        const availability = await googleCalendarClient.checkAvailability(
          newStartDate.toISOString(),
          newEndDate.toISOString(),
        );

        if (!availability.available) {
          throw new Error("El nuevo horario solicitado no está disponible");
        }
      }

      // Actualizar evento en Google Calendar
      if (booking.calendar_event_id && googleCalendarClient.isInitialized()) {
        const updateData = {
          start: {
            dateTime: newStartDate.toISOString(),
            timeZone: "Europe/Madrid",
          },
          end: {
            dateTime: newEndDate.toISOString(),
            timeZone: "Europe/Madrid",
          },
          description: `${booking.descripcion || ""}

${reason ? `Reprogramada: ${reason}` : "Cita reprogramada"}`,
        };

        const updateResult = await googleCalendarClient.updateEvent(
          booking.calendar_event_id,
          updateData,
        );

        if (!updateResult.success) {
          logger.warn(
            "No se pudo actualizar evento en Google Calendar:",
            updateResult.error,
          );
        }
      }

      // Actualizar en la base de datos
      const notes = reason ? `Reprogramada: ${reason}` : "Reprogramada";
      const { data, error: updateError } = await DatabaseAdapter.update(
        "bookings",
        {
          scheduled_at: newDateTime,
          notes: notes,
          status: "confirmada",
        },
        { id: bookingId },
      );

      if (updateError) throw updateError;

      logger.info("Reserva reprogramada exitosamente:", {
        bookingId: bookingId,
        oldDateTime: booking.fecha_reserva,
        newDateTime: newDateTime,
        reason: reason,
      });

      return {
        success: true,
        data: data?.[0] || null,
        message: "Reserva reprogramada exitosamente",
      };
    } catch (error) {
      logger.error("Error rescheduling booking:", error);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Sincronizar reservas con Google Calendar
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

      // Obtener reservas sin evento de calendario
      const { data: bookings, error } = await DatabaseAdapter.client
        .from("reservas")
        .select(
          `
          *,
          clientes(nombre, apellido, telefono_movil, email),
          servicios(nombre, precio, duracion, descripcion)
        `,
        )
        .is("calendar_event_id", null)
        .eq("estado", "confirmada")
        .gte("fecha_reserva", new Date().toISOString());

      if (error) throw error;

      let synced = 0;
      let errors = 0;

      for (const booking of bookings || []) {
        try {
          const client = booking.clientes;
          const service = booking.servicios;

          const startDate = new Date(booking.fecha_reserva);
          const endDate = new Date(
            startDate.getTime() + service.duracion * 60000,
          );

          const eventData = {
            title: `${service.nombre} - ${client.nombre} ${client.apellido}`,
            description: `
Servicio: ${service.nombre}
Cliente: ${client.nombre} ${client.apellido}
Teléfono: ${client.telefono_movil}
Email: ${client.email || "No proporcionado"}
Precio: €${service.precio}
Duración: ${service.duracion} minutos

${service.descripcion || ""}
            `.trim(),
            startDateTime: startDate.toISOString(),
            endDateTime: endDate.toISOString(),
            attendeeEmail: client.email,
            attendeeName: `${client.nombre} ${client.apellido}`,
            location: "Consulta Virtual",
          };

          const calendarResult =
            await googleCalendarClient.createEvent(eventData);

          if (calendarResult.success) {
            // Actualizar reserva con ID del evento
            await DatabaseAdapter.update(
              "bookings",
              {
                calendar_event_id: calendarResult.data.id,
                meeting_url: calendarResult.data.meetLink,
              },
              { id: booking.id_reserva },
            );
            synced++;
          } else {
            errors++;
            logger.warn(
              `Error sincronizando reserva ${booking.id_reserva}:`,
              calendarResult.error,
            );
          }
        } catch (syncError) {
          errors++;
          logger.error(
            `Error sincronizando reserva ${booking.id_reserva}:`,
            syncError,
          );
        }
      }

      logger.info("Sincronización con Google Calendar completada:", {
        total: bookings?.length || 0,
        synced: synced,
        errors: errors,
      });

      return {
        success: true,
        data: {
          total: bookings?.length || 0,
          synced: synced,
          errors: errors,
        },
      };
    } catch (error) {
      logger.error("Error syncing with Google Calendar:", error);
      return {
        success: false,
        error: error.message,
        data: { synced: 0, errors: 0 },
      };
    }
  }

  /**
   * Buscar reserva por ID
   */
  static async findById(bookingId) {
    try {
      if (!bookingId) {
        throw new Error("Booking ID is required");
      }

      const query = `
        SELECT 
          b.*,
          c.first_name, c.last_name, c.email, c.phone,
          s.name as service_name, s.price as service_price, s.duration_minutes
        FROM bookings b
        LEFT JOIN clients c ON b.client_id = c.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.id = $1
      `;

      const result = await DatabaseAdapter.query(query, [bookingId]);

      if (result.error) throw new Error(result.error);

      const booking = result.data?.[0] || null;

      logger.info("Booking found by ID", {
        bookingId,
        found: !!booking,
        bookingNumber: booking?.booking_number,
      });

      return {
        success: true,
        data: booking,
      };
    } catch (error) {
      logger.error("Error finding booking by ID", {
        error: error.message,
        bookingId,
      });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Buscar reserva por número de reserva
   */
  static async findByBookingNumber(bookingNumber) {
    try {
      if (!bookingNumber) {
        throw new Error("Booking number is required");
      }

      const query = `
        SELECT 
          b.*,
          c.first_name, c.last_name, c.email, c.phone,
          s.name as service_name, s.price as service_price, s.duration_minutes
        FROM bookings b
        LEFT JOIN clients c ON b.client_id = c.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.booking_number = $1
      `;

      const result = await DatabaseAdapter.query(query, [bookingNumber]);

      if (result.error) throw new Error(result.error);

      const booking = result.data?.[0] || null;

      logger.info("Booking found by number", {
        bookingNumber,
        found: !!booking,
        bookingId: booking?.id,
      });

      return {
        success: true,
        data: booking,
      };
    } catch (error) {
      logger.error("Error finding booking by number", {
        error: error.message,
        bookingNumber,
      });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Obtener estadísticas de reservas
   */
  static async getBookingStats(dateRange = null) {
    try {
      let dateFilter = "";
      const params = [];

      if (dateRange && dateRange.from && dateRange.to) {
        dateFilter = "WHERE b.start_time >= $1 AND b.start_time <= $2";
        params.push(dateRange.from, dateRange.to);
      }

      const query = `
        SELECT 
          COUNT(*) as total_bookings,
          COUNT(CASE WHEN b.status = 'pending' THEN 1 END) as pending_bookings,
          COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END) as confirmed_bookings,
          COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END) as cancelled_bookings,
          COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
          COUNT(CASE WHEN b.status = 'no_show' THEN 1 END) as no_show_bookings,
          AVG(b.final_price) as average_price,
          SUM(CASE WHEN b.status = 'completed' THEN b.final_price ELSE 0 END) as total_revenue
        FROM bookings b
        ${dateFilter}
      `;

      const result = await DatabaseAdapter.query(query, params);

      if (result.error) throw new Error(result.error);

      const stats = result.data[0] || {};

      logger.info("Booking stats retrieved", {
        dateRange: dateRange || "all time",
        totalBookings: parseInt(stats.total_bookings) || 0,
      });

      return {
        success: true,
        data: {
          totalBookings: parseInt(stats.total_bookings) || 0,
          pendingBookings: parseInt(stats.pending_bookings) || 0,
          confirmedBookings: parseInt(stats.confirmed_bookings) || 0,
          cancelledBookings: parseInt(stats.cancelled_bookings) || 0,
          completedBookings: parseInt(stats.completed_bookings) || 0,
          noShowBookings: parseInt(stats.no_show_bookings) || 0,
          averagePrice: parseFloat(stats.average_price) || 0,
          totalRevenue: parseFloat(stats.total_revenue) || 0,
          cancellationRate:
            stats.total_bookings > 0
              ? (
                  (parseInt(stats.cancelled_bookings) /
                    parseInt(stats.total_bookings)) *
                  100
                ).toFixed(2)
              : 0,
          completionRate:
            stats.total_bookings > 0
              ? (
                  (parseInt(stats.completed_bookings) /
                    parseInt(stats.total_bookings)) *
                  100
                ).toFixed(2)
              : 0,
        },
      };
    } catch (error) {
      logger.error("Error getting booking stats", {
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
  static async checkAvailability(startTime, endTime, excludeBookingId = null) {
    try {
      if (!startTime || !endTime) {
        throw new Error("Start time and end time are required");
      }

      let query = `
        SELECT COUNT(*) as conflicting_bookings
        FROM bookings
        WHERE status IN ('pending', 'confirmed')
        AND (
          (start_time <= $1 AND end_time > $1) OR
          (start_time < $2 AND end_time >= $2) OR
          (start_time >= $1 AND end_time <= $2)
        )
      `;

      const params = [startTime, endTime];

      if (excludeBookingId) {
        query += " AND id != $3";
        params.push(excludeBookingId);
      }

      const result = await DatabaseAdapter.query(query, params);

      if (result.error) throw new Error(result.error);

      const conflictingBookings =
        parseInt(result.data[0]?.conflicting_bookings) || 0;
      const available = conflictingBookings === 0;

      logger.info("Availability checked", {
        startTime,
        endTime,
        available,
        conflictingBookings,
        excludeBookingId: excludeBookingId || "none",
      });

      return {
        success: true,
        available,
        conflictingBookings,
      };
    } catch (error) {
      logger.error("Error checking availability", {
        error: error.message,
        startTime,
        endTime,
        excludeBookingId,
      });
      return {
        success: false,
        error: error.message,
        available: false,
        conflictingBookings: 0,
      };
    }
  }
}

module.exports = BookingService;
