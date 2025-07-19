@echo off
cls
echo.
echo ========================================
echo   🛑 DETENIENDO ASISTENTE RB
echo ========================================
echo.

echo 🔍 Buscando procesos activos...

REM Detener ngrok
echo 🌐 Deteniendo túnel ngrok...
taskkill /f /im ngrok.exe >nul 2>&1
if errorlevel 1 (
    echo   ℹ️ ngrok no estaba ejecutándose
) else (
    echo   ✅ ngrok detenido
)

REM Detener Node.js (servidor)
echo 🚀 Deteniendo servidor Node.js...
taskkill /f /im node.exe >nul 2>&1
if errorlevel 1 (
    echo   ℹ️ Servidor Node.js no estaba ejecutándose
) else (
    echo   ✅ Servidor Node.js detenido
)

REM Detener nodemon si está ejecutándose
echo 🔄 Deteniendo nodemon...
taskkill /f /im nodemon.exe >nul 2>&1
if errorlevel 1 (
    echo   ℹ️ nodemon no estaba ejecutándose
) else (
    echo   ✅ nodemon detenido
)

REM Cerrar ventanas de comando relacionadas
echo 🖥️ Cerrando ventanas relacionadas...
for /f "tokens=2" %%i in ('tasklist /fi "windowtitle eq 🚀 ASISTENTE RB SERVER" /fo csv ^| find /v "INFO"') do taskkill /pid %%i /f >nul 2>&1
for /f "tokens=2" %%i in ('tasklist /fi "windowtitle eq 🌐 NGROK TUNNEL" /fo csv ^| find /v "INFO"') do taskkill /pid %%i /f >nul 2>&1

echo.
echo ========================================
echo   ✅ SISTEMA DETENIDO COMPLETAMENTE
echo ========================================
echo.
echo 🔍 Estado final:
echo   • Túnel ngrok: ❌ Detenido
echo   • Servidor Node.js: ❌ Detenido
echo   • Ventanas auxiliares: ❌ Cerradas
echo.
echo 💡 Para reiniciar: start.bat
echo.
pause
