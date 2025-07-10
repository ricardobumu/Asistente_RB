-- scripts/supabase_migration.sql
-- Migración para agregar campos de autenticación a la tabla clients
-- Ejecutar en Supabase SQL Editor

-- Agregar columnas de autenticación si no existen
DO $$ 
BEGIN
  -- password_hash para almacenar contraseñas hasheadas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'clients' AND column_name = 'password_hash') THEN
    ALTER TABLE clients ADD COLUMN password_hash TEXT;
  END IF;

  -- token_version para invalidar tokens antiguos
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'clients' AND column_name = 'token_version') THEN
    ALTER TABLE clients ADD COLUMN token_version INTEGER DEFAULT 1;
  END IF;

  -- email_verified para verificación de email
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'clients' AND column_name = 'email_verified') THEN
    ALTER TABLE clients ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
  END IF;

  -- email_verified_at timestamp de verificación
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'clients' AND column_name = 'email_verified_at') THEN
    ALTER TABLE clients ADD COLUMN email_verified_at TIMESTAMPTZ;
  END IF;

  -- phone_verified para verificación de teléfono
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'clients' AND column_name = 'phone_verified') THEN
    ALTER TABLE clients ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE;
  END IF;

  -- phone_verified_at timestamp de verificación
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'clients' AND column_name = 'phone_verified_at') THEN
    ALTER TABLE clients ADD COLUMN phone_verified_at TIMESTAMPTZ;
  END IF;

  -- last_login para tracking de accesos
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'clients' AND column_name = 'last_login') THEN
    ALTER TABLE clients ADD COLUMN last_login TIMESTAMPTZ;
  END IF;

  -- status para gestión de estados (active, inactive, suspended)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'clients' AND column_name = 'status') THEN
    ALTER TABLE clients ADD COLUMN status TEXT DEFAULT 'active';
  END IF;

  -- suspension_reason para auditoría
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'clients' AND column_name = 'suspension_reason') THEN
    ALTER TABLE clients ADD COLUMN suspension_reason TEXT;
  END IF;

  -- suspended_at timestamp de suspensión
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'clients' AND column_name = 'suspended_at') THEN
    ALTER TABLE clients ADD COLUMN suspended_at TIMESTAMPTZ;
  END IF;

END $$;

-- Agregar índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_last_login ON clients(last_login);
CREATE INDEX IF NOT EXISTS idx_clients_token_version ON clients(token_version);

-- Agregar constraint para status válidos
DO $constraint$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'clients_status_check') THEN
    ALTER TABLE clients ADD CONSTRAINT clients_status_check 
    CHECK (status IN ('active', 'inactive', 'suspended'));
  END IF;
END $constraint$;

-- Verificar la estructura final
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'clients' 
ORDER BY ordinal_position;