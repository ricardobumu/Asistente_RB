// ecosystem.config.js
// Configuración de PM2 para producción con clustering y monitoreo

module.exports = {
  apps: [
    {
      // Aplicación principal con clustering
      name: "asistente-rb-api",
      script: "./src/server.js",
      instances: "max", // Usar todos los cores disponibles
      exec_mode: "cluster",

      // Variables de entorno
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        LOG_LEVEL: "info",
      },

      // Configuración de memoria y CPU
      max_memory_restart: "1G",
      min_uptime: "10s",
      max_restarts: 10,

      // Configuración de logs
      log_file: "./logs/combined.log",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      // Configuración de clustering
      listen_timeout: 8000,
      kill_timeout: 5000,

      // Configuración de monitoreo
      monitoring: true,
      pmx: true,

      // Configuración de autorestart
      watch: false, // Deshabilitado en producción
      ignore_watch: ["node_modules", "logs", "uploads"],

      // Configuración de cron jobs
      cron_restart: "0 2 * * *", // Reiniciar a las 2 AM diariamente

      // Variables específicas de producción
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
        LOG_LEVEL: "warn",
        ENABLE_CLUSTERING: "true",
        CACHE_ENABLED: "true",
        COMPRESSION_ENABLED: "true",
      },

      // Variables de desarrollo
      env_development: {
        NODE_ENV: "development",
        PORT: 3000,
        LOG_LEVEL: "debug",
        ENABLE_CLUSTERING: "false",
        CACHE_ENABLED: "false",
      },

      // Variables de staging
      env_staging: {
        NODE_ENV: "staging",
        PORT: 3000,
        LOG_LEVEL: "info",
        ENABLE_CLUSTERING: "true",
        CACHE_ENABLED: "true",
      },
    },

    {
      // Worker para tareas en background
      name: "asistente-rb-worker",
      script: "./src/workers/backgroundWorker.js",
      instances: 2,
      exec_mode: "cluster",

      env: {
        NODE_ENV: "production",
        WORKER_TYPE: "background",
      },

      max_memory_restart: "512M",
      min_uptime: "10s",
      max_restarts: 5,

      log_file: "./logs/worker.log",
      error_file: "./logs/worker-error.log",

      cron_restart: "0 3 * * *", // Reiniciar a las 3 AM
    },

    {
      // Worker para notificaciones
      name: "asistente-rb-notifications",
      script: "./src/workers/notificationWorker.js",
      instances: 1,
      exec_mode: "fork",

      env: {
        NODE_ENV: "production",
        WORKER_TYPE: "notifications",
      },

      max_memory_restart: "256M",
      min_uptime: "5s",
      max_restarts: 10,

      log_file: "./logs/notifications.log",
      error_file: "./logs/notifications-error.log",
    },

    {
      // Worker para limpieza y mantenimiento
      name: "asistente-rb-maintenance",
      script: "./src/workers/maintenanceWorker.js",
      instances: 1,
      exec_mode: "fork",

      env: {
        NODE_ENV: "production",
        WORKER_TYPE: "maintenance",
      },

      max_memory_restart: "128M",
      cron_restart: "0 4 * * *", // Reiniciar a las 4 AM

      log_file: "./logs/maintenance.log",
      error_file: "./logs/maintenance-error.log",
    },
  ],

  // Configuración de deployment
  deploy: {
    production: {
      user: "deploy",
      host: ["production-server-1", "production-server-2"],
      ref: "origin/main",
      repo: "git@github.com:usuario/asistente-rb.git",
      path: "/var/www/asistente-rb",

      "pre-deploy-local": "",
      "post-deploy":
        "npm install && npm run build && pm2 reload ecosystem.config.js --env production",
      "pre-setup": "",

      env: {
        NODE_ENV: "production",
      },
    },

    staging: {
      user: "deploy",
      host: "staging-server",
      ref: "origin/develop",
      repo: "git@github.com:usuario/asistente-rb.git",
      path: "/var/www/asistente-rb-staging",

      "post-deploy":
        "npm install && pm2 reload ecosystem.config.js --env staging",

      env: {
        NODE_ENV: "staging",
      },
    },
  },
};
