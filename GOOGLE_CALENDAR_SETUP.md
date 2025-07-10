# 📅 CONFIGURACIÓN GOOGLE CALENDAR - GUÍA COMPLETA

## 🔗 URLs PARA GOOGLE CLOUD CONSOLE

### 📍 ORÍGENES AUTORIZADOS DE JAVASCRIPT:

```
https://bot.ricardoburitica.eu
http://localhost:3000
https://asistente-rb-production.up.railway.app
```

### 📍 URIs DE REDIRECCIONAMIENTO AUTORIZADOS:

```
https://bot.ricardoburitica.eu/auth/google/callback
https://bot.ricardoburitica.eu/api/auth/google/callback
https://bot.ricardoburitica.eu/integrations/google/callback
http://localhost:3000/auth/google/callback
http://localhost:3000/api/auth/google/callback
https://asistente-rb-production.up.railway.app/auth/google/callback
https://asistente-rb-production.up.railway.app/api/auth/google/callback
```

## 🔧 PASOS DETALLADOS

### 1. ACCEDER A GOOGLE CLOUD CONSOLE

- URL: https://console.cloud.google.com/
- Seleccionar proyecto existente o crear uno nuevo
- Nombre sugerido: "Asistente RB Calendar"

### 2. HABILITAR APIs NECESARIAS

```bash
# APIs requeridas:
- Google Calendar API
- Google People API (opcional)
```

**Pasos:**

1. Ve a "APIs y servicios" > "Biblioteca"
2. Busca "Google Calendar API"
3. Clic en "HABILITAR"
4. Repite para Google People API si necesitas gestión de contactos

### 3. CREAR CREDENCIALES OAUTH 2.0

**Pasos:**

1. Ve a "APIs y servicios" > "Credenciales"
2. Clic en "+ CREAR CREDENCIALES"
3. Selecciona "ID de cliente de OAuth 2.0"
4. Tipo de aplicación: "Aplicación web"
5. Nombre: "Asistente RB Calendar Client"

**Configurar URLs:**

- Copia y pega las URLs de arriba en los campos correspondientes
- Guarda la configuración

### 4. CONFIGURAR PANTALLA DE CONSENTIMIENTO

**Pasos:**

1. Ve a "APIs y servicios" > "Pantalla de consentimiento de OAuth"
2. Tipo de usuario: "Externo" (para uso público)
3. Información de la aplicación:
   - Nombre: "Asistente RB"
   - Email de soporte: tu_email@dominio.com
   - Logotipo: (opcional)
   - Dominio autorizado: ricardoburitica.eu

**Alcances requeridos:**

```
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
```

### 5. DESCARGAR CREDENCIALES

**Después de crear el cliente OAuth:**

1. Clic en el icono de descarga junto a tu cliente
2. Guarda el archivo como `google-calendar-credentials.json`
3. Colócalo en la raíz del proyecto

## 🔐 VARIABLES DE ENTORNO REQUERIDAS

Después de obtener las credenciales, agrega a tu `.env`:

```bash
# Google Calendar Configuration
GOOGLE_CLIENT_ID=tu_client_id_aqui
GOOGLE_CLIENT_SECRET=tu_client_secret_aqui
GOOGLE_REDIRECT_URI=https://bot.ricardoburitica.eu/auth/google/callback

# Google Calendar Settings
GOOGLE_CALENDAR_ID=primary
GOOGLE_CALENDAR_TIMEZONE=Europe/Madrid
GOOGLE_CALENDAR_ENABLED=true
```

## 📋 VERIFICACIÓN DE CONFIGURACIÓN

### Verificar que las URLs estén correctas:

1. **Producción principal:** https://bot.ricardoburitica.eu
2. **Railway backup:** https://asistente-rb-production.up.railway.app
3. **Desarrollo local:** http://localhost:3000

### Verificar APIs habilitadas:

- ✅ Google Calendar API
- ✅ Google People API (opcional)

### Verificar alcances configurados:

- ✅ calendar (lectura/escritura de calendarios)
- ✅ calendar.events (gestión de eventos)
- ✅ userinfo.email (email del usuario)
- ✅ userinfo.profile (perfil básico)

## 🚀 TESTING

### Probar la integración:

1. Iniciar el servidor: `npm start`
2. Ir a: `https://bot.ricardoburitica.eu/auth/google`
3. Completar el flujo de OAuth
4. Verificar que se crean eventos en Google Calendar

### Endpoints de prueba:

```
GET /auth/google - Iniciar OAuth
GET /auth/google/callback - Callback de OAuth
POST /api/calendar/events - Crear evento
GET /api/calendar/events - Listar eventos
```

## ⚠️ NOTAS IMPORTANTES

### Seguridad:

- Nunca subas el archivo `google-calendar-credentials.json` a Git
- Usa variables de entorno para credenciales en producción
- Configura dominios autorizados correctamente

### Límites de API:

- Google Calendar API: 1,000,000 requests/día
- Quota por usuario: 10,000 requests/100 segundos
- Implementar rate limiting en la aplicación

### Monitoreo:

- Verificar uso de cuota en Google Cloud Console
- Monitorear errores de autenticación
- Logs de eventos creados/modificados

## 🔄 FLUJO DE INTEGRACIÓN

1. **Usuario autoriza** → OAuth flow
2. **Sistema obtiene** → Access token + Refresh token
3. **Sistema crea** → Eventos automáticamente
4. **Sistema sincroniza** → Cambios bidireccionales
5. **Sistema notifica** → Confirmaciones y recordatorios

## 📞 SOPORTE

Si tienes problemas:

1. Verificar URLs en Google Cloud Console
2. Comprobar que las APIs están habilitadas
3. Revisar logs de la aplicación
4. Verificar variables de entorno
5. Probar con diferentes navegadores/dispositivos
