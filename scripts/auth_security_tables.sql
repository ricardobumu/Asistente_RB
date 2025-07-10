-- =====================================================
-- TABLAS DE AUTENTICACIÓN Y SEGURIDAD AVANZADA
-- =====================================================

-- =====================================================
-- TABLA: SESIONES DE USUARIO
-- =====================================================

CREATE TABLE IF NOT EXISTS user_sessions (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_id UUID NOT NULL UNIQUE,
  
  -- Información de la sesión
  device_info JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  
  -- Estado de la sesión
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  
  -- Metadatos de seguridad
  login_method VARCHAR(50) DEFAULT 'password', -- password, 2fa, oauth, etc.
  risk_score INTEGER DEFAULT 0, -- 0-100, basado en patrones de uso
  location_info JSONB DEFAULT '{}',
  
  -- Auditoría
  created_by UUID REFERENCES users(id),
  revoked_by UUID REFERENCES users(id),
  revocation_reason TEXT
);

-- Índices para sesiones
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token_id ON user_sessions(token_id);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_last_activity ON user_sessions(last_activity);
CREATE INDEX idx_user_sessions_ip_address ON user_sessions(ip_address);

-- Índice compuesto para consultas comunes
CREATE INDEX idx_user_sessions_user_active ON user_sessions(user_id, is_active, expires_at);

-- =====================================================
-- TABLA: PERMISOS DEL SISTEMA
-- =====================================================

CREATE TABLE IF NOT EXISTS permissions (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  
  -- Categorización
  category VARCHAR(50) NOT NULL, -- admin, client, booking, service, etc.
  resource VARCHAR(50) NOT NULL, -- users, bookings, services, etc.
  action VARCHAR(50) NOT NULL,   -- create, read, update, delete, etc.
  
  -- Configuración
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE, -- No se puede eliminar
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- Índices para permisos
CREATE INDEX idx_permissions_name ON permissions(name);
CREATE INDEX idx_permissions_category ON permissions(category);
CREATE INDEX idx_permissions_resource ON permissions(resource);
CREATE INDEX idx_permissions_active ON permissions(is_active);

-- =====================================================
-- TABLA: PERMISOS DE USUARIO
-- =====================================================

CREATE TABLE IF NOT EXISTS user_permissions (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  
  -- Estado
  is_active BOOLEAN DEFAULT TRUE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- NULL = no expira
  revoked_at TIMESTAMPTZ,
  
  -- Auditoría
  granted_by UUID REFERENCES users(id),
  revoked_by UUID REFERENCES users(id),
  revocation_reason TEXT,
  
  -- Restricciones adicionales
  conditions JSONB DEFAULT '{}', -- Condiciones específicas (horarios, IPs, etc.)
  
  UNIQUE(user_id, permission_id)
);

-- Índices para permisos de usuario
CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_permission_id ON user_permissions(permission_id);
CREATE INDEX idx_user_permissions_active ON user_permissions(is_active);
CREATE INDEX idx_user_permissions_expires_at ON user_permissions(expires_at);

-- Índice compuesto para consultas de permisos
CREATE INDEX idx_user_permissions_user_active ON user_permissions(user_id, is_active, expires_at);

-- =====================================================
-- TABLA: INTENTOS DE LOGIN
-- =====================================================

CREATE TABLE IF NOT EXISTS login_attempts (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Información del intento
  email VARCHAR(255),
  ip_address INET NOT NULL,
  user_agent TEXT,
  
  -- Resultado del intento
  success BOOLEAN NOT NULL,
  failure_reason VARCHAR(100), -- invalid_credentials, account_locked, etc.
  
  -- Información adicional
  user_id UUID REFERENCES users(id), -- NULL si el usuario no existe
  session_id UUID REFERENCES user_sessions(id), -- NULL si falló
  
  -- Metadatos de seguridad
  risk_indicators JSONB DEFAULT '{}',
  location_info JSONB DEFAULT '{}',
  device_fingerprint TEXT,
  
  -- Timestamp
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para intentos de login
CREATE INDEX idx_login_attempts_email ON login_attempts(email);
CREATE INDEX idx_login_attempts_ip_address ON login_attempts(ip_address);
CREATE INDEX idx_login_attempts_success ON login_attempts(success);
CREATE INDEX idx_login_attempts_attempted_at ON login_attempts(attempted_at);
CREATE INDEX idx_login_attempts_user_id ON login_attempts(user_id);

-- Índice compuesto para análisis de seguridad
CREATE INDEX idx_login_attempts_ip_time ON login_attempts(ip_address, attempted_at DESC);
CREATE INDEX idx_login_attempts_email_time ON login_attempts(email, attempted_at DESC);

-- =====================================================
-- TABLA: TOKENS REVOCADOS (BLACKLIST)
-- =====================================================

CREATE TABLE IF NOT EXISTS revoked_tokens (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID NOT NULL UNIQUE,
  
  -- Información del token
  user_id UUID REFERENCES users(id),
  token_type VARCHAR(20) NOT NULL, -- access, refresh
  
  -- Revocación
  revoked_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_by UUID REFERENCES users(id),
  revocation_reason VARCHAR(100),
  
  -- Expiración original del token
  original_expires_at TIMESTAMPTZ NOT NULL,
  
  -- Metadatos
  metadata JSONB DEFAULT '{}'
);

-- Índices para tokens revocados
CREATE INDEX idx_revoked_tokens_token_id ON revoked_tokens(token_id);
CREATE INDEX idx_revoked_tokens_user_id ON revoked_tokens(user_id);
CREATE INDEX idx_revoked_tokens_revoked_at ON revoked_tokens(revoked_at);
CREATE INDEX idx_revoked_tokens_expires_at ON revoked_tokens(original_expires_at);

-- =====================================================
-- INSERTAR PERMISOS BÁSICOS DEL SISTEMA
-- =====================================================

INSERT INTO permissions (name, description, category, resource, action, is_system) VALUES
-- Permisos de administración
('admin.users.create', 'Crear usuarios', 'admin', 'users', 'create', true),
('admin.users.read', 'Ver usuarios', 'admin', 'users', 'read', true),
('admin.users.update', 'Actualizar usuarios', 'admin', 'users', 'update', true),
('admin.users.delete', 'Eliminar usuarios', 'admin', 'users', 'delete', true),

-- Permisos de servicios
('admin.services.create', 'Crear servicios', 'admin', 'services', 'create', true),
('admin.services.read', 'Ver servicios', 'admin', 'services', 'read', true),
('admin.services.update', 'Actualizar servicios', 'admin', 'services', 'update', true),
('admin.services.delete', 'Eliminar servicios', 'admin', 'services', 'delete', true),

-- Permisos de reservas
('admin.bookings.create', 'Crear reservas', 'admin', 'bookings', 'create', true),
('admin.bookings.read', 'Ver todas las reservas', 'admin', 'bookings', 'read', true),
('admin.bookings.update', 'Actualizar reservas', 'admin', 'bookings', 'update', true),
('admin.bookings.delete', 'Eliminar reservas', 'admin', 'bookings', 'delete', true),

-- Permisos de clientes
('admin.clients.create', 'Crear clientes', 'admin', 'clients', 'create', true),
('admin.clients.read', 'Ver clientes', 'admin', 'clients', 'read', true),
('admin.clients.update', 'Actualizar clientes', 'admin', 'clients', 'update', true),
('admin.clients.delete', 'Eliminar clientes', 'admin', 'clients', 'delete', true),

-- Permisos de cliente
('client.profile.read', 'Ver propio perfil', 'client', 'profile', 'read', true),
('client.profile.update', 'Actualizar propio perfil', 'client', 'profile', 'update', true),
('client.bookings.create', 'Crear propias reservas', 'client', 'bookings', 'create', true),
('client.bookings.read', 'Ver propias reservas', 'client', 'bookings', 'read', true),
('client.bookings.update', 'Actualizar propias reservas', 'client', 'bookings', 'update', true),
('client.bookings.cancel', 'Cancelar propias reservas', 'client', 'bookings', 'cancel', true),

-- Permisos de staff
('staff.bookings.read', 'Ver reservas asignadas', 'staff', 'bookings', 'read', true),
('staff.bookings.update', 'Actualizar reservas asignadas', 'staff', 'bookings', 'update', true),
('staff.clients.read', 'Ver clientes asignados', 'staff', 'clients', 'read', true),
('staff.clients.update', 'Actualizar clientes asignados', 'staff', 'clients', 'update', true),

-- Permisos de reportes
('admin.reports.read', 'Ver reportes', 'admin', 'reports', 'read', true),
('admin.analytics.read', 'Ver analytics', 'admin', 'analytics', 'read', true),
('admin.audit.read', 'Ver logs de auditoría', 'admin', 'audit', 'read', true),

-- Permisos de configuración
('admin.settings.read', 'Ver configuración', 'admin', 'settings', 'read', true),
('admin.settings.update', 'Actualizar configuración', 'admin', 'settings', 'update', true),
('admin.integrations.manage', 'Gestionar integraciones', 'admin', 'integrations', 'manage', true)

ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- POLÍTICAS RLS PARA TABLAS DE SEGURIDAD
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE revoked_tokens ENABLE ROW LEVEL SECURITY;

-- Políticas para user_sessions
CREATE POLICY "user_sessions_select_own" ON user_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_sessions_select_admin" ON user_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'admin')
      AND users.status = 'active'
    )
  );

-- Políticas para permissions (solo lectura para usuarios autenticados)
CREATE POLICY "permissions_select_authenticated" ON permissions
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

-- Políticas para user_permissions
CREATE POLICY "user_permissions_select_own" ON user_permissions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_permissions_select_admin" ON user_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'admin')
      AND users.status = 'active'
    )
  );

-- Políticas para login_attempts (solo admins)
CREATE POLICY "login_attempts_select_admin" ON login_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'admin')
      AND users.status = 'active'
    )
  );

-- Políticas para revoked_tokens (solo admins)
CREATE POLICY "revoked_tokens_select_admin" ON revoked_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'admin')
      AND users.status = 'active'
    )
  );

-- =====================================================
-- FUNCIONES AUXILIARES DE SEGURIDAD
-- =====================================================

-- Función para limpiar sesiones expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Marcar sesiones expiradas como inactivas
  UPDATE user_sessions 
  SET is_active = false, revoked_at = NOW()
  WHERE expires_at < NOW() AND is_active = true;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Eliminar sesiones muy antiguas (más de 30 días)
  DELETE FROM user_sessions 
  WHERE expires_at < NOW() - INTERVAL '30 days';
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para limpiar tokens revocados expirados
CREATE OR REPLACE FUNCTION cleanup_expired_revoked_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM revoked_tokens 
  WHERE original_expires_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener estadísticas de seguridad
CREATE OR REPLACE FUNCTION get_security_stats(
  start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  total_login_attempts BIGINT,
  successful_logins BIGINT,
  failed_logins BIGINT,
  unique_ips BIGINT,
  active_sessions BIGINT,
  revoked_tokens BIGINT,
  top_failure_reasons TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_login_attempts,
    COUNT(*) FILTER (WHERE success = true) as successful_logins,
    COUNT(*) FILTER (WHERE success = false) as failed_logins,
    COUNT(DISTINCT ip_address) as unique_ips,
    (SELECT COUNT(*) FROM user_sessions WHERE is_active = true) as active_sessions,
    (SELECT COUNT(*) FROM revoked_tokens WHERE revoked_at BETWEEN start_date AND end_date) as revoked_tokens,
    ARRAY(
      SELECT failure_reason 
      FROM login_attempts 
      WHERE attempted_at BETWEEN start_date AND end_date 
      AND success = false 
      AND failure_reason IS NOT NULL
      GROUP BY failure_reason 
      ORDER BY COUNT(*) DESC 
      LIMIT 5
    ) as top_failure_reasons
  FROM login_attempts
  WHERE attempted_at BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS PARA AUDITORÍA AUTOMÁTICA
-- =====================================================

-- Trigger para registrar intentos de login automáticamente
CREATE OR REPLACE FUNCTION log_login_attempt()
RETURNS TRIGGER AS $$
BEGIN
  -- Este trigger se activaría desde la aplicación
  -- cuando se detecte un intento de login
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE user_sessions IS 'Sesiones activas de usuarios con información de seguridad';
COMMENT ON TABLE permissions IS 'Permisos granulares del sistema';
COMMENT ON TABLE user_permissions IS 'Asignación de permisos específicos a usuarios';
COMMENT ON TABLE login_attempts IS 'Registro de todos los intentos de login para análisis de seguridad';
COMMENT ON TABLE revoked_tokens IS 'Lista negra de tokens revocados antes de su expiración natural';