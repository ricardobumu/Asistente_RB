// src/models/serviceModel.js
const supabase = require("../integrations/supabaseClient");
const supabaseAdmin = require("../integrations/supabaseAdmin");
const logger = require("../utils/logger");
const Validators = require("../utils/validators");

/**
 * ServiceModel - Sistema de gestión de servicios para Ricardo Buriticá Beauty Consulting
 *
 * Especializado en Peluquería Consciente:
 * - Gestión de 15 servicios específicos de peluquería
 * - Integración automática con Calendly
 * - Sistema de precios y duraciones personalizadas
 * - Categorización por tipo de servicio (Corte, Color, Tratamientos)
 * - Filosofía de Peluquería Consciente integrada
 * - Gestión de disponibilidad para peluquero autónomo
 * - Análisis de servicios más demandados
 * - Sistema de recomendaciones personalizadas
 */
class ServiceModel {
  constructor() {
    this.tableName = "servicios";

    // Categorías específicas para Ricardo Buriticá Beauty Consulting
    this.validCategories = [
      "tratamientos_capilares", // Hidratación, Enzimoterapia, Queratina
      "cortes", // Todos los tipos de corte
      "coloracion", // Menús de raíz, iluminaciones
      "asesoria", // Asesoría de belleza
      "especializados", // Servicios únicos del método
    ];

    // Servicios específicos de Ricardo Buriticá con precios y duraciones exactas
    this.ricardoServices = [
      {
        name: "Hidratación Capilar (Epres + Bio-Mimético)",
        category: "tratamientos_capilares",
        price: 66,
        duration: 90, // 1.5 horas en minutos
        description:
          "Tratamiento intensivo de hidratación con tecnología Epres y Bio-Mimético para restaurar la salud capilar",
        calendly_event_type: "hidratacion-capilar",
        conscious_benefits:
          "Restaura la estructura natural del cabello respetando su biología",
        preparation_instructions:
          "Cabello limpio, sin productos. Evitar lavado 24h antes si es posible",
        aftercare_instructions:
          "No lavar por 48h. Usar productos recomendados específicamente",
      },
      {
        name: "Asesoría de Belleza - Primera Visita",
        category: "asesoria",
        price: 30,
        duration: 60, // 1 hora
        description:
          "Consulta inicial personalizada para entender las necesidades específicas de tu cabello y cuero cabelludo",
        calendly_event_type: "asesoria-primera-visita",
        conscious_benefits:
          "Conocimiento profundo de tu cabello para decisiones conscientes",
        preparation_instructions:
          "Cabello en estado natural, sin productos de peinado",
        aftercare_instructions: "Plan personalizado de cuidado consciente",
      },
      {
        name: "Corte Mujer Sin Lavado",
        category: "cortes",
        price: 30,
        duration: 60,
        description: "Corte personalizado para mujer sin servicio de lavado",
        calendly_event_type: "corte-mujer-sin-lavado",
        conscious_benefits:
          "Corte que respeta la forma natural y textura del cabello",
        preparation_instructions: "Cabello limpio y desenredado",
        aftercare_instructions:
          "Mantener la forma con productos naturales recomendados",
      },
      {
        name: "Corte Hombre",
        category: "cortes",
        price: 30,
        duration: 60,
        description:
          "Corte masculino personalizado según estilo y tipo de cabello",
        calendly_event_type: "corte-hombre",
        conscious_benefits:
          "Corte que potencia las características naturales del cabello masculino",
        preparation_instructions: "Cabello limpio",
        aftercare_instructions: "Rutina de mantenimiento personalizada",
      },
      {
        name: "Corte Underground",
        category: "cortes",
        price: 32,
        duration: 60,
        description: "Corte alternativo y creativo con técnicas especializadas",
        calendly_event_type: "corte-underground",
        conscious_benefits: "Expresión personal respetando la salud capilar",
        preparation_instructions:
          "Cabello limpio, referencias visuales si las tienes",
        aftercare_instructions:
          "Cuidados específicos para mantener el estilo alternativo",
      },
      {
        name: "Menú Corte Mujer",
        category: "cortes",
        price: 71,
        duration: 120, // 2 horas
        description:
          "Servicio completo de corte para mujer con lavado y peinado",
        calendly_event_type: "menu-corte-mujer",
        conscious_benefits: "Experiencia completa de transformación consciente",
        preparation_instructions: "Sin preparación especial necesaria",
        aftercare_instructions:
          "Rutina completa de mantenimiento personalizada",
      },
      {
        name: "Corte Natural Curly",
        category: "cortes",
        price: 80,
        duration: 120,
        description:
          "Corte especializado para cabello rizado respetando su patrón natural",
        calendly_event_type: "corte-natural-curly",
        conscious_benefits:
          "Potencia la belleza natural de los rizos sin dañar su estructura",
        preparation_instructions:
          "Cabello en estado natural, sin alisado reciente",
        aftercare_instructions:
          "Rutina específica para cabello rizado con productos naturales",
      },
      {
        name: "Menú Raíz + Secar",
        category: "coloracion",
        price: 85,
        duration: 150, // 2.5 horas
        description: "Retoque de raíz con secado profesional",
        calendly_event_type: "menu-raiz-secar",
        conscious_benefits:
          "Coloración consciente que respeta la salud del cuero cabelludo",
        preparation_instructions: "Cabello sin lavar 24-48h, sin productos",
        aftercare_instructions:
          "Cuidados post-coloración con productos específicos",
      },
      {
        name: "Menú Raíz + Baño",
        category: "coloracion",
        price: 95,
        duration: 150,
        description: "Retoque de raíz con baño de color completo",
        calendly_event_type: "menu-raiz-bano",
        conscious_benefits:
          "Coloración uniforme respetando la estructura capilar",
        preparation_instructions:
          "Cabello sin lavar 24-48h, test de alergia previo",
        aftercare_instructions:
          "Protocolo de mantenimiento de color consciente",
      },
      {
        name: "Menú Raíz + Cortar",
        category: "coloracion",
        price: 105,
        duration: 150,
        description: "Retoque de raíz con corte personalizado",
        calendly_event_type: "menu-raiz-cortar",
        conscious_benefits:
          "Transformación completa color y forma de manera consciente",
        preparation_instructions:
          "Cabello sin lavar 24-48h, referencias de corte si las tienes",
        aftercare_instructions: "Cuidados integrales para color y corte",
      },
      {
        name: "Menú Raíz + Baño + Cortar",
        category: "coloracion",
        price: 115,
        duration: 150,
        description:
          "Servicio completo: retoque de raíz, baño de color y corte",
        calendly_event_type: "menu-completo",
        conscious_benefits:
          "Transformación total con filosofía de peluquería consciente",
        preparation_instructions:
          "Cabello sin lavar 24-48h, consulta previa recomendada",
        aftercare_instructions: "Plan completo de mantenimiento personalizado",
      },
      {
        name: "Iluminaciones Localizadas",
        category: "coloracion",
        price: 130,
        duration: 150,
        description: "Mechas o iluminaciones en zonas específicas",
        calendly_event_type: "iluminaciones-localizadas",
        conscious_benefits:
          "Iluminación natural que respeta la base del cabello",
        preparation_instructions:
          "Cabello sin lavar 24-48h, evitar tratamientos químicos recientes",
        aftercare_instructions: "Cuidados específicos para cabello decolorado",
      },
      {
        name: "Iluminaciones Full Blond",
        category: "coloracion",
        price: 190,
        duration: 210, // 3.5 horas
        description: "Decoloración completa para lograr rubio total",
        calendly_event_type: "full-blond",
        conscious_benefits:
          "Decoloración progresiva respetando la integridad capilar",
        preparation_instructions:
          "Evaluación previa obligatoria, cabello sin tratamientos químicos recientes",
        aftercare_instructions:
          "Protocolo intensivo de reconstrucción y mantenimiento",
      },
      {
        name: "Enzimoterapia - Alisado Progresivo",
        category: "tratamientos_capilares",
        price: 300,
        duration: 180, // 3 horas
        description: "Tratamiento de alisado progresivo con enzimas naturales",
        calendly_event_type: "enzimoterapia",
        conscious_benefits:
          "Alisado natural sin químicos agresivos, respeta la estructura capilar",
        preparation_instructions:
          "Cabello limpio, evaluación previa obligatoria",
        aftercare_instructions:
          "Protocolo específico de mantenimiento enzimático",
      },
      {
        name: "Queratina Anti-frizz",
        category: "tratamientos_capilares",
        price: 150,
        duration: 120, // 2 horas
        description:
          "Tratamiento de queratina para eliminar el frizz y suavizar",
        calendly_event_type: "queratina-antifrizz",
        conscious_benefits:
          "Suavidad natural sin alterar la estructura del cabello",
        preparation_instructions: "Cabello limpio, sin residuos de productos",
        aftercare_instructions:
          "Cuidados post-queratina para prolongar el efecto",
      },
    ];

    // Horarios de trabajo de Ricardo (peluquero autónomo)
    this.workingHours = {
      monday: { start: "09:00", end: "19:00", breaks: ["14:00-15:00"] },
      tuesday: { start: "09:00", end: "19:00", breaks: ["14:00-15:00"] },
      wednesday: { start: "09:00", end: "19:00", breaks: ["14:00-15:00"] },
      thursday: { start: "09:00", end: "19:00", breaks: ["14:00-15:00"] },
      friday: { start: "09:00", end: "19:00", breaks: ["14:00-15:00"] },
      saturday: { start: "09:00", end: "17:00", breaks: ["13:00-14:00"] },
      sunday: { closed: true },
    };

    // Filosofía de Peluquería Consciente
    this.consciousPhilosophy = {
      mission: "Promover un Consumo y un Cuidado Consciente del cabello",
      vision:
        "Que cada cliente conozca las condiciones biológicas del cabello y del cuero cabelludo",
      values: [
        "Conocimiento como base de la libertad de elección",
        "Respeto por la biología natural del cabello",
        "Transparencia contra el marketing deshonesto",
        "Cuidado personalizado basado en ciencia",
        "Sostenibilidad en productos y procesos",
      ],
    };

    logger.info(
      "ServiceModel inicializado para Ricardo Buriticá Beauty Consulting",
      {
        totalServices: this.ricardoServices.length,
        categories: this.validCategories.length,
        philosophy: "Peluquería Consciente",
      }
    );
  }

  /**
   * Inicializar servicios de Ricardo en la base de datos
   */
  async initializeRicardoServices() {
    const startTime = Date.now();

    try {
      logger.info(
        "Inicializando servicios de Ricardo Buriticá Beauty Consulting"
      );

      const results = [];

      for (const service of this.ricardoServices) {
        // Verificar si el servicio ya existe
        const { data: existing } = await supabaseAdmin
          .from(this.tableName)
          .select("id_servicio")
          .eq("nombre", service.name)
          .single();

        if (!existing) {
          // Crear el servicio usando la estructura de la tabla 'servicios'
          const serviceData = {
            nombre: service.name,
            descripcion: service.description,
            precio: service.price,
            duracion: service.duration,
            categoria: service.category,
            activo: true,
            imagen_url: null, // Se puede agregar después
            url_reserva: service.calendly_event_type
              ? `https://calendly.com/ricardoburitica/${service.calendly_event_type}`
              : null,
          };

          const { data, error } = await supabaseAdmin
            .from(this.tableName)
            .insert([serviceData])
            .select();

          if (error) {
            logger.error(`Error creando servicio ${service.name}`, error);
          } else {
            results.push(data[0]);
            logger.info(`Servicio creado: ${service.name}`, {
              id: data[0].id_servicio,
              price: service.price,
              duration: service.duration,
            });
          }
        } else {
          logger.info(`Servicio ya existe: ${service.name}`);
        }
      }

      const duration = Date.now() - startTime;
      logger.info("Inicialización de servicios completada", {
        servicesCreated: results.length,
        totalServices: this.ricardoServices.length,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: results,
        message: `${results.length} servicios inicializados para Ricardo Buriticá Beauty Consulting`,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error inicializando servicios de Ricardo", error, {
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener servicios por categoría específica de Ricardo
   */
  async getServicesByCategory(category) {
    const startTime = Date.now();

    try {
      if (!this.validCategories.includes(category)) {
        return {
          success: false,
          error: "Categoría no válida para Ricardo Buriticá Beauty Consulting",
        };
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("category", category)
        .eq("is_active", true)
        .order("price", { ascending: true });

      if (error) throw error;

      const duration = Date.now() - startTime;
      logger.info("Servicios obtenidos por categoría", {
        category,
        count: data.length,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data,
        category_info: {
          name: category,
          total_services: data.length,
          price_range:
            data.length > 0
              ? {
                  min: Math.min(...data.map((s) => s.price)),
                  max: Math.max(...data.map((s) => s.price)),
                }
              : null,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error obteniendo servicios por categoría", error, {
        category,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Buscar servicios con recomendaciones conscientes
   */
  async searchServicesWithRecommendations(searchTerm, clientProfile = null) {
    const startTime = Date.now();

    try {
      // Búsqueda básica
      const { data: services, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("is_active", true)
        .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .order("price", { ascending: true });

      if (error) throw error;

      // Agregar recomendaciones conscientes
      const servicesWithRecommendations = services.map((service) => {
        const recommendations = this._generateConsciousRecommendations(
          service,
          clientProfile
        );
        return {
          ...service,
          conscious_recommendations: recommendations,
          philosophy_alignment: this._calculatePhilosophyAlignment(service),
        };
      });

      const duration = Date.now() - startTime;
      logger.info("Búsqueda de servicios con recomendaciones completada", {
        searchTerm,
        resultsCount: services.length,
        hasClientProfile: !!clientProfile,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: servicesWithRecommendations,
        search_info: {
          term: searchTerm,
          results_count: services.length,
          conscious_philosophy: this.consciousPhilosophy.mission,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        "Error en búsqueda de servicios con recomendaciones",
        error,
        {
          searchTerm,
          duration: `${duration}ms`,
        }
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Generar recomendaciones conscientes para un servicio
   */
  _generateConsciousRecommendations(service, clientProfile) {
    const recommendations = [];

    // Recomendaciones basadas en el tipo de servicio
    switch (service.category) {
      case "tratamientos_capilares":
        recommendations.push({
          type: "conscious_care",
          message: "Este tratamiento respeta la biología natural de tu cabello",
          priority: "high",
        });
        break;

      case "coloracion":
        recommendations.push({
          type: "preparation",
          message: "La preparación consciente es clave para resultados óptimos",
          priority: "high",
        });
        break;

      case "cortes":
        recommendations.push({
          type: "natural_beauty",
          message:
            "Potenciaremos tu belleza natural respetando tu tipo de cabello",
          priority: "medium",
        });
        break;
    }

    // Recomendaciones basadas en el precio (inversión consciente)
    if (service.price > 100) {
      recommendations.push({
        type: "investment",
        message: "Inversión consciente en la salud a largo plazo de tu cabello",
        priority: "medium",
      });
    }

    // Recomendaciones basadas en duración
    if (service.duration > 120) {
      recommendations.push({
        type: "time_investment",
        message: "Tiempo dedicado para resultados duraderos y conscientes",
        priority: "low",
      });
    }

    return recommendations;
  }

  /**
   * Calcular alineación con la filosofía consciente
   */
  _calculatePhilosophyAlignment(service) {
    let score = 0;
    const factors = [];

    // Factor: Respeto por la biología del cabello
    if (service.metadata?.conscious_benefits) {
      score += 25;
      factors.push("Respeta la biología capilar");
    }

    // Factor: Educación del cliente
    if (service.category === "asesoria") {
      score += 30;
      factors.push("Educación y conocimiento");
    }

    // Factor: Cuidado personalizado
    if (
      service.metadata?.preparation_instructions &&
      service.metadata?.aftercare_instructions
    ) {
      score += 20;
      factors.push("Cuidado personalizado");
    }

    // Factor: Transparencia en el proceso
    if (service.requires_consultation) {
      score += 15;
      factors.push("Transparencia y consulta");
    }

    // Factor: Sostenibilidad (tratamientos naturales)
    if (
      service.name.includes("Natural") ||
      service.name.includes("Enzimo") ||
      service.name.includes("Bio-Mimético")
    ) {
      score += 10;
      factors.push("Ingredientes naturales");
    }

    return {
      score: Math.min(score, 100),
      factors,
      level:
        score >= 80
          ? "Altamente Consciente"
          : score >= 60
          ? "Consciente"
          : score >= 40
          ? "Parcialmente Consciente"
          : "Básico",
    };
  }

  /**
   * Obtener estadísticas de servicios de Ricardo
   */
  async getRicardoServiceStats(startDate = null, endDate = null) {
    const startTime = Date.now();

    try {
      // Establecer fechas por defecto (último mes)
      if (!endDate) endDate = new Date().toISOString();
      if (!startDate) {
        const start = new Date();
        start.setMonth(start.getMonth() - 1);
        startDate = start.toISOString();
      }

      // Obtener todos los servicios activos
      const { data: services, error: servicesError } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("is_active", true);

      if (servicesError) throw servicesError;

      // Obtener reservas del período para análisis
      const { data: bookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("service_id, status, booking_date, total_amount")
        .gte("booking_date", startDate)
        .lte("booking_date", endDate);

      if (bookingsError) throw bookingsError;

      // Estadísticas por categoría
      const categoryStats = {};
      this.validCategories.forEach((category) => {
        const categoryServices = services.filter(
          (s) => s.category === category
        );
        const categoryBookings = bookings.filter((b) =>
          categoryServices.some((s) => s.id === b.service_id)
        );

        categoryStats[category] = {
          total_services: categoryServices.length,
          total_bookings: categoryBookings.length,
          total_revenue: categoryBookings.reduce(
            (sum, b) => sum + (b.total_amount || 0),
            0
          ),
          avg_price:
            categoryServices.length > 0
              ? categoryServices.reduce((sum, s) => sum + s.price, 0) /
                categoryServices.length
              : 0,
        };
      });

      // Servicios más populares
      const servicePopularity = services
        .map((service) => {
          const serviceBookings = bookings.filter(
            (b) => b.service_id === service.id
          );
          return {
            ...service,
            booking_count: serviceBookings.length,
            revenue: serviceBookings.reduce(
              (sum, b) => sum + (b.total_amount || 0),
              0
            ),
          };
        })
        .sort((a, b) => b.booking_count - a.booking_count);

      // Análisis de filosofía consciente
      const consciousAnalysis = {
        highly_conscious: services.filter(
          (s) => this._calculatePhilosophyAlignment(s).score >= 80
        ).length,
        conscious: services.filter((s) => {
          const score = this._calculatePhilosophyAlignment(s).score;
          return score >= 60 && score < 80;
        }).length,
        basic: services.filter(
          (s) => this._calculatePhilosophyAlignment(s).score < 60
        ).length,
      };

      const duration = Date.now() - startTime;
      logger.info("Estadísticas de servicios de Ricardo generadas", {
        period: `${startDate} to ${endDate}`,
        totalServices: services.length,
        totalBookings: bookings.length,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: {
          period: { startDate, endDate },
          overview: {
            total_services: services.length,
            active_services: services.filter((s) => s.is_active).length,
            total_bookings: bookings.length,
            total_revenue: bookings.reduce(
              (sum, b) => sum + (b.total_amount || 0),
              0
            ),
          },
          categories: categoryStats,
          most_popular: servicePopularity.slice(0, 5),
          conscious_analysis: consciousAnalysis,
          philosophy: this.consciousPhilosophy,
          recommendations: this._generateBusinessRecommendations(
            categoryStats,
            servicePopularity
          ),
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        "Error generando estadísticas de servicios de Ricardo",
        error,
        {
          startDate,
          endDate,
          duration: `${duration}ms`,
        }
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Generar recomendaciones de negocio basadas en estadísticas
   */
  _generateBusinessRecommendations(categoryStats, servicePopularity) {
    const recommendations = [];

    // Recomendación de servicios más populares
    const topService = servicePopularity[0];
    if (topService && topService.booking_count > 0) {
      recommendations.push({
        type: "popular_service",
        priority: "high",
        message: `${topService.name} es tu servicio más demandado (${topService.booking_count} reservas)`,
        action: "Considera crear paquetes o promociones especiales",
      });
    }

    // Recomendación de categorías con bajo rendimiento
    const lowPerformingCategories = Object.entries(categoryStats)
      .filter(([_, stats]) => stats.total_bookings === 0)
      .map(([category, _]) => category);

    if (lowPerformingCategories.length > 0) {
      recommendations.push({
        type: "category_promotion",
        priority: "medium",
        message: `Categorías con poca demanda: ${lowPerformingCategories.join(
          ", "
        )}`,
        action:
          "Considera estrategias de marketing específicas o educación consciente",
      });
    }

    // Recomendación de precios
    const highValueServices = servicePopularity.filter(
      (s) => s.price > 100 && s.booking_count > 0
    );
    if (highValueServices.length > 0) {
      recommendations.push({
        type: "high_value_focus",
        priority: "high",
        message: "Tus servicios premium tienen buena demanda",
        action:
          "Enfócate en la calidad y educación consciente para justificar el valor",
      });
    }

    return recommendations;
  }

  /**
   * Obtener información de servicio para Calendly
   */
  async getServiceForCalendly(calendlyEventType) {
    const startTime = Date.now();

    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("metadata->>calendly_event_type", calendlyEventType)
        .eq("is_active", true)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return {
            success: false,
            error: "Servicio no encontrado para este evento de Calendly",
          };
        }
        throw error;
      }

      const duration = Date.now() - startTime;
      logger.info("Servicio obtenido para Calendly", {
        calendly_event_type: calendlyEventType,
        service_name: data.name,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: {
          ...data,
          conscious_info: {
            benefits: data.metadata?.conscious_benefits,
            preparation: data.metadata?.preparation_instructions,
            aftercare: data.metadata?.aftercare_instructions,
            philosophy_alignment: this._calculatePhilosophyAlignment(data),
          },
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error obteniendo servicio para Calendly", error, {
        calendly_event_type: calendlyEventType,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  // Métodos de compatibilidad con la versión anterior
  async getAll(limit = 50, offset = 0) {
    return this.searchAdvanced({}, { limit, offset });
  }

  async getById(serviceId) {
    const startTime = Date.now();

    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("id", serviceId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return { success: false, error: "Servicio no encontrado" };
        }
        throw error;
      }

      const duration = Date.now() - startTime;
      logger.info("Servicio obtenido por ID", {
        service_id: serviceId,
        service_name: data.name,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: {
          ...data,
          conscious_info: {
            benefits: data.metadata?.conscious_benefits,
            preparation: data.metadata?.preparation_instructions,
            aftercare: data.metadata?.aftercare_instructions,
            philosophy_alignment: this._calculatePhilosophyAlignment(data),
          },
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error obteniendo servicio por ID", error, {
        service_id: serviceId,
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }

  async searchAdvanced(filters = {}, options = {}) {
    const startTime = Date.now();
    const {
      limit = 50,
      offset = 0,
      sortBy = "name",
      sortOrder = "asc",
    } = options;

    try {
      let query = supabase.from(this.tableName).select("*");

      // Aplicar filtros
      if (filters.category && this.validCategories.includes(filters.category)) {
        query = query.eq("category", filters.category);
      }

      if (filters.is_active !== undefined) {
        query = query.eq("is_active", filters.is_active);
      }

      if (filters.min_price) {
        query = query.gte("price", filters.min_price);
      }

      if (filters.max_price) {
        query = query.lte("price", filters.max_price);
      }

      if (filters.search_text) {
        query = query.or(
          `name.ilike.%${filters.search_text}%,description.ilike.%${filters.search_text}%`
        );
      }

      // Aplicar ordenamiento y paginación
      const ascending = sortOrder === "asc";
      query = query
        .order(sortBy, { ascending })
        .range(offset, offset + limit - 1);

      const { data, error } = await query;
      if (error) throw error;

      // Agregar información consciente a cada servicio
      const servicesWithConsciousInfo = data.map((service) => ({
        ...service,
        conscious_info: {
          benefits: service.metadata?.conscious_benefits,
          preparation: service.metadata?.preparation_instructions,
          aftercare: service.metadata?.aftercare_instructions,
          philosophy_alignment: this._calculatePhilosophyAlignment(service),
        },
      }));

      const duration = Date.now() - startTime;
      logger.info("Búsqueda avanzada de servicios completada", {
        filtersApplied: Object.keys(filters).length,
        resultsCount: data.length,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: servicesWithConsciousInfo,
        pagination: {
          limit,
          offset,
          count: data.length,
        },
        filters,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Error en búsqueda avanzada de servicios", error, {
        filters: Object.keys(filters),
        duration: `${duration}ms`,
      });
      return { success: false, error: error.message };
    }
  }
}

module.exports = ServiceModel;
