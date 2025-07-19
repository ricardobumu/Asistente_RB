@echo off
title 📊 ASISTENTE RB - MONITOR
cls

:monitor_loop
cls
echo.
echo ========================================
echo   📊 MONITOR DE ASISTENTE RB
echo ========================================
echo.
echo ⏰ Actualizado: %date% %time%
echo.

REM Verificar ngrok
echo 🌐 TUNEL NGROK:
tasklist /fi "imagename eq ngrok.exe" /fo csv | find /v "INFO" >nul 2>&1
if errorlevel 1 (
    echo   ❌ ngrok no está ejecutándose
    set ngrok_status=❌
) else (
    echo   ✅ ngrok activo - https://ricardoburitica.ngrok.app
    set ngrok_status=✅
)

echo.

REM Verificar servidor Node.js
echo 🚀 SERVIDOR NODE.JS:
tasklist /fi "imagename eq node.exe" /fo csv | find /v "INFO" >nul 2>&1
if errorlevel 1 (
    echo   ❌ Servidor no está ejecutándose
    set server_status=❌
) else (
    echo   ✅ Servidor activo - http://localhost:3000
    set server_status=✅
)

echo.

REM Verificar conectividad local
echo 🔍 CONECTIVIDAD LOCAL:
curl -s http://localhost:3000/health >nul 2>&1
if errorlevel 1 (
    echo   ❌ Servidor local no responde
    set local_status=❌
) else (
    echo   ✅ Servidor local respondiendo
    set local_status=✅
)

echo.

REM Verificar conectividad pública (si ngrok está activo)
if "%ngrok_status%"=="✅" (
    echo 🌍 CONECTIVIDAD PUBLICA:
    curl -s https://ricardoburitica.ngrok.app/health >nul 2>&1
    if errorlevel 1 (
        echo   ❌ URL pública no responde
        set public_status=❌
    ) else (
        echo   ✅ URL pública respondiendo
        set public_status=✅
    )
) else (
    echo 🌍 CONECTIVIDAD PUBLICA:
    echo   ⚠️ ngrok no activo
    set public_status=⚠️
)

echo.

REM Resumen de estado
echo ========================================
echo   📊 RESUMEN DE ESTADO
echo ========================================
echo.
echo   🌐 Túnel ngrok:      %ngrok_status%
echo   🚀 Servidor local:   %server_status%
echo   🔍 Conectividad:     %local_status%
echo   🌍 Acceso público:   %public_status%
echo.

REM Mostrar URLs importantes
if "%server_status%"=="✅" (
    echo 🔗 URLS IMPORTANTES:
    echo   • Local:     http://localhost:3000
    if "%ngrok_status%"=="✅" (
        echo   • Público:   https://ricardoburitica.ngrok.app
        echo   • WhatsApp:  https://ricardoburitica.ngrok.app/webhook/whatsapp
        echo   • Calendly:  https://ricardoburitica.ngrok.app/api/calendly/webhook
    )
    echo.
)

REM Mostrar acciones disponibles
echo 🎮 ACCIONES DISPONIBLES:
echo   [R] Refrescar ahora
echo   [S] Detener sistema
echo   [L] Ver logs
echo   [Q] Salir del monitor
echo.

REM Esperar input del usuario o auto-refresh
choice /c RSLQ /t 10 /d R /m "Selecciona una opción (auto-refresh en 10s)"

if errorlevel 4 goto exit
if errorlevel 3 goto show_logs
if errorlevel 2 goto stop_system
if errorlevel 1 goto monitor_loop

goto monitor_loop

:show_logs
cls
echo.
echo ========================================
echo   📋 LOGS DEL SISTEMA
echo ========================================
echo.
echo 🔍 Últimas líneas del log de aplicación:
echo.
if exist "logs\app.log" (
    powershell "Get-Content 'logs\app.log' -Tail 20"
) else (
    echo   ℹ️ No hay archivo de log disponible
)
echo.
pause
goto monitor_loop

:stop_system
echo.
echo 🛑 Deteniendo sistema...
call stop.bat
goto exit

:exit
echo.
echo 👋 Monitor cerrado
echo.
exit /b 0
