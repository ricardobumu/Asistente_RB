# 🔐 API de Autenticación - Asistente RB

## 📋 Información General

La API de autenticación proporciona un sistema JWT robusto con refresh tokens, roles granulares y seguridad avanzada.

**Base URL**: `http://localhost:3000/api`

## 🚀 Configuración Inicial

### 1. Generar Secretos JWT

```bash
npm run generate-secrets
```

### 2. Configurar Variables de Entorno

Agrega a tu archivo `.env`:

```env
JWT_SECRET=tu_jwt_secret_generado
JWT_REFRESH_SECRET=tu_jwt_refresh_secret_generado
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### 3. Migrar Base de Datos

```bash
npm run migrate:auth
```

## 🔌 Endpoints de Autenticación

### POST /api/auth/register/client

Registro de nuevo cliente.

**Request Body:**

```json
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "phone": "+573001234567",
  "password": "password123",
  "whatsapp_number": "+573001234567"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Juan Pérez",
      "email": "juan@example.com",
      "phone": "+573001234567",
      "role": "client",
      "vip_status": false
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
}
```

### POST /api/auth/login/client

Login de cliente existente.

**Request Body:**

```json
{
  "email": "juan@example.com",
  "password": "password123"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Juan Pérez",
      "email": "juan@example.com",
      "phone": "+573001234567",
      "role": "client",
      "vip_status": false
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
}
```

### POST /api/auth/refresh

Renovar access token usando refresh token.

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
}
```

### POST /api/auth/logout

Invalidar tokens (logout).

**Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200):**

```json
{
  "success": true,
  "message": "Logout exitoso"
}
```

### GET /api/auth/me

Obtener información del usuario autenticado.

**Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Juan Pérez",
      "email": "juan@example.com",
      "role": "client",
      "type": "client"
    }
  }
}
```

## 👥 Endpoints de Clientes

### GET /api/clients/me

Obtener perfil del cliente autenticado.

**Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "phone": "+573001234567",
    "whatsapp_number": "+573001234567",
    "preferred_contact_method": "whatsapp",
    "vip_status": false,
    "status": "active",
    "email_verified": false,
    "phone_verified": false,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### PUT /api/clients/me

Actualizar perfil del cliente autenticado.

**Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Request Body:**

```json
{
  "name": "Juan Carlos Pérez",
  "phone": "+573009876543",
  "preferred_contact_method": "email",
  "notes": "Prefiere citas en la mañana"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Juan Carlos Pérez",
    "email": "juan@example.com",
    "phone": "+573009876543",
    "preferred_contact_method": "email",
    "notes": "Prefiere citas en la mañana",
    "updated_at": "2024-01-15T11:00:00.000Z"
  },
  "message": "Perfil actualizado exitosamente"
}
```

### GET /api/clients/me/bookings

Obtener historial de reservas del cliente.

**Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Query Parameters:**

- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Elementos por página (default: 10)
- `status` (opcional): Filtrar por estado (pending, confirmed, completed, cancelled)
- `from_date` (opcional): Fecha desde (YYYY-MM-DD)
- `to_date` (opcional): Fecha hasta (YYYY-MM-DD)

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "service_name": "Corte de cabello",
      "booking_date": "2024-01-20",
      "booking_time": "10:00",
      "status": "confirmed",
      "total_price": 50000,
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1
  }
}
```

### GET /api/clients/me/stats

Obtener estadísticas del cliente.

**Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "total_bookings": 15,
    "completed_bookings": 12,
    "cancelled_bookings": 2,
    "pending_bookings": 1,
    "total_spent": 750000,
    "average_booking_value": 50000,
    "favorite_service": "Corte de cabello",
    "last_booking_date": "2024-01-10T14:00:00.000Z",
    "member_since": "2023-06-15T09:00:00.000Z"
  }
}
```

## 🔒 Sistema de Roles

### Roles Disponibles

- **client**: Cliente regular
- **staff**: Personal del salón
- **manager**: Gerente/Supervisor
- **admin**: Administrador
- **super_admin**: Super administrador

### Permisos por Rol

| Endpoint                      | Client | Staff | Manager | Admin | Super Admin |
| ----------------------------- | ------ | ----- | ------- | ----- | ----------- |
| GET /api/clients/me           | ✅     | ❌    | ❌      | ❌    | ❌          |
| PUT /api/clients/me           | ✅     | ❌    | ❌      | ❌    | ❌          |
| GET /api/clients/me/bookings  | ✅     | ❌    | ❌      | ❌    | ❌          |
| GET /api/clients              | ❌     | ❌    | ✅      | ✅    | ✅          |
| PUT /api/clients/:id          | ❌     | ❌    | ✅      | ✅    | ✅          |
| POST /api/clients/:id/suspend | ❌     | ❌    | ❌      | ✅    | ✅          |
| DELETE /api/clients/:id       | ❌     | ❌    | ❌      | ❌    | ✅          |

## 🛡️ Seguridad

### Rate Limiting

- **Autenticación**: 5 intentos por 15 minutos
- **Registro**: 3 registros por hora
- **Actualizaciones**: 10 por hora (clientes), 20 por hora (admins)
- **Acciones críticas**: 2-5 por día

### Validaciones

- **Email**: Formato RFC 5322
- **Teléfono**: Formato internacional (+57...)
- **Contraseña**: Mínimo 8 caracteres
- **JWT**: Tokens con expiración corta (15min) + refresh tokens (7 días)

### Headers de Seguridad

- **CORS**: Configurado para dominios específicos
- **Helmet**: Headers de seguridad automáticos
- **Content Security Policy**: Protección XSS
- **HSTS**: Forzar HTTPS en producción

## 🚨 Códigos de Error

### 400 - Bad Request

```json
{
  "success": false,
  "error": "Todos los campos son requeridos"
}
```

### 401 - Unauthorized

```json
{
  "success": false,
  "error": "Token inválido o expirado"
}
```

### 403 - Forbidden

```json
{
  "success": false,
  "error": "Permisos insuficientes"
}
```

### 409 - Conflict

```json
{
  "success": false,
  "error": "Ya existe un cliente con este email"
}
```

### 429 - Too Many Requests

```json
{
  "success": false,
  "error": "Demasiadas solicitudes. Intenta más tarde.",
  "retryAfter": 900
}
```

### 500 - Internal Server Error

```json
{
  "success": false,
  "error": "Error interno del servidor"
}
```

## 🧪 Testing

### Usando cURL

**Registro:**

```bash
curl -X POST http://localhost:3000/api/auth/register/client \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "phone": "+573001234567",
    "password": "password123"
  }'
```

**Login:**

```bash
curl -X POST http://localhost:3000/api/auth/login/client \
  -H "Content-Type: application/json" \
  -d '{
    "email": "juan@example.com",
    "password": "password123"
  }'
```

**Perfil (con token):**

```bash
curl -X GET http://localhost:3000/api/clients/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 📊 Monitoreo

### Logs de Seguridad

- Intentos de login fallidos
- Tokens inválidos
- Accesos denegados por permisos
- Rate limiting activado

### Métricas Importantes

- Tasa de registro exitoso
- Tiempo de respuesta de autenticación
- Tokens expirados vs renovados
- Intentos de acceso no autorizado

---

**🎯 La API está lista para producción con seguridad bancaria y escalabilidad empresarial.**
