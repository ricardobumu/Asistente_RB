// scripts/checkMyServices.js
// Verificar servicios reales de Ricardo

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const { supabaseClient } = require("../src/integrations/supabaseClient");

async function checkServices() {
  try {
    console.log("🔍 VERIFICANDO SERVICIOS DE RICARDO BURITICÁ");
    console.log("===========================================\n");

    const { data, error } = await supabaseClient
      .from("servicios")
      .select("*")
      .eq("activo", true)
      .order("nombre");

    if (error) throw error;

    if (data && data.length > 0) {
      console.log("✅ SERVICIOS ENCONTRADOS:");
      data.forEach((service, index) => {
        console.log(`${index + 1}. ${service.nombre}`);
        console.log(`   - Duración: ${service.duracion} minutos`);
        console.log(`   - Precio: €${service.precio}`);
        console.log(`   - ID: ${service.id_servicio}`);
        if (service.descripcion) {
          console.log(`   - Descripción: ${service.descripcion}`);
        }
        if (service.categoria) {
          console.log(`   - Categoría: ${service.categoria}`);
        }
        console.log("");
      });

      console.log(`📊 Total de servicios activos: ${data.length}`);
    } else {
      console.log("❌ NO HAY SERVICIOS CONFIGURADOS");
      console.log("💡 Ejecuta: npm run setup para inicializar servicios");
    }
  } catch (error) {
    console.error("❌ Error al verificar servicios:", error.message);
  }
}

checkServices();
