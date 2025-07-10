-- scripts/addGoogleCalendarFields.sql
-- Agregar campos para Google Calendar OAuth tokens

-- Agregar columnas para tokens de Google Calendar
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS google_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS google_connected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS google_disconnected_at TIMESTAMPTZ;

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_users_google_access_token 
ON users(google_access_token) 
WHERE google_access_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_google_connected_at 
ON users(google_connected_at) 
WHERE google_connected_at IS NOT NULL;

-- Comentarios para documentación
COMMENT ON COLUMN users.google_access_token IS 'Token de acceso de Google Calendar OAuth';
COMMENT ON COLUMN users.google_refresh_token IS 'Token de actualización de Google Calendar OAuth';
COMMENT ON COLUMN users.google_token_expires_at IS 'Fecha de expiración del token de acceso';
COMMENT ON COLUMN users.google_connected_at IS 'Fecha de primera conexión con Google Calendar';
COMMENT ON COLUMN users.google_disconnected_at IS 'Fecha de última desconexión de Google Calendar';

-- Política RLS para tokens de Google (solo el usuario puede ver sus propios tokens)
CREATE POLICY IF NOT EXISTS "Users can only access their own Google tokens"
ON users
FOR ALL
USING (auth.uid() = id);

-- Función para limpiar tokens expirados automáticamente
CREATE OR REPLACE FUNCTION cleanup_expired_google_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users 
  SET 
    google_access_token = NULL,
    google_disconnected_at = NOW()
  WHERE 
    google_access_token IS NOT NULL 
    AND google_token_expires_at IS NOT NULL 
    AND google_token_expires_at < NOW() - INTERVAL '7 days'
    AND google_refresh_token IS NULL; -- Solo limpiar si no hay refresh token
    
  -- Log de limpieza
  RAISE NOTICE 'Cleaned up expired Google tokens for % users', 
    (SELECT COUNT(*) FROM users WHERE google_disconnected_at = NOW());
END;
$$;

-- Crear trigger para limpiar tokens expirados diariamente
-- (Esto se puede ejecutar como un cron job o background task)

-- Verificar que las columnas se agregaron correctamente
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name LIKE 'google_%'
ORDER BY column_name;