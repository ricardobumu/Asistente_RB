-- =====================================================
-- ESQUEMA DE BASE DE DATOS SEGURO PARA ASISTENTE RB
-- =====================================================
-- Prioridad: SEGURIDAD Y BUENAS PRÁCTICAS
-- Motor: Supabase (PostgreSQL)
-- Fecha: 2024
-- =====================================================

-- =====================================================
-- 1. EXTENSIONES Y CONFIGURACIONES
-- =====================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 2. TIPOS PERSONALIZADOS (ENUMS)
-- =====================================================

-- Estados de usuario
CREATE TYPE user_status AS ENUM (
  'active',
  'inactive', 
  'suspended',
  'pending_verification'
);

-- Roles del sistema
CREATE TYPE user_role AS ENUM (
  'super_admin',
  'admin',
  'manager',
  'supervisor',
  'staff',
  'receptionist',
  'therapist',
  'trainee'
);

-- Estados de cliente
CREATE TYPE client_status AS ENUM (
  'active',
  'inactive',
  'suspended',
  'pending_verification',
  'blocked'
);

-- Estados de reserva
CREATE TYPE booking_status AS ENUM (
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
  'rescheduled'
);

-- Tipos de notificación
CREATE TYPE notification_type AS ENUM (
  'booking_confirmation',
  'booking_reminder',
  'booking_cancellation',
  'system_alert',
  'promotional',
  'security_alert'
);

-- Categorías de servicio
CREATE TYPE service_category AS ENUM (
  'consultation',
  'therapy',
  'treatment',
  'assessment',
  'follow_up',
  'emergency'
);

-- =====================================================
-- 3. TABLA: USUARIOS DEL SISTEMA (STAFF)
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  
  -- Autenticación
  password_hash TEXT NOT NULL,
  token_version INTEGER DEFAULT 1,
  
  -- Información personal
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  
  -- Sistema
  role user_role NOT NULL DEFAULT 'staff',
  status user_status NOT NULL DEFAULT 'pending_verification',
  
  -- Verificación
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMPTZ,
  phone_verified BOOLEAN DEFAULT FALSE,
  phone_verified_at TIMESTAMPTZ,
  
  -- Seguridad
  last_login TIMESTAMPTZ,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- Índices para usuarios
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);

-- =====================================================
-- 4. TABLA: CLIENTES DEL PORTAL
-- =====================================================

CREATE TABLE IF NOT EXISTS clients (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  
  -- Autenticación
  password_hash TEXT NOT NULL,
  token_version INTEGER DEFAULT 1,
  
  -- Información personal
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  date_of_birth DATE,
  
  -- Dirección
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'España',
  
  -- Sistema
  status client_status NOT NULL DEFAULT 'pending_verification',
  
  -- Verificación
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMPTZ,
  phone_verified BOOLEAN DEFAULT FALSE,
  phone_verified_at TIMESTAMPTZ,
  
  -- Preferencias (JSON)
  preferences JSONB DEFAULT '{}',
  emergency_contact JSONB,
  
  -- Seguridad
  last_login TIMESTAMPTZ,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- Índices para clientes
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_created_at ON clients(created_at);
CREATE INDEX idx_clients_preferences ON clients USING GIN(preferences);

-- =====================================================
-- 5. TABLA: SERVICIOS
-- =====================================================

CREATE TABLE IF NOT EXISTS services (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  
  -- Información del servicio
  description TEXT,
  short_description VARCHAR(500),
  category service_category NOT NULL,
  
  -- Configuración
  duration_minutes INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  
  -- Disponibilidad
  active BOOLEAN DEFAULT TRUE,
  online_booking_enabled BOOLEAN DEFAULT TRUE,
  requires_approval BOOLEAN DEFAULT FALSE,
  
  -- Configuración avanzada
  max_advance_booking_days INTEGER DEFAULT 30,
  min_advance_booking_hours INTEGER DEFAULT 24,
  max_cancellation_hours INTEGER DEFAULT 24,
  
  -- Staff asignado
  assigned_staff UUID[] DEFAULT '{}',
  
  -- Metadatos (JSON)
  metadata JSONB DEFAULT '{}',
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- Índices para servicios
CREATE INDEX idx_services_slug ON services(slug);
CREATE INDEX idx_services_category ON services(category);
CREATE INDEX idx_services_active ON services(active);
CREATE INDEX idx_services_price ON services(price);
CREATE INDEX idx_services_metadata ON services USING GIN(metadata);

-- =====================================================
-- 6. TABLA: RESERVAS/CITAS
-- =====================================================

CREATE TABLE IF NOT EXISTS bookings (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_number VARCHAR(50) UNIQUE NOT NULL,
  
  -- Referencias
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Programación
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  timezone VARCHAR(50) DEFAULT 'Europe/Madrid',
  
  -- Estado y gestión
  status booking_status NOT NULL DEFAULT 'pending',
  confirmation_code VARCHAR(20) UNIQUE,
  
  -- Información adicional
  notes TEXT,
  client_notes TEXT,
  staff_notes TEXT,
  cancellation_reason TEXT,
  
  -- Precios (snapshot al momento de la reserva)
  original_price DECIMAL(10,2) NOT NULL,
  final_price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  
  -- Recordatorios y notificaciones
  reminder_sent BOOLEAN DEFAULT FALSE,
  reminder_sent_at TIMESTAMPTZ,
  confirmation_sent BOOLEAN DEFAULT FALSE,
  confirmation_sent_at TIMESTAMPTZ,
  
  -- Integración externa (Calendly, etc.)
  external_id VARCHAR(255),
  external_platform VARCHAR(50),
  
  -- Metadatos
  metadata JSONB DEFAULT '{}',
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- Índices para reservas
CREATE INDEX idx_bookings_client_id ON bookings(client_id);
CREATE INDEX idx_bookings_service_id ON bookings(service_id);
CREATE INDEX idx_bookings_staff_id ON bookings(staff_id);
CREATE INDEX idx_bookings_start_time ON bookings(start_time);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_booking_number ON bookings(booking_number);
CREATE INDEX idx_bookings_confirmation_code ON bookings(confirmation_code);
CREATE INDEX idx_bookings_created_at ON bookings(created_at);

-- Índice compuesto para consultas de disponibilidad
CREATE INDEX idx_bookings_availability ON bookings(start_time, end_time, status) 
WHERE status NOT IN ('cancelled', 'no_show');

-- =====================================================
-- 7. TABLA: NOTIFICACIONES
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Destinatario (puede ser cliente o usuario)
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Contenido
  type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  
  -- Estado
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  -- Envío
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  delivery_method VARCHAR(50), -- email, sms, push, whatsapp
  
  -- Referencias opcionales
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  
  -- Metadatos
  metadata JSONB DEFAULT '{}',
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Índices para notificaciones
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_client_id ON notifications(client_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_sent ON notifications(sent);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_booking_id ON notifications(booking_id);

-- =====================================================
-- 8. TABLA: AUDITORÍA DE ACTIVIDADES
-- =====================================================

CREATE TABLE IF NOT EXISTS activity_logs (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Actor
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  
  -- Acción
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  
  -- Detalles
  description TEXT,
  old_values JSONB,
  new_values JSONB,
  
  -- Contexto
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(255),
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para auditoría
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_client_id ON activity_logs(client_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_resource ON activity_logs(resource_type, resource_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

-- =====================================================
-- 9. FUNCIONES DE AUDITORÍA AUTOMÁTICA
-- =====================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 10. FUNCIONES DE VALIDACIÓN
-- =====================================================

-- Función para validar que no haya conflictos de horarios
CREATE OR REPLACE FUNCTION check_booking_conflicts()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar conflictos con otras reservas del mismo staff
  IF EXISTS (
    SELECT 1 FROM bookings 
    WHERE staff_id = NEW.staff_id 
    AND id != COALESCE(NEW.id, uuid_nil())
    AND status NOT IN ('cancelled', 'no_show')
    AND (
      (NEW.start_time >= start_time AND NEW.start_time < end_time) OR
      (NEW.end_time > start_time AND NEW.end_time <= end_time) OR
      (NEW.start_time <= start_time AND NEW.end_time >= end_time)
    )
  ) THEN
    RAISE EXCEPTION 'Conflicto de horario: El staff ya tiene una cita en ese horario';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar conflictos
CREATE TRIGGER check_booking_conflicts_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION check_booking_conflicts();

-- =====================================================
-- 11. FUNCIONES AUXILIARES
-- =====================================================

-- Función para generar número de reserva único
CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.booking_number IS NULL THEN
    NEW.booking_number := 'RB' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                         LPAD(EXTRACT(EPOCH FROM NOW())::TEXT, 10, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para generar número de reserva
CREATE TRIGGER generate_booking_number_trigger
  BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION generate_booking_number();

-- =====================================================
-- 12. VISTAS ÚTILES
-- =====================================================

-- Vista de reservas con información completa
CREATE OR REPLACE VIEW booking_details AS
SELECT 
  b.id,
  b.booking_number,
  b.start_time,
  b.end_time,
  b.status,
  b.confirmation_code,
  
  -- Cliente
  c.first_name || ' ' || c.last_name AS client_name,
  c.email AS client_email,
  c.phone AS client_phone,
  
  -- Servicio
  s.name AS service_name,
  s.duration_minutes,
  s.category AS service_category,
  
  -- Staff
  u.first_name || ' ' || u.last_name AS staff_name,
  u.email AS staff_email,
  
  -- Precios
  b.original_price,
  b.final_price,
  b.currency,
  
  -- Timestamps
  b.created_at,
  b.updated_at
  
FROM bookings b
LEFT JOIN clients c ON b.client_id = c.id
LEFT JOIN services s ON b.service_id = s.id
LEFT JOIN users u ON b.staff_id = u.id;

-- =====================================================
-- 13. DATOS INICIALES (SEEDS)
-- =====================================================

-- Insertar usuario administrador inicial (solo si no existe)
INSERT INTO users (
  email, 
  password_hash, 
  first_name, 
  last_name, 
  role, 
  status,
  email_verified
) 
SELECT 
  'admin@asistenterb.com',
  crypt('admin123', gen_salt('bf')),
  'Admin',
  'Sistema',
  'super_admin',
  'active',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'admin@asistenterb.com'
);

-- =====================================================
-- ESQUEMA COMPLETADO
-- =====================================================
-- Total de tablas: 6 principales + 1 auditoría
-- Seguridad: RLS pendiente (siguiente paso)
-- Índices: Optimizados para consultas frecuentes
-- Triggers: Auditoría automática y validaciones
-- =====================================================