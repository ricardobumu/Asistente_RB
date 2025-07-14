@echo off
title Ricardo Beauty - Server + ngrok
cls

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║                RICARDO BEAUTY ASSISTANT                ║
echo ║                    Setup con ngrok                     ║
echo ╚════════════════════════════════════════════════════════╝
echo.

echo [PASO 1] Verificando puerto 3000...
netstat -ano | findstr :3000 >nul
if %errorlevel%==0 (
    echo ⚠️  Puerto 3000 en uso. Liberando...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do taskkill /f /pid %%a >nul 2>&1
    timeout /t 2 /nobreak >nul
)
echo ✅ Puerto 3000 disponible

echo.
echo [PASO 2] Iniciando servidor...
echo 📍 Servidor: http://localhost:3000
echo 🔗 Para ngrok: Ejecuta "ngrok http 3000" en otra terminal
echo.
echo ⚠️  IMPORTANTE: Mantén esta ventana abierta
echo.

node super-simple-server.js

pause
