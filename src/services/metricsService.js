// src/services/metricsService.js
// Servicio de métricas y monitoreo del sistema

const logger = require("../utils/logger");

class MetricsService {
  constructor() {
    this.metrics = {
      // Métricas de rendimiento
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        byEndpoint: new Map(),
        responseTimeSum: 0,
        averageResponseTime: 0,
      },

      // Métricas de WhatsApp
      whatsapp: {
        messagesReceived: 0,
        messagesProcessed: 0,
        messagesFailed: 0,
        averageProcessingTime: 0,
        intentDistribution: new Map(),
        bookingsCreated: 0,
      },

      // Métricas de reservas
      bookings: {
        total: 0,
        confirmed: 0,
        cancelled: 0,
        completed: 0,
        bySource: new Map(),
        byService: new Map(),
        revenue: 0,
      },

      // Métricas de notificaciones
      notifications: {
        sent: 0,
        failed: 0,
        byType: new Map(),
        deliveryRate: 0,
      },

      // Métricas del sistema
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        activeConnections: 0,
        errors: new Map(),
      },
    };

    this.startTime = Date.now();
    this.lastReset = Date.now();

    // Iniciar recolección automática de métricas del sistema
    this.startSystemMetricsCollection();
  }

  /**
   * Registrar una request HTTP
   */
  recordRequest(endpoint, method, statusCode, responseTime) {
    try {
      this.metrics.requests.total++;
      this.metrics.requests.responseTimeSum += responseTime;
      this.metrics.requests.averageResponseTime =
        this.metrics.requests.responseTimeSum / this.metrics.requests.total;

      if (statusCode >= 200 && statusCode < 400) {
        this.metrics.requests.successful++;
      } else {
        this.metrics.requests.failed++;
      }

      const endpointKey = `${method} ${endpoint}`;
      const endpointMetrics = this.metrics.requests.byEndpoint.get(
        endpointKey
      ) || {
        count: 0,
        totalTime: 0,
        averageTime: 0,
        errors: 0,
      };

      endpointMetrics.count++;
      endpointMetrics.totalTime += responseTime;
      endpointMetrics.averageTime =
        endpointMetrics.totalTime / endpointMetrics.count;

      if (statusCode >= 400) {
        endpointMetrics.errors++;
      }

      this.metrics.requests.byEndpoint.set(endpointKey, endpointMetrics);
    } catch (error) {
      logger.error("Error recording request metrics", { error: error.message });
    }
  }

  /**
   * Registrar mensaje de WhatsApp procesado
   */
  recordWhatsAppMessage(intent, processingTime, success = true) {
    try {
      this.metrics.whatsapp.messagesReceived++;

      if (success) {
        this.metrics.whatsapp.messagesProcessed++;

        // Actualizar distribución de intenciones
        const currentCount =
          this.metrics.whatsapp.intentDistribution.get(intent) || 0;
        this.metrics.whatsapp.intentDistribution.set(intent, currentCount + 1);

        // Actualizar tiempo promedio de procesamiento
        const totalProcessed = this.metrics.whatsapp.messagesProcessed;
        this.metrics.whatsapp.averageProcessingTime =
          (this.metrics.whatsapp.averageProcessingTime * (totalProcessed - 1) +
            processingTime) /
          totalProcessed;
      } else {
        this.metrics.whatsapp.messagesFailed++;
      }

      if (intent === "appointment_request" && success) {
        this.metrics.whatsapp.bookingsCreated++;
      }
    } catch (error) {
      logger.error("Error recording WhatsApp metrics", {
        error: error.message,
      });
    }
  }

  /**
   * Registrar reserva creada
   */
  recordBooking(source, service, amount, status = "confirmed") {
    try {
      this.metrics.bookings.total++;

      // Actualizar por estado
      if (status === "confirmed") {
        this.metrics.bookings.confirmed++;
      } else if (status === "cancelled") {
        this.metrics.bookings.cancelled++;
      } else if (status === "completed") {
        this.metrics.bookings.completed++;
        this.metrics.bookings.revenue += amount || 0;
      }

      // Actualizar por fuente
      const sourceCount = this.metrics.bookings.bySource.get(source) || 0;
      this.metrics.bookings.bySource.set(source, sourceCount + 1);

      // Actualizar por servicio
      const serviceCount = this.metrics.bookings.byService.get(service) || 0;
      this.metrics.bookings.byService.set(service, serviceCount + 1);
    } catch (error) {
      logger.error("Error recording booking metrics", { error: error.message });
    }
  }

  /**
   * Registrar notificación enviada
   */
  recordNotification(type, success = true) {
    try {
      if (success) {
        this.metrics.notifications.sent++;
      } else {
        this.metrics.notifications.failed++;
      }

      // Actualizar por tipo
      const typeMetrics = this.metrics.notifications.byType.get(type) || {
        sent: 0,
        failed: 0,
      };

      if (success) {
        typeMetrics.sent++;
      } else {
        typeMetrics.failed++;
      }

      this.metrics.notifications.byType.set(type, typeMetrics);

      // Calcular tasa de entrega
      const total =
        this.metrics.notifications.sent + this.metrics.notifications.failed;
      this.metrics.notifications.deliveryRate =
        total > 0 ? (this.metrics.notifications.sent / total) * 100 : 0;
    } catch (error) {
      logger.error("Error recording notification metrics", {
        error: error.message,
      });
    }
  }

  /**
   * Registrar error del sistema
   */
  recordError(type, error, context = {}) {
    try {
      const errorKey = `${type}: ${error.message || error}`;
      const errorCount = this.metrics.system.errors.get(errorKey) || 0;
      this.metrics.system.errors.set(errorKey, errorCount + 1);

      logger.error("System error recorded in metrics", {
        type,
        error: error.message || error,
        context,
        count: errorCount + 1,
      });
    } catch (err) {
      logger.error("Error recording error metrics", { error: err.message });
    }
  }

  /**
   * Obtener todas las métricas
   */
  getMetrics() {
    try {
      // Actualizar métricas del sistema en tiempo real
      this.updateSystemMetrics();

      return {
        ...this.metrics,
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime,
        lastReset: this.lastReset,
      };
    } catch (error) {
      logger.error("Error getting metrics", { error: error.message });
      return null;
    }
  }

  /**
   * Obtener resumen de métricas
   */
  getSummary() {
    try {
      const metrics = this.getMetrics();

      return {
        performance: {
          totalRequests: metrics.requests.total,
          successRate:
            metrics.requests.total > 0
              ? (
                  (metrics.requests.successful / metrics.requests.total) *
                  100
                ).toFixed(2) + "%"
              : "0%",
          averageResponseTime:
            metrics.requests.averageResponseTime.toFixed(2) + "ms",
        },
        whatsapp: {
          messagesProcessed: metrics.whatsapp.messagesProcessed,
          processingSuccessRate:
            metrics.whatsapp.messagesReceived > 0
              ? (
                  (metrics.whatsapp.messagesProcessed /
                    metrics.whatsapp.messagesReceived) *
                  100
                ).toFixed(2) + "%"
              : "0%",
          bookingsFromWhatsApp: metrics.whatsapp.bookingsCreated,
        },
        bookings: {
          total: metrics.bookings.total,
          confirmed: metrics.bookings.confirmed,
          revenue: "€" + metrics.bookings.revenue.toFixed(2),
        },
        notifications: {
          sent: metrics.notifications.sent,
          deliveryRate: metrics.notifications.deliveryRate.toFixed(2) + "%",
        },
        system: {
          uptime: this.formatUptime(metrics.uptime),
          memoryUsage:
            (metrics.system.memoryUsage.heapUsed / 1024 / 1024).toFixed(2) +
            " MB",
          errorCount: Array.from(metrics.system.errors.values()).reduce(
            (a, b) => a + b,
            0
          ),
        },
      };
    } catch (error) {
      logger.error("Error getting metrics summary", { error: error.message });
      return null;
    }
  }

  /**
   * Resetear métricas
   */
  reset() {
    try {
      const oldMetrics = { ...this.metrics };

      // Resetear contadores pero mantener configuración
      this.metrics.requests = {
        total: 0,
        successful: 0,
        failed: 0,
        byEndpoint: new Map(),
        responseTimeSum: 0,
        averageResponseTime: 0,
      };

      this.metrics.whatsapp = {
        messagesReceived: 0,
        messagesProcessed: 0,
        messagesFailed: 0,
        averageProcessingTime: 0,
        intentDistribution: new Map(),
        bookingsCreated: 0,
      };

      this.metrics.bookings = {
        total: 0,
        confirmed: 0,
        cancelled: 0,
        completed: 0,
        bySource: new Map(),
        byService: new Map(),
        revenue: 0,
      };

      this.metrics.notifications = {
        sent: 0,
        failed: 0,
        byType: new Map(),
        deliveryRate: 0,
      };

      this.metrics.system.errors = new Map();
      this.lastReset = Date.now();

      logger.info("Metrics reset successfully", {
        previousMetrics: {
          requests: oldMetrics.requests.total,
          whatsappMessages: oldMetrics.whatsapp.messagesReceived,
          bookings: oldMetrics.bookings.total,
        },
      });

      return true;
    } catch (error) {
      logger.error("Error resetting metrics", { error: error.message });
      return false;
    }
  }

  /**
   * Iniciar recolección automática de métricas del sistema
   */
  startSystemMetricsCollection() {
    // Actualizar métricas del sistema cada 30 segundos
    setInterval(() => {
      this.updateSystemMetrics();
    }, 30000);
  }

  /**
   * Actualizar métricas del sistema
   */
  updateSystemMetrics() {
    try {
      this.metrics.system.uptime = process.uptime();
      this.metrics.system.memoryUsage = process.memoryUsage();
      this.metrics.system.cpuUsage = process.cpuUsage();
    } catch (error) {
      logger.error("Error updating system metrics", { error: error.message });
    }
  }

  /**
   * Formatear tiempo de actividad
   */
  formatUptime(uptimeMs) {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Obtener métricas de rendimiento por endpoint
   */
  getEndpointMetrics() {
    try {
      const endpointMetrics = [];

      for (const [endpoint, metrics] of this.metrics.requests.byEndpoint) {
        endpointMetrics.push({
          endpoint,
          requests: metrics.count,
          averageTime: metrics.averageTime.toFixed(2) + "ms",
          errors: metrics.errors,
          errorRate:
            metrics.count > 0
              ? ((metrics.errors / metrics.count) * 100).toFixed(2) + "%"
              : "0%",
        });
      }

      return endpointMetrics.sort((a, b) => b.requests - a.requests);
    } catch (error) {
      logger.error("Error getting endpoint metrics", { error: error.message });
      return [];
    }
  }

  /**
   * Obtener alertas basadas en métricas
   */
  getAlerts() {
    try {
      const alerts = [];
      const metrics = this.getMetrics();

      // Alerta de tasa de error alta
      if (metrics.requests.total > 100) {
        const errorRate =
          (metrics.requests.failed / metrics.requests.total) * 100;
        if (errorRate > 5) {
          alerts.push({
            type: "error_rate",
            severity: errorRate > 10 ? "critical" : "warning",
            message: `Tasa de error alta: ${errorRate.toFixed(2)}%`,
            value: errorRate,
          });
        }
      }

      // Alerta de tiempo de respuesta alto
      if (metrics.requests.averageResponseTime > 2000) {
        alerts.push({
          type: "response_time",
          severity:
            metrics.requests.averageResponseTime > 5000
              ? "critical"
              : "warning",
          message: `Tiempo de respuesta alto: ${metrics.requests.averageResponseTime.toFixed(2)}ms`,
          value: metrics.requests.averageResponseTime,
        });
      }

      // Alerta de uso de memoria alto
      const memoryUsageMB = metrics.system.memoryUsage.heapUsed / 1024 / 1024;
      if (memoryUsageMB > 500) {
        alerts.push({
          type: "memory_usage",
          severity: memoryUsageMB > 1000 ? "critical" : "warning",
          message: `Uso de memoria alto: ${memoryUsageMB.toFixed(2)} MB`,
          value: memoryUsageMB,
        });
      }

      // Alerta de tasa de entrega de notificaciones baja
      if (
        metrics.notifications.deliveryRate < 90 &&
        metrics.notifications.sent > 10
      ) {
        alerts.push({
          type: "notification_delivery",
          severity:
            metrics.notifications.deliveryRate < 80 ? "critical" : "warning",
          message: `Tasa de entrega de notificaciones baja: ${metrics.notifications.deliveryRate.toFixed(2)}%`,
          value: metrics.notifications.deliveryRate,
        });
      }

      return alerts;
    } catch (error) {
      logger.error("Error getting alerts", { error: error.message });
      return [];
    }
  }
}

// Exportar instancia singleton
module.exports = new MetricsService();
