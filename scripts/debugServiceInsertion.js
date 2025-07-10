// scripts/debugServiceInsertion.js
require("dotenv").config();
const supabase = require("../src/integrations/supabaseAdmin");

async function debugInsertion() {
  try {
    console.log("🔍 Probando inserción de un servicio de prueba...");

    // Primero, veamos la estructura de la tabla
    const { data: tableInfo, error: infoError } = await supabase
      .from("servicios")
      .select("*")
      .limit(1);

    if (infoError) {
      console.error("❌ Error obteniendo info de tabla:", infoError);
      return;
    }

    console.log("📋 Estructura de tabla servicios:", tableInfo);

    // Intentar insertar un servicio simple (usando la estructura real)
    const testService = {
      nombre: "Servicio de Prueba",
      descripcion: "Servicio de prueba para debug",
      precio: 30.0,
      duracion: 60,
      categoria: "cortes",
      activo: true,
      imagen_url: null,
      url_reserva: null,
    };

    console.log("📝 Intentando insertar:", testService);

    const { data, error } = await supabase
      .from("servicios")
      .insert([testService])
      .select();

    if (error) {
      console.error("❌ Error en inserción:", error);
      console.error("📋 Detalles del error:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
    } else {
      console.log("✅ Inserción exitosa:", data);

      // Limpiar el servicio de prueba
      const { error: deleteError } = await supabase
        .from("servicios")
        .delete()
        .eq("id_servicio", data[0].id_servicio);

      if (deleteError) {
        console.error("⚠️ Error eliminando servicio de prueba:", deleteError);
      } else {
        console.log("🧹 Servicio de prueba eliminado");
      }
    }
  } catch (error) {
    console.error("💥 Error general:", error);
  }
}

debugInsertion();
