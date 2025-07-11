// src/services/serviceService.js
const DatabaseAdapter = require("../adapters/databaseAdapter");
const logger = require("../utils/logger");
const {
  validateServiceData,
  sanitizeServiceData,
} = require("../utils/validators");

class ServiceService {
  /**
   * Obtener todos los servicios con filtros y paginación
   */
  static async getAllServices(options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        search = "",
        category = null,
        active = null,
        sortBy = "created_at",
        sortOrder = "desc",
      } = options;

      const offset = (page - 1) * limit;

      let query = "SELECT * FROM services";
      let countQuery = "SELECT COUNT(*) as total FROM services";
      const params = [];
      let paramIndex = 1;

      // Construir condiciones WHERE
      const conditions = [];

      // Filtro de búsqueda
      if (search) {
        conditions.push(
          `(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR slug ILIKE $${paramIndex})`,
        );
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Filtro por categoría
      if (category) {
        conditions.push(`category = $${paramIndex}`);
        params.push(category);
        paramIndex++;
      }

      // Filtro por estado activo
      if (active !== null) {
        conditions.push(`active = $${paramIndex}`);
        params.push(active);
        paramIndex++;
      }

      // Aplicar condiciones
      if (conditions.length > 0) {
        const whereClause = ` WHERE ${conditions.join(" AND ")}`;
        query += whereClause;
        countQuery += whereClause;
      }

      // Ordenamiento
      query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

      // Paginación
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      // Ejecutar consultas
      const [servicesResult, countResult] = await Promise.all([
        DatabaseAdapter.query(query, params),
        DatabaseAdapter.query(countQuery, search ? [`%${search}%`] : []),
      ]);

      if (servicesResult.error) throw new Error(servicesResult.error);
      if (countResult.error) throw new Error(countResult.error);

      const total = countResult.data[0]?.total || 0;
      const totalPages = Math.ceil(total / limit);

      logger.info("Services retrieved", {
        count: servicesResult.data?.length || 0,
        total,
        page,
        search: search || "none",
        category: category || "all",
        active: active !== null ? active : "all",
      });

      return {
        success: true,
        data: servicesResult.data || [],
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error("Error getting all services", {
        error: error.message,
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
   * Obtener servicios activos (método simplificado)
   */
  static async getActiveServices() {
    try {
      const result = await this.getAllServices({
        active: true,
        limit: 100,
        sortBy: "name",
        sortOrder: "asc",
      });

      return {
        success: result.success,
        data: result.data,
        count: result.data?.length || 0,
        error: result.error,
      };
    } catch (error) {
      logger.error("Error getting active services", { error: error.message });
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Obtener servicio por ID
   */
  static async getServiceById(serviceId) {
    try {
      if (!serviceId) {
        throw new Error("Service ID is required");
      }

      const { data, error } = await DatabaseAdapter.select("services", "*", {
        id: serviceId,
      });

      if (error) throw error;

      const service = data?.[0] || null;

      logger.info("Service found by ID", {
        serviceId,
        found: !!service,
        serviceName: service?.name,
        active: service?.active,
      });

      return {
        success: true,
        data: service,
      };
    } catch (error) {
      logger.error("Error finding service by ID", {
        error: error.message,
        serviceId,
      });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Obtener servicio por slug
   */
  static async getServiceBySlug(slug) {
    try {
      if (!slug) {
        throw new Error("Service slug is required");
      }

      const { data, error } = await DatabaseAdapter.select("services", "*", {
        slug: slug,
      });

      if (error) throw error;

      const service = data?.[0] || null;

      logger.info("Service found by slug", {
        slug,
        found: !!service,
        serviceName: service?.name,
        active: service?.active,
      });

      return {
        success: true,
        data: service,
      };
    } catch (error) {
      logger.error("Error finding service by slug", {
        error: error.message,
        slug,
      });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Buscar servicios por categoría
   */
  static async getServicesByCategory(category, options = {}) {
    try {
      if (!category) {
        throw new Error("Category is required");
      }

      const {
        activeOnly = true,
        limit = 50,
        sortBy = "name",
        sortOrder = "asc",
      } = options;

      const result = await this.getAllServices({
        category,
        active: activeOnly ? true : null,
        limit,
        sortBy,
        sortOrder,
      });

      logger.info("Services by category retrieved", {
        category,
        count: result.data?.length || 0,
        activeOnly,
      });

      return {
        success: result.success,
        data: result.data,
        count: result.data?.length || 0,
        error: result.error,
      };
    } catch (error) {
      logger.error("Error getting services by category", {
        error: error.message,
        category,
        options,
      });
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Crear nuevo servicio
   */
  static async createService(serviceData) {
    try {
      // Validar datos de entrada
      const validation = validateServiceData(serviceData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      // Sanitizar datos
      const sanitizedData = sanitizeServiceData(serviceData);

      // Verificar que el slug sea único
      if (sanitizedData.slug) {
        const existingService = await this.getServiceBySlug(sanitizedData.slug);
        if (existingService.success && existingService.data) {
          throw new Error("Service with this slug already exists");
        }
      } else {
        // Generar slug automáticamente
        sanitizedData.slug = this.generateSlug(sanitizedData.name);
      }

      // Agregar campos de auditoría
      const serviceToCreate = {
        ...sanitizedData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        active:
          sanitizedData.active !== undefined ? sanitizedData.active : true,
        online_booking_enabled:
          sanitizedData.online_booking_enabled !== undefined
            ? sanitizedData.online_booking_enabled
            : true,
        currency: sanitizedData.currency || "EUR",
        metadata: sanitizedData.metadata || {},
      };

      const { data, error } = await DatabaseAdapter.insert(
        "services",
        serviceToCreate,
      );

      if (error) throw error;

      const newService = data?.[0] || null;

      logger.info("Service created successfully", {
        serviceId: newService?.id,
        name: sanitizedData.name,
        slug: sanitizedData.slug,
        category: sanitizedData.category,
        price: sanitizedData.price,
      });

      return {
        success: true,
        data: newService,
        message: "Service created successfully",
      };
    } catch (error) {
      logger.error("Error creating service", {
        error: error.message,
        serviceData: {
          name: serviceData?.name,
          category: serviceData?.category,
          price: serviceData?.price,
        },
      });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Actualizar servicio
   */
  static async updateService(serviceId, updateData) {
    try {
      if (!serviceId) {
        throw new Error("Service ID is required");
      }

      // Verificar que el servicio existe
      const existingService = await this.getServiceById(serviceId);
      if (!existingService.success || !existingService.data) {
        throw new Error("Service not found");
      }

      // Validar datos de actualización
      const validation = validateServiceData(updateData, false); // false = partial validation
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      // Sanitizar datos
      const sanitizedData = sanitizeServiceData(updateData);

      // Verificar slug único si se actualiza
      if (
        sanitizedData.slug &&
        sanitizedData.slug !== existingService.data.slug
      ) {
        const existingBySlug = await this.getServiceBySlug(sanitizedData.slug);
        if (
          existingBySlug.success &&
          existingBySlug.data &&
          existingBySlug.data.id !== serviceId
        ) {
          throw new Error("Another service with this slug already exists");
        }
      }

      // Agregar timestamp de actualización
      const dataToUpdate = {
        ...sanitizedData,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await DatabaseAdapter.update(
        "services",
        dataToUpdate,
        { id: serviceId },
      );

      if (error) throw error;

      const updatedService = data?.[0] || null;

      logger.info("Service updated successfully", {
        serviceId,
        updatedFields: Object.keys(sanitizedData),
        name: updatedService?.name,
      });

      return {
        success: true,
        data: updatedService,
        message: "Service updated successfully",
      };
    } catch (error) {
      logger.error("Error updating service", {
        error: error.message,
        serviceId,
        updateFields: Object.keys(updateData || {}),
      });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Eliminar servicio (soft delete)
   */
  static async deleteService(serviceId, reason = "") {
    try {
      if (!serviceId) {
        throw new Error("Service ID is required");
      }

      // Verificar que el servicio existe
      const existingService = await this.getServiceById(serviceId);
      if (!existingService.success || !existingService.data) {
        throw new Error("Service not found");
      }

      // Verificar si tiene reservas activas
      const activeBookingsQuery = `
        SELECT COUNT(*) as count 
        FROM bookings 
        WHERE service_id = $1 
        AND status IN ('confirmed', 'pending') 
        AND start_time >= NOW()
      `;

      const bookingsResult = await DatabaseAdapter.query(activeBookingsQuery, [
        serviceId,
      ]);

      if (bookingsResult.error) {
        throw new Error("Error checking active bookings");
      }

      const activeBookings = bookingsResult.data[0]?.count || 0;

      if (activeBookings > 0) {
        throw new Error(
          `Cannot delete service with ${activeBookings} active booking(s). Cancel bookings first.`,
        );
      }

      // Soft delete - marcar como inactivo
      const deleteData = {
        active: false,
        updated_at: new Date().toISOString(),
        metadata: {
          ...existingService.data.metadata,
          deleted_at: new Date().toISOString(),
          deletion_reason: reason,
          deleted_by: "system",
        },
      };

      const { data, error } = await DatabaseAdapter.update(
        "services",
        deleteData,
        { id: serviceId },
      );

      if (error) throw error;

      logger.info("Service soft deleted", {
        serviceId,
        reason,
        serviceName: existingService.data.name,
      });

      return {
        success: true,
        data: data?.[0] || null,
        message: "Service deleted successfully",
      };
    } catch (error) {
      logger.error("Error deleting service", {
        error: error.message,
        serviceId,
        reason,
      });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Obtener estadísticas de servicios
   */
  static async getServiceStats() {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_services,
          COUNT(CASE WHEN active = true THEN 1 END) as active_services,
          COUNT(CASE WHEN online_booking_enabled = true THEN 1 END) as bookable_services,
          AVG(price) as average_price,
          MIN(price) as min_price,
          MAX(price) as max_price,
          AVG(duration_minutes) as average_duration
        FROM services
      `;

      const result = await DatabaseAdapter.query(statsQuery);

      if (result.error) throw new Error(result.error);

      const stats = result.data[0] || {};

      // Obtener estadísticas por categoría
      const categoryQuery = `
        SELECT 
          category,
          COUNT(*) as count,
          AVG(price) as avg_price
        FROM services
        WHERE active = true
        GROUP BY category
        ORDER BY count DESC
      `;

      const categoryResult = await DatabaseAdapter.query(categoryQuery);
      const categoryStats = categoryResult.data || [];

      logger.info("Service stats retrieved", {
        totalServices: parseInt(stats.total_services) || 0,
        activeServices: parseInt(stats.active_services) || 0,
      });

      return {
        success: true,
        data: {
          totalServices: parseInt(stats.total_services) || 0,
          activeServices: parseInt(stats.active_services) || 0,
          bookableServices: parseInt(stats.bookable_services) || 0,
          averagePrice: parseFloat(stats.average_price) || 0,
          minPrice: parseFloat(stats.min_price) || 0,
          maxPrice: parseFloat(stats.max_price) || 0,
          averageDuration: parseInt(stats.average_duration) || 0,
          categoryBreakdown: categoryStats.map((cat) => ({
            category: cat.category,
            count: parseInt(cat.count),
            averagePrice: parseFloat(cat.avg_price) || 0,
          })),
        },
      };
    } catch (error) {
      logger.error("Error getting service stats", { error: error.message });
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Generar slug a partir del nombre
   */
  static generateSlug(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "") // Remover caracteres especiales
      .replace(/\s+/g, "-") // Reemplazar espacios con guiones
      .replace(/-+/g, "-") // Remover guiones múltiples
      .trim("-"); // Remover guiones al inicio y final
  }

  /**
   * Formatear servicios para mostrar al usuario
   */
  static formatServicesForUser(services) {
    if (!Array.isArray(services)) {
      return [];
    }

    return services.map((service) => ({
      id: service.id,
      nombre: service.name,
      descripcion: service.description || service.short_description,
      precio: `€${service.price}`,
      duracion: `${service.duration_minutes} min`,
      categoria: service.category,
      activo: service.active,
      reserva_online: service.online_booking_enabled,
      slug: service.slug,
    }));
  }

  /**
   * Formatear servicio individual para mostrar
   */
  static formatServiceForUser(service) {
    if (!service) return null;

    return {
      id: service.id,
      nombre: service.name,
      slug: service.slug,
      descripcion: service.description,
      descripcion_corta: service.short_description,
      categoria: service.category,
      duracion: service.duration_minutes,
      duracion_texto: `${service.duration_minutes} minutos`,
      precio: service.price,
      precio_texto: `€${service.price}`,
      moneda: service.currency,
      activo: service.active,
      reserva_online: service.online_booking_enabled,
      requiere_aprobacion: service.requires_approval,
      configuracion: {
        max_dias_anticipacion: service.max_advance_booking_days,
        min_horas_anticipacion: service.min_advance_booking_hours,
        max_horas_cancelacion: service.max_cancellation_hours,
      },
      metadata: service.metadata || {},
    };
  }
}

module.exports = ServiceService;

module.exports = ServiceService;
