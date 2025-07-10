# 🚀 CONFIGURACIÓN COMPLETA DE WEBHOOKS Y SISTEMA DE RESERVAS

## 📋 RESUMEN DEL SISTEMA

Has implementado un **sistema integral de reservas** que combina:

- ✅ **Bot de WhatsApp autónomo** con IA (OpenAI)
- ✅ **Sistema nativo de reservas** con base de datos propia
- ✅ **Integración con Google Calendar** para gestión personal
- ✅ **Integración con Calendly** para reservas externas
- ✅ **Panel administrativo completo** para gestión local
- ✅ **Webhooks seguros** para sincronización automática

---

## 🔗 URLS DE WEBHOOKS PARA CONFIGURAR

### 1. **WEBHOOK DE TWILIO (WhatsApp)**

**URL Principal:**

```
https://bot.ricardoburitica.eu/autonomous/whatsapp/webhook
```

**URL de Estado:**

```
https://bot.ricardoburitica.eu/autonomous/whatsapp/status
```

#### Configuración en Twilio Console:

1. Ve a **Console > Develop > Messaging > Settings > WhatsApp sandbox settings**
2. Configura:
   - **Webhook URL**: `https://bot.ricardoburitica.eu/autonomous/whatsapp/webhook`
   - **HTTP Method**: `POST`
   - **Status Callback URL**: `https://bot.ricardoburitica.eu/autonomous/whatsapp/status`

### 2. **WEBHOOK DE CALENDLY**

**URL Principal:**

```
https://bot.ricardoburitica.eu/api/calendly/webhook
```

#### Configuración en Calendly:

1. Ve a **Account Settings > Webhooks**
2. Crea nuevo webhook:
   - **Webhook URL**: `https://bot.ricardoburitica.eu/api/calendly/webhook`
   - **Events**: Selecciona:
     - `invitee.created` (nueva reserva)
     - `invitee.canceled` (cancelación)
     - `invitee_no_show.created` (no se presentó)

### 3. **VERIFICACIÓN DE WEBHOOKS**

```bash
# Verificar webhook de WhatsApp
curl https://bot.ricardoburitica.eu/autonomous/whatsapp/webhook

# Verificar webhook de Calendly
curl https://bot.ricardoburitica.eu/api/calendly/webhook
```

---

## 📅 CONFIGURACIÓN DE GOOGLE CALENDAR

### 1. **Crear Service Account**

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la **Google Calendar API**
4. Ve a **IAM & Admin > Service Accounts**
5. Crea una nueva Service Account:
   - Nombre: `asistente-rb-calendar`
   - Descripción: `Service account para gestión de calendario`
6. Descarga el archivo JSON de credenciales

### 2. **Configurar Variables de Entorno**

Agrega a tu `.env`:

```env
# Google Calendar Configuration
GOOGLE_CALENDAR_CREDENTIALS={"type":"service_account","project_id":"tu-proyecto",...}
GOOGLE_CALENDAR_ID=tu_calendar_id@group.calendar.google.com
```

### 3. **Compartir Calendario**

1. En Google Calendar, ve a **Configuración**
2. Selecciona el calendario que quieres usar
3. En **Compartir con personas específicas**, agrega:
   - Email de la Service Account
   - Permisos: **Realizar cambios en eventos**

---

## 🎯 FUNCIONALIDADES DEL SISTEMA DE RESERVAS

### **1. RESERVAS AUTOMÁTICAS POR WHATSAPP**

- ✅ Cliente envía mensaje al bot
- ✅ IA procesa la solicitud y muestra servicios disponibles
- ✅ Cliente selecciona servicio y horario
- ✅ Sistema verifica disponibilidad en Google Calendar
- ✅ Crea reserva en base de datos + Google Calendar
- ✅ Envía confirmación con enlace de Meet
- ✅ Programa recordatorios automáticos

### **2. RESERVAS DESDE CALENDLY**

- ✅ Cliente agenda desde tu página de Calendly
- ✅ Webhook recibe notificación automáticamente
- ✅ Sistema crea cliente y reserva en base de datos
- ✅ Sincroniza con Google Calendar
- ✅ Envía confirmación por WhatsApp (si tiene teléfono)

### **3. GESTIÓN ADMINISTRATIVA LOCAL**

#### **Dashboard Principal** (`/admin/bookings/dashboard`)

```json
{
  "today": {
    "bookings": [...],
    "count": 5
  },
  "upcoming": {
    "bookings": [...],
    "count": 12
  },
  "calendar": {
    "events": [...],
    "synchronized": true
  },
  "stats": {
    "thisMonth": { "total": 45, "revenue": 2250 },
    "byStatus": { "confirmada": 30, "completada": 10, "cancelada": 5 }
  }
}
```

#### **Búsqueda Avanzada** (`/admin/bookings/search`)

- Filtrar por fecha, estado, cliente, servicio
- Paginación automática
- Exportar a CSV

#### **Gestión de Reservas**

- ✅ **Crear reserva manual**: `/admin/bookings/create`
- ✅ **Reprogramar**: `/admin/bookings/:id/reschedule`
- ✅ **Cancelar**: `/admin/bookings/:id` (DELETE)
- ✅ **Cambiar estado**: `/admin/bookings/:id/status`

### **4. SINCRONIZACIÓN CON GOOGLE CALENDAR**

#### **Automática:**

- Cada nueva reserva crea evento en Google Calendar
- Cancelaciones se sincronizan automáticamente
- Reprogramaciones actualizan el evento

#### **Manual:**

```bash
POST /admin/bookings/sync-calendar
```

---

## 🛠️ GESTIÓN LOCAL DE RESERVAS

### **1. ACCESO AL PANEL ADMINISTRATIVO**

```
URL: https://bot.ricardoburitica.eu/admin
```

**Credenciales por defecto:**

- Usuario: `admin`
- Contraseña: `admin123`

⚠️ **IMPORTANTE**: Cambia estas credenciales en producción

### **2. COMANDOS ÚTILES PARA GESTIÓN LOCAL**

#### **Ver reservas de hoy:**

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://bot.ricardoburitica.eu/admin/bookings/today
```

#### **Buscar reservas:**

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://bot.ricardoburitica.eu/admin/bookings/search?startDate=2024-01-01&status=confirmada"
```

#### **Crear reserva manual:**

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Juan Pérez",
    "client_phone": "+34123456789",
    "client_email": "juan@email.com",
    "service_id": 1,
    "scheduled_at": "2024-01-15T10:00:00Z",
    "notes": "Primera consulta"
  }' \
  https://bot.ricardoburitica.eu/admin/bookings/create
```

#### **Exportar reservas:**

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://bot.ricardoburitica.eu/admin/bookings/export?startDate=2024-01-01&endDate=2024-01-31" \
  -o reservas_enero.csv
```

### **3. INTEGRACIÓN CON TU FLUJO DE TRABAJO**

#### **Google Calendar como Centro de Control:**

1. **Visualización**: Todas las reservas aparecen en tu Google Calendar
2. **Notificaciones**: Recibes alertas 24h y 30min antes
3. **Enlaces Meet**: Cada reserva incluye enlace de videollamada automático
4. **Sincronización bidireccional**: Cambios en Calendar se reflejan en el sistema

#### **WhatsApp como Canal de Comunicación:**

1. **Confirmaciones automáticas** al cliente
2. **Recordatorios** 24h y 1h antes de la cita
3. **Gestión de cancelaciones** y reprogramaciones
4. **Soporte 24/7** con IA

---

## 📊 ESTADÍSTICAS Y REPORTES

### **Dashboard en Tiempo Real:**

- Reservas del día actual
- Próximas reservas (7 días)
- Ingresos del mes
- Estadísticas por estado
- Crecimiento mensual

### **Exportación de Datos:**

- CSV con todas las reservas
- Filtros por fecha, cliente, servicio
- Datos completos para análisis

---

## 🔧 INSTALACIÓN Y CONFIGURACIÓN

### **1. Instalar Dependencias:**

```bash
npm install
```

### **2. Configurar Variables de Entorno:**

```bash
cp .env.example .env
# Editar .env con tus credenciales
```

### **3. Configurar Google Calendar:**

1. Crear Service Account en Google Cloud
2. Descargar credenciales JSON
3. Agregar a `GOOGLE_CALENDAR_CREDENTIALS`
4. Compartir calendario con la Service Account

### **4. Configurar Webhooks:**

1. **Twilio**: Configurar URLs en Console
2. **Calendly**: Crear webhook en Account Settings

### **5. Ejecutar Sistema:**

```bash
# Desarrollo
npm run dev

# Producción
npm start
```

---

## 🚨 SEGURIDAD Y MEJORES PRÁCTICAS

### **Webhooks Seguros:**

- ✅ Validación de firma de Twilio
- ✅ Rate limiting por endpoint
- ✅ Logs de seguridad completos
- ✅ Sanitización de entrada

### **Datos Protegidos:**

- ✅ Encriptación de datos sensibles
- ✅ Tokens JWT seguros
- ✅ Cumplimiento RGPD
- ✅ Auditoría completa

### **Monitoreo:**

- ✅ Logs estructurados
- ✅ Health checks automáticos
- ✅ Alertas de errores
- ✅ Métricas de rendimiento

---

## 📞 FLUJO COMPLETO DE RESERVA

### **Escenario 1: Cliente por WhatsApp**

1. Cliente: "Hola, quiero agendar una cita"
2. Bot: Muestra servicios disponibles
3. Cliente: Selecciona servicio y horario
4. Sistema: Verifica disponibilidad en Google Calendar
5. Sistema: Crea reserva + evento en Calendar + enlace Meet
6. Bot: Envía confirmación con todos los detalles
7. Sistema: Programa recordatorios automáticos

### **Escenario 2: Cliente por Calendly**

1. Cliente agenda en tu página de Calendly
2. Calendly envía webhook al sistema
3. Sistema crea cliente y reserva automáticamente
4. Sistema sincroniza con Google Calendar
5. Sistema envía confirmación por WhatsApp (si tiene teléfono)

### **Escenario 3: Tú creas reserva manual**

1. Accedes al panel admin
2. Creas reserva con datos del cliente
3. Sistema verifica disponibilidad
4. Sistema crea evento en Google Calendar
5. Sistema envía confirmación al cliente
6. Todo queda sincronizado automáticamente

---

## 🎉 RESULTADO FINAL

Tienes un **sistema completamente autónomo** que:

- ✅ **Gestiona reservas 24/7** sin tu intervención
- ✅ **Sincroniza todo con tu Google Calendar** personal
- ✅ **Te permite gestión completa** desde el panel admin
- ✅ **Mantiene a los clientes informados** automáticamente
- ✅ **Escala sin límites** y es completamente seguro

**¡Tu asistente virtual está listo para trabajar mientras tú te enfocas en lo importante!** 🚀
