@echo off
title Servicio Permanente - Ricardo Beauty Assistant
color 0A

echo.
echo =================================================
echo    CONFIGURANDO SERVICIO PERMANENTE
echo    (Para que corra siempre automaticamente)
echo =================================================
echo.

cd /d "c:\Users\ricar\Asistente_RB"

echo [OPCION 1] Crear servicio de Windows con PM2
echo [OPCION 2] Crear tarea programada de Windows
echo [OPCION 3] Crear servicio con NSSM
echo [OPCION 4] Auto-inicio simple
echo.

set /p opcion="Elige una opcion (1-4): "

if "%opcion%"=="1" goto pm2_setup
if "%opcion%"=="2" goto task_setup
if "%opcion%"=="3" goto nssm_setup
if "%opcion%"=="4" goto simple_setup
goto end

:pm2_setup
echo.
echo =================================================
echo    CONFIGURANDO PM2 (RECOMENDADO)
echo =================================================
echo.

echo [1/5] Instalando PM2 globalmente...
npm install -g pm2
if errorlevel 1 (
    echo ❌ Error instalando PM2
    goto end
)

echo.
echo [2/5] Creando configuracion PM2...
echo module.exports = { > ecosystem.config.js
echo   apps: [{ >> ecosystem.config.js
echo     name: 'ricardo-beauty-assistant', >> ecosystem.config.js
echo     script: 'server-ngrok.js', >> ecosystem.config.js
echo     instances: 1, >> ecosystem.config.js
echo     autorestart: true, >> ecosystem.config.js
echo     watch: false, >> ecosystem.config.js
echo     max_memory_restart: '1G', >> ecosystem.config.js
echo     env: { >> ecosystem.config.js
echo       NODE_ENV: 'production', >> ecosystem.config.js
echo       PORT: 3000 >> ecosystem.config.js
echo     } >> ecosystem.config.js
echo   }] >> ecosystem.config.js
echo }; >> ecosystem.config.js

echo.
echo [3/5] Iniciando aplicacion con PM2...
pm2 start ecosystem.config.js
if errorlevel 1 (
    echo ❌ Error iniciando con PM2
    goto end
)

echo.
echo [4/5] Guardando configuracion PM2...
pm2 save

echo.
echo [5/5] Configurando PM2 para auto-inicio...
pm2 startup
echo.
echo ✅ LISTO! Tu aplicacion correra automaticamente
echo.
echo COMANDOS UTILES:
echo   pm2 status           - Ver estado
echo   pm2 logs             - Ver logs
echo   pm2 restart all      - Reiniciar
echo   pm2 stop all         - Parar
echo   pm2 delete all       - Eliminar
goto end

:simple_setup
echo.
echo =================================================
echo    AUTO-INICIO SIMPLE
echo =================================================
echo.

echo [1/3] Creando script de auto-inicio...
echo @echo off > auto-start-app.bat
echo title Servidor Ricardo Beauty - PERMANENTE >> auto-start-app.bat
echo cd /d "c:\Users\ricar\Asistente_RB" >> auto-start-app.bat
echo :loop >> auto-start-app.bat
echo echo Iniciando servidor... >> auto-start-app.bat
echo node server-ngrok.js >> auto-start-app.bat
echo echo Servidor se cerro, reiniciando en 5 segundos... >> auto-start-app.bat
echo timeout /t 5 /nobreak ^>nul >> auto-start-app.bat
echo goto loop >> auto-start-app.bat

echo.
echo [2/3] Creando acceso directo para auto-inicio...
echo Set oWS = WScript.CreateObject("WScript.Shell") > create_shortcut.vbs
echo sLinkFile = "%USERPROFILE%\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\Ricardo Beauty Auto.lnk" >> create_shortcut.vbs
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> create_shortcut.vbs
echo oLink.TargetPath = "%CD%\auto-start-app.bat" >> create_shortcut.vbs
echo oLink.WorkingDirectory = "%CD%" >> create_shortcut.vbs
echo oLink.WindowStyle = 2 >> create_shortcut.vbs
echo oLink.Save >> create_shortcut.vbs
cscript create_shortcut.vbs >nul
del create_shortcut.vbs

echo.
echo [3/3] Iniciando servicio permanente...
start "Ricardo Beauty - PERMANENTE" /MIN auto-start-app.bat

echo.
echo ✅ LISTO! Tu aplicacion:
echo   - Se inicia automaticamente al encender Windows
echo   - Se reinicia si se cierra
echo   - Corre en segundo plano
echo.
echo Para parar: busca "Ricardo Beauty" en el administrador de tareas
goto end

:task_setup
echo.
echo =================================================
echo    TAREA PROGRAMADA DE WINDOWS
echo =================================================
echo.

echo Creando tarea programada...
schtasks /create /tn "Ricardo Beauty Assistant" /tr "%CD%\server-ngrok.js" /sc onstart /ru "%USERNAME%" /f
if errorlevel 1 (
    echo ❌ Error creando tarea programada
    goto end
)

echo.
echo ✅ Tarea programada creada!
echo   - Se ejecuta al iniciar Windows
echo   - Corre con tu usuario
echo.
echo Para gestionar: Panel de Control ^> Herramientas administrativas ^> Programador de tareas
goto end

:end
echo.
echo =================================================
echo    CONFIGURACION DE NGROK PERMANENTE
echo =================================================
echo.
echo IMPORTANTE: Ngrok tambien debe correr siempre.
echo.
echo OPCION A - Ngrok como servicio:
echo   1. Abre CMD como administrador
echo   2. Ejecuta: ngrok service install --config=%USERPROFILE%\.ngrok2\ngrok.yml
echo   3. Ejecuta: ngrok service start
echo.
echo OPCION B - Ngrok al inicio:
echo   1. Crea: ngrok-auto.bat con contenido:
echo      ngrok http 3000
echo   2. Pon el .bat en la carpeta de Inicio
echo.
echo =================================================
echo.
pause
