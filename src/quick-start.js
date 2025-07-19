/**
 * ARRANQUE RÁPIDO DEL SERVIDOR
 *
 * Inicia el servidor sin validaciones lentas
 * Usa configuración cacheada para acceso inmediato
 */

const express = require("express");
const cors = require("cors");
const { ConfigCache } = require("./config/config-cache");
const { ConfigManager } = require("./config/integrations");
const logger = require("./utils/logger");

// Configuración express básica
const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Configuración básica de middleware
 */
function setupBasicMiddleware() {
  // CORS
  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGINS?.split(",") || [
        "http://localhost:3000",
      ],
      credentials: true,
    })
  );

  // Body parsing
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Headers de seguridad básicos
  app.use((req, res, next) => {
    res.header("X-Content-Type-Options", "nosniff");
    res.header("X-Frame-Options", "DENY");
    res.header("X-XSS-Protection", "1; mode=block");
    next();
  });
}

/**
 * Rutas básicas de salud
 */
function setupHealthRoutes() {
  // Health check básico
  app.get("/health", (req, res) => {
    const cacheStats = ConfigCache.getStats();
    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      cache: cacheStats,
      environment: process.env.NODE_ENV || "development",
    });
  });

  // Status de configuración
  app.get("/config/status", (req, res) => {
    const cachedConfig = ConfigCache.load();
    res.json({
      valid: cachedConfig.valid,
      services: Object.keys(cachedConfig.services || {}),
      lastValidation: new Date(cachedConfig.lastValidation || 0).toISOString(),
      fromCache: true,
    });
  });

  // Endpoint para refrescar configuración
  app.post("/config/refresh", (req, res) => {
    try {
      const refreshed = ConfigCache.refresh();
      res.json({
        success: true,
        message: "Configuración refrescada",
        timestamp: new Date().toISOString(),
        services: Object.keys(refreshed.services || {}),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Diagnóstico de rutas
  app.get("/routes/status", (req, res) => {
    const { getRouteCacheStats } = require("./routes");
    const stats = getRouteCacheStats();
    res.json({
      ...stats,
      timestamp: new Date().toISOString(),
      lazyLoading: true,
    });
  });

  // Limpiar caché de rutas
  app.post("/routes/clear-cache", (req, res) => {
    const { clearRouteCache } = require("./routes");
    const cleared = clearRouteCache();
    res.json({
      success: true,
      message: `Caché de rutas limpiado`,
      routesCleared: cleared,
      timestamp: new Date().toISOString(),
    });
  });

  // Precargar rutas críticas
  app.post("/routes/preload", (req, res) => {
    try {
      const { preloadCriticalRoutes } = require("./routes");
      preloadCriticalRoutes();
      res.json({
        success: true,
        message: "Rutas críticas precargadas",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });
}

/**
 * Carga rutas principales de forma lazy
 */
function setupMainRoutes() {
  // Importar sistema de rutas
  const { setupRoutes, setupImmediateRoutes } = require("./routes");

  // Configurar rutas inmediatas (health, etc.)
  setupImmediateRoutes(app);

  // Configurar rutas con lazy loading
  setupRoutes(app);

  // Dashboard administrativo
  app.use("/admin", express.static("public/admin"));

  // Archivos estáticos
  app.use("/public", express.static("public"));
}

/**
 * Manejo de errores básico
 */
function setupErrorHandling() {
  // 404
  app.use("*", (req, res) => {
    res.status(404).json({
      error: "Endpoint no encontrado",
      path: req.originalUrl,
      method: req.method,
    });
  });

  // Error handler
  app.use((error, req, res, next) => {
    logger.error("Error no manejado", {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
    });

    res.status(500).json({
      error: "Error interno del servidor",
      timestamp: new Date().toISOString(),
    });
  });
}

/**
 * Inicialización rápida
 */
async function quickStart() {
  try {
    console.log("🚀 Iniciando servidor en modo rápido...");

    // Verificar configuración desde caché
    const configValid = ConfigManager.quickInit();

    if (!configValid.valid) {
      console.error("❌ Configuración crítica inválida");
      process.exit(1);
    }

    // Configurar middleware básico
    setupBasicMiddleware();
    console.log("✅ Middleware básico configurado");

    // Configurar rutas de salud
    setupHealthRoutes();
    console.log("✅ Rutas de salud configuradas");

    // Configurar rutas principales (lazy loading)
    setupMainRoutes();
    console.log("✅ Rutas principales configuradas (lazy loading)");

    // Configurar manejo de errores
    setupErrorHandling();
    console.log("✅ Manejo de errores configurado");

    // Iniciar servidor
    const server = app.listen(PORT, () => {
      console.log(`🎉 Servidor iniciado en puerto ${PORT}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
      console.log(`📊 Config status: http://localhost:${PORT}/config/status`);
      console.log(`⚡ Tiempo de arranque: ${process.uptime().toFixed(2)}s`);

      logger.info("Servidor iniciado correctamente", {
        port: PORT,
        environment: process.env.NODE_ENV,
        startupTime: process.uptime(),
      });
    });

    // Manejo de cierre graceful
    process.on("SIGTERM", () => {
      console.log("🛑 Cerrando servidor...");
      server.close(() => {
        console.log("✅ Servidor cerrado correctamente");
        process.exit(0);
      });
    });

    process.on("SIGINT", () => {
      console.log("🛑 Cerrando servidor...");
      server.close(() => {
        console.log("✅ Servidor cerrado correctamente");
        process.exit(0);
      });
    });

    return server;
  } catch (error) {
    console.error("❌ Error en arranque rápido:", error.message);
    logger.error("Error en arranque rápido", { error: error.message });
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  quickStart();
}

module.exports = { quickStart, app };
