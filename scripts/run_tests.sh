#!/bin/bash
# Run tests inside the Granite Docker container

set -e

echo "Running Granite Tests"
echo "====================="
echo ""

# Check if container is running
if ! docker ps | grep -q granite; then
    echo "Error: Granite container is not running"
    echo "Please start it with: docker-compose up -d"
    exit 1
fi

echo "Container is running"
echo ""

# Run pytest inside the container
echo "Running backend tests..."
echo ""

echo "→ Plugin API Tests"
docker exec granite pytest /app/tests/test_plugin_api.py -v --tb=short

echo ""
echo "→ Git Plugin Tests"
docker exec granite pytest /app/tests/test_git_plugin.py -v --tb=short

echo ""
echo "→ User Settings Tests"
docker exec granite pytest /app/tests/test_user_settings.py -v --tb=short

echo ""
echo "→ Templates Tests"
docker exec granite pytest /app/tests/test_templates.py -v --tb=short

echo ""
echo "Tests complete!"
echo ""
echo "Test Summary:"
echo "  [✓] Plugin API Tests (8 endpoints)"
echo "  [✓] Git Plugin Tests (26 test cases)"
echo "     - API endpoints (10 tests)"
echo "     - Unit tests (12 tests)"
echo "     - Integration tests (4 tests)"
echo "  [✓] User Settings Tests (13 test cases)"
echo "     - Utils tests (6 tests)"
echo "     - API tests (6 tests)"
echo "     - Plugin persistence (1 test)"
echo "  [✓] Templates Tests (15 test cases)"
echo "     - Path resolution (7 tests)"
echo "     - API tests (6 tests)"
echo "     - Integration tests (2 tests)"
echo ""
echo "Frontend test pages:"
echo "  - Plugin UI Tests:     http://localhost:8000/tests/test_plugin_ui.html"
echo "  - Git Plugin UI Tests: http://localhost:8000/tests/test_git_plugin_ui.html"
echo ""
echo "Tip: Run specific SSH tests with:"
echo "   docker exec granite pytest /app/tests/test_git_plugin.py -v -k ssh"
