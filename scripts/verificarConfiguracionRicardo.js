// scripts/verificarConfiguracionRicardo.js
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const fs = require("fs");
const path = require("path");

console.log("🔐 VERIFICACIÓN DE CONFIGURACIÓN - RICARDO BURITICÁ\n");

// Verificar archivo .env.local
const envLocalPath = path.join(__dirname, "..", ".env.local");
if (!fs.existsSync(envLocalPath)) {
  console.log("❌ Archivo .env.local no encontrado");
  console.log("💡 Crea el archivo .env.local con tus credenciales reales");
  process.exit(1);
} else {
  console.log("✅ Archivo .env.local encontrado");
}

// Verificar variables críticas
const requiredVars = {
  SUPABASE_URL: "Base de datos (cuenta personal)",
  SUPABASE_ANON_KEY: "Base de datos (cuenta personal)",
  SUPABASE_SERVICE_KEY: "Base de datos (cuenta personal)",
  JWT_SECRET: "Seguridad JWT",
  JWT_REFRESH_SECRET: "Seguridad JWT",
  TWILIO_ACCOUNT_SID: "WhatsApp (cuenta profesional)",
  TWILIO_AUTH_TOKEN: "WhatsApp (cuenta profesional)",
  TWILIO_WHATSAPP_NUMBER: "WhatsApp (cuenta profesional)",
};

const optionalVars = {
  GOOGLE_CALENDAR_CREDENTIALS: "Google Calendar (cuenta profesional)",
  GOOGLE_CALENDAR_ID: "Google Calendar (cuenta profesional)",
  CALENDLY_ACCESS_TOKEN: "Calendly (cuenta profesional)",
  CALENDLY_USER_URI: "Calendly (cuenta profesional)",
  CALENDLY_WEBHOOK_URI: "Tu URI de webhook de Calendly",
  OPENAI_API_KEY: "OpenAI para IA del bot",
  ADMIN_USERNAME: "Panel administrativo",
  ADMIN_PASSWORD: "Panel administrativo",
};

console.log("🔍 VERIFICANDO VARIABLES CRÍTICAS:\n");

let missingRequired = [];
let presentRequired = [];

Object.entries(requiredVars).forEach(([key, description]) => {
  if (process.env[key]) {
    console.log(`✅ ${key} - ${description}`);
    presentRequired.push(key);
  } else {
    console.log(`❌ ${key} - ${description} - FALTANTE`);
    missingRequired.push(key);
  }
});

console.log("\n🔧 VERIFICANDO VARIABLES OPCIONALES:\n");

let presentOptional = [];
let missingOptional = [];

Object.entries(optionalVars).forEach(([key, description]) => {
  if (process.env[key]) {
    console.log(`✅ ${key} - ${description}`);
    presentOptional.push(key);
  } else {
    console.log(`⚠️  ${key} - ${description} - NO CONFIGURADO`);
    missingOptional.push(key);
  }
});

// Verificaciones específicas
console.log("\n🔐 VERIFICACIONES ESPECÍFICAS:\n");

// Verificar longitud de JWT secrets
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 64) {
  console.log("⚠️  JWT_SECRET debería tener al menos 64 caracteres");
} else if (process.env.JWT_SECRET) {
  console.log("✅ JWT_SECRET tiene longitud adecuada");
}

if (
  process.env.JWT_REFRESH_SECRET &&
  process.env.JWT_REFRESH_SECRET.length < 64
) {
  console.log("⚠️  JWT_REFRESH_SECRET debería tener al menos 64 caracteres");
} else if (process.env.JWT_REFRESH_SECRET) {
  console.log("✅ JWT_REFRESH_SECRET tiene longitud adecuada");
}

// Verificar formato de Google Calendar credentials
if (process.env.GOOGLE_CALENDAR_CREDENTIALS) {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_CALENDAR_CREDENTIALS);
    if (credentials.type === "service_account") {
      console.log("✅ Google Calendar credentials tienen formato correcto");
      if (
        credentials.client_email &&
        credentials.client_email.includes("iam.gserviceaccount.com")
      ) {
        console.log("✅ Service Account email válido");
      } else {
        console.log("⚠️  Verificar email de Service Account");
      }
    } else {
      console.log("⚠️  Google Calendar credentials no son de Service Account");
    }
  } catch (error) {
    console.log("❌ Google Calendar credentials no tienen formato JSON válido");
  }
}

// Verificar configuración de cuentas
console.log("\n📧 VERIFICACIÓN DE CUENTAS:\n");

console.log("📋 CONFIGURACIÓN RECOMENDADA:");
console.log("   Personal (ricardobumu@gmail.com):");
console.log("   - GitHub ✓");
console.log("   - Supabase ✓");
console.log("");
console.log("   Profesional (info@ricardoburitica.com):");
console.log("   - Google Calendar (GWS) ✓");
console.log("   - Twilio ✓");
console.log("   - Calendly ✓");
console.log("   - Zencoder.ai ✓");

// Resumen final
console.log("\n📊 RESUMEN DE CONFIGURACIÓN:\n");

console.log(
  `✅ Variables críticas configuradas: ${presentRequired.length}/${
    Object.keys(requiredVars).length
  }`,
);
console.log(
  `🔧 Variables opcionales configuradas: ${presentOptional.length}/${
    Object.keys(optionalVars).length
  }`,
);

if (missingRequired.length > 0) {
  console.log("\n❌ VARIABLES CRÍTICAS FALTANTES:");
  missingRequired.forEach((key) => {
    console.log(`   - ${key}: ${requiredVars[key]}`);
  });
}

if (missingOptional.length > 0) {
  console.log("\n⚠️  VARIABLES OPCIONALES NO CONFIGURADAS:");
  missingOptional.forEach((key) => {
    console.log(`   - ${key}: ${optionalVars[key]}`);
  });
}

// Verificar configuración específica de Ricardo
console.log("\n🎯 CONFIGURACIÓN ESPECÍFICA RICARDO BURITICÁ:\n");

// Google Calendar ID
if (process.env.GOOGLE_CALENDAR_ID) {
  if (process.env.GOOGLE_CALENDAR_ID.includes("info@ricardoburitica.com")) {
    console.log("✅ Google Calendar configurado con cuenta profesional");
  } else if (
    process.env.GOOGLE_CALENDAR_ID.includes("@group.calendar.google.com")
  ) {
    console.log("✅ Google Calendar configurado con calendario específico");
  } else {
    console.log(
      "⚠️  Verificar GOOGLE_CALENDAR_ID - debería ser info@ricardoburitica.com o un calendario específico",
    );
  }
}

// Twilio WhatsApp
if (process.env.TWILIO_WHATSAPP_NUMBER) {
  console.log("✅ Número de WhatsApp configurado");
}

// Calendly webhook URI
if (process.env.CALENDLY_WEBHOOK_URI) {
  console.log("✅ URI de webhook de Calendly configurada");
} else {
  console.log(
    "⚠️  CALENDLY_WEBHOOK_URI no configurada - agrégala a .env.local",
  );
}

// Admin credentials
if (
  process.env.ADMIN_USERNAME === "admin" ||
  process.env.ADMIN_PASSWORD === "admin123"
) {
  console.log("⚠️  IMPORTANTE: Cambiar credenciales de admin por defecto");
} else if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
  console.log("✅ Credenciales de admin personalizadas");
}

console.log("\n🚀 PRÓXIMOS PASOS:\n");

if (missingRequired.length > 0) {
  console.log("1. ❌ Configurar variables críticas faltantes en .env.local");
} else {
  console.log("1. ✅ Variables críticas configuradas");
}

if (!process.env.GOOGLE_CALENDAR_CREDENTIALS) {
  console.log(
    "2. 📅 Configurar Google Calendar Service Account (cuenta profesional)",
  );
} else {
  console.log("2. ✅ Google Calendar configurado");
}

if (!process.env.CALENDLY_WEBHOOK_URI) {
  console.log("3. 🔗 Agregar CALENDLY_WEBHOOK_URI a .env.local");
} else {
  console.log("3. ✅ Calendly webhook URI configurada");
}

console.log("4. 🧪 Ejecutar: npm run test:bookings");
console.log("5. 🔗 Configurar webhooks en Twilio y Calendly");
console.log("6. 🚀 Ejecutar: npm run dev");

console.log(
  "\n📖 Consulta CONFIGURACION_RICARDO_BURITICA.md para detalles específicos",
);
console.log("");
