// src/middleware/performanceMiddleware.js
// Middleware de optimización de rendimiento

const compression = require("compression");
const responseTime = require("response-time");
const logger = require("../utils/logger");
const DatabaseAdapter = require("../adapters/databaseAdapter");

class PerformanceMiddleware {
  constructor() {
    // Cache en memoria para consultas frecuentes
    this.queryCache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
    };

    // Configuración de cache
    this.cacheConfig = {
      defaultTTL: 5 * 60 * 1000, // 5 minutos
      maxSize: 1000, // Máximo 1000 entradas
      cleanupInterval: 10 * 60 * 1000, // Limpiar cada 10 minutos
    };

    // Métricas de rendimiento
    this.performanceMetrics = {
      requests: 0,
      totalResponseTime: 0,
      slowQueries: [],
      errorCount: 0,
      cacheHitRate: 0,
    };

    // Iniciar limpieza periódica
    this.startCacheCleanup();
  }

  /**
   * Middleware de compresión inteligente
   */
  static compressionMiddleware() {
    return compression({
      // Comprimir solo si el tamaño es mayor a 1KB
      threshold: 1024,

      // Nivel de compresión (1-9, 6 es el balance óptimo)
      level: 6,

      // Filtrar qué comprimir
      filter: (req, res) => {
        // No comprimir si el cliente no lo soporta
        if (req.headers["x-no-compression"]) {
          return false;
        }

        // Comprimir por defecto
        return compression.filter(req, res);
      },

      // Configuración de memoria
      memLevel: 8,
      windowBits: 15,
    });
  }

  /**
   * Middleware de tiempo de respuesta
   */
  static responseTimeMiddleware() {
    return responseTime((req, res, time) => {
      // Log de requests lentos
      if (time > 1000) {
        // Más de 1 segundo
        logger.warn("Slow request detected", {
          method: req.method,
          url: req.originalUrl,
          responseTime: `${time.toFixed(2)}ms`,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        });
      }

      // Agregar header de tiempo de respuesta
      res.set("X-Response-Time", `${time.toFixed(2)}ms`);

      // Actualizar métricas
      PerformanceMiddleware.updateMetrics(time);
    });
  }

  /**
   * Cache de consultas de base de datos
   */
  static queryCache(ttl = null) {
    const instance = new PerformanceMiddleware();

    return (req, res, next) => {
      // Solo cachear GET requests
      if (req.method !== "GET") {
        return next();
      }

      // Generar clave de cache
      const cacheKey = instance.generateCacheKey(req);

      // Buscar en cache
      const cached = instance.getFromCache(cacheKey);
      if (cached) {
        instance.cacheStats.hits++;

        // Agregar headers de cache
        res.set("X-Cache", "HIT");
        res.set("X-Cache-Key", cacheKey.substring(0, 16) + "...");

        return res.json(cached.data);
      }

      instance.cacheStats.misses++;

      // Interceptar respuesta para cachear
      const originalJson = res.json;
      res.json = function (data) {
        // Solo cachear respuestas exitosas
        if (res.statusCode === 200 && data && data.success) {
          instance.setCache(cacheKey, data, ttl);
          instance.cacheStats.sets++;
        }

        // Agregar headers de cache
        res.set("X-Cache", "MISS");
        res.set("X-Cache-Key", cacheKey.substring(0, 16) + "...");

        return originalJson.call(this, data);
      };

      next();
    };
  }

  /**
   * Middleware de optimización de consultas
   */
  static queryOptimization() {
    return async (req, res, next) => {
      // Interceptar consultas a la base de datos
      const originalQuery = DatabaseAdapter.query;

      DatabaseAdapter.query = async function (query, params = []) {
        const startTime = Date.now();

        try {
          const result = await originalQuery.call(this, query, params);
          const duration = Date.now() - startTime;

          // Log de consultas lentas
          if (duration > 500) {
            // Más de 500ms
            logger.warn("Slow database query", {
              query:
                query.substring(0, 200) + (query.length > 200 ? "..." : ""),
              duration: `${duration}ms`,
              params: params.length,
              url: req.originalUrl,
            });

            // Guardar para análisis
            PerformanceMiddleware.recordSlowQuery({
              query,
              duration,
              url: req.originalUrl,
              timestamp: new Date(),
            });
          }

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;

          logger.error("Database query error", {
            query: query.substring(0, 200) + (query.length > 200 ? "..." : ""),
            duration: `${duration}ms`,
            error: error.message,
            url: req.originalUrl,
          });

          throw error;
        }
      };

      // Restaurar función original al finalizar
      res.on("finish", () => {
        DatabaseAdapter.query = originalQuery;
      });

      next();
    };
  }

  /**
   * Middleware de paginación eficiente
   */
  static efficientPagination() {
    return (req, res, next) => {
      // Validar y optimizar parámetros de paginación
      let { page = 1, limit = 20 } = req.query;

      // Convertir a números
      page = parseInt(page);
      limit = parseInt(limit);

      // Validar rangos
      if (page < 1) page = 1;
      if (limit < 1) limit = 1;
      if (limit > 100) limit = 100; // Máximo 100 elementos por página

      // Calcular offset de manera eficiente
      const offset = (page - 1) * limit;

      // Agregar a la request
      req.pagination = {
        page,
        limit,
        offset,
        // Función helper para generar respuesta paginada
        createResponse: (data, total) => ({
          success: true,
          data,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: page < Math.ceil(total / limit),
            hasPrev: page > 1,
            nextPage: page < Math.ceil(total / limit) ? page + 1 : null,
            prevPage: page > 1 ? page - 1 : null,
          },
        }),
      };

      next();
    };
  }

  /**
   * Middleware de headers de rendimiento
   */
  static performanceHeaders() {
    return (req, res, next) => {
      const startTime = process.hrtime();

      res.on("finish", () => {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const duration = seconds * 1000 + nanoseconds / 1000000;

        // Headers de rendimiento
        res.set("X-Process-Time", `${duration.toFixed(2)}ms`);
        res.set(
          "X-Node-Memory",
          `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        );
        res.set("X-Node-Uptime", `${Math.round(process.uptime())}s`);

        // Headers de cache
        const cacheStats = PerformanceMiddleware.getCacheStats();
        res.set("X-Cache-Hit-Rate", `${cacheStats.hitRate.toFixed(2)}%`);
      });

      next();
    };
  }

  /**
   * Generar clave de cache
   */
  generateCacheKey(req) {
    const key = `${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`;
    return require("crypto").createHash("md5").update(key).digest("hex");
  }

  /**
   * Obtener del cache
   */
  getFromCache(key) {
    const cached = this.queryCache.get(key);
    if (!cached) return null;

    // Verificar TTL
    if (Date.now() > cached.expires) {
      this.queryCache.delete(key);
      this.cacheStats.deletes++;
      return null;
    }

    return cached;
  }

  /**
   * Guardar en cache
   */
  setCache(key, data, ttl = null) {
    const expires = Date.now() + (ttl || this.cacheConfig.defaultTTL);

    // Verificar límite de tamaño
    if (this.queryCache.size >= this.cacheConfig.maxSize) {
      this.evictOldestEntries();
    }

    this.queryCache.set(key, {
      data,
      expires,
      created: Date.now(),
      hits: 0,
    });
  }

  /**
   * Limpiar entradas más antiguas
   */
  evictOldestEntries() {
    const entries = Array.from(this.queryCache.entries());

    // Ordenar por fecha de creación
    entries.sort((a, b) => a[1].created - b[1].created);

    // Eliminar el 20% más antiguo
    const toDelete = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toDelete; i++) {
      this.queryCache.delete(entries[i][0]);
      this.cacheStats.deletes++;
    }
  }

  /**
   * Limpiar cache expirado
   */
  cleanupExpiredCache() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.queryCache.entries()) {
      if (now > value.expires) {
        this.queryCache.delete(key);
        cleaned++;
      }
    }

    this.cacheStats.deletes += cleaned;

    if (cleaned > 0) {
      logger.info("Cache cleanup completed", {
        entriesRemoved: cleaned,
        remainingEntries: this.queryCache.size,
        hitRate: this.getCacheHitRate(),
      });
    }
  }

  /**
   * Iniciar limpieza periódica
   */
  startCacheCleanup() {
    setInterval(() => {
      this.cleanupExpiredCache();
    }, this.cacheConfig.cleanupInterval);
  }

  /**
   * Obtener tasa de aciertos de cache
   */
  getCacheHitRate() {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    return total > 0 ? (this.cacheStats.hits / total) * 100 : 0;
  }

  /**
   * Actualizar métricas de rendimiento
   */
  static updateMetrics(responseTime) {
    const instance = new PerformanceMiddleware();
    instance.performanceMetrics.requests++;
    instance.performanceMetrics.totalResponseTime += responseTime;
    instance.performanceMetrics.cacheHitRate = instance.getCacheHitRate();
  }

  /**
   * Registrar consulta lenta
   */
  static recordSlowQuery(queryInfo) {
    const instance = new PerformanceMiddleware();
    instance.performanceMetrics.slowQueries.push(queryInfo);

    // Mantener solo las últimas 100 consultas lentas
    if (instance.performanceMetrics.slowQueries.length > 100) {
      instance.performanceMetrics.slowQueries.shift();
    }
  }

  /**
   * Obtener estadísticas de cache
   */
  static getCacheStats() {
    const instance = new PerformanceMiddleware();
    return {
      ...instance.cacheStats,
      hitRate: instance.getCacheHitRate(),
      size: instance.queryCache.size,
      maxSize: instance.cacheConfig.maxSize,
    };
  }

  /**
   * Obtener métricas de rendimiento
   */
  static getPerformanceMetrics() {
    const instance = new PerformanceMiddleware();
    const metrics = instance.performanceMetrics;

    return {
      ...metrics,
      averageResponseTime:
        metrics.requests > 0 ? metrics.totalResponseTime / metrics.requests : 0,
      cacheStats: PerformanceMiddleware.getCacheStats(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    };
  }

  /**
   * Limpiar cache manualmente
   */
  static clearCache(pattern = null) {
    const instance = new PerformanceMiddleware();

    if (!pattern) {
      // Limpiar todo el cache
      const size = instance.queryCache.size;
      instance.queryCache.clear();
      instance.cacheStats.deletes += size;

      logger.info("Cache cleared completely", { entriesRemoved: size });
      return size;
    }

    // Limpiar entradas que coincidan con el patrón
    let cleared = 0;
    const regex = new RegExp(pattern);

    for (const [key] of instance.queryCache.entries()) {
      if (regex.test(key)) {
        instance.queryCache.delete(key);
        cleared++;
      }
    }

    instance.cacheStats.deletes += cleared;

    logger.info("Cache cleared by pattern", {
      pattern,
      entriesRemoved: cleared,
    });

    return cleared;
  }

  /**
   * Middleware de monitoreo de memoria
   */
  static memoryMonitoring() {
    return (req, res, next) => {
      const memUsage = process.memoryUsage();

      // Alertar si el uso de memoria es alto
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memUsage.heapTotal / 1024 / 1024;

      if (heapUsedMB > 500) {
        // Más de 500MB
        logger.warn("High memory usage detected", {
          heapUsed: `${heapUsedMB.toFixed(2)}MB`,
          heapTotal: `${heapTotalMB.toFixed(2)}MB`,
          external: `${(memUsage.external / 1024 / 1024).toFixed(2)}MB`,
          url: req.originalUrl,
        });
      }

      // Forzar garbage collection si es necesario
      if (heapUsedMB > 800 && global.gc) {
        // Más de 800MB
        global.gc();
        logger.info("Garbage collection triggered", {
          beforeGC: `${heapUsedMB.toFixed(2)}MB`,
          afterGC: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(
            2,
          )}MB`,
        });
      }

      next();
    };
  }
}

module.exports = PerformanceMiddleware;
