// src/services/pipedreamService.js
// Servicio para integración con workflows de Pipedream

const logger = require("../utils/logger");
const axios = require("axios");
const {
  PIPEDREAM_CALENDLY_DISPATCHER_URL,
  PIPEDREAM_WHATSAPP_INBOUND_HANDLER_URL,
} = require("../config/env");

class PipedreamService {
  constructor() {
    // URLs de los workflows de Pipedream desde variables de entorno
    this.calendlyEventDispatcherUrl =
      PIPEDREAM_CALENDLY_DISPATCHER_URL ||
      "https://eoyr2h4h1amk3yh.m.pipedream.net";
    this.whatsappInboundHandlerUrl =
      PIPEDREAM_WHATSAPP_INBOUND_HANDLER_URL || null;

    // Configuración de axios con timeouts y reintentos
    this.axiosConfig = {
      timeout: 30000, // 30 segundos
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Asistente-RB/1.0.0",
      },
    };
  }

  /**
   * Enviar evento de Calendly al dispatcher de Pipedream
   */
  async sendCalendlyEventToPipedream(eventType, payload) {
    try {
      const phoneNumber = this.extractPhoneFromCalendlyPayload(payload);
      const inviteeName = payload?.invitee?.name || "Cliente sin nombre";
      const eventName = payload?.event_type?.name || "Evento sin nombre";

      logger.info("📤 Enviando evento de Calendly a Pipedream:", {
        eventType,
        url: this.calendlyEventDispatcherUrl,
        inviteeName,
        eventName,
        phoneNumber: this.maskPhone(phoneNumber),
        hasInvitee: !!payload?.invitee,
        payloadKeys: Object.keys(payload || {}),
        startTime: payload?.start_time,
      });

      // Validar que tenemos los datos esenciales
      if (!payload?.invitee) {
        logger.warn("⚠️ Payload de Calendly sin datos de invitee");
      }

      if (!phoneNumber) {
        logger.warn(
          "⚠️ No se pudo extraer número de teléfono del payload de Calendly"
        );
      }

      // IMPORTANTE: Enviar el payload EXACTO de Calendly para que Pipedream lo procese correctamente
      // Pipedream espera la estructura original de Calendly con payload.invitee.phone_number
      const pipedreamPayload = {
        event: eventType,
        payload: payload, // Payload original de Calendly sin modificar
        created_at: new Date().toISOString(),
        source: "asistente_rb_local",
        // Datos adicionales para facilitar el procesamiento en Pipedream
        extracted_data: {
          phone_number: phoneNumber,
          invitee_name: inviteeName,
          event_name: eventName,
          start_time: payload?.start_time,
          end_time: payload?.end_time,
          timezone: payload?.invitee?.timezone || "Europe/Madrid",
          questions_and_answers: payload?.invitee?.questions_and_answers || [],
        },
      };

      logger.info("📋 Datos extraídos para Pipedream:", {
        phoneNumber: this.maskPhone(phoneNumber),
        inviteeName,
        eventName,
        hasQuestions:
          (payload?.invitee?.questions_and_answers || []).length > 0,
      });

      // Enviar a Pipedream
      const response = await axios.post(
        this.calendlyEventDispatcherUrl,
        pipedreamPayload,
        this.axiosConfig
      );

      if (response.status >= 200 && response.status < 300) {
        logger.info("✅ Evento enviado exitosamente a Pipedream:", {
          status: response.status,
          phoneNumber: this.maskPhone(phoneNumber),
          inviteeName,
          responseData: response.data,
        });

        return {
          success: true,
          data: {
            pipedreamResponse: response.data,
            statusCode: response.status,
            extractedData: pipedreamPayload.extracted_data,
          },
        };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      logger.error("❌ Error enviando evento a Pipedream:", {
        error: error.message,
        url: this.calendlyEventDispatcherUrl,
        eventType,
        stack: error.stack,
      });

      return {
        success: false,
        error: error.message,
        details: {
          url: this.calendlyEventDispatcherUrl,
          eventType,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Enviar mensaje de WhatsApp al handler de Pipedream
   */
  async sendWhatsAppMessageToPipedream(
    phoneNumber,
    message,
    messageId,
    context = {}
  ) {
    try {
      if (!this.whatsappInboundHandlerUrl) {
        logger.warn("⚠️ URL de WhatsApp Inbound Handler no configurada");
        return {
          success: false,
          error: "WhatsApp Inbound Handler URL not configured",
        };
      }

      logger.info("📤 Enviando mensaje de WhatsApp a Pipedream:", {
        phone: this.maskPhone(phoneNumber),
        messageId,
        url: this.whatsappInboundHandlerUrl,
      });

      // Preparar payload para Pipedream
      const pipedreamPayload = {
        phone_number: phoneNumber,
        message: message,
        message_id: messageId,
        timestamp: new Date().toISOString(),
        source: "asistente_rb_local",
        context: context,
      };

      // Enviar a Pipedream
      const response = await axios.post(
        this.whatsappInboundHandlerUrl,
        pipedreamPayload,
        this.axiosConfig
      );

      if (response.status >= 200 && response.status < 300) {
        logger.info("✅ Mensaje WhatsApp enviado exitosamente a Pipedream:", {
          status: response.status,
          responseData: response.data,
        });

        return {
          success: true,
          data: {
            pipedreamResponse: response.data,
            statusCode: response.status,
          },
        };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      logger.error("❌ Error enviando mensaje WhatsApp a Pipedream:", {
        error: error.message,
        url: this.whatsappInboundHandlerUrl,
        phone: this.maskPhone(phoneNumber),
      });

      return {
        success: false,
        error: error.message,
        details: {
          url: this.whatsappInboundHandlerUrl,
          phone: this.maskPhone(phoneNumber),
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Configurar URL del WhatsApp Inbound Handler
   */
  setWhatsAppInboundHandlerUrl(url) {
    this.whatsappInboundHandlerUrl = url;
    logger.info("📝 URL de WhatsApp Inbound Handler configurada:", { url });
  }

  /**
   * Extraer datos relevantes del payload de Calendly
   */
  extractCalendlyData(eventType, payload) {
    try {
      const baseData = {
        event_type: eventType,
        uri: payload?.uri,
        created_at: payload?.created_at,
        updated_at: payload?.updated_at,
      };

      // Datos específicos según el tipo de evento
      switch (eventType) {
        case "invitee.created":
        case "invitee.canceled":
        case "invitee.rescheduled":
          return {
            ...baseData,
            invitee: {
              name: payload?.name,
              email: payload?.email,
              phone_number: this.extractPhoneFromPayload(payload),
              timezone: payload?.timezone,
              created_at: payload?.created_at,
              updated_at: payload?.updated_at,
            },
            event: {
              start_time: payload?.start_time,
              end_time: payload?.end_time,
              location: payload?.location,
              status: payload?.status,
            },
            event_type: {
              name: payload?.event_type?.name,
              duration: payload?.event_type?.duration,
              kind: payload?.event_type?.kind,
            },
            questions_and_answers: payload?.questions_and_answers || [],
          };

        default:
          return baseData;
      }
    } catch (error) {
      logger.error("Error extrayendo datos de Calendly:", error);
      return {
        event_type: eventType,
        extraction_error: error.message,
        raw_payload: payload,
      };
    }
  }

  /**
   * Extraer número de teléfono del payload de Calendly (estructura real)
   */
  extractPhoneFromCalendlyPayload(payload) {
    try {
      logger.info("🔍 Extrayendo teléfono del payload de Calendly:", {
        hasInvitee: !!payload?.invitee,
        hasPhoneNumber: !!payload?.invitee?.phone_number,
        hasTextReminderNumber: !!payload?.invitee?.text_reminder_number,
        hasQuestions: !!payload?.invitee?.questions_and_answers?.length,
        questionsCount: payload?.invitee?.questions_and_answers?.length || 0,
      });

      // Método 1: Buscar en payload.invitee.phone_number (estructura estándar de Calendly)
      if (payload?.invitee?.phone_number) {
        logger.info("✅ Teléfono encontrado en invitee.phone_number:", {
          phone: this.maskPhone(payload.invitee.phone_number),
        });
        return payload.invitee.phone_number;
      }

      // Método 2: Buscar en text_reminder_number
      if (payload?.invitee?.text_reminder_number) {
        logger.info("✅ Teléfono encontrado en text_reminder_number:", {
          phone: this.maskPhone(payload.invitee.text_reminder_number),
        });
        return payload.invitee.text_reminder_number;
      }

      // Método 3: Buscar en questions_and_answers como fallback
      const questions = payload?.invitee?.questions_and_answers || [];
      logger.info("🔍 Buscando teléfono en questions_and_answers:", {
        questionsCount: questions.length,
        questions: questions.map((q) => ({
          question: q.question,
          hasAnswer: !!q.answer,
        })),
      });

      const phoneQuestion = questions.find((qa) => {
        const question = qa.question?.toLowerCase() || "";
        const isPhoneQuestion =
          question.includes("teléfono") ||
          question.includes("phone") ||
          question.includes("whatsapp") ||
          question.includes("telefono") ||
          question.includes("móvil") ||
          question.includes("movil") ||
          question.includes("celular") ||
          question.includes("número") ||
          question.includes("numero");

        logger.info("🔍 Evaluando pregunta:", {
          question: qa.question,
          isPhoneQuestion,
          answer: qa.answer,
        });

        return isPhoneQuestion;
      });

      if (phoneQuestion?.answer) {
        logger.info("✅ Teléfono encontrado en questions_and_answers:", {
          question: phoneQuestion.question,
          phone: this.maskPhone(phoneQuestion.answer),
        });
        return phoneQuestion.answer;
      }

      // Método 4: Buscar en el nivel raíz del payload (estructura antigua)
      const rootQuestions = payload?.questions_and_answers || [];
      logger.info("🔍 Buscando teléfono en nivel raíz:", {
        rootQuestionsCount: rootQuestions.length,
      });

      const rootPhoneQuestion = rootQuestions.find((qa) => {
        const question = qa.question?.toLowerCase() || "";
        return (
          question.includes("teléfono") ||
          question.includes("phone") ||
          question.includes("whatsapp") ||
          question.includes("telefono") ||
          question.includes("móvil") ||
          question.includes("movil")
        );
      });

      if (rootPhoneQuestion?.answer) {
        logger.info("✅ Teléfono encontrado en nivel raíz:", {
          question: rootPhoneQuestion.question,
          phone: this.maskPhone(rootPhoneQuestion.answer),
        });
        return rootPhoneQuestion.answer;
      }

      // Si no encontramos nada, log detallado para debugging
      logger.warn(
        "⚠️ No se pudo extraer número de teléfono del payload de Calendly:",
        {
          hasInvitee: !!payload?.invitee,
          inviteeKeys: payload?.invitee ? Object.keys(payload.invitee) : [],
          questionsCount: questions.length,
          rootQuestionsCount: rootQuestions.length,
          allQuestions: [...questions, ...rootQuestions].map((q) => q.question),
        }
      );

      return null;
    } catch (error) {
      logger.error("Error extrayendo teléfono del payload de Calendly:", error);
      return null;
    }
  }

  /**
   * Extraer número de teléfono del payload de Calendly (método legacy)
   * @deprecated Usar extractPhoneFromCalendlyPayload en su lugar
   */
  extractPhoneFromPayload(payload) {
    return this.extractPhoneFromCalendlyPayload(payload);
  }

  /**
   * Enmascarar número de teléfono para logs
   */
  maskPhone(phone) {
    if (!phone || phone.length < 4) return phone;
    return phone.substring(0, 3) + "***" + phone.substring(phone.length - 2);
  }

  /**
   * Verificar conectividad con Pipedream
   */
  async testConnectivity() {
    const results = {
      calendly_dispatcher: false,
      whatsapp_handler: false,
    };

    // Test Calendly Dispatcher
    try {
      const testPayload = {
        test: true,
        timestamp: new Date().toISOString(),
        source: "connectivity_test",
      };

      const response = await axios.post(
        this.calendlyEventDispatcherUrl,
        testPayload,
        { ...this.axiosConfig, timeout: 10000 }
      );

      results.calendly_dispatcher =
        response.status >= 200 && response.status < 300;
    } catch (error) {
      logger.warn(
        "Test de conectividad Calendly Dispatcher falló:",
        error.message
      );
    }

    // Test WhatsApp Handler (si está configurado)
    if (this.whatsappInboundHandlerUrl) {
      try {
        const testPayload = {
          test: true,
          timestamp: new Date().toISOString(),
          source: "connectivity_test",
        };

        const response = await axios.post(
          this.whatsappInboundHandlerUrl,
          testPayload,
          { ...this.axiosConfig, timeout: 10000 }
        );

        results.whatsapp_handler =
          response.status >= 200 && response.status < 300;
      } catch (error) {
        logger.warn(
          "Test de conectividad WhatsApp Handler falló:",
          error.message
        );
      }
    }

    return results;
  }

  /**
   * Obtener configuración actual
   */
  getConfiguration() {
    return {
      calendly_event_dispatcher_url: this.calendlyEventDispatcherUrl,
      whatsapp_inbound_handler_url: this.whatsappInboundHandlerUrl,
      timeout: this.axiosConfig.timeout,
      configured: {
        calendly: !!this.calendlyEventDispatcherUrl,
        whatsapp: !!this.whatsappInboundHandlerUrl,
      },
    };
  }
}

// Exportar instancia singleton
module.exports = new PipedreamService();
