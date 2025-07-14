@echo off
title LIMPIEZA SISTEMA
echo =====================================
echo  LIMPIANDO SISTEMA ASISTENTE RB
echo =====================================

echo ✅ Matando procesos Node.js...
taskkill /F /IM node.exe 2>nul >nul

echo ✅ Matando procesos ngrok...
taskkill /F /IM ngrok.exe 2>nul >nul

echo ✅ Limpiando logs temporales...
if exist logs\*.log del logs\*.log 2>nul

echo ✅ Limpiando cache npm...
npm cache clean --force 2>nul

echo ✅ Sistema limpio
echo.
echo 📋 Para iniciar: START.bat
pause