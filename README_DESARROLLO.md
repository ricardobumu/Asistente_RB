# 🚀 ASISTENTE RB - CONFIGURACIÓN DEFINITIVA

## ⚡ INICIO RÁPIDO (2 COMANDOS)

```bash
# 1. Limpiar sistema (si es necesario)
CLEAN.bat

# 2. Iniciar aplicación
START.bat
```

## 📋 CONFIGURACIÓN FIJA

- **Puerto**: 3000 (INMUTABLE hasta producción)
- **URL Local**: http://localhost:3000
- **Ngrok**: Configurado con token personal
- **Base de datos**: Supabase (configurada en .env.local)

## 🔗 ENDPOINTS PRINCIPALES

- `GET /health` - Health check general
- `GET /autonomous/whatsapp/health` - Health check del asistente
- `POST /autonomous/whatsapp/webhook` - Webhook de WhatsApp
- `POST /api/calendly/webhook` - Webhook de Calendly

## 🌐 CONFIGURACIÓN WEBHOOKS - URLs FIJAS

**URL FIJA DE DESARROLLO:**
`https://ricardo-beauty-bot.ngrok.io`

**Configurar en Twilio:**

- Webhook URL: `https://ricardo-beauty-bot.ngrok.io/autonomous/whatsapp/webhook`
- Status URL: `https://ricardo-beauty-bot.ngrok.io/autonomous/whatsapp/status`

**Configurar en Calendly:**

- Webhook URL: `https://ricardo-beauty-bot.ngrok.io/api/calendly/webhook`

## 🛠️ COMANDOS DISPONIBLES

- `START.bat` - Inicia servidor + ngrok
- `CLEAN.bat` - Limpia procesos y cache
- `npm start` - Solo servidor (sin ngrok)

## ⚠️ REGLAS IMPORTANTES

1. **NO CAMBIAR EL PUERTO** hasta producción
2. **NO CREAR SCRIPTS ADICIONALES** - usar solo los existentes
3. **NO MODIFICAR** configuración de ngrok
4. **SIEMPRE USAR** START.bat para desarrollo

## 🔧 SOLUCIÓN DE PROBLEMAS

**Puerto ocupado:**

```bash
CLEAN.bat
START.bat
```

**Ngrok no funciona:**

- Verificar que el token esté configurado
- Ejecutar: `ngrok config add-authtoken 2oB9UEBx7ZG4lkGZLIaykuglalE_83XEtyUjmUw5J4y6WQDMr`

**Errores en consola:**

- Son normales durante inicialización
- El sistema funciona aunque aparezcan warnings

## 🎯 PRÓXIMO PASO: PRODUCCIÓN

Una vez validado localmente:

1. Configurar dominio en Railway: `bot.ricardoburitica.eu`
2. Actualizar webhooks con URL de producción
3. Deploy automático desde GitHub

---

**CONFIGURACIÓN DEFINITIVA - NO MODIFICAR HASTA PRODUCCIÓN** ✅
