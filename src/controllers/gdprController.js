// src/controllers/gdprController.js
// Controlador para gestión de compliance RGPD

const gdprService = require("../services/gdprService");
const DatabaseAdapter = require("../adapters/databaseAdapter");
const logger = require("../utils/logger");
const Validators = require("../utils/validators");

class GDPRController {
  /**
   * Registrar consentimiento del usuario
   */
  async recordConsent(req, res) {
    try {
      const { clientId, consentType, granted, purpose, method } = req.body;

      // Validar parámetros requeridos
      if (!clientId || !consentType || granted === undefined) {
        return res.status(400).json({
          success: false,
          error: "clientId, consentType y granted son requeridos",
        });
      }

      // Validar tipo de consentimiento
      const validConsentTypes = Object.values(gdprService.consentTypes);
      if (!validConsentTypes.includes(consentType)) {
        return res.status(400).json({
          success: false,
          error: "Tipo de consentimiento no válido",
          validTypes: validConsentTypes,
        });
      }

      const result = await gdprService.recordConsent(
        clientId,
        consentType,
        granted,
        purpose || "service_provision",
        method || "web",
        req.ip
      );

      if (result.success) {
        res.json({
          success: true,
          message: "Consentimiento registrado correctamente",
          data: {
            consentId: result.consentId,
            clientId,
            consentType,
            granted,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("Error in recordConsent", {
        error: error.message,
        body: req.body,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Verificar consentimiento del usuario
   */
  async checkConsent(req, res) {
    try {
      const { clientId, consentType } = req.params;

      if (!clientId || !consentType) {
        return res.status(400).json({
          success: false,
          error: "clientId y consentType son requeridos",
        });
      }

      const result = await gdprService.checkConsent(clientId, consentType);

      if (result.success) {
        res.json({
          success: true,
          data: {
            clientId,
            consentType,
            hasConsent: result.hasConsent,
            expired: result.expired,
            consent: result.consent
              ? {
                  id: result.consent.id,
                  granted: result.consent.granted,
                  timestamp: result.consent.timestamp,
                  method: result.consent.method,
                }
              : null,
          },
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("Error in checkConsent", {
        error: error.message,
        params: req.params,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Exportar datos del usuario (derecho de portabilidad)
   */
  async exportUserData(req, res) {
    try {
      const { clientId } = req.params;
      const { format } = req.query;

      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: "clientId es requerido",
        });
      }

      // Validar formato
      const validFormats = ["json", "csv", "xml"];
      const exportFormat =
        format && validFormats.includes(format) ? format : "json";

      const result = await gdprService.exportUserData(clientId, exportFormat);

      if (result.success) {
        // Configurar headers según el formato
        switch (exportFormat) {
          case "csv":
            res.set("Content-Type", "text/csv");
            res.set(
              "Content-Disposition",
              `attachment; filename="user-data-${clientId}.csv"`
            );
            res.send(this.convertToCSV(result.data));
            break;

          case "xml":
            res.set("Content-Type", "application/xml");
            res.set(
              "Content-Disposition",
              `attachment; filename="user-data-${clientId}.xml"`
            );
            res.send(this.convertToXML(result.data));
            break;

          default:
            res.set("Content-Type", "application/json");
            res.set(
              "Content-Disposition",
              `attachment; filename="user-data-${clientId}.json"`
            );
            res.json({
              success: true,
              message: "Datos exportados correctamente",
              data: result.data,
            });
        }
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("Error in exportUserData", {
        error: error.message,
        params: req.params,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Eliminar datos del usuario (derecho al olvido)
   */
  async deleteUserData(req, res) {
    try {
      const { clientId } = req.params;
      const { reason, confirmDeletion } = req.body;

      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: "clientId es requerido",
        });
      }

      // Requerir confirmación explícita
      if (!confirmDeletion) {
        return res.status(400).json({
          success: false,
          error: "Se requiere confirmación explícita para eliminar datos",
          requiredField: "confirmDeletion: true",
        });
      }

      const result = await gdprService.deleteUserData(
        clientId,
        reason || "user_request"
      );

      if (result.success) {
        res.json({
          success: true,
          message: "Datos eliminados correctamente",
          data: {
            clientId,
            deletedAt: result.deletedAt,
            deletionResults: result.deletionResults,
          },
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          legalHold: result.legalHold,
        });
      }
    } catch (error) {
      logger.error("Error in deleteUserData", {
        error: error.message,
        params: req.params,
        body: req.body,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Generar reporte de compliance RGPD
   */
  async generateComplianceReport(req, res) {
    try {
      const { startDate, endDate } = req.query;

      // Validar fechas
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: "startDate y endDate son requeridos",
        });
      }

      if (
        !Validators.isValidDate(startDate) ||
        !Validators.isValidDate(endDate)
      ) {
        return res.status(400).json({
          success: false,
          error: "Formato de fecha no válido (YYYY-MM-DD)",
        });
      }

      const result = await gdprService.generateComplianceReport(
        startDate,
        endDate
      );

      if (result.success) {
        res.json({
          success: true,
          message: "Reporte de compliance generado correctamente",
          data: result.report,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("Error in generateComplianceReport", {
        error: error.message,
        query: req.query,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Obtener información sobre derechos RGPD
   */
  async getRightsInfo(req, res) {
    try {
      const rightsInfo = {
        dataSubjectRights: {
          rightToInformation: {
            description:
              "Derecho a ser informado sobre el procesamiento de datos personales",
            howToExercise: "Contactar a info@ricardoburitica.eu",
          },
          rightOfAccess: {
            description: "Derecho a acceder a los datos personales",
            howToExercise:
              "Solicitar exportación de datos a través de la plataforma",
          },
          rightToRectification: {
            description: "Derecho a rectificar datos personales inexactos",
            howToExercise: "Actualizar datos en el perfil o contactar soporte",
          },
          rightToErasure: {
            description: "Derecho al olvido - eliminar datos personales",
            howToExercise: "Solicitar eliminación a través de la plataforma",
          },
          rightToRestrictProcessing: {
            description: "Derecho a restringir el procesamiento",
            howToExercise: "Contactar a info@ricardoburitica.eu",
          },
          rightToDataPortability: {
            description: "Derecho a la portabilidad de datos",
            howToExercise: "Exportar datos en formato JSON, CSV o XML",
          },
          rightToObject: {
            description: "Derecho a oponerse al procesamiento",
            howToExercise: "Retirar consentimiento o contactar soporte",
          },
        },
        consentTypes: gdprService.consentTypes,
        legalBases: gdprService.legalBases,
        dataRetentionPeriods: gdprService.dataRetentionPeriods,
        contact: {
          dataController: "Ricardo Buriticá Beauty Consulting",
          email: "info@ricardoburitica.eu",
          phone: "+34 XXX XXX XXX",
          address: "España",
        },
      };

      res.json({
        success: true,
        data: rightsInfo,
      });
    } catch (error) {
      logger.error("Error in getRightsInfo", { error: error.message });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Procesar solicitud de consentimiento desde WhatsApp
   */
  async processWhatsAppConsent(req, res) {
    try {
      const { phoneNumber, message, granted } = req.body;

      if (!phoneNumber || granted === undefined) {
        return res.status(400).json({
          success: false,
          error: "phoneNumber y granted son requeridos",
        });
      }

      // Buscar cliente por número de teléfono
      const clientResult = await DatabaseAdapter.query(
        `
        SELECT id FROM clients WHERE phone = $1
      `,
        [phoneNumber]
      );

      let clientId;
      if (clientResult.success && clientResult.data.length > 0) {
        clientId = clientResult.data[0].id;
      } else {
        // Crear cliente temporal para el consentimiento
        const newClientResult = await DatabaseAdapter.create("clients", {
          phone: phoneNumber,
          name: "Usuario WhatsApp",
          created_via: "whatsapp_consent",
        });

        if (newClientResult.success) {
          clientId = newClientResult.data.id;
        } else {
          throw new Error("Error creando cliente temporal");
        }
      }

      // Registrar consentimiento de WhatsApp
      const result = await gdprService.recordConsent(
        clientId,
        gdprService.consentTypes.WHATSAPP,
        granted,
        "whatsapp_communication",
        "whatsapp",
        req.ip
      );

      if (result.success) {
        res.json({
          success: true,
          message: granted
            ? "Consentimiento para WhatsApp registrado correctamente"
            : "Consentimiento para WhatsApp retirado correctamente",
          data: {
            clientId,
            phoneNumber,
            granted,
            consentId: result.consentId,
          },
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("Error in processWhatsAppConsent", {
        error: error.message,
        body: req.body,
      });

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  /**
   * Métodos auxiliares para conversión de formatos
   */
  convertToCSV(data) {
    try {
      let csv = "Tipo,Campo,Valor\n";

      // Datos del cliente
      if (data.personalData.client) {
        Object.entries(data.personalData.client).forEach(([key, value]) => {
          csv += `Cliente,${key},"${value}"\n`;
        });
      }

      // Reservas
      data.personalData.bookings.forEach((booking, index) => {
        Object.entries(booking).forEach(([key, value]) => {
          csv += `Reserva ${index + 1},${key},"${value}"\n`;
        });
      });

      // Consentimientos
      data.personalData.consents.forEach((consent, index) => {
        Object.entries(consent).forEach(([key, value]) => {
          csv += `Consentimiento ${index + 1},${key},"${value}"\n`;
        });
      });

      return csv;
    } catch (error) {
      logger.error("Error converting to CSV", { error: error.message });
      return "Error,Error,Error al generar CSV";
    }
  }

  convertToXML(data) {
    try {
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += "<userData>\n";
      xml += `  <exportInfo>\n`;
      xml += `    <clientId>${data.exportInfo.clientId}</clientId>\n`;
      xml += `    <exportDate>${data.exportInfo.exportDate}</exportDate>\n`;
      xml += `    <dataController>${data.exportInfo.dataController}</dataController>\n`;
      xml += `  </exportInfo>\n`;

      xml += `  <personalData>\n`;

      // Cliente
      if (data.personalData.client) {
        xml += `    <client>\n`;
        Object.entries(data.personalData.client).forEach(([key, value]) => {
          xml += `      <${key}>${this.escapeXML(value)}</${key}>\n`;
        });
        xml += `    </client>\n`;
      }

      // Reservas
      xml += `    <bookings>\n`;
      data.personalData.bookings.forEach((booking, index) => {
        xml += `      <booking id="${index + 1}">\n`;
        Object.entries(booking).forEach(([key, value]) => {
          xml += `        <${key}>${this.escapeXML(value)}</${key}>\n`;
        });
        xml += `      </booking>\n`;
      });
      xml += `    </bookings>\n`;

      xml += `  </personalData>\n`;
      xml += "</userData>";

      return xml;
    } catch (error) {
      logger.error("Error converting to XML", { error: error.message });
      return "<error>Error al generar XML</error>";
    }
  }

  escapeXML(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}

module.exports = new GDPRController();
