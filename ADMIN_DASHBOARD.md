# 🎛️ CENTRO DE MANDO INTERNO - DASHBOARD ADMINISTRATIVO

## 📋 RESUMEN DEL SISTEMA

El **Centro de Mando Interno** es un dashboard administrativo completo que te permite monitorear y gestionar todo el sistema del asistente virtual autónomo desde una interfaz web intuitiva.

### ✅ **MÓDULOS IMPLEMENTADOS**

| Módulo                      | Función                                                               | Endpoint          |
| --------------------------- | --------------------------------------------------------------------- | ----------------- |
| 🔍 **Logs del Sistema**     | Ver registros de errores, peticiones, respuestas, tiempo de ejecución | `/admin/logs`     |
| 📞 **Mensajes del Bot**     | Ver historial de mensajes (entrada/salida), estados y errores         | `/admin/messages` |
| 📅 **Reservas (Calendly)**  | Visualizar citas agendadas, canceladas, no show, etc.                 | `/admin/bookings` |
| 🧠 **Estado OpenAI**        | Logs de respuestas, tokens, latencia                                  | `/admin/openai`   |
| 📦 **Twilio WhatsApp**      | Mensajes enviados/recibidos, errores de envío, número usado           | `/admin/twilio`   |
| 👤 **Usuarios y Actividad** | Último acceso, citas previas, servicios realizados                    | `/admin/users`    |
| 🔐 **Seguridad**            | Revisar sesiones, tokens y accesos                                    | `/admin/security` |
| 🌐 **Salud del Sistema**    | Estado funciones, uso de CPU, uptime, errores por día                 | `/admin/health`   |

## 🚀 **ACCESO AL DASHBOARD**

### 1. **URL de Acceso**

```
https://api.ricardoburitica.eu/admin
```

### 2. **Credenciales por Defecto**

```
Usuario: admin
Contraseña: admin123
```

> ⚠️ **IMPORTANTE**: Cambiar estas credenciales en producción usando variables de entorno

### 3. **Variables de Entorno para Autenticación**

```bash
# Configurar en Railway
ADMIN_USERNAME=tu_usuario_admin
ADMIN_PASSWORD=tu_password_seguro
```

## 🎯 **CARACTERÍSTICAS PRINCIPALES**

### **Dashboard Principal**

- ✅ **Métricas en Tiempo Real**: Estado del sistema, mensajes hoy, reservas hoy, uso de memoria
- ✅ **Estado de Integraciones**: OpenAI, Twilio, Calendly, Supabase
- ✅ **Actividad Reciente**: Últimos mensajes y reservas
- ✅ **Auto-refresh**: Actualización automática cada 30 segundos

### **Sistema de Logs Avanzado**

```javascript
// Tipos de logs disponibles
-app.log - // Logs generales de la aplicación
  error.log - // Errores del sistema
  security.log - // Eventos de seguridad
  whatsapp.log - // Logs específicos de WhatsApp
  performance.log; // Métricas de rendimiento
```

### **Filtros y Búsquedas**

- 🔍 **Logs**: Por tipo, nivel, búsqueda de texto, rango de fechas
- 📞 **Mensajes**: Por teléfono, estado, rango de fechas
- 📅 **Reservas**: Por estado, rango de fechas
- 👤 **Usuarios**: Por teléfono, nombre

### **Exportación de Datos**

- 📄 **Logs**: Exportar en JSON o CSV
- 📊 **Reportes**: Generar reportes de actividad
- 📈 **Métricas**: Exportar estadísticas

## 🔧 **FUNCIONALIDADES TÉCNICAS**

### **Monitoreo en Tiempo Real**

```javascript
// Métricas del sistema
{
  "systemHealth": {
    "status": "healthy",
    "uptime": "2d 14h 32m",
    "memory": {
      "used": 128,
      "total": 512,
      "percentage": 25
    }
  },
  "todayStats": {
    "messages": 45,
    "bookings": 8
  },
  "integrationStatus": {
    "openai": { "status": "healthy" },
    "twilio": { "status": "healthy" },
    "calendly": { "status": "healthy" },
    "supabase": { "status": "healthy" }
  }
}
```

### **Tests de Conectividad**

- ✅ **OpenAI**: Test de API con GPT-4 Turbo
- ✅ **Twilio**: Verificación de cuenta y estado
- ✅ **Calendly**: Test de acceso a eventos
- ✅ **Supabase**: Test de conexión a base de datos

### **Seguridad del Dashboard**

- 🔐 **Autenticación JWT**: Tokens con expiración de 8 horas
- 🛡️ **Rate Limiting**: 50 requests por 15 minutos para admin
- 📊 **Auditoría**: Todos los accesos son loggeados
- 🔒 **Sanitización**: Datos sensibles censurados automáticamente

## 📊 **ESTRUCTURA DE DATOS**

### **Mensajes de WhatsApp**

```javascript
{
  "id": "msg_123",
  "phone_number": "***6789",
  "direction": "inbound|outbound",
  "content": "Mensaje del usuario",
  "ai_response": "Respuesta del asistente",
  "status": "sent|delivered|read|failed",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### **Reservas**

```javascript
{
  "id": "booking_456",
  "client_email": "jua***@email.com",
  "client_phone": "***6789",
  "service_name": "Consultoría",
  "scheduled_at": "2024-01-16T14:00:00Z",
  "duration": 45,
  "status": "confirmed|pending|cancelled",
  "notes": "Notas adicionales"
}
```

### **Logs del Sistema**

```javascript
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO|WARN|ERROR",
  "message": "Descripción del evento",
  "metadata": {
    "ip": "192.168.1.1",
    "userAgent": "WhatsApp/2.23.24.76",
    "responseTime": "150ms"
  },
  "logId": "a1b2c3d4"
}
```

## 🎛️ **GUÍA DE USO**

### **1. Acceso Inicial**

1. Navegar a `https://api.ricardoburitica.eu/admin`
2. Ingresar credenciales de administrador
3. El dashboard se carga automáticamente

### **2. Monitoreo Diario**

```bash
# Rutina diaria recomendada
1. Revisar métricas del dashboard principal
2. Verificar estado de integraciones
3. Revisar logs de errores del día
4. Monitorear actividad de usuarios
5. Verificar reservas pendientes
```

### **3. Resolución de Problemas**

```bash
# Si hay errores en OpenAI
1. Ir a pestaña "OpenAI"
2. Hacer clic en "Test Conectividad"
3. Revisar logs recientes
4. Verificar uso de tokens

# Si hay problemas con WhatsApp
1. Ir a pestaña "Twilio"
2. Verificar conectividad
3. Revisar mensajes fallidos
4. Comprobar webhook de Twilio
```

### **4. Exportación de Datos**

```bash
# Para exportar logs
1. Ir a pestaña "Logs del Sistema"
2. Seleccionar tipo de log
3. Aplicar filtros si es necesario
4. Hacer clic en "Exportar"
5. Descargar archivo JSON/CSV
```

## 🔧 **CONFIGURACIÓN AVANZADA**

### **Variables de Entorno**

```bash
# Autenticación
ADMIN_USERNAME=admin
ADMIN_PASSWORD=password_seguro

# JWT para dashboard
JWT_SECRET=secret_de_64_caracteres_minimo

# Configuración de logs
LOG_LEVEL=info

# Rate limiting para admin
ADMIN_RATE_LIMIT=50
```

### **Personalización**

```javascript
// Modificar intervalos de refresh
const REFRESH_INTERVAL = 30000; // 30 segundos

// Cambiar límites de logs
const DEFAULT_LOG_LIMIT = 100;

// Configurar colores del dashboard
const THEME_COLORS = {
  primary: "#3b82f6",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
};
```

## 📈 **MÉTRICAS Y KPIs**

### **Métricas del Sistema**

- **Uptime**: Tiempo de funcionamiento continuo
- **Memory Usage**: Uso de memoria RAM
- **Response Time**: Tiempo de respuesta promedio
- **Error Rate**: Porcentaje de errores

### **Métricas de Negocio**

- **Mensajes por Día**: Actividad de WhatsApp
- **Reservas por Día**: Conversiones del asistente
- **Tasa de Respuesta**: Velocidad del bot
- **Satisfacción**: Feedback de usuarios

### **Métricas de Seguridad**

- **Intentos de Login**: Accesos al dashboard
- **Amenazas Bloqueadas**: Rate limiting activado
- **Errores de Autenticación**: Fallos de login
- **Actividad Sospechosa**: Patrones anómalos

## 🚨 **ALERTAS Y NOTIFICACIONES**

### **Alertas Automáticas**

- 🔴 **Críticas**: Sistema caído, integración fallida
- 🟡 **Advertencias**: Memoria alta, respuesta lenta
- 🔵 **Informativas**: Nuevas reservas, actividad alta

### **Configuración de Alertas**

```javascript
// Umbrales de alerta
const ALERT_THRESHOLDS = {
  memory: 80, // % de memoria
  responseTime: 1000, // ms
  errorRate: 5, // % de errores
  diskSpace: 90, // % de disco
};
```

## 🔄 **MANTENIMIENTO**

### **Tareas Automáticas**

- ✅ **Rotación de Logs**: Cada 24 horas
- ✅ **Limpieza de Logs**: Logs > 30 días
- ✅ **Backup de Datos**: Diario
- ✅ **Health Checks**: Cada 5 minutos

### **Tareas Manuales**

```bash
# Rotar logs manualmente
POST /admin/logs/rotate

# Limpiar logs antiguos
POST /admin/logs/clean
Body: { "days": 30 }

# Reiniciar sistema (solo desarrollo)
POST /admin/system/restart
```

## 🎯 **PRÓXIMAS MEJORAS**

### **Funcionalidades Planificadas**

- 📊 **Gráficos Avanzados**: Charts.js para métricas
- 🔔 **Notificaciones Push**: Alertas en tiempo real
- 📱 **Versión Mobile**: Dashboard responsive
- 🤖 **IA Predictiva**: Análisis de patrones
- 📧 **Reportes por Email**: Resúmenes automáticos

### **Integraciones Futuras**

- 📈 **Google Analytics**: Métricas web
- 💬 **Slack**: Notificaciones de equipo
- 📊 **Grafana**: Dashboards avanzados
- 🔍 **Elasticsearch**: Búsqueda de logs

---

## 🎉 **CONCLUSIÓN**

El **Centro de Mando Interno** te proporciona:

✅ **Visibilidad Completa** del sistema
✅ **Control Total** sobre el asistente
✅ **Monitoreo en Tiempo Real** 24/7
✅ **Herramientas de Debugging** avanzadas
✅ **Seguridad de Nivel Empresarial**
✅ **Interfaz Intuitiva** y moderna

**¡Tu asistente virtual autónomo ahora tiene un centro de control profesional!** 🚀
