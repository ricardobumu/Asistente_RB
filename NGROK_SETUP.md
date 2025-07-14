# 🌐 Guía de Exposición con ngrok

## Estado Actual

✅ Aplicación ejecutándose en puerto 3000
✅ ngrok iniciado para exponer la aplicación

## URLs de Acceso

Una vez que ngrok esté ejecutándose, verás algo como:

```
Forwarding    https://abc123.ngrok.io -> http://localhost:3000
```

## Endpoints Importantes

### 🔗 **URLs Públicas Disponibles:**

- **API Principal**: `https://tu-url.ngrok.io/`
- **Servicios**: `https://tu-url.ngrok.io/api/servicios`
- **WhatsApp Webhook**: `https://tu-url.ngrok.io/api/whatsapp/webhook`
- **Calendly Webhook**: `https://tu-url.ngrok.io/api/calendly/webhook`
- **Portal Cliente**: `https://tu-url.ngrok.io/client/`
- **Admin Dashboard**: `https://tu-url.ngrok.io/admin/`

### 📱 **Configuración de Webhooks:**

#### WhatsApp (Twilio):

```
Webhook URL: https://tu-url.ngrok.io/api/whatsapp/webhook
Método: POST
```

#### Calendly:

```
Webhook URL: https://tu-url.ngrok.io/api/calendly/webhook
Método: POST
Eventos: invitee.created, invitee.canceled
```

## 🔧 **Scripts Disponibles:**

- `start_app.bat` - Iniciar la aplicación
- `start_ngrok.bat` - Iniciar ngrok
- Para detener: Cerrar las ventanas de comando

## 🛡️ **Seguridad:**

- ngrok URL es temporal y cambia cada vez que reinicias
- Solo para desarrollo y pruebas
- No uses en producción sin configurar dominio personalizado

## 📝 **Próximos Pasos:**

1. Copia la URL de ngrok que aparece en la ventana
2. Configura webhooks en Twilio y Calendly con esa URL
3. Prueba los endpoints desde Postman o tu navegador
