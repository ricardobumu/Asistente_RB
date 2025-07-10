# Asistente RB - Sistema de Reservas

## 📋 Descripción

Sistema de gestión de reservas con notificaciones automatizadas, integración con Supabase, Twilio, Calendly y OpenAI.

## 🚀 Características

- **Gestión de Clientes**: CRUD completo con historial
- **Sistema de Reservas**: Programación con validación de disponibilidad
- **Notificaciones**: WhatsApp, Email y SMS automatizados
- **Integración con Calendly**: Sincronización de eventos
- **IA Conversacional**: Asistente con OpenAI
- **Logging Avanzado**: Sistema de auditoría completo

## 🛠️ Instalación

### Prerrequisitos

- Node.js 18+
- Cuenta de Supabase (requerida)
- Cuenta de Twilio (opcional)
- API Key de OpenAI (opcional)

### Pasos

1. **Instalar dependencias**

```bash
npm install
```

2. **Configurar variables de entorno**
   Crear archivo `.env` con:

```env
# Requerido
SUPABASE_URL=tu_supabase_url
SUPABASE_ANON_KEY=tu_supabase_anon_key

# Opcional
TWILIO_ACCOUNT_SID=tu_twilio_sid
TWILIO_AUTH_TOKEN=tu_twilio_token
TWILIO_WHATSAPP_NUMBER=+14155238886
CALENDLY_ACCESS_TOKEN=tu_calendly_token
OPENAI_API_KEY=tu_openai_key

# Configuración
NODE_ENV=development
PORT=3000
APP_NAME=Asistente RB
APP_VERSION=1.0.0
```

3. **Ejecutar la aplicación**

```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## 📊 Estructura del Proyecto

```
src/
├── config/           # Configuración
├── integrations/     # Clientes externos
├── models/          # Modelos de datos
├── utils/           # Utilidades
└── index.js         # Punto de entrada
```

## 🔌 Endpoints

- `GET /` - Información del servidor
- `GET /health` - Estado del sistema

## 📝 Modelos Disponibles

- **ClientModel**: Gestión de clientes
- **BookingModel**: Sistema de reservas
- **ServiceModel**: Catálogo de servicios
- **UserModel**: Usuarios del sistema
- **NotificationModel**: Sistema de notificaciones

## 📊 Logging

Los logs se guardan en la carpeta `logs/`:

- `app.log` - Logs generales
- `error.log` - Errores del sistema

## 🔐 Seguridad

- Validación de variables de entorno
- Logging de todas las requests
- Manejo de errores centralizado
- Sanitización de datos

## 📄 Licencia

MIT License - ver archivo LICENSE para detalles.

---

**Desarrollado para optimizar la gestión de reservas**
