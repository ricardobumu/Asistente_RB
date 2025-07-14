@echo off
echo ========================================
echo    GESTOR DE PUERTOS - ASISTENTE RB
echo ========================================

echo.
echo Verificando puertos en uso...
echo.

echo Puerto 3000:
netstat -ano | findstr :3000
if %errorlevel% equ 0 (
    echo [OCUPADO] Puerto 3000 en uso
    set /p kill3000="¿Terminar procesos en puerto 3000? (s/n): "
    if /i "%kill3000%"=="s" (
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
            echo Terminando proceso %%a...
            taskkill /PID %%a /F >nul 2>&1
        )
        echo Puerto 3000 liberado.
    )
) else (
    echo [LIBRE] Puerto 3000 disponible
)

echo.
echo Puerto 3001:
netstat -ano | findstr :3001
if %errorlevel% equ 0 (
    echo [OCUPADO] Puerto 3001 en uso
    set /p kill3001="¿Terminar procesos en puerto 3001? (s/n): "
    if /i "%kill3001%"=="s" (
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do (
            echo Terminando proceso %%a...
            taskkill /PID %%a /F >nul 2>&1
        )
        echo Puerto 3001 liberado.
    )
) else (
    echo [LIBRE] Puerto 3001 disponible
)

echo.
echo Puerto 4040 (ngrok):
netstat -ano | findstr :4040
if %errorlevel% equ 0 (
    echo [OCUPADO] Puerto 4040 en uso (probablemente ngrok)
) else (
    echo [LIBRE] Puerto 4040 disponible
)

echo.
echo ========================================
echo Puertos verificados. Presiona cualquier tecla para continuar...
pause >nul