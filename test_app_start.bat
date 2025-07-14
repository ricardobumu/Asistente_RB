@echo off
title Test App Start
echo ===============================================
echo  PROBANDO INICIO DE LA APLICACION
echo ===============================================
echo.

echo [1] Verificando Node.js...
node --version
if %errorlevel% neq 0 (
    echo ERROR: Node.js no está instalado o no está en PATH
    pause
    exit /b 1
)

echo.
echo [2] Verificando directorio...
if not exist src\index-simple.js (
    echo ERROR: No se encuentra src\index-simple.js
    pause
    exit /b 1
)

echo.
echo [3] Verificando variables de entorno...
if not exist .env (
    echo ERROR: No se encuentra archivo .env
    pause
    exit /b 1
)

echo.
echo [4] Iniciando aplicacion en modo test (5 segundos)...
echo    Presiona Ctrl+C si ves errores
echo.

timeout /t 3 /nobreak >nul

rem Iniciar la aplicación y capturar salida
node src/index-simple.js &
set APP_PID=%!

echo.
echo [5] Esperando 5 segundos para que la app inicie...
timeout /t 5 /nobreak >nul

echo.
echo [6] Verificando puerto 3000...
netstat -ano | findstr :3000 | findstr LISTENING
if %errorlevel%==0 (
    echo ✅ EXITO: Aplicacion corriendo en puerto 3000
    echo.
    echo Ahora puedes:
    echo 1. Abrir otra terminal
    echo 2. Ejecutar: start_ngrok_only.bat
    echo 3. Copiar la URL de ngrok para webhooks
) else (
    echo ❌ ERROR: Aplicacion no responde en puerto 3000
    echo Revisa los logs para ver errores
)

echo.
echo ===============================================
echo Presiona cualquier tecla para cerrar...
pause >nul

rem Terminar la aplicación
taskkill /f /pid %APP_PID% 2>nul
