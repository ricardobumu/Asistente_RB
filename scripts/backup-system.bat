@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    SISTEMA DE RESPALDO - ASISTENTE RB
echo ========================================

REM Obtener fecha y hora actual
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%" & set "Sec=%dt:~12,2%"
set "timestamp=%YYYY%-%MM%-%DD%_%HH%-%Min%-%Sec%"

REM Crear directorio de respaldos
set "backup_dir=c:\Users\ricar\Asistente_RB_Backups"
if not exist "%backup_dir%" mkdir "%backup_dir%"

REM Crear directorio específico para este respaldo
set "current_backup=%backup_dir%\backup_%timestamp%"
mkdir "%current_backup%"

echo.
echo Creando respaldo en: %current_backup%
echo Timestamp: %timestamp%
echo.

REM Copiar archivos del proyecto (excluyendo node_modules y logs)
echo [1/6] Copiando código fuente...
xcopy "c:\Users\ricar\Asistente_RB\src" "%current_backup%\src\" /E /I /Q

echo [2/6] Copiando scripts...
xcopy "c:\Users\ricar\Asistente_RB\scripts" "%current_backup%\scripts\" /E /I /Q

echo [3/6] Copiando archivos públicos...
xcopy "c:\Users\ricar\Asistente_RB\public" "%current_backup%\public\" /E /I /Q

echo [4/6] Copiando configuración...
copy "c:\Users\ricar\Asistente_RB\package.json" "%current_backup%\" >nul
copy "c:\Users\ricar\Asistente_RB\package-lock.json" "%current_backup%\" >nul
copy "c:\Users\ricar\Asistente_RB\.env" "%current_backup%\" >nul
copy "c:\Users\ricar\Asistente_RB\.env.local" "%current_backup%\" >nul
copy "c:\Users\ricar\Asistente_RB\railway.toml" "%current_backup%\" >nul
if exist "c:\Users\ricar\Asistente_RB\README.md" copy "c:\Users\ricar\Asistente_RB\README.md" "%current_backup%\" >nul

echo [5/6] Copiando documentación...
if exist "c:\Users\ricar\Asistente_RB\docs" xcopy "c:\Users\ricar\Asistente_RB\docs" "%current_backup%\docs\" /E /I /Q

echo [6/6] Creando archivo de información del respaldo...
echo Respaldo creado: %timestamp% > "%current_backup%\backup_info.txt"
echo Versión: Asistente RB v1.0.0 >> "%current_backup%\backup_info.txt"
echo Sistema: Windows 11 >> "%current_backup%\backup_info.txt"
echo Node.js: >> "%current_backup%\backup_info.txt"
node --version >> "%current_backup%\backup_info.txt"
echo. >> "%current_backup%\backup_info.txt"
echo Archivos incluidos: >> "%current_backup%\backup_info.txt"
echo - Código fuente completo (src/) >> "%current_backup%\backup_info.txt"
echo - Scripts de gestión (scripts/) >> "%current_backup%\backup_info.txt"
echo - Archivos públicos (public/) >> "%current_backup%\backup_info.txt"
echo - Configuración (.env, package.json) >> "%current_backup%\backup_info.txt"
echo - Documentación (docs/) >> "%current_backup%\backup_info.txt"

REM Crear archivo ZIP del respaldo
echo.
echo Comprimiendo respaldo...
powershell -command "Compress-Archive -Path '%current_backup%\*' -DestinationPath '%backup_dir%\AsistentRB_backup_%timestamp%.zip'"

echo.
echo ========================================
echo ✅ RESPALDO COMPLETADO EXITOSAMENTE
echo ========================================
echo.
echo Ubicación: %backup_dir%
echo Carpeta: backup_%timestamp%
echo Archivo ZIP: AsistentRB_backup_%timestamp%.zip
echo.
echo Archivos respaldados:
dir "%current_backup%" /B
echo.

REM Limpiar respaldos antiguos (mantener solo los últimos 10)
echo Limpiando respaldos antiguos...
for /f "skip=10 delims=" %%i in ('dir "%backup_dir%\backup_*" /AD /B /O-D 2^>nul') do (
    echo Eliminando respaldo antiguo: %%i
    rmdir /S /Q "%backup_dir%\%%i" 2>nul
)

for /f "skip=10 delims=" %%i in ('dir "%backup_dir%\AsistentRB_backup_*.zip" /B /O-D 2^>nul') do (
    echo Eliminando ZIP antiguo: %%i
    del "%backup_dir%\%%i" 2>nul
)

echo.
echo ========================================
echo Respaldo guardado y sistema protegido ✅
echo ========================================
pause