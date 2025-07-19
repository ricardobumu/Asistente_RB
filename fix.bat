@echo off
cls
echo.
echo ========================================
echo   🔧 ASISTENTE RB - SOLUCION RAPIDA
echo ========================================
echo.

echo Este script te ayudará a solucionar problemas comunes
echo.

:menu
echo Selecciona una opción:
echo.
echo 1. Verificar y renovar credenciales
echo 2. Reinstalar dependencias
echo 3. Configurar base de datos
echo 4. Configurar webhooks
echo 5. Verificar estado completo
echo 6. Generar configuración de ejemplo
echo 0. Salir
echo.
set /p choice="Ingresa tu opción (0-6): "

if "%choice%"=="1" goto credentials
if "%choice%"=="2" goto dependencies
if "%choice%"=="3" goto database
if "%choice%"=="4" goto webhooks
if "%choice%"=="5" goto health
if "%choice%"=="6" goto example
if "%choice%"=="0" goto exit
goto menu

:credentials
echo.
echo 🔐 Verificando credenciales...
node scripts/verify_credentials.js
echo.
pause
goto menu

:dependencies
echo.
echo 📦 Reinstalando dependencias...
rmdir /s /q node_modules 2>nul
del package-lock.json 2>nul
npm install
echo.
echo ✅ Dependencias reinstaladas
pause
goto menu

:database
echo.
echo 🗄️ Configurando base de datos...
echo.
echo 📝 INSTRUCCIONES:
echo 1. Ir a: https://supabase.com/dashboard
echo 2. Abrir SQL Editor
echo 3. Ejecutar el contenido de: scripts/create_missing_tables.sql
echo.
echo 💡 El archivo SQL está listo para copiar y pegar
echo.
pause
goto menu

:webhooks
echo.
echo 📡 Configurando webhooks...
echo.
echo 📝 INSTRUCCIONES:
echo.
echo 1. TWILIO WHATSAPP:
echo    → Ir a: https://console.twilio.com/
echo    → Messaging → Settings → WhatsApp sandbox
echo    → Webhook URL: https://tu-dominio.com/webhook/whatsapp
echo.
echo 2. CALENDLY:
echo    → Ir a: https://pipedream.com/workflows
echo    → Crear workflow con trigger HTTP
echo    → Configurar en Calendly el webhook de Pipedream
echo    → Reenviar a: https://tu-dominio.com/api/calendly/webhook
echo.
pause
goto menu

:health
echo.
echo 🏥 Verificando estado completo...
node test_integration_complete.js
echo.
pause
goto menu

:example
echo.
echo 📝 Generando configuración de ejemplo...
node scripts/setup_complete_integration.js --example-config
echo.
pause
goto menu

:exit
echo.
echo 👋 ¡Hasta luego!
echo.
exit /b 0
