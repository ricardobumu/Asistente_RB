@echo off 
title PM2 Auto Start - Ricardo Beauty 
cd /d "c:\Users\ricar\Asistente_RB" 
timeout /t 10 /nobreak 
pm2 resurrect 
exit 
