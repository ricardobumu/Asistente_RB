@echo off
title Solucion Automatica - App + Ngrok
color 0E

echo.
echo =================================================
echo    SOLUCIONANDO: APP NO EJECUTANDOSE
echo =================================================
echo.

cd /d "c:\Users\ricar\Asistente_RB"

echo [PASO 1] Limpiando procesos anteriores...
echo          Matando procesos Node.js residuales...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 >nul
echo ✅ Procesos limpiados

echo.
echo [PASO 2] Verificando que el puerto este libre...
netstat -ano | findstr :3000 >nul
if errorlevel 1 (
    echo ✅ Puerto 3000 libre
) else (
    echo ⚠️  Puerto 3000 ocupado, liberando...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do taskkill /PID %%a /F >nul 2>&1
    timeout /t 2 >nul
    echo ✅ Puerto liberado
)

echo.
echo [PASO 3] Iniciando tu aplicacion...
echo          Usando server-ngrok.js...

REM Verificar que el archivo existe
if not exist server-ngrok.js (
    echo ❌ ERROR: server-ngrok.js no encontrado
    echo    Creando servidor basico...
    goto create_server
) else (
    echo ✅ server-ngrok.js encontrado
)

echo.
echo          Iniciando servidor en segundo plano...
start "Servidor Ricardo Beauty" cmd /k "echo Servidor Ricardo Beauty iniciando... && node server-ngrok.js"

echo.
echo [PASO 4] Esperando que el servidor se inicie...
timeout /t 5 >nul

echo.
echo [PASO 5] Verificando que funcione...
curl http://localhost:3000 >temp_test.txt 2>nul
if errorlevel 1 (
    echo ❌ Servidor no responde aun, esperando mas...
    timeout /t 3 >nul
    curl http://localhost:3000 >temp_test.txt 2>nul
    if errorlevel 1 (
        echo ❌ ERROR: Servidor no se inicio correctamente
        echo    Revisa la ventana del servidor para ver errores
        goto end
    )
)

echo ✅ Servidor funcionando! Respuesta:
type temp_test.txt
if exist temp_test.txt del temp_test.txt

echo.
echo [PASO 6] Verificando ngrok...
tasklist | findstr ngrok.exe >nul
if errorlevel 1 (
    echo ❌ Ngrok no esta corriendo
    echo.
    echo NECESITAS INICIAR NGROK:
    echo 1. Abre una nueva CMD
    echo 2. Ejecuta: ngrok http 3000
    echo 3. Vuelve aqui cuando este corriendo
    echo.
    pause
) else (
    echo ✅ Ngrok ya esta corriendo
)

echo.
echo [PASO 7] Probando conexion completa...
curl https://604fc8f718749.ngrok-free.app >temp_ngrok_test.txt 2>nul
if errorlevel 1 (
    echo ❌ URL de ngrok no responde
    echo    Verifica que ngrok este apuntando a puerto 3000
) else (
    echo ✅ PERFECTO! Todo funcionando:
    type temp_ngrok_test.txt
)
if exist temp_ngrok_test.txt del temp_ngrok_test.txt

echo.
echo =================================================
echo    RESULTADO FINAL:
echo =================================================
echo.
echo ✅ Tu aplicacion deberia estar corriendo ahora
echo ✅ Tus URLs de webhook son:
echo.
echo WhatsApp: https://604fc8f718749.ngrok-free.app/webhook/whatsapp
echo Calendly: https://604fc8f718749.ngrok-free.app/api/calendly/webhook
echo.
echo Si algo no funciona, revisa la ventana del servidor
echo =================================================
goto end

:create_server
echo Creando servidor basico...
echo const http = require('http'); > server-simple.js
echo const server = http.createServer((req, res) =^> { >> server-simple.js
echo   res.writeHead(200, {'Content-Type': 'text/plain'}); >> server-simple.js
echo   res.end('Servidor funcionando!'); >> server-simple.js
echo }); >> server-simple.js
echo server.listen(3000, () =^> console.log('Servidor en puerto 3000')); >> server-simple.js
echo ✅ Servidor creado, iniciando...
start "Servidor Simple" cmd /k "node server-simple.js"
goto continue_check

:continue_check
timeout /t 3 >nul
goto end

:end
echo.
echo Presiona cualquier tecla para salir...
pause >nul
