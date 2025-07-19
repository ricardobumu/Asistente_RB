/**
 * ESTRUCTURA ESPERADA POR EL CÓDIGO
 * Muestra exactamente qué estructura de BD espera tu aplicación
 */

console.log("📋 ESTRUCTURA DE BASE DE DATOS ESPERADA POR TU APLICACIÓN");
console.log("=".repeat(80));

console.log("\n🏢 TABLA: clients");
console.log("   📝 Descripción: Información de clientes");
console.log("   🔧 Campos esperados por el código:");
console.log("      • id (UUID, PRIMARY KEY, auto-generado)");
console.log(
  "      • phone_number (TEXT, UNIQUE, NOT NULL) - Campo principal para identificar clientes"
);
console.log("      • name (TEXT, NULLABLE) - Nombre del cliente");
console.log("      • email (TEXT, NULLABLE) - Email del cliente");
console.log("      • created_at (TIMESTAMP, DEFAULT NOW())");
console.log(
  "      • last_activity (TIMESTAMP, NULLABLE) - Última actividad del cliente"
);
console.log("      • status (TEXT, DEFAULT 'active') - Estado del cliente");

console.log("\n💬 TABLA: conversations");
console.log("   📝 Descripción: Estado de conversaciones de WhatsApp");
console.log("   🔧 Campos esperados por el código:");
console.log("      • id (UUID, PRIMARY KEY, auto-generado)");
console.log(
  "      • phone_number (TEXT, UNIQUE, NOT NULL) - Teléfono del usuario"
);
console.log(
  "      • current_step (TEXT, DEFAULT 'initial') - Paso actual en el flujo"
);
console.log(
  "      • user_data (JSONB, DEFAULT '{}') - Datos del usuario en la conversación"
);
console.log("      • attempts_count (INTEGER, DEFAULT 0) - Número de intentos");
console.log("      • last_updated (TIMESTAMP, DEFAULT NOW())");
console.log(
  "      • language (TEXT, DEFAULT 'es') - Idioma de la conversación"
);
console.log("      • id_cliente (UUID, FOREIGN KEY -> clients.id)");
console.log("      • id_reserva (UUID, NULLABLE) - ID de reserva si existe");
console.log("      • last_message_id (TEXT, NULLABLE) - ID del último mensaje");

console.log("\n📨 TABLA: messages");
console.log("   📝 Descripción: Historial de mensajes");
console.log("   🔧 Campos esperados por el código:");
console.log("      • id (UUID, PRIMARY KEY, auto-generado)");
console.log("      • user_id (TEXT, NOT NULL) - ID del usuario (phone_number)");
console.log("      • content (TEXT, NOT NULL) - Contenido del mensaje");
console.log(
  "      • is_from_user (BOOLEAN, NOT NULL) - Si el mensaje es del usuario"
);
console.log(
  "      • is_encrypted (BOOLEAN, DEFAULT false) - Si está encriptado"
);
console.log("      • timestamp (TIMESTAMP, DEFAULT NOW())");

console.log("\n🛍️ TABLA: services");
console.log("   📝 Descripción: Servicios disponibles");
console.log("   🔧 Campos esperados por el código:");
console.log("      • id (UUID, PRIMARY KEY, auto-generado)");
console.log("      • name (TEXT, NOT NULL) - Nombre del servicio");
console.log("      • description (TEXT, NULLABLE) - Descripción del servicio");
console.log("      • price (DECIMAL, NULLABLE) - Precio del servicio");
console.log("      • duration (INTEGER, NULLABLE) - Duración en minutos");
console.log("      • is_active (BOOLEAN, DEFAULT true) - Si está activo");
console.log("      • created_at (TIMESTAMP, DEFAULT NOW())");

console.log("\n📅 TABLA: appointments");
console.log("   📝 Descripción: Citas programadas");
console.log("   🔧 Campos esperados por el código:");
console.log("      • id (UUID, PRIMARY KEY, auto-generado)");
console.log("      • client_id (UUID, FOREIGN KEY -> clients.id, NOT NULL)");
console.log("      • service_id (UUID, FOREIGN KEY -> services.id, NOT NULL)");
console.log("      • appointment_date (TIMESTAMP, NOT NULL)");
console.log("      • status (TEXT, DEFAULT 'scheduled') - Estado de la cita");
console.log("      • notes (TEXT, NULLABLE) - Notas adicionales");
console.log("      • created_at (TIMESTAMP, DEFAULT NOW())");
console.log("      • updated_at (TIMESTAMP, DEFAULT NOW())");

console.log("\n" + "=".repeat(80));
console.log("🔧 COMANDOS SQL PARA RESTAURAR LA ESTRUCTURA");
console.log("=".repeat(80));

console.log("\n-- 1. TABLA CLIENTS");
console.log(`CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active'
);`);

console.log("\n-- 2. TABLA SERVICES");
console.log(`CREATE TABLE IF NOT EXISTS services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  duration INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`);

console.log("\n-- 3. TABLA APPOINTMENTS");
console.log(`CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) NOT NULL,
  service_id UUID REFERENCES services(id) NOT NULL,
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`);

console.log("\n-- 4. TABLA CONVERSATIONS");
console.log(`CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT UNIQUE NOT NULL,
  current_step TEXT DEFAULT 'initial',
  user_data JSONB DEFAULT '{}',
  attempts_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  language TEXT DEFAULT 'es',
  id_cliente UUID REFERENCES clients(id),
  id_reserva UUID,
  last_message_id TEXT
);`);

console.log("\n-- 5. TABLA MESSAGES");
console.log(`CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  is_from_user BOOLEAN NOT NULL,
  is_encrypted BOOLEAN DEFAULT false,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`);

console.log("\n-- 6. ÍNDICES RECOMENDADOS");
console.log(`CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone_number);
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);`);

console.log("\n" + "=".repeat(80));
console.log("📋 DATOS DE EJEMPLO PARA TESTING");
console.log("=".repeat(80));

console.log("\n-- SERVICIOS DE EJEMPLO");
console.log(`INSERT INTO services (name, description, price, duration, is_active) VALUES
('Consulta General', 'Consulta médica general', 50.00, 30, true),
('Revisión Especializada', 'Revisión con especialista', 80.00, 45, true),
('Análisis Clínicos', 'Análisis de laboratorio', 35.00, 15, true);`);

console.log("\n" + "=".repeat(80));
console.log("🎯 PASOS PARA RESTAURAR EN SUPABASE");
console.log("=".repeat(80));

console.log("\n1. 🌐 Ve a tu proyecto en Supabase Dashboard");
console.log('2. 📊 Ve a la sección "SQL Editor"');
console.log("3. 🗑️  ELIMINA las tablas actuales si están corruptas:");
console.log("   DROP TABLE IF EXISTS appointments CASCADE;");
console.log("   DROP TABLE IF EXISTS conversations CASCADE;");
console.log("   DROP TABLE IF EXISTS messages CASCADE;");
console.log("   DROP TABLE IF EXISTS clients CASCADE;");
console.log("   DROP TABLE IF EXISTS services CASCADE;");
console.log("");
console.log("4. ✅ EJECUTA los comandos CREATE TABLE de arriba EN ORDEN");
console.log("5. 📊 EJECUTA los comandos CREATE INDEX");
console.log("6. 🧪 EJECUTA los INSERT de datos de ejemplo");
console.log(
  '7. 🔒 Ve a "Authentication" > "Policies" y configura RLS si es necesario'
);

console.log("\n" + "=".repeat(80));
console.log("⚠️  IMPORTANTE: CONFIGURACIÓN DE SEGURIDAD");
console.log("=".repeat(80));

console.log("\n-- POLÍTICAS RLS (Row Level Security) BÁSICAS");
console.log("-- Solo si necesitas seguridad a nivel de fila");
console.log(`
-- Habilitar RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Política para permitir operaciones con service_role
CREATE POLICY "Allow service role access" ON clients FOR ALL USING (true);
CREATE POLICY "Allow service role access" ON conversations FOR ALL USING (true);
CREATE POLICY "Allow service role access" ON messages FOR ALL USING (true);
`);

console.log("\n" + "=".repeat(80));
console.log("✅ DESPUÉS DE RESTAURAR, EJECUTA: npm test");
console.log("=".repeat(80));
