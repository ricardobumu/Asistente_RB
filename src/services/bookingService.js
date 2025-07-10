// src/services/bookingService.js
const DatabaseAdapter = require("../adapters/databaseAdapter");
const ClientService = require("./clientService");
const ServiceService = require("./serviceService");
const googleCalendarClient = require("../integrations/googleCalendarClient");
const calendlyClient = require("../integrations/calendlyClient");
const logger = require("../utils/logger");

class BookingService {
  /**
   * Crear nueva reserva con integración completa
   */
  static async createBooking(bookingData) {
    try {
      // Validar que el cliente existe
      const clientResult = await ClientService.findByPhone(
        bookingData.client_phone
      );
      if (!clientResult.success || !clientResult.data) {
        throw new Error("Cliente no encontrado");
      }

      // Validar que el servicio existe
      const serviceResult = await ServiceService.getServiceById(
        bookingData.service_id
      );
      if (!serviceResult.success || !serviceResult.data) {
        throw new Error("Servicio no encontrado");
      }

      const client = clientResult.data;
      const service = serviceResult.data;

      // Calcular fecha de fin basada en la duración del servicio
      const startDate = new Date(bookingData.scheduled_at);
      const endDate = new Date(
        startDate.getTime() + service.duration_minutes * 60000
      );

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

      // Crear la reserva en la base de datos
      const { data, error } = await DatabaseAdapter.insert("bookings", {
        client_id: client.id,
        service_id: bookingData.service_id,
        scheduled_at: bookingData.scheduled_at,
        status: bookingData.status || "confirmada",
        booking_url: bookingData.booking_url || null,
        notes: bookingData.notes || null,
      });

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
Servicio: ${service.name}
Cliente: ${client.first_name} ${client.last_name}
Teléfono: ${client.phone}
Email: ${client.email || "No proporcionado"}
Precio: €${service.price}
Duración: ${service.duration_minutes} minutos

${service.description || ""}

${bookingData.notes ? `Notas: ${bookingData.notes}` : ""}
          `.trim(),
          startDateTime: startDate.toISOString(),
          endDateTime: endDate.toISOString(),
          attendeeEmail: client.email,
          attendeeName: `${client.first_name} ${client.last_name}`,
          location: "Consulta Virtual",
        };

        const calendarResult = await googleCalendarClient.createEvent(
          eventData
        );

        if (calendarResult.success) {
          calendarEventId = calendarResult.data.id;
          meetLink = calendarResult.data.meetLink;

          // Actualizar la reserva con el ID del evento de calendario
          await DatabaseAdapter.update(
            "bookings",
            {
              calendar_event_id: calendarEventId,
              meeting_url: meetLink,
            },
            { id: booking.id }
          );

          logger.info("Reserva creada con evento de Google Calendar:", {
            bookingId: booking.id,
            calendarEventId: calendarEventId,
            clientName: `${client.first_name} ${client.last_name}`,
            serviceName: service.name,
            scheduledAt: bookingData.scheduled_at,
          });
        } else {
          logger.warn(
            "No se pudo crear evento en Google Calendar:",
            calendarResult.error
          );
        }
      }

      return {
        success: true,
        data: {
          ...booking,
          calendar_event_id: calendarEventId,
          meeting_url: meetLink,
          client: client,
          service: service,
        },
      };
    } catch (error) {
      logger.error("Error creating booking:", error);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Obtener reservas de un cliente
   */
  static async getClientBookings(clientId) {
    try {
      const { data, error } = await DatabaseAdapter.select("bookings", "*", {
        client_id: clientId,
      });

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        count: data?.length || 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Obtener reservas por estado
   */
  static async getBookingsByStatus(status) {
    try {
      const { data, error } = await DatabaseAdapter.select("bookings", "*", {
        status,
      });

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        count: data?.length || 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Actualizar estado de reserva
   */
  static async updateBookingStatus(bookingId, status, notes = null) {
    try {
      const updateData = { status };
      if (notes) updateData.notes = notes;

      const { data, error } = await DatabaseAdapter.update(
        "bookings",
        updateData,
        { id: bookingId }
      );

      if (error) throw error;

      return {
        success: true,
        data: data?.[0] || null,
      };
    } catch (error) {
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
      const today = new Date().toISOString().split("T")[0];

      // Usar consulta directa para filtrar por fecha
      const { data, error } = await DatabaseAdapter.client
        .from("reservas")
        .select(
          `
          *,
          clientes(nombre, apellido, telefono_movil, email),
          servicios(nombre, precio, duracion)
        `
        )
        .gte("fecha_reserva", `${today}T00:00:00`)
        .lt("fecha_reserva", `${today}T23:59:59`)
        .order("fecha_reserva", { ascending: true });

      if (error) throw error;

      // Transformar datos para el formato esperado
      const transformedData =
        data?.map((booking) => ({
          id: booking.id_reserva,
          scheduled_at: booking.fecha_reserva,
          status: booking.estado,
          notes: booking.notas,
          client: {
            id: booking.clientes?.id_cliente,
            first_name: booking.clientes?.nombre,
            last_name: booking.clientes?.apellido,
            phone: booking.clientes?.telefono_movil,
            email: booking.clientes?.email,
          },
          service: {
            id: booking.servicios?.id_servicio,
            name: booking.servicios?.nombre,
            price: booking.servicios?.precio,
            duration_minutes: booking.servicios?.duracion,
          },
        })) || [];

      return {
        success: true,
        data: transformedData,
        count: transformedData.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Obtener próximas reservas (siguientes 7 días)
   */
  static async getUpcomingBookings(days = 7) {
    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + days);

      const { data, error } = await DatabaseAdapter.client
        .from("reservas")
        .select(
          `
          *,
          clientes(nombre, apellido, telefono_movil, email),
          servicios(nombre, precio, duracion)
        `
        )
        .gte("fecha_reserva", today.toISOString())
        .lte("fecha_reserva", futureDate.toISOString())
        .order("fecha_reserva", { ascending: true });

      if (error) throw error;

      // Transformar datos
      const transformedData =
        data?.map((booking) => ({
          id: booking.id_reserva,
          scheduled_at: booking.fecha_reserva,
          status: booking.estado,
          notes: booking.notas,
          client: {
            id: booking.clientes?.id_cliente,
            first_name: booking.clientes?.nombre,
            last_name: booking.clientes?.apellido,
            phone: booking.clientes?.telefono_movil,
            email: booking.clientes?.email,
          },
          service: {
            id: booking.servicios?.id_servicio,
            name: booking.servicios?.nombre,
            price: booking.servicios?.precio,
            duration_minutes: booking.servicios?.duracion,
          },
        })) || [];

      return {
        success: true,
        data: transformedData,
        count: transformedData.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Cancelar reserva con sincronización de Google Calendar
   */
  static async cancelBooking(bookingId, reason = null) {
    try {
      // Obtener la reserva actual
      const { data: bookings, error } = await DatabaseAdapter.select(
        "bookings",
        "*",
        {
          id: bookingId,
        }
      );

      if (error || !bookings || bookings.length === 0) {
        throw new Error("Reserva no encontrada");
      }

      const booking = bookings[0];
      const notes = reason ? `Cancelada: ${reason}` : "Cancelada";

      // Cancelar evento en Google Calendar si existe
      if (booking.calendar_event_id && googleCalendarClient.isInitialized()) {
        const cancelResult = await googleCalendarClient.cancelEvent(
          booking.calendar_event_id,
          reason || "Cita cancelada por el cliente"
        );

        if (!cancelResult.success) {
          logger.warn(
            "No se pudo cancelar evento en Google Calendar:",
            cancelResult.error
          );
        } else {
          logger.info("Evento cancelado en Google Calendar:", {
            bookingId: bookingId,
            calendarEventId: booking.calendar_event_id,
          });
        }
      }

      // Actualizar estado en la base de datos
      const result = await this.updateBookingStatus(
        bookingId,
        "cancelada",
        notes
      );

      return result;
    } catch (error) {
      logger.error("Error cancelling booking:", error);
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
        `
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
        newStartDate.getTime() + service.duracion * 60000
      );

      // Verificar disponibilidad en el nuevo horario
      if (googleCalendarClient.isInitialized()) {
        const availability = await googleCalendarClient.checkAvailability(
          newStartDate.toISOString(),
          newEndDate.toISOString()
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
          updateData
        );

        if (!updateResult.success) {
          logger.warn(
            "No se pudo actualizar evento en Google Calendar:",
            updateResult.error
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
        { id: bookingId }
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
        `
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
            startDate.getTime() + service.duracion * 60000
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

          const calendarResult = await googleCalendarClient.createEvent(
            eventData
          );

          if (calendarResult.success) {
            // Actualizar reserva con ID del evento
            await DatabaseAdapter.update(
              "bookings",
              {
                calendar_event_id: calendarResult.data.id,
                meeting_url: calendarResult.data.meetLink,
              },
              { id: booking.id_reserva }
            );
            synced++;
          } else {
            errors++;
            logger.warn(
              `Error sincronizando reserva ${booking.id_reserva}:`,
              calendarResult.error
            );
          }
        } catch (syncError) {
          errors++;
          logger.error(
            `Error sincronizando reserva ${booking.id_reserva}:`,
            syncError
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
}

module.exports = BookingService;
