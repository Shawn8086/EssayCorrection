@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [小笔杆] 未检测到 Node.js。
  echo 请先安装 Node.js 20 或更高版本：https://nodejs.org/
  echo.
  pause
  exit /b 1
)

echo.
echo [小笔杆] 正在启动本地服务...
echo 浏览器将自动打开 http://127.0.0.1:8787
echo 关闭本窗口即可停止服务。
echo.

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:8787/'"
node server.mjs

echo.
echo 服务已停止。
pause
