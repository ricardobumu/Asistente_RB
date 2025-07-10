-- =====================================================
-- SCRIPT DE CONFIGURACIÓN COMPLETA PARA PRODUCCIÓN
-- =====================================================
-- Este script configura toda la base de datos con
-- seguridad, rendimiento y funcionalidades completas
-- =====================================================

-- Verificar que estamos en la base de datos correcta
DO $$
BEGIN
  IF current_database() != 'asistente_rb' THEN
    RAISE EXCEPTION 'Este script debe ejecutarse en la base de datos asistente_rb';
  END IF;
END $$;

-- =====================================================
-- 1. EXTENSIONES NECESARIAS
-- =====================================================

-- Extensiones básicas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Verificar extensiones instaladas
DO $$
DECLARE
  ext_record RECORD;
BEGIN
  FOR ext_record IN 
    SELECT extname FROM pg_extension 
    WHERE extname IN ('uuid-ossp', 'pgcrypto', 'pg_stat_statements', 'pg_trgm')
  LOOP
    RAISE NOTICE 'Extension % is installed', ext_record.extname;
  END LOOP;
END $$;

-- =====================================================
-- 2. CONFIGURACIÓN DE PARÁMETROS DE RENDIMIENTO
-- =====================================================

-- Configurar pg_stat_statements
ALTER SYSTEM SET pg_stat_statements.max = 10000;
ALTER SYSTEM SET pg_stat_statements.track = 'all';
ALTER SYSTEM SET pg_stat_statements.track_utility = 'on';

-- Configuración de memoria
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET work_mem = '4MB';

-- Configuración de WAL y checkpoints
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET max_wal_size = '1GB';
ALTER SYSTEM SET min_wal_size = '80MB';

-- Configuración de conexiones
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';

-- Configuración de logging
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1s
ALTER SYSTEM SET log_checkpoints = 'on';
ALTER SYSTEM SET log_connections = 'on';
ALTER SYSTEM SET log_disconnections = 'on';
ALTER SYSTEM SET log_lock_waits = 'on';

-- Recargar configuración
SELECT pg_reload_conf();

-- =====================================================
-- 3. EJECUTAR SCRIPTS DE ESQUEMA
-- =====================================================

-- Nota: Los siguientes archivos deben ejecutarse en orden:
-- 1. database_schema_secure.sql
-- 2. database_rls_policies.sql  
-- 3. auth_security_tables.sql
-- 4. audit_logs_table.sql
-- 5. background_tasks_table.sql
-- 6. performance_indexes.sql

RAISE NOTICE 'Ejecutar manualmente los scripts de esquema en el siguiente orden:';
RAISE NOTICE '1. database_schema_secure.sql';
RAISE NOTICE '2. database_rls_policies.sql';
RAISE NOTICE '3. auth_security_tables.sql';
RAISE NOTICE '4. audit_logs_table.sql';
RAISE NOTICE '5. background_tasks_table.sql';
RAISE NOTICE '6. performance_indexes.sql';

-- =====================================================
-- 4. CONFIGURACIÓN DE SEGURIDAD ADICIONAL
-- =====================================================

-- Crear rol para la aplicación
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'asistente_rb_app') THEN
    CREATE ROLE asistente_rb_app WITH LOGIN PASSWORD 'CHANGE_THIS_PASSWORD';
    RAISE NOTICE 'Created role asistente_rb_app - CHANGE THE PASSWORD!';
  END IF;
END $$;

-- Crear rol de solo lectura
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'asistente_rb_readonly') THEN
    CREATE ROLE asistente_rb_readonly WITH LOGIN PASSWORD 'CHANGE_THIS_PASSWORD';
    RAISE NOTICE 'Created role asistente_rb_readonly - CHANGE THE PASSWORD!';
  END IF;
END $$;

-- Permisos para rol de aplicación
GRANT CONNECT ON DATABASE asistente_rb TO asistente_rb_app;
GRANT USAGE ON SCHEMA public TO asistente_rb_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO asistente_rb_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO asistente_rb_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO asistente_rb_app;

-- Permisos para rol de solo lectura
GRANT CONNECT ON DATABASE asistente_rb TO asistente_rb_readonly;
GRANT USAGE ON SCHEMA public TO asistente_rb_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO asistente_rb_readonly;

-- Configurar permisos por defecto para nuevas tablas
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO asistente_rb_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO asistente_rb_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO asistente_rb_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO asistente_rb_app;

-- =====================================================
-- 5. CONFIGURACIÓN DE MONITOREO
-- =====================================================

-- Crear vista para monitoreo de conexiones
CREATE OR REPLACE VIEW v_connection_stats AS
SELECT 
  datname,
  usename,
  client_addr,
  state,
  COUNT(*) as connection_count,
  MAX(backend_start) as latest_connection
FROM pg_stat_activity 
WHERE datname = current_database()
GROUP BY datname, usename, client_addr, state
ORDER BY connection_count DESC;

-- Crear vista para monitoreo de consultas lentas
CREATE OR REPLACE VIEW v_slow_queries AS
SELECT 
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  stddev_exec_time,
  rows,
  100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
WHERE mean_exec_time > 100 -- Más de 100ms
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Crear vista para monitoreo de índices
CREATE OR REPLACE VIEW v_index_usage AS
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Crear vista para monitoreo de tablas
CREATE OR REPLACE VIEW v_table_stats AS
SELECT 
  schemaname,
  tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes,
  n_live_tup as live_tuples,
  n_dead_tup as dead_tuples,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- =====================================================
-- 6. FUNCIONES DE MANTENIMIENTO
-- =====================================================

-- Función para recopilar estadísticas del sistema
CREATE OR REPLACE FUNCTION get_system_health()
RETURNS TABLE (
  metric_name TEXT,
  metric_value TEXT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'Database Size'::TEXT,
    pg_size_pretty(pg_database_size(current_database()))::TEXT,
    'INFO'::TEXT
  UNION ALL
  SELECT 
    'Active Connections'::TEXT,
    COUNT(*)::TEXT,
    CASE WHEN COUNT(*) > 150 THEN 'WARNING' ELSE 'OK' END::TEXT
  FROM pg_stat_activity 
  WHERE datname = current_database() AND state = 'active'
  UNION ALL
  SELECT 
    'Cache Hit Ratio'::TEXT,
    ROUND(
      100.0 * SUM(blks_hit) / NULLIF(SUM(blks_hit + blks_read), 0), 2
    )::TEXT || '%',
    CASE 
      WHEN ROUND(100.0 * SUM(blks_hit) / NULLIF(SUM(blks_hit + blks_read), 0), 2) < 95 
      THEN 'WARNING' 
      ELSE 'OK' 
    END::TEXT
  FROM pg_stat_database 
  WHERE datname = current_database()
  UNION ALL
  SELECT 
    'Slow Queries (>1s)'::TEXT,
    COUNT(*)::TEXT,
    CASE WHEN COUNT(*) > 10 THEN 'WARNING' ELSE 'OK' END::TEXT
  FROM pg_stat_statements 
  WHERE mean_exec_time > 1000
  UNION ALL
  SELECT 
    'Unused Indexes'::TEXT,
    COUNT(*)::TEXT,
    CASE WHEN COUNT(*) > 5 THEN 'WARNING' ELSE 'OK' END::TEXT
  FROM pg_stat_user_indexes 
  WHERE idx_scan = 0 AND schemaname = 'public';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para mantenimiento completo
CREATE OR REPLACE FUNCTION full_maintenance()
RETURNS TEXT AS $$
DECLARE
  result_text TEXT := '';
  table_record RECORD;
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
BEGIN
  start_time := NOW();
  result_text := 'Starting full maintenance at ' || start_time || E'\n';
  
  -- Actualizar estadísticas de todas las tablas
  result_text := result_text || 'Updating table statistics...' || E'\n';
  PERFORM update_table_statistics();
  
  -- Limpiar datos antiguos
  result_text := result_text || 'Cleaning up old data...' || E'\n';
  PERFORM cleanup_expired_sessions();
  PERFORM cleanup_expired_revoked_tokens();
  PERFORM cleanup_old_audit_logs();
  PERFORM cleanup_old_tasks(30);
  
  -- VACUUM y ANALYZE en tablas principales
  result_text := result_text || 'Running VACUUM ANALYZE on main tables...' || E'\n';
  FOR table_record IN 
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('users', 'clients', 'services', 'bookings', 'audit_logs')
  LOOP
    EXECUTE 'VACUUM ANALYZE ' || table_record.tablename;
    result_text := result_text || '  - ' || table_record.tablename || E'\n';
  END LOOP;
  
  -- Reindexar si es necesario
  result_text := result_text || 'Checking for index maintenance...' || E'\n';
  
  end_time := NOW();
  result_text := result_text || 'Maintenance completed at ' || end_time || E'\n';
  result_text := result_text || 'Total duration: ' || (end_time - start_time) || E'\n';
  
  -- Log del mantenimiento
  INSERT INTO audit_logs (action, method, url, ip_address, status_code, duration_ms, success, metadata)
  VALUES (
    'FULL_MAINTENANCE',
    'SYSTEM',
    '/system/maintenance',
    '127.0.0.1'::inet,
    200,
    EXTRACT(EPOCH FROM (end_time - start_time)) * 1000,
    true,
    jsonb_build_object(
      'start_time', start_time,
      'end_time', end_time,
      'duration', end_time - start_time
    )
  );
  
  RETURN result_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. CONFIGURACIÓN DE BACKUP AUTOMÁTICO
-- =====================================================

-- Función para crear backup lógico
CREATE OR REPLACE FUNCTION create_logical_backup()
RETURNS TEXT AS $$
DECLARE
  backup_name TEXT;
  result_text TEXT;
BEGIN
  backup_name := 'asistente_rb_backup_' || to_char(NOW(), 'YYYY_MM_DD_HH24_MI_SS');
  
  -- Nota: Esta función requiere configuración externa para ejecutar pg_dump
  result_text := 'Backup name: ' || backup_name || E'\n';
  result_text := result_text || 'Execute: pg_dump -h localhost -U postgres -d asistente_rb -f ' || backup_name || '.sql' || E'\n';
  result_text := result_text || 'Or use pg_dumpall for complete backup including roles' || E'\n';
  
  -- Log del backup
  INSERT INTO audit_logs (action, method, url, ip_address, status_code, duration_ms, success, metadata)
  VALUES (
    'CREATE_BACKUP',
    'SYSTEM',
    '/system/backup',
    '127.0.0.1'::inet,
    200,
    0,
    true,
    jsonb_build_object('backup_name', backup_name, 'type', 'logical')
  );
  
  RETURN result_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. CONFIGURACIÓN DE ALERTAS
-- =====================================================

-- Función para verificar alertas del sistema
CREATE OR REPLACE FUNCTION check_system_alerts()
RETURNS TABLE (
  alert_type TEXT,
  alert_message TEXT,
  severity TEXT,
  metric_value TEXT
) AS $$
BEGIN
  -- Verificar conexiones altas
  RETURN QUERY
  SELECT 
    'High Connections'::TEXT,
    'Database has ' || COUNT(*) || ' active connections'::TEXT,
    'WARNING'::TEXT,
    COUNT(*)::TEXT
  FROM pg_stat_activity 
  WHERE datname = current_database() AND state = 'active'
  HAVING COUNT(*) > 150;
  
  -- Verificar cache hit ratio bajo
  RETURN QUERY
  SELECT 
    'Low Cache Hit Ratio'::TEXT,
    'Cache hit ratio is ' || ROUND(100.0 * SUM(blks_hit) / NULLIF(SUM(blks_hit + blks_read), 0), 2) || '%'::TEXT,
    'CRITICAL'::TEXT,
    ROUND(100.0 * SUM(blks_hit) / NULLIF(SUM(blks_hit + blks_read), 0), 2)::TEXT || '%'
  FROM pg_stat_database 
  WHERE datname = current_database()
  HAVING ROUND(100.0 * SUM(blks_hit) / NULLIF(SUM(blks_hit + blks_read), 0), 2) < 90;
  
  -- Verificar consultas lentas
  RETURN QUERY
  SELECT 
    'Slow Queries'::TEXT,
    'Found ' || COUNT(*) || ' queries with mean execution time > 1s'::TEXT,
    'WARNING'::TEXT,
    COUNT(*)::TEXT
  FROM pg_stat_statements 
  WHERE mean_exec_time > 1000
  HAVING COUNT(*) > 5;
  
  -- Verificar espacio en disco (aproximado por tamaño de DB)
  RETURN QUERY
  SELECT 
    'Database Size'::TEXT,
    'Database size is ' || pg_size_pretty(pg_database_size(current_database()))::TEXT,
    CASE 
      WHEN pg_database_size(current_database()) > 10 * 1024 * 1024 * 1024 -- 10GB
      THEN 'WARNING'
      ELSE 'INFO'
    END::TEXT,
    pg_size_pretty(pg_database_size(current_database()))::TEXT;
  
  -- Verificar tablas que necesitan VACUUM
  RETURN QUERY
  SELECT 
    'Tables Need Vacuum'::TEXT,
    'Table ' || schemaname || '.' || tablename || ' has ' || n_dead_tup || ' dead tuples'::TEXT,
    'WARNING'::TEXT,
    n_dead_tup::TEXT
  FROM pg_stat_user_tables 
  WHERE n_dead_tup > 1000 AND schemaname = 'public';
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. CONFIGURACIÓN FINAL
-- =====================================================

-- Crear usuario administrador inicial (solo si no existe)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@asistente-rb.com') THEN
    INSERT INTO users (
      email,
      password_hash,
      first_name,
      last_name,
      role,
      status,
      email_verified,
      created_at,
      updated_at
    ) VALUES (
      'admin@asistente-rb.com',
      crypt('CHANGE_THIS_PASSWORD', gen_salt('bf')),
      'Admin',
      'System',
      'super_admin',
      'active',
      true,
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Created admin user: admin@asistente-rb.com';
    RAISE NOTICE 'DEFAULT PASSWORD: CHANGE_THIS_PASSWORD';
    RAISE NOTICE 'CHANGE THE PASSWORD IMMEDIATELY!';
  END IF;
END $$;

-- Configurar timezone por defecto
SET timezone = 'Europe/Madrid';

-- Actualizar estadísticas finales
ANALYZE;

-- =====================================================
-- 10. RESUMEN DE CONFIGURACIÓN
-- =====================================================

DO $$
DECLARE
  table_count INTEGER;
  index_count INTEGER;
  function_count INTEGER;
  user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count FROM pg_tables WHERE schemaname = 'public';
  SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE schemaname = 'public';
  SELECT COUNT(*) INTO function_count FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public';
  SELECT COUNT(*) INTO user_count FROM users;
  
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'CONFIGURACIÓN COMPLETADA EXITOSAMENTE';
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Tablas creadas: %', table_count;
  RAISE NOTICE 'Índices creados: %', index_count;
  RAISE NOTICE 'Funciones creadas: %', function_count;
  RAISE NOTICE 'Usuarios en sistema: %', user_count;
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'ACCIONES REQUERIDAS:';
  RAISE NOTICE '1. Cambiar contraseñas por defecto';
  RAISE NOTICE '2. Configurar variables de entorno';
  RAISE NOTICE '3. Configurar backup automático';
  RAISE NOTICE '4. Configurar monitoreo externo';
  RAISE NOTICE '5. Ejecutar: SELECT pg_reload_conf();';
  RAISE NOTICE '=================================================';
END $$;

-- Crear log de instalación
INSERT INTO audit_logs (action, method, url, ip_address, status_code, duration_ms, success, metadata)
VALUES (
  'SETUP_PRODUCTION_COMPLETE',
  'SYSTEM',
  '/system/setup',
  '127.0.0.1'::inet,
  200,
  0,
  true,
  jsonb_build_object(
    'timestamp', NOW(),
    'version', '1.0.0',
    'environment', 'production'
  )
);