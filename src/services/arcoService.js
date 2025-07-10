// src/services/arcoService.js
// Servicio para gestión de derechos ARCO (RGPD)
// Acceso, Rectificación, Cancelación, Oposición

const supabaseAdmin = require("../integrations/supabaseAdmin");
const logger = require("../utils/logger");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

class ArcoService {
  constructor() {
    this.emailTransporter = this.initializeEmailTransporter();
    this.adminEmail = process.env.ADMIN_EMAIL || "ricardo@ricardoburitica.eu";
    this.dataRetentionDays = parseInt(process.env.DATA_RETENTION_DAYS) || 2555; // 7 años por defecto
  }

  /**
   * Inicializar transportador de email para notificaciones ARCO
   */
  initializeEmailTransporter() {
    if (!process.env.SMTP_HOST) {
      logger.warn(
        "SMTP no configurado, notificaciones ARCO por email deshabilitadas"
      );
      return null;
    }

    return nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * DERECHO DE ACCESO - Obtener todos los datos de un cliente
   */
  async requestDataAccess(identifier, identifierType = "phone") {
    try {
      logger.info("Solicitud de acceso a datos ARCO", {
        identifier,
        identifierType,
      });

      // Generar token de verificación
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

      // Buscar cliente
      const client = await this.findClientByIdentifier(
        identifier,
        identifierType
      );
      if (!client) {
        return {
          success: false,
          error: "Cliente no encontrado",
          code: "CLIENT_NOT_FOUND",
        };
      }

      // Registrar solicitud ARCO
      const { data: arcoRequest, error: arcoError } = await supabaseAdmin
        .from("arco_requests")
        .insert({
          client_id: client.id,
          request_type: "ACCESS",
          identifier: identifier,
          identifier_type: identifierType,
          verification_token: verificationToken,
          expires_at: expiresAt.toISOString(),
          status: "PENDING_VERIFICATION",
          ip_address: this.getCurrentIP(),
          user_agent: this.getCurrentUserAgent(),
        })
        .select()
        .single();

      if (arcoError) {
        throw new Error(
          `Error registrando solicitud ARCO: ${arcoError.message}`
        );
      }

      // Enviar email de verificación
      await this.sendVerificationEmail(client, verificationToken, "ACCESS");

      return {
        success: true,
        message:
          "Solicitud de acceso registrada. Revisa tu email para verificar la solicitud.",
        requestId: arcoRequest.id,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (error) {
      logger.error("Error en solicitud de acceso ARCO", {
        error: error.message,
        identifier,
      });
      return {
        success: false,
        error: "Error procesando solicitud de acceso",
        code: "ACCESS_REQUEST_ERROR",
      };
    }
  }

  /**
   * DERECHO DE RECTIFICACIÓN - Solicitar corrección de datos
   */
  async requestDataRectification(
    identifier,
    identifierType,
    dataToCorrect,
    newData
  ) {
    try {
      logger.info("Solicitud de rectificación ARCO", {
        identifier,
        identifierType,
        fieldsToCorrect: Object.keys(dataToCorrect),
      });

      const client = await this.findClientByIdentifier(
        identifier,
        identifierType
      );
      if (!client) {
        return {
          success: false,
          error: "Cliente no encontrado",
          code: "CLIENT_NOT_FOUND",
        };
      }

      // Validar campos permitidos para rectificación
      const allowedFields = [
        "first_name",
        "last_name",
        "email",
        "phone",
        "address",
        "birth_date",
        "preferences",
      ];

      const invalidFields = Object.keys(dataToCorrect).filter(
        (field) => !allowedFields.includes(field)
      );

      if (invalidFields.length > 0) {
        return {
          success: false,
          error: `Campos no permitidos para rectificación: ${invalidFields.join(
            ", "
          )}`,
          code: "INVALID_FIELDS",
        };
      }

      const verificationToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Registrar solicitud
      const { data: arcoRequest, error: arcoError } = await supabaseAdmin
        .from("arco_requests")
        .insert({
          client_id: client.id,
          request_type: "RECTIFICATION",
          identifier: identifier,
          identifier_type: identifierType,
          verification_token: verificationToken,
          expires_at: expiresAt.toISOString(),
          status: "PENDING_VERIFICATION",
          request_data: {
            current_data: dataToCorrect,
            new_data: newData,
            fields_to_update: Object.keys(dataToCorrect),
          },
          ip_address: this.getCurrentIP(),
          user_agent: this.getCurrentUserAgent(),
        })
        .select()
        .single();

      if (arcoError) {
        throw new Error(
          `Error registrando solicitud ARCO: ${arcoError.message}`
        );
      }

      await this.sendVerificationEmail(
        client,
        verificationToken,
        "RECTIFICATION"
      );

      return {
        success: true,
        message:
          "Solicitud de rectificación registrada. Revisa tu email para verificar la solicitud.",
        requestId: arcoRequest.id,
        fieldsToUpdate: Object.keys(dataToCorrect),
      };
    } catch (error) {
      logger.error("Error en solicitud de rectificación ARCO", {
        error: error.message,
        identifier,
      });
      return {
        success: false,
        error: "Error procesando solicitud de rectificación",
        code: "RECTIFICATION_REQUEST_ERROR",
      };
    }
  }

  /**
   * DERECHO DE CANCELACIÓN - Solicitar eliminación de datos
   */
  async requestDataDeletion(identifier, identifierType, reason = "") {
    try {
      logger.info("Solicitud de cancelación ARCO", {
        identifier,
        identifierType,
        reason,
      });

      const client = await this.findClientByIdentifier(
        identifier,
        identifierType
      );
      if (!client) {
        return {
          success: false,
          error: "Cliente no encontrado",
          code: "CLIENT_NOT_FOUND",
        };
      }

      // Verificar si hay reservas activas
      const { data: activeBookings } = await supabaseAdmin
        .from("bookings")
        .select("id, service_date, status")
        .eq("client_id", client.id)
        .in("status", ["confirmed", "pending"])
        .gte("service_date", new Date().toISOString());

      if (activeBookings && activeBookings.length > 0) {
        return {
          success: false,
          error:
            "No se pueden eliminar datos con reservas activas. Cancela primero tus reservas.",
          code: "ACTIVE_BOOKINGS_EXIST",
          activeBookings: activeBookings.length,
        };
      }

      const verificationToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Registrar solicitud
      const { data: arcoRequest, error: arcoError } = await supabaseAdmin
        .from("arco_requests")
        .insert({
          client_id: client.id,
          request_type: "DELETION",
          identifier: identifier,
          identifier_type: identifierType,
          verification_token: verificationToken,
          expires_at: expiresAt.toISOString(),
          status: "PENDING_VERIFICATION",
          request_data: {
            reason: reason,
            deletion_type: "COMPLETE",
          },
          ip_address: this.getCurrentIP(),
          user_agent: this.getCurrentUserAgent(),
        })
        .select()
        .single();

      if (arcoError) {
        throw new Error(
          `Error registrando solicitud ARCO: ${arcoError.message}`
        );
      }

      await this.sendVerificationEmail(client, verificationToken, "DELETION");

      return {
        success: true,
        message:
          "Solicitud de eliminación registrada. Revisa tu email para verificar la solicitud.",
        requestId: arcoRequest.id,
        warning: "Esta acción eliminará permanentemente todos tus datos.",
      };
    } catch (error) {
      logger.error("Error en solicitud de cancelación ARCO", {
        error: error.message,
        identifier,
      });
      return {
        success: false,
        error: "Error procesando solicitud de eliminación",
        code: "DELETION_REQUEST_ERROR",
      };
    }
  }

  /**
   * DERECHO DE OPOSICIÓN - Oponerse al tratamiento de datos
   */
  async requestDataOpposition(
    identifier,
    identifierType,
    oppositionType,
    reason
  ) {
    try {
      logger.info("Solicitud de oposición ARCO", {
        identifier,
        identifierType,
        oppositionType,
        reason,
      });

      const client = await this.findClientByIdentifier(
        identifier,
        identifierType
      );
      if (!client) {
        return {
          success: false,
          error: "Cliente no encontrado",
          code: "CLIENT_NOT_FOUND",
        };
      }

      const validOppositionTypes = [
        "MARKETING",
        "PROFILING",
        "DIRECT_MARKETING",
        "ALL_PROCESSING",
      ];

      if (!validOppositionTypes.includes(oppositionType)) {
        return {
          success: false,
          error: "Tipo de oposición no válido",
          code: "INVALID_OPPOSITION_TYPE",
        };
      }

      const verificationToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Registrar solicitud
      const { data: arcoRequest, error: arcoError } = await supabaseAdmin
        .from("arco_requests")
        .insert({
          client_id: client.id,
          request_type: "OPPOSITION",
          identifier: identifier,
          identifier_type: identifierType,
          verification_token: verificationToken,
          expires_at: expiresAt.toISOString(),
          status: "PENDING_VERIFICATION",
          request_data: {
            opposition_type: oppositionType,
            reason: reason,
          },
          ip_address: this.getCurrentIP(),
          user_agent: this.getCurrentUserAgent(),
        })
        .select()
        .single();

      if (arcoError) {
        throw new Error(
          `Error registrando solicitud ARCO: ${arcoError.message}`
        );
      }

      await this.sendVerificationEmail(client, verificationToken, "OPPOSITION");

      return {
        success: true,
        message:
          "Solicitud de oposición registrada. Revisa tu email para verificar la solicitud.",
        requestId: arcoRequest.id,
        oppositionType: oppositionType,
      };
    } catch (error) {
      logger.error("Error en solicitud de oposición ARCO", {
        error: error.message,
        identifier,
      });
      return {
        success: false,
        error: "Error procesando solicitud de oposición",
        code: "OPPOSITION_REQUEST_ERROR",
      };
    }
  }

  /**
   * Verificar solicitud ARCO con token
   */
  async verifyArcoRequest(token) {
    try {
      // Buscar solicitud por token
      const { data: request, error } = await supabaseAdmin
        .from("arco_requests")
        .select(
          `
          *,
          clients (
            id, first_name, last_name, email, phone, created_at
          )
        `
        )
        .eq("verification_token", token)
        .eq("status", "PENDING_VERIFICATION")
        .gte("expires_at", new Date().toISOString())
        .single();

      if (error || !request) {
        return {
          success: false,
          error: "Token de verificación inválido o expirado",
          code: "INVALID_TOKEN",
        };
      }

      // Procesar según tipo de solicitud
      let result;
      switch (request.request_type) {
        case "ACCESS":
          result = await this.processAccessRequest(request);
          break;
        case "RECTIFICATION":
          result = await this.processRectificationRequest(request);
          break;
        case "DELETION":
          result = await this.processDeletionRequest(request);
          break;
        case "OPPOSITION":
          result = await this.processOppositionRequest(request);
          break;
        default:
          throw new Error(
            `Tipo de solicitud no válido: ${request.request_type}`
          );
      }

      // Actualizar estado de la solicitud
      await supabaseAdmin
        .from("arco_requests")
        .update({
          status: result.success ? "COMPLETED" : "FAILED",
          processed_at: new Date().toISOString(),
          processing_result: result,
        })
        .eq("id", request.id);

      // Notificar al administrador
      await this.notifyAdminArcoRequest(request, result);

      return result;
    } catch (error) {
      logger.error("Error verificando solicitud ARCO", {
        error: error.message,
        token: token?.substring(0, 10),
      });
      return {
        success: false,
        error: "Error procesando verificación",
        code: "VERIFICATION_ERROR",
      };
    }
  }

  /**
   * Procesar solicitud de acceso verificada
   */
  async processAccessRequest(request) {
    try {
      const clientId = request.client_id;

      // Recopilar todos los datos del cliente
      const clientData = await this.gatherAllClientData(clientId);

      // Generar reporte de datos
      const dataReport = {
        client_info: clientData.client,
        bookings: clientData.bookings,
        notifications: clientData.notifications,
        arco_requests: clientData.arcoRequests,
        data_processing_purposes: [
          "Gestión de reservas y servicios",
          "Comunicación sobre servicios",
          "Cumplimiento de obligaciones legales",
          "Mejora de servicios",
        ],
        data_retention_period: `${this.dataRetentionDays} días`,
        third_party_sharing:
          "No se comparten datos con terceros sin consentimiento",
        generated_at: new Date().toISOString(),
      };

      // Enviar reporte por email
      await this.sendDataReport(request.clients, dataReport);

      return {
        success: true,
        message: "Reporte de datos enviado por email",
        dataCategories: Object.keys(clientData),
        totalRecords: Object.values(clientData).reduce(
          (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 1),
          0
        ),
      };
    } catch (error) {
      logger.error("Error procesando solicitud de acceso", {
        error: error.message,
        requestId: request.id,
      });
      return {
        success: false,
        error: "Error generando reporte de datos",
      };
    }
  }

  /**
   * Buscar cliente por identificador
   */
  async findClientByIdentifier(identifier, identifierType) {
    const { data: client, error } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq(identifierType, identifier)
      .single();

    if (error) {
      logger.warn("Cliente no encontrado", {
        identifier,
        identifierType,
        error: error.message,
      });
      return null;
    }

    return client;
  }

  /**
   * Recopilar todos los datos de un cliente
   */
  async gatherAllClientData(clientId) {
    try {
      // Datos del cliente
      const { data: client } = await supabaseAdmin
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      // Reservas
      const { data: bookings } = await supabaseAdmin
        .from("bookings")
        .select(
          `
          *,
          services (name, category, price)
        `
        )
        .eq("client_id", clientId);

      // Notificaciones
      const { data: notifications } = await supabaseAdmin
        .from("notifications")
        .select("*")
        .eq("client_id", clientId);

      // Solicitudes ARCO previas
      const { data: arcoRequests } = await supabaseAdmin
        .from("arco_requests")
        .select("request_type, created_at, status")
        .eq("client_id", clientId);

      return {
        client: client || {},
        bookings: bookings || [],
        notifications: notifications || [],
        arcoRequests: arcoRequests || [],
      };
    } catch (error) {
      logger.error("Error recopilando datos del cliente", {
        error: error.message,
        clientId,
      });
      return {
        client: {},
        bookings: [],
        notifications: [],
        arcoRequests: [],
      };
    }
  }

  /**
   * Enviar email de verificación ARCO
   */
  async sendVerificationEmail(client, token, requestType) {
    if (!this.emailTransporter) {
      logger.warn(
        "Email transporter no disponible, saltando envío de verificación"
      );
      return;
    }

    const verificationUrl = `${process.env.BASE_URL}/arco/verify/${token}`;
    const requestTypeNames = {
      ACCESS: "Acceso a datos",
      RECTIFICATION: "Rectificación de datos",
      DELETION: "Eliminación de datos",
      OPPOSITION: "Oposición al tratamiento",
    };

    const mailOptions = {
      from: process.env.SMTP_FROM || this.adminEmail,
      to: client.email,
      subject: `Verificación de solicitud ARCO - ${requestTypeNames[requestType]}`,
      html: `
        <h2>Verificación de Solicitud ARCO</h2>
        <p>Hola ${client.first_name},</p>
        <p>Has solicitado: <strong>${requestTypeNames[requestType]}</strong></p>
        <p>Para procesar tu solicitud, haz clic en el siguiente enlace:</p>
        <p><a href="${verificationUrl}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verificar Solicitud</a></p>
        <p>Este enlace expira en 24 horas.</p>
        <p>Si no realizaste esta solicitud, ignora este email.</p>
        <hr>
        <p><small>Ricardo Buriticá Beauty Consulting - Cumplimiento RGPD</small></p>
      `,
    };

    try {
      await this.emailTransporter.sendMail(mailOptions);
      logger.info("Email de verificación ARCO enviado", {
        clientId: client.id,
        requestType,
        email: client.email,
      });
    } catch (error) {
      logger.error("Error enviando email de verificación ARCO", {
        error: error.message,
        clientId: client.id,
      });
    }
  }

  /**
   * Obtener IP actual (placeholder - implementar según contexto)
   */
  getCurrentIP() {
    return "0.0.0.0"; // Implementar según el contexto de la request
  }

  /**
   * Obtener User Agent actual (placeholder - implementar según contexto)
   */
  getCurrentUserAgent() {
    return "Unknown"; // Implementar según el contexto de la request
  }

  /**
   * Notificar al administrador sobre solicitud ARCO
   */
  async notifyAdminArcoRequest(request, result) {
    try {
      if (!this.emailTransporter) return;

      const mailOptions = {
        from: process.env.SMTP_FROM || this.adminEmail,
        to: this.adminEmail,
        subject: `Solicitud ARCO Procesada - ${request.request_type}`,
        html: `
          <h2>Solicitud ARCO Procesada</h2>
          <p><strong>Tipo:</strong> ${request.request_type}</p>
          <p><strong>Cliente:</strong> ${request.clients?.first_name} ${
          request.clients?.last_name
        }</p>
          <p><strong>Email:</strong> ${request.clients?.email}</p>
          <p><strong>Teléfono:</strong> ${request.clients?.phone}</p>
          <p><strong>Estado:</strong> ${
            result.success ? "COMPLETADA" : "FALLIDA"
          }</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString("es-ES")}</p>
          ${
            result.error ? `<p><strong>Error:</strong> ${result.error}</p>` : ""
          }
          <hr>
          <p><small>Sistema ARCO - Ricardo Buriticá Beauty Consulting</small></p>
        `,
      };

      await this.emailTransporter.sendMail(mailOptions);
    } catch (error) {
      logger.error("Error notificando admin sobre ARCO", {
        error: error.message,
      });
    }
  }
}

module.exports = new ArcoService();
