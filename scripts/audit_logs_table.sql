-- =====================================================
-- TABLA DE LOGS DE AUDITORÍA
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Información de la request
  action VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  url TEXT NOT NULL,
  
  -- Información del cliente
  ip_address INET NOT NULL,
  user_agent TEXT,
  user_id UUID REFERENCES users(id),
  session_id VARCHAR(255),
  
  -- Información de la respuesta
  status_code INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  
  -- Datos de request/response (opcional)
  request_data JSONB,
  response_data JSONB,
  headers JSONB,
  
  -- Timestamps
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Metadatos adicionales
  metadata JSONB DEFAULT '{}'
);

-- Índices para optimizar consultas
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_ip_address ON audit_logs(ip_address);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_status_code ON audit_logs(status_code);
CREATE INDEX idx_audit_logs_success ON audit_logs(success);
CREATE INDEX idx_audit_logs_method_url ON audit_logs(method, url);

-- Índice compuesto para consultas comunes
CREATE INDEX idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_audit_logs_ip_timestamp ON audit_logs(ip_address, timestamp DESC);

-- Índices GIN para búsquedas en JSON
CREATE INDEX idx_audit_logs_request_data ON audit_logs USING GIN(request_data);
CREATE INDEX idx_audit_logs_response_data ON audit_logs USING GIN(response_data);
CREATE INDEX idx_audit_logs_headers ON audit_logs USING GIN(headers);
CREATE INDEX idx_audit_logs_metadata ON audit_logs USING GIN(metadata);

-- =====================================================
-- POLÍTICAS RLS PARA AUDIT LOGS
-- =====================================================

-- Habilitar RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Solo super admins pueden ver todos los logs
CREATE POLICY "audit_logs_select_super_admin" ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'super_admin'
      AND users.status = 'active'
    )
  );

-- Admins pueden ver logs relacionados con su área
CREATE POLICY "audit_logs_select_admin" ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'manager')
      AND users.status = 'active'
    )
    AND (
      user_id = auth.uid() OR
      action NOT LIKE '%admin%' OR
      timestamp >= NOW() - INTERVAL '30 days'
    )
  );

-- Los usuarios pueden ver sus propios logs (limitado)
CREATE POLICY "audit_logs_select_own" ON audit_logs
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND timestamp >= NOW() - INTERVAL '7 days'
    AND action NOT LIKE '%admin%'
  );

-- Solo el sistema puede insertar logs
CREATE POLICY "audit_logs_insert_system" ON audit_logs
  FOR INSERT
  WITH CHECK (true); -- Se controla a nivel de aplicación

-- Nadie puede actualizar o eliminar logs (inmutables)
CREATE POLICY "audit_logs_no_update" ON audit_logs
  FOR UPDATE
  USING (false);

CREATE POLICY "audit_logs_no_delete" ON audit_logs
  FOR DELETE
  USING (false);

-- =====================================================
-- FUNCIONES AUXILIARES PARA AUDIT LOGS
-- =====================================================

-- Función para limpiar logs antiguos (ejecutar periódicamente)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Eliminar logs de más de 1 año (excepto eventos críticos)
  DELETE FROM audit_logs 
  WHERE timestamp < NOW() - INTERVAL '1 year'
  AND success = true
  AND status_code < 400
  AND action NOT LIKE '%admin%'
  AND action NOT LIKE '%delete%'
  AND action NOT LIKE '%cancel%';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log de la limpieza
  INSERT INTO audit_logs (action, method, url, ip_address, status_code, duration_ms, success, metadata)
  VALUES (
    'CLEANUP_AUDIT_LOGS',
    'SYSTEM',
    '/system/cleanup',
    '127.0.0.1'::inet,
    200,
    0,
    true,
    jsonb_build_object('deleted_count', deleted_count)
  );
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener estadísticas de auditoría
CREATE OR REPLACE FUNCTION get_audit_stats(
  start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  total_requests BIGINT,
  successful_requests BIGINT,
  failed_requests BIGINT,
  avg_duration_ms NUMERIC,
  top_actions TEXT[],
  top_ips INET[],
  error_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE success = true) as successful_requests,
    COUNT(*) FILTER (WHERE success = false) as failed_requests,
    ROUND(AVG(duration_ms), 2) as avg_duration_ms,
    ARRAY(
      SELECT action 
      FROM audit_logs 
      WHERE timestamp BETWEEN start_date AND end_date
      GROUP BY action 
      ORDER BY COUNT(*) DESC 
      LIMIT 10
    ) as top_actions,
    ARRAY(
      SELECT ip_address 
      FROM audit_logs 
      WHERE timestamp BETWEEN start_date AND end_date
      GROUP BY ip_address 
      ORDER BY COUNT(*) DESC 
      LIMIT 10
    ) as top_ips,
    ROUND(
      (COUNT(*) FILTER (WHERE success = false)::NUMERIC / COUNT(*)) * 100, 
      2
    ) as error_rate
  FROM audit_logs
  WHERE timestamp BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS PARA AUDIT LOGS
-- =====================================================

-- Trigger para prevenir modificaciones
CREATE OR REPLACE FUNCTION prevent_audit_log_modifications()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified';
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger
CREATE TRIGGER prevent_audit_log_updates
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modifications();

CREATE TRIGGER prevent_audit_log_deletes
  BEFORE DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modifications();

-- =====================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE audit_logs IS 'Registro inmutable de todas las operaciones del sistema para auditoría y seguridad';
COMMENT ON COLUMN audit_logs.action IS 'Descripción de la acción realizada';
COMMENT ON COLUMN audit_logs.method IS 'Método HTTP utilizado';
COMMENT ON COLUMN audit_logs.url IS 'URL completa de la request';
COMMENT ON COLUMN audit_logs.ip_address IS 'Dirección IP del cliente';
COMMENT ON COLUMN audit_logs.user_id IS 'ID del usuario que realizó la acción (si aplica)';
COMMENT ON COLUMN audit_logs.status_code IS 'Código de estado HTTP de la respuesta';
COMMENT ON COLUMN audit_logs.duration_ms IS 'Duración de la request en milisegundos';
COMMENT ON COLUMN audit_logs.success IS 'Indica si la operación fue exitosa';
COMMENT ON COLUMN audit_logs.request_data IS 'Datos de la request (sanitizados)';
COMMENT ON COLUMN audit_logs.response_data IS 'Datos de la respuesta (sanitizados)';
COMMENT ON COLUMN audit_logs.headers IS 'Headers HTTP relevantes';
COMMENT ON COLUMN audit_logs.metadata IS 'Metadatos adicionales específicos de la operación';