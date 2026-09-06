@echo off
setlocal
cd /d "%~dp0"
title Velocity Run - server lokal
set PORT=8950
set URL=http://localhost:%PORT%/

rem Kalau server sudah menyala, cukup buka browsernya.
powershell -NoProfile -Command "try{(New-Object Net.Sockets.TcpClient('127.0.0.1',%PORT%)).Close();exit 0}catch{exit 1}" >nul 2>&1
if not errorlevel 1 (
  echo.
  echo   Server sudah menyala. Membuka %URL% ...
  echo   ^(Kalau barusan mengubah kode server, tutup dulu jendela server lama
  echo    lalu jalankan lagi berkas ini supaya perubahan terbaca.^)
  start "" "%URL%"
  timeout /t 2 >nul
  exit /b 0
)

rem Butuh Python. Kalau belum ada, pasang dari python.org (centang "Add to PATH").
where python >nul 2>&1 || (
  echo.
  echo   Python tidak ditemukan.
  echo   Pasang dulu dari https://www.python.org/downloads/ lalu jalankan lagi berkas ini.
  echo.
  pause
  exit /b 1
)

echo.
echo   Menyalakan Velocity Run di %URL%
echo   Biarkan jendela ini TERBUKA selama aplikasinya dipakai.
echo   Tutup jendela ini kalau sudah selesai.
echo.

rem Buka browser OTOMATIS begitu servernya siap (menunggu maks ~20 detik).
start "" powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 40;$i++){try{(New-Object Net.Sockets.TcpClient('127.0.0.1',%PORT%)).Close();Start-Process '%URL%';exit}catch{Start-Sleep -Milliseconds 500}}"

python -m http.server %PORT% --bind 127.0.0.1

echo.
echo   Server berhenti.
pause
