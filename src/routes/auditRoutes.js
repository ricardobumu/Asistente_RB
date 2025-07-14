// src/routes/auditRoutes.js
// Rutas para auditoría y compliance RGPD

const express = require("express");
const router = express.Router();
const auditService = require("../services/auditService");
const rateLimiter = require("../middleware/rateLimiter");
const { auditConfigChanges } = require("../middleware/securityAuditMiddleware");
const logger = require("../utils/logger");

// Rate limiting específico para auditoría (más restrictivo)
const auditRateLimit = rateLimiter.createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 requests por IP cada 15 minutos
  message: {
    success: false,
    error: "Demasiadas solicitudes de auditoría. Inténtalo de nuevo en 15 minutos."
  }
});

/**
 * @route GET /audit/logs
 * @desc Obtener logs de auditoría con filtros
 * @access Admin
 */
router.get("/logs", auditRateLimit, (req, res) => {
  try {
    const filters = {
      eventType: req.query.eventType,
      severity: req.query.severity,
      userId: req.query.userId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      ipAddress: req.query.ipAddress,
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0
    };

    const result = auditService.getAuditLogs(filters);
    
    // Auditar el acceso a logs de auditoría
    auditService.logEvent('audit_log_access', {
      filters,
      resultCount: result.logs.length,
      accessedBy: req.user?.id || 'anonymous'
    }, req.user?.id, req.ip);

    res.json({
      success: true,
      data: result,
      meta: {
        filters,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error("Error retrieving audit logs", { 
      error: error.message,
      filters: req.query
    });
    
    res.status(500).json({
      success: false,
      error: 'Error retrieving audit logs'
    });
  }
});

/**
 * @route GET /audit/gdpr-report
 * @desc Generar reporte de compliance RGPD
 * @access Admin
 */
router.get("/gdpr-report", auditRateLimit, (req, res) => {
  try {
    const { dataSubject, startDate, endDate } = req.query;
    
    // Validar parámetros
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate y endDate son requeridos'
      });
    }

    const report = auditService.generateGDPRReport(dataSubject, startDate, endDate);
    
    if (!report) {
      return res.status(500).json({
        success: false,
        error: 'Error generating GDPR report'
      });
    }

    // Auditar la generación del reporte
    auditService.logEvent('gdpr_report_generated', {
      dataSubject,
      period: { startDate, endDate },
      generatedBy: req.user?.id || 'anonymous'
    }, req.user?.id, req.ip);

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    logger.error("Error generating GDPR report", { 
      error: error.message,
      query: req.query
    });
    
    res.status(500).json({
      success: false,
      error: 'Error generating GDPR report'
    });
  }
});

/**
 * @route GET /audit/suspicious-patterns
 * @desc Detectar patrones sospechosos
 * @access Admin
 */
router.get("/suspicious-patterns", auditRateLimit, (req, res) => {
  try {
    const patterns = auditService.detectSuspiciousPatterns();
    
    // Auditar la consulta de patrones sospechosos
    auditService.logEvent('suspicious_pattern_check', {
      patternsFound: patterns.length,
      checkedBy: req.user?.id || 'anonymous'
    }, req.user?.id, req.ip);

    res.json({
      success: true,
      data: {
        patterns,
        timestamp: new Date().toISOString(),
        summary: {
          total: patterns.length,
          critical: patterns.filter(p => p.severity === 'critical').length,
          high: patterns.filter(p => p.severity === 'high').length,
          medium: patterns.filter(p => p.severity === 'medium').length
        }
      }
    });

  } catch (error) {
    logger.error("Error detecting suspicious patterns", { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Error detecting suspicious patterns'
    });
  }
});

/**
 * @route POST /audit/consent
 * @desc Registrar consentimiento RGPD
 * @access Public/Admin
 */
router.post("/consent", auditRateLimit, (req, res) => {
  try {
    const { dataSubject, consentType, granted, purpose, method } = req.body;
    
    // Validar parámetros requeridos
    if (!dataSubject || !consentType || granted === undefined) {
      return res.status(400).json({
        success: false,
        error: 'dataSubject, consentType y granted son requeridos'
      });
    }

    const consentId = auditService.logConsent(
      dataSubject,
      consentType,
      granted,
      purpose || 'service_provision',
      method || 'web'
    );

    res.json({
      success: true,
      data: {
        consentId,
        dataSubject,
        consentType,
        granted,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error("Error registering consent", { 
      error: error.message,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      error: 'Error registering consent'
    });
  }
});

/**
 * @route POST /audit/data-access
 * @desc Registrar acceso a datos personales
 * @access Admin
 */
router.post("/data-access", auditRateLimit, (req, res) => {
  try {
    const { dataType, action, dataSubject, accessor, purpose, legalBasis } = req.body;
    
    // Validar parámetros requeridos
    if (!dataType || !action || !dataSubject || !accessor || !purpose || !legalBasis) {
      return res.status(400).json({
        success: false,
        error: 'Todos los campos son requeridos: dataType, action, dataSubject, accessor, purpose, legalBasis'
      });
    }

    const accessId = auditService.logDataAccess(
      dataType,
      action,
      dataSubject,
      accessor,
      purpose,
      legalBasis
    );

    res.json({
      success: true,
      data: {
        accessId,
        dataType,
        action,
        dataSubject,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error("Error registering data access", { 
      error: error.message,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      error: 'Error registering data access'
    });
  }
});

/**
 * @route POST /audit/security-incident
 * @desc Registrar incidente de seguridad
 * @access Admin
 */
router.post("/security-incident", auditRateLimit, (req, res) => {
  try {
    const { incidentType, details, ipAddress, userAgent } = req.body;
    
    // Validar parámetros requeridos
    if (!incidentType || !details) {
      return res.status(400).json({
        success: false,
        error: 'incidentType y details son requeridos'
      });
    }

    const incidentId = auditService.logSecurityIncident(
      incidentType,
      details,
      ipAddress || req.ip,
      userAgent || req.get('User-Agent')
    );

    res.json({
      success: true,
      data: {
        incidentId,
        incidentType,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error("Error registering security incident", { 
      error: error.message,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      error: 'Error registering security incident'
    });
  }
});

/**
 * @route DELETE /audit/cleanup
 * @desc Limpiar logs antiguos según política de retención
 * @access Admin
 */
router.delete("/cleanup", auditRateLimit, auditConfigChanges('audit_retention'), (req, res) => {
  try {
    const removedCount = auditService.cleanupOldLogs();
    
    // Auditar la limpieza
    auditService.logEvent('audit_cleanup', {
      removedCount,
      triggeredBy: req.user?.id || 'system',
      manual: true
    }, req.user?.id, req.ip);

    res.json({
      success: true,
      data: {
        removedCount,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error("Error cleaning up audit logs", { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Error cleaning up audit logs'
    });
  }
});

/**
 * @route GET /audit/stats
 * @desc Obtener estadísticas de auditoría
 * @access Admin
 */
router.get("/stats", auditRateLimit, (req, res) => {
  try {
    const logs = auditService.getAuditLogs({ limit: 10000 });
    
    // Calcular estadísticas
    const stats = {
      total: logs.total,
      byEventType: {},
      bySeverity: {},
      byDate: {},
      recentActivity: logs.logs.slice(0, 10)
    };

    // Agrupar por tipo de evento
    logs.logs.forEach(log => {
      stats.byEventType[log.eventType] = (stats.byEventType[log.eventType] || 0) + 1;
      stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;
      
      const date = log.timestamp.split('T')[0];
      stats.byDate[date] = (stats.byDate[date] || 0) + 1;
    });

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error("Error getting audit stats", { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Error getting audit statistics'
    });
  }
});

/**
 * @route GET /audit/export
 * @desc Exportar logs de auditoría
 * @access Admin
 */
router.get("/export", auditRateLimit, (req, res) => {
  try {
    const format = req.query.format || 'json';
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      eventType: req.query.eventType,
      severity: req.query.severity,
      limit: parseInt(req.query.limit) || 1000
    };

    const result = auditService.getAuditLogs(filters);
    
    // Auditar la exportación
    auditService.logEvent('audit_export', {
      format,
      filters,
      recordCount: result.logs.length,
      exportedBy: req.user?.id || 'anonymous'
    }, req.user?.id, req.ip);

    switch (format) {
      case 'csv':
        const csv = convertToCSV(result.logs);
        res.set('Content-Type', 'text/csv');
        res.set('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csv);
        break;
        
      case 'txt':
        const txt = convertToText(result.logs);
        res.set('Content-Type', 'text/plain');
        res.set('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.txt"`);
        res.send(txt);
        break;
        
      default:
        res.json({
          success: true,
          data: result,
          meta: {
            format,
            filters,
            exportedAt: new Date().toISOString()
          }
        });
    }

  } catch (error) {
    logger.error("Error exporting audit logs", { 
      error: error.message,
      query: req.query
    });
    
    res.status(500).json({
      success: false,
      error: 'Error exporting audit logs'
    });
  }
});

/**
 * Funciones auxiliares para exportación
 */
function convertToCSV(logs) {
  const headers = ['timestamp', 'eventType', 'severity', 'userId', 'ipAddress', 'success', 'details'];
  const csvRows = [headers.join(',')];
  
  logs.forEach(log => {
    const row = [
      log.timestamp,
      log.eventType,
      log.severity,
      log.userId || '',
      log.ipAddress || '',
      log.success,
      JSON.stringify(log.details).replace(/"/g, '""')
    ];
    csvRows.push(row.join(','));
  });
  
  return csvRows.join('\n');
}

function convertToText(logs) {
  let text = 'AUDIT LOGS EXPORT\n';
  text += '='.repeat(50) + '\n\n';
  
  logs.forEach(log => {
    text += `Timestamp: ${log.timestamp}\n`;
    text += `Event Type: ${log.eventType}\n`;
    text += `Severity: ${log.severity}\n`;
    text += `User ID: ${log.userId || 'N/A'}\n`;
    text += `IP Address: ${log.ipAddress || 'N/A'}\n`;
    text += `Success: ${log.success}\n`;
    text += `Details: ${JSON.stringify(log.details, null, 2)}\n`;
    text += '-'.repeat(50) + '\n\n';
  });
  
  return text;
}

// Middleware de manejo de errores específico para auditoría
router.use((error, req, res, next) => {
  logger.error("Audit route error", { 
    error: error.message,
    path: req.path,
    method: req.method
  });
  
  // Registrar el error como incidente de seguridad
  auditService.logSecurityIncident(
    'audit_system_error',
    {
      error: error.message,
      path: req.path,
      method: req.method
    },
    req.ip,
    req.get('User-Agent')
  );
  
  res.status(500).json({
    success: false,
    error: 'Error interno del sistema de auditoría'
  });
});

module.exports = router;