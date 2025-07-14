@echo off
title Iniciando Servidor + Ngrok - Ricardo Beauty Assistant
color 0A

echo.
echo =================================================
echo    INICIANDO SERVIDOR + NGROK
echo    Ricardo Beauty Assistant
echo =================================================
echo.

REM Cambiar al directorio del proyecto
cd /d "c:\Users\ricar\Asistente_RB"

echo [1/3] Verificando que Node.js esta instalado...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: Node.js no esta instalado
    echo Descarga Node.js desde: https://nodejs.org
    pause
    exit /b 1
)
echo ✅ Node.js esta instalado

echo.
echo [2/3] Iniciando servidor en puerto 3000...
echo ⚡ Servidor funcionando en: http://localhost:3000
echo.

REM Iniciar el servidor
start "Servidor Local" cmd /k "node server-ngrok.js"

echo [3/3] Esperando 3 segundos antes de probar conexion...
timeout /t 3 /nobreak >nul

echo.
echo =================================================
echo    INSTRUCCIONES PARA NGROK:
echo =================================================
echo.
echo 1. Abre una nueva terminal (CMD)
echo 2. Ejecuta: ngrok http 3000
echo 3. Copia la URL que aparece (ej: https://abc123.ngrok-free.app)
echo 4. Usa esa URL para configurar tus webhooks:
echo    - WhatsApp: https://tu-url.ngrok-free.app/webhook/whatsapp
echo    - Calendly: https://tu-url.ngrok-free.app/api/calendly/webhook
echo.
echo NOTA: Si ya tienes ngrok corriendo, simplemente cambia
echo       el puerto a 3000 o reinicia ngrok con: ngrok http 3000
echo.
echo =================================================

echo.
echo Presiona cualquier tecla para probar la conexion local...
pause >nul

echo.
echo Probando servidor local...
curl http://localhost:3000 2>nul
if errorlevel 1 (
    echo ❌ El servidor no responde. Revisa la ventana del servidor.
) else (
    echo ✅ Servidor funcionando correctamente
)

echo.
echo Presiona cualquier tecla para salir...
pause >nul
