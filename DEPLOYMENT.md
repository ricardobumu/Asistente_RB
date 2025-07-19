# 🚀 GUÍA DE DESPLIEGUE EN PRODUCCIÓN - ASISTENTE RB

## 📋 RESUMEN EJECUTIVO

Tu **Asistente RB** está completamente preparado para despliegue en Railway. Esta guía te llevará paso a paso desde la verificación final hasta tener tu bot funcionando en producción.

## ✅ VERIFICACIÓN PRE-DESPLIEGUE

### 1. Ejecutar Verificación Automática

```bash
npm run deploy:check
```

Este comando verifica:

- ✅ Archivos críticos presentes
- ✅ Variables de entorno configuradas
- ✅ Configuración de Railway válida
- ✅ Dependencias instaladas
- ✅ Conectividad a servicios

### 2. Generar Secretos de Producción

```bash
npm run generate-secrets
```

Esto creará:

- 🔐 JWT secrets seguros (128 caracteres)
- 🔑 API keys únicos
- 🔒 Passwords administrativos
- 📄 Archivo `production-secrets.txt`

## 🚂 CONFIGURACIÓN EN RAILWAY

### 1. Acceder al Dashboard

- Ve a [Railway Dashboard](https://railway.app/dashboard)
- Selecciona tu proyecto "Asistente RB"
- ID del proyecto: `2806399e-7537-46ce-acc7-fa043193e2a9`

### 2. Configurar Variables de Entorno

#### Variables Críticas (REQUERIDAS)

```env
# Servidor
NODE_ENV=production
PORT=3000

# Base de datos
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_supabase_service_role_key

# Seguridad (usar los generados)
JWT_SECRET=tu_jwt_secret_generado_128_caracteres
JWT_REFRESH_SECRET=tu_jwt_refresh_secret_generado_128_caracteres

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=tu_twilio_account_sid
TWILIO_AUTH_TOKEN=tu_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=+14155238886

# OpenAI
OPENAI_API_KEY=sk-tu_openai_api_key

# Calendly
CALENDLY_ACCESS_TOKEN=tu_calendly_access_token
CALENDLY_USER_URI=https://api.calendly.com/users/tu_user_id
```

#### Variables de Configuración

```env
# CORS y dominios
ALLOWED_ORIGINS=https://bot.ricardoburitica.eu,https://ricardoburitica.eu
PUBLIC_URL=https://bot.ricardoburitica.eu

# Validación de webhooks
VALIDATE_TWILIO_SIGNATURE=true
VALIDATE_CALENDLY_SIGNATURE=true

# Rate limiting (producción)
RATE_LIMIT_MAX_REQUESTS=500
WEBHOOK_RATE_LIMIT_MAX=50

# Configuración de negocio
BUSINESS_NAME=Ricardo Buriticá Beauty Consulting
BUSINESS_EMAIL=info@ricardoburitica.eu
BUSINESS_PHONE=+34600000000

# GDPR
GDPR_CLEANUP_ENABLED=true
GDPR_RETENTION_DAYS=365
GDPR_CONTACT_EMAIL=privacy@ricardoburitica.eu
```

### 3. Verificar Configuración de Railway

Asegúrate que `railway.toml` contenga:

```toml
[deploy]
startCommand = "npm start"
healthcheckPath = "/health"
healthcheckTimeout = 300

[environments.production]
variables = {
  NODE_ENV = "production",
  PORT = "3000"
}
```

## 🚀 PROCESO DE DESPLIEGUE

### Opción A: Despliegue Automatizado (Recomendado)

```bash
npm run deploy
```

Este comando:

1. ✅ Ejecuta verificaciones pre-despliegue
2. 📝 Hace commit de cambios pendientes
3. 🔄 Push a GitHub
4. ⏳ Espera el despliegue en Railway
5. 🏥 Verifica health checks
6. 📊 Prueba endpoints críticos

### Opción B: Despliegue Manual

```bash
# 1. Verificar preparación
npm run deploy:check

# 2. Commit y push
git add .
git commit -m "Deploy to production"
git push origin main

# 3. Railway detectará automáticamente el push
```

## 🔗 CONFIGURACIÓN DE WEBHOOKS

### 1. Twilio WhatsApp

- **URL**: `https://bot.ricardoburitica.eu/webhook/whatsapp`
- **Método**: POST
- **Configurar en**: [Twilio Console](https://console.twilio.com/)

### 2. Calendly

- **URL**: `https://bot.ricardoburitica.eu/api/calendly/webhook`
- **Eventos**: `invitee.created`, `invitee.canceled`
- **Configurar en**: [Calendly Webhooks](https://calendly.com/integrations/webhooks)

## 🏥 VERIFICACIÓN POST-DESPLIEGUE

### 1. Health Check

```bash
curl https://bot.ricardoburitica.eu/health
```

Respuesta esperada:

```json
{
  "status": "OK",
  "version": "2.1.0",
  "environment": "production",
  "services": {
    "supabase": "connected",
    "openai": "configured",
    "twilio": "configured",
    "calendly": "configured"
  }
}
```

### 2. Endpoints Críticos

```bash
# API principal
curl https://bot.ricardoburitica.eu/api

# Servicios
curl https://bot.ricardoburitica.eu/api/servicios

# Admin (requiere autenticación)
curl https://bot.ricardoburitica.eu/admin

# Widget
curl https://bot.ricardoburitica.eu/widget
```

### 3. Test de WhatsApp

1. Envía un mensaje a tu número de Twilio
2. Verifica que el bot responda
3. Prueba hacer una reserva completa

## 📊 MONITOREO Y LOGS

### Railway Dashboard

- **Logs**: Ver en tiempo real en Railway
- **Métricas**: CPU, memoria, requests
- **Deployments**: Historial de despliegues

### Endpoints de Monitoreo

```bash
# Métricas del sistema
curl https://bot.ricardoburitica.eu/metrics

# Estado de cache
curl https://bot.ricardoburitica.eu/cache/stats

# Estadísticas GDPR
curl https://bot.ricardoburitica.eu/admin/gdpr/stats
```

## 🔧 SOLUCIÓN DE PROBLEMAS

### Error: Health Check Falla

```bash
# Verificar logs en Railway
# Revisar variables de entorno
# Verificar conectividad a Supabase
```

### Error: Webhooks No Funcionan

```bash
# Verificar URLs de webhook
# Revisar firmas de validación
# Comprobar rate limiting
```

### Error: Bot No Responde

```bash
# Verificar configuración de Twilio
# Revisar logs de OpenAI
# Comprobar contexto conversacional
```

## 📚 RECURSOS ADICIONALES

### Documentación

- [Railway Docs](https://docs.railway.app/)
- [Supabase Docs](https://supabase.com/docs)
- [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp)
- [Calendly API](https://developer.calendly.com/)
- [OpenAI API](https://platform.openai.com/docs)

### Scripts Útiles

```bash
# Verificar configuración
npm run deploy:check

# Generar nuevos secretos
npm run generate-secrets

# Verificar sistema completo
npm run system:verify

# Limpiar cache
npm run cache:clear

# Ver logs de error
npm run logs:error
```

## 🎯 CHECKLIST FINAL

- [ ] ✅ Verificación pre-despliegue pasada
- [ ] 🔐 Secretos generados y configurados
- [ ] 🚂 Variables configuradas en Railway
- [ ] 🔗 Webhooks configurados
- [ ] 🏥 Health check funcionando
- [ ] 📱 WhatsApp respondiendo
- [ ] 📅 Reservas automáticas funcionando
- [ ] 📊 Monitoreo configurado

## 🎉 ¡FELICIDADES!

Tu **Asistente RB** está ahora funcionando en producción, gestionando reservas automáticamente 24/7.

### URLs Importantes

- **Aplicación**: https://bot.ricardoburitica.eu
- **Health Check**: https://bot.ricardoburitica.eu/health
- **Admin Dashboard**: https://bot.ricardoburitica.eu/admin
- **Widget Público**: https://bot.ricardoburitica.eu/widget

### Soporte

Para cualquier problema, revisa:

1. Logs en Railway Dashboard
2. Health check endpoint
3. Esta documentación
4. Scripts de verificación

---

**Desarrollado por**: Ricardo Buriticá - Asistente RB Team
**Versión**: 2.1.0
**Fecha**: 2024
