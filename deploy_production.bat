@echo off
echo ========================================
echo   DESPLIEGUE A PRODUCCION - RAILWAY
echo ========================================
echo.

echo ATENCION: Este script desplegara la aplicacion a produccion.
echo Asegurate de que todos los cambios esten probados localmente.
echo.
set /p confirm="Continuar con el despliegue? (s/N): "

if /i "%confirm%" neq "s" (
    echo Despliegue cancelado.
    pause
    exit /b 1
)

echo.
echo Iniciando despliegue a Railway...
node scripts/deploy_railway.js

echo.
echo Despliegue completado.
echo Presiona cualquier tecla para continuar...
pause > nul
