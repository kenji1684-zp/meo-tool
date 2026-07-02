@echo off
cd /d "%USERPROFILE%\OneDrive\デスクトップ\meo-tool"
start http://localhost:3000/login
npm run dev
pause