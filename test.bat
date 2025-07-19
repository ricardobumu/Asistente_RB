@echo off
cls
echo.
echo ========================================
echo   🧪 ASISTENTE RB - PRUEBAS
echo ========================================
echo.

echo 🔐 Verificando credenciales...
node scripts/verify_credentials.js --no-suggestions
echo.

echo 🏥 Verificando estado del sistema...
node test_integration_complete.js --health-only
echo.

echo 🔄 Probando integración completa...
node test_integration_complete.js
echo.

echo ========================================
echo   📊 PRUEBAS COMPLETADAS
echo ========================================
echo.
pause
