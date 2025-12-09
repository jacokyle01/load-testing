#!/bin/bash

# Run All Load Tests
# This script runs the complete test suite: baseline, progressive, and endpoint tests

set -e

echo "========================================"
echo "  Conduit Load Testing Suite"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if server is running
echo -e "${BLUE}Checking if server is running...${NC}"
if ! curl -s http://localhost:3001/ > /dev/null; then
    echo -e "${RED}Error: Server is not running on port 3001${NC}"
    echo "Please start the server with: npm run dev"
    exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# Check if autocannon is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

# Install autocannon if needed
if ! npm list -g autocannon > /dev/null 2>&1; then
    echo -e "${YELLOW}Installing autocannon...${NC}"
    npm install -g autocannon
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOAD_TEST_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}Step 1: Running Baseline Test${NC}"
echo "-----------------------------------"
node "$LOAD_TEST_DIR/autocannon/baseline-test.js"
echo ""
sleep 5

echo -e "${BLUE}Step 2: Running Endpoint Comparison${NC}"
echo "-----------------------------------"
node "$LOAD_TEST_DIR/autocannon/test-endpoints.js"
echo ""
sleep 5

echo -e "${BLUE}Step 3: Running Progressive Load Test${NC}"
echo "-----------------------------------"
node "$LOAD_TEST_DIR/autocannon/load-test-progressive.js"
echo ""

echo -e "${GREEN}========================================"
echo "  All Autocannon Tests Completed!"
echo "========================================${NC}"
echo ""
echo "Results are saved in: $LOAD_TEST_DIR/results/"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review the results in the results/ directory"
echo "2. Run Locust tests for realistic user workflows:"
echo "   cd $LOAD_TEST_DIR/locust"
echo "   locust -f locustfile.py --host=http://localhost:3001"
echo "3. Compare Autocannon vs Locust results"
