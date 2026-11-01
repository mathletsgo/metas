@echo off
title Meta Lojas - Servidor Local
cd /d "%~dp0site"
echo ========================================================
echo       Iniciando o site Meta Lojas em http://localhost:8080
echo ========================================================
start http://localhost:8080
python -m http.server 8080
pause
