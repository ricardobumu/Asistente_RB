// src/workers/backgroundWorker.js
// Worker para tareas en background y procesamiento asíncrono

const logger = require("../utils/logger");
const DatabaseAdapter = require("../adapters/databaseAdapter");
const emailService = require("../services/emailService");
const whatsappService = require("../services/whatsappService");
const googleCalendarClient = require("../integrations/googleCalendarClient");
const calendlyClient = require("../integrations/calendlyClient");

class BackgroundWorker {
  constructor() {
    this.isRunning = false;
    this.taskQueue = [];
    this.processingInterval = null;
    this.maxConcurrentTasks = 5;
    this.currentTasks = 0;

    // Estadísticas del worker
    this.stats = {
      tasksProcessed: 0,
      tasksSuccessful: 0,
      tasksFailed: 0,
      startTime: new Date(),
      lastTaskTime: null,
    };

    // Tipos de tareas soportadas
    this.taskHandlers = {
      send_email: this.handleSendEmail.bind(this),
      send_whatsapp: this.handleSendWhatsApp.bind(this),
      send_sms: this.handleSendSMS.bind(this),
      sync_calendar: this.handleSyncCalendar.bind(this),
      process_booking: this.handleProcessBooking.bind(this),
      send_reminder: this.handleSendReminder.bind(this),
      cleanup_data: this.handleCleanupData.bind(this),
      generate_report: this.handleGenerateReport.bind(this),
      backup_data: this.handleBackupData.bind(this),
      update_statistics: this.handleUpdateStatistics.bind(this),
    };
  }

  /**
   * Iniciar el worker
   */
  start() {
    if (this.isRunning) {
      logger.warn("Background worker is already running");
      return;
    }

    this.isRunning = true;
    logger.info("Background worker started", {
      pid: process.pid,
      maxConcurrentTasks: this.maxConcurrentTasks,
    });

    // Procesar tareas cada 5 segundos
    this.processingInterval = setInterval(() => {
      this.processTasks();
    }, 5000);

    // Cargar tareas pendientes de la base de datos
    this.loadPendingTasks();

    // Configurar manejo de señales
    this.setupSignalHandlers();
  }

  /**
   * Detener el worker
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info("Stopping background worker...");
    this.isRunning = false;

    // Detener el intervalo de procesamiento
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Esperar a que terminen las tareas actuales
    while (this.currentTasks > 0) {
      logger.info(`Waiting for ${this.currentTasks} tasks to complete...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Guardar tareas pendientes en la base de datos
    await this.savePendingTasks();

    logger.info("Background worker stopped", {
      tasksProcessed: this.stats.tasksProcessed,
      tasksSuccessful: this.stats.tasksSuccessful,
      tasksFailed: this.stats.tasksFailed,
      uptime: Date.now() - this.stats.startTime.getTime(),
    });
  }

  /**
   * Agregar tarea a la cola
   */
  addTask(taskType, taskData, priority = "normal", delay = 0) {
    const task = {
      id: require("crypto").randomUUID(),
      type: taskType,
      data: taskData,
      priority: priority, // high, normal, low
      createdAt: new Date(),
      scheduledAt: new Date(Date.now() + delay),
      attempts: 0,
      maxAttempts: 3,
      status: "pending",
    };

    this.taskQueue.push(task);

    // Ordenar por prioridad y fecha programada
    this.taskQueue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return a.scheduledAt - b.scheduledAt;
    });

    logger.debug("Task added to queue", {
      taskId: task.id,
      type: taskType,
      priority,
      queueSize: this.taskQueue.length,
    });

    return task.id;
  }

  /**
   * Procesar tareas de la cola
   */
  async processTasks() {
    if (!this.isRunning || this.currentTasks >= this.maxConcurrentTasks) {
      return;
    }

    const now = new Date();
    const tasksToProcess = this.taskQueue
      .filter((task) => task.status === "pending" && task.scheduledAt <= now)
      .slice(0, this.maxConcurrentTasks - this.currentTasks);

    for (const task of tasksToProcess) {
      this.processTask(task);
    }
  }

  /**
   * Procesar una tarea individual
   */
  async processTask(task) {
    this.currentTasks++;
    task.status = "processing";
    task.startedAt = new Date();

    logger.debug("Processing task", {
      taskId: task.id,
      type: task.type,
      attempt: task.attempts + 1,
    });

    try {
      const handler = this.taskHandlers[task.type];
      if (!handler) {
        throw new Error(`Unknown task type: ${task.type}`);
      }

      await handler(task.data);

      // Tarea completada exitosamente
      task.status = "completed";
      task.completedAt = new Date();
      this.stats.tasksSuccessful++;

      logger.info("Task completed successfully", {
        taskId: task.id,
        type: task.type,
        duration: task.completedAt - task.startedAt,
      });
    } catch (error) {
      task.attempts++;
      task.lastError = error.message;

      if (task.attempts >= task.maxAttempts) {
        task.status = "failed";
        task.failedAt = new Date();
        this.stats.tasksFailed++;

        logger.error("Task failed permanently", {
          taskId: task.id,
          type: task.type,
          attempts: task.attempts,
          error: error.message,
        });
      } else {
        task.status = "pending";
        task.scheduledAt = new Date(Date.now() + task.attempts * 30000); // Retry con backoff

        logger.warn("Task failed, will retry", {
          taskId: task.id,
          type: task.type,
          attempt: task.attempts,
          nextRetry: task.scheduledAt,
          error: error.message,
        });
      }
    } finally {
      this.currentTasks--;
      this.stats.tasksProcessed++;
      this.stats.lastTaskTime = new Date();

      // Remover tareas completadas o fallidas de la cola
      if (task.status === "completed" || task.status === "failed") {
        const index = this.taskQueue.indexOf(task);
        if (index > -1) {
          this.taskQueue.splice(index, 1);
        }
      }
    }
  }

  /**
   * Handlers para diferentes tipos de tareas
   */
  async handleSendEmail(data) {
    const { to, subject, template, templateData, attachments } = data;

    if (!emailService) {
      throw new Error("Email service not available");
    }

    await emailService.sendEmail({
      to,
      subject,
      template,
      templateData,
      attachments,
    });
  }

  async handleSendWhatsApp(data) {
    const { to, message, template, templateData } = data;

    if (!whatsappService) {
      throw new Error("WhatsApp service not available");
    }

    await whatsappService.sendMessage(to, message, template, templateData);
  }

  async handleSendSMS(data) {
    const { to, message } = data;

    // Implementar servicio SMS
    logger.info("SMS sent", { to, message: message.substring(0, 50) + "..." });
  }

  async handleSyncCalendar(data) {
    const { bookingId, action } = data;

    if (!googleCalendarClient.isInitialized()) {
      throw new Error("Google Calendar not configured");
    }

    // Implementar sincronización según la acción
    switch (action) {
      case "create":
        await this.createCalendarEvent(bookingId);
        break;
      case "update":
        await this.updateCalendarEvent(bookingId);
        break;
      case "delete":
        await this.deleteCalendarEvent(bookingId);
        break;
      default:
        throw new Error(`Unknown calendar action: ${action}`);
    }
  }

  async handleProcessBooking(data) {
    const { bookingId, action } = data;

    // Procesar reserva según la acción
    switch (action) {
      case "confirm":
        await this.confirmBooking(bookingId);
        break;
      case "cancel":
        await this.cancelBooking(bookingId);
        break;
      case "reminder":
        await this.sendBookingReminder(bookingId);
        break;
      default:
        throw new Error(`Unknown booking action: ${action}`);
    }
  }

  async handleSendReminder(data) {
    const { bookingId, type, timeBeforeBooking } = data;

    // Obtener información de la reserva
    const booking = await this.getBookingDetails(bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    // Enviar recordatorio según el tipo
    switch (type) {
      case "email":
        await this.sendEmailReminder(booking);
        break;
      case "whatsapp":
        await this.sendWhatsAppReminder(booking);
        break;
      case "sms":
        await this.sendSMSReminder(booking);
        break;
      default:
        throw new Error(`Unknown reminder type: ${type}`);
    }
  }

  async handleCleanupData(data) {
    const { type, olderThan } = data;

    switch (type) {
      case "sessions":
        await this.cleanupExpiredSessions();
        break;
      case "logs":
        await this.cleanupOldLogs(olderThan);
        break;
      case "cache":
        await this.cleanupCache();
        break;
      default:
        throw new Error(`Unknown cleanup type: ${type}`);
    }
  }

  async handleGenerateReport(data) {
    const { reportType, dateRange, recipients } = data;

    // Generar reporte según el tipo
    const report = await this.generateReport(reportType, dateRange);

    // Enviar reporte a los destinatarios
    if (recipients && recipients.length > 0) {
      await this.sendReport(report, recipients);
    }
  }

  async handleBackupData(data) {
    const { tables, destination } = data;

    // Implementar backup de datos
    logger.info("Data backup completed", { tables, destination });
  }

  async handleUpdateStatistics(data) {
    const { type } = data;

    switch (type) {
      case "database":
        await this.updateDatabaseStatistics();
        break;
      case "performance":
        await this.updatePerformanceStatistics();
        break;
      case "business":
        await this.updateBusinessStatistics();
        break;
      default:
        throw new Error(`Unknown statistics type: ${type}`);
    }
  }

  /**
   * Métodos auxiliares
   */
  async loadPendingTasks() {
    try {
      const result = await DatabaseAdapter.query(`
        SELECT * FROM background_tasks 
        WHERE status IN ('pending', 'processing') 
        ORDER BY priority DESC, scheduled_at ASC
      `);

      if (result.data) {
        this.taskQueue = result.data.map((row) => ({
          id: row.id,
          type: row.task_type,
          data: row.task_data,
          priority: row.priority,
          createdAt: new Date(row.created_at),
          scheduledAt: new Date(row.scheduled_at),
          attempts: row.attempts,
          maxAttempts: row.max_attempts,
          status: row.status,
        }));

        logger.info("Loaded pending tasks from database", {
          count: this.taskQueue.length,
        });
      }
    } catch (error) {
      logger.error("Error loading pending tasks", { error: error.message });
    }
  }

  async savePendingTasks() {
    try {
      for (const task of this.taskQueue) {
        if (task.status === "pending") {
          await DatabaseAdapter.query(
            `
            INSERT INTO background_tasks (
              id, task_type, task_data, priority, scheduled_at, 
              attempts, max_attempts, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO UPDATE SET
              status = EXCLUDED.status,
              attempts = EXCLUDED.attempts,
              scheduled_at = EXCLUDED.scheduled_at
          `,
            [
              task.id,
              task.type,
              JSON.stringify(task.data),
              task.priority,
              task.scheduledAt.toISOString(),
              task.attempts,
              task.maxAttempts,
              task.status,
              task.createdAt.toISOString(),
            ],
          );
        }
      }

      logger.info("Saved pending tasks to database");
    } catch (error) {
      logger.error("Error saving pending tasks", { error: error.message });
    }
  }

  setupSignalHandlers() {
    process.on("SIGTERM", async () => {
      logger.info("Received SIGTERM, shutting down gracefully...");
      await this.stop();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      logger.info("Received SIGINT, shutting down gracefully...");
      await this.stop();
      process.exit(0);
    });
  }

  /**
   * Obtener estadísticas del worker
   */
  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime.getTime(),
      queueSize: this.taskQueue.length,
      currentTasks: this.currentTasks,
      isRunning: this.isRunning,
    };
  }
}

// Crear y iniciar el worker si se ejecuta directamente
if (require.main === module) {
  const worker = new BackgroundWorker();
  worker.start();

  // Exponer estadísticas para monitoreo
  if (process.send) {
    setInterval(() => {
      process.send({
        type: "worker:stats",
        data: worker.getStats(),
      });
    }, 30000); // Cada 30 segundos
  }
}

module.exports = BackgroundWorker;
