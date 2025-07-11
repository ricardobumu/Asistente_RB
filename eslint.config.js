// eslint.config.js
import globals from "globals";
import pluginJs from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended"; // Importamos la integración de Prettier

export default [
  // Configuración global para todo el proyecto (Node.js por defecto)
  {
    // Aplica a todos los archivos JavaScript/TypeScript por defecto
    files: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"],
    languageOptions: {
      ecmaVersion: "latest", // Permite la sintaxis más reciente de JavaScript
      sourceType: "module", // Habilita import/export
      globals: {
        ...globals.node, // Variables globales de Node.js (console, process, etc.)
        // Si tu proyecto usa variables globales de navegador (ej. para código en "public"), puedes añadir:
        // ...globals.browser,
      },
    },
    // Aquí puedes añadir o sobrescribir reglas específicas
    rules: {
      // Por ejemplo, para que las variables no usadas sean una advertencia en lugar de un error:
      "no-unused-vars": "warn",
      // Otros ejemplos (descomenta si los necesitas):
      // "no-console": "warn", // Advertir sobre console.log
      // "indent": ["error", 2], // Forzar indentación de 2 espacios (Prettier ya maneja esto, pero puedes forzarlo)
    },
  },

  // Usa las configuraciones recomendadas de ESLint base y Prettier
  pluginJs.configs.recommended, // Reglas recomendadas para JavaScript
  eslintPluginPrettierRecommended, // Reglas de Prettier para integrar con ESLint

  // Si tienes archivos TypeScript y quieres reglas específicas para ellos, puedes añadir:
  // {
  //   files: ["**/*.ts", "**/*.tsx"],
  //   parser: "@typescript-eslint/parser",
  //   plugins: ["@typescript-eslint"],
  //   extends: [
  //     "plugin:@typescript-eslint/recommended",
  //   ],
  //   rules: {
  //     // Reglas específicas para TypeScript aquí, por ejemplo:
  //     // "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
  //   },
  // },

  // Asegúrate de que Prettier funcione correctamente sin conflictos de salto de línea
  {
    rules: {
      "prettier/prettier": [
        "error",
        {
          endOfLine: "auto", // Importante para compatibilidad entre sistemas operativos (Windows/Linux/Mac)
        },
      ],
    },
  },
];
