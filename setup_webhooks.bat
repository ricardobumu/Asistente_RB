@echo off
echo =====================================
echo  CONFIGURACION WEBHOOKS NGROK
echo =====================================

if "%1"=="" (
    echo.
    echo USAGE: setup_webhooks.bat [NGROK_URL]
    echo.
    echo Ejemplo: setup_webhooks.bat https://abc123.ngrok.io
    echo.
    pause
    exit /b 1
)

set NGROK_URL=%1

echo.
echo Configurando webhooks con URL: %NGROK_URL%
echo.

echo [1/4] Webhook para WhatsApp (Twilio):
echo URL: %NGROK_URL%/webhook/whatsapp
echo.

echo [2/4] Webhook para Calendly:
echo URL: %NGROK_URL%/webhook/calendly
echo.

echo [3/4] Endpoint de salud:
echo URL: %NGROK_URL%/health
echo.

echo [4/4] Panel admin:
echo URL: %NGROK_URL%/admin
echo.

echo =====================================
echo  COMANDOS CURL PARA TESTING
echo =====================================
echo.

echo # Test endpoint salud:
echo curl %NGROK_URL%/health
echo.

echo # Test webhook WhatsApp:
echo curl -X POST %NGROK_URL%/webhook/whatsapp -H "Content-Type: application/x-www-form-urlencoded" -d "From=whatsapp:%%2B1234567890&Body=Hola&MessageSid=test123"
echo.

echo # Test webhook Calendly:
echo curl -X POST %NGROK_URL%/webhook/calendly -H "Content-Type: application/json" -d "{\"event\":\"test\"}"
echo.

echo URLS copiadas al portapapeles (si tienes clip.exe)
echo %NGROK_URL%/webhook/whatsapp | clip 2>nul

pause
