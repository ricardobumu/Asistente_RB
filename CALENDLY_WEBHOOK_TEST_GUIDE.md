# 📅 GUÍA COMPLETA PARA PROBAR WEBHOOK DE CALENDLY

## 🎯 **OBJETIVO**

Probar que cuando crees una cita en Calendly, la información llegue correctamente a tu app y se envíe a Pipedream para procesar con IA y enviar WhatsApp.

---

## 🚀 **PASOS PARA LA PRUEBA**

### 1. **PREPARAR EL ENTORNO**

#### ✅ **Iniciar el servidor local:**

```bash
npm run dev
```

Deberías ver:

```
🚀 ASISTENTE RB - INICIANDO...
📍 Local: http://localhost:3000
🌍 Público: https://ricardoburitica.ngrok.app
📱 WhatsApp: Configurado
📅 Calendly: Integrado
🤖 IA: OpenAI GPT-4
```

#### ✅ **Iniciar ngrok (en otra terminal):**

```bash
ngrok http 3000 --domain=ricardoburitica.ngrok.app
```

### 2. **VERIFICAR CONFIGURACIÓN**

#### ✅ **Ejecutar verificación completa:**

```bash
node setup_calendly_test.js
```

Esto verificará:

- ✅ Servidor local funcionando
- ✅ Túnel ngrok activo
- ✅ Webhook de Calendly disponible
- ✅ Conexión con Pipedream
- ✅ Simulación de evento

#### ✅ **Verificar solo extracción de teléfono:**

```bash
node test_phone_extraction.js
```

---

## 🧪 **PRUEBAS DISPONIBLES**

### 📋 **1. Prueba Completa del Webhook**

```bash
node test_calendly_webhook_complete.js
```

**Opciones disponibles:**

```bash
# Verificar salud del webhook
node test_calendly_webhook_complete.js health

# Probar webhook local
node test_calendly_webhook_complete.js local

# Probar envío directo a Pipedream
node test_calendly_webhook_complete.js pipedream

# Probar todos los tipos de eventos
node test_calendly_webhook_complete.js all-events

# Suite completa
node test_calendly_webhook_complete.js complete
```

### 📱 **2. Prueba de Extracción de Teléfono**

```bash
# Todas las pruebas
node test_phone_extraction.js all

# Payload realista
node test_phone_extraction.js realistic

# Payload personalizado
node test_phone_extraction.js custom
```

### ⚙️ **3. Setup y Configuración**

```bash
# Setup completo
node setup_calendly_test.js complete

# Verificar solo servidor
node setup_calendly_test.js server

# Verificar solo ngrok
node setup_calendly_test.js ngrok

# Verificar solo Pipedream
node setup_calendly_test.js pipedream

# Simular evento
node setup_calendly_test.js simulate

# Mostrar configuración
node setup_calendly_test.js config

# Mostrar instrucciones
node setup_calendly_test.js instructions
```

---

## 🔧 **CONFIGURAR WEBHOOK EN CALENDLY**

### 📝 **Pasos en Calendly:**

1. **Ir a tu cuenta de Calendly**
2. **Navegar a:** Integrations → Webhooks
3. **Crear nuevo webhook con:**
   - **URL:** `https://ricardoburitica.ngrok.app/api/calendly/webhook`
   - **Eventos:**
     - ✅ `invitee.created`
     - ✅ `invitee.canceled`
     - ✅ `invitee.rescheduled`

### 🔑 **Variables de entorno necesarias:**

```env
# En .env.local
PIPEDREAM_CALENDLY_DISPATCHER_URL=https://eoyr2h4h1amk3yh.m.pipedream.net
CALENDLY_ACCESS_TOKEN=tu_token_aqui
CALENDLY_WEBHOOK_SIGNING_KEY=tu_signing_key_aqui
```

---

## 🎭 **CREAR CITA DE PRUEBA**

### 📅 **Proceso de prueba real:**

1. **Ve a tu enlace de Calendly** (ej: `calendly.com/ricardoburitica/consulta`)

2. **Selecciona fecha y hora**

3. **Completa el formulario con:**
   - **Nombre:** Cliente Prueba
   - **Email:** cliente.prueba@example.com
   - **Teléfono/WhatsApp:** +34612345678 ⚠️ **IMPORTANTE**
   - **Servicio:** El que prefieras

4. **Confirmar la cita**

### 📊 **Lo que debería pasar:**

1. **Calendly envía webhook** → Tu app (`/api/calendly/webhook`)
2. **Tu app procesa** → Extrae teléfono y datos
3. **Tu app envía a Pipedream** → Para procesamiento con IA
4. **Pipedream procesa** → Genera respuesta personalizada
5. **Pipedream envía WhatsApp** → Al número del cliente

---

## 🔍 **MONITOREAR LA PRUEBA**

### 📱 **Logs en tiempo real:**

```bash
# En la terminal donde corre npm run dev
# Deberías ver:
📅 Calendly webhook recibido: { eventType: 'invitee.created', ... }
📤 Enviando evento de Calendly a Pipedream: { ... }
✅ Evento enviado exitosamente a Pipedream
```

### 🌐 **Verificar en ngrok:**

- Ve a: `http://localhost:4040`
- Busca requests a `/api/calendly/webhook`

### 🚀 **Verificar en Pipedream:**

- Ve a tu workflow en Pipedream
- Revisa los logs de ejecución

---

## 🐛 **SOLUCIÓN DE PROBLEMAS**

### ❌ **Error: "Servidor local no disponible"**

```bash
# Asegúrate de que el servidor esté corriendo
npm run dev
```

### ❌ **Error: "Túnel ngrok no disponible"**

```bash
# Inicia ngrok en otra terminal
ngrok http 3000 --domain=ricardoburitica.ngrok.app
```

### ❌ **Error: "No se pudo extraer teléfono"**

- Verifica que el formulario de Calendly tenga campo de teléfono
- Ejecuta: `node test_phone_extraction.js` para probar

### ❌ **Error: "Pipedream no responde"**

- Verifica la URL en `.env.local`
- Ejecuta: `node setup_calendly_test.js pipedream`

### ❌ **Error: "Webhook no recibe eventos"**

- Verifica la URL del webhook en Calendly
- Debe ser: `https://ricardoburitica.ngrok.app/api/calendly/webhook`

---

## 📊 **ESTRUCTURA DEL PAYLOAD DE CALENDLY**

### 📋 **Payload típico que recibirás:**

```json
{
  "event": "invitee.created",
  "payload": {
    "uri": "https://api.calendly.com/scheduled_events/...",
    "name": "Consulta de Belleza",
    "start_time": "2024-01-15T10:00:00.000000Z",
    "end_time": "2024-01-15T11:00:00.000000Z",
    "event_type": {
      "name": "Consulta de Belleza - 60 min",
      "duration": 60
    },
    "invitee": {
      "name": "Cliente Prueba",
      "email": "cliente@example.com",
      "phone_number": "+34612345678", // ← ESTE ES EL CLAVE
      "timezone": "Europe/Madrid",
      "questions_and_answers": [
        {
          "question": "¿Cuál es tu número de WhatsApp?",
          "answer": "+34612345678"
        }
      ]
    }
  }
}
```

### 🔍 **Extracción de teléfono (prioridad):**

1. `payload.invitee.phone_number` ← **Primera opción**
2. `payload.invitee.text_reminder_number` ← **Segunda opción**
3. `questions_and_answers` con "teléfono", "phone", "whatsapp" ← **Fallback**

---

## ✅ **CHECKLIST FINAL**

Antes de crear la cita real, verifica:

- [ ] ✅ `npm run dev` corriendo
- [ ] ✅ `ngrok` corriendo con dominio correcto
- [ ] ✅ `node setup_calendly_test.js` pasa todas las verificaciones
- [ ] ✅ Webhook configurado en Calendly con URL correcta
- [ ] ✅ Variables de entorno configuradas
- [ ] ✅ Pipedream workflow activo

### 🎉 **¡LISTO PARA LA PRUEBA REAL!**

Ahora puedes crear una cita en tu Calendly y ver cómo fluye la información:
**Calendly → Tu App → Pipedream → WhatsApp**

---

## 🚀 **COMANDOS RÁPIDOS**

```bash
# Verificación completa
node setup_calendly_test.js

# Probar webhook
node test_calendly_webhook_complete.js

# Probar extracción de teléfono
node test_phone_extraction.js

# Iniciar servidor
npm run dev

# Iniciar ngrok
ngrok http 3000 --domain=ricardoburitica.ngrok.app
```

**¡Tu sistema está listo para procesar citas de Calendly y enviar WhatsApp automáticamente!** 🎊
