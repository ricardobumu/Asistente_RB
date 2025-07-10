-- =====================================================
-- FUNCTIONS AVANZADAS PARA SUPABASE
-- Sistema de Reservas Autónomo - Ricardo Buriticá
-- =====================================================

-- =====================================================
-- 1. FUNCIÓN: VALIDAR DISPONIBILIDAD DE RESERVA
-- =====================================================
CREATE OR REPLACE FUNCTION validate_booking_availability(
    p_service_id UUID,
    p_date DATE,
    p_time TIME,
    p_duration INTEGER DEFAULT 60
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
    v_conflicts INTEGER;
    v_service_name TEXT;
    v_end_time TIME;
BEGIN
    -- Calcular hora de fin
    v_end_time := p_time + (p_duration || ' minutes')::INTERVAL;
    
    -- Obtener nombre del servicio
    SELECT name INTO v_service_name 
    FROM services 
    WHERE id = p_service_id AND active = true;
    
    IF v_service_name IS NULL THEN
        RETURN json_build_object(
            'available', false,
            'error', 'Servicio no encontrado o inactivo'
        );
    END IF;
    
    -- Verificar conflictos
    SELECT COUNT(*) INTO v_conflicts
    FROM bookings b
    WHERE b.service_id = p_service_id
    AND b.booking_date = p_date
    AND b.status IN ('confirmed', 'pending')
    AND (
        (b.booking_time <= p_time AND (b.booking_time + (b.duration || ' minutes')::INTERVAL)::TIME > p_time)
        OR
        (b.booking_time < v_end_time AND b.booking_time >= p_time)
    );
    
    -- Construir respuesta
    v_result := json_build_object(
        'available', v_conflicts = 0,
        'service_name', v_service_name,
        'requested_date', p_date,
        'requested_time', p_time,
        'duration_minutes', p_duration,
        'conflicts_found', v_conflicts
    );
    
    RETURN v_result;
END;
$$;

-- =====================================================
-- 2. FUNCIÓN: OBTENER SLOTS DISPONIBLES
-- =====================================================
CREATE OR REPLACE FUNCTION get_available_slots(
    p_service_id UUID,
    p_date DATE,
    p_days_ahead INTEGER DEFAULT 7
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
    v_slots JSON[] := '{}';
    v_current_date DATE;
    v_current_time TIME;
    v_service RECORD;
    v_slot JSON;
    v_available BOOLEAN;
BEGIN
    -- Obtener información del servicio
    SELECT * INTO v_service
    FROM services 
    WHERE id = p_service_id AND active = true;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'error', 'Servicio no encontrado',
            'available_slots', '[]'::JSON
        );
    END IF;
    
    -- Generar slots para los próximos días
    FOR i IN 0..p_days_ahead-1 LOOP
        v_current_date := p_date + i;
        
        -- Solo días laborables (lunes a viernes)
        IF EXTRACT(DOW FROM v_current_date) BETWEEN 1 AND 5 THEN
            -- Horarios de 9:00 a 18:00 cada 30 minutos
            FOR hour IN 9..17 LOOP
                FOR minute IN 0..1 LOOP
                    v_current_time := (hour || ':' || (minute * 30) || ':00')::TIME;
                    
                    -- Verificar disponibilidad
                    SELECT (validate_booking_availability(p_service_id, v_current_date, v_current_time, v_service.duration_minutes)->>'available')::BOOLEAN
                    INTO v_available;
                    
                    IF v_available THEN
                        v_slot := json_build_object(
                            'date', v_current_date,
                            'time', v_current_time,
                            'datetime', v_current_date || 'T' || v_current_time,
                            'service_name', v_service.name,
                            'duration', v_service.duration_minutes
                        );
                        v_slots := array_append(v_slots, v_slot);
                    END IF;
                END LOOP;
            END LOOP;
        END IF;
    END LOOP;
    
    v_result := json_build_object(
        'service_id', p_service_id,
        'service_name', v_service.name,
        'search_from', p_date,
        'days_searched', p_days_ahead,
        'available_slots', array_to_json(v_slots)
    );
    
    RETURN v_result;
END;
$$;

-- =====================================================
-- 3. FUNCIÓN: CREAR RESERVA AUTOMÁTICA
-- =====================================================
CREATE OR REPLACE FUNCTION create_automatic_booking(
    p_client_phone TEXT,
    p_client_name TEXT,
    p_client_email TEXT,
    p_service_id UUID,
    p_booking_date DATE,
    p_booking_time TIME,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_client_id UUID;
    v_booking_id UUID;
    v_service RECORD;
    v_result JSON;
    v_availability JSON;
BEGIN
    -- Verificar disponibilidad
    SELECT validate_booking_availability(p_service_id, p_booking_date, p_booking_time) INTO v_availability;
    
    IF NOT (v_availability->>'available')::BOOLEAN THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Horario no disponible',
            'availability_check', v_availability
        );
    END IF;
    
    -- Obtener información del servicio
    SELECT * INTO v_service FROM services WHERE id = p_service_id;
    
    -- Buscar o crear cliente
    SELECT id INTO v_client_id 
    FROM clients 
    WHERE phone = p_client_phone;
    
    IF v_client_id IS NULL THEN
        INSERT INTO clients (name, email, phone, created_at)
        VALUES (p_client_name, p_client_email, p_client_phone, NOW())
        RETURNING id INTO v_client_id;
    ELSE
        -- Actualizar información si es necesaria
        UPDATE clients 
        SET 
            name = COALESCE(p_client_name, name),
            email = COALESCE(p_client_email, email),
            updated_at = NOW()
        WHERE id = v_client_id;
    END IF;
    
    -- Crear reserva
    INSERT INTO bookings (
        client_id,
        service_id,
        booking_date,
        booking_time,
        duration,
        status,
        notes,
        created_via,
        created_at
    ) VALUES (
        v_client_id,
        p_service_id,
        p_booking_date,
        p_booking_time,
        v_service.duration_minutes,
        'confirmed',
        p_notes,
        'whatsapp_bot',
        NOW()
    ) RETURNING id INTO v_booking_id;
    
    -- Construir respuesta
    v_result := json_build_object(
        'success', true,
        'booking_id', v_booking_id,
        'client_id', v_client_id,
        'service_name', v_service.name,
        'booking_date', p_booking_date,
        'booking_time', p_booking_time,
        'duration_minutes', v_service.duration_minutes,
        'price', v_service.price,
        'status', 'confirmed'
    );
    
    RETURN v_result;
END;
$$;

-- =====================================================
-- 4. FUNCIÓN: OBTENER ESTADÍSTICAS DEL DASHBOARD
-- =====================================================
CREATE OR REPLACE FUNCTION get_dashboard_stats(
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stats JSON;
    v_bookings_today INTEGER;
    v_bookings_week INTEGER;
    v_bookings_month INTEGER;
    v_revenue_today DECIMAL;
    v_revenue_week DECIMAL;
    v_revenue_month DECIMAL;
    v_clients_total INTEGER;
    v_clients_new_month INTEGER;
    v_next_appointment JSON;
BEGIN
    -- Reservas de hoy
    SELECT COUNT(*) INTO v_bookings_today
    FROM bookings 
    WHERE booking_date = p_date 
    AND status IN ('confirmed', 'pending');
    
    -- Reservas de esta semana
    SELECT COUNT(*) INTO v_bookings_week
    FROM bookings 
    WHERE booking_date >= date_trunc('week', p_date)
    AND booking_date < date_trunc('week', p_date) + INTERVAL '7 days'
    AND status IN ('confirmed', 'pending');
    
    -- Reservas de este mes
    SELECT COUNT(*) INTO v_bookings_month
    FROM bookings 
    WHERE booking_date >= date_trunc('month', p_date)
    AND booking_date < date_trunc('month', p_date) + INTERVAL '1 month'
    AND status IN ('confirmed', 'pending');
    
    -- Ingresos de hoy
    SELECT COALESCE(SUM(s.price), 0) INTO v_revenue_today
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    WHERE b.booking_date = p_date 
    AND b.status = 'confirmed';
    
    -- Ingresos de esta semana
    SELECT COALESCE(SUM(s.price), 0) INTO v_revenue_week
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    WHERE b.booking_date >= date_trunc('week', p_date)
    AND b.booking_date < date_trunc('week', p_date) + INTERVAL '7 days'
    AND b.status = 'confirmed';
    
    -- Ingresos de este mes
    SELECT COALESCE(SUM(s.price), 0) INTO v_revenue_month
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    WHERE b.booking_date >= date_trunc('month', p_date)
    AND b.booking_date < date_trunc('month', p_date) + INTERVAL '1 month'
    AND b.status = 'confirmed';
    
    -- Total de clientes
    SELECT COUNT(*) INTO v_clients_total FROM clients;
    
    -- Clientes nuevos este mes
    SELECT COUNT(*) INTO v_clients_new_month
    FROM clients 
    WHERE created_at >= date_trunc('month', p_date);
    
    -- Próxima cita
    SELECT json_build_object(
        'client_name', c.name,
        'service_name', s.name,
        'booking_date', b.booking_date,
        'booking_time', b.booking_time
    ) INTO v_next_appointment
    FROM bookings b
    JOIN clients c ON b.client_id = c.id
    JOIN services s ON b.service_id = s.id
    WHERE b.booking_date >= p_date
    AND b.status IN ('confirmed', 'pending')
    ORDER BY b.booking_date, b.booking_time
    LIMIT 1;
    
    -- Construir respuesta
    v_stats := json_build_object(
        'date', p_date,
        'bookings', json_build_object(
            'today', v_bookings_today,
            'week', v_bookings_week,
            'month', v_bookings_month
        ),
        'revenue', json_build_object(
            'today', v_revenue_today,
            'week', v_revenue_week,
            'month', v_revenue_month
        ),
        'clients', json_build_object(
            'total', v_clients_total,
            'new_this_month', v_clients_new_month
        ),
        'next_appointment', v_next_appointment
    );
    
    RETURN v_stats;
END;
$$;

-- =====================================================
-- 5. FUNCIÓN: LIMPIAR DATOS ANTIGUOS
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_bookings INTEGER;
    v_deleted_logs INTEGER;
    v_result JSON;
BEGIN
    -- Eliminar reservas canceladas de más de 6 meses
    DELETE FROM bookings 
    WHERE status = 'cancelled' 
    AND created_at < NOW() - INTERVAL '6 months';
    
    GET DIAGNOSTICS v_deleted_bookings = ROW_COUNT;
    
    -- Eliminar logs de más de 30 días (si existe tabla de logs)
    -- DELETE FROM system_logs 
    -- WHERE created_at < NOW() - INTERVAL '30 days';
    -- GET DIAGNOSTICS v_deleted_logs = ROW_COUNT;
    
    v_result := json_build_object(
        'success', true,
        'deleted_bookings', v_deleted_bookings,
        'deleted_logs', 0, -- v_deleted_logs cuando se implemente
        'cleanup_date', NOW()
    );
    
    RETURN v_result;
END;
$$;

-- =====================================================
-- 6. TRIGGERS PARA NOTIFICACIONES AUTOMÁTICAS
-- =====================================================

-- Función para notificaciones de nuevas reservas
CREATE OR REPLACE FUNCTION notify_new_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Enviar notificación (se puede integrar con webhook)
    PERFORM pg_notify('new_booking', json_build_object(
        'booking_id', NEW.id,
        'client_id', NEW.client_id,
        'service_id', NEW.service_id,
        'booking_date', NEW.booking_date,
        'booking_time', NEW.booking_time,
        'status', NEW.status
    )::text);
    
    RETURN NEW;
END;
$$;

-- Crear trigger
DROP TRIGGER IF EXISTS trigger_notify_new_booking ON bookings;
CREATE TRIGGER trigger_notify_new_booking
    AFTER INSERT ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_booking();

-- =====================================================
-- 7. FUNCIÓN: OBTENER RESERVAS DEL DÍA
-- =====================================================
CREATE OR REPLACE FUNCTION get_daily_bookings(
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bookings JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', b.id,
            'client_name', c.name,
            'client_phone', c.phone,
            'service_name', s.name,
            'booking_time', b.booking_time,
            'duration', b.duration,
            'price', s.price,
            'status', b.status,
            'notes', b.notes
        ) ORDER BY b.booking_time
    ) INTO v_bookings
    FROM bookings b
    JOIN clients c ON b.client_id = c.id
    JOIN services s ON b.service_id = s.id
    WHERE b.booking_date = p_date
    AND b.status IN ('confirmed', 'pending');
    
    RETURN json_build_object(
        'date', p_date,
        'bookings', COALESCE(v_bookings, '[]'::JSON)
    );
END;
$$;

-- =====================================================
-- PERMISOS Y SEGURIDAD
-- =====================================================

-- Otorgar permisos a la aplicación
GRANT EXECUTE ON FUNCTION validate_booking_availability TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_slots TO authenticated;
GRANT EXECUTE ON FUNCTION create_automatic_booking TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_bookings TO authenticated;

-- Solo admin puede ejecutar limpieza
GRANT EXECUTE ON FUNCTION cleanup_old_data TO service_role;

-- =====================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON FUNCTION validate_booking_availability IS 'Valida si un horario está disponible para reserva';
COMMENT ON FUNCTION get_available_slots IS 'Obtiene slots disponibles para un servicio en un rango de fechas';
COMMENT ON FUNCTION create_automatic_booking IS 'Crea una reserva automáticamente desde el bot de WhatsApp';
COMMENT ON FUNCTION get_dashboard_stats IS 'Obtiene estadísticas para el dashboard administrativo';
COMMENT ON FUNCTION cleanup_old_data IS 'Limpia datos antiguos del sistema';
COMMENT ON FUNCTION get_daily_bookings IS 'Obtiene todas las reservas de un día específico';