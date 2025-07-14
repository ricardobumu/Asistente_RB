@echo off
setlocal enabledelayedexpansion

echo ========================================
echo   SISTEMA DE RESTAURACIÓN - ASISTENTE RB
echo ========================================

set "backup_dir=c:\Users\ricar\Asistente_RB_Backups"

if not exist "%backup_dir%" (
    echo ❌ No se encontró directorio de respaldos: %backup_dir%
    echo.
    echo Ejecuta primero: scripts\backup-system.bat
    pause
    exit /b 1
)

echo.
echo Respaldos disponibles:
echo.
dir "%backup_dir%\backup_*" /AD /B /O-D 2>nul
echo.

set /p "backup_choice=Ingresa el nombre del respaldo a restaurar (ej: backup_2024-01-15_14-30-25): "

if not exist "%backup_dir%\%backup_choice%" (
    echo ❌ Respaldo no encontrado: %backup_choice%
    pause
    exit /b 1
)

echo.
echo ⚠️  ADVERTENCIA: Esta operación sobrescribirá los archivos actuales.
echo.
set /p "confirm=¿Estás seguro de continuar? (s/n): "
if /i not "%confirm%"=="s" (
    echo Operación cancelada.
    pause
    exit /b 0
)

echo.
echo Restaurando desde: %backup_choice%
echo.

REM Crear respaldo de seguridad antes de restaurar
echo [0/5] Creando respaldo de seguridad actual...
call "%~dp0backup-system.bat" >nul

echo [1/5] Restaurando código fuente...
if exist "%backup_dir%\%backup_choice%\src" (
    rmdir /S /Q "c:\Users\ricar\Asistente_RB\src" 2>nul
    xcopy "%backup_dir%\%backup_choice%\src" "c:\Users\ricar\Asistente_RB\src\" /E /I /Q
)

echo [2/5] Restaurando scripts...
if exist "%backup_dir%\%backup_choice%\scripts" (
    xcopy "%backup_dir%\%backup_choice%\scripts" "c:\Users\ricar\Asistente_RB\scripts\" /E /I /Q /Y
)

echo [3/5] Restaurando archivos públicos...
if exist "%backup_dir%\%backup_choice%\public" (
    rmdir /S /Q "c:\Users\ricar\Asistente_RB\public" 2>nul
    xcopy "%backup_dir%\%backup_choice%\public" "c:\Users\ricar\Asistente_RB\public\" /E /I /Q
)

echo [4/5] Restaurando configuración...
if exist "%backup_dir%\%backup_choice%\package.json" copy "%backup_dir%\%backup_choice%\package.json" "c:\Users\ricar\Asistente_RB\" /Y >nul
if exist "%backup_dir%\%backup_choice%\package-lock.json" copy "%backup_dir%\%backup_choice%\package-lock.json" "c:\Users\ricar\Asistente_RB\" /Y >nul

echo [5/5] Restaurando documentación...
if exist "%backup_dir%\%backup_choice%\docs" (
    rmdir /S /Q "c:\Users\ricar\Asistente_RB\docs" 2>nul
    xcopy "%backup_dir%\%backup_choice%\docs" "c:\Users\ricar\Asistente_RB\docs\" /E /I /Q
)

echo.
echo ========================================
echo ✅ RESTAURACIÓN COMPLETADA
echo ========================================
echo.
echo Respaldo restaurado: %backup_choice%
echo.
echo Próximos pasos:
echo 1. Verificar archivos .env (no se sobrescriben por seguridad)
echo 2. Reinstalar dependencias: npm install
echo 3. Probar la aplicación: npm start
echo.
pause