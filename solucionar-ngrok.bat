@echo off
title Solucion Ngrok - Paso a Paso
color 0E

echo.
echo =================================================
echo    SOLUCION PARA ERROR NGROK ERR_NGROK_3200
echo =================================================
echo.

REM Cambiar al directorio del proyecto
cd /d "c:\Users\ricar\Asistente_RB"

echo PASO 1: Verificando procesos en puerto 3000...
netstat -ano | findstr :3000
echo.

echo PASO 2: Matando procesos si existen...
FOR /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    echo Matando proceso %%a
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo PASO 3: Iniciando servidor limpio...
echo.

start "Servidor Ricardo Beauty" cmd /k "echo Iniciando servidor... && cd /d c:\Users\ricar\Asistente_RB && node server-ngrok.js"

timeout /t 5

echo.
echo PASO 4: Probando servidor...
curl http://localhost:3000

echo.
echo =================================================
echo    AHORA CONFIGURA NGROK:
echo =================================================
echo.
echo 1. Abre una nueva terminal
echo 2. Ejecuta: ngrok http 3000
echo 3. Copia la nueva URL de ngrok
echo 4. Prueba tu URL en el navegador
echo.
echo Si tu URL anterior era:
echo https://604fc8f718749.ngrok-free.app
echo.
echo La nueva sera algo como:
echo https://NUEVA-URL.ngrok-free.app
echo.
echo =================================================

pause
