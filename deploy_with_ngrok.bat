@echo off
setlocal enabledelayedexpansion
title Ricardo Beauty Assistant - Production Setup
color 0F

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║               RICARDO BEAUTY ASSISTANT                         ║
echo ║              Configuración Producción + ngrok                  ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

echo [PASO 1/6] Verificaciones iniciales...
echo ┌────────────────────────────────────────────────────────────────┐

rem Verificar Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Node.js no está instalado
    echo    Instala Node.js desde https://nodejs.org
    pause
    exit /b 1
)
echo ✅ Node.js: OK

rem Verificar ngrok
ngrok version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: ngrok no está instalado
    echo    Instala ngrok desde https://ngrok.com/download
    pause
    exit /b 1
)
echo ✅ ngrok: OK

rem Verificar archivos críticos
if not exist src\index-simple.js (
    echo ❌ ERROR: src\index-simple.js no encontrado
    pause
    exit /b 1
)
echo ✅ Archivo principal: OK

if not exist .env (
    echo ❌ ERROR: .env no encontrado
    echo    Copia .env.example a .env y configúralo
    pause
    exit /b 1
)
echo ✅ Configuración: OK

echo └────────────────────────────────────────────────────────────────┘

echo.
echo [PASO 2/6] Instalando dependencias...
if not exist node_modules (
    echo Ejecutando npm install...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ ERROR: Falló npm install
        pause
        exit /b 1
    )
)
echo ✅ Dependencias: OK

echo.
echo [PASO 3/6] Iniciando aplicación...
echo ┌────────────────────────────────────────────────────────────────┐
echo │ Iniciando Ricardo Beauty Assistant...                          │
echo │ Si ves errores de inicialización, revisa tu configuración .env │
echo └────────────────────────────────────────────────────────────────┘

start "Ricardo Beauty App" cmd /c "title Ricardo Beauty App && echo Iniciando aplicación... && node src/index-simple.js"

echo.
echo Esperando que la aplicación inicie (10 segundos)...
echo (Puedes ver el progreso en la otra ventana)

timeout /t 10 /nobreak >nul

echo.
echo [PASO 4/6] Verificando aplicación...
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %errorlevel% neq 0 (
    echo ⚠️  ADVERTENCIA: No se detecta la aplicación en puerto 3000
    echo.
    echo ¿La aplicación está corriendo? Revisa la otra ventana.
    echo ¿Quieres continuar con ngrok de todas formas? (s/n):
    set /p continue=
    if /i not "!continue!"=="s" (
        echo Cancelando...
        pause
        exit /b 1
    )
) else (
    echo ✅ Aplicación corriendo en puerto 3000
)

echo.
echo [PASO 5/6] Iniciando ngrok...
echo ┌────────────────────────────────────────────────────────────────┐
echo │                        IMPORTANTE                              │
echo │                                                                │
echo │  1. ngrok se abrirá en una nueva ventana                       │
echo │  2. Busca la línea con "https://xxxxx.ngrok.io"                │
echo │  3. COPIA esa URL - la necesitarás para webhooks               │
echo │  4. Para cerrar: Ctrl+C en la ventana de ngrok                 │
echo │                                                                │
echo │  WEBHOOKS QUE CONFIGURAR:                                      │
echo │  • Twilio WhatsApp: https://xxxxx.ngrok.io/webhook/whatsapp    │
echo │  • Calendly: https://xxxxx.ngrok.io/webhook/calendly           │
echo └────────────────────────────────────────────────────────────────┘
echo.

echo Presiona ENTER para iniciar ngrok...
pause >nul

start "ngrok Tunnel" cmd /c "title ngrok Tunnel && echo Iniciando ngrok... && echo. && echo COPIA LA URL HTTPS QUE APARECE ABAJO: && echo. && ngrok http 3000"

echo.
echo [PASO 6/6] Configuración completa
echo ┌────────────────────────────────────────────────────────────────┐
echo │                     ¡CONFIGURACIÓN LISTA!                     │
echo │                                                                │
echo │  ✅ Aplicación corriendo                                       │
echo │  ✅ ngrok expuesto públicamente                                │
echo │                                                                │
echo │  PRÓXIMOS PASOS:                                               │
echo │                                                                │
echo │  1. Copia la URL de ngrok (https://xxxxx.ngrok.io)             │
echo │                                                                │
echo │  2. Configura webhooks:                                        │
echo │     • Twilio: /webhook/whatsapp                                │
echo │     • Calendly: /webhook/calendly                              │
echo │                                                                │
echo │  3. Prueba los endpoints:                                      │
echo │     • Health: /health                                          │
echo │     • Admin: /admin                                            │
echo │                                                                │
echo │  4. Dashboard ngrok: http://localhost:4040                     │
echo │                                                                │
echo │  MANTÉN AMBAS VENTANAS ABIERTAS MIENTRAS USAS LA APP          │
echo └────────────────────────────────────────────────────────────────┘

echo.
echo ¿Quieres ver el estado de las conexiones? (s/n):
set /p showStatus=
if /i "!showStatus!"=="s" (
    echo.
    echo ═══════════════════════════════════════════════════════════════════
    echo                           ESTADO ACTUAL
    echo ═══════════════════════════════════════════════════════════════════
    
    echo.
    echo [APLICACIÓN LOCAL]
    netstat -ano | findstr :3000 | findstr LISTENING
    if %errorlevel%==0 (
        echo ✅ Puerto 3000: Activo
    ) else (
        echo ❌ Puerto 3000: Inactivo
    )
    
    echo.
    echo [NGROK]
    timeout /t 3 /nobreak >nul
    powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://localhost:4040/api/tunnels' -TimeoutSec 5; if ($response.tunnels) { Write-Host '✅ ngrok: Activo'; $response.tunnels | ForEach-Object { Write-Host ('   URL: ' + $_.public_url) } } else { Write-Host '⚠️  ngrok: Iniciando...' } } catch { Write-Host '⚠️  ngrok: Iniciando o no disponible aún' }"
    
    echo.
    echo [DASHBOARD]
    echo   ngrok Dashboard: http://localhost:4040
    echo   Aplicación local: http://localhost:3000
)

echo.
echo ═══════════════════════════════════════════════════════════════════
echo.
echo Presiona cualquier tecla para salir de este script...
echo (La aplicación y ngrok seguirán ejecutándose)
pause >nul

echo.
echo Script finalizado. ¡Aplicación lista para recibir webhooks!
exit /b 0
