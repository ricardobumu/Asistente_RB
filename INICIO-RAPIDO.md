# 🚀 ASISTENTE RB - INICIO RÁPIDO

## ⚡ ARRANQUE ULTRA RÁPIDO (138ms - 0.138 segundos)

### 1. Inicializar configuración (solo una vez)

```bash
npm run config:init
```

### 2. Iniciar servidor rápido

```bash
npm run start:fast
```

## 📋 COMANDOS DISPONIBLES

### 🚀 Inicio del servidor

- `npm run start:fast` - **Arranque ultra rápido** (recomendado)
- `npm run start:quick` - Arranque rápido básico
- `npm run start` - Arranque normal (más lento)

### 🔧 Desarrollo con ngrok

- `npm run dev:fast` - **Desarrollo rápido con ngrok** (recomendado)
- `npm run dev:node` - Desarrollo con Node.js y ngrok
- `npm run dev:ngrok` - Desarrollo tradicional con ngrok

### ⚙️ Configuración

- `npm run config:init` - Inicializar caché de configuración
- `npm run config:status` - Ver estado de configuración
- `npm run config:refresh` - Refrescar configuración

### 📱 Números de teléfono

- `npm run phone:analyze` - Analizar números inválidos
- `npm run phone:fix` - Corregir números automáticamente

### 🔍 Monitoreo

- `npm run system:check` - **Verificación completa optimizada** (recomendado)
- `npm run system:health` - Verificación completa del sistema
- `npm run health` - Health check básico

## 🎯 ENDPOINTS PRINCIPALES

### 📊 Sistema

- `GET /health` - Estado del servidor
- `GET /config/status` - Estado de configuración
- `POST /config/refresh` - Refrescar configuración
- `GET /routes/status` - Estado de rutas lazy loading
- `POST /routes/clear-cache` - Limpiar caché de rutas
- `POST /routes/preload` - Precargar rutas críticas

### 📱 WhatsApp

- `POST /webhook/whatsapp` - Webhook de Twilio

### 📅 Calendly

- `POST /webhook/calendly` - Webhook de eventos

### 🔧 Administración

- `GET /admin` - Dashboard administrativo
- `GET /api/*` - Endpoints de API

## 🔧 CONFIGURACIÓN

### Variables críticas (deben estar en .env.local):

```env
# Base de datos
SUPABASE_URL=tu_url_supabase
SUPABASE_SERVICE_KEY=tu_service_key

# WhatsApp
TWILIO_ACCOUNT_SID=tu_account_sid
TWILIO_AUTH_TOKEN=tu_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890

# IA
OPENAI_API_KEY=tu_openai_key

# Seguridad
JWT_SECRET=tu_jwt_secret
```

## 🚨 SOLUCIÓN DE PROBLEMAS

### Error: "Configuración crítica inválida"

```bash
# Verificar variables de entorno
npm run config:status

# Reinicializar configuración
npm run config:init
```

### Error: "Webhook no disponible"

- Verificar que las rutas estén configuradas
- Comprobar que los archivos de rutas existan

### Arranque lento

```bash
# Limpiar caché y reinicializar
rm src/config/config-cache.json
npm run config:init
npm run start:fast
```

## 📈 RENDIMIENTO

### Tiempos de arranque típicos:

- **Ultra rápido**: 138ms (0.138 segundos)
- **Rápido**: 1-3 segundos
- **Normal**: 10+ segundos
- **Mejora conseguida**: 98.6% más rápido

### Optimizaciones implementadas:

- ✅ Caché de configuración persistente
- ✅ Lazy loading de rutas
- ✅ Validación rápida sin conexiones externas
- ✅ Carga diferida de módulos pesados

## 🔄 FLUJO DE TRABAJO RECOMENDADO

### Primera vez:

1. `npm install`
2. Configurar `.env.local` con credenciales
3. `npm run config:init`
4. `npm run start:fast`

### Uso diario:

1. `npm run start:fast`
2. ¡Listo en menos de 1 segundo!

### Mantenimiento:

- Ejecutar `npm run config:refresh` si cambian credenciales
- Ejecutar `npm run phone:fix` periódicamente
- Ejecutar `npm run system:health` para verificación completa

## 🎉 ¡DISFRUTA DEL ARRANQUE ULTRA RÁPIDO!

Tu bot autónomo de WhatsApp está listo para funcionar en tiempo récord.
