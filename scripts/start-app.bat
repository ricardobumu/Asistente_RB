@echo off
cd /d "c:\Users\ricar\Asistente_RB"

echo ========================================
echo    INICIANDO ASISTENTE RB
echo ========================================

echo.
echo Verificando y liberando puertos...

REM Liberar puerto 3000 si está ocupado
netstat -ano | findstr :3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo Puerto 3000 ocupado, liberando...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
        taskkill /PID %%a /F >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
) else (
    echo Puerto 3000 disponible
)

echo.
echo Iniciando aplicación...
echo URL: http://localhost:3000
echo Presiona Ctrl+C para detener
echo.

node src/index.js

echo.
echo ========================================
echo La aplicación se ha detenido.
echo Código de salida: %errorlevel%
echo ========================================
pause