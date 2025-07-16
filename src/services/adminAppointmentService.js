// src/services/adminAppointmentService.js
const AppointmentService = require("./appointmentService");
const ClientService = require("./clientService");
const ServiceService = require("./serviceService");
const googleCalendarClient = require("../integrations/googleCalendarClient");
const DatabaseAdapter = require("../adapters/databaseAdapter");
const logger = require("../utils/logger");

class AdminAppointmentService {
  /**
   * Dashboard principal - Resumen del día
   */
  static async getDashboardSummary() {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];

      // Citas de hoy
      const todayAppointments = await AppointmentService.getTodayAppointments();

      // Próximas citas (próximos 7 días)
      const upcomingAppointments = await AppointmentService.getUpcomingAppointments(7);

      // Estadísticas generales
      const stats = await AdminAppointmentService.getAppointmentStats();

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
            appointments: todayAppointments.data || [],
            count: todayAppointments.count || 0,
          },
          upcoming: {
            appointments: upcomingAppointments.data || [],
            count: upcomingAppointments.count || 0,
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
   * Obtener estadísticas de citas
   */
  static async getAppointmentStats() {
    try {
      const today = new Date();
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

      // Citas por estado
      const statusStats = await AdminAppointmentService.getAppointmentsByStatus();

      // Citas del mes actual
      const { data: thisMonthAppointments } = await DatabaseAdapter.client
        .from("citas")
        .select("*")
        .gte("fecha_cita", thisMonth.toISOString())
        .lt("fecha_cita", nextMonth.toISOString());

      // Citas del mes pasado
      const { data: lastMonthAppointments } = await DatabaseAdapter.client
        .from("citas")
        .select("*")
        .gte("fecha_cita", lastMonth.toISOString())
        .lt("fecha_cita", thisMonth.toISOString());

      // Ingresos del mes
      const { data: monthlyRevenue } = await DatabaseAdapter.client
        .from("citas")
        .select(
          `
          servicios(precio)
        `,
        )
        .eq("estado", "completada")
        .gte("fecha_cita", thisMonth.toISOString())
        .lt("fecha_cita", nextMonth.toISOString());

      const totalRevenue =
        monthlyRevenue?.reduce((sum, appointment) => {
          return sum + (appointment.servicios?.precio || 0);
        }, 0) || 0;

      return {
        success: true,
        data: {
          byStatus: statusStats.data || {},
          thisMonth: {
            total: thisMonthAppointments?.length || 0,
            revenue: totalRevenue,
          },
          lastMonth: {
            total: lastMonthAppointments?.length || 0,
          },
          growth: {
            appointments: AdminAppointmentService.calculateGrowth(
              lastMonthAppointments?.length || 0,
              thisMonthAppointments?.length || 0,
            ),
          },
        },
      };
    } catch (error) {
      logger.error("Error getting appointment stats:", error);
      return {
        success: false,
        error: error.message,
        data: {},
      };
    }
  }

  /**
   * Obtener citas por estado
   */
  static async getAppointmentsByStatus() {
    try {
      const { data: appointments, error } = await DatabaseAdapter.client
        .from("citas")
        .select("estado");

      if (error) throw error;

      const statusCount = (appointments || []).reduce((acc, appointment) => {
        const status = appointment.estado || "unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      return {
        success: true,
        data: statusCount,
      };
    } catch (error) {
      logger.error("Error getting appointments by status:", error);
      return {
        success: false,
        error: error.message,
        data: {},
      };
    }
  }

  /**
   * Buscar citas con filtros avanzados
   */
  static async searchAppointments(filters = {}) {
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

      let query = DatabaseAdapter.client.from("citas").select(`
          *,
          clientes(nombre, apellido, telefono_movil, email),
          servicios(nombre, precio, duracion)
        `);

      // Aplicar filtros
      if (startDate) {
        query = query.gte("fecha_cita", startDate);
      }

      if (endDate) {
        query = query.lte("fecha_cita", endDate);
      }

      if (status) {
        query = query.eq("estado", status);
      }

      // Paginación
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      // Ordenar por fecha
      query = query.order("fecha_cita", { ascending: false });

      const { data: appointments, error, count } = await query;

      if (error) throw error;

      // Filtrar por nombre de cliente o servicio si se especifica
      let filteredAppointments = appointments || [];

      if (clientName) {
        const searchTerm = clientName.toLowerCase();
        filteredAppointments = filteredAppointments.filter((appointment) => {
          const fullName = `${appointment.clientes?.nombre || ""} ${
            appointment.clientes?.apellido || ""
          }`.toLowerCase();
          return fullName.includes(searchTerm);
        });
      }

      if (serviceName) {
        const searchTerm = serviceName.toLowerCase();
        filteredAppointments = filteredAppointments.filter((appointment) => {
          return appointment.servicios?.nombre?.toLowerCase().includes(searchTerm);
        });
      }

      // Transformar datos
      const transformedAppointments = filteredAppointments.map((appointment) => ({
        id: appointment.id_cita,
        scheduled_at: appointment.fecha_cita,
        status: appointment.estado,
        notes: appointment.notas,
        calendar_event_id: appointment.calendar_event_id,
        meeting_url: appointment.meeting_url,
        client: {
          id: appointment.clientes?.id_cliente,
          name: `${appointment.clientes?.nombre || ""} ${
            appointment.clientes?.apellido || ""
          }`.trim(),
          phone: appointment.clientes?.telefono_movil,
          email: appointment.clientes?.email,
        },
        service: {
          id: appointment.servicios?.id_servicio,
          name: appointment.servicios?.nombre,
          price: appointment.servicios?.precio,
          duration: appointment.servicios?.duracion,
        },
        created_at: appointment.created_at,
        updated_at: appointment.updated_at,
      }));

      return {
        success: true,
        data: transformedAppointments,
        pagination: {
          page: page,
          limit: limit,
          total: count || transformedAppointments.length,
          pages: Math.ceil((count || transformedAppointments.length) / limit),
        },
      };
    } catch (error) {
      logger.error("Error searching appointments:", error);
      return {
        success: false,
        error: error.message,
        data: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 },
      };
    }
  }

  /**
   * Crear cita manual desde admin
   */
  static async createManualAppointment(appointmentData) {
    try {
      const {
        client_phone,
        client_email,
        client_name,
        service_id,
        scheduled_at,
        notes,
      } = appointmentData;

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
          " ",
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

      // Crear cita
      const newAppointmentData = {
        client_phone: clientResult.data.phone || client_email,
        service_id: service_id,
        scheduled_at: scheduled_at,
        status: "confirmada",
        notes: `${notes || ""} [Creada manualmente desde admin]`.trim(),
      };

      const appointmentResult = await AppointmentService.createAppointment(newAppointmentData);

      if (appointmentResult.success) {
        logger.info("Manual appointment created from admin:", {
          appointmentId: appointmentResult.data.id,
          clientName: client_name,
          serviceId: service_id,
          scheduledAt: scheduled_at,
        });
      }

      return appointmentResult;
    } catch (error) {
      logger.error("Error creating manual appointment:", error);
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
    return await AppointmentService.syncWithGoogleCalendar();
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
   * Exportar citas a CSV
   */
  static async exportAppointmentsToCSV(filters = {}) {
    try {
      const searchResult = await AdminAppointmentService.searchAppointments({
        ...filters,
        limit: 1000, // Exportar hasta 1000 registros
      });

      if (!searchResult.success) {
        throw new Error(searchResult.error);
      }

      const appointments = searchResult.data;

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
        ...appointments.map((appointment) =>
          [
            appointment.id,
            appointment.scheduled_at,
            `"${appointment.client.name}"`,
            appointment.client.phone || "",
            appointment.client.email || "",
            `"${appointment.service.name}"`,
            appointment.service.price || 0,
            appointment.service.duration || 0,
            appointment.status,
            `"${appointment.notes || ""}"`,
            appointment.meeting_url || "",
            appointment.created_at,
          ].join(","),
        ),
      ];

      const csvContent = csvRows.join("\n");

      return {
        success: true,
        data: csvContent,
        filename: `citas_${new Date().toISOString().split("T")[0]}.csv`,
      };
    } catch (error) {
      logger.error("Error exporting appointments to CSV:", error);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }
}

module.exports = AdminAppointmentService;
