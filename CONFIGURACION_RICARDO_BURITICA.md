# 🔐 CONFIGURACIÓN ESPECÍFICA - RICARDO BURITICÁ

## 📧 GESTIÓN DE CUENTAS

### **Cuenta Personal: ricardobumu@gmail.com**

- ✅ GitHub
- ✅ Supabase
- ✅ Desarrollo y repositorios

### **Cuenta Profesional: info@ricardoburitica.com (GWS)**

- ✅ Google Calendar (GWS)
- ✅ Zencoder.ai
- ✅ Twilio
- ✅ Calendly
- ✅ Servicios de producción

---

## 🔧 CONFIGURACIÓN DE VARIABLES (.env.local)

### **ESTRUCTURA RECOMENDADA PARA .env.local:**

```env
# =================================
# CONFIGURACIÓN ESPECÍFICA RICARDO BURITICÁ
# =================================

# Base de datos (Cuenta Personal - ricardobumu@gmail.com)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_KEY=tu_service_key

# Seguridad JWT
JWT_SECRET=tu_jwt_secret_64_caracteres_minimo
JWT_REFRESH_SECRET=tu_refresh_secret_64_caracteres_minimo

# Twilio (Cuenta Profesional - info@ricardoburitica.com)
TWILIO_ACCOUNT_SID=tu_account_sid
TWILIO_AUTH_TOKEN=tu_auth_token
TWILIO_WHATSAPP_NUMBER=+14155238886

# Google Calendar (Cuenta Profesional - info@ricardoburitica.com GWS)
GOOGLE_CALENDAR_CREDENTIALS={"type":"service_account","project_id":"tu-proyecto-gws",...}
GOOGLE_CALENDAR_ID=info@ricardoburitica.com

# Calendly (Cuenta Profesional)
CALENDLY_ACCESS_TOKEN=tu_calendly_access_token
CALENDLY_USER_URI=https://api.calendly.com/users/tu_user_id
CALENDLY_WEBHOOK_URI=tu_webhook_uri_de_calendly

# OpenAI (Opcional)
OPENAI_API_KEY=tu_openai_api_key

# Configuración de producción
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://bot.ricardoburitica.eu,https://ricardoburitica.com

# Admin (CAMBIAR EN PRODUCCIÓN)
ADMIN_USERNAME=ricardo
ADMIN_PASSWORD=tu_password_seguro_aqui
```

---

## 📅 CONFIGURACIÓN DE GOOGLE CALENDAR (GWS)

### **Pasos específicos para tu cuenta profesional:**

1. **Accede a Google Cloud Console con info@ricardoburitica.com**

   ```
   https://console.cloud.google.com/
   ```

2. **Crear/Seleccionar Proyecto GWS**

   - Nombre sugerido: `asistente-rb-profesional`
   - Organización: Tu dominio GWS

3. **Habilitar Google Calendar API**

   ```
   APIs & Services > Library > Google Calendar API > Enable
   ```

4. **Crear Service Account**

   ```
   IAM & Admin > Service Accounts > Create Service Account
   Nombre: asistente-rb-calendar
   Email: asistente-rb-calendar@tu-proyecto-gws.iam.gserviceaccount.com
   ```

5. **Descargar Credenciales JSON**

   - Crear clave > JSON
   - Guardar el archivo JSON completo

6. **Configurar GOOGLE_CALENDAR_CREDENTIALS**

   ```env
   GOOGLE_CALENDAR_CREDENTIALS={"type":"service_account","project_id":"tu-proyecto-gws","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"asistente-rb-calendar@tu-proyecto-gws.iam.gserviceaccount.com",...}
   ```

7. **Configurar GOOGLE_CALENDAR_ID**

   ```env
   # Para usar tu calendario principal profesional:
   GOOGLE_CALENDAR_ID=info@ricardoburitica.com

   # O crear un calendario específico:
   GOOGLE_CALENDAR_ID=calendario_id@group.calendar.google.com
   ```

8. **Compartir Calendario**
   - Ve a Google Calendar (info@ricardoburitica.com)
   - Configuración del calendario
   - Compartir con: `asistente-rb-calendar@tu-proyecto-gws.iam.gserviceaccount.com`
   - Permisos: **Realizar cambios en eventos**

---

## 🔗 CONFIGURACIÓN DE WEBHOOKS

### **1. TWILIO (Cuenta Profesional)**

**Configurar en Twilio Console (info@ricardoburitica.com):**

```
Console > Develop > Messaging > Settings > WhatsApp sandbox settings

Webhook URL: https://bot.ricardoburitica.eu/autonomous/whatsapp/webhook
HTTP Method: POST
Status Callback URL: https://bot.ricardoburitica.eu/autonomous/whatsapp/status
```

### **2. CALENDLY (Cuenta Profesional)**

**Tu URI de webhook de Calendly va aquí:**

```env
# En .env.local
CALENDLY_WEBHOOK_URI=tu_uri_webhook_de_calendly
```

**Configurar en Calendly (info@ricardoburitica.com):**

```
Account Settings > Webhooks > Create Webhook

Webhook URL: https://bot.ricardoburitica.eu/api/calendly/webhook
Events:
- invitee.created
- invitee.canceled
- invitee_no_show.created
```

---

## 🚨 SEGURIDAD Y MEJORES PRÁCTICAS

### **1. Separación de Cuentas**

```bash
# Verificar que estás usando la cuenta correcta
# Google Cloud Console: info@ricardoburitica.com
# GitHub: ricardobumu@gmail.com
# Supabase: ricardobumu@gmail.com
```

### **2. Variables de Entorno Seguras**

```bash
# .env.local está en .gitignore ✅
# Nunca commitear credenciales reales ✅
# Usar .env.example para plantillas ✅
```

### **3. Rotación de Credenciales**

```bash
# Cambiar periódicamente:
- JWT_SECRET y JWT_REFRESH_SECRET
- ADMIN_PASSWORD
- Regenerar Service Account keys si es necesario
```

---

## 🧪 VERIFICACIÓN DE CONFIGURACIÓN

### **Script de Verificación:**

```bash
# Verificar configuración completa
npm run test:bookings

# Verificar webhooks
curl https://bot.ricardoburitica.eu/autonomous/whatsapp/webhook
curl https://bot.ricardoburitica.eu/api/calendly/webhook

# Verificar panel admin
curl https://bot.ricardoburitica.eu/admin/health
```

### **Checklist de Configuración:**

- [ ] `.env.local` con todas las variables
- [ ] Google Calendar Service Account creado (info@ricardoburitica.com)
- [ ] Calendario compartido con Service Account
- [ ] Webhooks configurados en Twilio
- [ ] Webhooks configurados en Calendly
- [ ] URI de webhook de Calendly agregada a variables
- [ ] Credenciales de admin cambiadas
- [ ] Sistema probado con `npm run test:bookings`

---

## 📞 FLUJO ESPECÍFICO PARA TU NEGOCIO

### **Cliente agenda por WhatsApp:**

1. Cliente → Bot (Twilio + info@ricardoburitica.com)
2. Bot → IA → Muestra servicios
3. Sistema → Verifica Google Calendar (info@ricardoburitica.com)
4. Sistema → Crea reserva + evento en Calendar
5. **TÚ recibes notificación en tu calendario profesional**
6. Cliente → Recibe confirmación automática

### **Cliente agenda por Calendly:**

1. Cliente → Tu página Calendly (info@ricardoburitica.com)
2. Calendly → Webhook → Tu sistema
3. Sistema → Crea reserva en base de datos
4. **Aparece automáticamente en tu panel admin**

### **Tú gestionas desde admin:**

1. Panel admin → Crear/modificar reservas
2. Sistema → Sincroniza con Google Calendar automáticamente
3. Cliente → Recibe notificaciones por WhatsApp

---

## 🎯 PRÓXIMOS PASOS

1. **Verificar .env.local** - Confirmar que tienes todas las variables
2. **Configurar Google Calendar** - Con cuenta profesional
3. **Agregar URI de Calendly** - A las variables de entorno
4. **Probar sistema** - `npm run test:bookings`
5. **Configurar webhooks** - En Twilio y Calendly
6. **¡Listo para producción!** 🚀

---

## ❓ DUDAS ESPECÍFICAS

**¿Dónde va tu URI de webhook de Calendly?**

```env
# En .env.local:
CALENDLY_WEBHOOK_URI=tu_uri_webhook_de_calendly
```

**¿Todas las variables están en .env.local?**
✅ Perfecto, el sistema las lee con prioridad sobre .env

**¿Cómo evitar conflictos entre cuentas?**

- Google Calendar: Siempre usar info@ricardoburitica.com
- Supabase: Mantener en ricardobumu@gmail.com
- Verificar en cada servicio qué cuenta estás usando
