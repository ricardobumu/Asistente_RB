@echo off
title Ricardo Beauty Assistant - Startup Manager
color 0A

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                 RICARDO BEAUTY ASSISTANT                     ║
echo ║                   Startup Manager v1.0                      ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:MENU
echo ┌────────────────────────────────────────────────────────────┐
echo │                      OPCIONES                              │
echo ├────────────────────────────────────────────────────────────┤
echo │  1. Iniciar aplicación + ngrok (RECOMENDADO)               │
echo │  2. Solo iniciar aplicación                                │
echo │  3. Solo iniciar ngrok                                     │
echo │  4. Verificar estado de conexiones                         │
echo │  5. Configurar webhooks con URL de ngrok                   │
echo │  6. Ver logs de la aplicación                              │
echo │  7. Salir                                                  │
echo └────────────────────────────────────────────────────────────┘
echo.

set /p choice="Selecciona una opción (1-7): "

if "%choice%"=="1" goto START_ALL
if "%choice%"=="2" goto START_APP
if "%choice%"=="3" goto START_NGROK
if "%choice%"=="4" goto CHECK_STATUS
if "%choice%"=="5" goto SETUP_WEBHOOKS
if "%choice%"=="6" goto VIEW_LOGS
if "%choice%"=="7" goto EXIT

echo Opción inválida. Intenta de nuevo.
pause
cls
goto MENU

:START_ALL
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║              INICIANDO APLICACIÓN + NGROK                    ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

echo [1/4] Verificando dependencias...
if not exist node_modules (
    echo Instalando dependencias con npm...
    call npm install
    if %errorlevel% neq 0 (
        echo ERROR: Falló la instalación de dependencias
        pause
        goto MENU
    )
)

echo.
echo [2/4] Iniciando aplicación en segundo plano...
start "Ricardo Beauty App" cmd /k "cd /d "%~dp0" && npm start"

echo Esperando 8 segundos para que la aplicación inicie...
timeout /t 8 /nobreak >nul

echo.
echo [3/4] Verificando que la aplicación esté corriendo...
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %errorlevel% neq 0 (
    echo ⚠️  ADVERTENCIA: La aplicación podría no estar corriendo en puerto 3000
    echo Continuando con ngrok de todas formas...
)

echo.
echo [4/4] Iniciando ngrok...
echo.
echo ┌────────────────────────────────────────────────────────────┐
echo │  IMPORTANTE: Tu URL pública aparecerá abajo                │
echo │  Copia la URL https://xxxxx.ngrok.io                       │
echo │  Úsala para configurar webhooks en Twilio y Calendly       │
echo └────────────────────────────────────────────────────────────┘
echo.

ngrok http 3000

goto MENU

:START_APP
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                 INICIANDO SOLO APLICACIÓN                   ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

if not exist node_modules (
    echo Instalando dependencias...
    call npm install
)

npm start
goto MENU

:START_NGROK
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                   INICIANDO SOLO NGROK                      ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

echo Verificando que la aplicación esté corriendo en puerto 3000...
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %errorlevel% neq 0 (
    echo.
    echo ❌ ERROR: No se detectó aplicación en puerto 3000
    echo.
    echo ¿Quieres continuar de todas formas? (s/n):
    set /p continue=
    if /i not "%continue%"=="s" goto MENU
)

echo.
echo Iniciando ngrok para puerto 3000...
ngrok http 3000
goto MENU

:CHECK_STATUS
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                ESTADO DE LAS CONEXIONES                     ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

echo [APLICACIÓN LOCAL - Puerto 3000]
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %errorlevel%==0 (
    echo ✅ Aplicación corriendo en puerto 3000
    netstat -ano | findstr :3000 | findstr LISTENING
) else (
    echo ❌ Aplicación NO está corriendo en puerto 3000
)

echo.
echo [NGROK - Dashboard local]
curl -s http://localhost:4040/api/tunnels 2>nul >nul
if %errorlevel%==0 (
    echo ✅ ngrok está activo
    echo.
    echo URLs públicas disponibles:
    powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://localhost:4040/api/tunnels'; $response.tunnels | ForEach-Object { Write-Host ('  ' + $_.public_url + ' -> ' + $_.config.addr) } } catch { Write-Host '  Error obteniendo URLs de ngrok' }"
) else (
    echo ❌ ngrok NO está activo o no responde en puerto 4040
)

echo.
echo [DASHBOARD NGROK]
echo Para ver el dashboard: http://localhost:4040
echo.

pause
goto MENU

:SETUP_WEBHOOKS
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║              CONFIGURACIÓN DE WEBHOOKS                      ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

echo Obteniendo URL de ngrok...
powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://localhost:4040/api/tunnels'; $httpsUrl = ($response.tunnels | Where-Object { $_.proto -eq 'https' }).public_url; if ($httpsUrl) { Write-Host 'URL encontrada:' $httpsUrl; echo ''; echo 'WEBHOOKS PARA CONFIGURAR:'; echo ''; echo '🔹 Twilio WhatsApp:'; echo ('   ' + $httpsUrl + '/webhook/whatsapp'); echo ''; echo '🔹 Calendly:'; echo ('   ' + $httpsUrl + '/webhook/calendly'); echo ''; echo '🔹 Health Check:'; echo ('   ' + $httpsUrl + '/health'); echo ''; echo '🔹 Panel Admin:'; echo ('   ' + $httpsUrl + '/admin'); echo ''; echo 'COMANDOS DE PRUEBA:'; echo ''; echo ('curl ' + $httpsUrl + '/health'); echo ('curl -X POST ' + $httpsUrl + '/webhook/whatsapp -H \"Content-Type: application/x-www-form-urlencoded\" -d \"From=whatsapp:+1234567890&Body=test&MessageSid=test123\"'); echo ''; ($httpsUrl + '/webhook/whatsapp') | clip; echo 'URL de WhatsApp copiada al portapapeles!' } else { Write-Host 'No se encontró URL HTTPS de ngrok' } } catch { Write-Host 'Error: ngrok no está corriendo o no responde' }"

echo.
pause
goto MENU

:VIEW_LOGS
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                   LOGS DE APLICACIÓN                        ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

if exist logs\app.log (
    echo Últimas 20 líneas del log:
    echo ┌────────────────────────────────────────────────────────────┐
    powershell "Get-Content logs\app.log -Tail 20"
    echo └────────────────────────────────────────────────────────────┘
) else (
    echo No se encontró archivo de logs en logs\app.log
)

echo.
if exist logs\error.log (
    echo Errores recientes:
    echo ┌────────────────────────────────────────────────────────────┐
    powershell "Get-Content logs\error.log -Tail 10"
    echo └────────────────────────────────────────────────────────────┘
)

echo.
pause
goto MENU

:EXIT
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                        SALIENDO                             ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo ¡Gracias por usar Ricardo Beauty Assistant!
echo.
echo Recuerda:
echo - Si la aplicación sigue corriendo, ciérrala manualmente
echo - ngrok se cerrará automáticamente
echo.
pause
exit /b 0
