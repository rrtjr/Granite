@echo off
REM Run tests inside the Granite Docker container

echo Running Granite Tests
echo =====================
echo.

REM Check if container is running
docker ps | findstr granite >nul 2>&1
if errorlevel 1 (
    echo Error: Granite container is not running
    echo Please start it with: docker-compose up -d
    exit /b 1
)

echo Container is running
echo.

REM Run pytest inside the container
echo Running backend tests...
echo.

echo ^>  Plugin API Tests
docker exec granite pytest /app/tests/test_plugin_api.py -v --tb=short

echo.
echo ^>  Git Plugin Tests
docker exec granite pytest /app/tests/test_git_plugin.py -v --tb=short

echo.
echo Tests complete!
echo.
echo Frontend test pages:
echo   - Plugin UI Tests:     http://localhost:8000/tests/test_plugin_ui.html
echo   - Git Plugin UI Tests: http://localhost:8000/tests/test_git_plugin_ui.html
