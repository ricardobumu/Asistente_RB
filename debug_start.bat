@echo off
echo ===============================================
echo  INICIANDO APLICACION RICARDO BEAUTY
echo ===============================================
echo.

echo [1] Verificando Node.js...
node --version
if %errorlevel% neq 0 (
    echo ERROR: Node.js no disponible
    pause
    exit /b 1
)

echo.
echo [2] Verificando archivo principal...
if not exist server-ngrok.js (
    echo ERROR: server-ngrok.js no encontrado
    echo Usando servidor alternativo...
    if not exist src\index-simple.js (
        echo ERROR: Ningun servidor disponible
        pause
        exit /b 1
    )
)

echo.
echo [3] Verificando .env...
if not exist .env (
    echo ERROR: .env no encontrado
    pause
    exit /b 1
)

echo.
echo [4] Iniciando aplicacion...
echo    Intentando servidor compatible con ngrok...
echo    Tu ngrok URL deberia funcionar ahora
echo    (Si ves errores, presiona Ctrl+C)
echo.

if exist server-ngrok.js (
    echo Usando server-ngrok.js...
    node server-ngrok.js
) else (
    echo Usando src\index-simple.js...
    node src\index-simple.js
)

echo.
echo Script terminado.
pause
