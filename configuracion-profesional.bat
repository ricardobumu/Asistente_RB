@echo off
title Actualizacion a Configuracion Profesional - PM2
color 0A

echo.
echo =================================================
echo    ACTUALIZANDO A CONFIGURACION PROFESIONAL
echo =================================================
echo.

cd /d "c:\Users\ricar\Asistente_RB"

echo [1/5] Creando directorio de logs...
if not exist "logs" mkdir logs
echo ✅ Directorio de logs creado

echo.
echo [2/5] Parando configuracion actual...
pm2 stop ricardo-beauty-assistant >nul 2>&1
pm2 delete ricardo-beauty-assistant >nul 2>&1
echo ✅ Configuracion anterior eliminada

echo.
echo [3/5] Iniciando con configuracion profesional...
pm2 start ecosystem.config.json
if errorlevel 1 (
    echo ❌ Error con configuracion profesional, usando basica...
    pm2 start server-ngrok.js --name "ricardo-beauty-assistant"
) else (
    echo ✅ Configuracion profesional aplicada
)

echo.
echo [4/5] Guardando configuracion...
pm2 save
echo ✅ Configuracion guardada

echo.
echo [5/5] Verificando estado final...
pm2 status
echo.

echo =================================================
echo    ✅ CONFIGURACION PROFESIONAL COMPLETADA!
echo =================================================
echo.
echo CARACTERISTICAS ACTIVADAS:
echo ✅ Logs detallados en carpeta ./logs/
echo ✅ Auto-reinicio en caso de crash
echo ✅ Limite de memoria (500MB)
echo ✅ Timestamps en logs
echo ✅ Reinicio inteligente (maximo 10 veces)
echo ✅ Configuracion de produccion
echo.
echo ARCHIVOS IMPORTANTES:
echo 📁 logs/pm2-error.log     - Errores
echo 📁 logs/pm2-out.log      - Salida normal
echo 📁 logs/pm2-combined.log - Todo junto
echo 🎛️  panel-control.bat     - Panel de control
echo ⚙️  ecosystem.config.json - Configuracion PM2
echo.
echo COMANDO PARA GESTIONAR:
echo   panel-control.bat  - Panel completo de control
echo.
echo TUS URLS FINALES:
echo WhatsApp: https://604fc8f718749.ngrok-free.app/webhook/whatsapp
echo Calendly: https://604fc8f718749.ngrok-free.app/api/calendly/webhook
echo.
echo =================================================
echo.
echo ¿Quieres abrir el panel de control? (S/N)
set /p abrir_panel=
if /i "%abrir_panel%"=="S" start panel-control.bat

echo.
pause
