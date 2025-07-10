# 🚀 GUÍA DE DEPLOYMENT EN RAILWAY - ASISTENTE VIRTUAL AUTÓNOMO

## 📋 PREPARACIÓN PARA DEPLOYMENT

### 1. **CONFIGURACIÓN INICIAL DE RAILWAY**

#### Paso 1: Crear Proyecto

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login en Railway
railway login

# Crear nuevo proyecto
railway new asistente-rb-autonomo
```

#### Paso 2: Configurar Variables de Entorno

```bash
# Variables básicas del sistema
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set APP_NAME="Asistente RB Autónomo"
railway variables set APP_VERSION="1.0.0"

# Seguridad JWT (generar secretos seguros)
railway variables set JWT_SECRET="tu_jwt_secret_super_seguro_cambiar_en_produccion"
railway variables set JWT_REFRESH_SECRET="tu_jwt_refresh_secret_super_seguro_cambiar_en_produccion"

# Base de datos (se configurará automáticamente con PostgreSQL de Railway)
# railway variables set DATABASE_URL se genera automáticamente

# Supabase (temporal hasta migrar a Railway DB)
railway variables set SUPABASE_URL="https://tu-proyecto.supabase.co"
railway variables set SUPABASE_ANON_KEY="tu_supabase_anon_key_aqui"

# OpenAI (REQUERIDO para asistente autónomo)
railway variables set OPENAI_API_KEY="sk-tu_openai_api_key"

# Twilio WhatsApp (REQUERIDO para funcionalidad principal)
railway variables set TWILIO_ACCOUNT_SID="tu_twilio_account_sid"
railway variables set TWILIO_AUTH_TOKEN="tu_twilio_auth_token"
railway variables set TWILIO_WHATSAPP_NUMBER="+14155238886"

# Calendly (REQUERIDO para reservas automáticas)
railway variables set CALENDLY_ACCESS_TOKEN="tu_calendly_access_token"

# CORS para ricardoburitica.eu
railway variables set ALLOWED_ORIGINS="https://ricardoburitica.eu,https://www.ricardoburitica.eu,https://ginernet.com"
```

### 2. **CONFIGURAR BASE DE DATOS POSTGRESQL**

```bash
# Agregar PostgreSQL al proyecto Railway
railway add postgresql

# La variable DATABASE_URL se configurará automáticamente
# Ejemplo: postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway
```

### 3. **CONFIGURAR DOMINIO PERSONALIZADO**

```bash
# En Railway Dashboard:
# 1. Ir a Settings > Domains
# 2. Agregar custom domain: api.ricardoburitica.eu
# 3. Configurar DNS records en tu proveedor:

# Configuración DNS:
# CNAME: api.ricardoburitica.eu -> tu-proyecto.up.railway.app
# A record (alternativo): api.ricardoburitica.eu -> [Railway IP]
```

## 🔧 **CONFIGURACIÓN POST-DEPLOYMENT**

### 1. **Configurar Webhooks de Twilio**

#### URL del Webhook WhatsApp:

```
https://api.ricardoburitica.eu/autonomous/whatsapp/webhook
```

#### Configuración en Twilio Console:

1. Ir a **WhatsApp > Senders**
2. Configurar webhook URL: `https://api.ricardoburitica.eu/autonomous/whatsapp/webhook`
3. Método: **POST**
4. Eventos: **Incoming messages**, **Message status**

#### URL de Status Webhook:

```
https://api.ricardoburitica.eu/autonomous/whatsapp/status
```

### 2. **Configurar Calendly Webhooks (Opcional)**

#### Webhook URL:

```
https://api.ricardoburitica.eu/api/calendly/webhook
```

#### Eventos a suscribir:

- `invitee.created`
- `invitee.canceled`
- `invitee_no_show.created`

### 3. **Integrar Widget en ricardoburitica.eu**

#### Código para embeber en tu sitio web:

```html
<!-- Widget completo embebido -->
<iframe
  src="https://api.ricardoburitica.eu/api/widget/embed"
  width="100%"
  height="700"
  frameborder="0"
  style="border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"
>
</iframe>
```

#### Widget JavaScript avanzado:

```html
<div id="booking-widget-container"></div>
<script>
  // Cargar widget dinámicamente
  fetch("https://api.ricardoburitica.eu/api/widget/embed?theme=light&lang=es")
    .then((response) => response.text())
    .then((html) => {
      document.getElementById("booking-widget-container").innerHTML = html;
    });
</script>
```

## 📊 **VERIFICACIÓN Y TESTING**

### 1. **Health Checks**

```bash
# Health check general
curl https://api.ricardoburitica.eu/health

# Health check del asistente autónomo
curl https://api.ricardoburitica.eu/autonomous/whatsapp/health

# Health check del widget
curl https://api.ricardoburitica.eu/api/widget/config
```

### 2. **Test de Funcionalidades**

#### Test WhatsApp:

1. Enviar mensaje al número configurado en Twilio
2. Verificar respuesta automática del asistente
3. Probar flujo completo de reserva

#### Test Widget:

1. Acceder a `https://api.ricardoburitica.eu/api/widget/embed`
2. Seleccionar servicio y horario
3. Completar reserva de prueba

#### Test Integración:

1. Crear reserva desde widget
2. Verificar confirmación por WhatsApp
3. Comprobar creación en Calendly

## 🔒 **SEGURIDAD EN PRODUCCIÓN**

### SSL/TLS

- ✅ Railway proporciona SSL automático
- ✅ Certificados renovados automáticamente
- ✅ HTTP redirect a HTTPS

### Variables de Entorno Seguras

```bash
# Generar nuevos secretos para producción
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Actualizar en Railway
railway variables set JWT_SECRET="nuevo_secret_generado"
railway variables set JWT_REFRESH_SECRET="nuevo_refresh_secret_generado"
```

### Rate Limiting

- ✅ Configurado para todos los endpoints
- ✅ Límites específicos por tipo de operación
- ✅ Protección contra spam en WhatsApp

## 📈 **MONITOREO Y LOGS**

### Railway Logs

```bash
# Ver logs en tiempo real
railway logs

# Ver logs específicos del asistente
railway logs --filter="autonomous"

# Ver logs de errores
railway logs --filter="ERROR"
```

### Métricas Importantes

- **Response time**: < 200ms
- **Error rate**: < 0.1%
- **Uptime**: > 99.9%
- **WhatsApp response time**: < 5 segundos
- **Booking success rate**: > 95%

## 🎯 **URLS FINALES DEL SISTEMA**

### APIs Principales:

- **Health Check**: `https://api.ricardoburitica.eu/health`
- **WhatsApp Webhook**: `https://api.ricardoburitica.eu/autonomous/whatsapp/webhook`
- **Widget Embed**: `https://api.ricardoburitica.eu/api/widget/embed`
- **Servicios API**: `https://api.ricardoburitica.eu/api/services`

### Panel de Administración:

- **Stats WhatsApp**: `https://api.ricardoburitica.eu/autonomous/whatsapp/stats`
- **Conversaciones Activas**: `https://api.ricardoburitica.eu/autonomous/whatsapp/conversations`
- **Configuración Widget**: `https://api.ricardoburitica.eu/api/widget/config`

## 🚀 **COMANDOS DE DEPLOYMENT**

### Deploy Inicial:

```bash
# Conectar repositorio GitHub
railway link

# Deploy automático
railway deploy

# Verificar deployment
railway status
```

### Deploy Continuo:

```bash
# Cada push a main desplegará automáticamente
git push origin main

# Ver logs del deployment
railway logs --deployment
```

## 📋 **CHECKLIST DE DEPLOYMENT**

### Pre-deployment ✅

- [ ] Variables de entorno configuradas
- [ ] PostgreSQL agregado al proyecto
- [ ] Secretos JWT generados
- [ ] Claves de OpenAI, Twilio, Calendly configuradas
- [ ] Dominio DNS configurado

### Post-deployment ✅

- [ ] Health checks funcionando
- [ ] Webhooks de Twilio configurados
- [ ] Widget embebido funcionando
- [ ] Asistente autónomo respondiendo
- [ ] Reservas automáticas funcionando
- [ ] Confirmaciones por WhatsApp enviándose

### Testing en Producción ✅

- [ ] Enviar mensaje de WhatsApp de prueba
- [ ] Crear reserva completa desde WhatsApp
- [ ] Crear reserva desde widget web
- [ ] Verificar confirmaciones automáticas
- [ ] Probar cancelación de reserva
- [ ] Verificar logs y métricas

## 🆘 **TROUBLESHOOTING**

### Problemas Comunes:

#### 1. WhatsApp no responde

```bash
# Verificar webhook URL en Twilio
# Verificar logs
railway logs --filter="whatsapp"

# Test manual del endpoint
curl -X POST https://api.ricardoburitica.eu/autonomous/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"Body":"test","From":"whatsapp:+34123456789"}'
```

#### 2. Widget no carga

```bash
# Verificar endpoint de servicios
curl https://api.ricardoburitica.eu/api/widget/services

# Verificar CORS
curl -H "Origin: https://ricardoburitica.eu" \
     https://api.ricardoburitica.eu/api/widget/services
```

#### 3. Reservas no se crean

```bash
# Verificar conexión con Calendly
railway logs --filter="calendly"

# Verificar variables de entorno
railway variables
```

## 💰 **COSTOS ESTIMADOS**

### Railway:

- **Starter**: $5/mes (512MB RAM, 1GB Storage)
- **Pro**: $20/mes (8GB RAM, 100GB Storage) - Recomendado para producción

### Servicios Externos:

- **OpenAI API**: $10-50/mes (según uso)
- **Twilio WhatsApp**: $0.005/mensaje
- **Calendly**: Plan gratuito suficiente

**Total estimado**: $15-75/mes

---

## 🎉 **¡DEPLOYMENT COMPLETADO!**

Tu asistente virtual autónomo está listo para:

- ✅ Gestionar reservas automáticamente por WhatsApp
- ✅ Procesar reservas desde ricardoburitica.eu
- ✅ Enviar confirmaciones y recordatorios automáticos
- ✅ Funcionar 24/7 sin intervención humana

**URLs principales:**

- **Widget**: https://api.ricardoburitica.eu/api/widget/embed
- **WhatsApp**: Configurado en Twilio
- **Admin**: https://api.ricardoburitica.eu/autonomous/whatsapp/stats
