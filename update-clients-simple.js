/**
 * SCRIPT SIMPLE DE ACTUALIZACIÓN DE CLIENTES
 *
 * Versión simplificada del script original solicitado,
 * adaptado a la estructura real de la tabla clients en Supabase.
 *
 * Autor: Asistente RB - Ricardo Buriticá Beauty Consulting
 */

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const csv = require("csv-parser");

// Configuración de Supabase usando variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "❌ ERROR: Variables de entorno SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridas"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const results = [];

console.log("🚀 Iniciando actualización de clientes...");

fs.createReadStream("./clientes_RB_simplificado.csv")
  .pipe(csv())
  .on("data", (data) => results.push(data))
  .on("end", async () => {
    console.log(`📊 Total de registros encontrados: ${results.length}`);

    for (const client of results) {
      const { email, full_name, name, last_name, phone } = client;

      if (!email) {
        console.log("⚠️ Ignorando fila sin email");
        continue;
      }

      try {
        // Buscar cliente existente
        const { data: existing, error } = await supabase
          .from("clients")
          .select("id")
          .eq("email", email.toLowerCase().trim())
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("❌ Error buscando cliente:", email, error.message);
          continue;
        }

        if (existing) {
          // Cliente existe - actualizar
          const { error: updateError } = await supabase
            .from("clients")
            .update({
              full_name: full_name?.trim(),
              phone: phone?.replace(/\s+/g, ""),
            })
            .eq("email", email.toLowerCase().trim());

          if (updateError) {
            console.error("❌ Error actualizando:", email, updateError.message);
          } else {
            console.log("🔄 Actualizado:", email);
          }
        } else {
          // Cliente no existe - insertar
          const { error: insertError } = await supabase.from("clients").insert({
            email: email.toLowerCase().trim(),
            full_name: full_name?.trim(),
            phone: phone?.replace(/\s+/g, ""),
            lgpd_accepted: true,
            registration_complete: true,
          });

          if (insertError) {
            console.error("❌ Error insertando:", email, insertError.message);
          } else {
            console.log("✅ Insertado:", email);
          }
        }

        // Pausa pequeña para no sobrecargar la base de datos
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error("❌ Error procesando cliente:", email, error.message);
      }
    }

    console.log("✅ Proceso completado para todos los clientes.");
  })
  .on("error", (error) => {
    console.error("❌ Error leyendo archivo CSV:", error.message);
  });
