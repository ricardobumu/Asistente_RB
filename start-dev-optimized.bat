@echo off
title ASISTENTE RB - DESARROLLO OPTIMIZADO

echo 🚀 ASISTENTE RB - DESARROLLO OPTIMIZADO
echo ⚡ Iniciando servidor y tunel en paralelo...
echo.

REM Verificar configuración
node -e "const {ConfigCache} = require('./src/config/config-cache'); const config = ConfigCache.load(); if (!config.valid) { console.error('❌ Configuración inválida. Ejecuta: npm run config:init'); process.exit(1); } console.log('✅ Configuración válida');"

if %errorlevel% neq 0 (
    echo.
    echo ❌ Error en configuración. Ejecuta: npm run config:init
    pause
    exit /b 1
)

echo.
echo 🌐 Iniciando túnel ngrok en ventana separada...
start "🌐 NGROK TUNNEL" cmd /k "echo 🌐 INICIANDO TUNEL NGROK... && echo 📱 URL: https://ricardoburitica.ngrok.app && echo ⏳ Esperando conexión... && ngrok http 3000 --domain=ricardoburitica.ngrok.app"

echo ⏳ Esperando 3 segundos para que ngrok se establezca...
timeout /t 3 /nobreak >nul

echo.
echo 🚀 Iniciando servidor de desarrollo rápido...
echo.
echo ============================================================
echo 🎉 ASISTENTE RB - DESARROLLO INICIADO
echo ============================================================
echo 🌐 Local: http://localhost:3000
echo 🌍 Público: https://ricardoburitica.ngrok.app
echo 📱 WhatsApp: Configurado
echo 📅 Calendly: Integrado
echo 🤖 IA: OpenAI GPT-4
echo.
echo 🔗 ENDPOINTS PRINCIPALES:
echo    📊 Health: /health
echo    📱 WhatsApp: /webhook/whatsapp
echo    📅 Calendly: /api/calendly/webhook
echo    🔧 Admin: /admin
echo.
echo 💡 Presiona Ctrl+C para detener
echo ============================================================
echo.

REM Iniciar servidor con quick-start
node src/quick-start.js

echo.
echo 🛑 Cerrando servicios...
taskkill /f /im ngrok.exe 2>nul
echo ✅ Desarrollo cerrado correctamente
pause
