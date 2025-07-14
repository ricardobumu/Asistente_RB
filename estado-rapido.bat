@echo off
title Estado Rapido - App + Ngrok
color 0B

echo.
echo ⚡ VERIFICACION RAPIDA:
echo.

REM Verificar Node.js
tasklist | findstr node.exe >nul && echo ✅ App corriendo || echo ❌ App NO corriendo

REM Verificar Ngrok
tasklist | findstr ngrok.exe >nul && echo ✅ Ngrok corriendo || echo ❌ Ngrok NO corriendo

REM Verificar puerto
netstat -ano | findstr :3000 >nul && echo ✅ Puerto 3000 activo || echo ❌ Puerto 3000 libre

REM Probar conexion local
curl http://localhost:3000 >nul 2>&1 && echo ✅ App responde || echo ❌ App no responde

echo.
echo 🌐 Probando tu URL de ngrok:
curl https://604fc8f718749.ngrok-free.app >nul 2>&1 && echo ✅ Ngrok URL funciona || echo ❌ Ngrok URL no funciona

echo.
timeout /t 3 >nul
