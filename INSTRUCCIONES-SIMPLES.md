# 🚀 GUÍA SÚPER SIMPLE - Ricardo Beauty Assistant

## ✅ LO QUE YA TIENES FUNCIONANDO:

- ✅ Tu servidor local está corriendo
- ✅ Responde en http://localhost:3000
- ✅ Ngrok está instalado

## 📋 LO QUE NECESITAS HACER (3 PASOS SIMPLES):

### PASO 1: Ejecutar el script automático

```
configuracion-automatica.bat
```

### PASO 2: Si ngrok no está corriendo

1. Abre una nueva ventana de CMD
2. Escribe: `ngrok http 3000`
3. Presiona Enter
4. Verás algo como:

```
Forwarding    https://abc123.ngrok-free.app -> http://localhost:3000
```

### PASO 3: Copiar las URLs

El script te dará las URLs finales. Ejemplo:

- **WhatsApp:** https://abc123.ngrok-free.app/webhook/whatsapp
- **Calendly:** https://abc123.ngrok-free.app/api/calendly/webhook

## 🔧 SI ALGO NO FUNCIONA:

### Problema: "No encuentro ngrok"

**Solución:** Descarga desde https://ngrok.com/download

### Problema: "Puerto ocupado"

**Solución:**

```
taskkill /f /im node.exe
```

### Problema: "No responde la URL"

**Solución:** Verifica que:

1. El servidor local funcione: `curl http://localhost:3000`
2. Ngrok esté corriendo: `ngrok http 3000`

## 📞 CONFIGURAR WEBHOOKS:

### Para Twilio/WhatsApp:

1. Ve a tu dashboard de Twilio
2. Busca "Webhook URL"
3. Pega: `https://tu-url.ngrok-free.app/webhook/whatsapp`

### Para Calendly:

1. Ve a tu dashboard de Calendly
2. Busca "Webhooks" en configuración
3. Pega: `https://tu-url.ngrok-free.app/api/calendly/webhook`

## ✨ ¡LISTO!

Una vez configurado, los mensajes de WhatsApp y eventos de Calendly llegarán automáticamente a tu aplicación.
