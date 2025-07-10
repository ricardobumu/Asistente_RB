# Guía de Instalación - Asistente RB

## 🚀 Instalación Rápida

### 1. Prerrequisitos

- **Node.js 18+** - [Descargar aquí](https://nodejs.org/)
- **Cuenta de Supabase** - [Crear cuenta](https://supabase.com/)
- **Git** (opcional) - Para clonar el repositorio

### 2. Obtener el Código

```bash
# Si tienes Git
git clone <repository-url>
cd Asistente_RB

# O descargar y extraer el ZIP
```

### 3. Instalar Dependencias

```bash
npm install
```

### 4. Configuración Automática

```bash
npm run setup
```

Este comando te guiará paso a paso para configurar las variables de entorno.

### 5. Ejecutar la Aplicación

```bash
# Desarrollo (con auto-reload)
npm run dev

# Producción
npm start
```

### 6. Verificar Instalación

Visita: http://localhost:3000

Deberías ver:

```json
{
  "mensaje": "¡Servidor funcionando correctamente!",
  "app": "Asistente RB",
  "version": "1.0.0"
}
```

## 🔧 Configuración Manual

Si prefieres configurar manualmente, crea un archivo `.env`:

```env
# Requerido
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_clave_anonima

# Opcional
TWILIO_ACCOUNT_SID=tu_twilio_sid
TWILIO_AUTH_TOKEN=tu_twilio_token
TWILIO_WHATSAPP_NUMBER=+14155238886
CALENDLY_ACCESS_TOKEN=tu_calendly_token
OPENAI_API_KEY=sk-tu_openai_key

# Configuración
NODE_ENV=development
PORT=3000
APP_NAME=Asistente RB
APP_VERSION=1.0.0
```

## 📊 Configurar Supabase

### 1. Crear Proyecto

1. Ve a [Supabase](https://supabase.com/)
2. Crea un nuevo proyecto
3. Espera a que se complete la configuración

### 2. Obtener Credenciales

1. Ve a Settings → API
2. Copia la **URL** y **anon key**
3. Úsalas en tu archivo `.env`

### 3. Crear Tablas (Opcional)

Las tablas se pueden crear usando los modelos incluidos o manualmente en el dashboard de Supabase.

## 🔍 Verificar Configuración

### Endpoint de Salud

```bash
curl http://localhost:3000/health
```

Respuesta esperada:

```json
{
  "status": "OK",
  "services": {
    "supabase": true,
    "twilio": true,
    "calendly": false,
    "openai": true
  }
}
```

## 📱 Configuraciones Opcionales

### Twilio (WhatsApp/SMS)

1. Crear cuenta en [Twilio](https://www.twilio.com/)
2. Obtener Account SID y Auth Token
3. Configurar número de WhatsApp Business

### Calendly (Integración de Calendario)

1. Crear cuenta en [Calendly](https://calendly.com/)
2. Generar Personal Access Token
3. Configurar webhooks (opcional)

### OpenAI (Asistente IA)

1. Crear cuenta en [OpenAI](https://openai.com/)
2. Generar API Key
3. Configurar límites de uso

## 🚨 Solución de Problemas

### Error: Variables de entorno faltantes

```
Variables de entorno requeridas faltantes: SUPABASE_URL, SUPABASE_ANON_KEY
```

**Solución**: Ejecuta `npm run setup` o configura manualmente el archivo `.env`

### Error: Puerto en uso

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solución**: Cambia el puerto en `.env` o mata el proceso:

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Error: No se puede conectar a Supabase

**Solución**: Verifica que la URL y clave sean correctas y que el proyecto esté activo.

## 📊 Comandos Útiles

```bash
# Ver logs en tiempo real
npm run logs

# Ver solo errores
npm run logs:error

# Limpiar logs
npm run clean:logs

# Verificar salud del sistema
npm run health

# Configuración inicial
npm run setup
```

## 🔄 Actualización

Para actualizar a una nueva versión:

1. Respalda tu archivo `.env`
2. Descarga la nueva versión
3. Ejecuta `npm install`
4. Restaura tu archivo `.env`
5. Revisa el `CHANGELOG.md` para cambios importantes

## 📞 Soporte

Si tienes problemas:

1. Revisa los logs: `npm run logs:error`
2. Verifica la configuración: `npm run health`
3. Consulta la documentación en `docs/`
4. Revisa el `CHANGELOG.md` para cambios recientes

---

**¡Listo para usar Asistente RB!** 🎉
