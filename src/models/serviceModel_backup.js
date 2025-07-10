// src/models/serviceModel.js
const supabase = require("../integrations/supabaseClient");

class ServiceModel {
  constructor() {
    this.tableName = "services";
  }

  // Crear un nuevo servicio
  async create(serviceData) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .insert([
          {
            name: serviceData.name,
            description: serviceData.description,
            price: serviceData.price,
            duration: serviceData.duration,
            category: serviceData.category || "general",
            is_active:
              serviceData.is_active !== undefined
                ? serviceData.is_active
                : true,
            max_advance_booking_days:
              serviceData.max_advance_booking_days || 30,
            min_advance_booking_hours:
              serviceData.min_advance_booking_hours || 24,
            cancellation_policy_hours:
              serviceData.cancellation_policy_hours || 24,
            requires_deposit: serviceData.requires_deposit || false,
            deposit_amount: serviceData.deposit_amount || 0,
            available_days: serviceData.available_days || [
              "monday",
              "tuesday",
              "wednesday",
              "thursday",
              "friday",
            ],
            available_time_slots: serviceData.available_time_slots || [],
            metadata: serviceData.metadata || {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener servicio por ID
  async getById(serviceId) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("id", serviceId)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener servicios activos
  async getActiveServices() {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener servicios por categoría
  async getByCategory(category) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("category", category)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener todos los servicios
  async getAll(includeInactive = false) {
    try {
      let query = supabase.from(this.tableName).select("*");

      if (!includeInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query.order("name");

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Actualizar servicio
  async update(serviceId, updateData) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", serviceId)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Activar/Desactivar servicio
  async toggleActiveStatus(serviceId, isActive) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", serviceId)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Eliminar servicio
  async delete(serviceId) {
    try {
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq("id", serviceId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Verificar si un servicio tiene reservas activas
  async hasActiveBookings(serviceId) {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("id")
        .eq("service_id", serviceId)
        .in("status", ["pending", "confirmed"])
        .gte("booking_date", new Date().toISOString().split("T")[0]);

      if (error) throw error;
      return { success: true, hasActiveBookings: data.length > 0 };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener estadísticas del servicio
  async getServiceStats(serviceId, startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("status, total_price, booking_date")
        .eq("service_id", serviceId)
        .gte("booking_date", startDate)
        .lte("booking_date", endDate);

      if (error) throw error;

      const stats = {
        totalBookings: data.length,
        confirmedBookings: data.filter((b) => b.status === "confirmed").length,
        cancelledBookings: data.filter((b) => b.status === "cancelled").length,
        totalRevenue: data
          .filter((b) => b.status === "confirmed")
          .reduce((sum, b) => sum + (b.total_price || 0), 0),
      };

      return { success: true, data: stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ServiceModel();
