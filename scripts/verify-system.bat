@echo off
echo ========================================
echo   VERIFICACIÓN DE INTEGRIDAD - ASISTENTE RB
echo ========================================

cd /d "c:\Users\ricar\Asistente_RB"

echo.
echo [1/8] Verificando estructura de directorios...
set "missing_dirs="
if not exist "src" set "missing_dirs=!missing_dirs! src"
if not exist "src\api" set "missing_dirs=!missing_dirs! src\api"
if not exist "src\controllers" set "missing_dirs=!missing_dirs! src\controllers"
if not exist "src\models" set "missing_dirs=!missing_dirs! src\models"
if not exist "src\services" set "missing_dirs=!missing_dirs! src\services"
if not exist "src\middleware" set "missing_dirs=!missing_dirs! src\middleware"
if not exist "src\routes" set "missing_dirs=!missing_dirs! src\routes"
if not exist "src\utils" set "missing_dirs=!missing_dirs! src\utils"
if not exist "scripts" set "missing_dirs=!missing_dirs! scripts"
if not exist "public" set "missing_dirs=!missing_dirs! public"

if "%missing_dirs%"=="" (
    echo ✅ Estructura de directorios completa
) else (
    echo ❌ Directorios faltantes:%missing_dirs%
)

echo.
echo [2/8] Verificando archivos críticos...
set "missing_files="
if not exist "src\index.js" set "missing_files=!missing_files! src\index.js"
if not exist "package.json" set "missing_files=!missing_files! package.json"
if not exist ".env" set "missing_files=!missing_files! .env"

if "%missing_files%"=="" (
    echo ✅ Archivos críticos presentes
) else (
    echo ❌ Archivos críticos faltantes:%missing_files%
)

echo.
echo [3/8] Verificando dependencias...
if exist "node_modules" (
    echo ✅ node_modules existe
) else (
    echo ⚠️  node_modules no encontrado - ejecutar: npm install
)

echo.
echo [4/8] Verificando configuración...
if exist ".env" (
    echo ✅ Archivo .env presente
) else (
    echo ❌ Archivo .env faltante
)

if exist ".env.local" (
    echo ✅ Archivo .env.local presente
) else (
    echo ⚠️  Archivo .env.local no encontrado
)

echo.
echo [5/8] Verificando sintaxis de archivos principales...
node -c src\index.js 2>nul
if %errorlevel% equ 0 (
    echo ✅ src\index.js - Sintaxis correcta
) else (
    echo ❌ src\index.js - Error de sintaxis
)

echo.
echo [6/8] Verificando puertos...
netstat -ano | findstr :3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  Puerto 3000 en uso
) else (
    echo ✅ Puerto 3000 disponible
)

echo.
echo [7/8] Verificando logs...
if exist "logs" (
    echo ✅ Directorio de logs presente
    dir logs\*.log /B 2>nul | find /c /v "" > temp_count.txt
    set /p log_count=<temp_count.txt
    del temp_count.txt
    echo   Archivos de log: !log_count!
) else (
    echo ⚠️  Directorio de logs no encontrado
)

echo.
echo [8/8] Verificando respaldos...
if exist "c:\Users\ricar\Asistente_RB_Backups" (
    echo ✅ Sistema de respaldos configurado
    dir "c:\Users\ricar\Asistente_RB_Backups\backup_*" /AD /B 2>nul | find /c /v "" > temp_count.txt
    set /p backup_count=<temp_count.txt
    del temp_count.txt
    echo   Respaldos disponibles: !backup_count!
) else (
    echo ⚠️  Sistema de respaldos no configurado
)

echo.
echo ========================================
echo   RESUMEN DE VERIFICACIÓN
echo ========================================
echo.
echo Estado del sistema: 
if "%missing_dirs%%missing_files%"=="" (
    echo ✅ SISTEMA ÍNTEGRO Y FUNCIONAL
) else (
    echo ⚠️  REQUIERE ATENCIÓN
)
echo.
echo Para crear respaldo: scripts\backup-system.bat
echo Para restaurar: scripts\restore-system.bat
echo Para iniciar app: scripts\start-app.bat
echo.
pause