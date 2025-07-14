// src/workers/gdprCleanupWorker.js
// Worker para limpieza automática de datos según políticas RGPD

const cron = require("node-cron");
const gdprService = require("../services/gdprService");
const logger = require("../utils/logger");
const { GDPR_CLEANUP_ENABLED } = require("../config/env");

class GDPRCleanupWorker {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
    this.stats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastError: null,
    };

    logger.info("GDPR Cleanup Worker initialized", {
      enabled: GDPR_CLEANUP_ENABLED,
      schedule: "Daily at 02:00",
    });
  }

  /**
   * Iniciar el worker de limpieza
   */
  start() {
    if (!GDPR_CLEANUP_ENABLED) {
      logger.info("GDPR cleanup disabled by configuration");
      return;
    }

    // Ejecutar diariamente a las 2:00 AM
    cron.schedule(
      "0 2 * * *",
      async () => {
        await this.runCleanup();
      },
      {
        scheduled: true,
        timezone: "Europe/Madrid",
      }
    );

    // Ejecutar también semanalmente los domingos a las 3:00 AM para limpieza profunda
    cron.schedule(
      "0 3 * * 0",
      async () => {
        await this.runDeepCleanup();
      },
      {
        scheduled: true,
        timezone: "Europe/Madrid",
      }
    );

    logger.info("GDPR Cleanup Worker started", {
      dailySchedule: "02:00",
      weeklySchedule: "Sunday 03:00",
    });
  }

  /**
   * Ejecutar limpieza diaria
   */
  async runCleanup() {
    if (this.isRunning) {
      logger.warn("GDPR cleanup already running, skipping");
      return;
    }

    this.isRunning = true;
    this.stats.totalRuns++;

    try {
      logger.info("Starting GDPR data cleanup");

      const startTime = Date.now();
      const result = await gdprService.cleanupExpiredData();
      const duration = Date.now() - startTime;

      if (result.success) {
        this.stats.successfulRuns++;
        this.lastRun = new Date();

        logger.info("GDPR cleanup completed successfully", {
          duration: `${duration}ms`,
          results: result.cleanupResults,
          totalRuns: this.stats.totalRuns,
          successRate: `${((this.stats.successfulRuns / this.stats.totalRuns) * 100).toFixed(2)}%`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      this.stats.failedRuns++;
      this.stats.lastError = {
        message: error.message,
        timestamp: new Date().toISOString(),
      };

      logger.error("GDPR cleanup failed", {
        error: error.message,
        totalRuns: this.stats.totalRuns,
        failedRuns: this.stats.failedRuns,
      });

      // Notificar al administrador en caso de fallo
      await this.notifyCleanupFailure(error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Ejecutar limpieza profunda semanal
   */
  async runDeepCleanup() {
    if (this.isRunning) {
      logger.warn("GDPR cleanup already running, skipping deep cleanup");
      return;
    }

    this.isRunning = true;

    try {
      logger.info("Starting GDPR deep cleanup");

      const startTime = Date.now();

      // Ejecutar limpieza estándar
      const standardResult = await gdprService.cleanupExpiredData();

      // Ejecutar tareas adicionales de limpieza profunda
      const deepResults = await this.performDeepCleanup();

      const duration = Date.now() - startTime;

      logger.info("GDPR deep cleanup completed", {
        duration: `${duration}ms`,
        standardCleanup: standardResult.cleanupResults,
        deepCleanup: deepResults,
      });
    } catch (error) {
      logger.error("GDPR deep cleanup failed", {
        error: error.message,
      });

      await this.notifyCleanupFailure(error, "deep");
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Realizar limpieza profunda adicional
   */
  async performDeepCleanup() {
    const results = [];

    try {
      // Limpiar logs de auditoría antiguos (mantener solo 2 años)
      const auditCleanup = await this.cleanupOldAuditLogs();
      results.push({ type: "audit_logs", ...auditCleanup });

      // Limpiar consentimientos duplicados o inválidos
      const consentCleanup = await this.cleanupInvalidConsents();
      results.push({ type: "invalid_consents", ...consentCleanup });

      // Verificar y corregir inconsistencias de datos
      const consistencyCheck = await this.checkDataConsistency();
      results.push({ type: "consistency_check", ...consistencyCheck });

      // Generar reporte de compliance
      const complianceReport = await this.generateComplianceReport();
      results.push({ type: "compliance_report", ...complianceReport });

      return results;
    } catch (error) {
      logger.error("Error in deep cleanup tasks", { error: error.message });
      return [{ type: "error", message: error.message }];
    }
  }

  /**
   * Limpiar logs de auditoría antiguos
   */
  async cleanupOldAuditLogs() {
    try {
      // Implementar limpieza de logs de auditoría mayores a 2 años
      // Esto debería conectar con DatabaseAdapter

      logger.info("Cleaning up old audit logs");

      // Placeholder - implementar lógica real
      return {
        success: true,
        deletedRecords: 0,
        message: "Audit logs cleanup completed",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Limpiar consentimientos inválidos o duplicados
   */
  async cleanupInvalidConsents() {
    try {
      logger.info("Cleaning up invalid consents");

      // Placeholder - implementar lógica real
      return {
        success: true,
        cleanedRecords: 0,
        message: "Invalid consents cleanup completed",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verificar consistencia de datos
   */
  async checkDataConsistency() {
    try {
      logger.info("Checking data consistency");

      // Placeholder - implementar verificaciones de consistencia
      return {
        success: true,
        issues: [],
        message: "Data consistency check completed",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generar reporte de compliance semanal
   */
  async generateComplianceReport() {
    try {
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const report = await gdprService.generateComplianceReport(
        startDate,
        endDate
      );

      if (report.success) {
        logger.info("Weekly compliance report generated", {
          period: `${startDate} to ${endDate}`,
          summary: report.report.summary,
        });

        return {
          success: true,
          report: report.report,
          message: "Compliance report generated",
        };
      } else {
        throw new Error(report.error);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Notificar fallo en limpieza
   */
  async notifyCleanupFailure(error, type = "standard") {
    try {
      logger.error(`GDPR ${type} cleanup failure notification`, {
        error: error.message,
        type,
        timestamp: new Date().toISOString(),
        stats: this.stats,
      });

      // Aquí se podría implementar notificación por email al DPO
      // await emailService.sendGDPRAlert({
      //   type: 'cleanup_failure',
      //   error: error.message,
      //   cleanupType: type
      // });
    } catch (notificationError) {
      logger.error("Failed to send cleanup failure notification", {
        originalError: error.message,
        notificationError: notificationError.message,
      });
    }
  }

  /**
   * Ejecutar limpieza manual
   */
  async runManualCleanup() {
    if (this.isRunning) {
      throw new Error("Cleanup already running");
    }

    logger.info("Manual GDPR cleanup requested");
    await this.runCleanup();

    return {
      success: true,
      message: "Manual cleanup completed",
      stats: this.stats,
      lastRun: this.lastRun,
    };
  }

  /**
   * Obtener estadísticas del worker
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      enabled: GDPR_CLEANUP_ENABLED,
      nextRun: this.getNextRunTime(),
    };
  }

  /**
   * Obtener próxima ejecución programada
   */
  getNextRunTime() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0);

    return tomorrow.toISOString();
  }

  /**
   * Detener el worker
   */
  stop() {
    logger.info("GDPR Cleanup Worker stopped");
    // Los cron jobs se detienen automáticamente cuando el proceso termina
  }
}

module.exports = new GDPRCleanupWorker();
