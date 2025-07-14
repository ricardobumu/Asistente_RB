// src/services/notificationScheduler.js
// Programador automático de notificaciones con cola de envío y reintentos

const cron = require('node-cron');
const logger = require('../utils/logger');
const NotificationModel = require('../models/notificationModel');
const BookingModel = require('../models/bookingModel');
const ClientModel = require('../models/clientModel');
const notificationService = require('./notificationService');

class NotificationScheduler {
  constructor() {
    this.notificationModel = new NotificationModel();
    this.bookingModel = new BookingModel();
    this.clientModel = new ClientModel();
    this.isRunning = false;
    this.scheduledJobs = new Map();
    this.retryQueue = [];
    this.maxRetries = 3;
    this.retryDelay = 5 * 60 * 1000; // 5 minutos
    
    logger.info('NotificationScheduler initialized');
  }

  /**
   * Iniciar el programador de notificaciones
   */
  start() {
    if (this.isRunning) {
      logger.warn('NotificationScheduler already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Starting NotificationScheduler');

    // Programar verificación cada 5 minutos
    this.scheduledJobs.set('main', cron.schedule('*/5 * * * *', () => {
      this.processScheduledNotifications();
    }, {
      scheduled: true,
      timezone: "Europe/Madrid"
    }));

    // Programar procesamiento de cola de reintentos cada 10 minutos
    this.scheduledJobs.set('retry', cron.schedule('*/10 * * * *', () => {
      this.processRetryQueue();
    }, {
      scheduled: true,
      timezone: "Europe/Madrid"
    }));

    // Programar limpieza de notificaciones antiguas cada día a las 2:00 AM
    this.scheduledJobs.set('cleanup', cron.schedule('0 2 * * *', () => {
      this.cleanupOldNotifications();
    }, {
      scheduled: true,
      timezone: "Europe/Madrid"
    }));

    logger.info('✅ NotificationScheduler started with 3 cron jobs');
  }

  /**
   * Detener el programador
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('NotificationScheduler not running');
      return;
    }

    this.isRunning = false;
    
    // Detener todos los trabajos programados
    this.scheduledJobs.forEach((job, name) => {
      job.destroy();
      logger.info(`Stopped cron job: ${name}`);
    });
    
    this.scheduledJobs.clear();
    logger.info('🛑 NotificationScheduler stopped');
  }

  /**
   * Procesar notificaciones programadas
   */
  async processScheduledNotifications() {
    try {
      logger.info('🔄 Processing scheduled notifications');
      
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      // Obtener reservas para las próximas 24 horas
      const upcomingBookings = await this.getUpcomingBookings(now, in24Hours);
      
      for (const booking of upcomingBookings) {
        await this.scheduleBookingNotifications(booking, now, in24Hours, in2Hours);
      }

      logger.info(`✅ Processed ${upcomingBookings.length} upcoming bookings`);
    } catch (error) {
      logger.error('❌ Error processing scheduled notifications', { 
        error: error.message,
        stack: error.stack 
      });
    }
  }

  /**
   * Programar notificaciones para una reserva específica
   */
  async scheduleBookingNotifications(booking, now, in24Hours, in2Hours) {
    try {
      const appointmentTime = new Date(booking.appointment_date + ' ' + booking.appointment_time);
      const clientResult = await this.clientModel.getById(booking.client_id);
      
      if (!clientResult.success || !clientResult.data) {
        logger.warn(`Client not found for booking ${booking.id}`);
        return;
      }

      const client = clientResult.data;

      // Recordatorio 24 horas antes
      if (appointmentTime <= in24Hours && appointmentTime > in2Hours) {
        await this.scheduleNotification(booking, client, 'booking_reminder_24h', appointmentTime);
      }

      // Recordatorio 2 horas antes
      if (appointmentTime <= in2Hours && appointmentTime > now) {
        await this.scheduleNotification(booking, client, 'booking_reminder_2h', appointmentTime);
      }

      // Instrucciones de preparación (24h antes para servicios que lo requieren)
      if (this.requiresPreparationInstructions(booking.service_name) && appointmentTime <= in24Hours) {
        await this.scheduleNotification(booking, client, 'preparation_instructions', appointmentTime);
      }

    } catch (error) {
      logger.error('Error scheduling booking notifications', {
        bookingId: booking.id,
        error: error.message
      });
    }
  }

  /**
   * Programar una notificación específica
   */
  async scheduleNotification(booking, client, notificationType, appointmentTime) {
    try {
      // Verificar si ya se envió esta notificación
      const existingNotification = await this.notificationModel.findExisting(
        booking.id,
        client.id,
        notificationType
      );

      if (existingNotification.success && existingNotification.data) {
        logger.debug(`Notification ${notificationType} already sent for booking ${booking.id}`);
        return;
      }

      // Crear registro de notificación programada
      const notificationData = {
        booking_id: booking.id,
        client_id: client.id,
        recipient_phone: client.phone,
        notification_type: notificationType,
        scheduled_for: new Date(),
        status: 'pending',
        channel: client.preferred_contact_method || 'whatsapp',
        metadata: {
          booking: booking,
          client: client,
          appointment_time: appointmentTime
        }
      };

      const result = await this.notificationModel.create(notificationData);
      
      if (result.success) {
        // Enviar inmediatamente
        await this.sendNotification(result.data);
        logger.info(`📅 Scheduled ${notificationType} for booking ${booking.id}`);
      }

    } catch (error) {
      logger.error('Error scheduling notification', {
        bookingId: booking.id,
        notificationType,
        error: error.message
      });
    }
  }

  /**
   * Enviar una notificación
   */
  async sendNotification(notification) {
    try {
      const { booking, client } = notification.metadata;
      let result;

      switch (notification.notification_type) {
        case 'booking_reminder_24h':
          result = await notificationService.sendBookingReminder(booking, client, '24 horas');
          break;
        
        case 'booking_reminder_2h':
          result = await notificationService.sendBookingReminder(booking, client, '2 horas');
          break;
        
        case 'preparation_instructions':
          result = await this.sendPreparationInstructions(booking, client);
          break;
        
        case 'booking_confirmation':
          result = await notificationService.sendBookingConfirmation(booking, client);
          break;
        
        default:
          logger.warn(`Unknown notification type: ${notification.notification_type}`);
          return;
      }

      // Actualizar estado de la notificación
      const status = result.success ? 'sent' : 'failed';
      await this.notificationModel.updateStatus(notification.id, status, result.error);

      if (!result.success) {
        // Agregar a cola de reintentos
        this.addToRetryQueue(notification);
      }

      logger.info(`📤 Notification ${notification.notification_type} ${status}`, {
        notificationId: notification.id,
        bookingId: notification.booking_id
      });

    } catch (error) {
      logger.error('Error sending notification', {
        notificationId: notification.id,
        error: error.message
      });
      
      // Agregar a cola de reintentos
      this.addToRetryQueue(notification);
    }
  }

  /**
   * Enviar instrucciones de preparación
   */
  async sendPreparationInstructions(booking, client) {
    try {
      const instructions = this.getPreparationInstructions(booking.service_name);
      const message = this.buildPreparationMessage(booking, client, instructions);
      
      return await notificationService.sendWhatsAppMessage(client.phone, message);
    } catch (error) {
      logger.error('Error sending preparation instructions', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Construir mensaje de instrucciones de preparación
   */
  buildPreparationMessage(booking, client, instructions) {
    const appointmentDate = new Date(booking.appointment_date + ' ' + booking.appointment_time);
    const fecha = appointmentDate.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const hora = appointmentDate.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });

    return `💡 *PREPARACIÓN PARA TU CITA*

Hola ${client.name}, mañana tienes tu cita:

📅 *${fecha}*
🕐 *${hora}*
💇‍♀️ *${booking.service_name}*

📋 *Instrucciones de preparación:*

${instructions}

Si tienes alguna duda, no dudes en contactarme.

¡Te espero! ✨

_Ricardo Buriticá Beauty Consulting_
_Peluquería Consciente_`;
  }

  /**
   * Obtener instrucciones de preparación según el servicio
   */
  getPreparationInstructions(serviceName) {
    const instructions = {
      'corte': `• Ven con el cabello limpio y seco
• No uses productos de peinado
• Trae fotos de referencia si tienes ideas específicas`,
      
      'coloracion': `• NO laves el cabello 24-48h antes de la cita
• Ven con cabello seco y sin productos
• Evita usar acondicionador los días previos
• Informa sobre tratamientos químicos recientes`,
      
      'tratamiento': `• Ven con el cabello limpio y húmedo
• No uses mascarillas 2 días antes
• Informa sobre alergias o sensibilidades
• Planifica 2-3 horas para el proceso completo`,
      
      'manicura': `• Retira el esmalte anterior
• Hidrata las cutículas la noche anterior
• Evita cortar las cutículas en casa
• Ven con las uñas limpias`,
      
      'pedicura': `• Retira el esmalte anterior
• Lava bien los pies antes de venir
• Usa calzado cómodo y fácil de quitar
• Informa sobre problemas en los pies`
    };

    const serviceKey = serviceName.toLowerCase();
    return instructions[serviceKey] || `• Ven puntual a tu cita
• Informa sobre alergias o sensibilidades
• Trae tu identificación`;
  }

  /**
   * Verificar si un servicio requiere instrucciones de preparación
   */
  requiresPreparationInstructions(serviceName) {
    const servicesRequiringPrep = ['coloracion', 'tratamiento', 'alisado', 'permanente'];
    return servicesRequiringPrep.some(service => 
      serviceName.toLowerCase().includes(service)
    );
  }

  /**
   * Obtener reservas próximas
   */
  async getUpcomingBookings(fromDate, toDate) {
    try {
      const result = await this.bookingModel.getUpcoming(fromDate, toDate);
      return result.success ? result.data : [];
    } catch (error) {
      logger.error('Error getting upcoming bookings', { error: error.message });
      return [];
    }
  }

  /**
   * Agregar notificación a cola de reintentos
   */
  addToRetryQueue(notification) {
    const retryItem = {
      notification,
      attempts: 0,
      nextRetry: new Date(Date.now() + this.retryDelay)
    };
    
    this.retryQueue.push(retryItem);
    logger.info(`Added notification to retry queue`, {
      notificationId: notification.id,
      nextRetry: retryItem.nextRetry
    });
  }

  /**
   * Procesar cola de reintentos
   */
  async processRetryQueue() {
    if (this.retryQueue.length === 0) {
      return;
    }

    logger.info(`🔄 Processing retry queue: ${this.retryQueue.length} items`);
    const now = new Date();
    const itemsToRetry = [];

    // Filtrar elementos listos para reintento
    this.retryQueue = this.retryQueue.filter(item => {
      if (item.nextRetry <= now && item.attempts < this.maxRetries) {
        itemsToRetry.push(item);
        return false;
      }
      return item.attempts < this.maxRetries;
    });

    // Procesar reintentos
    for (const item of itemsToRetry) {
      try {
        item.attempts++;
        await this.sendNotification(item.notification);
        logger.info(`✅ Retry successful for notification ${item.notification.id}`);
      } catch (error) {
        logger.error(`❌ Retry failed for notification ${item.notification.id}`, {
          attempt: item.attempts,
          error: error.message
        });
        
        if (item.attempts < this.maxRetries) {
          item.nextRetry = new Date(Date.now() + this.retryDelay * item.attempts);
          this.retryQueue.push(item);
        } else {
          logger.error(`Max retries reached for notification ${item.notification.id}`);
          await this.notificationModel.updateStatus(item.notification.id, 'failed_max_retries');
        }
      }
    }
  }

  /**
   * Limpiar notificaciones antiguas
   */
  async cleanupOldNotifications() {
    try {
      logger.info('🧹 Cleaning up old notifications');
      
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const result = await this.notificationModel.deleteOldNotifications(thirtyDaysAgo);
      
      if (result.success) {
        logger.info(`✅ Cleaned up ${result.deletedCount} old notifications`);
      }
    } catch (error) {
      logger.error('Error cleaning up old notifications', { error: error.message });
    }
  }

  /**
   * Programar notificación inmediata para nueva reserva
   */
  async scheduleImmediateBookingNotifications(booking, client) {
    try {
      logger.info('📤 Scheduling immediate notifications for new booking', {
        bookingId: booking.id,
        clientId: client.id
      });

      // Confirmación inmediata
      await this.scheduleNotification(booking, client, 'booking_confirmation', new Date());

      // Programar recordatorios futuros
      const appointmentTime = new Date(booking.appointment_date + ' ' + booking.appointment_time);
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      await this.scheduleBookingNotifications(booking, now, in24Hours, in2Hours);

      logger.info('✅ Immediate notifications scheduled');
    } catch (error) {
      logger.error('Error scheduling immediate notifications', {
        bookingId: booking.id,
        error: error.message
      });
    }
  }

  /**
   * Obtener estadísticas del programador
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      scheduledJobs: this.scheduledJobs.size,
      retryQueueSize: this.retryQueue.length,
      maxRetries: this.maxRetries,
      retryDelay: this.retryDelay
    };
  }
}

module.exports = new NotificationScheduler();