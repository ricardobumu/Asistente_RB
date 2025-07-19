-- =====================================================
-- ESQUEMA REAL DE SUPABASE PARA ASISTENTE RB
-- Basado en la estructura proporcionada por el usuario
-- =====================================================

-- 1. ELIMINAR TABLAS EXISTENTES (si están corruptas)
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS errors CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS services CASCADE;

-- 2. CREAR TABLA CLIENTS (estructura básica)
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  phone_number TEXT UNIQUE NOT NULL,
  name TEXT NULL,
  email TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE NULL,
  status TEXT NULL DEFAULT 'active',
  CONSTRAINT clients_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- 3. CREAR TABLA SERVICES (estructura real proporcionada)
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name CHARACTER VARYING NOT NULL,
  description TEXT NULL,
  price NUMERIC(10, 2) NOT NULL,
  duration INTEGER NOT NULL,
  image_url TEXT NULL,
  calendly_url TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
  category CHARACTER VARYING(255) NULL,
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT timezone('utc'::text, now()),
  calendly_api_id CHARACTER VARYING(255) NULL,
  is_active BOOLEAN NULL DEFAULT true,
  CONSTRAINT servicios_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- 4. CREAR TABLA APPOINTMENTS (estructura real proporcionada)
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  service_id UUID NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NULL,
  calendly_event_uri TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT timezone('utc'::text, now()),
  notes TEXT NULL,
  CONSTRAINT appointments_pkey PRIMARY KEY (id),
  CONSTRAINT appointments_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
  CONSTRAINT appointments_service_id_fkey FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- 5. CREAR TABLA ERRORS (estructura real proporcionada)
CREATE TABLE public.errors (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  session_id TEXT NOT NULL,
  error_code CHARACTER VARYING(50) NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
  metadata JSONB NULL,
  CONSTRAINT errores_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- 6. CREAR TABLA CONVERSATIONS (para el flujo de WhatsApp)
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  phone_number TEXT UNIQUE NOT NULL,
  current_step TEXT DEFAULT 'initial',
  user_data JSONB DEFAULT '{}',
  attempts_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  language TEXT DEFAULT 'es',
  id_cliente UUID NULL,
  id_reserva UUID NULL,
  last_message_id TEXT NULL,
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES clients (id) ON DELETE SET NULL
) TABLESPACE pg_default;

-- 7. CREAR TABLA MESSAGES (para historial de mensajes)
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  is_from_user BOOLEAN NOT NULL,
  is_encrypted BOOLEAN DEFAULT false,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT messages_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- 8. CREAR ÍNDICES PARA OPTIMIZACIÓN
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients USING btree (phone_number) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_reservas_id_cliente ON public.appointments USING btree (client_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON public.conversations USING btree (phone_number) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON public.messages USING btree (timestamp) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON public.appointments USING btree (scheduled_at) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_services_active ON public.services USING btree (is_active) TABLESPACE pg_default;

-- 9. INSERTAR DATOS DE EJEMPLO PARA TESTING
INSERT INTO public.services (name, description, price, duration, category, is_active) VALUES
('Consulta General', 'Consulta médica general con especialista', 50.00, 30, 'Medicina General', true),
('Revisión Especializada', 'Revisión completa con especialista certificado', 80.00, 45, 'Especialidades', true),
('Análisis Clínicos', 'Análisis completos de laboratorio', 35.00, 15, 'Laboratorio', true),
('Consulta Urgente', 'Atención médica urgente', 75.00, 20, 'Urgencias', true),
('Chequeo Preventivo', 'Chequeo médico preventivo completo', 120.00, 60, 'Prevención', true);

-- 10. CONFIGURAR POLÍTICAS RLS (Row Level Security) - OPCIONAL
-- Solo descomenta si necesitas seguridad a nivel de fila

/*
-- Habilitar RLS en las tablas principales
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones (para desarrollo)
CREATE POLICY "Allow all operations" ON public.clients FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.appointments FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.conversations FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.messages FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.services FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.errors FOR ALL USING (true);
*/

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

-- Verificar que todas las tablas se crearon correctamente
SELECT
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('clients', 'services', 'appointments', 'conversations', 'messages', 'errors')
ORDER BY tablename;

-- Verificar que los índices se crearon
SELECT
  indexname,
  tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('clients', 'services', 'appointments', 'conversations', 'messages')
ORDER BY tablename, indexname;

-- Verificar datos de ejemplo
SELECT
  'services' as tabla,
  COUNT(*) as registros
FROM public.services
WHERE is_active = true;

-- =====================================================
-- COMANDOS PARA VERIFICAR EN SUPABASE DASHBOARD
-- =====================================================

/*
DESPUÉS DE EJECUTAR ESTE SCRIPT:

1. Ve a tu Supabase Dashboard
2. Ve a "Table Editor"
3. Deberías ver estas tablas:
   - clients
   - services (con 5 servicios de ejemplo)
   - appointments
   - conversations
   - messages
   - errors

4. Ejecuta en tu terminal: npm test
5. Los tests deberían pasar correctamente

Si hay algún error, revisa:
- Permisos de las tablas
- Configuración de RLS
- Variables de entorno (.env y .env.local)
*/
