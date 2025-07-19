/**
 * CREAR TABLAS FALTANTES EN SUPABASE
 * Script para crear solo las tablas que faltan, sin afectar las existentes
 */

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const { createClient } = require("@supabase/supabase-js");

console.log("🔧 CREANDO TABLAS FALTANTES EN SUPABASE\n");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// SQL para crear las tablas faltantes
const createTablesSQL = {
  whatsapp_conversations: `
    CREATE TABLE IF NOT EXISTS whatsapp_conversations (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      phone_number VARCHAR(20) NOT NULL,
      message_in TEXT NOT NULL,
      message_out TEXT,
      processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      tokens_used INTEGER DEFAULT 0,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Índices para optimizar consultas
    CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone ON whatsapp_conversations(phone_number);
    CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_processed_at ON whatsapp_conversations(processed_at);
  `,

  calendly_events: `
    CREATE TABLE IF NOT EXISTS calendly_events (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      event_uri VARCHAR(500) NOT NULL UNIQUE,
      event_type VARCHAR(100) NOT NULL,
      invitee_name VARCHAR(200),
      invitee_email VARCHAR(200),
      invitee_phone VARCHAR(20),
      event_start_time TIMESTAMP WITH TIME ZONE,
      event_end_time TIMESTAMP WITH TIME ZONE,
      event_name VARCHAR(300),
      questions_and_answers JSONB DEFAULT '[]',
      notification_sent BOOLEAN DEFAULT FALSE,
      ai_message_generated BOOLEAN DEFAULT FALSE,
      ai_message TEXT,
      tokens_used INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Índices para optimizar consultas
    CREATE INDEX IF NOT EXISTS idx_calendly_events_phone ON calendly_events(invitee_phone);
    CREATE INDEX IF NOT EXISTS idx_calendly_events_start_time ON calendly_events(event_start_time);
    CREATE INDEX IF NOT EXISTS idx_calendly_events_type ON calendly_events(event_type);
  `,

  audit_logs: `
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      action VARCHAR(100) NOT NULL,
      resource VARCHAR(100) NOT NULL,
      resource_id VARCHAR(100),
      user_id VARCHAR(100),
      ip_address INET,
      user_agent TEXT,
      details JSONB DEFAULT '{}',
      success BOOLEAN DEFAULT TRUE,
      error_message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Índices para optimizar consultas
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
  `,
};

async function createMissingTables() {
  const results = {
    success: [],
    errors: [],
    skipped: [],
  };

  for (const [tableName, sql] of Object.entries(createTablesSQL)) {
    try {
      console.log(`🔧 Creando tabla: ${tableName}`);

      // Ejecutar SQL usando rpc (función personalizada en Supabase)
      const { data, error } = await supabase.rpc("exec_sql", {
        sql_query: sql,
      });

      if (error) {
        // Si no existe la función exec_sql, intentamos crear la tabla de otra forma
        if (error.message.includes("function exec_sql")) {
          console.log(
            `   ⚠️  Función exec_sql no disponible, usando método alternativo`
          );

          // Método alternativo: usar el cliente admin si está disponible
          console.log(
            `   ℹ️  Tabla ${tableName} debe crearse manualmente en Supabase Dashboard`
          );
          results.skipped.push({
            table: tableName,
            reason: "Requiere creación manual en Dashboard",
          });
        } else {
          console.log(`   ❌ Error: ${error.message}`);
          results.errors.push({
            table: tableName,
            error: error.message,
          });
        }
      } else {
        console.log(`   ✅ Tabla ${tableName} creada exitosamente`);
        results.success.push(tableName);
      }
    } catch (err) {
      console.log(`   ❌ Excepción: ${err.message}`);
      results.errors.push({
        table: tableName,
        error: err.message,
      });
    }
  }

  return results;
}

async function main() {
  try {
    console.log("📋 TABLAS A CREAR:");
    Object.keys(createTablesSQL).forEach((table) => {
      console.log(`   • ${table}`);
    });
    console.log("");

    const results = await createMissingTables();

    console.log("\n" + "=".repeat(60));
    console.log("📊 RESUMEN DE CREACIÓN DE TABLAS");
    console.log("=".repeat(60));

    if (results.success.length > 0) {
      console.log(
        `\n✅ TABLAS CREADAS EXITOSAMENTE (${results.success.length}):`
      );
      results.success.forEach((table) => {
        console.log(`   ✅ ${table}`);
      });
    }

    if (results.skipped.length > 0) {
      console.log(
        `\n⚠️  TABLAS QUE REQUIEREN CREACIÓN MANUAL (${results.skipped.length}):`
      );
      results.skipped.forEach(({ table, reason }) => {
        console.log(`   ⚠️  ${table}: ${reason}`);
      });
    }

    if (results.errors.length > 0) {
      console.log(`\n❌ ERRORES (${results.errors.length}):`);
      results.errors.forEach(({ table, error }) => {
        console.log(`   ❌ ${table}: ${error}`);
      });
    }

    console.log("\n" + "=".repeat(60));

    if (results.success.length > 0) {
      console.log("🎉 ALGUNAS TABLAS FUERON CREADAS");
      console.log("💡 SIGUIENTE PASO: Verificar estado actualizado");
    } else if (results.skipped.length > 0) {
      console.log("📋 INSTRUCCIONES PARA CREACIÓN MANUAL:");
      console.log("");
      console.log("1. Ve a tu Dashboard de Supabase");
      console.log('2. Navega a "SQL Editor"');
      console.log("3. Ejecuta los siguientes comandos SQL:");
      console.log("");

      Object.entries(createTablesSQL).forEach(([tableName, sql]) => {
        console.log(`-- Tabla: ${tableName}`);
        console.log(sql.trim());
        console.log("");
      });
    }

    console.log("=".repeat(60));
  } catch (error) {
    console.log("\n❌ ERROR GENERAL:", error.message);
  }
}

main();
