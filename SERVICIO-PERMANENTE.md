# 🔄 SERVICIO PERMANENTE - Ricardo Beauty Assistant

## 🎯 OBJETIVO

Que tu aplicación corra **siempre**, automáticamente, sin necesidad de mantener terminales abiertas.

## 🚀 SOLUCIONES DISPONIBLES

### ⭐ OPCIÓN 1: PM2 (RECOMENDADA)

**Ventajas:** Profesional, logs, monitoreo, auto-restart

```bash
# Instalar PM2
npm install -g pm2

# Iniciar aplicación
pm2 start server-ngrok.js --name "ricardo-beauty"

# Configurar auto-inicio
pm2 startup
pm2 save

# Comandos útiles
pm2 status    # Ver estado
pm2 logs      # Ver logs
pm2 restart ricardo-beauty
```

### 🔧 OPCIÓN 2: Auto-inicio Simple

**Ventajas:** Fácil, no requiere instalaciones extra

```bash
# Ejecutar script automático
servicio-permanente.bat
# Elegir opción 4
```

### 📅 OPCIÓN 3: Tarea Programada Windows

**Ventajas:** Integrado en Windows, confiable

```bash
# Ejecutar script automático
servicio-permanente.bat
# Elegir opción 2
```

## 🌐 NGROK PERMANENTE

### Para que ngrok también corra siempre:

**Opción A - Como Servicio:**

```bash
# Como administrador
ngrok service install
ngrok service start
```

**Opción B - Al inicio de Windows:**

1. Crear archivo `ngrok-auto.bat`:

```batch
@echo off
ngrok http 3000
```

2. Copiarlo a: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\`

## ✅ RESULTADO FINAL

Con cualquiera de estas opciones:

- ✅ Tu aplicación inicia automáticamente con Windows
- ✅ Se reinicia si se cierra inesperadamente
- ✅ Corre en segundo plano sin molestarte
- ✅ Tus webhooks funcionan 24/7
- ✅ URLs siempre disponibles:
  - `https://tu-url.ngrok-free.app/webhook/whatsapp`
  - `https://tu-url.ngrok-free.app/api/calendly/webhook`

## 🔧 GESTIÓN DEL SERVICIO

### Con PM2:

```bash
pm2 status          # Ver estado
pm2 logs            # Ver logs en tiempo real
pm2 restart all     # Reiniciar
pm2 stop all        # Parar
```

### Con Auto-inicio:

- **Ver:** Administrador de tareas → buscar "Ricardo Beauty"
- **Parar:** Finalizar proceso en administrador de tareas

### Con Tarea Programada:

- **Gestionar:** Panel de Control → Herramientas administrativas → Programador de tareas

## 🎯 ¿CUÁL ELEGIR?

- **Si eres técnico:** PM2 (más control y features)
- **Si quieres simplicidad:** Auto-inicio simple
- **Si prefieres Windows nativo:** Tarea programada

## 🚀 INICIO RÁPIDO

1. Ejecuta: `servicio-permanente.bat`
2. Elige la opción que prefieras
3. ¡Listo! Tu app correrá siempre
