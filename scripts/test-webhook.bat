@echo off
echo ========================================
echo    PROBANDO WEBHOOK DE CALENDLY
echo ========================================

set WEBHOOK_URL=https://604fc8f718749.ngrok-free.app/api/calendly/webhook

echo.
echo Probando conexión al webhook...
echo URL: %WEBHOOK_URL%
echo.

curl -X POST %WEBHOOK_URL% ^
  -H "Content-Type: application/json" ^
  -d "{\"event\":\"invitee.created\",\"time\":\"2024-01-01T12:00:00.000000Z\",\"payload\":{\"event_type\":{\"uuid\":\"test-uuid\",\"name\":\"Test Event\"},\"invitee\":{\"uuid\":\"test-invitee-uuid\",\"email\":\"test@example.com\",\"name\":\"Test User\"}}}"

echo.
echo ========================================
echo Prueba completada.
pause