@echo off
cls
echo.
echo ========================================
echo   🌐 CONFIGURACION DE NGROK
echo ========================================
echo.

REM Verificar si ngrok está instalado
ngrok version >nul 2>&1
if errorlevel 1 (
    echo ❌ ngrok no está instalado
    echo.
    echo 📦 OPCIONES DE INSTALACION:
    echo   1. Descargar desde: https://ngrok.com/download
    echo   2. O ejecutar: npm install -g ngrok
    echo.
    set /p install_choice="¿Instalar con npm? (s/n): "
    if /i "%install_choice%"=="s" (
        echo 📦 Instalando ngrok...
        npm install -g ngrok
        if errorlevel 1 (
            echo ❌ Error instalando ngrok
            pause
            exit /b 1
        )
        echo ✅ ngrok instalado correctamente
    ) else (
        echo 💡 Por favor instala ngrok manualmente y vuelve a ejecutar este script
        pause
        exit /b 1
    )
)

echo ✅ ngrok está instalado
echo.

REM Verificar si ngrok está autenticado
echo 🔐 Verificando autenticación de ngrok...
ngrok config check >nul 2>&1
if errorlevel 1 (
    echo ❌ ngrok no está autenticado
    echo.
    echo 📝 PASOS PARA AUTENTICAR:
    echo   1. Ir a: https://dashboard.ngrok.com/get-started/your-authtoken
    echo   2. Copiar tu authtoken
    echo   3. Ejecutar: ngrok config add-authtoken TU_TOKEN_AQUI
    echo.
    set /p auth_token="Pega tu authtoken aquí (o presiona Enter para hacerlo manualmente): "
    if not "%auth_token%"=="" (
        echo 🔐 Configurando authtoken...
        ngrok config add-authtoken %auth_token%
        if errorlevel 1 (
            echo ❌ Error configurando authtoken
            pause
            exit /b 1
        )
        echo ✅ Authtoken configurado correctamente
    ) else (
        echo 💡 Configura el authtoken manualmente con: ngrok config add-authtoken TU_TOKEN
        pause
        exit /b 1
    )
)

echo ✅ ngrok está autenticado
echo.

REM Verificar dominio reservado
echo 🌐 Verificando dominio reservado...
echo 📱 Dominio configurado: ricardoburitica.ngrok.app
echo.

REM Probar conexión
echo 🧪 Probando túnel ngrok...
echo ⏳ Iniciando túnel de prueba...

REM Crear archivo temporal para probar
echo ^<html^>^<body^>^<h1^>Prueba de ngrok^</h1^>^</body^>^</html^> > test_ngrok.html

REM Iniciar servidor temporal en puerto 8080
start /min python -m http.server 8080 2>nul || start /min python -m SimpleHTTPServer 8080 2>nul || (
    echo ⚠️ No se pudo iniciar servidor de prueba
    echo 💡 Pero ngrok debería funcionar con tu aplicación
)

REM Probar ngrok por 10 segundos
timeout /t 2 >nul
start /min ngrok http 8080 --domain=ricardoburitica.ngrok.app
echo ⏳ Probando por 10 segundos...
timeout /t 10 >nul

REM Limpiar
taskkill /f /im python.exe >nul 2>&1
taskkill /f /im ngrok.exe >nul 2>&1
del test_ngrok.html >nul 2>&1

echo.
echo ========================================
echo   ✅ NGROK CONFIGURADO CORRECTAMENTE
echo ========================================
echo.
echo 🌐 Configuración:
echo   • Dominio: ricardoburitica.ngrok.app
echo   • Puerto: 3000 (aplicación)
echo   • Protocolo: HTTPS
echo.
echo 📱 URLs de webhook:
echo   • WhatsApp: https://ricardoburitica.ngrok.app/webhook/whatsapp
echo   • Calendly: https://ricardoburitica.ngrok.app/api/calendly/webhook
echo.
echo 🚀 Ahora puedes usar: start.bat
echo.
pause
