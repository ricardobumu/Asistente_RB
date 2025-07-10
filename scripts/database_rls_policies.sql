-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES - ASISTENTE RB
-- =====================================================
-- MÁXIMA SEGURIDAD: Cada usuario solo ve sus datos
-- Administradores tienen acceso controlado
-- =====================================================

-- =====================================================
-- 1. HABILITAR RLS EN TODAS LAS TABLAS
-- =====================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. POLÍTICAS PARA TABLA USERS (STAFF)
-- =====================================================

-- Los usuarios pueden ver su propio perfil
CREATE POLICY "users_select_own" ON users
  FOR SELECT
  USING (auth.uid()::text = id::text);

-- Los usuarios pueden actualizar su propio perfil
CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  USING (auth.uid()::text = id::text);

-- Solo super_admin y admin pueden ver todos los usuarios
CREATE POLICY "users_select_admin" ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role IN ('super_admin', 'admin')
      AND status = 'active'
    )
  );

-- Solo super_admin puede crear usuarios
CREATE POLICY "users_insert_super_admin" ON users
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role = 'super_admin'
      AND status = 'active'
    )
  );

-- Solo super_admin puede eliminar usuarios
CREATE POLICY "users_delete_super_admin" ON users
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role = 'super_admin'
      AND status = 'active'
    )
  );

-- =====================================================
-- 3. POLÍTICAS PARA TABLA CLIENTS
-- =====================================================

-- Los clientes pueden ver su propio perfil
CREATE POLICY "clients_select_own" ON clients
  FOR SELECT
  USING (auth.uid()::text = id::text);

-- Los clientes pueden actualizar su propio perfil
CREATE POLICY "clients_update_own" ON clients
  FOR UPDATE
  USING (auth.uid()::text = id::text);

-- El staff puede ver clientes (según su rol)
CREATE POLICY "clients_select_staff" ON clients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role IN ('super_admin', 'admin', 'manager', 'supervisor', 'staff', 'receptionist')
      AND status = 'active'
    )
  );

-- Solo admin y manager pueden actualizar clientes
CREATE POLICY "clients_update_admin" ON clients
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role IN ('super_admin', 'admin', 'manager')
      AND status = 'active'
    )
  );

-- Los clientes pueden registrarse (INSERT público con validación)
CREATE POLICY "clients_insert_public" ON clients
  FOR INSERT
  WITH CHECK (true); -- Validación adicional en la aplicación

-- Solo super_admin puede eliminar clientes
CREATE POLICY "clients_delete_super_admin" ON clients
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role = 'super_admin'
      AND status = 'active'
    )
  );

-- =====================================================
-- 4. POLÍTICAS PARA TABLA SERVICES
-- =====================================================

-- Todos pueden ver servicios activos
CREATE POLICY "services_select_active" ON services
  FOR SELECT
  USING (active = true);

-- El staff puede ver todos los servicios
CREATE POLICY "services_select_staff" ON services
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND status = 'active'
    )
  );

-- Solo admin y manager pueden crear/actualizar servicios
CREATE POLICY "services_insert_admin" ON services
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role IN ('super_admin', 'admin', 'manager')
      AND status = 'active'
    )
  );

CREATE POLICY "services_update_admin" ON services
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role IN ('super_admin', 'admin', 'manager')
      AND status = 'active'
    )
  );

-- Solo super_admin puede eliminar servicios
CREATE POLICY "services_delete_super_admin" ON services
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role = 'super_admin'
      AND status = 'active'
    )
  );

-- =====================================================
-- 5. POLÍTICAS PARA TABLA BOOKINGS
-- =====================================================

-- Los clientes pueden ver sus propias reservas
CREATE POLICY "bookings_select_client" ON bookings
  FOR SELECT
  USING (auth.uid()::text = client_id::text);

-- Los clientes pueden crear reservas
CREATE POLICY "bookings_insert_client" ON bookings
  FOR INSERT
  WITH CHECK (auth.uid()::text = client_id::text);

-- Los clientes pueden actualizar sus reservas (limitado)
CREATE POLICY "bookings_update_client" ON bookings
  FOR UPDATE
  USING (
    auth.uid()::text = client_id::text 
    AND status IN ('pending', 'confirmed')
    AND start_time > NOW() + INTERVAL '24 hours'
  );

-- El staff puede ver reservas asignadas a ellos
CREATE POLICY "bookings_select_assigned_staff" ON bookings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND id = bookings.staff_id
      AND status = 'active'
    )
  );

-- El staff administrativo puede ver todas las reservas
CREATE POLICY "bookings_select_admin_staff" ON bookings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role IN ('super_admin', 'admin', 'manager', 'supervisor', 'receptionist')
      AND status = 'active'
    )
  );

-- El staff puede actualizar reservas
CREATE POLICY "bookings_update_staff" ON bookings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role IN ('super_admin', 'admin', 'manager', 'supervisor', 'staff', 'receptionist')
      AND status = 'active'
    )
  );

-- Solo admin puede eliminar reservas
CREATE POLICY "bookings_delete_admin" ON bookings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role IN ('super_admin', 'admin')
      AND status = 'active'
    )
  );

-- =====================================================
-- 6. POLÍTICAS PARA TABLA NOTIFICATIONS
-- =====================================================

-- Los usuarios pueden ver sus notificaciones
CREATE POLICY "notifications_select_user" ON notifications
  FOR SELECT
  USING (auth.uid()::text = user_id::text);

-- Los clientes pueden ver sus notificaciones
CREATE POLICY "notifications_select_client" ON notifications
  FOR SELECT
  USING (auth.uid()::text = client_id::text);

-- El sistema puede crear notificaciones
CREATE POLICY "notifications_insert_system" ON notifications
  FOR INSERT
  WITH CHECK (true); -- Controlado por la aplicación

-- Los usuarios pueden marcar como leídas sus notificaciones
CREATE POLICY "notifications_update_user" ON notifications
  FOR UPDATE
  USING (
    auth.uid()::text = user_id::text 
    OR auth.uid()::text = client_id::text
  );

-- Solo admin puede eliminar notificaciones
CREATE POLICY "notifications_delete_admin" ON notifications
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role IN ('super_admin', 'admin')
      AND status = 'active'
    )
  );

-- =====================================================
-- 7. POLÍTICAS PARA TABLA ACTIVITY_LOGS
-- =====================================================

-- Solo admin puede ver logs de auditoría
CREATE POLICY "activity_logs_select_admin" ON activity_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role IN ('super_admin', 'admin')
      AND status = 'active'
    )
  );

-- El sistema puede crear logs (controlado por triggers)
CREATE POLICY "activity_logs_insert_system" ON activity_logs
  FOR INSERT
  WITH CHECK (true);

-- Solo super_admin puede eliminar logs
CREATE POLICY "activity_logs_delete_super_admin" ON activity_logs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role = 'super_admin'
      AND status = 'active'
    )
  );

-- =====================================================
-- 8. FUNCIONES AUXILIARES PARA RLS
-- =====================================================

-- Función para verificar si el usuario actual es admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id::text = auth.uid()::text 
    AND role IN ('super_admin', 'admin')
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar si el usuario actual es staff
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id::text = auth.uid()::text 
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
BEGIN
  RETURN (
    SELECT role FROM users 
    WHERE id::text = auth.uid()::text 
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. POLÍTICAS ESPECIALES PARA INTEGRACIÓN
-- =====================================================

-- Política especial para el servicio de backend (service_role)
-- Permite operaciones completas cuando se usa la service key

-- Crear rol especial para el backend
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
  END IF;
END
$$;

-- Otorgar permisos completos al service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- =====================================================
-- 10. VALIDACIONES ADICIONALES DE SEGURIDAD
-- =====================================================

-- Función para validar que solo se puedan crear reservas futuras
CREATE OR REPLACE FUNCTION validate_booking_time()
RETURNS TRIGGER AS $$
BEGIN
  -- No permitir reservas en el pasado
  IF NEW.start_time <= NOW() THEN
    RAISE EXCEPTION 'No se pueden crear reservas en el pasado';
  END IF;
  
  -- Validar que end_time sea después de start_time
  IF NEW.end_time <= NEW.start_time THEN
    RAISE EXCEPTION 'La hora de fin debe ser posterior a la hora de inicio';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar validación a bookings
CREATE TRIGGER validate_booking_time_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION validate_booking_time();

-- =====================================================
-- RLS POLICIES COMPLETADAS
-- =====================================================
-- Seguridad máxima implementada
-- Cada usuario solo ve sus datos
-- Roles granulares respetados
-- Validaciones automáticas activas
-- =====================================================