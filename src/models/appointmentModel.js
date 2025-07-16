// src/models/appointmentModel.js
const supabase = require("../integrations/supabaseClient");
const logger = require("../utils/logger");

class AppointmentModel {
  constructor() {
    // La tabla ahora se llama 'appointments'
    this.tableName = "appointments";
  }

  /**
   * Crea una nueva cita (appointment) en la base de datos.
   * @param {object} appointmentData - Datos con nombres de columna estandarizados.
   * ej: { client_id, service_id, scheduled_at, status, source, calendly_event_uri }
   */
  async create(appointmentData) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .insert([appointmentData])
        .select()
        .single(); // Devuelve el objeto creado, no un array

      if (error) {
        throw error;
      }

      logger.info("Cita creada con éxito en la base de datos", {
        appointmentId: data.id,
      });
      return { success: true, data };
    } catch (error) {
      logger.error("Error en AppointmentModel.create", {
        errorMessage: error.message,
        appointmentData,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Busca una cita por su ID.
   * @param {string} id - El UUID de la cita.
   */
  async findById(id) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        // 'PGRST116' es el código de Supabase para "cero filas encontradas"
        if (error.code === "PGRST116") {
          return { success: false, error: "Cita no encontrada" };
        }
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      logger.error(`Error en AppointmentModel.findById para el ID: ${id}`, {
        errorMessage: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Busca todas las citas de un cliente específico, uniendo datos de servicios y clientes.
   * @param {string} clientId - El UUID del cliente.
   */
  async findByClientId(clientId) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select(
          `
          *,
          services (name, price, duration),
          clients (full_name, phone)
        `
        )
        .eq("client_id", clientId)
        .order("scheduled_at", { ascending: false });

      if (error) {
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      logger.error(
        `Error en AppointmentModel.findByClientId para el cliente: ${clientId}`,
        { errorMessage: error.message }
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Busca una cita por su URI de Calendly para evitar duplicados
   * @param {string} calendlyUri - URI del evento de Calendly
   */
  async findByCalendlyUri(calendlyUri) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select(
          `
          *,
          services (name, price, duration),
          clients (full_name, phone, email)
        `
        )
        .eq("calendly_event_uri", calendlyUri)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return {
            success: false,
            error: "Cita no encontrada para este URI de Calendly",
          };
        }
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      logger.error(
        `Error en AppointmentModel.findByCalendlyUri para URI: ${calendlyUri}`,
        { errorMessage: error.message }
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Busca citas por fecha y servicio para verificar disponibilidad
   * @param {string} date - Fecha en formato ISO (YYYY-MM-DD)
   * @param {string} serviceId - ID del servicio
   */
  async findByDateAndService(date, serviceId) {
    try {
      // Crear rango de fecha completa (00:00:00 a 23:59:59)
      const startDate = `${date}T00:00:00.000Z`;
      const endDate = `${date}T23:59:59.999Z`;

      const { data, error } = await supabase
        .from(this.tableName)
        .select(
          `
          *,
          services (name, duration),
          clients (full_name, phone)
        `
        )
        .eq("service_id", serviceId)
        .gte("scheduled_at", startDate)
        .lte("scheduled_at", endDate)
        .in("status", ["confirmed", "scheduled"])
        .order("scheduled_at", { ascending: true });

      if (error) {
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      logger.error(
        `Error en AppointmentModel.findByDateAndService para fecha: ${date}, servicio: ${serviceId}`,
        { errorMessage: error.message }
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene citas próximas en un rango de fechas para notificaciones.
   * @param {string} fromDate - Fecha de inicio en formato ISO.
   * @param {string} toDate - Fecha de fin en formato ISO.
   */
  async getUpcoming(fromDate, toDate) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select(
          `
          *,
          services (name, price, duration),
          clients (full_name, phone, email)
        `
        )
        .gte("scheduled_at", fromDate)
        .lte("scheduled_at", toDate)
        .eq("status", "confirmed")
        .order("scheduled_at", { ascending: true });

      if (error) {
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      logger.error("Error en AppointmentModel.getUpcoming", {
        errorMessage: error.message,
        fromDate,
        toDate,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Actualiza el estado de una cita usando su URI de Calendly como identificador.
   * @param {string} calendlyUri - La URI única del evento de Calendly.
   * @param {string} newStatus - El nuevo estado (ej: 'cancelled').
   */
  async updateStatusByCalendlyUri(calendlyUri, newStatus) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("calendly_event_uri", calendlyUri)
        .select()
        .single(); // Esperamos actualizar solo una cita

      if (error) {
        throw error;
      }

      logger.info("Estado de la cita actualizado por URI de Calendly", {
        calendlyUri,
        newStatus,
      });
      return { success: true, data };
    } catch (error) {
      logger.error("Error en AppointmentModel.updateStatusByCalendlyUri", {
        errorMessage: error.message,
      });
      return { success: false, error: error.message };
    }
  }
}

module.exports = AppointmentModel;
