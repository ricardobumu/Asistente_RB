@echo off
title Instalacion Automatica PM2 - Ricardo Beauty Assistant
color 0A

echo.
echo =================================================
echo    INSTALACION AUTOMATICA PM2 (RECOMENDADA)
echo    Configurando servicio permanente...
echo =================================================
echo.

cd /d "c:\Users\ricar\Asistente_RB"

echo [1/6] Instalando PM2 globalmente...
echo        (Esto puede tomar unos minutos)
npm install -g pm2
if errorlevel 1 (
    echo ❌ Error instalando PM2. Verifica que Node.js este instalado.
    pause
    exit /b 1
)
echo ✅ PM2 instalado correctamente

echo.
echo [2/6] Parando servidor actual si existe...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 >nul
echo ✅ Servidor anterior detenido

echo.
echo [3/6] Iniciando aplicacion con PM2...
pm2 start server-ngrok.js --name "ricardo-beauty-assistant"
if errorlevel 1 (
    echo ❌ Error iniciando con PM2
    pause
    exit /b 1
)
echo ✅ Aplicacion iniciada con PM2

echo.
echo [4/6] Guardando configuracion...
pm2 save
echo ✅ Configuracion guardada

echo.
echo [5/6] Configurando auto-inicio con Windows...
pm2 startup
echo.
echo ⚠️  IMPORTANTE: Ejecuta el comando que aparecio arriba
echo    (Copialo y pegalo en una CMD como administrador)
echo.
pause

echo.
echo [6/6] Verificando estado...
pm2 status
echo.

echo =================================================
echo    ✅ CONFIGURACION COMPLETA!
echo =================================================
echo.
echo Tu aplicacion ahora:
echo ✅ Corre automaticamente en segundo plano
echo ✅ Se reinicia si hay errores
echo ✅ Se inicia con Windows (despues del comando startup)
echo ✅ Funciona 24/7 sin supervision
echo.
echo COMANDOS UTILES:
echo   pm2 status              - Ver estado
echo   pm2 logs ricardo-beauty-assistant - Ver logs
echo   pm2 restart ricardo-beauty-assistant - Reiniciar
echo   pm2 stop ricardo-beauty-assistant - Parar
echo.
echo TUS URLs DE WEBHOOK:
echo WhatsApp: https://604fc8f718749.ngrok-free.app/webhook/whatsapp
echo Calendly: https://604fc8f718749.ngrok-free.app/api/calendly/webhook
echo.
echo =================================================

pause
