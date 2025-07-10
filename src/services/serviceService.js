// src/services/serviceService.js
const DatabaseAdapter = require("../adapters/databaseAdapter");

class ServiceService {
  /**
   * Obtener todos los servicios activos
   */
  static async getActiveServices() {
    try {
      const { data, error } = await DatabaseAdapter.select("services", "*", {
        is_active: true,
      });

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        count: data?.length || 0,
      };
    } catch (error) {
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
      // Usar consulta directa para evitar problemas de mapeo
      const { data, error } = await DatabaseAdapter.client
        .from("servicios")
        .select("*")
        .eq("id_servicio", serviceId)
        .single();

      if (error) throw error;

      // Transformar manualmente
      const transformedData = data
        ? {
            id: data.id_servicio,
            name: data.nombre,
            description: data.descripcion,
            price: data.precio,
            duration_minutes: data.duracion,
            category: data.categoria,
            is_active: data.activo,
            image_url: data.imagen_url,
            booking_url: data.url_reserva,
            created_at: data.created_at,
            updated_at: data.updated_at,
          }
        : null;

      return {
        success: true,
        data: transformedData,
      };
    } catch (error) {
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
  static async getServicesByCategory(category) {
    try {
      const { data, error } = await DatabaseAdapter.select("services", "*", {
        category,
        is_active: true,
      });

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        count: data?.length || 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Formatear servicios para mostrar al usuario
   */
  static formatServicesForUser(services) {
    return services.map((service) => ({
      id: service.id,
      nombre: service.name,
      descripcion: service.description,
      precio: `€${service.price}`,
      duracion: `${service.duration_minutes} min`,
      categoria: service.category,
    }));
  }
}

module.exports = ServiceService;
