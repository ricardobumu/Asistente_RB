@echo off
cls
echo.
echo ========================================
echo   🔧 ASISTENTE RB - CONFIGURACION
echo ========================================
echo.

REM Verificar Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js no está instalado
    echo 💡 Instalar desde: https://nodejs.org/
    pause
    exit /b 1
)

echo 📦 Instalando/actualizando dependencias...
npm install
if errorlevel 1 (
    echo ❌ Error instalando dependencias
    pause
    exit /b 1
)

echo.
echo 🔐 Verificando credenciales...
node scripts/verify_credentials.js
if errorlevel 1 (
    echo.
    echo ⚠️ CREDENCIALES REQUIEREN ATENCION
    echo.
    echo 📝 PASOS PARA CONFIGURAR:
    echo.
    echo 1. OpenAI API Key:
    echo    → Ir a: https://platform.openai.com/api-keys
    echo    → Crear nueva API key
    echo    → Actualizar OPENAI_API_KEY en .env.local
    echo.
    echo 2. Twilio Credentials:
    echo    → Ir a: https://console.twilio.com/
    echo    → Verificar Account SID y Auth Token
    echo    → Actualizar en .env.local
    echo.
    echo 3. Después ejecutar: start.bat
    echo.
    pause
    exit /b 1
)

echo.
echo 🏗️ Configurando integración completa...
node setup_integration.js
if errorlevel 1 (
    echo ❌ Error en configuración
    pause
    exit /b 1
)

echo.
echo ========================================
echo   ✅ CONFIGURACION COMPLETADA
echo ========================================
echo.
echo 🎯 PROXIMOS PASOS:
echo   1. Ejecutar: start.bat
echo   2. Configurar webhooks en Twilio/Calendly
echo   3. Probar sistema completo
echo.
echo 💡 Para iniciar rápido: start.bat
echo.
pause
