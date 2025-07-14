// src/middleware/securityAuditMiddleware.js
// Middleware avanzado para auditoría de seguridad y compliance RGPD

const auditService = require("../services/auditService");
const logger = require("../utils/logger");

/**
 * Middleware principal de auditoría de seguridad
 */
const securityAuditMiddleware = (req, res, next) => {
  // Capturar información de la request
  const requestInfo = {
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    sessionId: req.sessionID,
    timestamp: new Date().toISOString()
  };

  // Interceptar respuesta para auditar según el resultado
  const originalJson = res.json;
  const originalSend = res.send;

  res.json = function(data) {
    auditResponse(req, res, data, requestInfo);
    return originalJson.call(this, data);
  };

  res.send = function(data) {
    auditResponse(req, res, data, requestInfo);
    return originalSend.call(this, data);
  };

  next();
};

/**
 * Auditar respuesta según el endpoint y resultado
 */
function auditResponse(req, res, data, requestInfo) {
  try {
    const statusCode = res.statusCode;
    const success = statusCode >= 200 && statusCode < 400;

    // Auditar según el tipo de endpoint
    if (req.path.includes('/admin')) {
      auditAdminAccess(req, res, data, requestInfo, success);
    } else if (req.path.includes('/booking')) {
      auditBookingActivity(req, res, data, requestInfo, success);
    } else if (req.path.includes('/client')) {
      auditClientDataAccess(req, res, data, requestInfo, success);
    } else if (req.path.includes('/webhook')) {
      auditWebhookActivity(req, res, data, requestInfo, success);
    }

    // Auditar errores de seguridad
    if (!success) {
      auditSecurityEvent(req, res, data, requestInfo);
    }

  } catch (error) {
    logger.error("Error in security audit response", { error: error.message });
  }
}

/**
 * Auditar acceso administrativo
 */
function auditAdminAccess(req, res, data, requestInfo, success) {
  const eventDetails = {
    action: `${req.method} ${req.path}`,
    success,
    statusCode: res.statusCode,
    userAgent: requestInfo.userAgent,
    sessionId: requestInfo.sessionId
  };

  // Extraer usuario si está disponible
  const userId = req.user?.id || req.session?.userId || 'anonymous';

  auditService.logEvent('admin_access', eventDetails, userId, requestInfo.ip);

  // Log adicional para acciones críticas
  if (req.method !== 'GET' && success) {
    auditService.logEvent('admin_action', {
      ...eventDetails,
      action: `${req.method} ${req.path}`,
      requestBody: sanitizeRequestBody(req.body)
    }, userId, requestInfo.ip);
  }
}

/**
 * Auditar actividad de reservas
 */
function auditBookingActivity(req, res, data, requestInfo, success) {
  if (req.method === 'POST' && success && data.success) {
    // Nueva reserva creada
    const bookingDetails = {
      action: 'booking_created',
      bookingId: data.data?.id,
      serviceId: req.body.service_id,
      clientData: sanitizeClientData(req.body.client_data),
      source: req.body.source || 'unknown',
      success: true
    };

    auditService.logEvent('booking_activity', bookingDetails, null, requestInfo.ip);

    // Log de acceso a datos personales (RGPD)
    if (req.body.client_data) {
      auditService.logDataAccess(
        'client_personal_data',
        'create',
        req.body.client_data.phone || 'unknown',
        'booking_system',
        'service_booking',
        'contract_performance'
      );
    }
  }
}

/**
 * Auditar acceso a datos de clientes
 */
function auditClientDataAccess(req, res, data, requestInfo, success) {
  if (success && data.success) {
    const action = req.method === 'GET' ? 'read' : 
                  req.method === 'POST' ? 'create' :
                  req.method === 'PUT' ? 'update' : 'unknown';

    const clientId = req.params.clientId || req.body.client_id || 'unknown';

    auditService.logDataAccess(
      'client_data',
      action,
      clientId,
      req.user?.id || 'system',
      'client_management',
      'legitimate_interest'
    );
  }
}

/**
 * Auditar actividad de webhooks
 */
function auditWebhookActivity(req, res, data, requestInfo, success) {
  const webhookType = req.path.includes('whatsapp') ? 'whatsapp' : 
                     req.path.includes('calendly') ? 'calendly' : 'unknown';

  const eventDetails = {
    webhookType,
    success,
    messageId: req.body.MessageSid || req.body.id,
    from: sanitizePhoneNumber(req.body.From),
    processed: success && data.success
  };

  auditService.logEvent('webhook_activity', eventDetails, null, requestInfo.ip);

  // Si es WhatsApp y se procesó un mensaje, auditar acceso a datos
  if (webhookType === 'whatsapp' && success && req.body.From) {
    auditService.logDataAccess(
      'whatsapp_conversation',
      'process',
      sanitizePhoneNumber(req.body.From),
      'whatsapp_bot',
      'customer_service',
      'legitimate_interest'
    );
  }
}

/**
 * Auditar eventos de seguridad
 */
function auditSecurityEvent(req, res, data, requestInfo) {
  const statusCode = res.statusCode;
  let incidentType = 'unknown_error';

  // Clasificar tipo de incidente según código de estado
  switch (statusCode) {
    case 401:
      incidentType = 'unauthorized_access';
      break;
    case 403:
      incidentType = 'forbidden_access';
      break;
    case 429:
      incidentType = 'rate_limit_exceeded';
      break;
    case 400:
      incidentType = 'bad_request';
      break;
    case 500:
      incidentType = 'server_error';
      break;
  }

  const incidentDetails = {
    statusCode,
    path: req.path,
    method: req.method,
    userAgent: requestInfo.userAgent,
    requestBody: sanitizeRequestBody(req.body),
    autoBlocked: statusCode === 429
  };

  auditService.logSecurityIncident(
    incidentType,
    incidentDetails,
    requestInfo.ip,
    requestInfo.userAgent
  );
}

/**
 * Middleware específico para auditar cambios de configuración
 */
const auditConfigChanges = (configType) => {
  return (req, res, next) => {
    if (req.method !== 'GET') {
      const originalJson = res.json;
      
      res.json = function(data) {
        if (res.statusCode >= 200 && res.statusCode < 300 && data.success) {
          auditService.logSecurityConfigChange(
            configType,
            req.body.oldValue || 'unknown',
            req.body.newValue || req.body,
            req.user?.id || 'system'
          );
        }
        
        return originalJson.call(this, data);
      };
    }
    
    next();
  };
};

/**
 * Middleware para auditar consentimientos RGPD
 */
const auditGDPRConsent = (req, res, next) => {
  if (req.method === 'POST' && req.body.consent) {
    const originalJson = res.json;
    
    res.json = function(data) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const consentData = req.body.consent;
        
        auditService.logConsent(
          consentData.dataSubject || req.body.client_data?.phone,
          consentData.type || 'general',
          consentData.granted !== false,
          consentData.purpose || 'service_provision',
          'web'
        );
      }
      
      return originalJson.call(this, data);
    };
  }
  
  next();
};

/**
 * Middleware para detectar patrones sospechosos
 */
const suspiciousPatternDetection = (req, res, next) => {
  // Ejecutar detección cada 100 requests para no sobrecargar
  if (Math.random() < 0.01) {
    setImmediate(() => {
      try {
        const patterns = auditService.detectSuspiciousPatterns();
        
        if (patterns.length > 0) {
          logger.warn("Suspicious patterns detected", { patterns });
          
          // Log cada patrón como incidente de seguridad
          patterns.forEach(pattern => {
            auditService.logSecurityIncident(
              pattern.type,
              {
                description: pattern.description,
                severity: pattern.severity,
                autoDetected: true,
                ...pattern
              },
              pattern.ipAddress,
              null
            );
          });
        }
      } catch (error) {
        logger.error("Error in suspicious pattern detection", { error: error.message });
      }
    });
  }
  
  next();
};

/**
 * Funciones auxiliares para sanitización
 */
function sanitizeRequestBody(body) {
  if (!body || typeof body !== 'object') return body;
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'key'];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

function sanitizeClientData(clientData) {
  if (!clientData) return null;
  
  return {
    name: clientData.name ? clientData.name.substr(0, 2) + '***' : null,
    phone: sanitizePhoneNumber(clientData.phone),
    email: sanitizeEmail(clientData.email),
    hasData: true
  };
}

function sanitizePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return null;
  
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length >= 4) {
    return cleaned.substr(0, 2) + '***' + cleaned.substr(-2);
  }
  return '***';
}

function sanitizeEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return null;
  
  const [local, domain] = email.split('@');
  return `${local.substr(0, 2)}***@${domain}`;
}

module.exports = {
  securityAuditMiddleware,
  auditConfigChanges,
  auditGDPRConsent,
  suspiciousPatternDetection
};