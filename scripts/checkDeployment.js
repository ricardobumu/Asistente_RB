// scripts/checkDeployment.js
const axios = require("axios");

const DOMAIN = "bot.ricardoburitica.eu";
const BASE_URL = `https://${DOMAIN}`;

async function checkDeployment() {
  console.log("🚀 VERIFICANDO ESTADO DEL DEPLOYMENT\n");
  console.log(`🌐 Dominio: ${DOMAIN}`);
  console.log(`🔗 URL Base: ${BASE_URL}\n`);

  // Verificar conectividad básica
  console.log("1. 🔍 Verificando conectividad básica...");
  try {
    const response = await axios.get(BASE_URL, {
      timeout: 10000,
      validateStatus: () => true, // Aceptar cualquier código de estado
    });

    console.log(`   ✅ Respuesta: ${response.status} ${response.statusText}`);

    if (response.status === 404) {
      console.log(
        "   ⚠️  El dominio responde pero no hay aplicación ejecutándose",
      );
    } else if (response.status >= 500) {
      console.log("   ❌ Error del servidor - aplicación con problemas");
    } else if (response.status === 200) {
      console.log("   ✅ Aplicación ejecutándose correctamente");
    }
  } catch (error) {
    if (error.code === "ENOTFOUND") {
      console.log("   ❌ Dominio no encontrado - problema de DNS");
    } else if (error.code === "ECONNREFUSED") {
      console.log("   ❌ Conexión rechazada - servidor no está ejecutándose");
    } else if (error.code === "CERT_HAS_EXPIRED") {
      console.log("   ❌ Certificado SSL expirado");
    } else {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  // Verificar rutas específicas
  console.log("\n2. 🧪 Verificando rutas específicas...");

  const routes = [
    "/health",
    "/api/health",
    "/autonomous/whatsapp/webhook",
    "/autonomous/whatsapp/status",
    "/api/calendly/webhook",
  ];

  for (const route of routes) {
    try {
      const url = `${BASE_URL}${route}`;
      const response = await axios.get(url, {
        timeout: 5000,
        validateStatus: () => true,
      });

      if (response.status === 200) {
        console.log(`   ✅ ${route} - OK (${response.status})`);
      } else if (response.status === 405) {
        console.log(
          `   ✅ ${route} - Method Not Allowed (${response.status}) - Normal para webhooks`,
        );
      } else if (response.status === 404) {
        console.log(`   ❌ ${route} - Not Found (${response.status})`);
      } else {
        console.log(
          `   ⚠️  ${route} - ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      console.log(`   ❌ ${route} - Error: ${error.message}`);
    }
  }

  // Verificar variables de entorno en producción
  console.log("\n3. 🔧 Verificando configuración...");
  try {
    const healthUrl = `${BASE_URL}/health`;
    const response = await axios.get(healthUrl, { timeout: 5000 });

    if (response.data) {
      console.log("   ✅ Health check responde con datos");
      if (response.data.status === "ok") {
        console.log("   ✅ Aplicación saludable");
      }
    }
  } catch (error) {
    console.log("   ❌ No se puede verificar health check");
  }

  console.log("\n📋 DIAGNÓSTICO:\n");

  console.log("🔍 POSIBLES CAUSAS DEL PROBLEMA:");
  console.log("");
  console.log("1. 🚀 DEPLOYMENT NO EJECUTÁNDOSE:");
  console.log("   - La aplicación no está desplegada en Railway");
  console.log("   - El proceso se detuvo por error");
  console.log("   - Falta configuración de variables de entorno");
  console.log("");
  console.log("2. 🔧 CONFIGURACIÓN INCORRECTA:");
  console.log("   - Variables de entorno faltantes en Railway");
  console.log("   - Puerto incorrecto");
  console.log("   - Dominio mal configurado");
  console.log("");
  console.log("3. 🐛 ERRORES EN EL CÓDIGO:");
  console.log("   - Error al iniciar la aplicación");
  console.log("   - Dependencias faltantes");
  console.log("   - Rutas mal configuradas");

  console.log("\n🛠️  SOLUCIONES RECOMENDADAS:\n");

  console.log("1. 📊 VERIFICAR RAILWAY:");
  console.log("   railway status");
  console.log("   railway logs");
  console.log("");
  console.log("2. 🔄 REDEPLOY:");
  console.log("   railway up");
  console.log("");
  console.log("3. 🔧 VERIFICAR VARIABLES:");
  console.log("   railway variables");
  console.log("");
  console.log("4. 🧪 PROBAR LOCALMENTE:");
  console.log("   npm run dev");
  console.log("   curl http://localhost:3000/health");

  console.log("\n📞 URLS PARA TWILIO (una vez solucionado):");
  console.log(`   Webhook: ${BASE_URL}/autonomous/whatsapp/webhook`);
  console.log(`   Status:  ${BASE_URL}/autonomous/whatsapp/status`);
}

checkDeployment().catch(console.error);
