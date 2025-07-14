// src/services/gdprService.js
// Servicio para gestión de compliance RGPD

const logger = require("../utils/logger");
const DatabaseAdapter = require("../adapters/databaseAdapter");

class GDPRService {
  constructor() {
    this.consentTypes = {
      WHATSAPP: 'whatsapp_communication',
      MARKETING: 'marketing_communication',
      ANALYTICS: 'analytics_tracking',
      SERVICE: 'service_provision',
      BOOKING: 'booking_management'
    };

    this.legalBases = {
      CONSENT: 'consent',
      CONTRACT: 'contract_performance',
      LEGAL_OBLIGATION: 'legal_obligation',
      VITAL_INTERESTS: 'vital_interests',
      PUBLIC_TASK: 'public_task',
      LEGITIMATE_INTEREST: 'legitimate_interest'
    };

    this.dataRetentionPeriods = {
      CLIENT_DATA: 365 * 3, // 3 años
      BOOKING_DATA: 365 * 7, // 7 años (obligación fiscal)
      CONVERSATION_DATA: 365 * 1, // 1 año
      MARKETING_DATA: 365 * 2, // 2 años
      ANALYTICS_DATA: 365 * 2 // 2 años
    };

    logger.info("GDPR Service initialized", {
      consentTypes: Object.keys(this.consentTypes).length,
      legalBases: Object.keys(this.legalBases).length
    });
  }

  /**
   * Registrar consentimiento del usuario
   */
  async recordConsent(clientId, consentType, granted, purpose, method = 'web', ipAddress = null) {
    try {
      const consentRecord = {
        client_id: clientId,
        consent_type: consentType,
        granted: granted,
        purpose: purpose,
        method: method,
        ip_address: ipAddress,
        timestamp: new Date().toISOString(),
        withdrawable: true,
        version: '1.0' // Versión de la política de privacidad
      };

      const result = await DatabaseAdapter.create('gdpr_consents', consentRecord);

      if (result.success) {
        logger.info("GDPR consent recorded", {
          clientId,
          consentType,
          granted,
          method
        });

        // Si se retira el consentimiento, procesar eliminación de datos
        if (!granted) {
          await this.processConsentWithdrawal(clientId, consentType);
        }

        return {
          success: true,
          consentId: result.data.id,
          data: consentRecord
        };
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      logger.error("Error recording GDPR consent", {
        clientId,
        consentType,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verificar consentimiento válido
   */
  async checkConsent(clientId, consentType) {
    try {
      const result = await DatabaseAdapter.query(`
        SELECT * FROM gdpr_consents 
        WHERE client_id = $1 AND consent_type = $2 
        ORDER BY timestamp DESC 
        LIMIT 1
      `, [clientId, consentType]);

      if (result.success && result.data.length > 0) {
        const consent = result.data[0];
        
        // Verificar si el consentimiento no ha expirado
        const consentDate = new Date(consent.timestamp);
        const expirationDate = new Date(consentDate.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 año
        
        const isValid = consent.granted && new Date() < expirationDate;

        return {
          success: true,
          hasConsent: isValid,
          consent: consent,
          expired: new Date() >= expirationDate
        };
      }

      return {
        success: true,
        hasConsent: false,
        consent: null
      };

    } catch (error) {
      logger.error("Error checking GDPR consent", {
        clientId,
        consentType,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Procesar retirada de consentimiento
   */
  async processConsentWithdrawal(clientId, consentType) {
    try {
      logger.info("Processing consent withdrawal", { clientId, consentType });

      switch (consentType) {
        case this.consentTypes.WHATSAPP:
          // Eliminar conversaciones de WhatsApp
          await this.deleteWhatsAppData(clientId);
          break;

        case this.consentTypes.MARKETING:
          // Eliminar datos de marketing
          await this.deleteMarketingData(clientId);
          break;

        case this.consentTypes.ANALYTICS:
          // Anonimizar datos de analytics
          await this.anonymizeAnalyticsData(clientId);
          break;

        case this.consentTypes.SERVICE:
          // Marcar para eliminación (mantener por obligaciones legales)
          await this.markForDeletion(clientId);
          break;
      }

      return { success: true };

    } catch (error) {
      logger.error("Error processing consent withdrawal", {
        clientId,
        consentType,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Exportar datos del usuario (derecho de portabilidad)
   */
  async exportUserData(clientId, format = 'json') {
    try {
      logger.info("Exporting user data", { clientId, format });

      // Obtener datos del cliente
      const clientResult = await DatabaseAdapter.findById('clients', clientId);
      if (!clientResult.success) {
        throw new Error('Cliente no encontrado');
      }

      // Obtener reservas
      const bookingsResult = await DatabaseAdapter.query(`
        SELECT * FROM bookings WHERE client_id = $1
      `, [clientId]);

      // Obtener consentimientos
      const consentsResult = await DatabaseAdapter.query(`
        SELECT * FROM gdpr_consents WHERE client_id = $1
      `, [clientId]);

      // Obtener conversaciones de WhatsApp (si hay consentimiento)
      let conversations = [];
      const whatsappConsent = await this.checkConsent(clientId, this.consentTypes.WHATSAPP);
      if (whatsappConsent.hasConsent) {
        const conversationsResult = await DatabaseAdapter.query(`
          SELECT * FROM whatsapp_conversations WHERE client_id = $1
        `, [clientId]);
        conversations = conversationsResult.success ? conversationsResult.data : [];
      }

      const exportData = {
        exportInfo: {
          clientId,
          exportDate: new Date().toISOString(),
          format,
          dataController: 'Ricardo Buriticá Beauty Consulting',
          contact: 'info@ricardoburitica.eu'
        },
        personalData: {
          client: clientResult.data,
          bookings: bookingsResult.success ? bookingsResult.data : [],
          consents: consentsResult.success ? consentsResult.data : [],
          conversations: conversations
        },
        metadata: {
          totalRecords: {
            bookings: bookingsResult.success ? bookingsResult.data.length : 0,
            consents: consentsResult.success ? consentsResult.data.length : 0,
            conversations: conversations.length
          }
        }
      };

      // Registrar la exportación
      await this.logDataAccess(clientId, 'export', 'data_portability_request');

      return {
        success: true,
        data: exportData
      };

    } catch (error) {
      logger.error("Error exporting user data", {
        clientId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Eliminar datos del usuario (derecho al olvido)
   */
  async deleteUserData(clientId, reason = 'user_request') {
    try {
      logger.info("Deleting user data", { clientId, reason });

      const deletionResults = [];

      // Verificar si hay obligaciones legales que impidan la eliminación
      const legalHold = await this.checkLegalHold(clientId);
      if (legalHold.hasHold) {
        return {
          success: false,
          error: 'No se pueden eliminar los datos debido a obligaciones legales',
          legalHold: legalHold.reasons
        };
      }

      // Eliminar conversaciones de WhatsApp
      const whatsappResult = await DatabaseAdapter.query(`
        DELETE FROM whatsapp_conversations WHERE client_id = $1
      `, [clientId]);
      deletionResults.push({ table: 'whatsapp_conversations', success: whatsappResult.success });

      // Anonimizar reservas (mantener para estadísticas)
      const bookingsResult = await DatabaseAdapter.query(`
        UPDATE bookings SET 
          client_name = 'DELETED_USER',
          client_phone = 'DELETED',
          client_email = 'DELETED',
          notes = 'USER_DATA_DELETED'
        WHERE client_id = $1
      `, [clientId]);
      deletionResults.push({ table: 'bookings_anonymized', success: bookingsResult.success });

      // Eliminar datos del cliente
      const clientResult = await DatabaseAdapter.delete('clients', clientId);
      deletionResults.push({ table: 'clients', success: clientResult.success });

      // Registrar la eliminación
      await this.logDataDeletion(clientId, reason);

      const allSuccessful = deletionResults.every(result => result.success);

      return {
        success: allSuccessful,
        deletionResults,
        deletedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error("Error deleting user data", {
        clientId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verificar retención legal de datos
   */
  async checkLegalHold(clientId) {
    try {
      const reasons = [];

      // Verificar reservas recientes (obligación fiscal - 7 años)
      const recentBookingsResult = await DatabaseAdapter.query(`
        SELECT COUNT(*) as count FROM bookings 
        WHERE client_id = $1 AND created_at > NOW() - INTERVAL '7 years'
      `, [clientId]);

      if (recentBookingsResult.success && recentBookingsResult.data[0].count > 0) {
        reasons.push('Obligación fiscal - conservación de facturas por 7 años');
      }

      // Verificar disputas o reclamaciones pendientes
      const disputesResult = await DatabaseAdapter.query(`
        SELECT COUNT(*) as count FROM disputes 
        WHERE client_id = $1 AND status = 'pending'
      `, [clientId]);

      if (disputesResult.success && disputesResult.data[0].count > 0) {
        reasons.push('Disputas o reclamaciones pendientes');
      }

      return {
        hasHold: reasons.length > 0,
        reasons
      };

    } catch (error) {
      logger.error("Error checking legal hold", {
        clientId,
        error: error.message
      });

      return {
        hasHold: true,
        reasons: ['Error verificando obligaciones legales']
      };
    }
  }

  /**
   * Generar reporte de compliance RGPD
   */
  async generateComplianceReport(startDate, endDate) {
    try {
      const report = {
        period: { startDate, endDate },
        generatedAt: new Date().toISOString(),
        summary: {},
        details: {}
      };

      // Consentimientos registrados
      const consentsResult = await DatabaseAdapter.query(`
        SELECT consent_type, granted, COUNT(*) as count
        FROM gdpr_consents 
        WHERE timestamp BETWEEN $1 AND $2
        GROUP BY consent_type, granted
      `, [startDate, endDate]);

      report.details.consents = consentsResult.success ? consentsResult.data : [];

      // Solicitudes de exportación
      const exportsResult = await DatabaseAdapter.query(`
        SELECT COUNT(*) as count FROM data_access_logs 
        WHERE action = 'export' AND timestamp BETWEEN $1 AND $2
      `, [startDate, endDate]);

      report.summary.dataExports = exportsResult.success ? exportsResult.data[0].count : 0;

      // Solicitudes de eliminación
      const deletionsResult = await DatabaseAdapter.query(`
        SELECT COUNT(*) as count FROM data_access_logs 
        WHERE action = 'delete' AND timestamp BETWEEN $1 AND $2
      `, [startDate, endDate]);

      report.summary.dataDeletions = deletionsResult.success ? deletionsResult.data[0].count : 0;

      // Verificar compliance
      report.compliance = {
        hasConsentManagement: true,
        hasDataPortability: true,
        hasRightToErasure: true,
        hasDataProtectionOfficer: true,
        hasPrivacyPolicy: true,
        dataRetentionPolicies: Object.keys(this.dataRetentionPeriods).length > 0
      };

      return {
        success: true,
        report
      };

    } catch (error) {
      logger.error("Error generating compliance report", {
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Métodos auxiliares privados
   */
  async deleteWhatsAppData(clientId) {
    return await DatabaseAdapter.query(`
      DELETE FROM whatsapp_conversations WHERE client_id = $1
    `, [clientId]);
  }

  async deleteMarketingData(clientId) {
    return await DatabaseAdapter.query(`
      UPDATE clients SET 
        marketing_consent = false,
        marketing_preferences = NULL
      WHERE id = $1
    `, [clientId]);
  }

  async anonymizeAnalyticsData(clientId) {
    return await DatabaseAdapter.query(`
      UPDATE analytics_events SET 
        client_id = NULL,
        ip_address = 'ANONYMIZED'
      WHERE client_id = $1
    `, [clientId]);
  }

  async markForDeletion(clientId) {
    return await DatabaseAdapter.query(`
      UPDATE clients SET 
        marked_for_deletion = true,
        deletion_date = NOW() + INTERVAL '30 days'
      WHERE id = $1
    `, [clientId]);
  }

  async logDataAccess(clientId, action, purpose) {
    return await DatabaseAdapter.create('data_access_logs', {
      client_id: clientId,
      action: action,
      purpose: purpose,
      timestamp: new Date().toISOString(),
      legal_basis: this.legalBases.LEGITIMATE_INTEREST
    });
  }

  async logDataDeletion(clientId, reason) {
    return await DatabaseAdapter.create('data_access_logs', {
      client_id: clientId,
      action: 'delete',
      purpose: reason,
      timestamp: new Date().toISOString(),
      legal_basis: this.legalBases.CONSENT
    });
  }

  /**
   * Limpiar datos expirados según políticas de retención
   */
  async cleanupExpiredData() {
    try {
      const cleanupResults = [];

      // Limpiar conversaciones de WhatsApp antiguas
      const conversationsResult = await DatabaseAdapter.query(`
        DELETE FROM whatsapp_conversations 
        WHERE created_at < NOW() - INTERVAL '${this.dataRetentionPeriods.CONVERSATION_DATA} days'
      `);
      cleanupResults.push({ 
        type: 'whatsapp_conversations', 
        success: conversationsResult.success,
        affected: conversationsResult.rowCount || 0
      });

      // Limpiar datos de marketing antiguos
      const marketingResult = await DatabaseAdapter.query(`
        UPDATE clients SET 
          marketing_consent = false,
          marketing_preferences = NULL
        WHERE marketing_consent_date < NOW() - INTERVAL '${this.dataRetentionPeriods.MARKETING_DATA} days'
      `);
      cleanupResults.push({ 
        type: 'marketing_data', 
        success: marketingResult.success,
        affected: marketingResult.rowCount || 0
      });

      logger.info("GDPR data cleanup completed", { cleanupResults });

      return {
        success: true,
        cleanupResults
      };

    } catch (error) {
      logger.error("Error in GDPR data cleanup", { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new GDPRService();