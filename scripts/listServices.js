// scripts/listServices.js
require("dotenv").config();
const supabase = require("../src/integrations/supabaseClient");

async function listServices() {
  try {
    console.log("📋 Listando todos los servicios en la base de datos...");

    const { data: services, error } = await supabase
      .from("servicios")
      .select("*")
      .order("categoria", { ascending: true })
      .order("precio", { ascending: true });

    if (error) {
      console.error("❌ Error obteniendo servicios:", error);
      return;
    }

    console.log(`\n✅ Total de servicios encontrados: ${services.length}\n`);

    // Agrupar por categoría
    const servicesByCategory = services.reduce((acc, service) => {
      if (!acc[service.categoria]) {
        acc[service.categoria] = [];
      }
      acc[service.categoria].push(service);
      return acc;
    }, {});

    // Mostrar servicios por categoría
    Object.entries(servicesByCategory).forEach(([categoria, servicios]) => {
      console.log(`\n🏷️  CATEGORÍA: ${categoria.toUpperCase()}`);
      console.log("─".repeat(50));

      servicios.forEach((servicio) => {
        console.log(`📌 ${servicio.nombre}`);
        console.log(`   💰 Precio: $${servicio.precio}`);
        console.log(`   ⏱️  Duración: ${servicio.duracion} minutos`);
        console.log(
          `   📝 Descripción: ${servicio.descripcion || "Sin descripción"}`
        );
        console.log(
          `   🔗 URL Reserva: ${servicio.url_reserva || "No disponible"}`
        );
        console.log(`   ✅ Activo: ${servicio.activo ? "Sí" : "No"}`);
        console.log(`   🆔 ID: ${servicio.id_servicio}`);
        console.log("");
      });
    });

    // Estadísticas rápidas
    const stats = {
      total: services.length,
      activos: services.filter((s) => s.activo).length,
      inactivos: services.filter((s) => !s.activo).length,
      precioPromedio:
        services.reduce((sum, s) => sum + parseFloat(s.precio), 0) /
        services.length,
      duracionPromedio:
        services.reduce((sum, s) => sum + s.duracion, 0) / services.length,
    };

    console.log("\n📊 ESTADÍSTICAS RÁPIDAS");
    console.log("─".repeat(30));
    console.log(`Total de servicios: ${stats.total}`);
    console.log(`Servicios activos: ${stats.activos}`);
    console.log(`Servicios inactivos: ${stats.inactivos}`);
    console.log(`Precio promedio: $${stats.precioPromedio.toFixed(2)}`);
    console.log(
      `Duración promedio: ${stats.duracionPromedio.toFixed(0)} minutos`
    );
  } catch (error) {
    console.error("💥 Error general:", error);
  }
}

listServices();
