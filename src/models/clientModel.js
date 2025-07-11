// src/models/clientModel.js
const supabase = require("../integrations/supabaseClient");
const logger = require("../utils/logger");

class ClientModel {
  constructor() {
    this.tableName = "clientes"; // Tabla real en español

    logger.info("ClientModel inicializado", {
      table: this.tableName,
    });
  }

  // Crear un nuevo cliente
  async create(clientData) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .insert([
          {
            name: clientData.name,
            email: clientData.email,
            phone: clientData.phone,
            whatsapp_number: clientData.whatsapp_number || clientData.phone,
            preferred_contact_method:
              clientData.preferred_contact_method || "whatsapp",
            notes: clientData.notes || null,
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

  // Obtener cliente por ID
  async getById(clientId) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("id", clientId)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener cliente por email
  async getByEmail(email) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("email", email)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener cliente por teléfono
  async getByPhone(phone) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("phone", phone)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener todos los clientes
  async getAll(limit = 50, offset = 0) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Actualizar cliente
  async update(clientId, updateData) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", clientId)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Eliminar cliente
  async delete(clientId) {
    try {
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq("id", clientId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Buscar clientes por nombre
  async searchByName(searchTerm) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .ilike("name", `%${searchTerm}%`)
        .order("name");

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Búsqueda avanzada de clientes
  async advancedSearch(filters) {
    try {
      let query = supabase.from(this.tableName).select("*");

      if (filters.name) {
        query = query.ilike("name", `%${filters.name}%`);
      }
      if (filters.email) {
        query = query.ilike("email", `%${filters.email}%`);
      }
      if (filters.phone) {
        query = query.ilike("phone", `%${filters.phone}%`);
      }
      if (filters.preferred_contact_method) {
        query = query.eq(
          "preferred_contact_method",
          filters.preferred_contact_method,
        );
      }
      if (filters.created_after) {
        query = query.gte("created_at", filters.created_after);
      }
      if (filters.created_before) {
        query = query.lte("created_at", filters.created_before);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener historial de reservas del cliente
  async getClientBookingHistory(clientId, limit = 20) {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          services (
            id,
            name,
            description,
            price,
            duration
          )
        `,
        )
        .eq("client_id", clientId)
        .order("booking_date", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener estadísticas del cliente
  async getClientStats(clientId) {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("status, total_price, booking_date")
        .eq("client_id", clientId);

      if (error) throw error;

      const stats = {
        totalBookings: data.length,
        confirmedBookings: data.filter((b) => b.status === "confirmed").length,
        cancelledBookings: data.filter((b) => b.status === "cancelled").length,
        totalSpent: data
          .filter((b) => b.status === "confirmed")
          .reduce((sum, b) => sum + (b.total_price || 0), 0),
        lastBookingDate:
          data.length > 0
            ? Math.max(...data.map((b) => new Date(b.booking_date).getTime()))
            : null,
      };

      return { success: true, data: stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener próximas reservas del cliente
  async getUpcomingBookings(clientId) {
    try {
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          services (
            id,
            name,
            description,
            price,
            duration
          )
        `,
        )
        .eq("client_id", clientId)
        .gte("booking_date", today)
        .in("status", ["pending", "confirmed"])
        .order("booking_date")
        .order("booking_time");

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Verificar si el cliente existe por email o teléfono
  async findExistingClient(email, phone) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .or(`email.eq.${email},phone.eq.${phone}`)
        .limit(1);

      if (error) throw error;
      return {
        success: true,
        exists: data.length > 0,
        client: data.length > 0 ? data[0] : null,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Marcar cliente como VIP o regular
  async updateClientType(clientId, isVip = false) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          is_vip: isVip,
          updated_at: new Date().toISOString(),
        })
        .eq("id", clientId)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener clientes VIP
  async getVipClients() {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("is_vip", true)
        .order("name");

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ===== MÉTODOS DE AUTENTICACIÓN =====

  // Actualizar último login
  async updateLastLogin(clientId) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", clientId)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Actualizar versión de token (para invalidar tokens antiguos)
  async updateTokenVersion(clientId) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          token_version: supabase.raw("COALESCE(token_version, 0) + 1"),
          updated_at: new Date().toISOString(),
        })
        .eq("id", clientId)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Actualizar contraseña
  async updatePassword(clientId, passwordHash) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          password_hash: passwordHash,
          token_version: supabase.raw("COALESCE(token_version, 0) + 1"), // Invalidar tokens existentes
          updated_at: new Date().toISOString(),
        })
        .eq("id", clientId)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Verificar email
  async verifyEmail(clientId) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          email_verified: true,
          email_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", clientId)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Verificar teléfono
  async verifyPhone(clientId) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          phone_verified: true,
          phone_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", clientId)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Suspender cliente
  async suspendClient(clientId, reason = null) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          status: "suspended",
          suspension_reason: reason,
          suspended_at: new Date().toISOString(),
          token_version: supabase.raw("COALESCE(token_version, 0) + 1"), // Invalidar tokens
          updated_at: new Date().toISOString(),
        })
        .eq("id", clientId)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Reactivar cliente
  async reactivateClient(clientId) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          status: "active",
          suspension_reason: null,
          suspended_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", clientId)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ClientModel();
