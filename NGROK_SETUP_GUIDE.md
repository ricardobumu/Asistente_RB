# Guía Rápida: Conectar Aplicación con ngrok

## 🚀 Método 1: Script Automatizado (RECOMENDADO)

1. **Ejecutar el startup manager:**

   ```cmd
   startup_manager.bat
   ```

2. **Seleccionar opción 1** (Iniciar aplicación + ngrok)

3. **Copiar la URL de ngrok** que aparece (ejemplo: `https://abc123.ngrok.io`)

4. **Configurar webhooks:**
   - Twilio WhatsApp: `https://abc123.ngrok.io/webhook/whatsapp`
   - Calendly: `https://abc123.ngrok.io/webhook/calendly`

## 🔧 Método 2: Manual (Paso a Paso)

### Paso 1: Iniciar la aplicación

```cmd
start_app_only.bat
```

O manualmente:

```cmd
npm start
```

### Paso 2: Iniciar ngrok (en otra terminal)

```cmd
start_ngrok_only.bat
```

O manualmente:

```cmd
ngrok http 3000
```

### Paso 3: Verificar conexiones

```cmd
monitor_connections.bat
```

## 📋 URLs Importantes

Una vez que ngrok esté corriendo:

| Servicio         | URL Local                              | URL Pública (ngrok)                     |
| ---------------- | -------------------------------------- | --------------------------------------- |
| Aplicación       | http://localhost:3000                  | https://xxxxx.ngrok.io                  |
| Health Check     | http://localhost:3000/health           | https://xxxxx.ngrok.io/health           |
| Webhook WhatsApp | http://localhost:3000/webhook/whatsapp | https://xxxxx.ngrok.io/webhook/whatsapp |
| Webhook Calendly | http://localhost:3000/webhook/calendly | https://xxxxx.ngrok.io/webhook/calendly |
| Admin Panel      | http://localhost:3000/admin            | https://xxxxx.ngrok.io/admin            |
| ngrok Dashboard  | http://localhost:4040                  | -                                       |

## 🧪 Comandos de Prueba

### Verificar que la aplicación funciona:

```cmd
curl http://localhost:3000/health
```

### Probar webhook de WhatsApp:

```cmd
curl -X POST https://xxxxx.ngrok.io/webhook/whatsapp ^
  -H "Content-Type: application/x-www-form-urlencoded" ^
  -d "From=whatsapp:+1234567890&Body=Hola&MessageSid=test123"
```

### Probar webhook de Calendly:

```cmd
curl -X POST https://xxxxx.ngrok.io/webhook/calendly ^
  -H "Content-Type: application/json" ^
  -d "{\"event\":\"test\"}"
```

## 🔍 Solución de Problemas

### La aplicación no inicia:

```cmd
# Verificar dependencias
npm install

# Revisar logs
type logs\error.log

# Verificar puerto libre
netstat -ano | findstr :3000
```

### ngrok no conecta:

```cmd
# Verificar instalación
ngrok version

# Verificar que la app esté corriendo
netstat -ano | findstr :3000

# Probar conexión básica
ngrok http 3000
```

### Webhook no recibe datos:

1. Verificar que ngrok esté corriendo
2. Verificar URL en la configuración del webhook
3. Revisar logs de la aplicación
4. Probar con curl

## 📝 Configuración de Webhooks Externos

### Twilio WhatsApp:

1. Ir a Twilio Console > WhatsApp Sandbox
2. Configurar webhook URL: `https://xxxxx.ngrok.io/webhook/whatsapp`
3. Método: POST

### Calendly:

1. Ir a Calendly > Account Settings > Webhooks
2. Crear nuevo webhook: `https://xxxxx.ngrok.io/webhook/calendly`
3. Seleccionar eventos: invitee.created, invitee.canceled

## ⚠️ Notas Importantes

1. **La URL de ngrok cambia** cada vez que lo reinicias (a menos que tengas cuenta Pro)
2. **Actualiza los webhooks** cuando cambies la URL
3. **Mantén ambos procesos corriendo** (aplicación + ngrok)
4. **Usa HTTPS** siempre para webhooks en producción
5. **El dashboard de ngrok** está en http://localhost:4040

## 🎯 Próximos Pasos

Una vez que tengas ngrok funcionando:

1. Configurar webhooks en Twilio y Calendly
2. Probar recepción de mensajes WhatsApp
3. Probar eventos de reservas Calendly
4. Configurar dominio personalizado (opcional, requiere ngrok Pro)
