# 🚀 COMANDOS OPTIMIZADOS - ASISTENTE RB

## 📋 **COMANDOS PRINCIPALES**

### 🔍 **Verificación**

```bash
# Verificar configuración de Pipedream
npm run verify:pipedream

# Verificar integración completa
npm run verify:integration

# Verificar credenciales
npm run setup:credentials
```

### 🚀 **Desarrollo**

```bash
# Iniciar aplicación (optimizado con info visual)
npm run dev

# Iniciar con verificación previa de Pipedream
npm run dev:full

# Iniciar con ngrok automático (Windows)
npm run dev:ngrok
```

### 🌐 **Producción**

```bash
# Iniciar en producción
npm start

# Verificar estado de producción
npm run production:ready

# Desplegar a Railway
npm run deploy:production
```

## 🎯 **COMANDOS ESPECÍFICOS DE PIPEDREAM**

### ✅ **Verificación Rápida**

```bash
# Script simple que funciona
node verify_pipedream_simple.js
```

### 🔧 **Configuración**

- ✅ `PIPEDREAM_CALENDLY_DISPATCHER_URL` configurada
- ⚠️ `PIPEDREAM_WHATSAPP_INBOUND_HANDLER_URL` opcional

## 📱 **URLs DE WEBHOOKS**

### 🌍 **Desarrollo (ngrok)**

```
Calendly: https://ricardoburitica.ngrok.app/api/calendly/webhook
WhatsApp: https://ricardoburitica.ngrok.app/webhook/whatsapp
```

### 🚀 **Producción (Railway)**

```
Calendly: https://bot.ricardoburitica.eu/api/calendly/webhook
WhatsApp: https://bot.ricardoburitica.eu/webhook/whatsapp
```

## 🔄 **FLUJO OPTIMIZADO**

### 1. **Verificar Sistema**

```bash
npm run verify:pipedream
```

### 2. **Iniciar Desarrollo**

```bash
# Opción A: Solo aplicación
npm run dev

# Opción B: Con verificación previa
npm run dev:full

# Opción C: Con ngrok automático
npm run dev:ngrok
```

### 3. **Configurar Webhooks**

- Usar URLs de ngrok para desarrollo
- Usar URLs de Railway para producción

## 🛠️ **COMANDOS DE UTILIDAD**

```bash
# Estado del sistema
npm run health

# Métricas
npm run metrics

# Logs
npm run logs

# Limpiar caché
npm run cache:clear
```

## 📊 **INFORMACIÓN VISUAL EN npm run dev**

Al ejecutar `npm run dev` ahora verás:

```
🚀 ASISTENTE RB - INICIANDO...
📍 Local: http://localhost:3000
🌍 Público: https://ricardoburitica.ngrok.app
📱 WhatsApp: Configurado
📅 Calendly: Integrado
🤖 IA: OpenAI GPT-4

💡 Presiona Ctrl+C para detener
```

## ⚡ **COMANDOS RÁPIDOS**

```bash
# Verificar y ejecutar en un comando
npm run dev:full

# Solo verificar Pipedream
npm run verify:pipedream

# Iniciar con ngrok
npm run dev:ngrok
```

---

**✅ CONFIGURACIÓN OPTIMIZADA APLICADA**

Los comandos ahora incluyen:

- ✅ Información visual mejorada
- ✅ Verificación automática de Pipedream
- ✅ Integración con ngrok
- ✅ URLs preconfiguradas
- ✅ Comandos simplificados
