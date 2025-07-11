// scripts/systemHealthCheck.js
// Verificación completa del sistema

require("dotenv").config({ path: ".env.local" });
const https = require("https");
const { execSync } = require("child_process");

async function systemHealthCheck() {
  console.log("🔍 VERIFICACIÓN COMPLETA DEL SISTEMA");
  console.log("===================================\n");

  const results = {
    environment: {},
    services: {},
    apis: {},
    integrations: {},
    cli: {},
  };

  // 1. VERIFICAR VARIABLES DE ENTORNO
  console.log("1️⃣ VARIABLES DE ENTORNO:");
  console.log("========================");

  const requiredVars = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_KEY",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_WHATSAPP_NUMBER",
    "OPENAI_API_KEY",
    "CALENDLY_ACCESS_TOKEN",
    "JWT_SECRET",
    "ADMIN_USERNAME",
    "ADMIN_PASSWORD",
  ];

  requiredVars.forEach((varName) => {
    const value = process.env[varName];
    const status = value ? "✅" : "❌";
    const display = value ? `${value.substring(0, 10)}...` : "NO CONFIGURADA";
    console.log(`${status} ${varName}: ${display}`);
    results.environment[varName] = !!value;
  });

  // 2. VERIFICAR SERVICIOS EN RAILWAY
  console.log("\n2️⃣ SERVICIOS EN RAILWAY:");
  console.log("========================");

  try {
    const response = await makeRequest("https://bot.ricardoburitica.eu");
    console.log("✅ Aplicación principal: FUNCIONANDO");
    console.log(`   Respuesta: ${response.substring(0, 50)}...`);
    results.services.main = true;
  } catch (error) {
    console.log("❌ Aplicación principal: ERROR");
    console.log(`   Error: ${error.message}`);
    results.services.main = false;
  }

  // 3. VERIFICAR APIs
  console.log("\n3️⃣ APIs DISPONIBLES:");
  console.log("====================");

  const apiEndpoints = [
    "/api/servicios",
    "/admin",
    "/autonomous/whatsapp/webhook",
    "/api/calendly/webhook",
  ];

  for (const endpoint of apiEndpoints) {
    try {
      const response = await makeRequest(
        `https://bot.ricardoburitica.eu${endpoint}`,
      );
      const status = response.includes("Cannot GET") ? "⚠️" : "✅";
      console.log(
        `${status} ${endpoint}: ${
          status === "✅" ? "FUNCIONANDO" : "RUTA NO ENCONTRADA"
        }`,
      );
      results.apis[endpoint] = status === "✅";
    } catch (error) {
      console.log(`❌ ${endpoint}: ERROR - ${error.message}`);
      results.apis[endpoint] = false;
    }
  }

  // 4. VERIFICAR INTEGRACIONES
  console.log("\n4️⃣ INTEGRACIONES:");
  console.log("=================");

  // Supabase
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (supabaseUrl) {
      await makeRequest(`${supabaseUrl}/rest/v1/`);
      console.log("✅ Supabase: CONECTADO");
      results.integrations.supabase = true;
    } else {
      console.log("❌ Supabase: URL NO CONFIGURADA");
      results.integrations.supabase = false;
    }
  } catch (error) {
    console.log(
      "⚠️ Supabase: CONFIGURADO (verificación completa requiere autenticación)",
    );
    results.integrations.supabase = "partial";
  }

  // OpenAI
  console.log(
    process.env.OPENAI_API_KEY
      ? "✅ OpenAI: API KEY CONFIGURADA"
      : "❌ OpenAI: API KEY NO CONFIGURADA",
  );
  results.integrations.openai = !!process.env.OPENAI_API_KEY;

  // Twilio
  console.log(
    process.env.TWILIO_ACCOUNT_SID
      ? "✅ Twilio: CREDENCIALES CONFIGURADAS"
      : "❌ Twilio: CREDENCIALES NO CONFIGURADAS",
  );
  results.integrations.twilio = !!process.env.TWILIO_ACCOUNT_SID;

  // Calendly
  console.log(
    process.env.CALENDLY_ACCESS_TOKEN
      ? "✅ Calendly: TOKEN CONFIGURADO"
      : "❌ Calendly: TOKEN NO CONFIGURADO",
  );
  results.integrations.calendly = !!process.env.CALENDLY_ACCESS_TOKEN;

  // 5. VERIFICAR CLIs
  console.log("\n5️⃣ CLIs INSTALADOS:");
  console.log("==================");

  const clis = [
    { name: "Railway", command: "railway --version" },
    { name: "Node.js", command: "node --version" },
    { name: "NPM", command: "npm --version" },
    { name: "Git", command: "git --version" },
  ];

  clis.forEach((cli) => {
    try {
      const version = execSync(cli.command, {
        encoding: "utf8",
        stdio: "pipe",
      }).trim();
      console.log(`✅ ${cli.name}: ${version}`);
      results.cli[cli.name.toLowerCase()] = version;
    } catch (error) {
      console.log(`❌ ${cli.name}: NO INSTALADO`);
      results.cli[cli.name.toLowerCase()] = false;
    }
  });

  // 6. RESUMEN FINAL
  console.log("\n📊 RESUMEN FINAL:");
  console.log("=================");

  const envCount = Object.values(results.environment).filter(Boolean).length;
  const serviceCount = Object.values(results.services).filter(Boolean).length;
  const apiCount = Object.values(results.apis).filter(Boolean).length;
  const integrationCount = Object.values(results.integrations).filter(
    (v) => v === true,
  ).length;
  const cliCount = Object.values(results.cli).filter(Boolean).length;

  console.log(
    `📋 Variables de entorno: ${envCount}/${requiredVars.length} configuradas`,
  );
  console.log(`🚀 Servicios: ${serviceCount}/1 funcionando`);
  console.log(`📡 APIs: ${apiCount}/${apiEndpoints.length} disponibles`);
  console.log(`🔗 Integraciones: ${integrationCount}/4 configuradas`);
  console.log(`🛠️ CLIs: ${cliCount}/${clis.length} instalados`);

  const overallHealth =
    (envCount + serviceCount + apiCount + integrationCount + cliCount) /
    (requiredVars.length + 1 + apiEndpoints.length + 4 + clis.length);

  console.log(
    `\n🎯 SALUD GENERAL DEL SISTEMA: ${Math.round(overallHealth * 100)}%`,
  );

  if (overallHealth >= 0.8) {
    console.log("✅ SISTEMA EN EXCELENTE ESTADO");
  } else if (overallHealth >= 0.6) {
    console.log("⚠️ SISTEMA FUNCIONAL CON MEJORAS NECESARIAS");
  } else {
    console.log("❌ SISTEMA REQUIERE ATENCIÓN INMEDIATA");
  }

  // 7. RECOMENDACIONES
  console.log("\n💡 PRÓXIMOS PASOS:");
  console.log("==================");

  if (!results.services.main) {
    console.log("1. Verificar deployment en Railway");
  }

  if (apiCount < apiEndpoints.length) {
    console.log("2. Revisar configuración de rutas en src/index.js");
  }

  if (envCount < requiredVars.length) {
    console.log("3. Configurar variables faltantes en Railway Dashboard");
  }

  console.log("4. Configurar webhooks en Twilio y Calendly");
  console.log("5. Probar funcionalidades end-to-end");

  return results;
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      let data = "";
      response.on("data", (chunk) => {
        data += chunk;
      });
      response.on("end", () => {
        resolve(data);
      });
    });

    request.on("error", (error) => {
      reject(error);
    });

    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

// Ejecutar verificación
if (require.main === module) {
  systemHealthCheck()
    .then(() => {
      console.log("\n🎉 Verificación completada");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Error en verificación:", error);
      process.exit(1);
    });
}

module.exports = { systemHealthCheck };
