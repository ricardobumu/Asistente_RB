// src/services/adminBookingService.js
const AppointmentService = require("./appointmentService");
const ClientService = require("./clientService");
const ServiceService = require("./serviceService");
const googleCalendarClient = require("../integrations/googleCalendarClient");
const DatabaseAdapter = require("../adapters/databaseAdapter");
const logger = require("../utils/logger");

class AdminBookingService {
  /**
   * Dashboard principal - Resumen del día
   */
  static async getDashboardSummary() {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];

      // Reservas de hoy
      const todayBookings = await BookingService.getTodayBookings();

      // Próximas reservas (próximos 7 días)
      const upcomingBookings = await BookingService.getUpcomingBookings(7);

      // Estadísticas generales
      const stats = await AdminBookingService.getBookingStats();

      // Eventos de Google Calendar de hoy (si está configurado)
      let calendarEvents = { success: false, data: [] };
      if (googleCalendarClient.isInitialized()) {
        calendarEvents = await googleCalendarClient.getTodayEvents();
      }

      return {
        success: true,
        data: {
          today: {
            date: todayStr,
            bookings: todayBookings.data || [],
            count: todayBookings.count || 0,
          },
          upcoming: {
            bookings: upcomingBookings.data || [],
            count: upcomingBookings.count || 0,
          },
          calendar: {
            events: calendarEvents.data || [],
            count: calendarEvents.data?.length || 0,
            synchronized: googleCalendarClient.isInitialized(),
          },
          stats: stats.data || {},
        },
      };
    } catch (error) {
      logger.error("Error getting dashboard summary:", error);
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
  static async getBookingStats() {
    try {
      const today = new Date();
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

      // Reservas por estado
      const statusStats = await AdminBookingService.getBookingsByStatus();

      // Reservas del mes actual
      const { data: thisMonthBookings } = await DatabaseAdapter.client
        .from("reservas")
        .select("*")
        .gte("fecha_reserva", thisMonth.toISOString())
        .lt("fecha_reserva", nextMonth.toISOString());

      // Reservas del mes pasado
      const { data: lastMonthBookings } = await DatabaseAdapter.client
        .from("reservas")
        .select("*")
        .gte("fecha_reserva", lastMonth.toISOString())
        .lt("fecha_reserva", thisMonth.toISOString());

      // Ingresos del mes
      const { data: monthlyRevenue } = await DatabaseAdapter.client
        .from("reservas")
        .select(
          `
          servicios(precio)
        `
        )
        .eq("estado", "completada")
        .gte("fecha_reserva", thisMonth.toISOString())
        .lt("fecha_reserva", nextMonth.toISOString());

      const totalRevenue =
        monthlyRevenue?.reduce((sum, booking) => {
          return sum + (booking.servicios?.precio || 0);
        }, 0) || 0;

      return {
        success: true,
        data: {
          byStatus: statusStats.data || {},
          thisMonth: {
            total: thisMonthBookings?.length || 0,
            revenue: totalRevenue,
          },
          lastMonth: {
            total: lastMonthBookings?.length || 0,
          },
          growth: {
            bookings: AdminBookingService.calculateGrowth(
              lastMonthBookings?.length || 0,
              thisMonthBookings?.length || 0
            ),
          },
        },
      };
    } catch (error) {
      logger.error("Error getting booking stats:", error);
      return {
        success: false,
        error: error.message,
        data: {},
      };
    }
  }

  /**
   * Obtener reservas por estado
   */
  static async getBookingsByStatus() {
    try {
      const { data: bookings, error } = await DatabaseAdapter.client
        .from("reservas")
        .select("estado");

      if (error) throw error;

      const statusCount = (bookings || []).reduce((acc, booking) => {
        const status = booking.estado || "unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      return {
        success: true,
        data: statusCount,
      };
    } catch (error) {
      logger.error("Error getting bookings by status:", error);
      return {
        success: false,
        error: error.message,
        data: {},
      };
    }
  }

  /**
   * Buscar reservas con filtros avanzados
   */
  static async searchBookings(filters = {}) {
    try {
      const {
        startDate,
        endDate,
        status,
        clientName,
        serviceName,
        page = 1,
        limit = 20,
      } = filters;

      let query = DatabaseAdapter.client.from("reservas").select(`
          *,
          clientes(nombre, apellido, telefono_movil, email),
          servicios(nombre, precio, duracion)
        `);

      // Aplicar filtros
      if (startDate) {
        query = query.gte("fecha_reserva", startDate);
      }

      if (endDate) {
        query = query.lte("fecha_reserva", endDate);
      }

      if (status) {
        query = query.eq("estado", status);
      }

      // Paginación
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      // Ordenar por fecha
      query = query.order("fecha_reserva", { ascending: false });

      const { data: bookings, error, count } = await query;

      if (error) throw error;

      // Filtrar por nombre de cliente o servicio si se especifica
      let filteredBookings = bookings || [];

      if (clientName) {
        const searchTerm = clientName.toLowerCase();
        filteredBookings = filteredBookings.filter((booking) => {
          const fullName = `${booking.clientes?.nombre || ""} ${
            booking.clientes?.apellido || ""
          }`.toLowerCase();
          return fullName.includes(searchTerm);
        });
      }

      if (serviceName) {
        const searchTerm = serviceName.toLowerCase();
        filteredBookings = filteredBookings.filter((booking) => {
          return booking.servicios?.nombre?.toLowerCase().includes(searchTerm);
        });
      }

      // Transformar datos
      const transformedBookings = filteredBookings.map((booking) => ({
        id: booking.id_reserva,
        scheduled_at: booking.fecha_reserva,
        status: booking.estado,
        notes: booking.notas,
        calendar_event_id: booking.calendar_event_id,
        meeting_url: booking.meeting_url,
        client: {
          id: booking.clientes?.id_cliente,
          name: `${booking.clientes?.nombre || ""} ${
            booking.clientes?.apellido || ""
          }`.trim(),
          phone: booking.clientes?.telefono_movil,
          email: booking.clientes?.email,
        },
        service: {
          id: booking.servicios?.id_servicio,
          name: booking.servicios?.nombre,
          price: booking.servicios?.precio,
          duration: booking.servicios?.duracion,
        },
        created_at: booking.created_at,
        updated_at: booking.updated_at,
      }));

      return {
        success: true,
        data: transformedBookings,
        pagination: {
          page: page,
          limit: limit,
          total: count || transformedBookings.length,
          pages: Math.ceil((count || transformedBookings.length) / limit),
        },
      };
    } catch (error) {
      logger.error("Error searching bookings:", error);
      return {
        success: false,
        error: error.message,
        data: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 },
      };
    }
  }

  /**
   * Crear reserva manual desde admin
   */
  static async createManualBooking(bookingData) {
    try {
      const {
        client_phone,
        client_email,
        client_name,
        service_id,
        scheduled_at,
        notes,
      } = bookingData;

      // Buscar o crear cliente
      let clientResult;

      if (client_phone) {
        clientResult = await ClientService.findByPhone(client_phone);
      } else if (client_email) {
        clientResult = await ClientService.findByEmail(client_email);
      }

      if (!clientResult?.success || !clientResult.data) {
        // Crear nuevo cliente
        const [firstName, ...lastNameParts] = (client_name || "Cliente").split(
          " "
        );
        const lastName = lastNameParts.join(" ") || "";

        const newClientData = {
          first_name: firstName,
          last_name: lastName,
          phone: client_phone || "",
          email: client_email || "",
          source: "admin_manual",
        };

        clientResult = await ClientService.createClient(newClientData);

        if (!clientResult.success) {
          throw new Error(`Error creando cliente: ${clientResult.error}`);
        }
      }

      // Crear reserva
      const newBookingData = {
        client_phone: clientResult.data.phone || client_email,
        service_id: service_id,
        scheduled_at: scheduled_at,
        status: "confirmada",
        notes: `${notes || ""} [Creada manualmente desde admin]`.trim(),
      };

      const bookingResult = await BookingService.createBooking(newBookingData);

      if (bookingResult.success) {
        logger.info("Manual booking created from admin:", {
          bookingId: bookingResult.data.id,
          clientName: client_name,
          serviceId: service_id,
          scheduledAt: scheduled_at,
        });
      }

      return bookingResult;
    } catch (error) {
      logger.error("Error creating manual booking:", error);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Sincronizar con Google Calendar
   */
  static async syncWithGoogleCalendar() {
    return await BookingService.syncWithGoogleCalendar();
  }

  /**
   * Obtener eventos de Google Calendar
   */
  static async getGoogleCalendarEvents(days = 7) {
    try {
      if (!googleCalendarClient.isInitialized()) {
        return {
          success: false,
          error: "Google Calendar no está configurado",
          data: [],
        };
      }

      const result = await googleCalendarClient.getUpcomingEvents(days);

      if (result.success) {
        // Transformar eventos para el admin
        const transformedEvents = result.data.map((event) => ({
          id: event.id,
          title: event.summary,
          description: event.description,
          start: event.start?.dateTime || event.start?.date,
          end: event.end?.dateTime || event.end?.date,
          location: event.location,
          attendees:
            event.attendees?.map((a) => ({
              email: a.email,
              name: a.displayName,
              status: a.responseStatus,
            })) || [],
          meetLink: event.conferenceData?.entryPoints?.[0]?.uri,
          htmlLink: event.htmlLink,
        }));

        return {
          success: true,
          data: transformedEvents,
          count: transformedEvents.length,
        };
      }

      return result;
    } catch (error) {
      logger.error("Error getting Google Calendar events:", error);
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Calcular crecimiento porcentual
   */
  static calculateGrowth(previous, current) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  /**
   * Exportar reservas a CSV
   */
  static async exportBookingsToCSV(filters = {}) {
    try {
      const searchResult = await AdminBookingService.searchBookings({
        ...filters,
        limit: 1000, // Exportar hasta 1000 registros
      });

      if (!searchResult.success) {
        throw new Error(searchResult.error);
      }

      const bookings = searchResult.data;

      // Crear CSV
      const headers = [
        "ID",
        "Fecha y Hora",
        "Cliente",
        "Teléfono",
        "Email",
        "Servicio",
        "Precio",
        "Duración",
        "Estado",
        "Notas",
        "Enlace Meet",
        "Creado",
      ];

      const csvRows = [
        headers.join(","),
        ...bookings.map((booking) =>
          [
            booking.id,
            booking.scheduled_at,
            `"${booking.client.name}"`,
            booking.client.phone || "",
            booking.client.email || "",
            `"${booking.service.name}"`,
            booking.service.price || 0,
            booking.service.duration || 0,
            booking.status,
            `"${booking.notes || ""}"`,
            booking.meeting_url || "",
            booking.created_at,
          ].join(",")
        ),
      ];

      const csvContent = csvRows.join("\n");

      return {
        success: true,
        data: csvContent,
        filename: `reservas_${new Date().toISOString().split("T")[0]}.csv`,
      };
    } catch (error) {
      logger.error("Error exporting bookings to CSV:", error);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }
}

module.exports = AdminBookingService;
