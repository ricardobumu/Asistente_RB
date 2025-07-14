// src/services/auditService.js
// Servicio de auditoría y logs de seguridad para compliance RGPD

const logger = require("../utils/logger");
const { recordSystemError } = require("../middleware/metricsMiddleware");

class AuditService {
  constructor() {
    this.auditLogs = [];
    this.maxLogs = 10000; // Máximo número de logs en memoria
    this.sensitiveFields = [
      'password', 'token', 'secret', 'key', 'phone', 'email', 
      'whatsapp_number', 'credit_card', 'ssn', 'dni'
    ];
    
    // Configuración RGPD
    this.dataRetentionDays = 365; // 1 año por defecto
    this.anonymizationDelay = 30 * 24 * 60 * 60 * 1000; // 30 días
    
    logger.info("Audit service initialized", {
      maxLogs: this.maxLogs,
      dataRetentionDays: this.dataRetentionDays
    });
  }

  /**
   * Registrar evento de auditoría
   */
  logEvent(eventType, details = {}, userId = null, ipAddress = null) {
    try {
      const auditEntry = {
        id: this.generateAuditId(),
        timestamp: new Date().toISOString(),
        eventType,
        userId,
        ipAddress: this.sanitizeIP(ipAddress),
        details: this.sanitizeData(details),
        severity: this.determineSeverity(eventType),
        source: 'system',
        sessionId: details.sessionId || null,
        userAgent: details.userAgent || null,
        success: details.success !== false
      };

      // Agregar a logs en memoria
      this.auditLogs.push(auditEntry);
      
      // Mantener límite de logs
      if (this.auditLogs.length > this.maxLogs) {
        this.auditLogs.shift();
      }

      // Log según severidad
      switch (auditEntry.severity) {
        case 'critical':
          logger.error("AUDIT - Critical security event", auditEntry);
          break;
        case 'high':
          logger.warn("AUDIT - High priority security event", auditEntry);
          break;
        case 'medium':
          logger.info("AUDIT - Security event", auditEntry);
          break;
        default:
          logger.debug("AUDIT - Low priority event", auditEntry);
      }

      return auditEntry.id;

    } catch (error) {
      logger.error("Error logging audit event", { 
        eventType, 
        error: error.message 
      });
      recordSystemError('audit_log', error, { eventType });
      return null;
    }
  }

  /**
   * Registrar acceso a datos personales (RGPD)
   */
  logDataAccess(dataType, action, dataSubject, accessor, purpose, legalBasis) {
    return this.logEvent('data_access', {
      dataType,
      action, // 'read', 'create', 'update', 'delete', 'export'
      dataSubject, // ID o identificador del titular de los datos
      accessor, // Quién accede a los datos
      purpose, // Propósito del acceso
      legalBasis, // Base legal RGPD
      gdprCompliant: true
    });
  }

  /**
   * Registrar consentimiento RGPD
   */
  logConsent(dataSubject, consentType, granted, purpose, method = 'web') {
    return this.logEvent('gdpr_consent', {
      dataSubject,
      consentType, // 'marketing', 'analytics', 'whatsapp', etc.
      granted, // true/false
      purpose,
      method, // 'web', 'whatsapp', 'email', etc.
      withdrawable: true,
      gdprCompliant: true
    });
  }

  /**
   * Registrar intento de acceso no autorizado
   */
  logSecurityIncident(incidentType, details, ipAddress, userAgent) {
    return this.logEvent('security_incident', {
      incidentType, // 'unauthorized_access', 'brute_force', 'injection_attempt', etc.
      ...details,
      userAgent,
      requiresInvestigation: this.requiresInvestigation(incidentType),
      autoBlocked: details.autoBlocked || false
    }, null, ipAddress);
  }

  /**
   * Registrar cambios en configuración de seguridad
   */
  logSecurityConfigChange(configType, oldValue, newValue, changedBy) {
    return this.logEvent('security_config_change', {
      configType,
      oldValue: this.sanitizeData(oldValue),
      newValue: this.sanitizeData(newValue),
      changedBy,
      requiresApproval: this.requiresApproval(configType)
    });
  }

  /**
   * Registrar exportación de datos (RGPD)
   */
  logDataExport(dataSubject, dataTypes, requestedBy, format = 'json') {
    return this.logEvent('data_export', {
      dataSubject,
      dataTypes,
      requestedBy,
      format,
      gdprCompliant: true,
      purpose: 'data_portability_request'
    });
  }

  /**
   * Registrar eliminación de datos (RGPD)
   */
  logDataDeletion(dataSubject, dataTypes, reason, requestedBy) {
    return this.logEvent('data_deletion', {
      dataSubject,
      dataTypes,
      reason, // 'user_request', 'retention_policy', 'consent_withdrawal'
      requestedBy,
      gdprCompliant: true,
      irreversible: true
    });
  }

  /**
   * Obtener logs de auditoría con filtros
   */
  getAuditLogs(filters = {}) {
    try {
      let filteredLogs = [...this.auditLogs];

      // Filtrar por tipo de evento
      if (filters.eventType) {
        filteredLogs = filteredLogs.filter(log => 
          log.eventType === filters.eventType
        );
      }

      // Filtrar por severidad
      if (filters.severity) {
        filteredLogs = filteredLogs.filter(log => 
          log.severity === filters.severity
        );
      }

      // Filtrar por usuario
      if (filters.userId) {
        filteredLogs = filteredLogs.filter(log => 
          log.userId === filters.userId
        );
      }

      // Filtrar por rango de fechas
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        filteredLogs = filteredLogs.filter(log => 
          new Date(log.timestamp) >= startDate
        );
      }

      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        filteredLogs = filteredLogs.filter(log => 
          new Date(log.timestamp) <= endDate
        );
      }

      // Filtrar por IP
      if (filters.ipAddress) {
        filteredLogs = filteredLogs.filter(log => 
          log.ipAddress === filters.ipAddress
        );
      }

      // Ordenar por timestamp (más reciente primero)
      filteredLogs.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );

      // Limitar resultados
      const limit = filters.limit || 100;
      const offset = filters.offset || 0;
      
      return {
        logs: filteredLogs.slice(offset, offset + limit),
        total: filteredLogs.length,
        filtered: true
      };

    } catch (error) {
      logger.error("Error getting audit logs", { 
        filters, 
        error: error.message 
      });
      return { logs: [], total: 0, error: error.message };
    }
  }

  /**
   * Generar reporte de compliance RGPD
   */
  generateGDPRReport(dataSubject, startDate, endDate) {
    try {
      const filters = {
        startDate,
        endDate
      };

      // Si se especifica un sujeto de datos, filtrar por él
      if (dataSubject) {
        filters.dataSubject = dataSubject;
      }

      const auditLogs = this.getAuditLogs(filters);
      
      // Filtrar solo eventos relacionados con RGPD
      const gdprLogs = auditLogs.logs.filter(log => 
        log.details.gdprCompliant || 
        ['data_access', 'gdpr_consent', 'data_export', 'data_deletion'].includes(log.eventType)
      );

      // Agrupar por tipo de actividad
      const report = {
        period: { startDate, endDate },
        dataSubject,
        summary: {
          totalEvents: gdprLogs.length,
          dataAccesses: gdprLogs.filter(l => l.eventType === 'data_access').length,
          consentEvents: gdprLogs.filter(l => l.eventType === 'gdpr_consent').length,
          dataExports: gdprLogs.filter(l => l.eventType === 'data_export').length,
          dataDeletions: gdprLogs.filter(l => l.eventType === 'data_deletion').length
        },
        activities: {
          dataAccesses: gdprLogs.filter(l => l.eventType === 'data_access'),
          consentEvents: gdprLogs.filter(l => l.eventType === 'gdpr_consent'),
          dataExports: gdprLogs.filter(l => l.eventType === 'data_export'),
          dataDeletions: gdprLogs.filter(l => l.eventType === 'data_deletion')
        },
        compliance: {
          hasValidLegalBasis: this.checkLegalBasisCompliance(gdprLogs),
          hasProperConsent: this.checkConsentCompliance(gdprLogs),
          respectsRetention: this.checkRetentionCompliance(gdprLogs),
          allowsPortability: this.checkPortabilityCompliance(gdprLogs)
        },
        generatedAt: new Date().toISOString()
      };

      logger.info("GDPR report generated", {
        dataSubject,
        period: report.period,
        totalEvents: report.summary.totalEvents
      });

      return report;

    } catch (error) {
      logger.error("Error generating GDPR report", { 
        dataSubject, 
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Detectar patrones sospechosos
   */
  detectSuspiciousPatterns() {
    try {
      const patterns = [];
      const recentLogs = this.auditLogs.filter(log => 
        Date.now() - new Date(log.timestamp).getTime() < 24 * 60 * 60 * 1000 // Últimas 24 horas
      );

      // Detectar múltiples intentos fallidos desde la misma IP
      const failedAttemptsByIP = {};
      recentLogs.filter(log => !log.success).forEach(log => {
        if (log.ipAddress) {
          failedAttemptsByIP[log.ipAddress] = (failedAttemptsByIP[log.ipAddress] || 0) + 1;
        }
      });

      Object.entries(failedAttemptsByIP).forEach(([ip, count]) => {
        if (count >= 5) {
          patterns.push({
            type: 'multiple_failed_attempts',
            severity: 'high',
            description: `${count} failed attempts from IP ${ip}`,
            ipAddress: ip,
            count
          });
        }
      });

      // Detectar accesos fuera de horario normal
      const offHoursAccess = recentLogs.filter(log => {
        const hour = new Date(log.timestamp).getHours();
        return hour < 6 || hour > 22; // Fuera de 6 AM - 10 PM
      });

      if (offHoursAccess.length > 10) {
        patterns.push({
          type: 'off_hours_activity',
          severity: 'medium',
          description: `${offHoursAccess.length} events outside normal hours`,
          count: offHoursAccess.length
        });
      }

      // Detectar accesos desde múltiples ubicaciones
      const ipsByUser = {};
      recentLogs.forEach(log => {
        if (log.userId && log.ipAddress) {
          if (!ipsByUser[log.userId]) {
            ipsByUser[log.userId] = new Set();
          }
          ipsByUser[log.userId].add(log.ipAddress);
        }
      });

      Object.entries(ipsByUser).forEach(([userId, ips]) => {
        if (ips.size >= 3) {
          patterns.push({
            type: 'multiple_locations',
            severity: 'medium',
            description: `User ${userId} accessed from ${ips.size} different IPs`,
            userId,
            ipCount: ips.size
          });
        }
      });

      return patterns;

    } catch (error) {
      logger.error("Error detecting suspicious patterns", { error: error.message });
      return [];
    }
  }

  /**
   * Limpiar logs antiguos según política de retención
   */
  cleanupOldLogs() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.dataRetentionDays);

      const initialCount = this.auditLogs.length;
      this.auditLogs = this.auditLogs.filter(log => 
        new Date(log.timestamp) > cutoffDate
      );

      const removedCount = initialCount - this.auditLogs.length;

      if (removedCount > 0) {
        logger.info("Audit logs cleanup completed", {
          removedCount,
          remainingCount: this.auditLogs.length,
          cutoffDate: cutoffDate.toISOString()
        });
      }

      return removedCount;

    } catch (error) {
      logger.error("Error cleaning up audit logs", { error: error.message });
      return 0;
    }
  }

  /**
   * Métodos auxiliares privados
   */
  generateAuditId() {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  sanitizeData(data) {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };
    
    this.sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = this.maskSensitiveData(sanitized[field]);
      }
    });

    return sanitized;
  }

  maskSensitiveData(value) {
    if (typeof value !== 'string') return '[MASKED]';
    
    if (value.includes('@')) {
      // Email
      const [local, domain] = value.split('@');
      return `${local.substr(0, 2)}***@${domain}`;
    } else if (value.startsWith('+')) {
      // Teléfono
      return `${value.substr(0, 4)}***${value.substr(-2)}`;
    } else {
      // Otros datos sensibles
      return `${value.substr(0, 2)}***`;
    }
  }

  sanitizeIP(ip) {
    if (!ip) return null;
    
    // Anonimizar IP para compliance RGPD
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    }
    
    return ip.substr(0, ip.length - 4) + 'xxxx';
  }

  determineSeverity(eventType) {
    const severityMap = {
      'security_incident': 'critical',
      'unauthorized_access': 'critical',
      'data_breach': 'critical',
      'security_config_change': 'high',
      'admin_action': 'high',
      'data_deletion': 'high',
      'data_export': 'medium',
      'data_access': 'medium',
      'gdpr_consent': 'medium',
      'login': 'low',
      'logout': 'low'
    };

    return severityMap[eventType] || 'low';
  }

  requiresInvestigation(incidentType) {
    const investigationRequired = [
      'unauthorized_access',
      'brute_force',
      'injection_attempt',
      'data_breach',
      'privilege_escalation'
    ];

    return investigationRequired.includes(incidentType);
  }

  requiresApproval(configType) {
    const approvalRequired = [
      'security_policy',
      'access_control',
      'encryption_settings',
      'backup_policy'
    ];

    return approvalRequired.includes(configType);
  }

  checkLegalBasisCompliance(logs) {
    const dataAccessLogs = logs.filter(l => l.eventType === 'data_access');
    return dataAccessLogs.every(log => log.details.legalBasis);
  }

  checkConsentCompliance(logs) {
    const consentLogs = logs.filter(l => l.eventType === 'gdpr_consent');
    return consentLogs.length > 0;
  }

  checkRetentionCompliance(logs) {
    // Verificar que no hay datos más antiguos que la política de retención
    const oldestLog = logs.reduce((oldest, log) => 
      new Date(log.timestamp) < new Date(oldest.timestamp) ? log : oldest
    );

    if (!oldestLog) return true;

    const logAge = Date.now() - new Date(oldestLog.timestamp).getTime();
    const maxAge = this.dataRetentionDays * 24 * 60 * 60 * 1000;

    return logAge <= maxAge;
  }

  checkPortabilityCompliance(logs) {
    const exportLogs = logs.filter(l => l.eventType === 'data_export');
    return exportLogs.length > 0 || logs.length === 0;
  }
}

// Exportar instancia singleton
module.exports = new AuditService();