#!/usr/bin/env node
// scripts/setup-gdpr.js
// Script para configurar las tablas y datos iniciales de RGPD

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Error: SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridos");
  console.error("Asegúrate de tener configurado el archivo .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupGDPRTables() {
  console.log("🔒 Configurando tablas RGPD...");

  try {
    // Leer el script SQL
    const sqlPath = path.join(__dirname, "create_gdpr_tables.sql");
    const sqlContent = fs.readFileSync(sqlPath, "utf8");

    // Dividir el script en comandos individuales
    const commands = sqlContent
      .split(";")
      .map((cmd) => cmd.trim())
      .filter((cmd) => cmd.length > 0 && !cmd.startsWith("--"));

    console.log(`📝 Ejecutando ${commands.length} comandos SQL...`);

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];

      try {
        // Ejecutar comando SQL
        const { error } = await supabase.rpc("exec_sql", {
          sql_command: command,
        });

        if (error) {
          console.warn(`⚠️  Advertencia en comando ${i + 1}: ${error.message}`);
        } else {
          console.log(`✅ Comando ${i + 1} ejecutado correctamente`);
        }
      } catch (cmdError) {
        console.warn(`⚠️  Error en comando ${i + 1}: ${cmdError.message}`);
      }
    }

    console.log("✅ Configuración de tablas RGPD completada");
  } catch (error) {
    console.error("❌ Error configurando tablas RGPD:", error.message);
    throw error;
  }
}

async function insertInitialData() {
  console.log("📊 Insertando datos iniciales...");

  try {
    // Insertar políticas de retención por defecto
    const retentionPolicies = [
      {
        data_type: "client_data",
        retention_period_days: 1095,
        legal_basis: "legitimate_interest",
        description: "Datos de clientes - 3 años desde última interacción",
        active: true,
      },
      {
        data_type: "booking_data",
        retention_period_days: 2555,
        legal_basis: "legal_obligation",
        description: "Datos de reservas - 7 años por obligación fiscal",
        active: true,
      },
      {
        data_type: "conversation_data",
        retention_period_days: 365,
        legal_basis: "consent",
        description: "Conversaciones de WhatsApp - 1 año",
        active: true,
      },
      {
        data_type: "marketing_data",
        retention_period_days: 730,
        legal_basis: "consent",
        description:
          "Datos de marketing - 2 años o hasta retirada de consentimiento",
        active: true,
      },
      {
        data_type: "analytics_data",
        retention_period_days: 730,
        legal_basis: "legitimate_interest",
        description: "Datos de analytics - 2 años",
        active: true,
      },
    ];

    for (const policy of retentionPolicies) {
      const { error } = await supabase
        .from("data_retention_policies")
        .upsert(policy, { onConflict: "data_type" });

      if (error) {
        console.warn(
          `⚠️  Error insertando política ${policy.data_type}: ${error.message}`
        );
      } else {
        console.log(`✅ Política de retención ${policy.data_type} configurada`);
      }
    }

    console.log("✅ Datos iniciales insertados correctamente");
  } catch (error) {
    console.error("❌ Error insertando datos iniciales:", error.message);
    throw error;
  }
}

async function verifySetup() {
  console.log("🔍 Verificando configuración...");

  try {
    // Verificar que las tablas existen
    const tables = [
      "gdpr_consents",
      "data_access_logs",
      "whatsapp_conversations",
      "disputes",
      "analytics_events",
      "data_retention_policies",
      "data_breach_notifications",
    ];

    for (const table of tables) {
      const { data, error } = await supabase.from(table).select("*").limit(1);

      if (error) {
        console.error(`❌ Error verificando tabla ${table}: ${error.message}`);
      } else {
        console.log(`✅ Tabla ${table} verificada`);
      }
    }

    // Verificar políticas de retención
    const { data: policies, error: policiesError } = await supabase
      .from("data_retention_policies")
      .select("*");

    if (policiesError) {
      console.error(`❌ Error verificando políticas: ${policiesError.message}`);
    } else {
      console.log(`✅ ${policies.length} políticas de retención configuradas`);
    }

    console.log("✅ Verificación completada");
  } catch (error) {
    console.error("❌ Error en verificación:", error.message);
    throw error;
  }
}

async function main() {
  console.log("🚀 Iniciando configuración RGPD...");
  console.log(
    "📋 Este script configurará las tablas y datos necesarios para compliance RGPD"
  );
  console.log("");

  try {
    await setupGDPRTables();
    console.log("");

    await insertInitialData();
    console.log("");

    await verifySetup();
    console.log("");

    console.log("🎉 ¡Configuración RGPD completada exitosamente!");
    console.log("");
    console.log("📋 Próximos pasos:");
    console.log("1. Verificar las variables de entorno RGPD en .env");
    console.log("2. Reiniciar el servidor para activar el worker de limpieza");
    console.log("3. Acceder al panel de admin para verificar el estado RGPD");
    console.log("");
    console.log("🔗 Endpoints disponibles:");
    console.log("- GET /gdpr/privacy-policy - Política de privacidad");
    console.log("- GET /gdpr/cookie-policy - Política de cookies");
    console.log("- POST /gdpr/consent - Registrar consentimiento");
    console.log("- GET /admin/gdpr/stats - Estadísticas RGPD (admin)");
    console.log("");
  } catch (error) {
    console.error("❌ Error en la configuración:", error.message);
    process.exit(1);
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = {
  setupGDPRTables,
  insertInitialData,
  verifySetup,
};
