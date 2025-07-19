@echo off
echo ========================================
echo   CONFIGURADOR DE WEBHOOKS - ASISTENTE RB
echo ========================================
echo.

echo Configurando webhooks para desarrollo local...
node scripts/configure_webhooks.js

echo.
echo Configuracion completada.
echo Presiona cualquier tecla para continuar...
pause > nul
