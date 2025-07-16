// src/adapters/databaseAdapter.js
const supabaseAdmin = require("../integrations/supabaseAdmin");

/**
 * ADAPTADOR DE BASE DE DATOS
 * Traduce entre el código (inglés) y el esquema español
 */

// Mapeo de tablas: código -> BD
const TABLE_MAPPING = {
  users: "clientes", // Usaremos clientes como usuarios por ahora
  clients: "clientes",
  services: "servicios",
  appointments: "reservas",
  conversations: "conversations", // Ya existe
  whatsapp_conversations: "conversations",
  whatsapp_messages: "conversaciones",
};

// Mapeo de campos: código -> BD
const FIELD_MAPPING = {
  // CLIENTS/CLIENTES
  id: "id_cliente",
  first_name: "nombre",
  last_name: "apellido",
  phone: "telefono_movil",
  whatsapp_phone: "whatsapp_id",
  created_at: "created_at",
  updated_at: "updated_at",

  // SERVICES/SERVICIOS
  service_id: "id_servicio",
  name: "nombre",
  description: "descripcion",
  price: "precio",
  duration_minutes: "duracion",
  category: "categoria",
  is_active: "activo",
  image_url: "imagen_url",
  calendly_url: "url_calendly",

  // APPOINTMENTS/RESERVAS
  appointment_id: "id_reserva",
  client_id: "id_cliente",
  scheduled_at: "fecha_reserva",
  status: "estado",
  notes: "notas",
  calendly_event_uri: "uri_evento_calendly",
};

// Mapeo inverso: BD -> código
const REVERSE_FIELD_MAPPING = {
  // CLIENTES -> CLIENTS
  id_cliente: "id",
  nombre: "first_name",
  apellido: "last_name",
  telefono_movil: "phone",
  whatsapp_id: "whatsapp_phone",
  email: "email",
  fecha_nacimiento: "date_of_birth",
  lgpd_accepted: "lgpd_accepted",
  registration_complete: "registration_complete",

  // SERVICIOS -> SERVICES
  id_servicio: "id",
  nombre: "name",
  descripcion: "description",
  precio: "price",
  duracion: "duration_minutes",
  categoria: "category",
  activo: "is_active",
  imagen_url: "image_url",
  url_calendly: "calendly_url",

  // RESERVAS -> APPOINTMENTS
  id_reserva: "id",
  fecha_reserva: "scheduled_at",
  estado: "status",
  notas: "notes",
  uri_evento_calendly: "calendly_event_uri",

  // Campos comunes
  created_at: "created_at",
  updated_at: "updated_at",
};

class DatabaseAdapter {
  /**
   * Traduce nombre de tabla del código a BD
   */
  static getTableName(codeTable) {
    return TABLE_MAPPING[codeTable] || codeTable;
  }

  /**
   * Traduce campos del código a BD para queries
   */
  static translateFieldsToDb(fields, table = null) {
    if (typeof fields === "string") {
      if (fields === "*") return "*";
      return FIELD_MAPPING[fields] || fields;
    }

    if (Array.isArray(fields)) {
      return fields.map((field) => FIELD_MAPPING[field] || field);
    }

    if (typeof fields === "object") {
      const translated = {};
      Object.entries(fields).forEach(([key, value]) => {
        const dbField = FIELD_MAPPING[key] || key;
        translated[dbField] = value;
      });
      return translated;
    }

    return fields;
  }

  /**
   * Traduce campos de BD a código para respuestas
   */
  static translateFieldsFromDb(data, table = null) {
    if (!data) return data;

    if (Array.isArray(data)) {
      return data.map((item) => this.translateFieldsFromDb(item, table));
    }

    if (typeof data === "object") {
      const translated = {};
      Object.entries(data).forEach(([key, value]) => {
        const codeField = REVERSE_FIELD_MAPPING[key] || key;
        translated[codeField] = value;
      });
      return translated;
    }

    return data;
  }

  /**
   * SELECT con traducción automática
   */
  static async select(table, fields = "*", filters = {}) {
    try {
      const dbTable = this.getTableName(table);
      const dbFields = this.translateFieldsToDb(fields);
      const dbFilters = this.translateFieldsToDb(filters);

      let query = supabaseAdmin.from(dbTable);

      // Aplicar select
      if (dbFields !== "*") {
        if (Array.isArray(dbFields)) {
          query = query.select(dbFields.join(","));
        } else {
          query = query.select(dbFields);
        }
      } else {
        query = query.select("*");
      }

      // Aplicar filtros
      Object.entries(dbFilters).forEach(([field, value]) => {
        query = query.eq(field, value);
      });

      const { data, error } = await query;

      if (error) throw error;

      return {
        data: this.translateFieldsFromDb(data, table),
        error: null,
      };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * INSERT con traducción automática
   */
  static async insert(table, data) {
    try {
      const dbTable = this.getTableName(table);
      const dbData = this.translateFieldsToDb(data);

      const { data: result, error } = await supabaseAdmin
        .from(dbTable)
        .insert(dbData)
        .select();

      if (error) throw error;

      return {
        data: this.translateFieldsFromDb(result, table),
        error: null,
      };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * UPDATE con traducción automática
   */
  static async update(table, data, filters) {
    try {
      const dbTable = this.getTableName(table);
      const dbData = this.translateFieldsToDb(data);
      const dbFilters = this.translateFieldsToDb(filters);

      let query = supabaseAdmin.from(dbTable).update(dbData);

      // Aplicar filtros
      Object.entries(dbFilters).forEach(([field, value]) => {
        query = query.eq(field, value);
      });

      const { data: result, error } = await query.select();

      if (error) throw error;

      return {
        data: this.translateFieldsFromDb(result, table),
        error: null,
      };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * DELETE con traducción automática
   */
  static async delete(table, filters) {
    try {
      const dbTable = this.getTableName(table);
      const dbFilters = this.translateFieldsToDb(filters);

      let query = supabaseAdmin.from(dbTable);

      // Aplicar filtros
      Object.entries(dbFilters).forEach(([field, value]) => {
        query = query.eq(field, value);
      });

      const { data, error } = await query.delete();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Acceso directo a Supabase para casos especiales
   */
  static get client() {
    return supabaseAdmin;
  }
}

module.exports = DatabaseAdapter;
