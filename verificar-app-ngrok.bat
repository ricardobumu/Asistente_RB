@echo off
title Verificador de App + Ngrok - Ricardo Beauty
color 0A

echo.
echo =================================================
echo    VERIFICANDO APP + NGROK EN PARALELO
echo =================================================
echo.

cd /d "c:\Users\ricar\Asistente_RB"

echo [1/6] Verificando procesos Node.js (tu aplicacion)...
tasklist | findstr node.exe >nul
if errorlevel 1 (
    echo ❌ NO HAY procesos Node.js ejecutandose
    echo    Tu aplicacion NO esta corriendo
    set app_running=false
) else (
    echo ✅ Procesos Node.js encontrados:
    tasklist | findstr node.exe
    set app_running=true
)

echo.
echo [2/6] Verificando proceso Ngrok...
tasklist | findstr ngrok.exe >nul
if errorlevel 1 (
    echo ❌ Ngrok NO esta ejecutandose
    set ngrok_running=false
) else (
    echo ✅ Ngrok esta ejecutandose:
    tasklist | findstr ngrok.exe
    set ngrok_running=true
)

echo.
echo [3/6] Verificando puerto 3000 (donde deberia estar tu app)...
netstat -ano | findstr :3000 >nul
if errorlevel 1 (
    echo ❌ Puerto 3000 NO esta en uso
    echo    Tu aplicacion no esta escuchando
    set port_active=false
) else (
    echo ✅ Puerto 3000 esta en uso:
    netstat -ano | findstr :3000
    set port_active=true
)

echo.
echo [4/6] Probando conexion local a tu aplicacion...
curl http://localhost:3000 >temp_response.txt 2>nul
if errorlevel 1 (
    echo ❌ Tu aplicacion NO responde en localhost:3000
    set local_works=false
) else (
    echo ✅ Tu aplicacion responde:
    type temp_response.txt
    set local_works=true
)
if exist temp_response.txt del temp_response.txt

echo.
echo [5/6] Verificando si ngrok expone tu aplicacion...
echo      Detectando URL de ngrok...
curl http://localhost:4040/api/tunnels 2>nul | findstr "public_url" >temp_ngrok.txt
if exist temp_ngrok.txt (
    echo ✅ Ngrok esta exponiendo tuneles:
    type temp_ngrok.txt
    for /f "tokens=2 delims=:" %%a in ('curl http://localhost:4040/api/tunnels 2^>nul ^| findstr "https"') do (
        set ngrok_url=%%a
        goto found_url
    )
    :found_url
    set tunnel_active=true
) else (
    echo ❌ No se puede detectar URL de ngrok
    set tunnel_active=false
)
if exist temp_ngrok.txt del temp_ngrok.txt

echo.
echo [6/6] RESUMEN DEL ESTADO:
echo =================================================
echo.
if "%app_running%"=="true" (
    echo ✅ APLICACION: Ejecutandose
) else (
    echo ❌ APLICACION: NO ejecutandose
)

if "%ngrok_running%"=="true" (
    echo ✅ NGROK: Ejecutandose
) else (
    echo ❌ NGROK: NO ejecutandose
)

if "%port_active%"=="true" (
    echo ✅ PUERTO 3000: Activo
) else (
    echo ❌ PUERTO 3000: NO activo
)

if "%local_works%"=="true" (
    echo ✅ CONEXION LOCAL: Funciona
) else (
    echo ❌ CONEXION LOCAL: NO funciona
)

if "%tunnel_active%"=="true" (
    echo ✅ TUNEL NGROK: Activo
) else (
    echo ❌ TUNEL NGROK: NO activo
)

echo.
echo =================================================
echo    DIAGNOSTICO FINAL:
echo =================================================

if "%app_running%"=="true" if "%ngrok_running%"=="true" if "%local_works%"=="true" (
    echo ✅ TODO PERFECTO! App y Ngrok corriendo en paralelo
    echo.
    echo Tus URLs de webhook son:
    echo WhatsApp: https://604fc8f718749.ngrok-free.app/webhook/whatsapp
    echo Calendly: https://604fc8f718749.ngrok-free.app/api/calendly/webhook
) else (
    echo ⚠️  PROBLEMAS DETECTADOS:
    echo.
    if "%app_running%"=="false" echo    ❌ Inicia tu aplicacion: node server-ngrok.js
    if "%ngrok_running%"=="false" echo    ❌ Inicia ngrok: ngrok http 3000
    if "%local_works%"=="false" echo    ❌ Verifica que tu app responda localmente
)

echo.
echo =================================================
echo Presiona cualquier tecla para salir...
pause >nul
