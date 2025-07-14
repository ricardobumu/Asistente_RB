@echo off
title ASISTENTE RB - DESARROLLO
echo =====================================
echo  ASISTENTE RB - INICIO DEFINITIVO
echo =====================================

REM Matar procesos anteriores
taskkill /F /IM node.exe 2>nul >nul
taskkill /F /IM ngrok.exe 2>nul >nul

echo ✅ Iniciando servidor en puerto 3000...
start "ASISTENTE RB SERVER" cmd /k "npm start"

timeout /t 3 /nobreak >nul

echo ✅ Iniciando ngrok con dominio fijo...
echo 📋 URL FIJA: https://ricardo-beauty-bot.ngrok.io
echo.
ngrok start ricardo-beauty

pause