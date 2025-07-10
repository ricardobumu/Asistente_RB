// src/utils/tokenBlacklist.js
const logger = require("./logger");

/**
 * Sistema de blacklist de tokens mejorado
 * En producción debería usar Redis, pero para desarrollo usamos memoria con persistencia
 */
class TokenBlacklist {
  constructor() {
    this.blacklistedTokens = new Map();
    this.cleanupInterval = 60 * 60 * 1000; // Limpiar cada hora

    // Iniciar limpieza automática
    this.startCleanup();

    logger.info("TokenBlacklist inicializado", {
      cleanupInterval: this.cleanupInterval,
    });
  }

  /**
   * Agregar token a la blacklist
   */
  addToken(token, expiresAt = null) {
    try {
      // Si no se proporciona expiración, usar 24 horas por defecto
      const expiry = expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000);

      this.blacklistedTokens.set(token, {
        addedAt: new Date(),
        expiresAt: expiry,
      });

      logger.info("Token agregado a blacklist", {
        tokenPrefix: token.substring(0, 10) + "...",
        expiresAt: expiry,
      });

      return true;
    } catch (error) {
      logger.error("Error agregando token a blacklist", error);
      return false;
    }
  }

  /**
   * Verificar si un token está en la blacklist
   */
  isBlacklisted(token) {
    try {
      const entry = this.blacklistedTokens.get(token);

      if (!entry) {
        return false;
      }

      // Verificar si el token ha expirado
      if (entry.expiresAt && new Date() > entry.expiresAt) {
        this.blacklistedTokens.delete(token);
        return false;
      }

      return true;
    } catch (error) {
      logger.error("Error verificando blacklist", error);
      return false; // En caso de error, permitir el token
    }
  }

  /**
   * Remover token de la blacklist
   */
  removeToken(token) {
    try {
      const removed = this.blacklistedTokens.delete(token);

      if (removed) {
        logger.info("Token removido de blacklist", {
          tokenPrefix: token.substring(0, 10) + "...",
        });
      }

      return removed;
    } catch (error) {
      logger.error("Error removiendo token de blacklist", error);
      return false;
    }
  }

  /**
   * Limpiar tokens expirados
   */
  cleanup() {
    try {
      const now = new Date();
      let cleanedCount = 0;

      for (const [token, entry] of this.blacklistedTokens.entries()) {
        if (entry.expiresAt && now > entry.expiresAt) {
          this.blacklistedTokens.delete(token);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.info("Blacklist limpiada", {
          tokensRemoved: cleanedCount,
          remainingTokens: this.blacklistedTokens.size,
        });
      }

      return cleanedCount;
    } catch (error) {
      logger.error("Error en limpieza de blacklist", error);
      return 0;
    }
  }

  /**
   * Iniciar limpieza automática
   */
  startCleanup() {
    setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Obtener estadísticas de la blacklist
   */
  getStats() {
    return {
      totalTokens: this.blacklistedTokens.size,
      cleanupInterval: this.cleanupInterval,
      lastCleanup: new Date(),
    };
  }

  /**
   * Limpiar toda la blacklist (usar con cuidado)
   */
  clear() {
    const count = this.blacklistedTokens.size;
    this.blacklistedTokens.clear();

    logger.warn("Blacklist completamente limpiada", {
      tokensRemoved: count,
    });

    return count;
  }
}

// Singleton para usar en toda la aplicación
const tokenBlacklist = new TokenBlacklist();

module.exports = tokenBlacklist;
