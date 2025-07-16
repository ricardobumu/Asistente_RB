// src/models/clientModel.js
const supabase = require("../integrations/supabaseClient");
const logger = require("../utils/logger");
const Validators = require("../utils/validators");

/**
 * ClientModel - Gestión de clientes para Ricardo Buriticá Beauty Consulting
 *
 * Funcionalidades:
 * - CRUD completo de clientes
 * - Validaciones RGPD/GDPR
 * - Búsquedas optimizadas
 * - Integración con WhatsApp y Calendly
 * - Auditoría de cambios
 * - Gestión de consentimientos
 */
class ClientModel {
  constructor() {
    this.tableName = "clients";
    logger.info(
      "ClientModel inicializado para Ricardo Buriticá Beauty Consulting"
    );
  }

  /**
   * Crea un nuevo cliente con validaciones completas y cumplimiento RGPD
   * @param {object} clientData - Datos del cliente
   * @returns {object} Resultado de la operación
   */
  async create(clientData) {
    try {
      // Validar datos de entrada
      const validation = Validators.validateClientData(clientData);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Datos inválidos: ${validation.errors.join(", ")}`,
        };
      }

      // Sanitizar datos
      const sanitizedData = Validators.sanitizeClientData(clientData);

      // Preparar datos para inserción con campos obligatorios
      const clientToCreate = {
        ...sanitizedData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active:
          sanitizedData.is_active !== undefined
            ? sanitizedData.is_active
            : true,
        source: sanitizedData.source || "manual",
        // Campos de auditoría (comentados - no disponibles en esquema actual)
        // last_interaction: new Date().toISOString(),
        // interaction_count: 1,
      };

      const { data, error } = await supabase
        .from(this.tableName)
        .insert([clientToCreate])
        .select()
        .single();

      if (error) {
        // Manejar errores específicos
        if (error.code === "23505") {
          const field = error.details?.includes("phone") ? "teléfono" : "email";
          logger.warn(`Intento de crear cliente duplicado por ${field}`, {
            phone: sanitizedData.phone,
            email: sanitizedData.email,
          });
          return {
            success: false,
            error: `Ya existe un cliente con este ${field}`,
          };
        }
        throw error;
      }

      logger.info("Cliente creado exitosamente", {
        clientId: data.id,
        phone: data.phone,
        source: data.source,
        // gdprConsent: data.gdpr_consent, // Campo no disponible en esquema actual
      });

      return { success: true, data };
    } catch (error) {
      logger.error("Error en ClientModel.create", {
        errorMessage: error.message,
        clientData: {
          phone: clientData?.phone,
          email: clientData?.email,
          full_name: clientData?.full_name,
        },
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Busca un cliente por teléfono con normalización automática
   * @param {string} phone - Número de teléfono
   * @returns {object} Resultado de la búsqueda
   */
  async findByPhone(phone) {
    try {
      if (!phone) {
        return { success: false, error: "Número de teléfono requerido" };
      }

      // Normalizar número de teléfono
      const normalizedPhone = phone.replace(/\D/g, "");

      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("phone", normalizedPhone)
        .eq("is_active", true)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return { success: true, data: null };
        }
        throw error;
      }

      // Actualizar última interacción
      await this._updateLastInteraction(data.id);

      return { success: true, data };
    } catch (error) {
      logger.error(`Error en ClientModel.findByPhone para: ${phone}`, {
        errorMessage: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Busca un cliente por email con normalización
   * @param {string} email - Email del cliente
   * @returns {object} Resultado de la búsqueda
   */
  async findByEmail(email) {
    try {
      if (!email) {
        return { success: false, error: "Email requerido" };
      }

      const normalizedEmail = email.toLowerCase().trim();

      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("email", normalizedEmail)
        .eq("is_active", true)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return { success: true, data: null };
        }
        throw error;
      }

      await this._updateLastInteraction(data.id);

      return { success: true, data };
    } catch (error) {
      logger.error(`Error en ClientModel.findByEmail para: ${email}`, {
        errorMessage: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Busca un cliente por ID
   * @param {string} id - UUID del cliente
   * @returns {object} Resultado de la búsqueda
   */
  async findById(id) {
    try {
      if (!id) {
        return { success: false, error: "ID de cliente requerido" };
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("id", id)
        .eq("is_active", true)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return { success: false, error: "Cliente no encontrado" };
        }
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      logger.error(`Error en ClientModel.findById para ID: ${id}`, {
        errorMessage: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Actualiza los datos de un cliente
   * @param {string} id - ID del cliente
   * @param {object} updateData - Datos a actualizar
   * @returns {object} Resultado de la actualización
   */
  async update(id, updateData) {
    try {
      if (!id) {
        return { success: false, error: "ID de cliente requerido" };
      }

      // Validar datos de actualización
      const validation = Validators.validateClientData(updateData, false);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Datos inválidos: ${validation.errors.join(", ")}`,
        };
      }

      const sanitizedData = Validators.sanitizeClientData(updateData);

      const dataToUpdate = {
        ...sanitizedData,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from(this.tableName)
        .update(dataToUpdate)
        .eq("id", id)
        .eq("is_active", true)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return { success: false, error: "Cliente no encontrado" };
        }
        throw error;
      }

      logger.info("Cliente actualizado exitosamente", {
        clientId: id,
        updatedFields: Object.keys(sanitizedData),
      });

      return { success: true, data };
    } catch (error) {
      logger.error(`Error en ClientModel.update para ID: ${id}`, {
        errorMessage: error.message,
        updateData,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene todos los clientes activos con paginación
   * @param {object} options - Opciones de consulta
   * @returns {object} Lista de clientes
   */
  async getAll(options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        search = "",
        sortBy = "created_at",
        sortOrder = "desc",
      } = options;

      let query = supabase
        .from(this.tableName)
        .select("*", { count: "exact" })
        .eq("is_active", true);

      // Filtro de búsqueda
      if (search) {
        query = query.or(
          `full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`
        );
      }

      // Ordenamiento
      query = query.order(sortBy, { ascending: sortOrder === "asc" });

      // Paginación
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      const totalPages = Math.ceil(count / limit);

      return {
        success: true,
        data: data || [],
        pagination: {
          page,
          limit,
          total: count,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error("Error en ClientModel.getAll", {
        errorMessage: error.message,
        options,
      });
      return {
        success: false,
        error: error.message,
        data: [],
        pagination: null,
      };
    }
  }

  /**
   * Desactiva un cliente (soft delete)
   * @param {string} id - ID del cliente
   * @param {string} reason - Razón de la desactivación
   * @returns {object} Resultado de la operación
   */
  async deactivate(id, reason = "") {
    try {
      if (!id) {
        return { success: false, error: "ID de cliente requerido" };
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          is_active: false,
          deactivated_at: new Date().toISOString(),
          deactivation_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return { success: false, error: "Cliente no encontrado" };
        }
        throw error;
      }

      logger.info("Cliente desactivado", {
        clientId: id,
        reason,
      });

      return { success: true, data };
    } catch (error) {
      logger.error(`Error en ClientModel.deactivate para ID: ${id}`, {
        errorMessage: error.message,
        reason,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Actualiza el consentimiento RGPD de un cliente
   * @param {string} id - ID del cliente
   * @param {object} consentData - Datos de consentimiento
   * @returns {object} Resultado de la operación
   */
  async updateGdprConsent(id, consentData) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update({
          // gdpr_consent: consentData.gdpr_consent, // Campo no disponible en esquema actual
          // gdpr_consent_date: consentData.gdpr_consent ? new Date().toISOString() : null,
          // marketing_consent: consentData.marketing_consent || false,
          updated_at: new Date().toISOString(),
          notes: `GDPR consent updated: ${consentData.gdpr_consent ? "granted" : "denied"} at ${new Date().toISOString()}`,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info("Consentimiento RGPD actualizado", {
        clientId: id,
        // gdprConsent: consentData.gdpr_consent, // Campo no disponible en esquema actual
        // marketingConsent: consentData.marketing_consent,
        consentStatus: consentData.gdpr_consent ? "granted" : "denied",
      });

      return { success: true, data };
    } catch (error) {
      logger.error(`Error actualizando consentimiento RGPD para ID: ${id}`, {
        errorMessage: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Busca clientes por múltiples criterios (teléfono, email, nombre)
   * @param {string} searchTerm - Término de búsqueda
   * @returns {object} Resultado de la búsqueda
   */
  async searchClients(searchTerm) {
    try {
      if (!searchTerm) {
        return { success: false, error: "Término de búsqueda requerido" };
      }

      const normalizedTerm = searchTerm.toLowerCase().trim();

      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .or(
          `full_name.ilike.%${normalizedTerm}%,phone.ilike.%${normalizedTerm}%,email.ilike.%${normalizedTerm}%`
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        throw error;
      }

      return { success: true, data: data || [] };
    } catch (error) {
      logger.error("Error en ClientModel.searchClients", {
        errorMessage: error.message,
        searchTerm,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene estadísticas de clientes para el dashboard
   * @returns {object} Estadísticas de clientes
   */
  async getClientStats() {
    try {
      // Total de clientes activos
      const { count: totalActive } = await supabase
        .from(this.tableName)
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Clientes nuevos este mes
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: newThisMonth } = await supabase
        .from(this.tableName)
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .gte("created_at", startOfMonth.toISOString());

      // Clientes por fuente
      const { data: sourceStats } = await supabase
        .from(this.tableName)
        .select("source")
        .eq("is_active", true);

      const sourceCounts =
        sourceStats?.reduce((acc, client) => {
          acc[client.source] = (acc[client.source] || 0) + 1;
          return acc;
        }, {}) || {};

      return {
        success: true,
        data: {
          totalActive: totalActive || 0,
          newThisMonth: newThisMonth || 0,
          sourceBreakdown: sourceCounts,
          lastUpdated: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error("Error en ClientModel.getClientStats", {
        errorMessage: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Busca clientes por URL de Calendly (para webhook)
   * @param {string} calendlyUri - URI del evento de Calendly
   * @returns {object} Resultado de la búsqueda
   */
  async findByCalendlyUri(calendlyUri) {
    try {
      if (!calendlyUri) {
        return { success: false, error: "URI de Calendly requerido" };
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .contains("notes", calendlyUri)
        .eq("is_active", true)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return { success: true, data: null };
        }
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      logger.error("Error en ClientModel.findByCalendlyUri", {
        errorMessage: error.message,
        calendlyUri,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Método privado para actualizar la última interacción
   * @param {string} clientId - ID del cliente
   */
  async _updateLastInteraction(clientId) {
    try {
      // Actualizar solo updated_at ya que no tenemos campos de interacción en el esquema actual
      await supabase
        .from(this.tableName)
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", clientId);
    } catch (error) {
      // No fallar si no se puede actualizar la interacción
      logger.warn("No se pudo actualizar última interacción", {
        clientId,
        error: error.message,
      });
    }
  }
}

module.exports = ClientModel;
