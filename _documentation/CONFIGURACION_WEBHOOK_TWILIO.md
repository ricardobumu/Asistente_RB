# 📱 CONFIGURACIÓN WEBHOOK TWILIO WHATSAPP

## 🎯 **URL PARA TWILIO CONSOLE**

```
https://ricardoburitica.ngrok.app/webhook/whatsapp
```

## ⚙️ **CONFIGURACIÓN EN TWILIO CONSOLE**

### **1. Acceder a Twilio Console:**

- Ve a: https://console.twilio.com/
- Navega a: **Messaging** → **Try it out** → **Send a WhatsApp message**
- O directamente: **Messaging** → **Settings** → **WhatsApp sandbox settings**

### **2. Configurar Webhook URL:**

```
Webhook URL: https://ricardoburitica.ngrok.app/webhook/whatsapp
HTTP Method: POST
```

### **3. Configurar Status Callback (opcional):**

```
Status Callback URL: https://ricardoburitica.ngrok.app/webhook/whatsapp/status
HTTP Method: POST
```

## 🔧 **VARIABLES DE ENTORNO NECESARIAS**

Asegúrate de tener estas variables en tu `.env`:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
TWILIO_WEBHOOK_VERIFY_TOKEN=tu_token_secreto_aqui

# Environment
NODE_ENV=development
```

## 🚀 **PASOS PARA ACTIVAR EL WEBHOOK**

### **1. Iniciar ngrok:**

```bash
ngrok http 3000
```

### **2. Copiar URL de ngrok:**

- Copia la URL HTTPS que aparece (ej: `https://ricardoburitica.ngrok.app`)

### **3. Iniciar tu aplicación:**

```bash
npm run dev
```

### **4. Configurar en Twilio:**

- Pega la URL: `https://ricardoburitica.ngrok.app/webhook/whatsapp`
- Método: **POST**
- Guarda la configuración

### **5. Probar el webhook:**

- Envía un mensaje al número de WhatsApp sandbox de Twilio
- Deberías ver logs en tu consola

## 📋 **FORMATO DE DATOS QUE RECIBIRÁS**

### **Webhook de mensaje entrante:**

```javascript
{
  "Body": "Hola, quiero información",
  "From": "whatsapp:+34600123456",
  "To": "whatsapp:+14155238886",
  "MessageSid": "SM1234567890abcdef",
  "AccountSid": "ACxxxxxxxxxxxxxxxxxxxxx",
  "ProfileName": "Nombre Usuario",
  "WaId": "34600123456"
}
```

### **Webhook de estado de mensaje:**

```javascript
{
  "MessageSid": "SM1234567890abcdef",
  "MessageStatus": "delivered", // sent, delivered, read, failed
  "To": "whatsapp:+34600123456",
  "AccountSid": "ACxxxxxxxxxxxxxxxxxxxxx"
}
```

## 🔒 **SEGURIDAD IMPLEMENTADA**

### **✅ Para Desarrollo (ngrok):**

- Validación de firma **DESHABILITADA** automáticamente
- Detección automática de ngrok/localhost
- Logs detallados para debugging

### **✅ Para Producción:**

- Validación de firma Twilio **HABILITADA**
- Rate limiting específico para WhatsApp
- Logging de seguridad completo

## 🧪 **TESTING DEL WEBHOOK**

### **1. Verificar que el servidor esté corriendo:**

```bash
curl https://ricardoburitica.ngrok.app/health
```

### **2. Test manual del webhook:**

```bash
curl -X POST https://ricardoburitica.ngrok.app/webhook/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "Body=Hola&From=whatsapp:+34600123456&MessageSid=SM123&ProfileName=Test"
```

### **3. Verificar logs:**

Deberías ver en tu consola:

```
[INFO] WhatsApp webhook received
[INFO] Desarrollo con ngrok detectado - omitiendo validación de firma Twilio
[INFO] Cliente procesado: ID xxx
```

## 🎯 **FLUJO COMPLETO DEL BOT**

```
1. Usuario envía mensaje WhatsApp
   ↓
2. Twilio recibe mensaje
   ↓
3. Twilio envía webhook a tu URL
   ↓
4. Tu servidor procesa el mensaje
   ↓
5. Bot analiza intención y genera respuesta
   ↓
6. Bot envía respuesta via Twilio
   ↓
7. Usuario recibe respuesta en WhatsApp
```

## 🚨 **TROUBLESHOOTING**

### **Error: "Unauthorized"**

- Verifica que `NODE_ENV=development` esté en tu `.env`
- Confirma que ngrok esté corriendo
- Revisa que la URL en Twilio sea correcta

### **Error: "Route not found"**

- Verifica que la URL sea exactamente: `/webhook/whatsapp`
- Confirma que el método sea **POST**

### **No recibo webhooks:**

- Verifica que ngrok esté exponiendo el puerto correcto (3000)
- Confirma que tu aplicación esté corriendo
- Revisa los logs de ngrok: `ngrok http 3000 --log=stdout`

### **Bot no responde:**

- Verifica las variables de entorno de Twilio
- Confirma que `TWILIO_WHATSAPP_NUMBER` esté configurado
- Revisa los logs de tu aplicación

## ✅ **CHECKLIST FINAL**

- [ ] ngrok corriendo en puerto 3000
- [ ] Aplicación corriendo (`npm run dev`)
- [ ] Variables de entorno configuradas
- [ ] URL configurada en Twilio Console
- [ ] Método POST seleccionado
- [ ] Test de webhook exitoso

**¡Tu webhook de WhatsApp está listo para recibir mensajes!** 🎉
