// src/controllers/authController.js
// Autenticación simple para el dashboard administrativo

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const logger = require("../utils/logger");

class AuthController {
  /**
   * Login para administradores
   */
  static async login(req, res) {
    try {
      const { username, password } = req.body;

      // Validar entrada
      if (!username || !password) {
        logger.security("Admin login attempt with missing credentials", {
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        });

        return res.status(400).json({
          success: false,
          error: "Username and password required",
        });
      }

      // Credenciales de administrador (en producción usar base de datos)
      const adminCredentials = {
        username: process.env.ADMIN_USERNAME || "admin",
        password: process.env.ADMIN_PASSWORD || "admin123", // CAMBIAR EN PRODUCCIÓN
      };

      // Verificar credenciales
      const isValidUsername = username === adminCredentials.username;
      const isValidPassword = await bcrypt.compare(
        password,
        await bcrypt.hash(adminCredentials.password, 10)
      );

      if (!isValidUsername || !isValidPassword) {
        logger.security("Failed admin login attempt", {
          username,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        });

        return res.status(401).json({
          success: false,
          error: "Invalid credentials",
        });
      }

      // Generar JWT token
      const token = jwt.sign(
        {
          username,
          role: "admin",
          loginTime: new Date().toISOString(),
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "8h", // Token válido por 8 horas
        }
      );

      // Log de login exitoso
      logger.audit("Admin login successful", username, "auth_login", {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({
        success: true,
        data: {
          token,
          user: {
            username,
            role: "admin",
          },
          expiresIn: "8h",
        },
      });
    } catch (error) {
      logger.error("Error in admin login", error, {
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        error: "Login failed",
      });
    }
  }

  /**
   * Verificar token JWT
   */
  static async verifyToken(req, res) {
    try {
      const token = req.headers.authorization?.split(" ")[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          error: "No token provided",
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      res.json({
        success: true,
        data: {
          user: {
            username: decoded.username,
            role: decoded.role,
          },
          loginTime: decoded.loginTime,
        },
      });
    } catch (error) {
      logger.security("Invalid token verification attempt", {
        error: error.message,
        ip: req.ip,
      });

      res.status(401).json({
        success: false,
        error: "Invalid token",
      });
    }
  }

  /**
   * Logout (invalidar token del lado cliente)
   */
  static async logout(req, res) {
    try {
      const username = req.user?.username || "unknown";

      logger.audit("Admin logout", username, "auth_logout", {
        ip: req.ip,
      });

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      logger.error("Error in admin logout", error);

      res.status(500).json({
        success: false,
        error: "Logout failed",
      });
    }
  }

  /**
   * Registro de nuevos usuarios (placeholder - no implementado por seguridad)
   */
  static async register(req, res) {
    try {
      // En un sistema de producción, esto requeriría validación adicional
      // Por ahora, devolvemos un error indicando que no está implementado
      logger.security("Registration attempt blocked", {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(403).json({
        success: false,
        error: "Registration is not available. Contact administrator.",
      });
    } catch (error) {
      logger.error("Error in register attempt", error);
      res.status(500).json({
        success: false,
        error: "Registration failed",
      });
    }
  }

  /**
   * Refrescar token JWT
   */
  static async refreshToken(req, res) {
    try {
      const token = req.headers.authorization?.split(" ")[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          error: "No token provided",
        });
      }

      // Verificar token actual (incluso si está expirado)
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (error) {
        if (error.name === "TokenExpiredError") {
          // Token expirado, pero podemos intentar refrescarlo
          decoded = jwt.decode(token);
        } else {
          throw error;
        }
      }

      if (!decoded || !decoded.username) {
        return res.status(401).json({
          success: false,
          error: "Invalid token",
        });
      }

      // Generar nuevo token
      const newToken = jwt.sign(
        {
          username: decoded.username,
          role: decoded.role,
          loginTime: new Date().toISOString(),
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "8h",
        }
      );

      logger.audit("Token refreshed", decoded.username, "token_refresh", {
        ip: req.ip,
      });

      res.json({
        success: true,
        data: {
          token: newToken,
          user: {
            username: decoded.username,
            role: decoded.role,
          },
          expiresIn: "8h",
        },
      });
    } catch (error) {
      logger.security("Token refresh failed", {
        error: error.message,
        ip: req.ip,
      });

      res.status(401).json({
        success: false,
        error: "Token refresh failed",
      });
    }
  }

  /**
   * Generar token temporal para acceso rápido
   */
  static async generateTempToken(req, res) {
    try {
      // Solo en desarrollo
      if (process.env.NODE_ENV === "production") {
        return res.status(403).json({
          success: false,
          error: "Temporary tokens not allowed in production",
        });
      }

      const tempToken = jwt.sign(
        {
          username: "temp_admin",
          role: "admin",
          temporary: true,
          loginTime: new Date().toISOString(),
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "1h", // Token temporal válido por 1 hora
        }
      );

      logger.audit(
        "Temporary admin token generated",
        "temp_admin",
        "temp_token",
        {
          ip: req.ip,
        }
      );

      res.json({
        success: true,
        data: {
          token: tempToken,
          expiresIn: "1h",
          warning: "This is a temporary token for development only",
        },
      });
    } catch (error) {
      logger.error("Error generating temporary token", error);

      res.status(500).json({
        success: false,
        error: "Failed to generate temporary token",
      });
    }
  }
}

module.exports = AuthController;
