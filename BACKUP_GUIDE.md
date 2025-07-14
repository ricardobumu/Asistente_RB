# 🔒 Guía de Respaldo y Recuperación - Asistente RB

## 📋 Resumen del Sistema de Respaldo

Este sistema protege completamente tu aplicación **Asistente RB** contra pérdida de datos, errores de código y fallos del sistema.

## 🛠️ Scripts Disponibles

### 1. **backup-system.bat** - Crear Respaldo Completo

```bash
scripts\backup-system.bat
```

**Qué hace:**

- ✅ Crea respaldo completo del código fuente
- ✅ Incluye configuración y archivos críticos
- ✅ Genera archivo ZIP comprimido
- ✅ Mantiene historial de 10 respaldos
- ✅ Limpia respaldos antiguos automáticamente

### 2. **restore-system.bat** - Restaurar desde Respaldo

```bash
scripts\restore-system.bat
```

**Qué hace:**

- ✅ Lista respaldos disponibles
- ✅ Crea respaldo de seguridad antes de restaurar
- ✅ Restaura código, configuración y archivos
- ✅ Preserva archivos .env por seguridad

### 3. **verify-system.bat** - Verificar Integridad

```bash
scripts\verify-system.bat
```

**Qué hace:**

- ✅ Verifica estructura de directorios
- ✅ Comprueba archivos críticos
- ✅ Valida sintaxis de código
- ✅ Revisa configuración y dependencias

## 📁 Estructura de Respaldos

```
c:\Users\ricar\Asistente_RB_Backups\
├── backup_2024-01-15_14-30-25\     # Respaldo en carpeta
│   ├── src\                        # Código fuente completo
│   ├── scripts\                    # Scripts de gestión
│   ├── public\                     # Archivos públicos
│   ├── docs\                       # Documentación
│   ├── package.json                # Configuración npm
│   ├── .env                        # Variables de entorno
│   └── backup_info.txt             # Información del respaldo
├── AsistentRB_backup_2024-01-15_14-30-25.zip  # Archivo comprimido
└── ...                             # Más respaldos
```

## 🚨 Procedimientos de Emergencia

### **Escenario 1: Error en el código**

```bash
# 1. Verificar el problema
scripts\verify-system.bat

# 2. Restaurar último respaldo funcional
scripts\restore-system.bat

# 3. Reinstalar dependencias
npm install

# 4. Probar aplicación
scripts\start-app.bat
```

### **Escenario 2: Pérdida completa de archivos**

```bash
# 1. Ir al directorio de respaldos
cd c:\Users\ricar\Asistente_RB_Backups

# 2. Extraer último ZIP a nueva ubicación
# (usar explorador de Windows)

# 3. Restaurar configuración .env
# (copiar desde respaldo seguro)

# 4. Reinstalar dependencias
npm install

# 5. Verificar sistema
scripts\verify-system.bat
```

### **Escenario 3: Corrupción de base de datos**

```bash
# 1. Crear respaldo inmediato
scripts\backup-system.bat

# 2. Verificar logs de error
type logs\error.log

# 3. Contactar soporte de Supabase si es necesario
# 4. Restaurar desde respaldo conocido funcional
```

## ⏰ Programación Automática

### **Respaldo Diario Automático (Recomendado)**

1. Abrir **Programador de Tareas** de Windows
2. Crear tarea básica:
   - **Nombre**: "Respaldo Asistente RB"
   - **Frecuencia**: Diario
   - **Hora**: 02:00 AM
   - **Acción**: Iniciar programa
   - **Programa**: `c:\Users\ricar\Asistente_RB\scripts\backup-system.bat`

### **Verificación Semanal**

1. Crear segunda tarea:
   - **Nombre**: "Verificar Asistente RB"
   - **Frecuencia**: Semanal (Lunes)
   - **Hora**: 08:00 AM
   - **Programa**: `c:\Users\ricar\Asistente_RB\scripts\verify-system.bat`

## 🔐 Seguridad de Respaldos

### **Archivos Protegidos:**

- ✅ **Código fuente completo** (src/)
- ✅ **Scripts de gestión** (scripts/)
- ✅ **Configuración** (package.json, .env)
- ✅ **Archivos públicos** (public/)
- ✅ **Documentación** (docs/)

### **Archivos Excluidos (por seguridad):**

- ❌ **node_modules/** (se reinstala con npm install)
- ❌ **logs/** (archivos temporales)
- ❌ **temp/** (archivos temporales)

### **Ubicaciones de Respaldo Adicionales:**

1. **Local**: `c:\Users\ricar\Asistente_RB_Backups\`
2. **Nube** (recomendado): Subir ZIPs a Google Drive/OneDrive
3. **USB** (opcional): Copiar respaldos a dispositivo externo

## 📞 Contacto de Emergencia

Si necesitas ayuda con la recuperación:

1. **Verificar logs**: `logs\error.log`
2. **Ejecutar verificación**: `scripts\verify-system.bat`
3. **Documentar el problema** con capturas de pantalla
4. **Tener listo el último respaldo funcional**

## ✅ Lista de Verificación Semanal

- [ ] Ejecutar `scripts\backup-system.bat`
- [ ] Ejecutar `scripts\verify-system.bat`
- [ ] Verificar que la aplicación inicia correctamente
- [ ] Comprobar que hay al menos 3 respaldos disponibles
- [ ] Probar webhook de Calendly
- [ ] Verificar logs de errores

---

**🛡️ Tu Asistente RB está ahora completamente protegido contra cualquier pérdida de datos o fallo del sistema.**
