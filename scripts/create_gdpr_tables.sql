-- scripts/create_gdpr_tables.sql
-- Script para crear las tablas necesarias para compliance RGPD

-- Tabla para gestión de consentimientos RGPD
CREATE TABLE IF NOT EXISTS gdpr_consents (
    id SERIAL PRIMARY KEY,
    client_id VARCHAR(255) NOT NULL,
    consent_type VARCHAR(100) NOT NULL,
    granted BOOLEAN NOT NULL,
    purpose VARCHAR(255),
    method VARCHAR(50) DEFAULT 'web',
    ip_address VARCHAR(45),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    withdrawable BOOLEAN DEFAULT true,
    version VARCHAR(10) DEFAULT '1.0',
    
    -- Índices para optimizar consultas
    INDEX idx_client_consent (client_id, consent_type),
    INDEX idx_timestamp (timestamp),
    INDEX idx_consent_type (consent_type)
);

-- Tabla para logs de acceso a datos (auditoría RGPD)
CREATE TABLE IF NOT EXISTS data_access_logs (
    id SERIAL PRIMARY KEY,
    client_id VARCHAR(255),
    action VARCHAR(100) NOT NULL, -- 'export', 'delete', 'access', 'modify'
    purpose VARCHAR(255),
    legal_basis VARCHAR(100),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    result VARCHAR(50) DEFAULT 'success', -- 'success', 'failed', 'partial'
    details JSON,
    
    -- Índices para auditoría
    INDEX idx_client_action (client_id, action),
    INDEX idx_timestamp_action (timestamp, action),
    INDEX idx_legal_basis (legal_basis)
);

-- Tabla para gestión de conversaciones de WhatsApp (con RGPD)
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
    id SERIAL PRIMARY KEY,
    client_id VARCHAR(255),
    phone_number VARCHAR(20) NOT NULL,
    message_id VARCHAR(255),
    message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'image', 'document'
    content TEXT,
    direction VARCHAR(10) NOT NULL, -- 'inbound', 'outbound'
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT false,
    intent VARCHAR(100),
    confidence DECIMAL(3,2),
    gdpr_consent BOOLEAN DEFAULT false,
    retention_until DATE, -- Fecha hasta la cual se debe retener
    
    -- Índices para optimizar consultas
    INDEX idx_phone_timestamp (phone_number, timestamp),
    INDEX idx_client_timestamp (client_id, timestamp),
    INDEX idx_retention (retention_until),
    INDEX idx_gdpr_consent (gdpr_consent)
);

-- Tabla para gestión de disputas y reclamaciones
CREATE TABLE IF NOT EXISTS disputes (
    id SERIAL PRIMARY KEY,
    client_id VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- 'complaint', 'legal_claim', 'data_breach'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'resolved', 'escalated'
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    resolution TEXT,
    
    -- Índices
    INDEX idx_client_status (client_id, status),
    INDEX idx_type_status (type, status),
    INDEX idx_created_at (created_at)
);

-- Tabla para eventos de analytics (anonimizados para RGPD)
CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    client_id VARCHAR(255), -- Puede ser NULL para eventos anónimos
    event_type VARCHAR(100) NOT NULL,
    event_data JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    anonymized BOOLEAN DEFAULT false,
    retention_until DATE,
    
    -- Índices
    INDEX idx_event_type_timestamp (event_type, timestamp),
    INDEX idx_client_timestamp (client_id, timestamp),
    INDEX idx_anonymized (anonymized),
    INDEX idx_retention (retention_until)
);

-- Tabla para configuración de retención de datos
CREATE TABLE IF NOT EXISTS data_retention_policies (
    id SERIAL PRIMARY KEY,
    data_type VARCHAR(100) NOT NULL UNIQUE,
    retention_period_days INTEGER NOT NULL,
    legal_basis VARCHAR(100),
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insertar políticas de retención por defecto
INSERT INTO data_retention_policies (data_type, retention_period_days, legal_basis, description) VALUES
('client_data', 1095, 'legitimate_interest', 'Datos de clientes - 3 años desde última interacción'),
('booking_data', 2555, 'legal_obligation', 'Datos de reservas - 7 años por obligación fiscal'),
('conversation_data', 365, 'consent', 'Conversaciones de WhatsApp - 1 año'),
('marketing_data', 730, 'consent', 'Datos de marketing - 2 años o hasta retirada de consentimiento'),
('analytics_data', 730, 'legitimate_interest', 'Datos de analytics - 2 años')
ON DUPLICATE KEY UPDATE 
    retention_period_days = VALUES(retention_period_days),
    description = VALUES(description),
    updated_at = CURRENT_TIMESTAMP;

-- Tabla para notificaciones de violaciones de datos
CREATE TABLE IF NOT EXISTS data_breach_notifications (
    id SERIAL PRIMARY KEY,
    breach_id VARCHAR(100) NOT NULL UNIQUE,
    incident_type VARCHAR(100) NOT NULL,
    affected_data TEXT,
    affected_users INTEGER DEFAULT 0,
    risk_level VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high'
    containment_measures JSON,
    description TEXT,
    reported_by VARCHAR(255),
    status VARCHAR(50) DEFAULT 'reported',
    requires_authority_notification BOOLEAN DEFAULT false,
    requires_user_notification BOOLEAN DEFAULT false,
    authority_notified_at TIMESTAMP NULL,
    users_notified_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Índices
    INDEX idx_risk_level (risk_level),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- Crear vistas para reportes de compliance
CREATE OR REPLACE VIEW gdpr_compliance_summary AS
SELECT 
    DATE(timestamp) as date,
    consent_type,
    COUNT(*) as total_consents,
    SUM(CASE WHEN granted = true THEN 1 ELSE 0 END) as granted_consents,
    SUM(CASE WHEN granted = false THEN 1 ELSE 0 END) as withdrawn_consents
FROM gdpr_consents 
WHERE timestamp >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
GROUP BY DATE(timestamp), consent_type
ORDER BY date DESC, consent_type;

-- Vista para datos que requieren limpieza
CREATE OR REPLACE VIEW data_cleanup_required AS
SELECT 
    'whatsapp_conversations' as table_name,
    COUNT(*) as records_to_cleanup,
    MIN(retention_until) as earliest_expiry
FROM whatsapp_conversations 
WHERE retention_until <= CURRENT_DATE
UNION ALL
SELECT 
    'analytics_events' as table_name,
    COUNT(*) as records_to_cleanup,
    MIN(retention_until) as earliest_expiry
FROM analytics_events 
WHERE retention_until <= CURRENT_DATE AND anonymized = false;

-- Procedimiento almacenado para limpieza automática de datos
DELIMITER //
CREATE PROCEDURE CleanupExpiredData()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE table_name VARCHAR(100);
    DECLARE cleanup_count INT;
    
    -- Limpiar conversaciones de WhatsApp expiradas
    DELETE FROM whatsapp_conversations 
    WHERE retention_until <= CURRENT_DATE;
    
    SET cleanup_count = ROW_COUNT();
    INSERT INTO data_access_logs (client_id, action, purpose, legal_basis, details) 
    VALUES (NULL, 'cleanup', 'data_retention_policy', 'legal_obligation', 
            JSON_OBJECT('table', 'whatsapp_conversations', 'deleted_records', cleanup_count));
    
    -- Anonimizar eventos de analytics expirados
    UPDATE analytics_events 
    SET client_id = NULL, 
        ip_address = 'ANONYMIZED',
        user_agent = 'ANONYMIZED',
        anonymized = true
    WHERE retention_until <= CURRENT_DATE AND anonymized = false;
    
    SET cleanup_count = ROW_COUNT();
    INSERT INTO data_access_logs (client_id, action, purpose, legal_basis, details) 
    VALUES (NULL, 'anonymize', 'data_retention_policy', 'legal_obligation', 
            JSON_OBJECT('table', 'analytics_events', 'anonymized_records', cleanup_count));
    
END //
DELIMITER ;

-- Crear evento para ejecutar limpieza automática diariamente
CREATE EVENT IF NOT EXISTS daily_gdpr_cleanup
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
  CALL CleanupExpiredData();

-- Comentarios para documentación
ALTER TABLE gdpr_consents COMMENT = 'Tabla para gestión de consentimientos RGPD';
ALTER TABLE data_access_logs COMMENT = 'Logs de auditoría para acceso y modificación de datos personales';
ALTER TABLE whatsapp_conversations COMMENT = 'Conversaciones de WhatsApp con gestión de retención RGPD';
ALTER TABLE disputes COMMENT = 'Gestión de disputas y reclamaciones de clientes';
ALTER TABLE analytics_events COMMENT = 'Eventos de analytics con capacidad de anonimización';
ALTER TABLE data_retention_policies COMMENT = 'Políticas de retención de datos por tipo';
ALTER TABLE data_breach_notifications COMMENT = 'Notificaciones de violaciones de datos según RGPD';

-- Grants para usuario de aplicación (ajustar según configuración)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON gdpr_consents TO 'app_user'@'%';
-- GRANT SELECT, INSERT ON data_access_logs TO 'app_user'@'%';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_conversations TO 'app_user'@'%';
-- GRANT SELECT, INSERT, UPDATE ON disputes TO 'app_user'@'%';
-- GRANT SELECT, INSERT, UPDATE ON analytics_events TO 'app_user'@'%';
-- GRANT SELECT ON data_retention_policies TO 'app_user'@'%';
-- GRANT SELECT, INSERT, UPDATE ON data_breach_notifications TO 'app_user'@'%';