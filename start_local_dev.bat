@echo off
title RICARDO AI BOT - DESARROLLO LOCAL

echo.
echo ==============================================
echo = LIMPIANDO PROCESOS ANTERIORES Y PREPARANDO =
echo ==============================================
echo.

REM Matar cualquier proceso de Node.js que use el puerto 3000
REM NOTA: Necesita permisos de administrador para taskkill en algunos casos
for /f "tokens=5" %%i in ('netstat -ano ^| findstr :3000') do (
    taskkill /PID %%i /F 2>nul
)
timeout /t 2 /nobreak >nul
echo.
echo ✅ Puerto 3000 liberado.

REM Verificar que ngrok.exe existe en C:\ngrok\
IF NOT EXIST "C:\ngrok\ngrok.exe" (
    echo.
    echo ERROR: ngrok.exe NO ENCONTRADO en C:\ngrok\.
    echo Por favor, mueve ngrok.exe a C:\ngrok\ y reinicia el script.
    pause
    exit /b 1
)

REM Iniciar la aplicación Node.js en una nueva ventana de CMD
echo.
echo ==============================================
echo = INICIANDO APLICACION NODE.JS (ASISTENTE RB) =
echo ==============================================
echo.
REM El %~dp0 es la ruta del directorio actual del script. Asegura que npm start se ejecuta desde la raiz del proyecto.
start "ASISTENTE RB - NODE.JS" cmd /k "cd /d "%~dp0" && npm start"

REM Dar tiempo a la aplicación para que inicie y ocupe el puerto 3000
timeout /t 5 /nobreak >nul
echo.
echo ✅ Aplicacion Node.js iniciada (ver ventana separada para logs).

REM Iniciar ngrok en una nueva ventana de CMD con URL FIJA
echo.
echo ==============================================
echo = INICIANDO NGROK CON URL FIJA =
echo ==============================================
echo.
REM El comando ngrok debe ejecutarse desde la carpeta C:\ngrok
REM ** CAMBIO CLAVE AQUI: USAR --url PARA TU DOMINIO FIJO **
start "ASISTENTE RB - NGROK TUNNEL" cmd /k "cd /d C:\ngrok && ngrok http --url ricardoburitica.ngrok.app 3000"

echo.
echo ==============================================
echo = PROCESO DE INICIO AUTOMATIZADO COMPLETADO =
echo ==============================================
echo.
echo ** ATENCION: Tu URL FIJA de NGROK es: https://ricardoburitica.ngrok.app **
echo ** La veras en la VENTANA DE NGROK que se abrio. **
echo.
echo Puedes probar tu API local en: http://localhost:3000/api/servicios
echo.
echo ** Para detener todo: **
echo ** 1. Ve a la ventana de tu aplicacion Node.js y presiona Ctrl+C. **
echo ** 2. Cierra las 3 ventanas de CMD que se abrieron. **
echo.
echo Presiona cualquier tecla para cerrar esta ventana de script.
pause >nul
exit
