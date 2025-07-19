@echo off
echo ========================================
echo   VERIFICADOR DE SISTEMA - ASISTENTE RB
echo ========================================
echo.

echo Verificando estado del sistema...
node scripts/verify_production_status.js

echo.
echo Verificacion completada.
echo Presiona cualquier tecla para continuar...
pause > nul
