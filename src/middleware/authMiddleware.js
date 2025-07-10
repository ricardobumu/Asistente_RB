// src/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
const userModel = require("../models/userModel");
const clientModel = require("../models/clientModel");
const tokenBlacklist = require("../utils/tokenBlacklist");

/**
 * Middleware de autenticación JWT con roles granulares
 */
class AuthMiddleware {
  constructor() {
    this.userModel = userModel;
    this.clientModel = clientModel;
    this.jwtSecret =
      process.env.JWT_SECRET || "fallback-secret-change-in-production";

    // Cache de usuarios para evitar consultas repetidas
    this.userCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutos
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
            (timestamp) => timestamp > windowStart
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
}

// Crear instancia singleton
const authMiddleware = new AuthMiddleware();

module.exports = {
  authenticate: authMiddleware.authenticate,
  requireRole: authMiddleware.requireRole,
  requireOwnership: authMiddleware.requireOwnership,
  optionalAuth: authMiddleware.optionalAuth,
  userRateLimit: authMiddleware.userRateLimit,
};
