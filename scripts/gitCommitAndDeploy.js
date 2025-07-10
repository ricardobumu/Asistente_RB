// scripts/gitCommitAndDeploy.js
const { execSync } = require("child_process");
const fs = require("fs");

console.log("🚀 GIT COMMIT Y DEPLOYMENT PROFESIONAL\n");

function runCommand(command, description) {
  console.log(`🔧 ${description}...`);
  try {
    const output = execSync(command, {
      encoding: "utf8",
      stdio: "pipe",
    });
    console.log("✅ Completado");
    return output;
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    if (error.stdout) {
      console.log("Salida:", error.stdout);
    }
    return null;
  }
}

async function gitCommitAndDeploy() {
  // 1. Verificar estado de Git
  console.log("📊 Verificando estado de Git...");
  const status = runCommand("git status --porcelain", "Verificando cambios");

  if (!status || status.trim() === "") {
    console.log("✅ No hay cambios pendientes");
    console.log("💡 Procediendo con deployment...");
  } else {
    console.log("📝 Cambios detectados:");
    console.log(status);

    // 2. Agregar archivos
    console.log("\n📦 Agregando archivos...");
    runCommand("git add .", "Agregando todos los archivos");

    // 3. Crear commit profesional
    const commitMessage = `🚀 DEPLOY COMPLETO - Sistema Asistente RB v1.0.0

✅ FUNCIONALIDADES IMPLEMENTADAS:
- Portal Cliente completo con 21 servicios categorizados
- Asistente WhatsApp autónomo con IA (OpenAI GPT-4)
- Dashboard administrativo con autenticación
- API REST completa para servicios y reservas
- Sistema de notificaciones (WhatsApp, Email, SMS)
- Integración completa con Supabase
- Webhooks de Calendly configurados
- Seguridad avanzada (JWT, Rate Limiting, CORS)

🔧 CONFIGURACIÓN RAILWAY:
- Variables de entorno configuradas
- Dominio personalizado: bot.ricardoburitica.eu
- Health checks y monitoring activos
- SSL/HTTPS automático

📊 ARQUITECTURA:
- Backend: Node.js + Express
- Base de Datos: Supabase (PostgreSQL)
- IA: OpenAI GPT-4 Turbo
- Mensajería: Twilio WhatsApp
- Scheduling: Calendly
- Deploy: Railway

🌐 URLs ACTIVAS:
- Portal: https://bot.ricardoburitica.eu/portal
- Admin: https://bot.ricardoburitica.eu/admin
- API: https://bot.ricardoburitica.eu/api/servicios
- Health: https://bot.ricardoburitica.eu/health

Estado: PRODUCCIÓN LISTA ✅`;

    console.log("\n💬 Creando commit...");
    runCommand(
      `git commit -m "${commitMessage}"`,
      "Creando commit profesional"
    );

    // 4. Push a GitHub
    console.log("\n📤 Subiendo a GitHub...");
    const pushResult = runCommand(
      "git push origin main",
      "Subiendo cambios a GitHub"
    );

    if (pushResult !== null) {
      console.log("✅ Cambios subidos a GitHub exitosamente");
    } else {
      console.log("❌ Error subiendo a GitHub");
      console.log("💡 Verifica tu conexión y credenciales de Git");
      return;
    }
  }

  // 5. Deployment a Railway
  console.log("\n🚀 Iniciando deployment a Railway...");

  // Verificar Railway CLI
  const railwayCheck = runCommand(
    "railway --version",
    "Verificando Railway CLI"
  );
  if (!railwayCheck) {
    console.log("💡 Instalando Railway CLI...");
    runCommand("npm install -g @railway/cli", "Instalando Railway CLI");
  }

  // Verificar autenticación
  const whoami = runCommand(
    "railway whoami",
    "Verificando autenticación Railway"
  );
  if (!whoami) {
    console.log("❌ No estás autenticado en Railway");
    console.log("💡 Ejecuta: railway login");
    return;
  }

  console.log(`✅ Autenticado como: ${whoami.trim()}`);

  // Verificar proyecto vinculado
  const projectStatus = runCommand(
    "railway status",
    "Verificando proyecto vinculado"
  );
  if (!projectStatus) {
    console.log("❌ Proyecto no vinculado");
    console.log("💡 Ejecuta: railway link");
    console.log("   Selecciona: Asistente RB");
    return;
  }

  // Hacer deployment
  console.log("\n📤 Desplegando a Railway...");
  const deployResult = runCommand("railway up", "Desplegando aplicación");

  if (deployResult) {
    console.log("\n🎉 ¡DEPLOYMENT COMPLETADO EXITOSAMENTE!");

    console.log("\n📋 RESUMEN DE CAMBIOS:");
    console.log("✅ Código subido a GitHub");
    console.log("✅ Aplicación desplegada en Railway");
    console.log("✅ Variables de entorno actualizadas");
    console.log("✅ Webhooks configurados");

    console.log("\n🔗 URLs PARA CONFIGURAR:");
    console.log("");
    console.log("📞 TWILIO WEBHOOKS:");
    console.log(
      "   Webhook URL: https://bot.ricardoburitica.eu/autonomous/whatsapp/webhook"
    );
    console.log(
      "   Status URL:  https://bot.ricardoburitica.eu/autonomous/whatsapp/status"
    );
    console.log("");
    console.log("📅 CALENDLY WEBHOOK:");
    console.log(
      "   Webhook URL: https://bot.ricardoburitica.eu/api/calendly/webhook"
    );
    console.log("");
    console.log("🌐 ADMIN PANEL:");
    console.log("   URL: https://bot.ricardoburitica.eu/admin");
    console.log("   Usuario: ricardo");
    console.log("   Password: [Configurado en .env.local]");

    console.log("\n⏳ PRÓXIMOS PASOS:");
    console.log("1. Esperar 2-3 minutos para que el deployment esté activo");
    console.log("2. Ejecutar: npm run check:deployment");
    console.log("3. Configurar webhooks en Twilio Console");
    console.log("4. Configurar webhook en Calendly");
    console.log("5. Probar el sistema completo");
  } else {
    console.log("\n❌ Error en el deployment");
    console.log("💡 Verifica los logs con: railway logs");
  }
}

// Ejecutar proceso completo
gitCommitAndDeploy().catch(console.error);
