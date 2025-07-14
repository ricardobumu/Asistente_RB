// src/middleware/metricsMiddleware.js
// Middleware para recolección automática de métricas

const metricsService = require("../services/metricsService");
const logger = require("../utils/logger");

/**
 * Middleware para recolectar métricas de requests HTTP
 */
const requestMetricsMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Capturar información de la request
  const originalSend = res.send;
  const originalJson = res.json;
  
  // Override res.send para capturar cuando se envía la respuesta
  res.send = function(data) {
    const responseTime = Date.now() - startTime;
    
    // Registrar métricas
    metricsService.recordRequest(
      req.route?.path || req.path || req.url,
      req.method,
      res.statusCode,
      responseTime
    );
    
    // Log para requests lentas
    if (responseTime > 2000) {
      logger.warn("Slow request detected", {
        method: req.method,
        path: req.path,
        responseTime: responseTime + 'ms',
        statusCode: res.statusCode
      });
    }
    
    return originalSend.call(this, data);
  };
  
  // Override res.json para capturar respuestas JSON
  res.json = function(data) {
    const responseTime = Date.now() - startTime;
    
    metricsService.recordRequest(
      req.route?.path || req.path || req.url,
      req.method,
      res.statusCode,
      responseTime
    );
    
    if (responseTime > 2000) {
      logger.warn("Slow JSON response detected", {
        method: req.method,
        path: req.path,
        responseTime: responseTime + 'ms',
        statusCode: res.statusCode
      });
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Middleware para manejar errores y registrar métricas de errores
 */
const errorMetricsMiddleware = (error, req, res, next) => {
  // Registrar error en métricas
  metricsService.recordError('http_error', error, {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
  
  // Continuar con el manejo normal de errores
  next(error);
};

/**
 * Middleware para incrementar contador de conexiones activas
 */
const connectionMetricsMiddleware = (req, res, next) => {
  // Incrementar conexiones activas
  if (metricsService.metrics.system.activeConnections !== undefined) {
    metricsService.metrics.system.activeConnections++;
  }
  
  // Decrementar cuando la respuesta termine
  res.on('finish', () => {
    if (metricsService.metrics.system.activeConnections !== undefined) {
      metricsService.metrics.system.activeConnections--;
    }
  });
  
  next();
};

/**
 * Middleware específico para métricas de WhatsApp
 */
const whatsappMetricsMiddleware = (req, res, next) => {
  if (req.path.includes('/webhook/whatsapp')) {
    const startTime = Date.now();
    
    // Capturar respuesta para determinar éxito
    const originalJson = res.json;
    res.json = function(data) {
      const processingTime = Date.now() - startTime;
      const success = res.statusCode >= 200 && res.statusCode < 400;
      
      // Intentar extraer intent del cuerpo de la respuesta o request
      let intent = 'unknown';
      if (data && data.analysis && data.analysis.intent) {
        intent = data.analysis.intent;
      } else if (req.body && req.body.intent) {
        intent = req.body.intent;
      }
      
      metricsService.recordWhatsAppMessage(intent, processingTime, success);
      
      return originalJson.call(this, data);
    };
  }
  
  next();
};

/**
 * Middleware para métricas de reservas
 */
const bookingMetricsMiddleware = (req, res, next) => {
  if (req.path.includes('/booking') && req.method === 'POST') {
    const originalJson = res.json;
    
    res.json = function(data) {
      if (res.statusCode >= 200 && res.statusCode < 300 && data.success) {
        // Extraer información de la reserva
        const source = req.body.source || 'unknown';
        const service = req.body.service_name || 'unknown';
        const amount = req.body.total_amount || 0;
        
        metricsService.recordBooking(source, service, amount, 'confirmed');
      }
      
      return originalJson.call(this, data);
    };
  }
  
  next();
};

/**
 * Función para registrar métricas de notificaciones desde servicios
 */
const recordNotificationMetric = (type, success = true) => {
  metricsService.recordNotification(type, success);
};

/**
 * Función para registrar errores del sistema desde cualquier parte
 */
const recordSystemError = (type, error, context = {}) => {
  metricsService.recordError(type, error, context);
};

/**
 * Middleware para servir métricas en endpoint específico
 */
const metricsEndpointMiddleware = (req, res) => {
  try {
    const format = req.query.format || 'json';
    const summary = req.query.summary === 'true';
    
    let metricsData;
    
    if (summary) {
      metricsData = metricsService.getSummary();
    } else {
      metricsData = metricsService.getMetrics();
    }
    
    if (!metricsData) {
      return res.status(500).json({
        success: false,
        error: 'Error obteniendo métricas'
      });
    }
    
    // Agregar alertas si se solicitan
    if (req.query.alerts === 'true') {
      metricsData.alerts = metricsService.getAlerts();
    }
    
    // Agregar métricas por endpoint si se solicitan
    if (req.query.endpoints === 'true') {
      metricsData.endpointMetrics = metricsService.getEndpointMetrics();
    }
    
    switch (format) {
      case 'prometheus':
        // Formato Prometheus para integración con sistemas de monitoreo
        const prometheusMetrics = convertToPrometheusFormat(metricsData);
        res.set('Content-Type', 'text/plain');
        res.send(prometheusMetrics);
        break;
        
      case 'text':
        // Formato texto legible
        const textMetrics = convertToTextFormat(metricsData);
        res.set('Content-Type', 'text/plain');
        res.send(textMetrics);
        break;
        
      default:
        // Formato JSON por defecto
        res.json({
          success: true,
          data: metricsData
        });
    }
    
  } catch (error) {
    logger.error("Error serving metrics", { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Convertir métricas a formato Prometheus
 */
function convertToPrometheusFormat(metrics) {
  let output = '';
  
  // Métricas de requests
  output += `# HELP http_requests_total Total number of HTTP requests\n`;
  output += `# TYPE http_requests_total counter\n`;
  output += `http_requests_total ${metrics.requests.total}\n\n`;
  
  output += `# HELP http_requests_successful Total number of successful HTTP requests\n`;
  output += `# TYPE http_requests_successful counter\n`;
  output += `http_requests_successful ${metrics.requests.successful}\n\n`;
  
  output += `# HELP http_response_time_avg Average HTTP response time in milliseconds\n`;
  output += `# TYPE http_response_time_avg gauge\n`;
  output += `http_response_time_avg ${metrics.requests.averageResponseTime}\n\n`;
  
  // Métricas de WhatsApp
  output += `# HELP whatsapp_messages_received Total WhatsApp messages received\n`;
  output += `# TYPE whatsapp_messages_received counter\n`;
  output += `whatsapp_messages_received ${metrics.whatsapp.messagesReceived}\n\n`;
  
  output += `# HELP whatsapp_bookings_created Total bookings created via WhatsApp\n`;
  output += `# TYPE whatsapp_bookings_created counter\n`;
  output += `whatsapp_bookings_created ${metrics.whatsapp.bookingsCreated}\n\n`;
  
  // Métricas de reservas
  output += `# HELP bookings_total Total number of bookings\n`;
  output += `# TYPE bookings_total counter\n`;
  output += `bookings_total ${metrics.bookings.total}\n\n`;
  
  output += `# HELP bookings_revenue Total revenue from bookings\n`;
  output += `# HELP bookings_revenue gauge\n`;
  output += `bookings_revenue ${metrics.bookings.revenue}\n\n`;
  
  // Métricas del sistema
  output += `# HELP system_memory_usage Memory usage in bytes\n`;
  output += `# TYPE system_memory_usage gauge\n`;
  output += `system_memory_usage ${metrics.system.memoryUsage.heapUsed}\n\n`;
  
  return output;
}

/**
 * Convertir métricas a formato texto legible
 */
function convertToTextFormat(metrics) {
  let output = 'MÉTRICAS DEL SISTEMA - RICARDO BURITICÁ BEAUTY CONSULTING\n';
  output += '=' * 60 + '\n\n';
  
  output += 'RENDIMIENTO:\n';
  output += `  Total de requests: ${metrics.requests.total}\n`;
  output += `  Requests exitosas: ${metrics.requests.successful}\n`;
  output += `  Requests fallidas: ${metrics.requests.failed}\n`;
  output += `  Tiempo promedio de respuesta: ${metrics.requests.averageResponseTime.toFixed(2)}ms\n\n`;
  
  output += 'WHATSAPP:\n';
  output += `  Mensajes recibidos: ${metrics.whatsapp.messagesReceived}\n`;
  output += `  Mensajes procesados: ${metrics.whatsapp.messagesProcessed}\n`;
  output += `  Reservas creadas: ${metrics.whatsapp.bookingsCreated}\n\n`;
  
  output += 'RESERVAS:\n';
  output += `  Total: ${metrics.bookings.total}\n`;
  output += `  Confirmadas: ${metrics.bookings.confirmed}\n`;
  output += `  Ingresos: €${metrics.bookings.revenue.toFixed(2)}\n\n`;
  
  output += 'SISTEMA:\n';
  output += `  Tiempo activo: ${metricsService.formatUptime(metrics.uptime)}\n`;
  output += `  Uso de memoria: ${(metrics.system.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB\n`;
  
  return output;
}

module.exports = {
  requestMetricsMiddleware,
  errorMetricsMiddleware,
  connectionMetricsMiddleware,
  whatsappMetricsMiddleware,
  bookingMetricsMiddleware,
  metricsEndpointMiddleware,
  recordNotificationMetric,
  recordSystemError
};