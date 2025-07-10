# API Documentation - Asistente RB

## 📋 Información General

La API de Asistente RB proporciona endpoints para gestionar reservas, clientes, servicios y notificaciones.

**Base URL**: `http://localhost:3000`

## 🔌 Endpoints Disponibles

### Sistema

#### GET /

Información básica del servidor.

**Respuesta:**

```json
{
  "mensaje": "¡Servidor funcionando correctamente!",
  "app": "Asistente RB",
  "version": "1.0.0",
  "environment": "development",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### GET /health

Estado de salud del sistema y servicios.

**Respuesta:**

```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600.123,
  "environment": "development",
  "version": "1.0.0",
  "services": {
    "supabase": true,
    "twilio": true,
    "calendly": false,
    "openai": true
  }
}
```

## 📊 Modelos de Datos

### Cliente

```json
{
  "id": "uuid",
  "name": "string",
  "email": "string",
  "phone": "string",
  "whatsapp_number": "string",
  "preferred_contact_method": "whatsapp|email|sms",
  "notes": "string",
  "is_vip": "boolean",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### Reserva

```json
{
  "id": "uuid",
  "client_id": "uuid",
  "service_id": "uuid",
  "booking_date": "YYYY-MM-DD",
  "booking_time": "HH:MM",
  "status": "pending|confirmed|completed|cancelled",
  "notes": "string",
  "total_price": "decimal",
  "payment_status": "pending|paid|refunded",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### Servicio

```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "price": "decimal",
  "duration": "integer",
  "category": "string",
  "is_active": "boolean",
  "available_days": ["monday", "tuesday", "..."],
  "available_time_slots": ["09:00", "10:00", "..."],
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### Notificación

```json
{
  "id": "uuid",
  "client_id": "uuid",
  "booking_id": "uuid",
  "type": "string",
  "channel": "whatsapp|email|sms",
  "title": "string",
  "message": "string",
  "status": "pending|sent|failed|cancelled",
  "scheduled_for": "timestamp",
  "sent_at": "timestamp",
  "created_at": "timestamp"
}
```

## 🔐 Autenticación

_Próximamente: Sistema de autenticación JWT_

## 📝 Códigos de Estado

- `200` - OK
- `201` - Creado
- `400` - Solicitud incorrecta
- `401` - No autorizado
- `403` - Prohibido
- `404` - No encontrado
- `500` - Error interno del servidor

## 🚨 Manejo de Errores

Todas las respuestas de error siguen este formato:

```json
{
  "success": false,
  "error": "Descripción del error",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 📊 Respuestas Exitosas

Las respuestas exitosas siguen este formato:

```json
{
  "success": true,
  "data": {
    /* datos solicitados */
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🔍 Filtros y Paginación

_Próximamente: Documentación de filtros y paginación_

## 📱 Ejemplos de Uso

### Verificar estado del sistema

```bash
curl -X GET http://localhost:3000/health
```

### Obtener información del servidor

```bash
curl -X GET http://localhost:3000/
```

## 🧪 Testing

_Próximamente: Ejemplos de testing con diferentes herramientas_

---

**Nota**: Esta documentación se actualizará conforme se agreguen nuevos endpoints y funcionalidades.
