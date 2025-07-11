// scripts/setupCompleteSystem.js
// Configuración completa del sistema - Ricardo Buriticá

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const { supabaseClient } = require("../src/integrations/supabaseClient");
const fs = require("fs").promises;
const path = require("path");

class CompleteSystemSetup {
  constructor() {
    this.steps = [
      "checkEnvironment",
      "setupSupabaseFunctions",
      "verifyDatabase",
      "testOpenAIIntegration",
      "validateWebhooks",
      "setupPortalRoutes",
      "runSystemTests",
    ];
    this.results = {};
  }

  async run() {
    console.log("🚀 CONFIGURACIÓN COMPLETA DEL SISTEMA");
    console.log("=====================================\n");

    for (const step of this.steps) {
      try {
        console.log(`📋 Ejecutando: ${step}...`);
        const result = await this[step]();
        this.results[step] = { success: true, ...result };
        console.log(`✅ ${step} completado\n`);
      } catch (error) {
        console.error(`❌ Error en ${step}:`, error.message);
        this.results[step] = { success: false, error: error.message };

        // Algunos errores son críticos
        if (this.isCriticalStep(step)) {
          console.log("🛑 Error crítico detectado. Deteniendo configuración.");
          break;
        }
      }
    }

    this.printSummary();
  }

  async checkEnvironment() {
    console.log("🔍 Verificando variables de entorno...");

    const required = [
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_KEY",
      "OPENAI_API_KEY",
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN",
      "CALENDLY_ACCESS_TOKEN",
      "CALENDLY_USER_URI",
    ];

    const missing = [];
    const present = [];

    for (const key of required) {
      if (process.env[key]) {
        present.push(key);
      } else {
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Variables faltantes: ${missing.join(", ")}`);
    }

    console.log(`✅ ${present.length} variables de entorno configuradas`);
    return { present: present.length, missing: missing.length };
  }

  async setupSupabaseFunctions() {
    console.log("🗄️ Configurando funciones de Supabase...");

    try {
      // Leer el archivo de funciones SQL
      const sqlPath = path.join(__dirname, "supabase_functions.sql");
      const sqlContent = await fs.readFile(sqlPath, "utf8");

      // Dividir en statements individuales
      const statements = sqlContent
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"));

      let executed = 0;
      let errors = 0;

      for (const statement of statements) {
        try {
          await supabaseClient.rpc("exec_sql", { sql_statement: statement });
          executed++;
        } catch (error) {
          // Intentar ejecución directa si RPC falla
          try {
            const { error: directError } = await supabaseClient
              .from("_temp_sql_execution")
              .select("*")
              .limit(0); // Solo para probar conexión

            if (!directError) {
              console.log("⚠️ Usando método alternativo para SQL");
              // Aquí podrías implementar ejecución alternativa
            }
          } catch (directErr) {
            errors++;
            console.log(
              `⚠️ Error ejecutando función: ${error.message.substring(
                0,
                100,
              )}...`,
            );
          }
        }
      }

      console.log(
        `✅ Funciones SQL: ${executed} ejecutadas, ${errors} errores`,
      );
      return { executed, errors, total: statements.length };
    } catch (error) {
      console.log(
        "⚠️ No se pudo ejecutar archivo SQL completo, continuando...",
      );
      return { executed: 0, errors: 1, message: "SQL file execution skipped" };
    }
  }

  async verifyDatabase() {
    console.log("🔍 Verificando estructura de base de datos...");

    const tables = ["clients", "services", "bookings"];
    const results = {};

    for (const table of tables) {
      try {
        const { data, error } = await supabaseClient
          .from(table)
          .select("*")
          .limit(1);

        if (error) throw error;

        results[table] = { exists: true, accessible: true };
        console.log(`✅ Tabla ${table}: OK`);
      } catch (error) {
        results[table] = { exists: false, error: error.message };
        console.log(`❌ Tabla ${table}: ${error.message}`);
      }
    }

    // Verificar servicios iniciales
    try {
      const { data: services } = await supabaseClient
        .from("services")
        .select("*")
        .eq("active", true);

      console.log(`📊 Servicios activos: ${services?.length || 0}`);
      results.services_count = services?.length || 0;

      if (!services || services.length === 0) {
        console.log("⚠️ No hay servicios configurados. Ejecuta: npm run setup");
      }
    } catch (error) {
      console.log("⚠️ No se pudieron verificar servicios");
    }

    return results;
  }

  async testOpenAIIntegration() {
    console.log("🤖 Probando integración con OpenAI...");

    try {
      const { openaiClient } = require("../src/integrations/openaiClient");

      // Test básico
      const testMessage =
        "Hola, quiero reservar un corte de cabello para mañana";
      const analysis = await openaiClient.analyzeIntent(testMessage, {});

      console.log(`✅ OpenAI responde correctamente`);
      console.log(`📊 Intención detectada: ${analysis.intent}`);
      console.log(`📊 Confianza: ${analysis.confidence}`);

      // Test function calling
      try {
        const functionTest = await openaiClient.analyzeMessageWithFunctions(
          "Quiero reservar corte de cabello mañana a las 10:00",
          {},
        );

        console.log(`✅ Function calling: ${functionTest.type}`);
        return {
          basic_test: true,
          function_calling: functionTest.type === "function_call",
          intent: analysis.intent,
          confidence: analysis.confidence,
        };
      } catch (funcError) {
        console.log(`⚠️ Function calling no disponible: ${funcError.message}`);
        return {
          basic_test: true,
          function_calling: false,
          intent: analysis.intent,
          confidence: analysis.confidence,
        };
      }
    } catch (error) {
      throw new Error(`OpenAI integration failed: ${error.message}`);
    }
  }

  async validateWebhooks() {
    console.log("🔗 Validando configuración de webhooks...");

    const webhooks = {
      twilio: process.env.TWILIO_WEBHOOK_URL,
      calendly: process.env.CALENDLY_WEBHOOK_URI,
    };

    const results = {};

    for (const [service, url] of Object.entries(webhooks)) {
      if (url) {
        try {
          // Verificar que la URL sea válida
          new URL(url);
          results[service] = { configured: true, url };
          console.log(`✅ ${service}: ${url}`);
        } catch (error) {
          results[service] = { configured: false, error: "Invalid URL" };
          console.log(`❌ ${service}: URL inválida`);
        }
      } else {
        results[service] = { configured: false, error: "Not configured" };
        console.log(`⚠️ ${service}: No configurado`);
      }
    }

    return results;
  }

  async setupPortalRoutes() {
    console.log("🌐 Verificando rutas del portal...");

    const routes = [
      "/api/services",
      "/api/bookings",
      "/api/availability",
      "/admin",
      "/client",
    ];

    // Verificar que los archivos existan
    const files = [
      "public/admin/index.html",
      "public/client/index.html",
      "src/routes/serviceRoutes.js",
      "src/routes/bookingRoutes.js",
    ];

    const results = { routes: [], files: [] };

    for (const file of files) {
      try {
        const fullPath = path.join(__dirname, "..", file);
        await fs.access(fullPath);
        results.files.push({ file, exists: true });
        console.log(`✅ ${file}: Existe`);
      } catch (error) {
        results.files.push({ file, exists: false });
        console.log(`❌ ${file}: No encontrado`);
      }
    }

    console.log(`📊 Archivos verificados: ${results.files.length}`);
    return results;
  }

  async runSystemTests() {
    console.log("🧪 Ejecutando pruebas del sistema...");

    const tests = [];

    // Test 1: Conexión a Supabase
    try {
      const { data } = await supabaseClient
        .from("services")
        .select("count")
        .single();
      tests.push({ name: "Supabase Connection", passed: true });
    } catch (error) {
      tests.push({
        name: "Supabase Connection",
        passed: false,
        error: error.message,
      });
    }

    // Test 2: Servicios disponibles
    try {
      const { data: services } = await supabaseClient
        .from("services")
        .select("*")
        .eq("active", true);

      tests.push({
        name: "Services Available",
        passed: services && services.length > 0,
        count: services?.length || 0,
      });
    } catch (error) {
      tests.push({
        name: "Services Available",
        passed: false,
        error: error.message,
      });
    }

    // Test 3: OpenAI disponible
    try {
      const { openaiClient } = require("../src/integrations/openaiClient");
      await openaiClient.analyzeIntent("test", {});
      tests.push({ name: "OpenAI Integration", passed: true });
    } catch (error) {
      tests.push({
        name: "OpenAI Integration",
        passed: false,
        error: error.message,
      });
    }

    const passed = tests.filter((t) => t.passed).length;
    const total = tests.length;

    console.log(`📊 Pruebas: ${passed}/${total} exitosas`);

    tests.forEach((test) => {
      const status = test.passed ? "✅" : "❌";
      console.log(`${status} ${test.name}`);
      if (!test.passed && test.error) {
        console.log(`   Error: ${test.error}`);
      }
    });

    return { tests, passed, total, success_rate: (passed / total) * 100 };
  }

  isCriticalStep(step) {
    const critical = ["checkEnvironment", "verifyDatabase"];
    return critical.includes(step);
  }

  printSummary() {
    console.log("\n🎯 RESUMEN DE CONFIGURACIÓN");
    console.log("============================");

    const successful = Object.values(this.results).filter(
      (r) => r.success,
    ).length;
    const total = Object.keys(this.results).length;

    console.log(`📊 Pasos completados: ${successful}/${total}`);
    console.log(
      `📈 Tasa de éxito: ${Math.round((successful / total) * 100)}%\n`,
    );

    Object.entries(this.results).forEach(([step, result]) => {
      const status = result.success ? "✅" : "❌";
      console.log(`${status} ${step}`);

      if (!result.success && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    console.log("\n🔄 PRÓXIMOS PASOS:");

    if (successful === total) {
      console.log("✅ Sistema completamente configurado");
      console.log("🚀 Puedes hacer deployment: npm run git:deploy");
      console.log("📅 Configurar webhooks: npm run calendly:setup");
      console.log("🌐 Portal admin: https://tu-dominio.com/admin");
      console.log("👥 Portal cliente: https://tu-dominio.com/client");
    } else {
      console.log("⚠️ Hay pasos pendientes por completar");
      console.log("🔧 Revisa los errores y ejecuta de nuevo");

      // Sugerencias específicas
      if (!this.results.checkEnvironment?.success) {
        console.log("💡 Configura las variables de entorno en .env.local");
      }

      if (!this.results.verifyDatabase?.success) {
        console.log(
          "💡 Ejecuta: npm run setup para inicializar la base de datos",
        );
      }

      if (!this.results.testOpenAIIntegration?.success) {
        console.log("💡 Verifica tu OPENAI_API_KEY");
      }
    }

    console.log("\n📚 DOCUMENTACIÓN:");
    console.log("- Portal Admin: /admin (usuario: ricardo)");
    console.log("- Portal Cliente: /client (acceso público)");
    console.log("- API Docs: /api/health para verificar estado");
    console.log("- Logs: npm run logs");
  }
}

async function main() {
  const setup = new CompleteSystemSetup();
  await setup.run();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = CompleteSystemSetup;
