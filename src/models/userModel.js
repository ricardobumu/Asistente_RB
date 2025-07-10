// src/models/userModel.js
const supabase = require("../integrations/supabaseClient");
const logger = require("../utils/logger");
const Validators = require("../utils/validators");
const crypto = require("crypto");

/**
 * UserModel - Sistema avanzado de gestión de usuarios empresarial
 *
 * Funcionalidades:
 * - CRUD completo con validaciones robustas
 * - Sistema de roles y permisos avanzado
 * - Gestión de sesiones y seguridad
 * - Auditoría completa de actividades
 * - Análisis de comportamiento de usuarios
 * - Gestión de equipos y jerarquías
 * - Sistema de notificaciones personalizadas
 * - Métricas de productividad
 * - Gestión de accesos y restricciones
 * - Sistema de backup y recuperación
 */
class UserModel {
  constructor() {
    this.tableName = "users";
    this.activityTableName = "user_activity_logs";
    this.sessionTableName = "user_sessions";

    // Roles jerárquicos del sistema
    this.validRoles = [
      "super_admin", // Acceso total al sistema
      "admin", // Administrador general
      "manager", // Gerente de área
      "supervisor", // Supervisor de equipo
      "staff", // Personal operativo
      "receptionist", // Recepcionista
      "therapist", // Terapeuta/Especialista
      "trainee", // Personal en entrenamiento
    ];

    // Jerarquía de roles (mayor número = mayor autoridad)
    this.roleHierarchy = {
      super_admin: 8,
      admin: 7,
      manager: 6,
      supervisor: 5,
      staff: 4,
      receptionist: 3,
      therapist: 3,
      trainee: 1,
    };

    // Permisos por rol
    this.rolePermissions = {
      super_admin: ["*"], // Todos los permisos
      admin: [
        "users.create",
        "users.read",
        "users.update",
        "users.delete",
        "clients.create",
        "clients.read",
        "clients.update",
        "clients.delete",
        "services.create",
        "services.read",
        "services.update",
        "services.delete",
        "bookings.create",
        "bookings.read",
        "bookings.update",
        "bookings.delete",
        "reports.read",
        "settings.update",
        "system.backup",
      ],
      manager: [
        "users.read",
        "users.update",
        "clients.create",
        "clients.read",
        "clients.update",
        "services.read",
        "services.update",
        "bookings.create",
        "bookings.read",
        "bookings.update",
        "bookings.delete",
        "reports.read",
      ],
      supervisor: [
        "users.read",
        "clients.create",
        "clients.read",
        "clients.update",
        "services.read",
        "bookings.create",
        "bookings.read",
        "bookings.update",
        "reports.read",
      ],
      staff: [
        "clients.read",
        "clients.update",
        "services.read",
        "bookings.create",
        "bookings.read",
        "bookings.update",
      ],
      receptionist: [
        "clients.create",
        "clients.read",
        "clients.update",
        "services.read",
        "bookings.create",
        "bookings.read",
        "bookings.update",
      ],
      therapist: [
        "clients.read",
        "services.read",
        "bookings.read",
        "bookings.update",
      ],
      trainee: ["clients.read", "services.read", "bookings.read"],
    };

    // Estados de usuario
    this.validStatuses = [
      "active",
      "inactive",
      "suspended",
      "pending_activation",
    ];

    // Log de inicialización
    logger.info("UserModel inicializado", {
      table: this.tableName,
      validRoles: this.validRoles.length,
      roleHierarchy: Object.keys(this.roleHierarchy).length,
      validStatuses: this.validStatuses.length,
    });
  }

  /**
   * Validar datos de usuario
   */
  _validateUserData(userData, isUpdate = false) {
    const validation = Validators.validateUserData(userData, isUpdate);

    if (!validation.isValid) {
      logger.warn("Validación de usuario fallida", {
        errors: validation.errors,
        data: Object.keys(userData),
      });
    }

    return validation;
  }

  /**
   * Verificar permisos de usuario
   */
  _hasPermission(userRole, requiredPermission) {
    if (!userRole || !this.rolePermissions[userRole]) {
      return false;
    }

    const permissions = this.rolePermissions[userRole];
    return (
      permissions.includes("*") || permissions.includes(requiredPermission)
    );
  }

  /**
   * Verificar jerarquía de roles
   */
  _canManageRole(managerRole, targetRole) {
    const managerLevel = this.roleHierarchy[managerRole] || 0;
    const targetLevel = this.roleHierarchy[targetRole] || 0;
    return managerLevel > targetLevel;
  }

  /**
   * Construir query base con información relacionada
   */
  _buildBaseQuery() {
    return supabase.from(this.tableName).select(`
      id,
      username,
      email,
      role,
      full_name,
      status,
      is_active,
      last_login,
      login_attempts,
      locked_until,
      email_verified,
      phone,
      avatar_url,
      department,
      hire_date,
      settings,
      permissions_override,
      created_at,
      updated_at,
      created_by,
      updated_by
    `);
  }

  /**
   * Crear un nuevo usuario con validación completa
   */
  async create(userData, createdBy = "system") {
    const startTime = Date.now();

    try {
      // Validar datos de entrada
      const validation = this._validateUserData(userData);
      if (!validation.isValid) {
        return {
          success: false,
          error: "Datos de usuario inválidos",
          details: validation.errors,
        };
      }

      // Verificar que el rol es válido
      if (userData.role && !this.validRoles.includes(userData.role)) {
        return { success: false, error: "Rol de usuario inválido" };
      }

      // Verificar que username no existe
      const usernameCheck = await this.usernameExists(userData.username);
      if (!usernameCheck.success) return usernameCheck;
      if (usernameCheck.exists) {
        return { success: false, error: "El nombre de usuario ya existe" };
      }

      // Verificar que email no existe
      const emailCheck = await this.emailExists(userData.email);
      if (!emailCheck.success) return emailCheck;
      if (emailCheck.exists) {
        return { success: false, error: "El email ya está registrado" };
      }

      // Preparar datos para inserción
      const insertData = {
        username: Validators.sanitizeText(userData.username),
        email: userData.email.toLowerCase().trim(),
        password_hash: userData.password_hash,
        role: userData.role || "staff",
        full_name: Validators.sanitizeText(userData.full_name),
        status: userData.status || "active",
        is_active: userData.is_active !== undefined ? userData.is_active : true,
        phone: userData.phone || null,
        department: userData.department || null,
        hire_date: userData.hire_date || new Date().toISOString().split("T")[0],
        avatar_url: userData.avatar_url || null,
        settings: userData.settings || {
          notifications: true,
          theme: "light",
          language: "es",
          timezone: "America/Argentina/Buenos_Aires",
        },
        permissions_override: userData.permissions_override || [],
        email_verified: userData.email_verified || false,
        login_attempts: 0,
        locked_until: null,
        last_login: null,
        created_by: createdBy,
        updated_by: createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from(this.tableName)
        .insert([insertData])
        .select();

      if (error) throw error;

      // Registrar actividad de creación
      await this.logActivity(data[0].id, {
        action: "user_created",
        details: { created_by: createdBy, role: data[0].role },
        ip_address: null,
        user_agent: null,
      });

      const duration = Date.now() - startTime;
      logger.info("Usuario creado exitosamente", {
        user_id: data[0].id,
        username: data[0].username,
        role: data[0].role,
        created_by: createdBy,
        duration: `${duration}ms`,
      });

      // Remover información sensible de la respuesta
      const { password_hash, password_reset_token, ...safeData } = data[0];

      return {
        success: true,
        data: safeData,
        message: "Usuario creado exitosamente",
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error creando usuario", error, {
        userData: Object.keys(userData),
        created_by: createdBy,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener usuario por ID con información completa
   */
  async getById(userId, requestedBy = null) {
    const startTime = Date.now();

    try {
      if (!userId) {
        return { success: false, error: "ID de usuario requerido" };
      }

      const { data, error } = await this._buildBaseQuery()
        .eq("id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return { success: false, error: "Usuario no encontrado" };
        }
        throw error;
      }

      // Registrar acceso si se especifica quien lo solicita
      if (requestedBy) {
        await this.logActivity(userId, {
          action: "profile_accessed",
          details: { accessed_by: requestedBy },
          ip_address: null,
          user_agent: null,
        });
      }

      const duration = Date.now() - startTime;
      logger.info("Usuario obtenido por ID", {
        user_id: userId,
        username: data.username,
        role: data.role,
        requested_by: requestedBy,
        duration: `${duration}ms`,
      });

      // Remover información sensible
      const { password_hash, password_reset_token, ...safeData } = data;

      return {
        success: true,
        data: safeData,
        message: "Usuario encontrado",
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error obteniendo usuario por ID", error, {
        user_id: userId,
        requested_by: requestedBy,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Búsqueda avanzada de usuarios con filtros múltiples
   */
  async searchAdvanced(filters = {}, options = {}) {
    const startTime = Date.now();
    const {
      limit = 50,
      offset = 0,
      sortBy = "created_at",
      sortOrder = "desc",
    } = options;

    try {
      // Validar paginación
      const pagination = Validators.validatePagination(limit, offset);
      if (!pagination.isValid) {
        return {
          success: false,
          error: "Parámetros de paginación inválidos",
          details: pagination.errors,
        };
      }

      let query = this._buildBaseQuery();

      // Aplicar filtros
      if (filters.role && this.validRoles.includes(filters.role)) {
        query = query.eq("role", filters.role);
      }

      if (filters.status && this.validStatuses.includes(filters.status)) {
        query = query.eq("status", filters.status);
      }

      if (filters.is_active !== undefined) {
        query = query.eq("is_active", filters.is_active);
      }

      if (filters.department) {
        query = query.eq("department", filters.department);
      }

      if (filters.email_verified !== undefined) {
        query = query.eq("email_verified", filters.email_verified);
      }

      // Búsqueda por texto en múltiples campos
      if (filters.search_text) {
        query = query.or(
          `username.ilike.%${filters.search_text}%,full_name.ilike.%${filters.search_text}%,email.ilike.%${filters.search_text}%`
        );
      }

      // Filtros de fecha
      if (filters.created_after) {
        query = query.gte("created_at", filters.created_after);
      }

      if (filters.created_before) {
        query = query.lte("created_at", filters.created_before);
      }

      if (filters.last_login_after) {
        query = query.gte("last_login", filters.last_login_after);
      }

      if (filters.hire_date_after) {
        query = query.gte("hire_date", filters.hire_date_after);
      }

      // Filtrar usuarios bloqueados
      if (filters.is_locked !== undefined) {
        if (filters.is_locked) {
          query = query.not("locked_until", "is", null);
          query = query.gt("locked_until", new Date().toISOString());
        } else {
          query = query.or(
            "locked_until.is.null,locked_until.lt." + new Date().toISOString()
          );
        }
      }

      // Aplicar ordenamiento
      const ascending = sortOrder === "asc";
      query = query.order(sortBy, { ascending });

      // Aplicar paginación
      query = query.range(
        pagination.offset,
        pagination.offset + pagination.limit - 1
      );

      const { data, error } = await query;
      if (error) throw error;

      // Remover información sensible de todos los usuarios
      const safeData = data.map((user) => {
        const { password_hash, password_reset_token, ...safeUser } = user;
        return safeUser;
      });

      const duration = Date.now() - startTime;
      logger.info("Búsqueda avanzada de usuarios completada", {
        filtersApplied: Object.keys(filters).length,
        resultsCount: safeData.length,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: safeData,
        pagination: {
          limit: pagination.limit,
          offset: pagination.offset,
          count: safeData.length,
        },
        filters: filters,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error en búsqueda avanzada de usuarios", error, {
        filters: Object.keys(filters),
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Autenticación avanzada con control de intentos
   */
  async authenticateAdvanced(username, passwordHash, loginInfo = {}) {
    const startTime = Date.now();

    try {
      if (!username || !passwordHash) {
        return { success: false, error: "Credenciales requeridas" };
      }

      // Buscar usuario por username o email
      const { data: user, error } = await supabase
        .from(this.tableName)
        .select("*")
        .or(`username.eq.${username},email.eq.${username}`)
        .single();

      if (error || !user) {
        // Registrar intento de login fallido
        logger.warn("Intento de login con usuario inexistente", {
          username,
          ip_address: loginInfo.ip_address,
          user_agent: loginInfo.user_agent,
        });
        return { success: false, error: "Credenciales inválidas" };
      }

      // Verificar si el usuario está bloqueado
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        const unlockTime = new Date(user.locked_until).toLocaleString();
        return {
          success: false,
          error: `Usuario bloqueado hasta ${unlockTime}`,
          locked_until: user.locked_until,
        };
      }

      // Verificar si el usuario está activo
      if (!user.is_active || user.status !== "active") {
        return { success: false, error: "Usuario inactivo o suspendido" };
      }

      // Verificar contraseña
      if (user.password_hash !== passwordHash) {
        // Incrementar intentos fallidos
        const newAttempts = (user.login_attempts || 0) + 1;
        let updateData = {
          login_attempts: newAttempts,
          updated_at: new Date().toISOString(),
        };

        // Bloquear usuario después de 5 intentos fallidos
        if (newAttempts >= 5) {
          const lockUntil = new Date();
          lockUntil.setMinutes(lockUntil.getMinutes() + 30); // 30 minutos
          updateData.locked_until = lockUntil.toISOString();
        }

        await supabase
          .from(this.tableName)
          .update(updateData)
          .eq("id", user.id);

        // Registrar intento fallido
        await this.logActivity(user.id, {
          action: "login_failed",
          details: {
            reason: "invalid_password",
            attempts: newAttempts,
            locked: newAttempts >= 5,
          },
          ip_address: loginInfo.ip_address,
          user_agent: loginInfo.user_agent,
        });

        logger.warn("Intento de login fallido", {
          user_id: user.id,
          username: user.username,
          attempts: newAttempts,
          ip_address: loginInfo.ip_address,
        });

        return { success: false, error: "Credenciales inválidas" };
      }

      // Login exitoso - resetear intentos y actualizar último login
      await supabase
        .from(this.tableName)
        .update({
          login_attempts: 0,
          locked_until: null,
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      // Crear sesión
      const sessionToken = crypto.randomBytes(32).toString("hex");
      const sessionExpires = new Date();
      sessionExpires.setHours(sessionExpires.getHours() + 8); // 8 horas

      await supabase.from(this.sessionTableName).insert([
        {
          user_id: user.id,
          session_token: sessionToken,
          expires_at: sessionExpires.toISOString(),
          ip_address: loginInfo.ip_address,
          user_agent: loginInfo.user_agent,
          created_at: new Date().toISOString(),
        },
      ]);

      // Registrar login exitoso
      await this.logActivity(user.id, {
        action: "login_success",
        details: { session_token: sessionToken.substring(0, 8) + "..." },
        ip_address: loginInfo.ip_address,
        user_agent: loginInfo.user_agent,
      });

      const duration = Date.now() - startTime;
      logger.info("Autenticación exitosa", {
        user_id: user.id,
        username: user.username,
        role: user.role,
        ip_address: loginInfo.ip_address,
        duration: `${duration}ms`,
      });

      // Remover información sensible
      const {
        password_hash,
        password_reset_token,
        login_attempts,
        locked_until,
        ...safeUser
      } = user;

      return {
        success: true,
        data: {
          user: safeUser,
          session: {
            token: sessionToken,
            expires_at: sessionExpires.toISOString(),
          },
          permissions: this.rolePermissions[user.role] || [],
        },
        message: "Autenticación exitosa",
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error en autenticación", error, {
        username,
        ip_address: loginInfo.ip_address,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Validar sesión de usuario
   */
  async validateSession(sessionToken) {
    const startTime = Date.now();

    try {
      if (!sessionToken) {
        return { success: false, error: "Token de sesión requerido" };
      }

      const { data: session, error } = await supabase
        .from(this.sessionTableName)
        .select(
          `
          *,
          users (
            id, username, email, role, full_name, status, is_active,
            settings, permissions_override
          )
        `
        )
        .eq("session_token", sessionToken)
        .single();

      if (error || !session) {
        return { success: false, error: "Sesión inválida" };
      }

      // Verificar si la sesión ha expirado
      if (new Date(session.expires_at) < new Date()) {
        // Eliminar sesión expirada
        await supabase
          .from(this.sessionTableName)
          .delete()
          .eq("session_token", sessionToken);

        return { success: false, error: "Sesión expirada" };
      }

      // Verificar si el usuario sigue activo
      if (!session.users.is_active || session.users.status !== "active") {
        return { success: false, error: "Usuario inactivo" };
      }

      // Extender sesión (opcional)
      const newExpires = new Date();
      newExpires.setHours(newExpires.getHours() + 8);

      await supabase
        .from(this.sessionTableName)
        .update({ expires_at: newExpires.toISOString() })
        .eq("session_token", sessionToken);

      const duration = Date.now() - startTime;
      logger.info("Sesión validada", {
        user_id: session.user_id,
        username: session.users.username,
        session_extended: true,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: {
          user: session.users,
          session: {
            token: sessionToken,
            expires_at: newExpires.toISOString(),
            ip_address: session.ip_address,
          },
          permissions: this.rolePermissions[session.users.role] || [],
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error validando sesión", error, {
        session_token: sessionToken
          ? sessionToken.substring(0, 8) + "..."
          : null,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Cerrar sesión
   */
  async logout(sessionToken, userId = null) {
    const startTime = Date.now();

    try {
      if (!sessionToken) {
        return { success: false, error: "Token de sesión requerido" };
      }

      // Eliminar sesión
      const { error } = await supabase
        .from(this.sessionTableName)
        .delete()
        .eq("session_token", sessionToken);

      if (error) throw error;

      // Registrar logout si tenemos el userId
      if (userId) {
        await this.logActivity(userId, {
          action: "logout",
          details: { session_token: sessionToken.substring(0, 8) + "..." },
          ip_address: null,
          user_agent: null,
        });
      }

      const duration = Date.now() - startTime;
      logger.info("Logout exitoso", {
        user_id: userId,
        session_token: sessionToken.substring(0, 8) + "...",
        duration: `${duration}ms`,
      });

      return {
        success: true,
        message: "Sesión cerrada exitosamente",
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error en logout", error, {
        user_id: userId,
        session_token: sessionToken
          ? sessionToken.substring(0, 8) + "..."
          : null,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Gestión avanzada de roles y permisos
   */
  async updateRoleAdvanced(userId, newRole, updatedBy, reason = null) {
    const startTime = Date.now();

    try {
      if (!userId || !newRole || !updatedBy) {
        return { success: false, error: "Parámetros requeridos faltantes" };
      }

      // Validar que el rol es válido
      if (!this.validRoles.includes(newRole)) {
        return { success: false, error: "Rol inválido" };
      }

      // Obtener usuario actual
      const currentUser = await this.getById(userId);
      if (!currentUser.success) {
        return currentUser;
      }

      // Obtener información del usuario que hace el cambio
      const updaterUser = await this.getById(updatedBy);
      if (!updaterUser.success) {
        return { success: false, error: "Usuario actualizador no encontrado" };
      }

      // Verificar jerarquía - solo usuarios de mayor jerarquía pueden cambiar roles
      if (
        !this._canManageRole(updaterUser.data.role, currentUser.data.role) ||
        !this._canManageRole(updaterUser.data.role, newRole)
      ) {
        return {
          success: false,
          error: "No tienes permisos para asignar este rol",
          details: {
            current_role: currentUser.data.role,
            new_role: newRole,
            updater_role: updaterUser.data.role,
          },
        };
      }

      // Actualizar rol
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          role: newRole,
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select();

      if (error) throw error;

      // Registrar cambio de rol
      await this.logActivity(userId, {
        action: "role_changed",
        details: {
          old_role: currentUser.data.role,
          new_role: newRole,
          changed_by: updatedBy,
          reason: reason || "Sin razón especificada",
        },
        ip_address: null,
        user_agent: null,
      });

      // Invalidar todas las sesiones del usuario (forzar re-login)
      await supabase.from(this.sessionTableName).delete().eq("user_id", userId);

      const duration = Date.now() - startTime;
      logger.info("Rol de usuario actualizado", {
        user_id: userId,
        username: currentUser.data.username,
        old_role: currentUser.data.role,
        new_role: newRole,
        updated_by: updatedBy,
        reason,
        duration: `${duration}ms`,
      });

      const { password_hash, password_reset_token, ...safeData } = data[0];

      return {
        success: true,
        data: safeData,
        message: "Rol actualizado exitosamente",
        updateInfo: {
          oldRole: currentUser.data.role,
          newRole: newRole,
          updatedBy: updatedBy,
          reason: reason || "Sin razón especificada",
          sessionsInvalidated: true,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error actualizando rol de usuario", error, {
        user_id: userId,
        new_role: newRole,
        updated_by: updatedBy,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener estadísticas avanzadas de usuarios
   */
  async getAdvancedStats(startDate = null, endDate = null) {
    const startTime = Date.now();

    try {
      // Establecer fechas por defecto (último mes)
      if (!endDate) endDate = new Date().toISOString();
      if (!startDate) {
        const start = new Date();
        start.setMonth(start.getMonth() - 1);
        startDate = start.toISOString();
      }

      // Obtener todos los usuarios
      const { data: users, error: usersError } = await supabase
        .from(this.tableName)
        .select(
          "role, status, is_active, created_at, last_login, department, hire_date"
        );

      if (usersError) throw usersError;

      // Obtener actividad del período
      const { data: activities, error: activitiesError } = await supabase
        .from(this.activityTableName)
        .select("user_id, action, timestamp")
        .gte("timestamp", startDate)
        .lte("timestamp", endDate);

      if (activitiesError) throw activitiesError;

      // Estadísticas básicas
      const basicStats = {
        totalUsers: users.length,
        activeUsers: users.filter((u) => u.is_active && u.status === "active")
          .length,
        inactiveUsers: users.filter(
          (u) => !u.is_active || u.status !== "active"
        ).length,
        suspendedUsers: users.filter((u) => u.status === "suspended").length,
        pendingUsers: users.filter((u) => u.status === "pending_activation")
          .length,
      };

      // Estadísticas por rol
      const roleStats = {};
      this.validRoles.forEach((role) => {
        roleStats[role] = {
          total: users.filter((u) => u.role === role).length,
          active: users.filter(
            (u) => u.role === role && u.is_active && u.status === "active"
          ).length,
        };
      });

      // Estadísticas por departamento
      const departmentStats = {};
      users.forEach((user) => {
        const dept = user.department || "Sin departamento";
        if (!departmentStats[dept]) {
          departmentStats[dept] = { total: 0, active: 0 };
        }
        departmentStats[dept].total++;
        if (user.is_active && user.status === "active") {
          departmentStats[dept].active++;
        }
      });

      // Análisis de actividad
      const activityStats = {
        totalActivities: activities.length,
        uniqueActiveUsers: new Set(activities.map((a) => a.user_id)).size,
        loginActivities: activities.filter((a) => a.action === "login_success")
          .length,
        failedLogins: activities.filter((a) => a.action === "login_failed")
          .length,
      };

      // Análisis de actividad por acción
      const actionStats = {};
      activities.forEach((activity) => {
        actionStats[activity.action] = (actionStats[activity.action] || 0) + 1;
      });

      // Usuarios más activos
      const userActivityCount = {};
      activities.forEach((activity) => {
        userActivityCount[activity.user_id] =
          (userActivityCount[activity.user_id] || 0) + 1;
      });

      const mostActiveUsers = Object.entries(userActivityCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([userId, count]) => ({ user_id: userId, activity_count: count }));

      // Análisis de logins recientes
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const loginStats = {
        recentlyActive: users.filter(
          (u) => u.last_login && new Date(u.last_login) > sevenDaysAgo
        ).length,
        activeThisMonth: users.filter(
          (u) => u.last_login && new Date(u.last_login) > thirtyDaysAgo
        ).length,
        neverLoggedIn: users.filter((u) => !u.last_login).length,
      };

      // Nuevos usuarios en el período
      const newUsersInPeriod = users.filter(
        (u) => u.created_at >= startDate && u.created_at <= endDate
      ).length;

      const duration = Date.now() - startTime;
      logger.info("Estadísticas avanzadas de usuarios generadas", {
        period: `${startDate} to ${endDate}`,
        totalUsers: basicStats.totalUsers,
        totalActivities: activityStats.totalActivities,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: {
          period: { startDate, endDate },
          basic: basicStats,
          roles: roleStats,
          departments: departmentStats,
          activity: activityStats,
          actions: actionStats,
          mostActive: mostActiveUsers,
          logins: loginStats,
          newUsersInPeriod,
          recommendations: this._generateUserRecommendations(
            basicStats,
            activityStats,
            loginStats
          ),
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        "Error generando estadísticas avanzadas de usuarios",
        error,
        {
          startDate,
          endDate,
          duration: `${duration}ms`,
        }
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Generar recomendaciones basadas en estadísticas
   */
  _generateUserRecommendations(basicStats, activityStats, loginStats) {
    const recommendations = [];

    // Recomendación de usuarios inactivos
    if (basicStats.inactiveUsers > basicStats.activeUsers * 0.2) {
      recommendations.push({
        type: "user_management",
        priority: "high",
        message:
          "Alto número de usuarios inactivos. Considera revisar y limpiar cuentas.",
        action: "review_inactive_users",
      });
    }

    // Recomendación de seguridad
    if (activityStats.failedLogins > activityStats.loginActivities * 0.1) {
      recommendations.push({
        type: "security",
        priority: "high",
        message:
          "Alto número de intentos de login fallidos. Revisar seguridad.",
        action: "review_security",
      });
    }

    // Recomendación de actividad
    if (loginStats.neverLoggedIn > basicStats.totalUsers * 0.3) {
      recommendations.push({
        type: "onboarding",
        priority: "medium",
        message:
          "Muchos usuarios nunca han iniciado sesión. Mejorar onboarding.",
        action: "improve_onboarding",
      });
    }

    return recommendations;
  }

  /**
   * Gestión de permisos personalizados
   */
  async updatePermissionsOverride(
    userId,
    permissions,
    updatedBy,
    reason = null
  ) {
    const startTime = Date.now();

    try {
      if (!userId || !updatedBy) {
        return { success: false, error: "Parámetros requeridos faltantes" };
      }

      // Validar que permissions es un array
      if (!Array.isArray(permissions)) {
        return { success: false, error: "Los permisos deben ser un array" };
      }

      // Obtener usuario actual
      const currentUser = await this.getById(userId);
      if (!currentUser.success) {
        return currentUser;
      }

      // Actualizar permisos
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          permissions_override: permissions,
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select();

      if (error) throw error;

      // Registrar cambio de permisos
      await this.logActivity(userId, {
        action: "permissions_updated",
        details: {
          old_permissions: currentUser.data.permissions_override || [],
          new_permissions: permissions,
          updated_by: updatedBy,
          reason: reason || "Sin razón especificada",
        },
        ip_address: null,
        user_agent: null,
      });

      const duration = Date.now() - startTime;
      logger.info("Permisos de usuario actualizados", {
        user_id: userId,
        username: currentUser.data.username,
        permissions_count: permissions.length,
        updated_by: updatedBy,
        duration: `${duration}ms`,
      });

      const { password_hash, password_reset_token, ...safeData } = data[0];

      return {
        success: true,
        data: safeData,
        message: "Permisos actualizados exitosamente",
        updateInfo: {
          oldPermissions: currentUser.data.permissions_override || [],
          newPermissions: permissions,
          updatedBy: updatedBy,
          reason: reason || "Sin razón especificada",
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error actualizando permisos de usuario", error, {
        user_id: userId,
        updated_by: updatedBy,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Actualizar usuario con validaciones completas
   */
  async updateAdvanced(userId, updateData, updatedBy = "system") {
    const startTime = Date.now();

    try {
      if (!userId) {
        return { success: false, error: "ID de usuario requerido" };
      }

      // Validar datos de actualización
      const validation = this._validateUserData(updateData, true);
      if (!validation.isValid) {
        return {
          success: false,
          error: "Datos de actualización inválidos",
          details: validation.errors,
        };
      }

      // Obtener usuario actual
      const currentUser = await this.getById(userId);
      if (!currentUser.success) {
        return { success: false, error: "Usuario no encontrado" };
      }

      // Verificar username único si se está cambiando
      if (
        updateData.username &&
        updateData.username !== currentUser.data.username
      ) {
        const usernameCheck = await this.usernameExists(
          updateData.username,
          userId
        );
        if (!usernameCheck.success) return usernameCheck;
        if (usernameCheck.exists) {
          return { success: false, error: "El nombre de usuario ya existe" };
        }
      }

      // Verificar email único si se está cambiando
      if (updateData.email && updateData.email !== currentUser.data.email) {
        const emailCheck = await this.emailExists(updateData.email, userId);
        if (!emailCheck.success) return emailCheck;
        if (emailCheck.exists) {
          return { success: false, error: "El email ya está registrado" };
        }
      }

      // Sanitizar texto si se proporciona
      if (updateData.username) {
        updateData.username = Validators.sanitizeText(updateData.username);
      }

      if (updateData.full_name) {
        updateData.full_name = Validators.sanitizeText(updateData.full_name);
      }

      if (updateData.email) {
        updateData.email = updateData.email.toLowerCase().trim();
      }

      // Remover campos que no deben actualizarse directamente
      const {
        password_hash,
        password_reset_token,
        login_attempts,
        locked_until,
        ...safeUpdateData
      } = updateData;

      // Preparar datos de actualización
      const finalUpdateData = {
        ...safeUpdateData,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      };

      // Actualizar usuario
      const { data, error } = await supabase
        .from(this.tableName)
        .update(finalUpdateData)
        .eq("id", userId)
        .select();

      if (error) throw error;

      // Registrar actualización
      await this.logActivity(userId, {
        action: "profile_updated",
        details: {
          fields_updated: Object.keys(safeUpdateData),
          updated_by: updatedBy,
        },
        ip_address: null,
        user_agent: null,
      });

      const duration = Date.now() - startTime;
      logger.info("Usuario actualizado", {
        user_id: userId,
        updated_by: updatedBy,
        fields_updated: Object.keys(safeUpdateData),
        duration: `${duration}ms`,
      });

      const {
        password_hash: _,
        password_reset_token: __,
        ...safeData
      } = data[0];

      return {
        success: true,
        data: safeData,
        message: "Usuario actualizado exitosamente",
        updateInfo: {
          updatedBy,
          fieldsUpdated: Object.keys(safeUpdateData),
          updatedAt: data[0].updated_at,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error actualizando usuario", error, {
        user_id: userId,
        updated_by: updatedBy,
        fields: Object.keys(updateData),
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Eliminar usuario con validaciones de seguridad
   */
  async deleteAdvanced(userId, deletedBy = "system", reason = null) {
    const startTime = Date.now();

    try {
      if (!userId) {
        return { success: false, error: "ID de usuario requerido" };
      }

      // Obtener información del usuario antes de eliminar
      const currentUser = await this.getById(userId);
      if (!currentUser.success) {
        return { success: false, error: "Usuario no encontrado" };
      }

      const user = currentUser.data;

      // Verificar si es el último super_admin
      if (user.role === "super_admin") {
        const { data: superAdmins, error } = await supabase
          .from(this.tableName)
          .select("id")
          .eq("role", "super_admin")
          .eq("is_active", true);

        if (error) throw error;

        if (superAdmins.length <= 1) {
          return {
            success: false,
            error: "No se puede eliminar el último super administrador",
            suggestion: "Asigna el rol de super_admin a otro usuario primero",
          };
        }
      }

      // Eliminar sesiones activas
      await supabase.from(this.sessionTableName).delete().eq("user_id", userId);

      // Registrar eliminación antes de eliminar
      await this.logActivity(userId, {
        action: "user_deleted",
        details: {
          deleted_by: deletedBy,
          reason: reason || "Sin razón especificada",
          user_info: {
            username: user.username,
            role: user.role,
            department: user.department,
          },
        },
        ip_address: null,
        user_agent: null,
      });

      // Eliminar usuario
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq("id", userId);

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Usuario eliminado", {
        user_id: userId,
        deleted_by: deletedBy,
        reason: reason || "Sin razón especificada",
        username: user.username,
        role: user.role,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        message: "Usuario eliminado exitosamente",
        deletionInfo: {
          deletedBy,
          reason: reason || "Sin razón especificada",
          deletedAt: new Date().toISOString(),
          userInfo: {
            username: user.username,
            role: user.role,
            department: user.department,
          },
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error eliminando usuario", error, {
        user_id: userId,
        deleted_by: deletedBy,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Registrar actividad del usuario
   */
  async logActivity(userId, activityData) {
    try {
      const { data, error } = await supabase
        .from(this.activityTableName)
        .insert([
          {
            user_id: userId,
            action: activityData.action,
            details: activityData.details || {},
            ip_address: activityData.ip_address,
            user_agent: activityData.user_agent,
            timestamp: new Date().toISOString(),
          },
        ])
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      logger.error("Error registrando actividad de usuario", error, {
        user_id: userId,
        action: activityData.action,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener actividad reciente del usuario con filtros
   */
  async getActivityAdvanced(userId, filters = {}, options = {}) {
    const startTime = Date.now();
    const { limit = 50, offset = 0 } = options;

    try {
      if (!userId) {
        return { success: false, error: "ID de usuario requerido" };
      }

      let query = supabase
        .from(this.activityTableName)
        .select("*")
        .eq("user_id", userId);

      // Aplicar filtros
      if (filters.action) {
        query = query.eq("action", filters.action);
      }

      if (filters.start_date) {
        query = query.gte("timestamp", filters.start_date);
      }

      if (filters.end_date) {
        query = query.lte("timestamp", filters.end_date);
      }

      if (filters.ip_address) {
        query = query.eq("ip_address", filters.ip_address);
      }

      // Aplicar paginación y ordenamiento
      query = query
        .order("timestamp", { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error } = await query;
      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Actividad de usuario obtenida", {
        user_id: userId,
        filters_applied: Object.keys(filters).length,
        results_count: data.length,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data,
        pagination: { limit, offset, count: data.length },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error obteniendo actividad de usuario", error, {
        user_id: userId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  // Métodos de compatibilidad con la versión anterior
  async getByUsername(username) {
    const result = await this.searchAdvanced(
      { search_text: username },
      { limit: 1 }
    );
    if (result.success && result.data.length > 0) {
      const user = result.data.find((u) => u.username === username);
      return user
        ? { success: true, data: user }
        : { success: false, error: "Usuario no encontrado" };
    }
    return { success: false, error: "Usuario no encontrado" };
  }

  async getByEmail(email) {
    const result = await this.searchAdvanced(
      { search_text: email },
      { limit: 1 }
    );
    if (result.success && result.data.length > 0) {
      const user = result.data.find((u) => u.email === email);
      return user
        ? { success: true, data: user }
        : { success: false, error: "Usuario no encontrado" };
    }
    return { success: false, error: "Usuario no encontrado" };
  }

  async getAll(limit = 50, offset = 0) {
    return this.searchAdvanced({}, { limit, offset });
  }

  async getActiveUsers() {
    return this.searchAdvanced({ is_active: true, status: "active" });
  }

  async getByRole(role) {
    return this.searchAdvanced({ role });
  }

  async update(userId, updateData) {
    return this.updateAdvanced(userId, updateData);
  }

  async delete(userId) {
    return this.deleteAdvanced(userId);
  }

  async toggleActiveStatus(userId, isActive) {
    return this.updateAdvanced(userId, { is_active: isActive });
  }

  async updatePassword(userId, newPasswordHash) {
    return this.updateAdvanced(userId, { password_hash: newPasswordHash });
  }

  async updateLastLogin(userId) {
    return this.updateAdvanced(userId, {
      last_login: new Date().toISOString(),
    });
  }

  async usernameExists(username, excludeUserId = null) {
    const startTime = Date.now();

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

      const duration = Date.now() - startTime;
      logger.info("Verificación de username existente", {
        username,
        exists: data.length > 0,
        exclude_user_id: excludeUserId,
        duration: `${duration}ms`,
      });

      return { success: true, exists: data.length > 0 };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error verificando username existente", error, {
        username,
        exclude_user_id: excludeUserId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  async emailExists(email, excludeUserId = null) {
    const startTime = Date.now();

    try {
      let query = supabase
        .from(this.tableName)
        .select("id")
        .eq("email", email.toLowerCase().trim());

      if (excludeUserId) {
        query = query.neq("id", excludeUserId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Verificación de email existente", {
        email,
        exists: data.length > 0,
        exclude_user_id: excludeUserId,
        duration: `${duration}ms`,
      });

      return { success: true, exists: data.length > 0 };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error verificando email existente", error, {
        email,
        exclude_user_id: excludeUserId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  async getWithFilters(filters) {
    return this.searchAdvanced(filters);
  }

  async getUserStats() {
    const result = await this.getAdvancedStats();
    if (result.success) {
      return { success: true, data: result.data.basic };
    }
    return result;
  }

  async getInactiveUsers(daysInactive = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    return this.searchAdvanced({
      is_active: true,
      last_login_before: cutoffDate.toISOString(),
    });
  }

  async updateSettings(userId, settings) {
    return this.updateAdvanced(userId, { settings });
  }

  async getRecentActivity(userId, limit = 50) {
    return this.getActivityAdvanced(userId, {}, { limit });
  }

  async changeRole(userId, newRole) {
    return this.updateRoleAdvanced(userId, newRole, "system");
  }

  async generatePasswordResetToken(userId) {
    const startTime = Date.now();

    try {
      const resetToken = crypto.randomBytes(32).toString("hex");
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

      // Registrar generación de token
      await this.logActivity(userId, {
        action: "password_reset_requested",
        details: { token_expires: expiresAt.toISOString() },
        ip_address: null,
        user_agent: null,
      });

      const duration = Date.now() - startTime;
      logger.info("Token de reset de contraseña generado", {
        user_id: userId,
        expires_at: expiresAt.toISOString(),
        duration: `${duration}ms`,
      });

      return { success: true, data: data[0] };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error generando token de reset de contraseña", error, {
        user_id: userId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  async validatePasswordResetToken(token) {
    const startTime = Date.now();

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

      const duration = Date.now() - startTime;
      logger.info("Token de reset validado", {
        user_id: data.id,
        username: data.username,
        duration: `${duration}ms`,
      });

      return { success: true, data };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error validando token de reset", error, {
        token: token ? token.substring(0, 8) + "..." : null,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }
}

module.exports = new UserModel();
