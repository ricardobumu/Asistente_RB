@echo off
title Panel de Control - Ricardo Beauty Assistant
color 0B

:menu
cls
echo.
echo =================================================
echo    PANEL DE CONTROL - RICARDO BEAUTY ASSISTANT
echo =================================================
echo.
echo Estado actual:
pm2 jlist | findstr "ricardo-beauty-assistant" >nul 2>&1
if errorlevel 1 (
    echo ❌ Aplicacion: NO corriendo
) else (
    echo ✅ Aplicacion: CORRIENDO
)

curl http://localhost:3000 >nul 2>&1
if errorlevel 1 (
    echo ❌ Servidor: NO responde
) else (
    echo ✅ Servidor: Respondiendo
)

tasklist | findstr ngrok.exe >nul 2>&1
if errorlevel 1 (
    echo ❌ Ngrok: NO corriendo
) else (
    echo ✅ Ngrok: CORRIENDO
)

echo.
echo =================================================
echo    OPCIONES DISPONIBLES:
echo =================================================
echo.
echo [1] Ver estado detallado
echo [2] Ver logs en tiempo real
echo [3] Reiniciar aplicacion
echo [4] Parar aplicacion
echo [5] Iniciar aplicacion
echo [6] Probar webhooks
echo [7] Configurar ngrok permanente
echo [8] Ver metricas de rendimiento
echo [9] Backup del sistema
echo [0] Salir
echo.

set /p opcion="Elige una opcion (0-9): "

if "%opcion%"=="1" goto estado
if "%opcion%"=="2" goto logs
if "%opcion%"=="3" goto reiniciar
if "%opcion%"=="4" goto parar
if "%opcion%"=="5" goto iniciar
if "%opcion%"=="6" goto probar
if "%opcion%"=="7" goto ngrok
if "%opcion%"=="8" goto metricas
if "%opcion%"=="9" goto backup
if "%opcion%"=="0" goto salir
goto menu

:estado
cls
echo =================================================
echo    ESTADO DETALLADO DEL SISTEMA
echo =================================================
echo.
pm2 status
echo.
echo Conexiones de red:
netstat -ano | findstr :3000
echo.
echo Uso de memoria:
pm2 monit --no-colors
echo.
pause
goto menu

:logs
cls
echo =================================================
echo    LOGS EN TIEMPO REAL
echo    (Presiona Ctrl+C para volver al menu)
echo =================================================
echo.
pm2 logs ricardo-beauty-assistant
goto menu

:reiniciar
echo.
echo Reiniciando aplicacion...
pm2 restart ricardo-beauty-assistant
echo ✅ Aplicacion reiniciada
timeout /t 3
goto menu

:parar
echo.
echo Parando aplicacion...
pm2 stop ricardo-beauty-assistant
echo ✅ Aplicacion parada
timeout /t 3
goto menu

:iniciar
echo.
echo Iniciando aplicacion...
pm2 start ecosystem.config.json
echo ✅ Aplicacion iniciada
timeout /t 3
goto menu

:probar
cls
echo =================================================
echo    PROBANDO WEBHOOKS
echo =================================================
echo.
echo [1] Probando servidor local...
curl http://localhost:3000
echo.
echo.
echo [2] Probando webhook WhatsApp...
curl -X POST http://localhost:3000/webhook/whatsapp -H "Content-Type: application/json" -d "{\"test\": \"webhook\"}"
echo.
echo.
echo [3] Probando webhook Calendly...
curl -X POST http://localhost:3000/api/calendly/webhook -H "Content-Type: application/json" -d "{\"test\": \"webhook\"}"
echo.
echo.
echo [4] Probando URL de ngrok...
curl https://604fc8f718749.ngrok-free.app
echo.
pause
goto menu

:ngrok
cls
echo =================================================
echo    CONFIGURACION NGROK PERMANENTE
echo =================================================
echo.
echo Opciones para ngrok permanente:
echo.
echo [A] Instalar ngrok como servicio de Windows
echo [B] Configurar ngrok en inicio automático
echo [C] Ver configuración actual de ngrok
echo.
set /p ng_opcion="Elige opcion (A/B/C): "

if /i "%ng_opcion%"=="A" (
    echo.
    echo Instalando ngrok como servicio...
    echo NOTA: Requiere ejecutar como administrador
    echo.
    echo Comando a ejecutar como administrador:
    echo ngrok service install --config=%USERPROFILE%\.ngrok2\ngrok.yml
    echo ngrok service start
    echo.
    pause
)

if /i "%ng_opcion%"=="B" (
    echo.
    echo Creando auto-inicio de ngrok...
    echo @echo off > ngrok-auto.bat
    echo title Ngrok Auto Start >> ngrok-auto.bat
    echo cd /d "%USERPROFILE%" >> ngrok-auto.bat
    echo timeout /t 15 /nobreak >> ngrok-auto.bat
    echo ngrok http 3000 >> ngrok-auto.bat
    
    echo Set oWS = WScript.CreateObject("WScript.Shell") > create_ngrok_startup.vbs
    echo sLinkFile = "%USERPROFILE%\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\Ngrok Auto.lnk" >> create_ngrok_startup.vbs
    echo Set oLink = oWS.CreateShortcut(sLinkFile) >> create_ngrok_startup.vbs
    echo oLink.TargetPath = "%CD%\ngrok-auto.bat" >> create_ngrok_startup.vbs
    echo oLink.WorkingDirectory = "%CD%" >> create_ngrok_startup.vbs
    echo oLink.WindowStyle = 7 >> create_ngrok_startup.vbs
    echo oLink.Save >> create_ngrok_startup.vbs
    cscript create_ngrok_startup.vbs >nul
    del create_ngrok_startup.vbs
    
    echo ✅ Ngrok configurado para auto-inicio
    timeout /t 3
)

if /i "%ng_opcion%"=="C" (
    echo.
    echo Configuracion actual de ngrok:
    ngrok config check 2>nul || echo No se puede acceder a la configuracion
    echo.
    echo Tuneles activos:
    curl http://localhost:4040/api/tunnels 2>nul || echo No hay API de ngrok disponible
    pause
)

goto menu

:metricas
cls
echo =================================================
echo    METRICAS DE RENDIMIENTO
echo =================================================
echo.
pm2 show ricardo-beauty-assistant
echo.
pause
goto menu

:backup
cls
echo =================================================
echo    BACKUP DEL SISTEMA
echo =================================================
echo.
set backup_dir=c:\Users\ricar\Asistente_RB_Backup_%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%
set backup_dir=%backup_dir: =%
echo Creando backup en: %backup_dir%
mkdir "%backup_dir%" 2>nul
xcopy "c:\Users\ricar\Asistente_RB\*.js" "%backup_dir%\" /y
xcopy "c:\Users\ricar\Asistente_RB\*.json" "%backup_dir%\" /y
xcopy "c:\Users\ricar\Asistente_RB\*.md" "%backup_dir%\" /y
xcopy "c:\Users\ricar\Asistente_RB\.env*" "%backup_dir%\" /y
pm2 save
xcopy "%USERPROFILE%\.pm2\dump.pm2" "%backup_dir%\" /y
echo ✅ Backup completado en: %backup_dir%
pause
goto menu

:salir
echo.
echo ¡Gracias por usar Ricardo Beauty Assistant!
echo Tu aplicacion seguira corriendo en segundo plano.
timeout /t 3
exit
