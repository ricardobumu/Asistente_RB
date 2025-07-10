// scripts/setupWebhooksAndBookings.js
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🚀 CONFIGURACIÓN INICIAL DEL SISTEMA DE RESERVAS Y WEBHOOKS\n");

// Verificar que existe el archivo .env
const envPath = path.join(__dirname, "..", ".env");
if (!fs.existsSync(envPath)) {
  console.log("❌ Archivo .env no encontrado");
  console.log("📋 Copiando .env.example a .env...");

  const envExamplePath = path.join(__dirname, "..", ".env.example");
  fs.copyFileSync(envExamplePath, envPath);

  console.log("✅ Archivo .env creado");
  console.log(
    "⚠️  IMPORTANTE: Edita el archivo .env con tus credenciales antes de continuar\n"
  );
}

// Verificar dependencias
console.log("📦 Verificando dependencias...");
try {
  execSync("npm list googleapis", { stdio: "ignore" });
  console.log("✅ googleapis instalado");
} catch (error) {
  console.log("📦 Instalando googleapis...");
  execSync("npm install googleapis", { stdio: "inherit" });
  console.log("✅ googleapis instalado");
}

// Crear estructura de directorios si no existe
const dirs = ["logs", "uploads", "backups"];

dirs.forEach((dir) => {
  const dirPath = path.join(__dirname, "..", dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Directorio ${dir} creado`);
  }
});

// Mostrar información de configuración
console.log("\n🔗 URLS DE WEBHOOKS PARA CONFIGURAR:");
console.log("");
console.log("📱 TWILIO (WhatsApp):");
console.log(
  "   Webhook URL: https://bot.ricardoburitica.eu/autonomous/whatsapp/webhook"
);
console.log(
  "   Status URL:  https://bot.ricardoburitica.eu/autonomous/whatsapp/status"
);
console.log("");
console.log("📅 CALENDLY:");
console.log(
  "   Webhook URL: https://bot.ricardoburitica.eu/api/calendly/webhook"
);
console.log(
  "   Eventos: invitee.created, invitee.canceled, invitee_no_show.created"
);
console.log("");

// Verificar configuración de Google Calendar
console.log("📅 CONFIGURACIÓN DE GOOGLE CALENDAR:");
console.log("");
console.log("1. Ve a Google Cloud Console: https://console.cloud.google.com/");
console.log("2. Crea un proyecto o selecciona uno existente");
console.log("3. Habilita la Google Calendar API");
console.log("4. Crea una Service Account en IAM & Admin > Service Accounts");
console.log("5. Descarga el archivo JSON de credenciales");
console.log("6. Agrega las credenciales a GOOGLE_CALENDAR_CREDENTIALS en .env");
console.log("7. Comparte tu calendario con el email de la Service Account");
console.log("");

// Mostrar rutas administrativas
console.log("🎛️  PANEL ADMINISTRATIVO:");
console.log("");
console.log("   URL: https://bot.ricardoburitica.eu/admin");
console.log(
  "   Dashboard: https://bot.ricardoburitica.eu/admin/bookings/dashboard"
);
console.log("");
console.log("📊 ENDPOINTS PRINCIPALES:");
console.log("");
console.log("   GET  /admin/bookings/dashboard     - Dashboard principal");
console.log("   GET  /admin/bookings/search        - Buscar reservas");
console.log("   POST /admin/bookings/create        - Crear reserva manual");
console.log("   GET  /admin/bookings/today         - Reservas de hoy");
console.log("   GET  /admin/bookings/upcoming      - Próximas reservas");
console.log(
  "   POST /admin/bookings/sync-calendar - Sincronizar con Google Calendar"
);
console.log("   GET  /admin/bookings/export        - Exportar reservas a CSV");
console.log("");

// Crear archivo de ejemplo para Google Calendar credentials
const credentialsExample = {
  type: "service_account",
  project_id: "tu-proyecto-id",
  private_key_id: "key-id",
  private_key:
    "-----BEGIN PRIVATE KEY-----\\nTU_PRIVATE_KEY\\n-----END PRIVATE KEY-----\\n",
  client_email: "tu-service-account@tu-proyecto.iam.gserviceaccount.com",
  client_id: "client-id",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/tu-service-account%40tu-proyecto.iam.gserviceaccount.com",
};

const credentialsPath = path.join(
  __dirname,
  "..",
  "google-calendar-credentials.example.json"
);
fs.writeFileSync(credentialsPath, JSON.stringify(credentialsExample, null, 2));
console.log(
  "📄 Archivo google-calendar-credentials.example.json creado como referencia"
);
console.log("");

// Mostrar comandos útiles
console.log("🛠️  COMANDOS ÚTILES:");
console.log("");
console.log("   npm run dev                    - Ejecutar en modo desarrollo");
console.log("   npm start                      - Ejecutar en producción");
console.log(
  "   npm run setup                  - Configuración inicial de base de datos"
);
console.log(
  "   curl http://localhost:3000/health - Verificar estado del servidor"
);
console.log("");

console.log("✅ CONFIGURACIÓN INICIAL COMPLETADA");
console.log("");
console.log("📋 PRÓXIMOS PASOS:");
console.log("");
console.log("1. ✏️  Edita el archivo .env con tus credenciales");
console.log("2. 🔑 Configura Google Calendar Service Account");
console.log("3. 🔗 Configura webhooks en Twilio y Calendly");
console.log("4. 🚀 Ejecuta: npm run dev");
console.log("5. 🌐 Accede al panel admin: http://localhost:3000/admin");
console.log("");
console.log(
  "📖 Para más detalles, consulta: CONFIGURACION_WEBHOOKS_Y_RESERVAS.md"
);
console.log("");
