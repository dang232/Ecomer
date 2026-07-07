#!/bin/bash
# Integration Test Runner for VNShop
# Runs Docker Compose test environment and executes tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== VNShop Integration Test Runner ==="
echo "Project root: $PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Cleanup function
cleanup() {
    echo ""
    echo "=== Cleaning up ==="
    cd "$PROJECT_ROOT"
    docker-compose -f docker-compose.test.yml down --volumes --remove-orphans 2>/dev/null || true
}

# Set trap for cleanup
trap cleanup EXIT

# Step 1: Start test environment
echo ""
echo "=== Step 1: Starting Docker Compose test environment ==="
cd "$PROJECT_ROOT"
docker-compose -f docker-compose.test.yml up -d

# Step 2: Wait for services to be healthy
echo ""
echo "=== Step 2: Waiting for services to be healthy ==="

wait_for_service() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        echo -n "Waiting for $service... (attempt $attempt/$max_attempts) "
        if curl -sf "$url" > /dev/null 2>&1; then
            print_status "$service is healthy"
            return 0
        fi
        echo "not ready, waiting..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service failed to become healthy"
    return 1
}

wait_for_service "postgres" "http://localhost:5432" || exit 1
wait_for_service "redis" "http://localhost:6379" || exit 1
wait_for_service "product-service" "http://localhost:8082/actuator/health" || exit 1
wait_for_service "frontend" "http://localhost:3000" || exit 1

# Step 3: Run backend integration tests
echo ""
echo "=== Step 3: Running backend integration tests ==="
cd "$PROJECT_ROOT/services/product-service"
if ./mvnw verify -Dspring.profiles.active=test; then
    print_status "Backend tests passed"
else
    print_error "Backend tests failed"
    exit 1
fi

# Step 4: Run frontend tests
echo ""
echo "=== Step 4: Running frontend tests ==="
cd "$PROJECT_ROOT/fe"
if npm test -- --run; then
    print_status "Frontend tests passed"
else
    print_error "Frontend tests failed"
    exit 1
fi

# Step 5: Run Playwright E2E tests
echo ""
echo "=== Step 5: Running Playwright E2E tests ==="
cd "$PROJECT_ROOT/fe"
if npx playwright test; then
    print_status "E2E tests passed"
else
    print_error "E2E tests failed"
    exit 1
fi

echo ""
echo "=== All integration tests passed! ==="
