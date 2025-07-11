// src/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const speakeasy = require("speakeasy");
const logger = require("../utils/logger");
const userModel = require("../models/userModel");
const clientModel = require("../models/clientModel");
const tokenBlacklist = require("../utils/tokenBlacklist");
const DatabaseAdapter = require("../adapters/databaseAdapter");

/**
 * Middleware de autenticación JWT con roles granulares
 */
class AuthMiddleware {
  constructor() {
    this.userModel = userModel;
    this.clientModel = clientModel;
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!this.jwtSecret || !this.jwtRefreshSecret) {
      throw new Error(
        "JWT secrets must be configured in environment variables",
      );
    }

    // Cache de usuarios para evitar consultas repetidas
    this.userCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutos

    // Cache para tracking de intentos de login
    this.loginAttempts = new Map();
    this.maxLoginAttempts = 5;
    this.lockoutDuration = 30 * 60 * 1000; // 30 minutos

    // Cache para sesiones activas
    this.activeSessions = new Map();
    this.maxSessionsPerUser = 5;

    // Configuración de tokens
    this.tokenConfig = {
      accessTokenExpiry: "15m",
      refreshTokenExpiry: "7d",
      issuer: "asistente-rb",
      audience: "asistente-rb-users",
    };
  }

  /**
   * Middleware principal de autenticación
   */
  authenticate = async (req, res, next) => {
    try {
      // Extraer token del header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          error: "Token de acceso requerido",
        });
      }

      const token = authHeader.substring(7); // Remover 'Bearer '

      // Verificar si el token está en la blacklist
      if (tokenBlacklist.isBlacklisted(token)) {
        logger.warn("Token en blacklist usado", {
          tokenPrefix: token.substring(0, 10) + "...",
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        });

        return res.status(401).json({
          success: false,
          error: "Token revocado",
        });
      }

      // Verificar token
      let decoded;
      try {
        decoded = jwt.verify(token, this.jwtSecret);
      } catch (jwtError) {
        logger.warn("Token JWT inválido", {
          error: jwtError.message,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        });

        return res.status(401).json({
          success: false,
          error: "Token inválido o expirado",
        });
      }

      // Buscar usuario en cache primero
      const cacheKey = `${decoded.type}_${decoded.id}`;
      let user = this.getUserFromCache(cacheKey);

      if (!user) {
        // Buscar usuario en base de datos
        let userResult;
        if (decoded.type === "client") {
          userResult = await this.clientModel.getById(decoded.id);
        } else {
          userResult = await this.userModel.getById(decoded.id);
        }

        if (!userResult.success || !userResult.data) {
          logger.warn("Usuario no encontrado para token válido", {
            userId: decoded.id,
            type: decoded.type,
            ip: req.ip,
          });

          return res.status(401).json({
            success: false,
            error: "Usuario no encontrado",
          });
        }

        user = userResult.data;

        // Agregar al cache
        this.addUserToCache(cacheKey, user);
      }

      // Verificar que el usuario esté activo
      if (user.status === "inactive" || user.status === "suspended") {
        logger.warn("Intento de acceso con usuario inactivo", {
          userId: user.id,
          status: user.status,
          ip: req.ip,
        });

        return res.status(403).json({
          success: false,
          error: "Cuenta inactiva o suspendida",
        });
      }

      // Agregar información del usuario a la request
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: decoded.role,
        type: decoded.type,
        vip_status: user.vip_status || false,
      };

      // Log de acceso exitoso (solo para operaciones importantes)
      if (req.method !== "GET") {
        logger.info("Acceso autenticado", {
          userId: user.id,
          role: decoded.role,
          method: req.method,
          url: req.url,
          ip: req.ip,
        });
      }

      next();
    } catch (error) {
      logger.error("Error en middleware de autenticación", error, {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  };

  /**
   * Middleware para verificar roles específicos
   */
  requireRole = (allowedRoles) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Autenticación requerida",
        });
      }

      const userRole = req.user.role;
      const allowedRolesArray = Array.isArray(allowedRoles)
        ? allowedRoles
        : [allowedRoles];

      if (!allowedRolesArray.includes(userRole)) {
        logger.warn("Acceso denegado por rol insuficiente", {
          userId: req.user.id,
          userRole,
          requiredRoles: allowedRolesArray,
          url: req.url,
          ip: req.ip,
        });

        return res.status(403).json({
          success: false,
          error: "Permisos insuficientes",
        });
      }

      next();
    };
  };

  /**
   * Middleware para verificar que el usuario acceda solo a sus propios recursos
   */
  requireOwnership = (resourceIdParam = "id") => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Autenticación requerida",
        });
      }

      const resourceId = req.params[resourceIdParam];
      const userId = req.user.id;

      // Los admins pueden acceder a cualquier recurso
      if (req.user.role === "admin" || req.user.role === "super_admin") {
        return next();
      }

      // Para clientes, solo pueden acceder a sus propios recursos
      if (req.user.type === "client" && resourceId !== userId.toString()) {
        logger.warn("Intento de acceso a recurso no autorizado", {
          userId,
          resourceId,
          url: req.url,
          ip: req.ip,
        });

        return res.status(403).json({
          success: false,
          error: "Acceso no autorizado a este recurso",
        });
      }

      next();
    };
  };

  /**
   * Middleware opcional de autenticación (no falla si no hay token)
   */
  optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(); // Continuar sin usuario autenticado
    }

    // Usar el middleware de autenticación normal pero capturar errores
    try {
      await this.authenticate(req, res, next);
    } catch (error) {
      // Si hay error en autenticación opcional, continuar sin usuario
      next();
    }
  };

  /**
   * Gestión de cache de usuarios
   */
  getUserFromCache(key) {
    const cached = this.userCache.get(key);
    if (!cached) return null;

    const { user, timestamp } = cached;
    const now = Date.now();

    if (now - timestamp > this.cacheExpiry) {
      this.userCache.delete(key);
      return null;
    }

    return user;
  }

  addUserToCache(key, user) {
    this.userCache.set(key, {
      user,
      timestamp: Date.now(),
    });

    // Limpiar cache periódicamente
    if (this.userCache.size > 1000) {
      this.cleanCache();
    }
  }

  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.userCache.entries()) {
      if (now - value.timestamp > this.cacheExpiry) {
        this.userCache.delete(key);
      }
    }
  }

  /**
   * Middleware para rate limiting por usuario autenticado
   */
  userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
    const userRequests = new Map();

    return (req, res, next) => {
      if (!req.user) {
        return next(); // Si no hay usuario, usar rate limiting general
      }

      const userId = req.user.id;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Obtener requests del usuario
      let requests = userRequests.get(userId) || [];

      // Filtrar requests dentro de la ventana de tiempo
      requests = requests.filter((timestamp) => timestamp > windowStart);

      if (requests.length >= maxRequests) {
        logger.warn("Rate limit excedido por usuario", {
          userId,
          requests: requests.length,
          maxRequests,
          ip: req.ip,
        });

        return res.status(429).json({
          success: false,
          error: "Demasiadas solicitudes. Intenta más tarde.",
          retryAfter: Math.ceil(windowMs / 1000),
        });
      }

      // Agregar request actual
      requests.push(now);
      userRequests.set(userId, requests);

      // Limpiar datos antiguos periódicamente
      if (userRequests.size > 1000) {
        for (const [key, value] of userRequests.entries()) {
          const filteredRequests = value.filter(
            (timestamp) => timestamp > windowStart,
          );
          if (filteredRequests.length === 0) {
            userRequests.delete(key);
          } else {
            userRequests.set(key, filteredRequests);
          }
        }
      }

      next();
    };
  };

  /**
   * Generar tokens seguros (access + refresh)
   */
  generateTokens = async (user, deviceInfo = {}) => {
    try {
      const sessionId = crypto.randomUUID();
      const tokenId = crypto.randomUUID();

      const payload = {
        id: user.id,
        email: user.email,
        role: user.role || "client",
        type: user.type || "client",
        sessionId,
        tokenId,
        iss: this.tokenConfig.issuer,
        aud: this.tokenConfig.audience,
      };

      // Generar access token
      const accessToken = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.tokenConfig.accessTokenExpiry,
        algorithm: "HS256",
      });

      // Generar refresh token
      const refreshToken = jwt.sign(
        { ...payload, type: "refresh" },
        this.jwtRefreshSecret,
        {
          expiresIn: this.tokenConfig.refreshTokenExpiry,
          algorithm: "HS256",
        },
      );

      // Guardar sesión activa
      const sessionData = {
        userId: user.id,
        sessionId,
        tokenId,
        deviceInfo,
        createdAt: new Date(),
        lastActivity: new Date(),
        isActive: true,
      };

      await this.saveSession(sessionData);
      this.addActiveSession(user.id, sessionData);

      return {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60, // 15 minutos en segundos
        tokenType: "Bearer",
        sessionId,
      };
    } catch (error) {
      logger.error("Error generating tokens", {
        error: error.message,
        userId: user.id,
      });
      throw new Error("Token generation failed");
    }
  };

  /**
   * Refrescar access token
   */
  refreshAccessToken = async (refreshToken, deviceInfo = {}) => {
    try {
      // Verificar refresh token
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret);

      if (decoded.type !== "refresh") {
        throw new Error("Invalid refresh token type");
      }

      // Verificar que la sesión esté activa
      const session = await this.getSession(decoded.sessionId);
      if (!session || !session.isActive) {
        throw new Error("Session not found or inactive");
      }

      // Buscar usuario
      let userResult;
      if (decoded.type === "client") {
        userResult = await this.clientModel.getById(decoded.id);
      } else {
        userResult = await this.userModel.getById(decoded.id);
      }

      if (!userResult.success || !userResult.data) {
        throw new Error("User not found");
      }

      const user = userResult.data;

      // Verificar que el usuario esté activo
      if (user.status !== "active") {
        throw new Error("User account is not active");
      }

      // Generar nuevo access token
      const newTokenId = crypto.randomUUID();
      const payload = {
        id: user.id,
        email: user.email,
        role: user.role || "client",
        type: user.type || "client",
        sessionId: decoded.sessionId,
        tokenId: newTokenId,
        iss: this.tokenConfig.issuer,
        aud: this.tokenConfig.audience,
      };

      const accessToken = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.tokenConfig.accessTokenExpiry,
        algorithm: "HS256",
      });

      // Actualizar sesión
      await this.updateSessionActivity(decoded.sessionId, {
        tokenId: newTokenId,
        deviceInfo,
      });

      return {
        accessToken,
        expiresIn: 15 * 60,
        tokenType: "Bearer",
      };
    } catch (error) {
      logger.error("Error refreshing token", { error: error.message });
      throw new Error("Token refresh failed");
    }
  };

  /**
   * Validar credenciales con protección contra brute force
   */
  validateCredentials = async (email, password, ip) => {
    try {
      // Verificar intentos de login
      const attemptKey = `${email}:${ip}`;
      const attempts = this.loginAttempts.get(attemptKey) || {
        count: 0,
        lastAttempt: 0,
      };

      const now = Date.now();

      // Verificar si está bloqueado
      if (attempts.count >= this.maxLoginAttempts) {
        const timeSinceLastAttempt = now - attempts.lastAttempt;
        if (timeSinceLastAttempt < this.lockoutDuration) {
          const remainingTime = Math.ceil(
            (this.lockoutDuration - timeSinceLastAttempt) / 1000 / 60,
          );
          throw new Error(
            `Account locked. Try again in ${remainingTime} minutes.`,
          );
        } else {
          // Reset attempts after lockout period
          this.loginAttempts.delete(attemptKey);
        }
      }

      // Buscar usuario por email
      const userResult = await this.userModel.getByEmail(email);
      if (!userResult.success || !userResult.data) {
        // Incrementar intentos fallidos
        attempts.count++;
        attempts.lastAttempt = now;
        this.loginAttempts.set(attemptKey, attempts);

        throw new Error("Invalid credentials");
      }

      const user = userResult.data;

      // Verificar password
      const isValidPassword = await bcrypt.compare(
        password,
        user.password_hash,
      );
      if (!isValidPassword) {
        // Incrementar intentos fallidos
        attempts.count++;
        attempts.lastAttempt = now;
        this.loginAttempts.set(attemptKey, attempts);

        throw new Error("Invalid credentials");
      }

      // Verificar estado del usuario
      if (user.status !== "active") {
        throw new Error("Account is not active");
      }

      // Login exitoso - limpiar intentos
      this.loginAttempts.delete(attemptKey);

      return { success: true, user };
    } catch (error) {
      logger.warn("Login attempt failed", {
        email,
        ip,
        error: error.message,
        attempts: this.loginAttempts.get(`${email}:${ip}`)?.count || 0,
      });
      throw error;
    }
  };

  /**
   * Verificar 2FA
   */
  verify2FA = async (userId, token) => {
    try {
      const userResult = await this.userModel.getById(userId);
      if (!userResult.success || !userResult.data) {
        throw new Error("User not found");
      }

      const user = userResult.data;

      if (!user.two_factor_secret) {
        throw new Error("2FA not enabled for this user");
      }

      const verified = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: "base32",
        token: token,
        window: 2, // Allow 2 time steps of variance
      });

      if (!verified) {
        throw new Error("Invalid 2FA token");
      }

      return { success: true };
    } catch (error) {
      logger.warn("2FA verification failed", { userId, error: error.message });
      throw error;
    }
  };

  /**
   * Logout y revocación de tokens
   */
  logout = async (sessionId, revokeAll = false) => {
    try {
      if (revokeAll) {
        // Revocar todas las sesiones del usuario
        const session = await this.getSession(sessionId);
        if (session) {
          await this.revokeAllUserSessions(session.userId);
        }
      } else {
        // Revocar solo la sesión actual
        await this.revokeSession(sessionId);
      }

      return { success: true };
    } catch (error) {
      logger.error("Logout error", { error: error.message, sessionId });
      throw error;
    }
  };

  /**
   * Gestión de sesiones activas
   */
  addActiveSession = (userId, sessionData) => {
    const userSessions = this.activeSessions.get(userId) || [];
    userSessions.push(sessionData);

    // Limitar número de sesiones por usuario
    if (userSessions.length > this.maxSessionsPerUser) {
      const oldestSession = userSessions.shift();
      this.revokeSession(oldestSession.sessionId);
    }

    this.activeSessions.set(userId, userSessions);
  };

  /**
   * Guardar sesión en base de datos
   */
  saveSession = async (sessionData) => {
    try {
      await DatabaseAdapter.insert("user_sessions", {
        id: sessionData.sessionId,
        user_id: sessionData.userId,
        token_id: sessionData.tokenId,
        device_info: sessionData.deviceInfo,
        created_at: sessionData.createdAt.toISOString(),
        last_activity: sessionData.lastActivity.toISOString(),
        is_active: sessionData.isActive,
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(), // 7 días
      });
    } catch (error) {
      logger.error("Error saving session", {
        error: error.message,
        sessionId: sessionData.sessionId,
      });
    }
  };

  /**
   * Obtener sesión de base de datos
   */
  getSession = async (sessionId) => {
    try {
      const result = await DatabaseAdapter.select("user_sessions", "*", {
        id: sessionId,
      });
      return result.data?.[0] || null;
    } catch (error) {
      logger.error("Error getting session", {
        error: error.message,
        sessionId,
      });
      return null;
    }
  };

  /**
   * Actualizar actividad de sesión
   */
  updateSessionActivity = async (sessionId, updates = {}) => {
    try {
      await DatabaseAdapter.update(
        "user_sessions",
        {
          last_activity: new Date().toISOString(),
          ...updates,
        },
        { id: sessionId },
      );
    } catch (error) {
      logger.error("Error updating session activity", {
        error: error.message,
        sessionId,
      });
    }
  };

  /**
   * Revocar sesión específica
   */
  revokeSession = async (sessionId) => {
    try {
      await DatabaseAdapter.update(
        "user_sessions",
        {
          is_active: false,
          revoked_at: new Date().toISOString(),
        },
        { id: sessionId },
      );

      // Remover de cache
      for (const [userId, sessions] of this.activeSessions.entries()) {
        const filteredSessions = sessions.filter(
          (s) => s.sessionId !== sessionId,
        );
        if (filteredSessions.length !== sessions.length) {
          this.activeSessions.set(userId, filteredSessions);
        }
      }
    } catch (error) {
      logger.error("Error revoking session", {
        error: error.message,
        sessionId,
      });
    }
  };

  /**
   * Revocar todas las sesiones de un usuario
   */
  revokeAllUserSessions = async (userId) => {
    try {
      await DatabaseAdapter.update(
        "user_sessions",
        {
          is_active: false,
          revoked_at: new Date().toISOString(),
        },
        { user_id: userId },
      );

      // Remover de cache
      this.activeSessions.delete(userId);
    } catch (error) {
      logger.error("Error revoking all user sessions", {
        error: error.message,
        userId,
      });
    }
  };

  /**
   * Limpiar sesiones expiradas
   */
  cleanupExpiredSessions = async () => {
    try {
      const result = await DatabaseAdapter.query(`
        UPDATE user_sessions 
        SET is_active = false, revoked_at = NOW()
        WHERE expires_at < NOW() AND is_active = true
      `);

      logger.info("Expired sessions cleaned up", {
        count: result.rowCount || 0,
      });
    } catch (error) {
      logger.error("Error cleaning up expired sessions", {
        error: error.message,
      });
    }
  };

  /**
   * Middleware para verificar permisos específicos
   */
  requirePermission = (permission) => {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: "Authentication required",
          });
        }

        // Verificar permisos en base de datos
        const hasPermission = await this.checkUserPermission(
          req.user.id,
          permission,
        );

        if (!hasPermission) {
          logger.warn("Permission denied", {
            userId: req.user.id,
            permission,
            url: req.originalUrl,
            ip: req.ip,
          });

          return res.status(403).json({
            success: false,
            error: "Insufficient permissions",
          });
        }

        next();
      } catch (error) {
        logger.error("Permission check error", {
          error: error.message,
          userId: req.user?.id,
          permission,
        });

        res.status(500).json({
          success: false,
          error: "Permission check failed",
        });
      }
    };
  };

  /**
   * Verificar permisos de usuario
   */
  checkUserPermission = async (userId, permission) => {
    try {
      const result = await DatabaseAdapter.query(
        `
        SELECT 1 FROM user_permissions up
        JOIN permissions p ON up.permission_id = p.id
        WHERE up.user_id = $1 AND p.name = $2 AND up.is_active = true
      `,
        [userId, permission],
      );

      return result.data && result.data.length > 0;
    } catch (error) {
      logger.error("Error checking user permission", {
        error: error.message,
        userId,
        permission,
      });
      return false;
    }
  };
}

// Crear instancia singleton
const authMiddleware = new AuthMiddleware();

// Iniciar limpieza periódica de sesiones
setInterval(
  () => {
    authMiddleware.cleanupExpiredSessions();
  },
  60 * 60 * 1000,
); // Cada hora

module.exports = {
  authenticate: authMiddleware.authenticate,
  requireRole: authMiddleware.requireRole,
  requireOwnership: authMiddleware.requireOwnership,
  optionalAuth: authMiddleware.optionalAuth,
  userRateLimit: authMiddleware.userRateLimit,
};
