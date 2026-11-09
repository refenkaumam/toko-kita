@echo off
cd /d "%~dp0"
title Toko Kita (jangan ditutup saat toko buka)
echo Menjalankan Toko Kita di http://localhost:3000 ...
node server.js
pause
