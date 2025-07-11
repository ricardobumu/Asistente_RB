// src/models/adaptedServiceModel.js
// Modelo de servicios adaptado a la estructura real de Supabase

const supabase = require("../integrations/supabaseClient");
const logger = require("../utils/logger");

/**
 * AdaptedServiceModel - Gestión de servicios adaptado a la estructura existente
 * Tabla: 'servicios' con campos reales identificados
 */
class AdaptedServiceModel {
  constructor() {
    this.tableName = "servicios";

    // Estructura real de la tabla servicios
    this.realFields = {
      id_servicio: "string", // UUID - Campo ID principal
      nombre: "string",
      descripcion: "string",
      precio: "number",
      duracion: "number", // en minutos
      imagen_url: "string",
      url_reserva: "string", // URL de Calendly
      created_at: "string",
      categoria: "string", // CORTE, TRATAMIENTO, etc.
      activo: "boolean",
      updated_at: "string",
    };

    // Categorías válidas basadas en los datos existentes
    this.validCategories = [
      "CORTE",
      "TRATAMIENTO",
      "COLORACION",
      "ASESORIA",
      "ESPECIALIZADO",
    ];

    logger.info("AdaptedServiceModel inicializado", {
      table: this.tableName,
      fields: Object.keys(this.realFields).length,
    });
  }

  /**
   * Obtener todos los servicios
   */
  async getAll() {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("Error obteniendo servicios", {
          error: error.message,
          table: this.tableName,
        });

        return {
          success: false,
          error: this.handleDatabaseError(error),
          data: null,
        };
      }

      return {
        success: true,
        error: null,
        data,
      };
    } catch (error) {
      logger.error("Error en AdaptedServiceModel.getAll", error);
      return {
        success: false,
        error: "Error interno del servidor",
        data: null,
      };
    }
  }

  /**
   * Obtener servicio por ID
   */
  async getById(serviceId) {
    try {
      if (!this.isValidUUID(serviceId)) {
        return {
          success: false,
          error: "ID de servicio inválido",
          data: null,
        };
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("id_servicio", serviceId) // Campo real es id_servicio
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return {
            success: false,
            error: "Servicio no encontrado",
            data: null,
          };
        }

        logger.error("Error obteniendo servicio por ID", {
          error: error.message,
          serviceId,
        });

        return {
          success: false,
          error: this.handleDatabaseError(error),
          data: null,
        };
      }

      return {
        success: true,
        error: null,
        data,
      };
    } catch (error) {
      logger.error("Error en AdaptedServiceModel.getById", error);
      return {
        success: false,
        error: "Error interno del servidor",
        data: null,
      };
    }
  }

  /**
   * Obtener servicios activos
   */
  async getActive() {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("activo", true)
        .order("nombre");

      if (error) {
        logger.error("Error obteniendo servicios activos", {
          error: error.message,
        });

        return {
          success: false,
          error: this.handleDatabaseError(error),
          data: null,
        };
      }

      return {
        success: true,
        error: null,
        data,
      };
    } catch (error) {
      logger.error("Error en AdaptedServiceModel.getActive", error);
      return {
        success: false,
        error: "Error interno del servidor",
        data: null,
      };
    }
  }

  /**
   * Obtener servicios por categoría
   */
  async getByCategory(categoria) {
    try {
      if (!this.validCategories.includes(categoria.toUpperCase())) {
        return {
          success: false,
          error: `Categoría inválida. Válidas: ${this.validCategories.join(
            ", ",
          )}`,
          data: null,
        };
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("categoria", categoria.toUpperCase())
        .eq("activo", true)
        .order("nombre");

      if (error) {
        logger.error("Error obteniendo servicios por categoría", {
          error: error.message,
          categoria,
        });

        return {
          success: false,
          error: this.handleDatabaseError(error),
          data: null,
        };
      }

      return {
        success: true,
        error: null,
        data,
      };
    } catch (error) {
      logger.error("Error en AdaptedServiceModel.getByCategory", error);
      return {
        success: false,
        error: "Error interno del servidor",
        data: null,
      };
    }
  }

  /**
   * Buscar servicios por nombre
   */
  async searchByName(searchTerm) {
    try {
      if (!searchTerm || searchTerm.length < 2) {
        return {
          success: false,
          error: "El término de búsqueda debe tener al menos 2 caracteres",
          data: null,
        };
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .or(`nombre.ilike.%${searchTerm}%,descripcion.ilike.%${searchTerm}%`)
        .eq("activo", true)
        .order("nombre");

      if (error) {
        logger.error("Error buscando servicios", {
          error: error.message,
          searchTerm,
        });

        return {
          success: false,
          error: this.handleDatabaseError(error),
          data: null,
        };
      }

      return {
        success: true,
        error: null,
        data,
      };
    } catch (error) {
      logger.error("Error en AdaptedServiceModel.searchByName", error);
      return {
        success: false,
        error: "Error interno del servidor",
        data: null,
      };
    }
  }

  /**
   * Obtener servicios con paginación
   */
  async list(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        categoria = null,
        activo = null,
        sortBy = "created_at",
        sortOrder = "desc",
      } = options;

      // Validar parámetros
      const validatedLimit = Math.min(Math.max(1, parseInt(limit)), 100);
      const validatedPage = Math.max(1, parseInt(page));
      const offset = (validatedPage - 1) * validatedLimit;

      let query = supabase.from(this.tableName).select("*", { count: "exact" });

      // Aplicar filtros
      if (categoria && this.validCategories.includes(categoria.toUpperCase())) {
        query = query.eq("categoria", categoria.toUpperCase());
      }

      if (activo !== null) {
        query = query.eq("activo", activo);
      }

      // Aplicar ordenamiento
      query = query.order(sortBy, { ascending: sortOrder === "asc" });

      // Aplicar paginación
      query = query.range(offset, offset + validatedLimit - 1);

      const { data, error, count } = await query;

      if (error) {
        logger.error("Error listando servicios", {
          error: error.message,
          options,
        });

        return {
          success: false,
          error: this.handleDatabaseError(error),
          data: null,
          pagination: null,
        };
      }

      const pagination = {
        page: validatedPage,
        limit: validatedLimit,
        total: count,
        totalPages: Math.ceil(count / validatedLimit),
        hasNext: validatedPage < Math.ceil(count / validatedLimit),
        hasPrev: validatedPage > 1,
      };

      return {
        success: true,
        error: null,
        data,
        pagination,
      };
    } catch (error) {
      logger.error("Error en AdaptedServiceModel.list", error);
      return {
        success: false,
        error: "Error interno del servidor",
        data: null,
        pagination: null,
      };
    }
  }

  /**
   * Obtener estadísticas de servicios
   */
  async getStats() {
    try {
      const [totalResult, activeResult, categoriesResult] = await Promise.all([
        supabase
          .from(this.tableName)
          .select("id_servicio", { count: "exact", head: true }),
        supabase
          .from(this.tableName)
          .select("id_servicio", { count: "exact", head: true })
          .eq("activo", true),
        supabase.from(this.tableName).select("categoria").eq("activo", true),
      ]);

      if (totalResult.error || activeResult.error || categoriesResult.error) {
        return {
          success: false,
          error: "Error obteniendo estadísticas",
          data: null,
        };
      }

      // Contar por categorías
      const categoryStats = {};
      this.validCategories.forEach((cat) => {
        categoryStats[cat] = 0;
      });

      if (categoriesResult.data) {
        categoriesResult.data.forEach((item) => {
          if (item.categoria && categoryStats.hasOwnProperty(item.categoria)) {
            categoryStats[item.categoria]++;
          }
        });
      }

      return {
        success: true,
        error: null,
        data: {
          total: totalResult.count,
          active: activeResult.count,
          inactive: totalResult.count - activeResult.count,
          categories: categoryStats,
          validCategories: this.validCategories,
        },
      };
    } catch (error) {
      logger.error("Error en AdaptedServiceModel.getStats", error);
      return {
        success: false,
        error: "Error interno del servidor",
        data: null,
      };
    }
  }

  /**
   * Validar UUID
   */
  isValidUUID(uuid) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Manejar errores de base de datos
   */
  handleDatabaseError(error) {
    const errorMap = {
      23505: "Ya existe un servicio con esos datos",
      23503: "Referencia inválida",
      23514: "Datos inválidos",
      PGRST116: "Servicio no encontrado",
      PGRST301: "Sin permisos para acceder a los datos",
    };

    return errorMap[error.code] || "Error de base de datos";
  }

  /**
   * Formatear servicio para respuesta API
   */
  formatService(service) {
    return {
      id: service.id_servicio,
      nombre: service.nombre,
      descripcion: service.descripcion,
      precio: service.precio,
      duracion: service.duracion,
      imagen_url: service.imagen_url,
      url_reserva: service.url_reserva,
      categoria: service.categoria,
      activo: service.activo,
      created_at: service.created_at,
      updated_at: service.updated_at,
    };
  }

  /**
   * Formatear múltiples servicios
   */
  formatServices(services) {
    return services.map((service) => this.formatService(service));
  }
}

// Singleton
const adaptedServiceModel = new AdaptedServiceModel();
module.exports = adaptedServiceModel;
