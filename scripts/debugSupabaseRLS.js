// scripts/debugSupabaseRLS.js
// Script para diagnosticar problemas de RLS en Supabase

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });

const supabaseClient = require("../src/integrations/supabaseClient");
const { createClient } = require("@supabase/supabase-js");

async function debugSupabaseRLS() {
  console.log("🔍 DIAGNÓSTICO DE POLÍTICAS RLS EN SUPABASE");
  console.log("==========================================\n");

  try {
    // 1. Probar con cliente normal (ANON_KEY)
    console.log("📋 Probando con cliente normal (ANON_KEY)...");

    const { data: servicesAnon, error: errorAnon } = await supabaseClient
      .from("servicios")
      .select("id_servicio, nombre, categoria")
      .limit(3);

    if (errorAnon) {
      console.log("❌ Error con ANON_KEY:", errorAnon.message);
    } else {
      console.log(`✅ Lectura con ANON_KEY: ${servicesAnon.length} servicios`);
    }

    // 2. Intentar actualización con cliente normal
    console.log("\n🔄 Probando actualización con ANON_KEY...");

    if (servicesAnon && servicesAnon.length > 0) {
      const testService = servicesAnon[0];
      const { data: updateData, error: updateError } = await supabaseClient
        .from("servicios")
        .update({ categoria: "TEST_CATEGORIA" })
        .eq("id_servicio", testService.id_servicio)
        .select();

      if (updateError) {
        console.log("❌ Error actualizando con ANON_KEY:", updateError.message);
        console.log("   Código:", updateError.code);
        console.log("   Detalles:", updateError.details);
      } else {
        console.log("✅ Actualización con ANON_KEY exitosa");

        // Revertir cambio
        await supabaseClient
          .from("servicios")
          .update({ categoria: testService.categoria })
          .eq("id_servicio", testService.id_servicio);
      }
    }

    // 3. Probar con SERVICE_KEY si está disponible
    console.log("\n🔑 Probando con SERVICE_KEY...");

    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (serviceKey) {
      const supabaseAdmin = createClient(process.env.SUPABASE_URL, serviceKey);

      const { data: servicesAdmin, error: errorAdmin } = await supabaseAdmin
        .from("servicios")
        .select("id_servicio, nombre, categoria")
        .limit(3);

      if (errorAdmin) {
        console.log("❌ Error con SERVICE_KEY:", errorAdmin.message);
      } else {
        console.log(
          `✅ Lectura con SERVICE_KEY: ${servicesAdmin.length} servicios`
        );

        // Probar actualización con SERVICE_KEY
        if (servicesAdmin.length > 0) {
          const testService = servicesAdmin[0];
          const { data: updateData, error: updateError } = await supabaseAdmin
            .from("servicios")
            .update({ categoria: "TEST_ADMIN" })
            .eq("id_servicio", testService.id_servicio)
            .select();

          if (updateError) {
            console.log(
              "❌ Error actualizando con SERVICE_KEY:",
              updateError.message
            );
          } else {
            console.log("✅ Actualización con SERVICE_KEY exitosa");

            // Revertir cambio
            await supabaseAdmin
              .from("servicios")
              .update({ categoria: testService.categoria })
              .eq("id_servicio", testService.id_servicio);
          }
        }
      }
    } else {
      console.log("⚠️ SERVICE_KEY no encontrada en variables de entorno");
    }

    // 4. Verificar configuración actual
    console.log("\n📊 Configuración actual:");
    console.log(
      "SUPABASE_URL:",
      process.env.SUPABASE_URL ? "✅ Configurada" : "❌ No configurada"
    );
    console.log(
      "SUPABASE_ANON_KEY:",
      process.env.SUPABASE_ANON_KEY ? "✅ Configurada" : "❌ No configurada"
    );
    console.log(
      "SUPABASE_SERVICE_KEY:",
      process.env.SUPABASE_SERVICE_KEY ? "✅ Configurada" : "❌ No configurada"
    );

    // 5. Recomendaciones
    console.log("\n💡 RECOMENDACIONES:");
    console.log(
      "1. Si las actualizaciones fallan con ANON_KEY, usar SERVICE_KEY"
    );
    console.log("2. Verificar políticas RLS en el dashboard de Supabase");
    console.log(
      "3. Considerar deshabilitar RLS temporalmente para operaciones administrativas"
    );
  } catch (error) {
    console.error("❌ Error durante diagnóstico:", error);
  }
}

// Ejecutar
if (require.main === module) {
  debugSupabaseRLS()
    .then(() => {
      console.log("\n✅ Diagnóstico completado");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Error en diagnóstico:", error);
      process.exit(1);
    });
}

module.exports = { debugSupabaseRLS };
