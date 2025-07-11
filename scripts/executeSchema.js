// scripts/executeSchema.js
// Ejecutar esquema de base de datos automáticamente en Supabase

// Cargar variables de entorno de forma segura
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Cliente con service_role para operaciones administrativas
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

async function executeSchema() {
  try {
    console.log("🚀 Iniciando ejecución de esquema de base de datos...\n");

    // Leer archivo de esquema
    const schemaPath = path.join(__dirname, "database_schema_secure.sql");
    const schemaSQL = fs.readFileSync(schemaPath, "utf8");

    console.log("📋 Ejecutando esquema principal...");

    // Dividir el SQL en statements individuales
    const statements = schemaSQL
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ";";

      // Saltar comentarios y líneas vacías
      if (statement.startsWith("--") || statement.trim() === ";") {
        continue;
      }

      try {
        console.log(`⚡ Ejecutando statement ${i + 1}/${statements.length}...`);

        const { data, error } = await supabaseAdmin.rpc("exec_sql", {
          sql: statement,
        });

        if (error) {
          console.error(`❌ Error en statement ${i + 1}:`, error.message);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`💥 Error ejecutando statement ${i + 1}:`, err.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Resumen de ejecución:`);
    console.log(`✅ Statements exitosos: ${successCount}`);
    console.log(`❌ Statements con error: ${errorCount}`);

    // Verificar que las tablas se crearon correctamente
    console.log("\n🔍 Verificando tablas creadas...");

    const tablesToCheck = [
      "users",
      "clients",
      "services",
      "bookings",
      "notifications",
      "activity_logs",
    ];

    for (const table of tablesToCheck) {
      try {
        const { data, error } = await supabaseAdmin
          .from(table)
          .select("count", { count: "exact", head: true });

        if (error) {
          console.log(`❌ Tabla '${table}': ${error.message}`);
        } else {
          console.log(`✅ Tabla '${table}': Creada correctamente`);
        }
      } catch (err) {
        console.log(`❌ Error verificando tabla '${table}':`, err.message);
      }
    }

    console.log("\n🎉 Esquema de base de datos ejecutado!");
  } catch (error) {
    console.error("💥 Error general ejecutando esquema:", error.message);
  }
}

// Función alternativa usando SQL directo
async function executeSchemaAlternative() {
  try {
    console.log("🚀 Ejecutando esquema con método alternativo...\n");

    // Crear extensiones
    console.log("📦 Creando extensiones...");

    const extensions = [
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
      'CREATE EXTENSION IF NOT EXISTS "pgcrypto";',
    ];

    for (const ext of extensions) {
      try {
        const { error } = await supabaseAdmin.rpc("exec_sql", { sql: ext });
        if (error) {
          console.log(`⚠️ Extensión: ${error.message}`);
        } else {
          console.log(`✅ Extensión creada`);
        }
      } catch (err) {
        console.log(`⚠️ Error con extensión: ${err.message}`);
      }
    }

    // Crear tipos ENUM
    console.log("\n🏷️ Creando tipos ENUM...");

    const enums = [
      `DO $$ BEGIN
        CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending_verification');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`,

      `DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'manager', 'supervisor', 'staff', 'receptionist', 'therapist', 'trainee');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`,

      `DO $$ BEGIN
        CREATE TYPE client_status AS ENUM ('active', 'inactive', 'suspended', 'pending_verification', 'blocked');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`,

      `DO $$ BEGIN
        CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`,

      `DO $$ BEGIN
        CREATE TYPE notification_type AS ENUM ('booking_confirmation', 'booking_reminder', 'booking_cancellation', 'system_alert', 'promotional', 'security_alert');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`,

      `DO $$ BEGIN
        CREATE TYPE service_category AS ENUM ('consultation', 'therapy', 'treatment', 'assessment', 'follow_up', 'emergency');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`,
    ];

    for (const enumSQL of enums) {
      try {
        const { error } = await supabaseAdmin.rpc("exec_sql", { sql: enumSQL });
        if (error) {
          console.log(`⚠️ ENUM: ${error.message}`);
        } else {
          console.log(`✅ ENUM creado`);
        }
      } catch (err) {
        console.log(`⚠️ Error con ENUM: ${err.message}`);
      }
    }

    console.log(
      "\n✅ Esquema básico ejecutado. Verificando tablas existentes...",
    );

    // Verificar tablas
    const tablesToCheck = [
      "users",
      "clients",
      "services",
      "bookings",
      "notifications",
    ];

    for (const table of tablesToCheck) {
      try {
        const { data, error } = await supabaseAdmin
          .from(table)
          .select("count", { count: "exact", head: true });

        if (error) {
          console.log(`❌ Tabla '${table}': ${error.message}`);
        } else {
          console.log(`✅ Tabla '${table}': Existe y funcional`);
        }
      } catch (err) {
        console.log(`❌ Error verificando tabla '${table}':`, err.message);
      }
    }
  } catch (error) {
    console.error("💥 Error en método alternativo:", error.message);
  }
}

// Ejecutar
if (require.main === module) {
  executeSchemaAlternative();
}

module.exports = { executeSchema, executeSchemaAlternative };
