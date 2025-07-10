-- =====================================================
-- TABLA PARA TAREAS EN BACKGROUND
-- =====================================================

-- Tipos de estado para tareas
CREATE TYPE task_status AS ENUM (
  'pending',
  'processing', 
  'completed',
  'failed',
  'cancelled'
);

-- Tipos de prioridad
CREATE TYPE task_priority AS ENUM (
  'low',
  'normal',
  'high',
  'critical'
);

-- Tabla principal de tareas en background
CREATE TABLE IF NOT EXISTS background_tasks (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Información de la tarea
  task_type VARCHAR(100) NOT NULL,
  task_data JSONB NOT NULL DEFAULT '{}',
  
  -- Configuración
  priority task_priority DEFAULT 'normal',
  max_attempts INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 300, -- 5 minutos por defecto
  
  -- Estado y programación
  status task_status DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  
  -- Información de ejecución
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  worker_id VARCHAR(100), -- ID del worker que procesa la tarea
  
  -- Resultados
  result_data JSONB,
  execution_time_ms INTEGER,
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  -- Metadatos adicionales
  metadata JSONB DEFAULT '{}',
  
  -- Constraints
  CONSTRAINT valid_attempts CHECK (attempts >= 0 AND attempts <= max_attempts),
  CONSTRAINT valid_timeout CHECK (timeout_seconds > 0),
  CONSTRAINT valid_execution_time CHECK (execution_time_ms >= 0)
);

-- Índices para optimizar consultas
CREATE INDEX idx_background_tasks_status ON background_tasks(status);
CREATE INDEX idx_background_tasks_priority ON background_tasks(priority);
CREATE INDEX idx_background_tasks_scheduled_at ON background_tasks(scheduled_at);
CREATE INDEX idx_background_tasks_task_type ON background_tasks(task_type);
CREATE INDEX idx_background_tasks_worker_id ON background_tasks(worker_id);
CREATE INDEX idx_background_tasks_created_at ON background_tasks(created_at);

-- Índices compuestos para consultas frecuentes
CREATE INDEX idx_background_tasks_pending ON background_tasks(status, priority DESC, scheduled_at) 
WHERE status = 'pending';

CREATE INDEX idx_background_tasks_processing ON background_tasks(status, worker_id, started_at) 
WHERE status = 'processing';

CREATE INDEX idx_background_tasks_failed ON background_tasks(status, attempts, max_attempts) 
WHERE status = 'failed';

-- Índice para tareas por tipo y estado
CREATE INDEX idx_background_tasks_type_status ON background_tasks(task_type, status, created_at DESC);

-- Índice GIN para búsquedas en task_data
CREATE INDEX idx_background_tasks_data ON background_tasks USING gin(task_data);

-- Índice GIN para metadatos
CREATE INDEX idx_background_tasks_metadata ON background_tasks USING gin(metadata);

-- =====================================================
-- TABLA DE CONFIGURACIÓN DE TAREAS
-- =====================================================

CREATE TABLE IF NOT EXISTS task_configurations (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_type VARCHAR(100) NOT NULL UNIQUE,
  
  -- Configuración por defecto
  default_priority task_priority DEFAULT 'normal',
  default_max_attempts INTEGER DEFAULT 3,
  default_timeout_seconds INTEGER DEFAULT 300,
  
  -- Configuración de retry
  retry_delay_seconds INTEGER DEFAULT 30,
  retry_backoff_multiplier NUMERIC DEFAULT 2.0,
  max_retry_delay_seconds INTEGER DEFAULT 3600, -- 1 hora máximo
  
  -- Configuración de concurrencia
  max_concurrent_tasks INTEGER DEFAULT 5,
  rate_limit_per_minute INTEGER,
  
  -- Estado
  is_enabled BOOLEAN DEFAULT TRUE,
  
  -- Configuración específica
  configuration JSONB DEFAULT '{}',
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  
  -- Constraints
  CONSTRAINT valid_max_attempts CHECK (default_max_attempts > 0),
  CONSTRAINT valid_timeout CHECK (default_timeout_seconds > 0),
  CONSTRAINT valid_retry_delay CHECK (retry_delay_seconds >= 0),
  CONSTRAINT valid_backoff CHECK (retry_backoff_multiplier >= 1.0),
  CONSTRAINT valid_max_retry_delay CHECK (max_retry_delay_seconds >= retry_delay_seconds),
  CONSTRAINT valid_concurrent_tasks CHECK (max_concurrent_tasks > 0)
);

-- Índices para configuraciones
CREATE INDEX idx_task_configurations_type ON task_configurations(task_type);
CREATE INDEX idx_task_configurations_enabled ON task_configurations(is_enabled);

-- =====================================================
-- TABLA DE ESTADÍSTICAS DE TAREAS
-- =====================================================

CREATE TABLE IF NOT EXISTS task_statistics (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_type VARCHAR(100) NOT NULL,
  
  -- Período de estadísticas
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Contadores
  total_tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  failed_tasks INTEGER DEFAULT 0,
  cancelled_tasks INTEGER DEFAULT 0,
  
  -- Métricas de tiempo
  avg_execution_time_ms NUMERIC,
  min_execution_time_ms INTEGER,
  max_execution_time_ms INTEGER,
  total_execution_time_ms BIGINT DEFAULT 0,
  
  -- Métricas de retry
  total_retries INTEGER DEFAULT 0,
  avg_attempts NUMERIC,
  
  -- Métricas de cola
  avg_queue_time_ms NUMERIC,
  max_queue_time_ms INTEGER,
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_period CHECK (period_end > period_start),
  CONSTRAINT valid_counters CHECK (
    total_tasks >= 0 AND 
    completed_tasks >= 0 AND 
    failed_tasks >= 0 AND 
    cancelled_tasks >= 0 AND
    (completed_tasks + failed_tasks + cancelled_tasks) <= total_tasks
  ),
  CONSTRAINT valid_execution_times CHECK (
    avg_execution_time_ms >= 0 AND
    min_execution_time_ms >= 0 AND
    max_execution_time_ms >= 0 AND
    total_execution_time_ms >= 0
  ),
  
  UNIQUE(task_type, period_start, period_end)
);

-- Índices para estadísticas
CREATE INDEX idx_task_statistics_type ON task_statistics(task_type);
CREATE INDEX idx_task_statistics_period ON task_statistics(period_start, period_end);
CREATE INDEX idx_task_statistics_type_period ON task_statistics(task_type, period_start DESC);

-- =====================================================
-- INSERTAR CONFIGURACIONES BÁSICAS
-- =====================================================

INSERT INTO task_configurations (task_type, default_priority, default_max_attempts, default_timeout_seconds, configuration) VALUES
('send_email', 'normal', 3, 60, '{"template_engine": "handlebars", "retry_on_rate_limit": true}'),
('send_whatsapp', 'high', 5, 30, '{"retry_on_rate_limit": true, "fallback_to_sms": false}'),
('send_sms', 'high', 3, 30, '{"retry_on_rate_limit": true}'),
('sync_calendar', 'normal', 3, 120, '{"create_meet_link": true, "send_invites": true}'),
('process_booking', 'high', 3, 180, '{"auto_confirm": false, "send_notifications": true}'),
('send_reminder', 'normal', 2, 60, '{"reminder_types": ["email", "whatsapp"], "advance_hours": [24, 2]}'),
('cleanup_data', 'low', 1, 1800, '{"batch_size": 1000, "max_age_days": 90}'),
('generate_report', 'low', 2, 600, '{"format": "pdf", "include_charts": true}'),
('backup_data', 'low', 1, 3600, '{"compression": true, "encryption": true}'),
('update_statistics', 'low', 1, 300, '{"update_indexes": true, "vacuum_analyze": false}')
ON CONFLICT (task_type) DO NOTHING;

-- =====================================================
-- FUNCIONES AUXILIARES
-- =====================================================

-- Función para obtener próximas tareas a procesar
CREATE OR REPLACE FUNCTION get_next_tasks(
  worker_id_param VARCHAR(100),
  max_tasks INTEGER DEFAULT 10
)
RETURNS TABLE (
  task_id UUID,
  task_type VARCHAR(100),
  task_data JSONB,
  priority task_priority,
  attempts INTEGER,
  max_attempts INTEGER,
  timeout_seconds INTEGER
) AS $$
BEGIN
  -- Marcar tareas como en procesamiento y devolverlas
  RETURN QUERY
  UPDATE background_tasks 
  SET 
    status = 'processing',
    started_at = NOW(),
    worker_id = worker_id_param,
    updated_at = NOW()
  WHERE id IN (
    SELECT bt.id
    FROM background_tasks bt
    WHERE bt.status = 'pending'
      AND bt.scheduled_at <= NOW()
      AND bt.attempts < bt.max_attempts
    ORDER BY bt.priority DESC, bt.scheduled_at ASC
    LIMIT max_tasks
    FOR UPDATE SKIP LOCKED
  )
  RETURNING 
    id as task_id,
    background_tasks.task_type,
    background_tasks.task_data,
    background_tasks.priority,
    background_tasks.attempts,
    background_tasks.max_attempts,
    background_tasks.timeout_seconds;
END;
$$ LANGUAGE plpgsql;

-- Función para marcar tarea como completada
CREATE OR REPLACE FUNCTION complete_task(
  task_id_param UUID,
  result_data_param JSONB DEFAULT NULL,
  execution_time_ms_param INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  updated_rows INTEGER;
BEGIN
  UPDATE background_tasks
  SET 
    status = 'completed',
    completed_at = NOW(),
    result_data = result_data_param,
    execution_time_ms = execution_time_ms_param,
    updated_at = NOW()
  WHERE id = task_id_param
    AND status = 'processing';
  
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows > 0;
END;
$$ LANGUAGE plpgsql;

-- Función para marcar tarea como fallida
CREATE OR REPLACE FUNCTION fail_task(
  task_id_param UUID,
  error_message TEXT,
  should_retry BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN AS $$
DECLARE
  task_record RECORD;
  updated_rows INTEGER;
  next_scheduled_at TIMESTAMPTZ;
  config_record RECORD;
BEGIN
  -- Obtener información de la tarea y configuración
  SELECT bt.*, tc.retry_delay_seconds, tc.retry_backoff_multiplier, tc.max_retry_delay_seconds
  INTO task_record, config_record
  FROM background_tasks bt
  LEFT JOIN task_configurations tc ON bt.task_type = tc.task_type
  WHERE bt.id = task_id_param;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Calcular próximo intento si debe reintentar
  IF should_retry AND task_record.attempts + 1 < task_record.max_attempts THEN
    -- Calcular delay con backoff exponencial
    next_scheduled_at := NOW() + INTERVAL '1 second' * LEAST(
      COALESCE(config_record.retry_delay_seconds, 30) * POWER(COALESCE(config_record.retry_backoff_multiplier, 2.0), task_record.attempts),
      COALESCE(config_record.max_retry_delay_seconds, 3600)
    );
    
    UPDATE background_tasks
    SET 
      status = 'pending',
      attempts = attempts + 1,
      last_error = error_message,
      scheduled_at = next_scheduled_at,
      worker_id = NULL,
      started_at = NULL,
      updated_at = NOW()
    WHERE id = task_id_param;
  ELSE
    -- Marcar como fallida permanentemente
    UPDATE background_tasks
    SET 
      status = 'failed',
      failed_at = NOW(),
      attempts = attempts + 1,
      last_error = error_message,
      updated_at = NOW()
    WHERE id = task_id_param;
  END IF;
  
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows > 0;
END;
$$ LANGUAGE plpgsql;

-- Función para limpiar tareas antiguas
CREATE OR REPLACE FUNCTION cleanup_old_tasks(
  days_old INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Eliminar tareas completadas o fallidas más antiguas que X días
  DELETE FROM background_tasks
  WHERE status IN ('completed', 'failed')
    AND (completed_at < NOW() - INTERVAL '1 day' * days_old 
         OR failed_at < NOW() - INTERVAL '1 day' * days_old);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log de limpieza
  INSERT INTO background_tasks (task_type, task_data, priority, status, completed_at)
  VALUES (
    'cleanup_old_tasks',
    jsonb_build_object('deleted_count', deleted_count, 'days_old', days_old),
    'low',
    'completed',
    NOW()
  );
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener estadísticas de tareas
CREATE OR REPLACE FUNCTION get_task_stats(
  start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
  end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  task_type VARCHAR(100),
  total_tasks BIGINT,
  completed_tasks BIGINT,
  failed_tasks BIGINT,
  avg_execution_time_ms NUMERIC,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bt.task_type,
    COUNT(*) as total_tasks,
    COUNT(*) FILTER (WHERE bt.status = 'completed') as completed_tasks,
    COUNT(*) FILTER (WHERE bt.status = 'failed') as failed_tasks,
    AVG(bt.execution_time_ms) as avg_execution_time_ms,
    ROUND(
      (COUNT(*) FILTER (WHERE bt.status = 'completed')::NUMERIC / COUNT(*)) * 100, 
      2
    ) as success_rate
  FROM background_tasks bt
  WHERE bt.created_at BETWEEN start_date AND end_date
  GROUP BY bt.task_type
  ORDER BY total_tasks DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS PARA AUDITORÍA
-- =====================================================

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_background_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_background_tasks_updated_at
  BEFORE UPDATE ON background_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_background_tasks_updated_at();

-- Trigger para generar estadísticas automáticamente
CREATE OR REPLACE FUNCTION generate_task_statistics()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo generar estadísticas para tareas completadas o fallidas
  IF NEW.status IN ('completed', 'failed') AND OLD.status = 'processing' THEN
    INSERT INTO task_statistics (
      task_type,
      period_start,
      period_end,
      total_tasks,
      completed_tasks,
      failed_tasks,
      avg_execution_time_ms,
      min_execution_time_ms,
      max_execution_time_ms,
      total_execution_time_ms
    ) VALUES (
      NEW.task_type,
      DATE_TRUNC('hour', NEW.updated_at),
      DATE_TRUNC('hour', NEW.updated_at) + INTERVAL '1 hour',
      1,
      CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
      CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
      NEW.execution_time_ms,
      NEW.execution_time_ms,
      NEW.execution_time_ms,
      COALESCE(NEW.execution_time_ms, 0)
    )
    ON CONFLICT (task_type, period_start, period_end) DO UPDATE SET
      total_tasks = task_statistics.total_tasks + 1,
      completed_tasks = task_statistics.completed_tasks + CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
      failed_tasks = task_statistics.failed_tasks + CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
      avg_execution_time_ms = (
        task_statistics.total_execution_time_ms + COALESCE(NEW.execution_time_ms, 0)
      ) / (task_statistics.total_tasks + 1),
      min_execution_time_ms = LEAST(task_statistics.min_execution_time_ms, NEW.execution_time_ms),
      max_execution_time_ms = GREATEST(task_statistics.max_execution_time_ms, NEW.execution_time_ms),
      total_execution_time_ms = task_statistics.total_execution_time_ms + COALESCE(NEW.execution_time_ms, 0);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_task_statistics
  AFTER UPDATE ON background_tasks
  FOR EACH ROW
  EXECUTE FUNCTION generate_task_statistics();

-- =====================================================
-- POLÍTICAS RLS
-- =====================================================

-- Habilitar RLS
ALTER TABLE background_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_statistics ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver todas las tareas
CREATE POLICY "background_tasks_admin_all" ON background_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'admin')
      AND users.status = 'active'
    )
  );

-- Solo admins pueden gestionar configuraciones
CREATE POLICY "task_configurations_admin_all" ON task_configurations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'admin')
      AND users.status = 'active'
    )
  );

-- Solo admins pueden ver estadísticas
CREATE POLICY "task_statistics_admin_read" ON task_statistics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'admin', 'manager')
      AND users.status = 'active'
    )
  );

-- =====================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE background_tasks IS 'Cola de tareas para procesamiento en background con retry automático';
COMMENT ON TABLE task_configurations IS 'Configuraciones específicas por tipo de tarea';
COMMENT ON TABLE task_statistics IS 'Estadísticas agregadas de ejecución de tareas por períodos';

COMMENT ON FUNCTION get_next_tasks(VARCHAR, INTEGER) IS 'Obtiene y marca las próximas tareas para procesar de forma atómica';
COMMENT ON FUNCTION complete_task(UUID, JSONB, INTEGER) IS 'Marca una tarea como completada con resultados opcionales';
COMMENT ON FUNCTION fail_task(UUID, TEXT, BOOLEAN) IS 'Marca una tarea como fallida y programa retry si corresponde';
COMMENT ON FUNCTION cleanup_old_tasks(INTEGER) IS 'Limpia tareas antiguas completadas o fallidas';
COMMENT ON FUNCTION get_task_stats(TIMESTAMPTZ, TIMESTAMPTZ) IS 'Obtiene estadísticas de tareas por tipo en un rango de fechas';