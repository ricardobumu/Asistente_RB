-- =====================================================
-- ÍNDICES DE RENDIMIENTO OPTIMIZADOS
-- =====================================================
-- Índices estratégicos para maximizar el rendimiento
-- de consultas frecuentes en el sistema
-- =====================================================

-- =====================================================
-- ÍNDICES PARA TABLA USERS
-- =====================================================

-- Índices básicos (ya existentes, verificar)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Índices compuestos para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_users_status_role ON users(status, role);
CREATE INDEX IF NOT EXISTS idx_users_email_status ON users(email, status);
CREATE INDEX IF NOT EXISTS idx_users_created_at_status ON users(created_at DESC, status);

-- Índice parcial para usuarios activos (más eficiente)
CREATE INDEX IF NOT EXISTS idx_users_active_email ON users(email) 
WHERE status = 'active';

-- Índice para búsquedas de texto en nombres
CREATE INDEX IF NOT EXISTS idx_users_name_search ON users 
USING gin(to_tsvector('spanish', first_name || ' ' || last_name));

-- =====================================================
-- ÍNDICES PARA TABLA CLIENTS
-- =====================================================

-- Índices básicos optimizados
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_whatsapp_phone ON clients(whatsapp_phone);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);

-- Índices compuestos para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_clients_status_created ON clients(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_phone_status ON clients(phone, status);
CREATE INDEX IF NOT EXISTS idx_clients_email_status ON clients(email, status);

-- Índice parcial para clientes activos
CREATE INDEX IF NOT EXISTS idx_clients_active_phone ON clients(phone) 
WHERE status = 'active';

-- Índice para búsquedas de texto completo
CREATE INDEX IF NOT EXISTS idx_clients_search ON clients 
USING gin(to_tsvector('spanish', first_name || ' ' || last_name || ' ' || COALESCE(email, '')));

-- Índice para LGPD y consentimientos
CREATE INDEX IF NOT EXISTS idx_clients_lgpd_marketing ON clients(lgpd_accepted, marketing_consent);

-- Índice para clientes VIP
CREATE INDEX IF NOT EXISTS idx_clients_vip_status ON clients(vip_status, status) 
WHERE vip_status = true;

-- =====================================================
-- ÍNDICES PARA TABLA SERVICES
-- =====================================================

-- Índices básicos optimizados
CREATE INDEX IF NOT EXISTS idx_services_slug ON services(slug);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(active);
CREATE INDEX IF NOT EXISTS idx_services_price ON services(price);

-- Índices compuestos para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_services_active_category ON services(active, category);
CREATE INDEX IF NOT EXISTS idx_services_active_price ON services(active, price);
CREATE INDEX IF NOT EXISTS idx_services_category_price ON services(category, price);

-- Índice parcial para servicios activos
CREATE INDEX IF NOT EXISTS idx_services_active_booking ON services(id, name, price, duration_minutes) 
WHERE active = true AND online_booking_enabled = true;

-- Índice para búsquedas de texto
CREATE INDEX IF NOT EXISTS idx_services_search ON services 
USING gin(to_tsvector('spanish', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(short_description, '')));

-- Índice para configuración de reservas
CREATE INDEX IF NOT EXISTS idx_services_booking_config ON services(
  max_advance_booking_days, 
  min_advance_booking_hours, 
  max_cancellation_hours
) WHERE active = true;

-- =====================================================
-- ÍNDICES PARA TABLA BOOKINGS
-- =====================================================

-- Índices básicos optimizados
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_service_id ON bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_bookings_staff_id ON bookings(staff_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_number ON bookings(booking_number);

-- Índices compuestos críticos para rendimiento
CREATE INDEX IF NOT EXISTS idx_bookings_client_status ON bookings(client_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_service_status ON bookings(service_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_staff_status ON bookings(staff_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_status_start_time ON bookings(status, start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time_status ON bookings(start_time, status);

-- Índice para consultas de disponibilidad (crítico)
CREATE INDEX IF NOT EXISTS idx_bookings_availability ON bookings(start_time, end_time, status) 
WHERE status IN ('pending', 'confirmed');

-- Índice para reservas del día
CREATE INDEX IF NOT EXISTS idx_bookings_today ON bookings(start_time::date, status, start_time);

-- Índice para próximas reservas
CREATE INDEX IF NOT EXISTS idx_bookings_upcoming ON bookings(start_time, status) 
WHERE start_time >= NOW() AND status IN ('pending', 'confirmed');

-- Índice para reservas por rango de fechas
CREATE INDEX IF NOT EXISTS idx_bookings_date_range ON bookings(start_time, end_time, client_id, service_id);

-- Índice para estadísticas y reportes
CREATE INDEX IF NOT EXISTS idx_bookings_stats ON bookings(
  created_at::date, 
  status, 
  final_price, 
  service_id
);

-- Índice para búsqueda por código de confirmación
CREATE INDEX IF NOT EXISTS idx_bookings_confirmation_code ON bookings(confirmation_code) 
WHERE confirmation_code IS NOT NULL;

-- Índice para external_id (integraciones)
CREATE INDEX IF NOT EXISTS idx_bookings_external_id ON bookings(external_id, external_platform) 
WHERE external_id IS NOT NULL;

-- =====================================================
-- ÍNDICES PARA TABLAS DE AUDITORÍA
-- =====================================================

-- Índices para audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status_code ON audit_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON audit_logs(success, timestamp DESC);

-- Índice compuesto para consultas de auditoría frecuentes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_action ON audit_logs(ip_address, action, timestamp DESC);

-- Índices para user_sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_id ON user_sessions(token_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at) 
WHERE is_active = true;

-- Índices para login_attempts
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON login_attempts(email, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip_address, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_success ON login_attempts(success, attempted_at DESC);

-- =====================================================
-- ÍNDICES PARA METADATOS JSON
-- =====================================================

-- Índices GIN para búsquedas en campos JSON
CREATE INDEX IF NOT EXISTS idx_clients_preferences ON clients USING gin(preferences);
CREATE INDEX IF NOT EXISTS idx_clients_metadata ON clients USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_services_metadata ON services USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_bookings_metadata ON bookings USING gin(metadata);

-- Índices específicos para campos JSON frecuentes
CREATE INDEX IF NOT EXISTS idx_clients_emergency_contact ON clients 
USING gin((preferences->'emergency_contact'));

CREATE INDEX IF NOT EXISTS idx_services_calendly ON services 
USING gin((metadata->'calendly'));

CREATE INDEX IF NOT EXISTS idx_bookings_calendar_event ON bookings 
USING gin((metadata->'calendar_event_id'));

-- =====================================================
-- ÍNDICES PARA BÚSQUEDAS DE TEXTO COMPLETO
-- =====================================================

-- Configurar diccionario español para búsquedas
CREATE TEXT SEARCH CONFIGURATION IF NOT EXISTS spanish_config (COPY = spanish);

-- Índices de texto completo optimizados
CREATE INDEX IF NOT EXISTS idx_clients_fulltext ON clients 
USING gin(to_tsvector('spanish_config', 
  first_name || ' ' || 
  last_name || ' ' || 
  COALESCE(email, '') || ' ' || 
  COALESCE(phone, '') || ' ' ||
  COALESCE(address, '')
));

CREATE INDEX IF NOT EXISTS idx_services_fulltext ON services 
USING gin(to_tsvector('spanish_config', 
  name || ' ' || 
  COALESCE(description, '') || ' ' || 
  COALESCE(short_description, '') || ' ' ||
  category::text
));

-- =====================================================
-- ÍNDICES PARA CONSULTAS GEOGRÁFICAS (FUTURO)
-- =====================================================

-- Si se implementa funcionalidad geográfica
-- CREATE EXTENSION IF NOT EXISTS postgis;
-- CREATE INDEX IF NOT EXISTS idx_clients_location ON clients USING gist(location);
-- CREATE INDEX IF NOT EXISTS idx_services_location ON services USING gist(location);

-- =====================================================
-- ESTADÍSTICAS Y MANTENIMIENTO
-- =====================================================

-- Función para actualizar estadísticas de todas las tablas
CREATE OR REPLACE FUNCTION update_table_statistics()
RETURNS void AS $$
BEGIN
  ANALYZE users;
  ANALYZE clients;
  ANALYZE services;
  ANALYZE bookings;
  ANALYZE audit_logs;
  ANALYZE user_sessions;
  ANALYZE login_attempts;
  ANALYZE user_permissions;
  ANALYZE permissions;
  
  -- Log de actualización
  INSERT INTO audit_logs (action, method, url, ip_address, status_code, duration_ms, success, metadata)
  VALUES (
    'UPDATE_STATISTICS',
    'SYSTEM',
    '/system/maintenance',
    '127.0.0.1'::inet,
    200,
    0,
    true,
    jsonb_build_object('timestamp', NOW(), 'type', 'statistics_update')
  );
END;
$$ LANGUAGE plpgsql;

-- Función para obtener información de índices
CREATE OR REPLACE FUNCTION get_index_usage_stats()
RETURNS TABLE (
  schemaname text,
  tablename text,
  indexname text,
  idx_scan bigint,
  idx_tup_read bigint,
  idx_tup_fetch bigint,
  size_mb numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.schemaname::text,
    s.tablename::text,
    s.indexname::text,
    s.idx_scan,
    s.idx_tup_read,
    s.idx_tup_fetch,
    ROUND(pg_relation_size(s.indexrelid) / 1024.0 / 1024.0, 2) as size_mb
  FROM pg_stat_user_indexes s
  JOIN pg_index i ON s.indexrelid = i.indexrelid
  WHERE s.schemaname = 'public'
  ORDER BY s.idx_scan DESC, size_mb DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para detectar índices no utilizados
CREATE OR REPLACE FUNCTION get_unused_indexes()
RETURNS TABLE (
  schemaname text,
  tablename text,
  indexname text,
  size_mb numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.schemaname::text,
    s.tablename::text,
    s.indexname::text,
    ROUND(pg_relation_size(s.indexrelid) / 1024.0 / 1024.0, 2) as size_mb
  FROM pg_stat_user_indexes s
  JOIN pg_index i ON s.indexrelid = i.indexrelid
  WHERE s.schemaname = 'public'
    AND s.idx_scan = 0
    AND NOT i.indisunique
    AND NOT i.indisprimary
  ORDER BY size_mb DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener consultas lentas
CREATE OR REPLACE FUNCTION get_slow_queries()
RETURNS TABLE (
  query text,
  calls bigint,
  total_time numeric,
  mean_time numeric,
  rows bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pg_stat_statements.query,
    pg_stat_statements.calls,
    ROUND(pg_stat_statements.total_exec_time::numeric, 2) as total_time,
    ROUND(pg_stat_statements.mean_exec_time::numeric, 2) as mean_time,
    pg_stat_statements.rows
  FROM pg_stat_statements
  WHERE pg_stat_statements.mean_exec_time > 100 -- Más de 100ms
  ORDER BY pg_stat_statements.mean_exec_time DESC
  LIMIT 20;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'pg_stat_statements extension not available';
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CONFIGURACIÓN DE AUTOVACUUM OPTIMIZADA
-- =====================================================

-- Configurar autovacuum para tablas críticas
ALTER TABLE bookings SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_vacuum_cost_delay = 10
);

ALTER TABLE audit_logs SET (
  autovacuum_vacuum_scale_factor = 0.2,
  autovacuum_analyze_scale_factor = 0.1,
  autovacuum_vacuum_cost_delay = 20
);

ALTER TABLE user_sessions SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

-- =====================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- =====================================================

COMMENT ON FUNCTION update_table_statistics() IS 'Actualiza las estadísticas de todas las tablas principales para optimizar el query planner';
COMMENT ON FUNCTION get_index_usage_stats() IS 'Obtiene estadísticas de uso de índices para identificar optimizaciones';
COMMENT ON FUNCTION get_unused_indexes() IS 'Identifica índices no utilizados que pueden ser eliminados para ahorrar espacio';
COMMENT ON FUNCTION get_slow_queries() IS 'Obtiene las consultas más lentas del sistema (requiere pg_stat_statements)';

-- =====================================================
-- PROGRAMAR MANTENIMIENTO AUTOMÁTICO
-- =====================================================

-- Crear función para mantenimiento nocturno
CREATE OR REPLACE FUNCTION nightly_maintenance()
RETURNS void AS $$
BEGIN
  -- Actualizar estadísticas
  PERFORM update_table_statistics();
  
  -- Limpiar sesiones expiradas
  PERFORM cleanup_expired_sessions();
  
  -- Limpiar tokens revocados expirados
  PERFORM cleanup_expired_revoked_tokens();
  
  -- Limpiar logs de auditoría antiguos
  PERFORM cleanup_old_audit_logs();
  
  -- Log de mantenimiento completado
  INSERT INTO audit_logs (action, method, url, ip_address, status_code, duration_ms, success, metadata)
  VALUES (
    'NIGHTLY_MAINTENANCE',
    'SYSTEM',
    '/system/maintenance',
    '127.0.0.1'::inet,
    200,
    0,
    true,
    jsonb_build_object('timestamp', NOW(), 'type', 'nightly_maintenance')
  );
END;
$$ LANGUAGE plpgsql;

-- Nota: Para programar la ejecución automática, usar cron o pg_cron:
-- SELECT cron.schedule('nightly-maintenance', '0 2 * * *', 'SELECT nightly_maintenance();');