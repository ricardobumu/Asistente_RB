// src/api/controllers/authController.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const logger = require("../../utils/logger");
const userModel = require("../../models/userModel");
const clientModel = require("../../models/clientModel");
const { validateEmail, validatePhone } = require("../../utils/validators");
const tokenBlacklist = require("../../utils/tokenBlacklist");

/**
 * AuthController - Sistema de autenticación JWT robusto
 *
 * Funcionalidades:
 * - Login/Register para clientes y staff
 * - JWT con refresh tokens
 * - Rate limiting por usuario
 * - Auditoría de accesos
 * - Roles granulares
 */
class AuthController {
  constructor() {
    this.userModel = userModel;
    this.clientModel = clientModel;
    this.jwtSecret =
      process.env.JWT_SECRET || "fallback-secret-change-in-production";
    this.jwtRefreshSecret =
      process.env.JWT_REFRESH_SECRET || "fallback-refresh-secret";
    this.tokenExpiry = "15m"; // Access token corto
    this.refreshTokenExpiry = "7d"; // Refresh token más largo

    // Usar blacklist persistente mejorada
    this.tokenBlacklist = tokenBlacklist;

    logger.info("AuthController inicializado", {
      tokenExpiry: this.tokenExpiry,
      refreshTokenExpiry: this.refreshTokenExpiry,
    });
  }

  /**
   * Generar par de tokens JWT
   */
  generateTokens(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      type: user.type || "client", // client | staff | admin
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.tokenExpiry,
      issuer: "asistente-rb",
      audience: "asistente-rb-users",
    });

    const refreshToken = jwt.sign(
      { id: user.id, tokenVersion: user.token_version || 1 },
      this.jwtRefreshSecret,
      {
        expiresIn: this.refreshTokenExpiry,
        issuer: "asistente-rb",
        audience: "asistente-rb-refresh",
      }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Verificar token JWT
   */
  verifyToken(token, isRefresh = false) {
    try {
      if (this.tokenBlacklist.has(token)) {
        throw new Error("Token en blacklist");
      }

      const secret = isRefresh ? this.jwtRefreshSecret : this.jwtSecret;
      const decoded = jwt.verify(token, secret);

      return { valid: true, decoded };
    } catch (error) {
      logger.warn("Token inválido", { error: error.message });
      return { valid: false, error: error.message };
    }
  }

  /**
   * Login de cliente
   */
  async loginClient(req, res) {
    try {
      const { email, phone, password } = req.body;

      // Validar entrada
      if (!email && !phone) {
        return res.status(400).json({
          success: false,
          error: "Email o teléfono requerido",
        });
      }

      if (!password) {
        return res.status(400).json({
          success: false,
          error: "Contraseña requerida",
        });
      }

      // Buscar cliente
      let clientResult;
      if (email) {
        clientResult = await this.clientModel.getByEmail(email);
      } else {
        clientResult = await this.clientModel.getByPhone(phone);
      }

      if (!clientResult.success || !clientResult.data) {
        logger.warn("Intento de login con credenciales inexistentes", {
          email: email || "no-email",
          phone: phone || "no-phone",
          ip: req.ip,
        });

        return res.status(401).json({
          success: false,
          error: "Credenciales inválidas",
        });
      }

      const client = clientResult.data;

      // Verificar contraseña
      const passwordValid = await bcrypt.compare(
        password,
        client.password_hash
      );
      if (!passwordValid) {
        logger.warn("Intento de login con contraseña incorrecta", {
          clientId: client.id,
          email: client.email,
          ip: req.ip,
        });

        return res.status(401).json({
          success: false,
          error: "Credenciales inválidas",
        });
      }

      // Generar tokens
      const tokens = this.generateTokens({
        id: client.id,
        email: client.email,
        role: "client",
        type: "client",
      });

      // Actualizar último login
      await this.clientModel.updateLastLogin(client.id);

      // Log exitoso
      logger.info("Login exitoso de cliente", {
        clientId: client.id,
        email: client.email,
        ip: req.ip,
      });

      res.json({
        success: true,
        data: {
          user: {
            id: client.id,
            name: client.name,
            email: client.email,
            phone: client.phone,
            role: "client",
            vip_status: client.vip_status,
          },
          tokens,
        },
      });
    } catch (error) {
      logger.error("Error en login de cliente", error, {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Registro de cliente
   */
  async registerClient(req, res) {
    try {
      const { name, email, phone, password, whatsapp_number } = req.body;

      // Validaciones básicas
      if (!name || !email || !phone || !password) {
        return res.status(400).json({
          success: false,
          error: "Todos los campos son requeridos",
        });
      }

      // Validar formato de email
      if (!validateEmail(email)) {
        return res.status(400).json({
          success: false,
          error: "Formato de email inválido",
        });
      }

      // Validar formato de teléfono
      if (!validatePhone(phone)) {
        return res.status(400).json({
          success: false,
          error: "Formato de teléfono inválido",
        });
      }

      // Validar fortaleza de contraseña
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          error: "La contraseña debe tener al menos 8 caracteres",
        });
      }

      // Verificar si el cliente ya existe
      const existingByEmail = await this.clientModel.getByEmail(email);
      if (existingByEmail.success && existingByEmail.data) {
        return res.status(409).json({
          success: false,
          error: "Ya existe un cliente con este email",
        });
      }

      const existingByPhone = await this.clientModel.getByPhone(phone);
      if (existingByPhone.success && existingByPhone.data) {
        return res.status(409).json({
          success: false,
          error: "Ya existe un cliente con este teléfono",
        });
      }

      // Hash de la contraseña
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Crear cliente
      const clientData = {
        name,
        email,
        phone,
        whatsapp_number: whatsapp_number || phone,
        password_hash: passwordHash,
        preferred_contact_method: "whatsapp",
        email_verified: false,
        phone_verified: false,
      };

      const createResult = await this.clientModel.create(clientData);

      if (!createResult.success) {
        logger.error("Error creando cliente", createResult.error);
        return res.status(500).json({
          success: false,
          error: "Error creando cuenta",
        });
      }

      const newClient = createResult.data;

      // Generar tokens
      const tokens = this.generateTokens({
        id: newClient.id,
        email: newClient.email,
        role: "client",
        type: "client",
      });

      // Log exitoso
      logger.info("Registro exitoso de cliente", {
        clientId: newClient.id,
        email: newClient.email,
        ip: req.ip,
      });

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: newClient.id,
            name: newClient.name,
            email: newClient.email,
            phone: newClient.phone,
            role: "client",
            vip_status: newClient.vip_status || false,
          },
          tokens,
        },
      });
    } catch (error) {
      logger.error("Error en registro de cliente", error, {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Refresh token
   */
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: "Refresh token requerido",
        });
      }

      // Verificar refresh token
      const verification = this.verifyToken(refreshToken, true);
      if (!verification.valid) {
        return res.status(401).json({
          success: false,
          error: "Refresh token inválido",
        });
      }

      const { decoded } = verification;

      // Buscar usuario (cliente o staff)
      let user;
      if (decoded.type === "client") {
        const result = await this.clientModel.getById(decoded.id);
        user = result.success ? result.data : null;
      } else {
        const result = await this.userModel.getById(decoded.id);
        user = result.success ? result.data : null;
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          error: "Usuario no encontrado",
        });
      }

      // Verificar versión del token (para invalidar tokens antiguos)
      if (decoded.tokenVersion !== (user.token_version || 1)) {
        return res.status(401).json({
          success: false,
          error: "Token version inválida",
        });
      }

      // Generar nuevos tokens
      const tokens = this.generateTokens({
        id: user.id,
        email: user.email,
        role: user.role || "client",
        type: decoded.type || "client",
      });

      res.json({
        success: true,
        data: { tokens },
      });
    } catch (error) {
      logger.error("Error en refresh token", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Logout (invalidar tokens)
   */
  async logout(req, res) {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");

      if (token) {
        // Agregar token a blacklist
        this.tokenBlacklist.add(token);

        logger.info("Usuario deslogueado", {
          userId: req.user?.id,
          ip: req.ip,
        });
      }

      res.json({
        success: true,
        message: "Logout exitoso",
      });
    } catch (error) {
      logger.error("Error en logout", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Verificar estado de autenticación
   */
  async me(req, res) {
    try {
      const user = req.user; // Viene del middleware de autenticación

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            type: user.type,
          },
        },
      });
    } catch (error) {
      logger.error("Error en verificación de usuario", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
}

module.exports = AuthController;
