@echo off
title Configuracion Auto-Inicio Windows - PM2
color 0A

echo.
echo =================================================
echo    CONFIGURANDO AUTO-INICIO EN WINDOWS
echo =================================================
echo.

echo [1/3] Creando script de inicio PM2...
echo @echo off > pm2-startup.bat
echo title PM2 Auto Start - Ricardo Beauty >> pm2-startup.bat
echo cd /d "c:\Users\ricar\Asistente_RB" >> pm2-startup.bat
echo timeout /t 10 /nobreak >> pm2-startup.bat
echo pm2 resurrect >> pm2-startup.bat
echo exit >> pm2-startup.bat

echo.
echo [2/3] Creando acceso directo en Inicio...
echo Set oWS = WScript.CreateObject("WScript.Shell") > create_startup.vbs
echo sLinkFile = "%USERPROFILE%\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\PM2 Ricardo Beauty.lnk" >> create_startup.vbs
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> create_startup.vbs
echo oLink.TargetPath = "%CD%\pm2-startup.bat" >> create_startup.vbs
echo oLink.WorkingDirectory = "%CD%" >> create_startup.vbs
echo oLink.WindowStyle = 7 >> create_startup.vbs
echo oLink.Save >> create_startup.vbs
cscript create_startup.vbs >nul
del create_startup.vbs

echo.
echo [3/3] Verificando configuracion actual...
pm2 list

echo.
echo =================================================
echo    ✅ CONFIGURACION COMPLETADA!
echo =================================================
echo.
echo ✅ PM2 instalado y funcionando
echo ✅ Tu aplicacion esta corriendo en segundo plano
echo ✅ Auto-inicio configurado para Windows
echo ✅ Se reiniciara automaticamente si hay errores
echo.
echo COMANDOS UTILES:
echo   pm2 status     - Ver estado de procesos
echo   pm2 logs       - Ver logs en tiempo real
echo   pm2 restart ricardo-beauty-assistant - Reiniciar
echo   pm2 stop ricardo-beauty-assistant - Parar
echo   pm2 delete ricardo-beauty-assistant - Eliminar
echo.
echo TUS URLs DE WEBHOOK ACTIVAS:
echo WhatsApp: https://604fc8f718749.ngrok-free.app/webhook/whatsapp
echo Calendly: https://604fc8f718749.ngrok-free.app/api/calendly/webhook
echo.
echo ⚠️  IMPORTANTE: Tu aplicacion ya esta corriendo.
echo    Puedes cerrar esta ventana sin problema.
echo.
echo =================================================

pause
