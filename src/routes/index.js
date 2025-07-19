/**
 * RUTAS PRINCIPALES CON LAZY LOADING
 *
 * Sistema de carga perezosa para rutas del servidor
 * Mejora el tiempo de arranque cargando rutas solo cuando se necesitan
 */

const express = require("express");
const logger = require("../utils/logger");

/**
 * Cache de rutas cargadas para evitar recargas
 */
const routeCache = new Map();

/**
 * Crea un middleware de lazy loading para rutas con manejo robusto de errores
 */
function createLazyRoute(routePath, routeFile) {
  return (req, res, next) => {
    try {
      // Verificar si la ruta ya está en caché
      if (routeCache.has(routeFile)) {
        const cachedRoute = routeCache.get(routeFile);
        if (cachedRoute === null) {
          // Ruta marcada como fallida, devolver error
          return res.status(503).json({
            error: `Servicio ${routePath} no disponible`,
            message: "Ruta no pudo ser inicializada correctamente",
          });
        }
        return cachedRoute(req, res, next);
      }

      // Intentar cargar la ruta por primera vez
      let routeHandler;

      try {
        // Limpiar caché de require para forzar recarga
        const fullPath = require.resolve(routeFile);
        delete require.cache[fullPath];

        routeHandler = require(routeFile);
      } catch (loadError) {
        // Marcar como fallida en caché
        routeCache.set(routeFile, null);

        logger.warn(`Ruta ${routePath} no pudo ser cargada`, {
          error: loadError.message,
          routeFile,
          url: req.url,
        });

        return res.status(503).json({
          error: `Servicio ${routePath} no disponible`,
          message: "Servicio en mantenimiento o configuración pendiente",
          details:
            process.env.NODE_ENV === "development"
              ? loadError.message
              : undefined,
        });
      }

      // Validar que es un router de Express válido
      if (
        routeHandler &&
        typeof routeHandler === "object" &&
        routeHandler.handle
      ) {
        // Es un router de Express
        routeCache.set(routeFile, routeHandler);
        logger.info(`Ruta ${routePath} cargada exitosamente`, {
          type: "express-router",
        });
        return routeHandler(req, res, next);
      } else if (typeof routeHandler === "function") {
        // Es una función middleware
        routeCache.set(routeFile, routeHandler);
        logger.info(`Ruta ${routePath} cargada exitosamente`, {
          type: "function",
        });
        return routeHandler(req, res, next);
      } else {
        // Tipo inválido, marcar como fallida
        routeCache.set(routeFile, null);

        logger.error(`Ruta ${routePath} exporta tipo inválido`, {
          type: typeof routeHandler,
          routeFile,
        });

        return res.status(500).json({
          error: `Configuración inválida para ${routePath}`,
          message: "Tipo de exportación no válido",
        });
      }
    } catch (error) {
      logger.error(`Error crítico en lazy loading de ${routePath}`, {
        error: error.message,
        stack: error.stack,
        routeFile,
        url: req.url,
        method: req.method,
      });

      res.status(500).json({
        error: `Error interno en ${routePath}`,
        message: "Error no manejado en carga de ruta",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  };
}

/**
 * Configuración de rutas con lazy loading (compatible con estructura existente)
 */
function setupRoutes(app) {
  // Rutas de webhook (críticas) - Compatible con app.js existente
  app.use(
    "/webhook/whatsapp",
    createLazyRoute("/webhook/whatsapp", "./whatsappRoutes")
  );
  app.use(
    "/api/calendly",
    createLazyRoute("/api/calendly", "./calendlyWebhookRoutes")
  );

  // Rutas administrativas
  app.use("/admin", createLazyRoute("/admin", "./adminRoutes"));
  app.use(
    "/api/admin",
    createLazyRoute("/api/admin", "./adminAppointmentRoutes")
  );

  // Rutas de clientes y servicios
  app.use("/client", createLazyRoute("/client", "./clientPortalRoutes"));
  app.use(
    "/api/services",
    createLazyRoute("/api/services", "./adaptedServiceRoutes")
  );

  // Rutas de widgets y citas
  app.use("/api/widgets", createLazyRoute("/api/widgets", "./widgetRoutes"));
  app.use(
    "/api/widget",
    createLazyRoute("/api/widget", "./appointmentWidgetRoutes")
  );

  // Rutas de integración
  app.use(
    "/api/calendar",
    createLazyRoute("/api/calendar", "./googleCalendarRoutes")
  );
  app.use(
    "/api/whatsapp",
    createLazyRoute("/api/whatsapp", "./autonomousWhatsAppRoutes")
  );

  // Rutas de cumplimiento y auditoría
  app.use("/api/gdpr", createLazyRoute("/api/gdpr", "./gdprRoutes"));
  app.use("/api/audit", createLazyRoute("/api/audit", "./auditRoutes"));

  // Rutas de testing (solo en desarrollo)
  if (process.env.NODE_ENV === "development") {
    app.use("/api/test", createLazyRoute("/api/test", "./pipedreamTestRoutes"));
  }

  console.log(
    "✅ Rutas configuradas con lazy loading (compatible con estructura existente)"
  );
}

/**
 * Rutas básicas que se cargan inmediatamente
 */
function setupImmediateRoutes(app) {
  // Health check mejorado
  app.get("/health", (req, res) => {
    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      version: process.env.APP_VERSION || "1.0.0",
      routes: {
        webhook: "/webhook/*",
        api: "/api/*",
        admin: "/admin",
        health: "/health",
      },
    });
  });

  // API health check
  app.get("/api/health", (req, res) => {
    res.json({
      api: "OK",
      timestamp: new Date().toISOString(),
      endpoints: [
        "/api/admin",
        "/api/bookings",
        "/api/clients",
        "/api/services",
        "/api/widgets",
        "/api/calendar",
        "/api/gdpr",
        "/api/audit",
        "/api/whatsapp",
      ],
    });
  });

  // Información de rutas disponibles
  app.get("/routes", (req, res) => {
    res.json({
      webhooks: ["/webhook/whatsapp", "/webhook/calendly"],
      api: [
        "/api/health",
        "/api/admin",
        "/api/bookings",
        "/api/clients",
        "/api/services",
        "/api/widgets",
        "/api/calendar",
        "/api/gdpr",
        "/api/audit",
        "/api/whatsapp",
      ],
      static: ["/admin", "/public"],
      system: ["/health", "/config/status", "/config/refresh"],
    });
  });

  console.log("✅ Rutas inmediatas configuradas");
}

/**
 * Funciones de gestión del caché de rutas
 */
function clearRouteCache() {
  const size = routeCache.size;
  routeCache.clear();
  console.log(`🗑️  Caché de rutas limpiado (${size} entradas)`);
  return size;
}

function getRouteCacheStats() {
  const stats = {
    total: routeCache.size,
    loaded: 0,
    failed: 0,
    routes: [],
  };

  for (const [routeFile, handler] of routeCache.entries()) {
    if (handler === null) {
      stats.failed++;
      stats.routes.push({ file: routeFile, status: "failed" });
    } else {
      stats.loaded++;
      stats.routes.push({
        file: routeFile,
        status: "loaded",
        type: typeof handler === "function" ? "function" : "express-router",
      });
    }
  }

  return stats;
}

function preloadCriticalRoutes() {
  const criticalRoutes = [
    { path: "/webhook/whatsapp", file: "./whatsappRoutes" },
    { path: "/api/calendly", file: "./calendlyWebhookRoutes" },
  ];

  console.log("🔄 Precargando rutas críticas...");

  criticalRoutes.forEach(({ path, file }) => {
    try {
      const routeHandler = require(file);
      if (
        routeHandler &&
        (typeof routeHandler === "object" || typeof routeHandler === "function")
      ) {
        routeCache.set(file, routeHandler);
        console.log(`✅ Ruta crítica precargada: ${path}`);
      }
    } catch (error) {
      console.log(
        `⚠️  No se pudo precargar ruta crítica ${path}: ${error.message}`
      );
      routeCache.set(file, null);
    }
  });
}

module.exports = {
  setupRoutes,
  setupImmediateRoutes,
  createLazyRoute,
  clearRouteCache,
  getRouteCacheStats,
  preloadCriticalRoutes,
};
