// src/models/userModel.js
const supabase = require("../integrations/supabaseClient");

class UserModel {
  constructor() {
    this.tableName = "users";
  }

  // Crear un nuevo usuario
  async create(userData) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .insert([
          {
            username: userData.username,
            email: userData.email,
            password_hash: userData.password_hash,
            role: userData.role || "admin",
            full_name: userData.full_name,
            is_active:
              userData.is_active !== undefined ? userData.is_active : true,
            last_login: null,
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

  // Obtener usuario por ID
  async getById(userId) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select(
          "id, username, email, role, full_name, is_active, last_login, created_at, updated_at"
        )
        .eq("id", userId)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener usuario por username
  async getByUsername(username) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("username", username)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener usuario por email
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

  // Obtener todos los usuarios
  async getAll(limit = 50, offset = 0) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select(
          "id, username, email, role, full_name, is_active, last_login, created_at, updated_at"
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener usuarios activos
  async getActiveUsers() {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select(
          "id, username, email, role, full_name, is_active, last_login, created_at, updated_at"
        )
        .eq("is_active", true)
        .order("username");

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener usuarios por rol
  async getByRole(role) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select(
          "id, username, email, role, full_name, is_active, last_login, created_at, updated_at"
        )
        .eq("role", role)
        .eq("is_active", true)
        .order("username");

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Actualizar usuario
  async update(userId, updateData) {
    try {
      // Remover campos sensibles que no deben actualizarse directamente
      const { password_hash, ...safeUpdateData } = updateData;

      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          ...safeUpdateData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select(
          "id, username, email, role, full_name, is_active, last_login, created_at, updated_at"
        );

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Actualizar contraseña
  async updatePassword(userId, newPasswordHash) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          password_hash: newPasswordHash,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select("id, username, email");

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Actualizar último login
  async updateLastLogin(userId) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select("id, username, last_login");

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Activar/Desactivar usuario
  async toggleActiveStatus(userId, isActive) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select("id, username, email, is_active");

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Eliminar usuario
  async delete(userId) {
    try {
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq("id", userId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Verificar si username existe
  async usernameExists(username, excludeUserId = null) {
    try {
      let query = supabase
        .from(this.tableName)
        .select("id")
        .eq("username", username);

      if (excludeUserId) {
        query = query.neq("id", excludeUserId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, exists: data.length > 0 };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Verificar si email existe
  async emailExists(email, excludeUserId = null) {
    try {
      let query = supabase.from(this.tableName).select("id").eq("email", email);

      if (excludeUserId) {
        query = query.neq("id", excludeUserId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, exists: data.length > 0 };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener usuarios con filtros avanzados
  async getWithFilters(filters) {
    try {
      let query = supabase
        .from(this.tableName)
        .select(
          "id, username, email, role, full_name, is_active, last_login, created_at, updated_at"
        );

      if (filters.role) {
        query = query.eq("role", filters.role);
      }
      if (filters.is_active !== undefined) {
        query = query.eq("is_active", filters.is_active);
      }
      if (filters.search) {
        query = query.or(
          `username.ilike.%${filters.search}%,full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
        );
      }
      if (filters.created_after) {
        query = query.gte("created_at", filters.created_after);
      }
      if (filters.created_before) {
        query = query.lte("created_at", filters.created_before);
      }
      if (filters.last_login_after) {
        query = query.gte("last_login", filters.last_login_after);
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

  // Obtener estadísticas de usuarios
  async getUserStats() {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("role, is_active, created_at, last_login");

      if (error) throw error;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const stats = {
        totalUsers: data.length,
        activeUsers: data.filter((u) => u.is_active).length,
        inactiveUsers: data.filter((u) => !u.is_active).length,
        adminUsers: data.filter((u) => u.role === "admin").length,
        recentlyActive: data.filter(
          (u) => u.last_login && new Date(u.last_login) > thirtyDaysAgo
        ).length,
        newUsersThisMonth: data.filter(
          (u) => new Date(u.created_at) > thirtyDaysAgo
        ).length,
      };

      return { success: true, data: stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener usuarios inactivos por tiempo
  async getInactiveUsers(daysInactive = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

      const { data, error } = await supabase
        .from(this.tableName)
        .select("id, username, email, full_name, last_login, created_at")
        .eq("is_active", true)
        .or(`last_login.is.null,last_login.lt.${cutoffDate.toISOString()}`)
        .order("last_login", { ascending: true, nullsFirst: true });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Actualizar configuraciones del usuario
  async updateSettings(userId, settings) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          settings: settings,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select("id, username, settings");

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Registrar actividad del usuario
  async logActivity(userId, activity) {
    try {
      const { data, error } = await supabase
        .from("user_activity_logs")
        .insert([
          {
            user_id: userId,
            activity: activity,
            timestamp: new Date().toISOString(),
          },
        ])
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener actividad reciente del usuario
  async getRecentActivity(userId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from("user_activity_logs")
        .select("*")
        .eq("user_id", userId)
        .order("timestamp", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Cambiar rol del usuario
  async changeRole(userId, newRole) {
    try {
      const validRoles = ["admin", "manager", "staff"];
      if (!validRoles.includes(newRole)) {
        return { success: false, error: "Rol inválido" };
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          role: newRole,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select("id, username, email, role");

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Resetear contraseña (generar token)
  async generatePasswordResetToken(userId) {
    try {
      const resetToken = require("crypto").randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 horas

      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          password_reset_token: resetToken,
          password_reset_expires: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select("id, username, email, password_reset_token");

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Validar token de reset de contraseña
  async validatePasswordResetToken(token) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("id, username, email, password_reset_expires")
        .eq("password_reset_token", token)
        .single();

      if (error) throw error;

      const now = new Date();
      const expiresAt = new Date(data.password_reset_expires);

      if (now > expiresAt) {
        return { success: false, error: "Token expirado" };
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new UserModel();
