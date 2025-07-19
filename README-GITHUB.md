# 🤖 Asistente RB - Bot Autónomo de WhatsApp

[![Railway Deploy](https://img.shields.io/badge/Deploy-Railway-blueviolet)](https://railway.app)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

> **Bot autónomo de WhatsApp con IA integrada para gestión de reservas y atención al cliente**

## 🚀 **Características Principales**

- 🤖 **IA Conversacional** - OpenAI GPT-4 para respuestas naturales
- 📱 **WhatsApp Nativo** - Integración completa con Twilio
- 📅 **Calendly Automático** - Sincronización de citas en tiempo real
- 🛡️ **Seguridad Avanzada** - RGPD compliant, rate limiting, validación de firmas
- ⚡ **Ultra Rápido** - Arranque en 100ms para desarrollo
- 🌐 **Railway Ready** - Despliegue automático en producción

## 🏗️ **Arquitectura**

```
📂 Asistente RB
├── 🚀 ultra-fast-start.js     # Arranque ultra rápido (100ms)
├── 🛡️ app.js                  # Servidor principal con seguridad
├── 📱 controllers/            # Lógica de negocio
├── 🔗 routes/                 # Endpoints API
├── 🤖 services/               # Servicios integrados
├── 🔧 scripts/                # Configuración y despliegue
└── 🎨 public/                 # Panel administrativo
```

## ⚡ **Inicio Rápido**

### 1. **Instalación**

```bash
git clone https://github.com/tu-usuario/Asistente_RB.git
cd Asistente_RB
npm install
```

### 2. **Configuración**

```bash
# Copiar variables de entorno
cp .env.example .env

# Configurar credenciales en .env:
SUPABASE_URL=tu_url_supabase
SUPABASE_ANON_KEY=tu_key_supabase
TWILIO_ACCOUNT_SID=tu_sid_twilio
TWILIO_AUTH_TOKEN=tu_token_twilio
OPENAI_API_KEY=tu_key_openai
CALENDLY_ACCESS_TOKEN=tu_token_calendly
```

### 3. **Desarrollo Ultra Rápido**

```bash
# Arranque en 100ms
npm run start:ultra

# Con ngrok para webhooks
npm run dev:ngrok
```

### 4. **Producción**

```bash
# Servidor completo con seguridad
npm start
```

## 🌐 **Despliegue en Railway**

### 1. **Conectar Repositorio**

- Conecta tu repositorio en [Railway](https://railway.app)
- Railway detectará automáticamente Node.js

### 2. **Variables de Entorno**

Configura en Railway Dashboard:

```env
SUPABASE_URL=tu_url_supabase
SUPABASE_ANON_KEY=tu_key_supabase
TWILIO_ACCOUNT_SID=tu_sid_twilio
TWILIO_AUTH_TOKEN=tu_token_twilio
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
OPENAI_API_KEY=tu_key_openai
CALENDLY_ACCESS_TOKEN=tu_token_calendly
CALENDLY_WEBHOOK_SECRET=tu_secret_calendly
NODE_ENV=production
```

### 3. **Configurar Webhooks**

```bash
# Twilio Console
Webhook URL: https://tu-app.railway.app/webhook/whatsapp

# Calendly Webhooks
Webhook URL: https://tu-app.railway.app/api/calendly/webhook
```

## 📱 **Endpoints Principales**

### 🔍 **Sistema**

- `GET /health` - Estado del servidor
- `GET /admin` - Panel administrativo

### 📱 **WhatsApp**

- `POST /webhook/whatsapp` - Webhook Twilio
- `GET /webhook/whatsapp/status` - Estado integración

### 📅 **Calendly**

- `POST /api/calendly/webhook` - Webhook Calendly
- `GET /api/calendly/status` - Estado integración

### 👥 **Clientes**

- `GET /api/clients` - Lista de clientes
- `POST /api/clients` - Crear cliente
- `PUT /api/clients/:id` - Actualizar cliente

## 🛡️ **Seguridad**

### ✅ **Implementado**

- 🔒 **Helmet.js** - Headers de seguridad
- 🌐 **CORS** configurado
- 🚦 **Rate Limiting** - 200 req/min WhatsApp, 50 req/min Calendly
- 🧹 **Sanitización** de datos
- 🔐 **Validación de firmas** Twilio y Calendly
- 📝 **Logging** completo y auditoria

### ✅ **RGPD Compliance**

- 📋 Consentimiento explícito
- 🗑️ Derecho al olvido
- 📊 Minimización de datos
- 🔒 Cifrado en tránsito

## 🚀 **Comandos Disponibles**

```bash
# 🔧 DESARROLLO
npm run start:ultra      # Ultra rápido (100ms)
npm run dev:ngrok        # Con túnel ngrok

# 🚀 PRODUCCIÓN
npm start               # Servidor completo
npm run start:fast      # Optimizado local

# 🛠️ CONFIGURACIÓN
npm run setup           # Configuración inicial
npm run setup:complete  # Configuración completa
```

## 📊 **Rendimiento**

- ⚡ **Arranque**: 100ms (desarrollo) / 2s (producción)
- 📱 **WhatsApp**: < 200ms respuesta
- 📅 **Calendly**: < 5s sincronización
- 🤖 **IA**: < 3s generación respuesta
- 🔄 **Uptime**: 99.9%

## 🤖 **Funcionalidades IA**

### ✅ **Conversación Natural**

- Respuestas contextuales
- Memoria de conversación
- Detección de intenciones
- Escalado a humano

### ✅ **Gestión Automática**

- Reserva de citas
- Confirmaciones automáticas
- Recordatorios personalizados
- Seguimiento post-cita

## 📁 **Estructura del Proyecto**

```
📂 src/
├── 🎮 controllers/     # Lógica de negocio
├── 🔗 routes/          # Definición de rutas
├── 🤖 services/        # Servicios integrados
├── 🛡️ middleware/      # Middleware de seguridad
├── 📊 models/          # Modelos de datos
└── 🔧 config/          # Configuración

📂 scripts/
├── 🚀 deploy_railway.js        # Despliegue automático
├── 🔧 configure_webhooks.js    # Configuración webhooks
└── 📊 setup_complete_integration.js

📂 public/
├── 🎨 admin/           # Panel administrativo
├── 👥 client/          # Portal cliente
└── 🎯 widget/          # Widget de reservas

📂 tests/
└── 🧪 integration/     # Tests de integración
```

## 🔧 **Configuración Avanzada**

### 🌐 **Ngrok (Desarrollo)**

```bash
# Configurar dominio fijo
ngrok config add-authtoken tu_token
npm run dev:ngrok
```

### 🚀 **Railway (Producción)**

```bash
# Configurar Railway CLI
npm install -g @railway/cli
railway login
railway link
railway deploy
```

## 📝 **Logs y Monitoreo**

### 📊 **Logs Disponibles**

- `logs/app.log` - Aplicación general
- `logs/security.log` - Eventos de seguridad
- `logs/performance.log` - Métricas de rendimiento
- `logs/audit.log` - Auditoria de acciones

### 🔍 **Monitoreo**

```bash
# Ver logs en tiempo real
tail -f logs/app.log

# Estado del sistema
curl http://localhost:3000/health
```

## 🤝 **Contribuir**

1. Fork el proyecto
2. Crea una rama feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 **Licencia**

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 🆘 **Soporte**

- 📧 **Email**: soporte@ricardoburitica.eu
- 🌐 **Web**: https://bot.ricardoburitica.eu
- 📱 **WhatsApp**: +34 XXX XXX XXX

## 🎯 **Roadmap**

- [ ] 🔄 Integración con más plataformas de calendario
- [ ] 📊 Dashboard de analytics avanzado
- [ ] 🌍 Soporte multi-idioma
- [ ] 📱 App móvil nativa
- [ ] 🤖 IA más avanzada con GPT-4 Turbo

---

**⚡ Desarrollado con Node.js, Express, Supabase, Twilio, OpenAI y mucho ❤️**
