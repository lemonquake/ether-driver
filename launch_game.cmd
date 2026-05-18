@echo off
setlocal
title Ether Driver - Launcher

pushd "%~dp0"

set "NODE_CMD="
for /f "delims=" %%I in ('where node.exe 2^>nul') do (
    if not defined NODE_CMD set "NODE_CMD=%%I"
)

if not defined NODE_CMD if exist "%LOCALAPPDATA%\OpenAI\Codex\bin\node.exe" set "NODE_CMD=%LOCALAPPDATA%\OpenAI\Codex\bin\node.exe"
if not defined NODE_CMD if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_CMD=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_CMD if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_CMD=%ProgramFiles(x86)%\nodejs\node.exe"

if not defined NODE_CMD (
    echo [ERROR] Could not find Node.js.
    echo [INFO] Checked PATH, Codex local Node, and standard Node.js install folders.
    echo [INFO] Install Node.js from https://nodejs.org/ and try again.
    pause
    popd
    exit /b 1
)

set "NPM_CMD="
for /f "delims=" %%I in ('where npm.cmd 2^>nul') do (
    if not defined NPM_CMD set "NPM_CMD=%%I"
)

if not defined NPM_CMD if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM_CMD=%ProgramFiles%\nodejs\npm.cmd"
if not defined NPM_CMD if exist "%ProgramFiles(x86)%\nodejs\npm.cmd" set "NPM_CMD=%ProgramFiles(x86)%\nodejs\npm.cmd"

echo [INFO] Starting Ether Driver...
echo [INFO] Node: "%NODE_CMD%"
if defined NPM_CMD (
    echo [INFO] npm: "%NPM_CMD%"
) else (
    echo [WARN] npm was not found on PATH.
)

if not exist "node_modules\" (
    if not defined NPM_CMD (
        echo [ERROR] Dependencies are missing and npm is not available.
        echo [INFO] Install Node.js with npm, then run this launcher again.
        pause
        popd
        exit /b 1
    )

    echo [INFO] First time setup: installing dependencies...
    call "%NPM_CMD%" install
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies.
        pause
        popd
        exit /b 1
    )
)

echo [INFO] Launching game server at http://127.0.0.1:5173
start "" "http://127.0.0.1:5173"

if defined NPM_CMD (
    call "%NPM_CMD%" run dev
) else (
    if not exist "node_modules\vite\bin\vite.js" (
        echo [ERROR] Vite is missing from node_modules and npm is not available.
        echo [INFO] Install dependencies with npm install, then run this launcher again.
        pause
        popd
        exit /b 1
    )
    call "%NODE_CMD%" "node_modules\vite\bin\vite.js" --host 127.0.0.1
)

pause
popd
endlocal
