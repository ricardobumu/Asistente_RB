-- Script para crear tablas faltantes en Supabase
-- Ejecutar en el SQL Editor de Supabase

-- 1. Crear tabla users si no existe
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    phone VARCHAR(20),
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}',
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Crear índices para users
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(is_active);

-- 3. Crear trigger para updated_at en users
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Verificar que las tablas principales existen
DO $$
BEGIN
    -- Verificar tabla clients
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clients') THEN
        CREATE TABLE public.clients (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            full_name VARCHAR(255) NOT NULL,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            email VARCHAR(255),
            phone VARCHAR(20),
            whatsapp_phone VARCHAR(20),
            date_of_birth DATE,
            gender VARCHAR(20),
            address TEXT,
            city VARCHAR(100),
            postal_code VARCHAR(20),
            country VARCHAR(100) DEFAULT 'España',
            preferences JSONB DEFAULT '{}',
            notes TEXT,
            is_active BOOLEAN DEFAULT true,
            gdpr_consent BOOLEAN DEFAULT false,
            gdpr_consent_date TIMESTAMP WITH TIME ZONE,
            marketing_consent BOOLEAN DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX idx_clients_email ON public.clients(email);
        CREATE INDEX idx_clients_phone ON public.clients(phone);
        CREATE INDEX idx_clients_whatsapp ON public.clients(whatsapp_phone);
        CREATE INDEX idx_clients_active ON public.clients(is_active);
    END IF;

    -- Verificar tabla services
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'services') THEN
        CREATE TABLE public.services (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(255) UNIQUE,
            description TEXT,
            short_description VARCHAR(500),
            price DECIMAL(10,2) NOT NULL,
            duration_minutes INTEGER NOT NULL DEFAULT 60,
            category VARCHAR(100),
            subcategory VARCHAR(100),
            is_active BOOLEAN DEFAULT true,
            is_featured BOOLEAN DEFAULT false,
            image_url TEXT,
            gallery_urls JSONB DEFAULT '[]',
            calendly_url TEXT,
            booking_settings JSONB DEFAULT '{}',
            seo_title VARCHAR(255),
            seo_description TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX idx_services_active ON public.services(is_active);
        CREATE INDEX idx_services_category ON public.services(category);
        CREATE INDEX idx_services_featured ON public.services(is_featured);
        CREATE UNIQUE INDEX idx_services_slug ON public.services(slug);
    END IF;

    -- Verificar tabla appointments
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'appointments') THEN
        CREATE TABLE public.appointments (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            appointment_number VARCHAR(50) UNIQUE NOT NULL,
            client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
            service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
            scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
            duration_minutes INTEGER NOT NULL DEFAULT 60,
            status VARCHAR(50) DEFAULT 'scheduled',
            notes TEXT,
            internal_notes TEXT,
            price DECIMAL(10,2),
            payment_status VARCHAR(50) DEFAULT 'pending',
            payment_method VARCHAR(50),
            confirmation_code VARCHAR(20),
            reminder_sent BOOLEAN DEFAULT false,
            calendly_event_uri TEXT,
            google_calendar_event_id TEXT,
            cancellation_reason TEXT,
            cancelled_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX idx_appointments_client ON public.appointments(client_id);
        CREATE INDEX idx_appointments_service ON public.appointments(service_id);
        CREATE INDEX idx_appointments_scheduled ON public.appointments(scheduled_at);
        CREATE INDEX idx_appointments_status ON public.appointments(status);
        CREATE INDEX idx_appointments_calendly ON public.appointments(calendly_event_uri);
        CREATE UNIQUE INDEX idx_appointments_number ON public.appointments(appointment_number);
    END IF;
END $$;

-- 5. Insertar servicios de ejemplo si la tabla está vacía
INSERT INTO public.services (name, slug, description, price, duration_minutes, category, is_active)
SELECT * FROM (VALUES
    ('Corte y Peinado', 'corte-peinado', 'Corte personalizado y peinado profesional', 35.00, 45, 'Cabello', true),
    ('Tratamiento Capilar', 'tratamiento-capilar', 'Tratamiento intensivo para el cabello', 45.00, 90, 'Cabello', true),
    ('Manicura', 'manicura', 'Cuidado completo de manos y uñas', 25.00, 30, 'Uñas', true),
    ('Pedicura', 'pedicura', 'Cuidado completo de pies y uñas', 30.00, 45, 'Uñas', true),
    ('Depilación', 'depilacion', 'Depilación profesional', 40.00, 60, 'Depilación', true),
    ('Limpieza Facial', 'limpieza-facial', 'Limpieza profunda y tratamiento facial', 50.00, 60, 'Facial', true)
) AS v(name, slug, description, price, duration_minutes, category, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.services LIMIT 1);

-- 6. Crear usuario administrador por defecto si no existe
INSERT INTO public.users (email, full_name, role, is_active, email_verified)
SELECT 'admin@ricardoburitica.eu', 'Ricardo Buriticá', 'admin', true, true
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'admin@ricardoburitica.eu');

-- 7. Habilitar RLS (Row Level Security) si no está habilitado
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- 8. Crear políticas básicas de RLS
-- Política para users (solo admin puede ver todos)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid()::text = id::text OR
                     EXISTS (SELECT 1 FROM public.users WHERE id::text = auth.uid()::text AND role = 'admin'));

-- Política para services (público para lectura)
DROP POLICY IF EXISTS "Services are viewable by everyone" ON public.services;
CREATE POLICY "Services are viewable by everyone" ON public.services
    FOR SELECT USING (is_active = true);

-- Política para clients (solo admin y el propio cliente)
DROP POLICY IF EXISTS "Clients can view own data" ON public.clients;
CREATE POLICY "Clients can view own data" ON public.clients
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id::text = auth.uid()::text AND role = 'admin'));

-- Política para appointments (solo admin y el cliente de la cita)
DROP POLICY IF EXISTS "Appointments viewable by admin and client" ON public.appointments;
CREATE POLICY "Appointments viewable by admin and client" ON public.appointments
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id::text = auth.uid()::text AND role = 'admin'));

-- 9. Verificar que todo se creó correctamente
SELECT
    'users' as table_name,
    COUNT(*) as record_count
FROM public.users
UNION ALL
SELECT
    'clients' as table_name,
    COUNT(*) as record_count
FROM public.clients
UNION ALL
SELECT
    'services' as table_name,
    COUNT(*) as record_count
FROM public.services
UNION ALL
SELECT
    'appointments' as table_name,
    COUNT(*) as record_count
FROM public.appointments;

-- Mensaje de confirmación
SELECT 'Tablas creadas y configuradas correctamente' as status;
