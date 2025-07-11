// scripts/migrateClientAuth.js
require("dotenv").config();
const supabase = require("../src/integrations/supabaseClient");
const logger = require("../src/utils/logger");

/**
 * Script de migración para agregar campos de autenticación a la tabla clients
 */

async function migrateClientAuth() {
  try {
    console.log("🔄 Iniciando migración de autenticación para clientes...");

    // Verificar conexión a Supabase
    const { data: testData, error: testError } = await supabase
      .from("clients")
      .select("count", { count: "exact", head: true });

    if (testError) {
      throw new Error(`Error de conexión a Supabase: ${testError.message}`);
    }

    console.log(`✅ Conexión exitosa. Clientes existentes: ${testData || 0}`);

    // SQL para agregar columnas de autenticación
    const migrationSQL = `
      -- Agregar columnas de autenticación si no existen
      DO $$ 
      BEGIN
        -- password_hash para almacenar contraseñas hasheadas
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'clients' AND column_name = 'password_hash') THEN
          ALTER TABLE clients ADD COLUMN password_hash TEXT;
        END IF;

        -- token_version para invalidar tokens antiguos
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'clients' AND column_name = 'token_version') THEN
          ALTER TABLE clients ADD COLUMN token_version INTEGER DEFAULT 1;
        END IF;

        -- email_verified para verificación de email
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'clients' AND column_name = 'email_verified') THEN
          ALTER TABLE clients ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
        END IF;

        -- email_verified_at timestamp de verificación
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'clients' AND column_name = 'email_verified_at') THEN
          ALTER TABLE clients ADD COLUMN email_verified_at TIMESTAMPTZ;
        END IF;

        -- phone_verified para verificación de teléfono
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'clients' AND column_name = 'phone_verified') THEN
          ALTER TABLE clients ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE;
        END IF;

        -- phone_verified_at timestamp de verificación
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'clients' AND column_name = 'phone_verified_at') THEN
          ALTER TABLE clients ADD COLUMN phone_verified_at TIMESTAMPTZ;
        END IF;

        -- last_login para tracking de accesos
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'clients' AND column_name = 'last_login') THEN
          ALTER TABLE clients ADD COLUMN last_login TIMESTAMPTZ;
        END IF;

        -- status para gestión de estados (active, inactive, suspended)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'clients' AND column_name = 'status') THEN
          ALTER TABLE clients ADD COLUMN status TEXT DEFAULT 'active';
        END IF;

        -- suspension_reason para auditoría
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'clients' AND column_name = 'suspension_reason') THEN
          ALTER TABLE clients ADD COLUMN suspension_reason TEXT;
        END IF;

        -- suspended_at timestamp de suspensión
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'clients' AND column_name = 'suspended_at') THEN
          ALTER TABLE clients ADD COLUMN suspended_at TIMESTAMPTZ;
        END IF;

        -- Agregar índices para optimizar consultas
        CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
        CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
        CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
        CREATE INDEX IF NOT EXISTS idx_clients_last_login ON clients(last_login);

        -- Agregar constraint para status válidos
        DO $constraint$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                        WHERE constraint_name = 'clients_status_check') THEN
            ALTER TABLE clients ADD CONSTRAINT clients_status_check 
            CHECK (status IN ('active', 'inactive', 'suspended'));
          END IF;
        END $constraint$;

      END $$;
    `;

    // Ejecutar migración usando RPC (Remote Procedure Call)
    const { data, error } = await supabase.rpc("exec_sql", {
      sql_query: migrationSQL,
    });

    if (error) {
      // Si RPC no está disponible, intentar con una consulta directa
      console.log("⚠️  RPC no disponible, ejecutando migración manual...");

      // Verificar si las columnas ya existen
      const { data: columns, error: columnsError } = await supabase
        .from("information_schema.columns")
        .select("column_name")
        .eq("table_name", "clients");

      if (columnsError) {
        throw new Error(`Error verificando columnas: ${columnsError.message}`);
      }

      const existingColumns = columns.map((col) => col.column_name);
      const requiredColumns = [
        "password_hash",
        "token_version",
        "email_verified",
        "email_verified_at",
        "phone_verified",
        "phone_verified_at",
        "last_login",
        "status",
        "suspension_reason",
        "suspended_at",
      ];

      const missingColumns = requiredColumns.filter(
        (col) => !existingColumns.includes(col),
      );

      if (missingColumns.length > 0) {
        console.log(
          `⚠️  Columnas faltantes detectadas: ${missingColumns.join(", ")}`,
        );
        console.log(
          "📋 Por favor, ejecuta manualmente en Supabase SQL Editor:",
        );
        console.log("\n" + migrationSQL + "\n");
      } else {
        console.log("✅ Todas las columnas de autenticación ya existen");
      }
    } else {
      console.log("✅ Migración ejecutada exitosamente");
    }

    // Verificar que las columnas se crearon correctamente
    const { data: finalCheck, error: finalError } = await supabase
      .from("clients")
      .select("id, email, password_hash, status, token_version")
      .limit(1);

    if (finalError) {
      console.log("⚠️  Verificación final falló:", finalError.message);
    } else {
      console.log(
        "✅ Verificación final exitosa - Estructura de tabla actualizada",
      );
    }

    console.log("\n🎉 Migración completada!");
    console.log("\n📋 Próximos pasos:");
    console.log("1. Generar secretos JWT: npm run generate-secrets");
    console.log("2. Actualizar archivo .env con los secretos");
    console.log("3. Probar endpoints de autenticación");
  } catch (error) {
    console.error("❌ Error en migración:", error.message);
    logger.error("Error en migración de autenticación", error);
    process.exit(1);
  }
}

// Ejecutar migración
if (require.main === module) {
  migrateClientAuth();
}

module.exports = { migrateClientAuth };
