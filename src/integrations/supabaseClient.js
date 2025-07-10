// src/integrations/supabaseClient.js
const { createClient } = require("@supabase/supabase-js");
const path = require("path"); // Mantener si hay otros usos, si no, se puede quitar más tarde.

// Las variables de entorno se cargan globalmente en src/index.js al inicio.
// Por lo tanto, se leen directamente de process.env aquí.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// No se necesitan logs de depuración ni validación aquí porque ya funciona.
// Sin embargo, si en un futuro hubiera un error, podrías volver a activar validaciones o logs.

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

module.exports = supabaseClient;
