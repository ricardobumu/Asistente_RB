// src/integrations/supabaseAdmin.js
const { createClient } = require("@supabase/supabase-js");

// Cliente administrativo con service_role key para operaciones privilegiadas
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error(
    "SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridas para el cliente administrativo",
  );
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = supabaseAdmin;
