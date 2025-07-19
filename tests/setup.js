/**
 * CONFIGURACIÓN DE TESTS
 * Setup global para la suite de testing
 */

// Cargar variables de entorno para testing
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

// Mock de console para tests silenciosos
const originalConsole = console;
global.mockConsole = () => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  console.info = jest.fn();
};

global.restoreConsole = () => {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
};

// Configuración de base de datos de test
process.env.NODE_ENV = "test";
