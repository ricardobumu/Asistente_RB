@echo off
title Probando URLs de Webhooks
color 0A

echo.
echo =================================================
echo    PROBANDO TUS URLS DE WEBHOOKS
echo =================================================
echo.

echo [1] Probando URL principal...
curl https://604fc8f718749.ngrok-free.app
echo.
echo.

echo [2] Probando webhook de Calendly...
curl https://604fc8f718749.ngrok-free.app/api/calendly/webhook
echo.
echo.

echo [3] Probando webhook de WhatsApp...
curl https://604fc8f718749.ngrok-free.app/webhook/whatsapp
echo.
echo.

echo =================================================
echo    RESULTADO DEL TEST:
echo =================================================
echo.
echo Si ves respuestas JSON, todo funciona perfecto!
echo.
echo URLs FINALES para configurar:
echo.
echo CALENDLY:
echo https://604fc8f718749.ngrok-free.app/api/calendly/webhook
echo.
echo WHATSAPP:
echo https://604fc8f718749.ngrok-free.app/webhook/whatsapp
echo.
echo =================================================

pause
