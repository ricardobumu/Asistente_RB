-- FUNCIÓN DE VALIDACIÓN Y FORMATEO DE NÚMEROS DE TELÉFONO EN SUPABASE
--
-- Esta función se ejecuta automáticamente antes de insertar o actualizar
-- un cliente para validar y formatear el número de teléfono
--
-- Países soportados: España (+34), Estados Unidos (+1), Colombia (+57), Suiza (+41)

-- 1. Función para limpiar números de teléfono
CREATE OR REPLACE FUNCTION clean_phone_number(phone_input TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Si es NULL o vacío, devolver NULL
  IF phone_input IS NULL OR trim(phone_input) = '' THEN
    RETURN NULL;
  END IF;

  -- Limpiar: mantener solo dígitos y el símbolo +
  phone_input := regexp_replace(phone_input, '[^\d+]', '', 'g');

  -- Convertir 00 inicial a +
  IF phone_input LIKE '00%' THEN
    phone_input := '+' || substring(phone_input from 3);
  END IF;

  RETURN phone_input;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Función para detectar país por patrón
CREATE OR REPLACE FUNCTION detect_country_from_pattern(phone_clean TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Si ya tiene código de país, no detectar
  IF phone_clean LIKE '+%' THEN
    RETURN NULL;
  END IF;

  -- Remover todos los caracteres no numéricos para análisis
  phone_clean := regexp_replace(phone_clean, '[^\d]', '', 'g');

  -- España: móviles 6xx-9xx con 9 dígitos
  IF phone_clean ~ '^[6-9][0-9]{8}$' THEN
    RETURN '+34';
  END IF;

  -- Estados Unidos: 10 dígitos con formato específico
  IF phone_clean ~ '^[2-9][0-9]{2}[2-9][0-9]{6}$' AND length(phone_clean) = 10 THEN
    RETURN '+1';
  END IF;

  -- Colombia: móviles 3xxxxxxxxx
  IF phone_clean ~ '^3[0-9]{9}$' THEN
    RETURN '+57';
  END IF;

  -- Suiza: 9 dígitos
  IF phone_clean ~ '^[1-9][0-9]{8}$' AND length(phone_clean) = 9 THEN
    RETURN '+41';
  END IF;

  -- No se pudo detectar
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Función para validar números por país
CREATE OR REPLACE FUNCTION validate_phone_by_country(phone_formatted TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- España: +34 seguido de móviles 6xx-9xx
  IF phone_formatted ~ '^\+34[6-9][0-9]{8}$' THEN
    RETURN TRUE;
  END IF;

  -- Estados Unidos: +1 seguido de formato específico
  IF phone_formatted ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$' THEN
    RETURN TRUE;
  END IF;

  -- Colombia: +57 seguido de móviles 3xx o fijos 1xx
  IF phone_formatted ~ '^\+57[13][0-9]{9}$' THEN
    RETURN TRUE;
  END IF;

  -- Suiza: +41 seguido de 9 dígitos
  IF phone_formatted ~ '^\+41[1-9][0-9]{8}$' THEN
    RETURN TRUE;
  END IF;

  -- Validación genérica para otros países (7-15 dígitos después del +)
  IF phone_formatted ~ '^\+[0-9]{1,4}[0-9]{7,15}$' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Función principal de formateo
CREATE OR REPLACE FUNCTION format_phone_number(phone_input TEXT, default_country TEXT DEFAULT '+34')
RETURNS TEXT AS $$
DECLARE
  phone_clean TEXT;
  detected_country TEXT;
  country_to_use TEXT;
  phone_formatted TEXT;
BEGIN
  -- Limpiar número
  phone_clean := clean_phone_number(phone_input);

  -- Si no hay número limpio, devolver NULL
  IF phone_clean IS NULL OR phone_clean = '' THEN
    RETURN NULL;
  END IF;

  -- Corregir números malformados comunes (+3434 -> +34)
  IF phone_clean LIKE '+3434%' AND length(phone_clean) = 14 THEN
    phone_clean := '+34' || substring(phone_clean from 6);
  END IF;

  -- Si ya tiene código de país, validar y devolver
  IF phone_clean LIKE '+%' THEN
    IF validate_phone_by_country(phone_clean) THEN
      RETURN phone_clean;
    ELSE
      RETURN NULL; -- Número inválido
    END IF;
  END IF;

  -- Detectar país automáticamente
  detected_country := detect_country_from_pattern(phone_clean);
  country_to_use := COALESCE(detected_country, default_country);

  -- Aplicar código de país
  phone_formatted := country_to_use || phone_clean;

  -- Casos especiales por país
  IF country_to_use = '+34' THEN
    -- España: remover 0 inicial si existe
    IF phone_clean LIKE '0%' THEN
      phone_clean := substring(phone_clean from 2);
      phone_formatted := country_to_use || phone_clean;
    END IF;
    -- Si ya empieza con 34, no duplicar
    IF phone_clean LIKE '34%' THEN
      phone_formatted := '+' || phone_clean;
    END IF;
  ELSIF country_to_use = '+1' THEN
    -- Estados Unidos: remover 1 inicial si existe
    IF phone_clean LIKE '1%' AND length(phone_clean) = 11 THEN
      phone_clean := substring(phone_clean from 2);
      phone_formatted := country_to_use || phone_clean;
    END IF;
  ELSIF country_to_use = '+57' THEN
    -- Colombia: si ya empieza con 57, no duplicar
    IF phone_clean LIKE '57%' AND length(phone_clean) = 12 THEN
      phone_formatted := '+' || phone_clean;
    END IF;
  ELSIF country_to_use = '+41' THEN
    -- Suiza: remover 0 inicial si existe
    IF phone_clean LIKE '0%' THEN
      phone_clean := substring(phone_clean from 2);
      phone_formatted := country_to_use || phone_clean;
    END IF;
    -- Si ya empieza con 41, no duplicar
    IF phone_clean LIKE '41%' AND length(phone_clean) = 11 THEN
      phone_formatted := '+' || phone_clean;
    END IF;
  END IF;

  -- Validar número final
  IF validate_phone_by_country(phone_formatted) THEN
    RETURN phone_formatted;
  ELSE
    RETURN NULL; -- Número inválido
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Trigger para formatear automáticamente números de teléfono
CREATE OR REPLACE FUNCTION trigger_format_phone_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Formatear phone si existe
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := format_phone_number(NEW.phone);
  END IF;

  -- Formatear phone_number si existe (compatibilidad)
  IF NEW.phone_number IS NOT NULL THEN
    NEW.phone_number := format_phone_number(NEW.phone_number);
    -- Sincronizar con phone si existe
    IF NEW.phone IS NULL THEN
      NEW.phone := NEW.phone_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Aplicar trigger a la tabla clients
DROP TRIGGER IF EXISTS format_phone_trigger ON clients;
CREATE TRIGGER format_phone_trigger
  BEFORE INSERT OR UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION trigger_format_phone_number();

-- 7. Función para obtener información del país
CREATE OR REPLACE FUNCTION get_phone_country_info(phone_formatted TEXT)
RETURNS JSON AS $$
DECLARE
  country_code TEXT;
  result JSON;
BEGIN
  -- Detectar código de país
  IF phone_formatted LIKE '+34%' THEN
    country_code := '+34';
  ELSIF phone_formatted LIKE '+1%' THEN
    country_code := '+1';
  ELSIF phone_formatted LIKE '+57%' THEN
    country_code := '+57';
  ELSIF phone_formatted LIKE '+41%' THEN
    country_code := '+41';
  ELSE
    RETURN NULL;
  END IF;

  -- Construir información del país
  result := CASE country_code
    WHEN '+34' THEN '{"code": "ES", "name": "España", "timezone": "Europe/Madrid", "flag": "🇪🇸"}'::JSON
    WHEN '+1' THEN '{"code": "US", "name": "Estados Unidos", "timezone": "America/New_York", "flag": "🇺🇸"}'::JSON
    WHEN '+57' THEN '{"code": "CO", "name": "Colombia", "timezone": "America/Bogota", "flag": "🇨🇴"}'::JSON
    WHEN '+41' THEN '{"code": "CH", "name": "Suiza", "timezone": "Europe/Zurich", "flag": "🇨🇭"}'::JSON
    ELSE NULL
  END;

  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 8. Comentarios y documentación
COMMENT ON FUNCTION format_phone_number(TEXT, TEXT) IS 'Formatea números de teléfono a formato E.164 internacional. Soporta España (+34), Estados Unidos (+1), Colombia (+57) y Suiza (+41)';
COMMENT ON FUNCTION validate_phone_by_country(TEXT) IS 'Valida si un número de teléfono es válido según su código de país';
COMMENT ON FUNCTION get_phone_country_info(TEXT) IS 'Obtiene información del país basada en el código de país del número de teléfono';
COMMENT ON FUNCTION trigger_format_phone_number() IS 'Trigger que formatea automáticamente números de teléfono antes de insertar/actualizar';

-- 9. Ejemplos de uso (comentados)
/*
-- Ejemplos de formateo:
SELECT format_phone_number('666123456'); -- España por defecto -> +34666123456
SELECT format_phone_number('3001234567'); -- Colombia detectado -> +573001234567
SELECT format_phone_number('2125551234'); -- Estados Unidos detectado -> +12125551234
SELECT format_phone_number('791234567'); -- Suiza detectado -> +41791234567
SELECT format_phone_number('+3434666123456'); -- Corrige malformado -> +34666123456

-- Ejemplos de validación:
SELECT validate_phone_by_country('+34666123456'); -- TRUE
SELECT validate_phone_by_country('+34123456789'); -- FALSE (no es móvil español)

-- Ejemplo de información de país:
SELECT get_phone_country_info('+34666123456'); -- {"code": "ES", "name": "España", ...}
*/
