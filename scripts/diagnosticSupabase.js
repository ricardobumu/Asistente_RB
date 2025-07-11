// scripts/diagnosticSupabase.js
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });

const { createClient } = require("@supabase/supabase-js");

async function diagnosticSupabase() {
  console.log("🔍 DIAGNÓSTICO COMPLETO DE SUPABASE\n");

  // Verificar variables de entorno
  console.log("📋 VARIABLES DE ENTORNO:");
  console.log(
    `SUPABASE_URL: ${process.env.SUPABASE_URL ? "✅ Configurada" : "❌ Falta"}`,
  );
  console.log(
    `SUPABASE_ANON_KEY: ${
      process.env.SUPABASE_ANON_KEY ? "✅ Configurada" : "❌ Falta"
    }`,
  );
  console.log(
    `SUPABASE_SERVICE_KEY: ${
      process.env.SUPABASE_SERVICE_KEY ? "✅ Configurada" : "❌ Falta"
    }`,
  );

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.log("❌ Faltan variables de entorno críticas");
    return;
  }

  // Crear clientes con diferentes configuraciones
  console.log("\n🔧 PROBANDO DIFERENTES CONFIGURACIONES DE CLIENTE:\n");

  // 1. Cliente con service_role (admin)
  console.log("1️⃣ CLIENTE ADMIN (service_role):");
  try {
    const adminClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // Probar conexión básica
    const { data: healthCheck, error: healthError } = await adminClient
      .from("users")
      .select("count")
      .limit(1);

    if (healthError) {
      console.log(`   ❌ Error: ${healthError.message}`);
      console.log(`   📊 Código: ${healthError.code}`);
      console.log(`   🔍 Detalles: ${healthError.details}`);
    } else {
      console.log("   ✅ Conexión exitosa con service_role");
    }
  } catch (err) {
    console.log(`   ❌ Error de conexión: ${err.message}`);
  }

  // 2. Cliente con anon key
  console.log("\n2️⃣ CLIENTE ANÓNIMO (anon_key):");
  try {
    const anonClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
    );

    const { data: anonData, error: anonError } = await anonClient
      .from("users")
      .select("count")
      .limit(1);

    if (anonError) {
      console.log(`   ❌ Error: ${anonError.message}`);
      console.log(`   📊 Código: ${anonError.code}`);
    } else {
      console.log("   ✅ Conexión exitosa con anon_key");
    }
  } catch (err) {
    console.log(`   ❌ Error de conexión: ${err.message}`);
  }

  // 3. Verificar tablas específicas
  console.log("\n3️⃣ VERIFICANDO TABLAS ESPECÍFICAS:");
  const adminClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const tables = [
    "users",
    "clients",
    "services",
    "bookings",
    "notifications",
    "whatsapp_conversations",
    "whatsapp_messages",
  ];

  for (const table of tables) {
    try {
      const { data, error } = await adminClient
        .from(table)
        .select("*")
        .limit(1);

      if (error) {
        if (error.code === "42P01") {
          console.log(`   ❌ ${table}: Tabla no existe`);
        } else if (error.code === "42501") {
          console.log(`   🔒 ${table}: RLS bloqueando acceso`);
        } else {
          console.log(`   ⚠️ ${table}: ${error.message} (${error.code})`);
        }
      } else {
        console.log(
          `   ✅ ${table}: Accesible (${data?.length || 0} registros)`,
        );
      }
    } catch (err) {
      console.log(`   ❌ ${table}: ${err.message}`);
    }
  }

  // 4. Probar consulta SQL directa
  console.log("\n4️⃣ CONSULTA SQL DIRECTA:");
  try {
    const { data, error } = await adminClient.rpc("exec_sql", {
      sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;",
    });

    if (error) {
      console.log(`   ❌ Error SQL: ${error.message}`);

      // Intentar método alternativo
      console.log("   🔄 Probando método alternativo...");
      const { data: altData, error: altError } = await adminClient
        .from("information_schema.tables")
        .select("table_name")
        .eq("table_schema", "public");

      if (altError) {
        console.log(`   ❌ Método alternativo falló: ${altError.message}`);
      } else {
        console.log(
          "   ✅ Tablas encontradas:",
          altData?.map((t) => t.table_name),
        );
      }
    } else {
      console.log(
        "   ✅ Tablas en la base de datos:",
        data?.map((t) => t.table_name),
      );
    }
  } catch (err) {
    console.log(`   ❌ Error en consulta SQL: ${err.message}`);
  }

  console.log("\n🎯 RECOMENDACIONES:");
  console.log("1. Verificar que las tablas existan en Supabase Dashboard");
  console.log("2. Verificar políticas RLS en Table Editor");
  console.log("3. Confirmar que service_role tenga permisos completos");
  console.log("4. Revisar logs de Supabase para errores específicos");
}

diagnosticSupabase().catch(console.error);
