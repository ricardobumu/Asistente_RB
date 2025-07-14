// src/middleware/cacheMiddleware.js
// Middleware de cache para optimizar respuestas

const cacheService = require("../services/cacheService");
const logger = require("../utils/logger");

/**
 * Middleware de cache genérico
 */
const cacheMiddleware = (options = {}) => {
  const {
    ttl = 5 * 60 * 1000, // 5 minutos por defecto
    keyGenerator = null,
    condition = null,
    skipCache = false
  } = options;

  return (req, res, next) => {
    if (skipCache) {
      return next();
    }

    // Generar clave de cache
    const cacheKey = keyGenerator ? 
      keyGenerator(req) : 
      generateDefaultCacheKey(req);

    // Verificar condición si existe
    if (condition && !condition(req)) {
      return next();
    }

    // Intentar obtener del cache
    const cachedResponse = cacheService.get(cacheKey);
    
    if (cachedResponse) {
      logger.debug("Cache hit for request", { 
        method: req.method,
        path: req.path,
        cacheKey: cacheService.sanitizeKey(cacheKey)
      });

      // Establecer headers de cache
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-Key', cacheService.sanitizeKey(cacheKey));
      
      return res.json(cachedResponse);
    }

    // Cache miss - interceptar respuesta para guardar en cache
    const originalJson = res.json;
    
    res.json = function(data) {
      // Solo cachear respuestas exitosas
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheService.set(cacheKey, data, ttl);
        
        logger.debug("Response cached", { 
          method: req.method,
          path: req.path,
          cacheKey: cacheService.sanitizeKey(cacheKey),
          statusCode: res.statusCode
        });
      }

      // Establecer headers de cache
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', cacheService.sanitizeKey(cacheKey));
      
      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Middleware específico para servicios públicos
 */
const servicesCache = cacheMiddleware({
  ttl: 10 * 60 * 1000, // 10 minutos
  keyGenerator: (req) => 'services:public',
  condition: (req) => req.method === 'GET'
});

/**
 * Middleware específico para disponibilidad
 */
const availabilityCache = cacheMiddleware({
  ttl: 2 * 60 * 1000, // 2 minutos
  keyGenerator: (req) => `availability:${req.params.serviceId}:${req.query.date}`,
  condition: (req) => req.method === 'GET' && req.params.serviceId && req.query.date
});

/**
 * Middleware específico para información del widget
 */
const widgetInfoCache = cacheMiddleware({
  ttl: 30 * 60 * 1000, // 30 minutos
  keyGenerator: (req) => 'widget:info',
  condition: (req) => req.method === 'GET'
});

/**
 * Middleware para invalidar cache relacionado con reservas
 */
const invalidateBookingCache = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    // Si la reserva fue exitosa, invalidar caches relacionados
    if (res.statusCode >= 200 && res.statusCode < 300 && data.success) {
      const serviceId = req.body.service_id;
      const date = req.body.appointment_date;
      
      if (serviceId && date) {
        // Invalidar cache de disponibilidad para ese servicio y fecha
        const availabilityKey = `availability:${serviceId}:${date}`;
        cacheService.delete(availabilityKey);
        
        logger.debug("Booking cache invalidated", { 
          serviceId,
          date,
          availabilityKey: cacheService.sanitizeKey(availabilityKey)
        });
      }
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Middleware para invalidar cache de servicios
 */
const invalidateServicesCache = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    // Si la operación fue exitosa, invalidar cache de servicios
    if (res.statusCode >= 200 && res.statusCode < 300 && data.success) {
      cacheService.delete('services:public');
      
      logger.debug("Services cache invalidated");
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Middleware para cache condicional basado en headers
 */
const conditionalCache = (req, res, next) => {
  // Verificar If-None-Match (ETag)
  const ifNoneMatch = req.get('If-None-Match');
  const cacheKey = generateDefaultCacheKey(req);
  
  if (ifNoneMatch) {
    const cachedResponse = cacheService.get(cacheKey);
    
    if (cachedResponse && cachedResponse.etag === ifNoneMatch) {
      res.set('X-Cache', 'HIT-304');
      return res.status(304).end();
    }
  }
  
  // Verificar If-Modified-Since
  const ifModifiedSince = req.get('If-Modified-Since');
  
  if (ifModifiedSince) {
    const modifiedSince = new Date(ifModifiedSince);
    const cachedResponse = cacheService.get(cacheKey);
    
    if (cachedResponse && cachedResponse.lastModified && 
        new Date(cachedResponse.lastModified) <= modifiedSince) {
      res.set('X-Cache', 'HIT-304');
      return res.status(304).end();
    }
  }
  
  next();
};

/**
 * Middleware para establecer headers de cache HTTP
 */
const httpCacheHeaders = (maxAge = 300) => {
  return (req, res, next) => {
    // Solo para requests GET
    if (req.method === 'GET') {
      res.set('Cache-Control', `public, max-age=${maxAge}`);
      res.set('Expires', new Date(Date.now() + maxAge * 1000).toUTCString());
    }
    
    next();
  };
};

/**
 * Middleware para cache de archivos estáticos
 */
const staticFileCache = (req, res, next) => {
  const ext = req.path.split('.').pop();
  
  // Configurar cache según tipo de archivo
  switch (ext) {
    case 'css':
    case 'js':
      res.set('Cache-Control', 'public, max-age=86400'); // 1 día
      break;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      res.set('Cache-Control', 'public, max-age=604800'); // 1 semana
      break;
    case 'html':
      res.set('Cache-Control', 'public, max-age=3600'); // 1 hora
      break;
    default:
      res.set('Cache-Control', 'public, max-age=300'); // 5 minutos
  }
  
  next();
};

/**
 * Generar clave de cache por defecto
 */
function generateDefaultCacheKey(req) {
  const method = req.method;
  const path = req.path;
  const query = JSON.stringify(req.query);
  const params = JSON.stringify(req.params);
  
  return `${method}:${path}:${query}:${params}`;
}

/**
 * Middleware para limpiar cache por patrón
 */
const clearCachePattern = (pattern) => {
  return (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      if (res.statusCode >= 200 && res.statusCode < 300 && data.success) {
        const invalidated = cacheService.invalidatePattern(pattern);
        
        logger.debug("Cache pattern cleared", { 
          pattern,
          invalidated
        });
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

/**
 * Middleware para estadísticas de cache
 */
const cacheStatsMiddleware = (req, res, next) => {
  if (req.path === '/cache/stats') {
    const stats = cacheService.getStats();
    
    return res.json({
      success: true,
      data: stats
    });
  }
  
  next();
};

/**
 * Middleware para limpiar cache manualmente
 */
const cacheClearMiddleware = (req, res, next) => {
  if (req.path === '/cache/clear' && req.method === 'POST') {
    const pattern = req.body.pattern;
    
    if (pattern) {
      const invalidated = cacheService.invalidatePattern(pattern);
      return res.json({
        success: true,
        message: `Cache cleared for pattern: ${pattern}`,
        invalidated
      });
    } else {
      const cleared = cacheService.clear();
      return res.json({
        success: cleared,
        message: cleared ? 'All cache cleared' : 'Error clearing cache'
      });
    }
  }
  
  next();
};

module.exports = {
  cacheMiddleware,
  servicesCache,
  availabilityCache,
  widgetInfoCache,
  invalidateBookingCache,
  invalidateServicesCache,
  conditionalCache,
  httpCacheHeaders,
  staticFileCache,
  clearCachePattern,
  cacheStatsMiddleware,
  cacheClearMiddleware,
  generateDefaultCacheKey
};