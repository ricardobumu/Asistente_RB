@echo off
echo Iniciando ngrok para puerto 3000...
echo.
echo IMPORTANTE: 
echo 1. Asegurate de que tu aplicacion este corriendo en puerto 3000
echo 2. Copia la URL https://xxxxx.ngrok.io que aparezca abajo
echo 3. Usala para configurar webhooks en Twilio y Calendly
echo.
echo Presiona cualquier tecla para continuar...
pause >nul
echo.

ngrok http 3000
