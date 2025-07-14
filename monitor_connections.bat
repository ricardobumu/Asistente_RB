@echo off
echo =====================================
echo  MONITOR DE CONEXIONES NGROK
echo =====================================

echo.
echo Verificando conexiones activas...
echo.

echo [APLICACION LOCAL]
netstat -ano | findstr :3000 | findstr LISTENING
if %errorlevel%==0 (
    echo ✅ Aplicacion corriendo en puerto 3000
) else (
    echo ❌ Aplicacion NO está corriendo en puerto 3000
    echo.
    echo Para iniciar: npm start
)

echo.
echo [NGROK]
curl -s http://localhost:4040/api/tunnels 2>nul | findstr "public_url" >nul
if %errorlevel%==0 (
    echo ✅ ngrok está activo
    echo.
    echo URLs disponibles:
    curl -s http://localhost:4040/api/tunnels | findstr "public_url"
) else (
    echo ❌ ngrok NO está activo
    echo.
    echo Para iniciar: ngrok http 3000
)

echo.
echo [ENDPOINTS DISPONIBLES]
echo.
if exist logs\app.log (
    echo Ultimas entradas del log:
    powershell "Get-Content logs\app.log -Tail 3"
) else (
    echo No hay logs disponibles
)

echo.
echo Para abrir el dashboard de ngrok: http://localhost:4040
echo.

pause
