@echo off
title Solucionando Puerto 3000 Ocupado
color 0E

echo.
echo =================================================
echo    SOLUCIONANDO PUERTO 3000 OCUPADO
echo =================================================
echo.

echo [1] Verificando que procesos usan el puerto 3000...
netstat -ano | findstr :3000
echo.

echo [2] Listando procesos Node.js activos...
tasklist | findstr node.exe
echo.

echo [3] Opciones disponibles:
echo    A) Matar todos los procesos Node.js
echo    B) Cambiar puerto del servidor
echo    C) Verificar si ya funciona
echo.

set /p opcion="Elige una opcion (A/B/C): "

if /i "%opcion%"=="A" goto matar_procesos
if /i "%opcion%"=="B" goto cambiar_puerto
if /i "%opcion%"=="C" goto verificar
goto end

:matar_procesos
echo.
echo Matando todos los procesos Node.js...
taskkill /f /im node.exe >nul 2>&1
echo ✅ Procesos eliminados
timeout /t 2
echo.
echo Iniciando servidor limpio...
node server-ngrok.js
goto end

:cambiar_puerto
echo.
echo Iniciando servidor en puerto 3001...
set PORT=3001
node server-ngrok.js
goto end

:verificar
echo.
echo Verificando si el servidor ya funciona...
curl http://localhost:3000 2>nul
if errorlevel 1 (
    echo ❌ No responde en puerto 3000
    curl http://localhost:3001 2>nul
    if errorlevel 1 (
        echo ❌ No responde en puerto 3001
        echo Necesitas iniciar el servidor
    ) else (
        echo ✅ Servidor funcionando en puerto 3001
        echo Tu ngrok deberia apuntar a puerto 3001
    )
) else (
    echo ✅ Servidor funcionando en puerto 3000
    echo Tu ngrok deberia funcionar ahora
)

:end
echo.
echo =================================================
echo    INSTRUCCIONES PARA NGROK:
echo =================================================
echo.
echo Si el servidor esta en puerto 3000:
echo    ngrok http 3000
echo.
echo Si el servidor esta en puerto 3001:
echo    ngrok http 3001
echo.
echo Luego prueba tu URL de ngrok en el navegador
echo.
pause
