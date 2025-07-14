@echo off
title Configuracion Automatica - Ricardo Beauty Assistant
color 0A

echo.
echo =================================================
echo    CONFIGURACION AUTOMATICA COMPLETA
echo    Te guio paso a paso - SIN COMPLICACIONES
echo =================================================
echo.

REM Cambiar al directorio del proyecto
cd /d "c:\Users\ricar\Asistente_RB"

echo [PASO 1] Tu servidor ya funciona ✅
echo          Verificando...
curl http://localhost:3000 2>nul
if errorlevel 1 (
    echo ❌ Servidor no responde. Iniciandolo...
    start "Servidor Local" cmd /k "cd /d c:\Users\ricar\Asistente_RB && node server-ngrok.js"
    timeout /t 3
) else (
    echo ✅ Servidor funcionando correctamente
)

echo.
echo [PASO 2] Verificando ngrok...
echo          Buscando proceso de ngrok...

tasklist | findstr ngrok.exe >nul
if errorlevel 1 (
    echo ❌ Ngrok no esta corriendo
    echo.
    echo INSTRUCCIONES SIMPLES:
    echo 1. Abre una nueva ventana de CMD
    echo 2. Escribe: ngrok http 3000
    echo 3. Presiona Enter
    echo 4. Vuelve aqui y presiona cualquier tecla
    echo.
    pause
) else (
    echo ✅ Ngrok esta corriendo
)

echo.
echo [PASO 3] URLs que necesitas para webhooks:
echo.
echo Para WHATSAPP (Twilio):
echo    https://TU-URL-NGROK.ngrok-free.app/webhook/whatsapp
echo.
echo Para CALENDLY:
echo    https://TU-URL-NGROK.ngrok-free.app/api/calendly/webhook
echo.
echo REEMPLAZA "TU-URL-NGROK" con tu URL real de ngrok
echo.

echo [PASO 4] Probando conexion...
echo          ¿Cual es tu URL de ngrok?
echo          (Ejemplo: abc123.ngrok-free.app)
echo.
set /p ngrok_url="Escribe SOLO la parte del dominio: "

if "%ngrok_url%"=="" (
    echo No escribiste ninguna URL
    goto end
)

echo.
echo Probando: https://%ngrok_url%
curl https://%ngrok_url% 2>nul
if errorlevel 1 (
    echo ❌ No funciona. Verifica que:
    echo    1. Ngrok este corriendo
    echo    2. La URL sea correcta
    echo    3. No haya espacios en la URL
) else (
    echo ✅ PERFECTO! Tu configuracion funciona
    echo.
    echo =================================================
    echo    TUS URLS FINALES PARA WEBHOOKS:
    echo =================================================
    echo.
    echo WHATSAPP: https://%ngrok_url%/webhook/whatsapp
    echo CALENDLY: https://%ngrok_url%/api/calendly/webhook
    echo.
    echo Copia estas URLs y usalas en tus configuraciones
)

:end
echo.
echo =================================================
echo Presiona cualquier tecla para salir...
pause >nul
