/**
 * CONFIGURACIÓN CENTRALIZADA DE BASE DE DATOS
 *
 * Este módulo centraliza toda la configuración de Supabase
 * y proporciona métodos consistentes para todas las integraciones
 */

require("dotenv").config();
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const logger = require("../utils/logger");

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  const error =
    "Variables de entorno SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridas";
  logger.error("Error de configuración de Supabase", { error });
  throw new Error(error);
}

// Cliente de Supabase
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Esquemas de tablas conocidos
 */
const TABLE_SCHEMAS = {
  clients: {
    requiredFields: ["id", "full_name", "phone", "email"],
    optionalFields: [
      "birth_date",
      "whatsapp_id",
      "registration_step",
      "lgpd_accepted",
      "registration_complete",
      "name",
      "created_at",
    ],
    phoneField: "phone",
  },
  services: {
    requiredFields: ["id", "name", "description", "price", "duration"],
    optionalFields: [
      "image_url",
      "calendly_url",
      "created_at",
      "updated_at",
      "category",
      "calendly_api_id",
      "is_active",
    ],
    phoneField: null,
  },
};

/**
 * Operaciones seguras de base de datos
 */
class DatabaseManager {
  constructor() {
    this.client = supabase;
    this.schemas = TABLE_SCHEMAS;
  }

  /**
   * Obtiene todos los registros de una tabla con paginación
   */
  async getAll(tableName, options = {}) {
    try {
      const {
        select = "*",
        limit = 1000,
        offset = 0,
        orderBy = null,
        filters = {},
      } = options;

      let query = this.client
        .from(tableName)
        .select(select)
        .range(offset, offset + limit - 1);

      // Aplicar filtros
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          query = query.eq(key, value);
        }
      });

      // Aplicar ordenamiento
      if (orderBy) {
        query = query.order(orderBy.column, {
          ascending: orderBy.ascending !== false,
        });
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error(`Error obteniendo datos de ${tableName}`, {
          error: error.message,
          options,
        });
        throw error;
      }

      logger.info(`Datos obtenidos de ${tableName}`, {
        count: data?.length || 0,
        table: tableName,
      });

      return { data: data || [], count, error: null };
    } catch (error) {
      logger.error(`Error en getAll para ${tableName}`, {
        error: error.message,
      });
      return { data: [], count: 0, error };
    }
  }

  /**
   * Obtiene un registro por ID
   */
  async getById(tableName, id, select = "*") {
    try {
      const { data, error } = await this.client
        .from(tableName)
        .select(select)
        .eq("id", id)
        .single();

      if (error) {
        logger.error(`Error obteniendo registro ${id} de ${tableName}`, {
          error: error.message,
        });
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      logger.error(`Error en getById para ${tableName}`, {
        error: error.message,
        id,
      });
      return { data: null, error };
    }
  }

  /**
   * Actualiza un registro de forma segura
   */
  async updateRecord(tableName, id, updateData) {
    try {
      // Validar que los campos existen en el esquema
      const schema = this.schemas[tableName];
      if (schema) {
        const allowedFields = [
          ...schema.requiredFields,
          ...schema.optionalFields,
        ];
        const invalidFields = Object.keys(updateData).filter(
          (field) => !allowedFields.includes(field)
        );

        if (invalidFields.length > 0) {
          const error = `Campos inválidos para ${tableName}: ${invalidFields.join(", ")}`;
          logger.warn("Campos inválidos detectados", {
            tableName,
            invalidFields,
            allowedFields,
          });
          // Filtrar campos inválidos en lugar de fallar
          invalidFields.forEach((field) => delete updateData[field]);
        }
      }

      const { data, error } = await this.client
        .from(tableName)
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        logger.error(`Error actualizando registro ${id} en ${tableName}`, {
          error: error.message,
          updateData,
        });
        return { data: null, error };
      }

      logger.info(`Registro actualizado en ${tableName}`, {
        id,
        updatedFields: Object.keys(updateData),
      });

      return { data, error: null };
    } catch (error) {
      logger.error(`Error en updateRecord para ${tableName}`, {
        error: error.message,
        id,
        updateData,
      });
      return { data: null, error };
    }
  }

  /**
   * Inserta un nuevo registro
   */
  async insertRecord(tableName, insertData) {
    try {
      const { data, error } = await this.client
        .from(tableName)
        .insert(insertData)
        .select()
        .single();

      if (error) {
        logger.error(`Error insertando registro en ${tableName}`, {
          error: error.message,
          insertData,
        });
        return { data: null, error };
      }

      logger.info(`Registro insertado en ${tableName}`, {
        id: data?.id,
        fields: Object.keys(insertData),
      });

      return { data, error: null };
    } catch (error) {
      logger.error(`Error en insertRecord para ${tableName}`, {
        error: error.message,
        insertData,
      });
      return { data: null, error };
    }
  }

  /**
   * Actualiza el teléfono de un cliente de forma segura
   */
  async updateClientPhone(clientId, phoneNumber) {
    try {
      const updateData = { phone: phoneNumber };

      const result = await this.updateRecord("clients", clientId, updateData);

      if (result.error) {
        logger.error("Error actualizando teléfono del cliente", {
          clientId,
          phoneNumber,
          error: result.error.message,
        });
      } else {
        logger.info("Teléfono del cliente actualizado", {
          clientId,
          phoneNumber,
        });
      }

      return result;
    } catch (error) {
      logger.error("Error en updateClientPhone", {
        error: error.message,
        clientId,
        phoneNumber,
      });
      return { data: null, error };
    }
  }

  /**
   * Busca clientes por teléfono
   */
  async findClientByPhone(phoneNumber) {
    try {
      const { data, error } = await this.client
        .from("clients")
        .select("*")
        .eq("phone", phoneNumber)
        .limit(1);

      if (error) {
        logger.error("Error buscando cliente por teléfono", {
          phoneNumber,
          error: error.message,
        });
        return { data: null, error };
      }

      const client = data && data.length > 0 ? data[0] : null;

      if (client) {
        logger.info("Cliente encontrado por teléfono", {
          clientId: client.id,
          phoneNumber,
        });
      }

      return { data: client, error: null };
    } catch (error) {
      logger.error("Error en findClientByPhone", {
        error: error.message,
        phoneNumber,
      });
      return { data: null, error };
    }
  }

  /**
   * Verifica la salud de la conexión
   */
  async healthCheck() {
    try {
      const { data, error } = await this.client
        .from("clients")
        .select("count")
        .limit(1);

      return { healthy: !error, error: error?.message || null };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Obtiene estadísticas de la base de datos
   */
  async getStats() {
    try {
      const stats = {};

      for (const tableName of Object.keys(this.schemas)) {
        const { count } = await this.client
          .from(tableName)
          .select("*", { count: "exact", head: true });

        stats[tableName] = count || 0;
      }

      return { data: stats, error: null };
    } catch (error) {
      logger.error("Error obteniendo estadísticas", { error: error.message });
      return { data: {}, error };
    }
  }
}

// Instancia singleton
const dbManager = new DatabaseManager();

module.exports = {
  supabase,
  dbManager,
  DatabaseManager,
  TABLE_SCHEMAS,
};
