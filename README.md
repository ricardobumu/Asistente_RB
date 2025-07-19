# 🤖 Asistente RB - Sistema Autónomo de Reservas

Sistema completo de asistente virtual autónomo para WhatsApp que integra Calendly, OpenAI y Supabase para gestionar reservas de forma completamente automatizada.

## 🚀 Características Principales

### ✨ Asistente Autónomo

- **Conversaciones inteligentes** con OpenAI GPT-4
- **Contexto conversacional** persistente
- **Respuestas personalizadas** según el historial del cliente
- **Análisis de intenciones** automático

### 📅 Gestión de Reservas

- **Integración completa con Calendly** via webhooks
- **Notificaciones automáticas** por WhatsApp
- **Confirmaciones, cancelaciones y reprogramaciones**
- **Portal cliente** para gestión de reservas

### 🔒 Seguridad y Cumplimiento

- **Cumplimiento RGPD** completo
- **Validación de firmas** de webhooks
- **Rate limiting** avanzado
- **Logs de auditoría** detallados
- **Encriptación** de datos sensibles

### 📊 Panel Administrativo

- **Dashboard completo** con métricas en tiempo real
- **Gestión de conversaciones** y clientes
- **Monitoreo de servicios** integrados
- **Herramientas de administración** avanzadas

## 🏗️ Arquitectura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WhatsApp      │    │   Calendly      │    │   Portal Web    │
│   (Twilio)      │    │   Webhooks      │    │   Cliente       │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Express.js Server                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │  WhatsApp   │  │  Calendly   │  │   Admin     │  │ Client  │ │
│  │  Routes     │  │  Routes     │  │   Routes    │  │ Routes  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │   OpenAI    │  │   Twilio    │  │  Supabase   │  │ Context │ │
│  │  Service    │  │  Service    │  │  Service    │  │ Service │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
└─────────────────────────────────────────────────────────────────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   OpenAI API    │    │   Supabase      │    │   Twilio API    │
│   GPT-4         │    │   Database      │    │   WhatsApp      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📦 Instalación

### Prerrequisitos

- **Node.js** 18+
- **npm** o **yarn**
- Cuentas en:
  - [Supabase](https://supabase.com) (Base de datos)
  - [Twilio](https://twilio.com) (WhatsApp)
  - [OpenAI](https://openai.com) (IA)
  - [Calendly](https://calendly.com) (Reservas)

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/asistente-rb.git
cd asistente-rb
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env.local

# Editar con tus credenciales
nano .env.local
```

### Variables de Entorno Principales

```bash
# Servidor
NODE_ENV=production
PORT=3000

# Base de datos
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_clave_anonima
SUPABASE_SERVICE_ROLE_KEY=tu_clave_servicio

# WhatsApp (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=tu_token
TWILIO_WHATSAPP_NUMBER=+14155238886

# OpenAI
OPENAI_API_KEY=sk-xxxxx
OPENAI_MODEL=gpt-4

# Calendly
CALENDLY_ACCESS_TOKEN=tu_token
CALENDLY_USER_URI=https://api.calendly.com/users/xxxxx
CALENDLY_SIGNING_KEY=tu_clave_firma

# Negocio
BUSINESS_NAME=Tu Negocio
BUSINESS_PHONE=+34600000000
BUSINESS_EMAIL=info@tunegocio.com
```

### 4. Configurar base de datos

Ejecutar las migraciones de Supabase:

```sql
-- Crear tablas necesarias
CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE whatsapp_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  phone_number VARCHAR(20) NOT NULL,
  message_in TEXT,
  message_out TEXT,
  message_in_id VARCHAR(255),
  message_out_id VARCHAR(255),
  message_type VARCHAR(20) DEFAULT 'text',
  has_media BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE calendly_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  event_type VARCHAR(50) NOT NULL,
  invitee_name VARCHAR(255),
  invitee_email VARCHAR(255),
  invitee_phone VARCHAR(20),
  event_name VARCHAR(255),
  event_start_time TIMESTAMP WITH TIME ZONE,
  event_end_time TIMESTAMP WITH TIME ZONE,
  message_sent BOOLEAN DEFAULT FALSE,
  message_content TEXT,
  message_id VARCHAR(255),
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100),
  resource_id VARCHAR(255),
  user_id VARCHAR(255),
  user_ip INET,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 5. Iniciar la aplicación

```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## ⚙️ Configuración de Webhooks

### Twilio WhatsApp

```
URL: https://ricardoburitica.ngrok.app/webhook/whatsapp (desarrollo)
URL: https://bot.ricardoburitica.eu/webhook/whatsapp (producción)
Método: POST
```

### Calendly

```
URL: https://ricardoburitica.ngrok.app/api/calendly/webhook (desarrollo)
URL: https://bot.ricardoburitica.eu/api/calendly/webhook (producción)
Método: POST
Eventos: invitee.created, invitee.canceled, invitee.rescheduled
```

## 🚀 Despliegue

### Railway (Recomendado)

1. **Conectar repositorio** a Railway
2. **Configurar variables de entorno** en el dashboard
3. **Desplegar automáticamente** con cada push

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login y deploy
railway login
railway link
railway up
```

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 3000

CMD ["npm", "start"]
```

## 📖 Uso

### 1. Configurar Webhooks

Una vez desplegado, configura los webhooks en:

- **Twilio Console** → WhatsApp Sandbox → Webhook URL
- **Calendly** → Integrations → Webhooks

### 2. Probar el Sistema

```bash
# Health check
curl https://bot.ricardoburitica.eu/health

# Estado de servicios
curl https://bot.ricardoburitica.eu/admin/api/services/status
```

### 3. Acceder a Interfaces

- **Portal Cliente**: `https://bot.ricardoburitica.eu/client` (producción) / `http://localhost:3000/client` (desarrollo)
- **Panel Admin**: `https://bot.ricardoburitica.eu/admin` (producción) / `http://localhost:3000/admin` (desarrollo)
- **API Health**: `https://bot.ricardoburitica.eu/health` (producción) / `http://localhost:3000/health` (desarrollo)

## 🔧 API Endpoints

### WhatsApp

```
POST /webhook/whatsapp          # Webhook de Twilio
GET  /webhook/whatsapp/status   # Estado del servicio
POST /webhook/whatsapp/send     # Envío manual
```

### Calendly

```
POST /api/calendly/webhook      # Webhook de Calendly
GET  /api/calendly/status       # Estado del servicio
GET  /api/calendly/stats        # Estadísticas
```

### Administración

```
GET  /admin/api/stats           # Estadísticas del sistema
GET  /admin/api/conversations   # Lista de conversaciones
POST /admin/api/message         # Envío manual de mensajes
GET  /admin/api/clients         # Lista de clientes
```

### Portal Cliente

```
GET  /client/api/services       # Servicios disponibles
POST /client/api/booking        # Crear reserva
GET  /client/api/history        # Historial del cliente
POST /client/api/contact        # Formulario de contacto
```

## 📊 Estructura del Proyecto

```
asistente-rb/
├── app.js                      # Aplicación principal
├── config/
│   └── environment.js          # Configuración centralizada
├── controllers/
│   ├── adminController.js      # Lógica administrativa
│   ├── calendlyController.js   # Lógica de Calendly
│   ├── clientController.js     # Lógica del portal cliente
│   └── whatsappController.js   # Lógica de WhatsApp
├── routes/
│   ├── adminRoutes.js          # Rutas administrativas
│   ├── calendlyRoutes.js       # Rutas de Calendly
│   ├── clientRoutes.js         # Rutas del portal cliente
│   └── whatsappRoutes.js       # Rutas de WhatsApp
├── services/
│   ├── contextService.js       # Gestión de contexto
│   ├── openaiService.js        # Cliente de OpenAI
│   ├── supabaseService.js      # Cliente de Supabase
│   └── twilioService.js        # Cliente de Twilio
├── utils/
│   ├── logger.js               # Sistema de logging
│   └── phoneNumberFormatter.js # Formateo de teléfonos
├── public/
│   ├── admin/                  # Dashboard administrativo
│   ├── client/                 # Portal cliente
│   └── widget/                 # Widget de reservas
└── logs/                       # Archivos de log
```

## 🔍 Monitoreo

### Logs

```bash
# Ver logs en tiempo real
npm run logs

# Ver solo errores
npm run logs:error

# Limpiar logs
npm run clean:logs
```

### Métricas

```bash
# Métricas generales
curl https://tu-dominio.com/admin/api/metrics

# Estado de servicios
curl https://tu-dominio.com/admin/api/services/status

# Estadísticas de base de datos
curl https://tu-dominio.com/admin/api/database/stats
```

## 🛡️ Seguridad

### Características de Seguridad

- ✅ **Validación de firmas** de webhooks
- ✅ **Rate limiting** por IP y endpoint
- ✅ **Sanitización** de entrada
- ✅ **Headers de seguridad** (Helmet)
- ✅ **CORS** configurado
- ✅ **Logs de auditoría** completos
- ✅ **Encriptación** de datos sensibles

### Cumplimiento RGPD

- ✅ **Retención de datos** configurable
- ✅ **Limpieza automática** de datos antiguos
- ✅ **Logs de auditoría** para trazabilidad
- ✅ **Consentimiento** explícito
- ✅ **Derecho al olvido** implementado

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Test de salud
npm run test:health

# Verificar credenciales
npm run test:credentials

# Test de webhooks
npm run test:webhooks
```

## 📝 Changelog

### v2.0.0 (2024-01-20)

- ✨ **Nueva arquitectura modular** completamente refactorizada
- 🚀 **Asistente autónomo** con OpenAI GPT-4
- 📅 **Integración completa** con Calendly
- 🔒 **Cumplimiento RGPD** implementado
- 📊 **Panel administrativo** avanzado
- 🌐 **Portal cliente** público
- 🛡️ **Seguridad mejorada** con validación de firmas
- 📈 **Métricas y monitoreo** en tiempo real

### v1.0.0 (2023-12-01)

- 🎉 **Lanzamiento inicial** del sistema básico

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 🆘 Soporte

### Documentación

- 📚 [Documentación completa](docs/)
- 🔧 [Guía de API](docs/API.md)
- 🚀 [Guía de despliegue](docs/DEPLOYMENT.md)

### Contacto

- 📧 **Email**: info@ricardoburitica.eu
- 📱 **WhatsApp**: +34600000000
- 🌐 **Web**: https://ricardoburitica.eu

### Issues

Si encuentras algún problema:

1. Revisa los [issues existentes](https://github.com/tu-usuario/asistente-rb/issues)
2. Crea un [nuevo issue](https://github.com/tu-usuario/asistente-rb/issues/new) con detalles

---

**Desarrollado con ❤️ por el equipo de Asistente RB**

_Sistema autónomo de reservas para el futuro de la atención al cliente_
