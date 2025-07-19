# 🚀 CÓMO USAR ASISTENTE RB - GUÍA RÁPIDA

## 📋 COMANDOS SIMPLES (Como antes)

### **🎯 INICIO RÁPIDO**

```bash
start.bat
```

**¿Qué hace?**

- ✅ Verifica credenciales y estado del sistema
- 🌐 Inicia túnel ngrok (ricardoburitica.ngrok.app)
- 🚀 Inicia servidor en ventana separada
- 📱 Configura webhooks automáticamente
- 🖥️ Abre 2 ventanas: Servidor + ngrok
- 🔗 URLs: Local + Pública funcionando

---

### **🔧 CONFIGURACIÓN INICIAL**

```bash
setup.bat
```

**¿Qué hace?**

- 📦 Instala dependencias
- 🔐 Verifica credenciales
- 🏗️ Configura integración completa
- 📋 Te dice qué falta por hacer

---

### **🧪 PROBAR SISTEMA**

```bash
test.bat
```

**¿Qué hace?**

- 🔐 Verifica credenciales
- 🏥 Comprueba estado de servicios
- 🔄 Prueba integración completa
- 📊 Muestra reporte detallado

---

### **🔧 SOLUCIONAR PROBLEMAS**

```bash
fix.bat
```

**¿Qué hace?**

- 🎯 Menú interactivo de soluciones
- 🔐 Renovar credenciales
- 📦 Reinstalar dependencias
- 🗄️ Configurar base de datos
- 📡 Configurar webhooks

---

### **🌐 CONFIGURAR NGROK**

```bash
setup_ngrok.bat
```

**¿Qué hace?**

- 📦 Instala ngrok si no está
- 🔐 Configura autenticación
- 🌐 Configura dominio fijo
- 🧪 Prueba conexión

---

### **📊 MONITOREAR SISTEMA**

```bash
monitor.bat
```

**¿Qué hace?**

- 📊 Muestra estado en tiempo real
- 🔄 Auto-refresh cada 10 segundos
- 🌐 Verifica ngrok y servidor
- 🎮 Acciones rápidas (detener, logs, etc.)

---

### **🛑 DETENER TODO**

```bash
stop.bat
```

**¿Qué hace?**

- 🛑 Detiene ngrok y servidor
- 🖥️ Cierra ventanas auxiliares
- 🧹 Limpia procesos
- ✅ Confirmación de parada

---

## 🎯 FLUJO DE USO TÍPICO

### **Primera vez:**

```bash
1. setup_ngrok.bat     # Configurar ngrok (solo una vez)
2. setup.bat           # Configurar aplicación
3. start.bat           # Iniciar sistema completo
```

### **Uso diario:**

```bash
start.bat              # Inicia todo: ngrok + servidor
```

### **Monitoreo:**

```bash
monitor.bat            # Ver estado en tiempo real
```

### **Si hay problemas:**

```bash
1. test.bat            # Ver qué falla
2. fix.bat             # Solucionarlo
3. start.bat           # Iniciar de nuevo
```

### **Para detener:**

```bash
stop.bat               # Detiene todo limpiamente
```

---

## 🔧 SOLUCIÓN DE PROBLEMAS COMUNES

### **❌ "OpenAI API Key inválida"**

```bash
1. Ir a: https://platform.openai.com/api-keys
2. Crear nueva API key
3. Actualizar OPENAI_API_KEY en .env.local
4. start.bat
```

### **❌ "Twilio authentication failed"**

```bash
1. Ir a: https://console.twilio.com/
2. Verificar Account SID y Auth Token
3. Actualizar en .env.local
4. start.bat
```

### **❌ "Database connection failed"**

```bash
1. fix.bat → opción 3 (Configurar base de datos)
2. Seguir instrucciones para Supabase
3. start.bat
```

### **❌ "Webhooks not working"**

```bash
1. fix.bat → opción 4 (Configurar webhooks)
2. Seguir instrucciones para Twilio/Calendly
3. start.bat
```

---

## 📱 URLS IMPORTANTES

### **🌐 URLs Locales:**

- **Aplicación:** http://localhost:3000
- **Admin:** http://localhost:3000/admin
- **Health:** http://localhost:3000/health

### **🌍 URLs Públicas (ngrok):**

- **Aplicación:** https://ricardoburitica.ngrok.app
- **Admin:** https://ricardoburitica.ngrok.app/admin
- **Health:** https://ricardoburitica.ngrok.app/health

### **📡 Webhooks (para configurar en servicios):**

- **WhatsApp:** https://ricardoburitica.ngrok.app/webhook/whatsapp
- **Calendly:** https://ricardoburitica.ngrok.app/api/calendly/webhook

---

## 🎯 ESTADO ACTUAL

| Componente   | Estado  | Acción                 |
| ------------ | ------- | ---------------------- |
| **Calendly** | ✅ OK   | Ninguna                |
| **Supabase** | ✅ OK   | Ninguna                |
| **OpenAI**   | ❌ FAIL | Renovar API Key        |
| **Twilio**   | ❌ FAIL | Verificar credenciales |

---

## 🚀 DESPUÉS DE CONFIGURAR

Una vez que todo esté verde:

1. **Configurar webhooks externos:**
   - Twilio Console → WhatsApp webhook
   - Calendly → Pipedream → Tu servidor

2. **Probar flujo completo:**
   - Enviar mensaje WhatsApp
   - Crear evento en Calendly
   - Verificar respuestas automáticas

3. **Usar diariamente:**
   - Solo ejecutar: `start.bat`

---

## 💡 TIPS

- **Siempre usar `start.bat`** para iniciar (no npm run dev directamente)
- **Si algo falla:** `test.bat` primero, luego `fix.bat`
- **Para configuración inicial:** `setup.bat` una sola vez
- **Los logs** se muestran en la consola en tiempo real

---

**¡Ahora es tan simple como antes, pero con toda la potencia nueva!** 🚀
