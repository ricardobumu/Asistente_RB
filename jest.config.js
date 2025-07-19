/**
 * CONFIGURACIÓN DE JEST
 * Configuración para la suite de testing
 */

module.exports = {
  // Entorno de testing
  testEnvironment: "node",

  // Archivos de setup
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],

  // Patrones de archivos de test
  testMatch: ["<rootDir>/tests/**/*.test.js", "<rootDir>/tests/**/*.spec.js"],

  // Directorios a ignorar
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/build/",
    "/tests/backup/",
  ],

  // Cobertura de código
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],

  // Archivos para cobertura
  collectCoverageFrom: [
    "controllers/**/*.js",
    "services/**/*.js",
    "routes/**/*.js",
    "utils/**/*.js",
    "!**/node_modules/**",
    "!**/tests/**",
    "!**/coverage/**",
  ],

  // Umbrales de cobertura (reducidos para desarrollo inicial)
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 30,
      lines: 30,
      statements: 30,
    },
  },

  // Timeout para tests
  testTimeout: 30000,

  // Variables de entorno para tests
  setupFiles: ["<rootDir>/tests/setup.js"],

  // Transformaciones
  transform: {
    "^.+\\.js$": "babel-jest",
  },

  // Módulos a transformar
  transformIgnorePatterns: ["/node_modules/(?!(supertest)/)"],

  // Configuración de mocks
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Reportes detallados
  verbose: true,

  // Configuración de reporters
  reporters: [
    "default",
    [
      "jest-html-reporters",
      {
        publicPath: "./coverage/html-report",
        filename: "report.html",
        expand: true,
      },
    ],
  ],
};
