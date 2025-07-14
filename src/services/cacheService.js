// src/services/cacheService.js
// Servicio de cache inteligente para optimizar rendimiento

const logger = require("../utils/logger");
const { recordSystemError } = require("../middleware/metricsMiddleware");

class CacheService {
  constructor() {
    this.cache = new Map();
    this.ttlMap = new Map(); // Time to live para cada clave
    this.accessCount = new Map(); // Contador de accesos
    this.lastAccess = new Map(); // Último acceso
    
    // Configuración
    this.maxSize = 1000; // Máximo número de entradas
    this.defaultTTL = 5 * 60 * 1000; // 5 minutos por defecto
    this.cleanupInterval = 60 * 1000; // Limpiar cada minuto
    
    // Estadísticas
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      cleanups: 0
    };
    
    // Iniciar limpieza automática
    this.startCleanupTimer();
    
    logger.info("Cache service initialized", {
      maxSize: this.maxSize,
      defaultTTL: this.defaultTTL,
      cleanupInterval: this.cleanupInterval
    });
  }

  /**
   * Obtener valor del cache
   */
  get(key) {
    try {
      if (!this.cache.has(key)) {
        this.stats.misses++;
        return null;
      }

      // Verificar TTL
      const ttl = this.ttlMap.get(key);
      if (ttl && Date.now() > ttl) {
        this.delete(key);
        this.stats.misses++;
        return null;
      }

      // Actualizar estadísticas de acceso
      this.accessCount.set(key, (this.accessCount.get(key) || 0) + 1);
      this.lastAccess.set(key, Date.now());
      this.stats.hits++;

      const value = this.cache.get(key);
      
      logger.debug("Cache hit", { 
        key: this.sanitizeKey(key),
        accessCount: this.accessCount.get(key)
      });

      return value;

    } catch (error) {
      logger.error("Error getting from cache", { 
        key: this.sanitizeKey(key),
        error: error.message 
      });
      recordSystemError('cache_get', error, { key });
      return null;
    }
  }

  /**
   * Establecer valor en el cache
   */
  set(key, value, ttl = this.defaultTTL) {
    try {
      // Verificar límite de tamaño
      if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
        this.evictLeastUsed();
      }

      this.cache.set(key, value);
      this.ttlMap.set(key, Date.now() + ttl);
      this.accessCount.set(key, 1);
      this.lastAccess.set(key, Date.now());
      this.stats.sets++;

      logger.debug("Cache set", { 
        key: this.sanitizeKey(key),
        ttl,
        cacheSize: this.cache.size
      });

      return true;

    } catch (error) {
      logger.error("Error setting cache", { 
        key: this.sanitizeKey(key),
        error: error.message 
      });
      recordSystemError('cache_set', error, { key });
      return false;
    }
  }

  /**
   * Eliminar valor del cache
   */
  delete(key) {
    try {
      const deleted = this.cache.delete(key);
      if (deleted) {
        this.ttlMap.delete(key);
        this.accessCount.delete(key);
        this.lastAccess.delete(key);
        this.stats.deletes++;
        
        logger.debug("Cache delete", { 
          key: this.sanitizeKey(key),
          cacheSize: this.cache.size
        });
      }
      return deleted;

    } catch (error) {
      logger.error("Error deleting from cache", { 
        key: this.sanitizeKey(key),
        error: error.message 
      });
      recordSystemError('cache_delete', error, { key });
      return false;
    }
  }

  /**
   * Verificar si existe una clave
   */
  has(key) {
    try {
      if (!this.cache.has(key)) {
        return false;
      }

      // Verificar TTL
      const ttl = this.ttlMap.get(key);
      if (ttl && Date.now() > ttl) {
        this.delete(key);
        return false;
      }

      return true;

    } catch (error) {
      logger.error("Error checking cache", { 
        key: this.sanitizeKey(key),
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Limpiar cache expirado
   */
  cleanup() {
    try {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, ttl] of this.ttlMap.entries()) {
        if (ttl && now > ttl) {
          this.delete(key);
          cleaned++;
        }
      }

      this.stats.cleanups++;
      
      if (cleaned > 0) {
        logger.debug("Cache cleanup completed", { 
          cleaned,
          remaining: this.cache.size
        });
      }

      return cleaned;

    } catch (error) {
      logger.error("Error during cache cleanup", { error: error.message });
      recordSystemError('cache_cleanup', error);
      return 0;
    }
  }

  /**
   * Evitar el elemento menos usado (LRU)
   */
  evictLeastUsed() {
    try {
      let leastUsedKey = null;
      let leastAccess = Infinity;
      let oldestAccess = Infinity;

      for (const [key, accessCount] of this.accessCount.entries()) {
        const lastAccessTime = this.lastAccess.get(key) || 0;
        
        // Priorizar por menor uso, luego por más antiguo
        if (accessCount < leastAccess || 
           (accessCount === leastAccess && lastAccessTime < oldestAccess)) {
          leastUsedKey = key;
          leastAccess = accessCount;
          oldestAccess = lastAccessTime;
        }
      }

      if (leastUsedKey) {
        this.delete(leastUsedKey);
        this.stats.evictions++;
        
        logger.debug("Cache eviction", { 
          key: this.sanitizeKey(leastUsedKey),
          accessCount: leastAccess,
          cacheSize: this.cache.size
        });
      }

    } catch (error) {
      logger.error("Error during cache eviction", { error: error.message });
      recordSystemError('cache_eviction', error);
    }
  }

  /**
   * Limpiar todo el cache
   */
  clear() {
    try {
      const size = this.cache.size;
      this.cache.clear();
      this.ttlMap.clear();
      this.accessCount.clear();
      this.lastAccess.clear();

      logger.info("Cache cleared", { previousSize: size });
      return true;

    } catch (error) {
      logger.error("Error clearing cache", { error: error.message });
      recordSystemError('cache_clear', error);
      return false;
    }
  }

  /**
   * Obtener estadísticas del cache
   */
  getStats() {
    try {
      const hitRate = this.stats.hits + this.stats.misses > 0 ? 
        (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2) : 0;

      return {
        ...this.stats,
        hitRate: hitRate + '%',
        size: this.cache.size,
        maxSize: this.maxSize,
        memoryUsage: this.getMemoryUsage()
      };

    } catch (error) {
      logger.error("Error getting cache stats", { error: error.message });
      return null;
    }
  }

  /**
   * Estimar uso de memoria del cache
   */
  getMemoryUsage() {
    try {
      let totalSize = 0;
      
      for (const [key, value] of this.cache.entries()) {
        totalSize += this.estimateSize(key) + this.estimateSize(value);
      }
      
      return {
        estimated: totalSize,
        formatted: this.formatBytes(totalSize)
      };

    } catch (error) {
      logger.error("Error calculating memory usage", { error: error.message });
      return { estimated: 0, formatted: '0 B' };
    }
  }

  /**
   * Estimar tamaño de un objeto en bytes
   */
  estimateSize(obj) {
    try {
      if (obj === null || obj === undefined) return 0;
      if (typeof obj === 'string') return obj.length * 2; // UTF-16
      if (typeof obj === 'number') return 8;
      if (typeof obj === 'boolean') return 4;
      if (typeof obj === 'object') {
        return JSON.stringify(obj).length * 2;
      }
      return 0;

    } catch (error) {
      return 0;
    }
  }

  /**
   * Formatear bytes en formato legible
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Sanitizar clave para logs (remover información sensible)
   */
  sanitizeKey(key) {
    if (typeof key !== 'string') return '[non-string-key]';
    
    // Remover números de teléfono, emails, etc.
    return key
      .replace(/\+?\d{10,}/g, '[PHONE]')
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
      .replace(/[a-f0-9]{32,}/g, '[HASH]');
  }

  /**
   * Iniciar timer de limpieza automática
   */
  startCleanupTimer() {
    setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Método helper para cache con función de carga
   */
  async getOrSet(key, loadFunction, ttl = this.defaultTTL) {
    try {
      // Intentar obtener del cache
      let value = this.get(key);
      
      if (value !== null) {
        return value;
      }

      // Si no está en cache, cargar y guardar
      value = await loadFunction();
      
      if (value !== null && value !== undefined) {
        this.set(key, value, ttl);
      }

      return value;

    } catch (error) {
      logger.error("Error in getOrSet", { 
        key: this.sanitizeKey(key),
        error: error.message 
      });
      recordSystemError('cache_getOrSet', error, { key });
      
      // En caso de error, intentar ejecutar la función de carga directamente
      try {
        return await loadFunction();
      } catch (loadError) {
        logger.error("Error in load function fallback", { 
          key: this.sanitizeKey(key),
          error: loadError.message 
        });
        return null;
      }
    }
  }

  /**
   * Invalidar cache por patrón
   */
  invalidatePattern(pattern) {
    try {
      let invalidated = 0;
      const regex = new RegExp(pattern);

      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          this.delete(key);
          invalidated++;
        }
      }

      logger.debug("Cache pattern invalidation", { 
        pattern,
        invalidated,
        remaining: this.cache.size
      });

      return invalidated;

    } catch (error) {
      logger.error("Error invalidating cache pattern", { 
        pattern,
        error: error.message 
      });
      recordSystemError('cache_invalidate_pattern', error, { pattern });
      return 0;
    }
  }

  /**
   * Obtener claves que coinciden con un patrón
   */
  getKeysByPattern(pattern) {
    try {
      const regex = new RegExp(pattern);
      const matchingKeys = [];

      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          matchingKeys.push(key);
        }
      }

      return matchingKeys;

    } catch (error) {
      logger.error("Error getting keys by pattern", { 
        pattern,
        error: error.message 
      });
      return [];
    }
  }
}

// Exportar instancia singleton
module.exports = new CacheService();