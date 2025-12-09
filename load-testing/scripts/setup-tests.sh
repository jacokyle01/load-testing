#!/bin/bash

# Setup Script for Load Testing
# Installs all necessary dependencies for both Autocannon and Locust

set -e

echo "========================================"
echo "  Load Testing Setup"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOAD_TEST_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$LOAD_TEST_DIR")"

echo -e "${BLUE}1. Installing Autocannon (Node.js)${NC}"
echo "-----------------------------------"

cd "$PROJECT_ROOT"

if ! npm list autocannon > /dev/null 2>&1; then
    npm install --save-dev autocannon
    echo -e "${GREEN}✓ Autocannon installed${NC}"
else
    echo -e "${GREEN}✓ Autocannon already installed${NC}"
fi
echo ""

echo -e "${BLUE}2. Setting up Locust (Python)${NC}"
echo "-----------------------------------"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}Warning: Python 3 is not installed${NC}"
    echo "Please install Python 3 to use Locust"
    echo "Visit: https://www.python.org/downloads/"
else
    echo -e "${GREEN}✓ Python 3 is installed${NC}"

    # Check if pip is installed
    if ! command -v pip3 &> /dev/null; then
        echo -e "${YELLOW}Warning: pip3 is not installed${NC}"
    else
        echo -e "${GREEN}✓ pip3 is installed${NC}"

        # Create virtual environment if it doesn't exist
        if [ ! -d "$LOAD_TEST_DIR/locust/venv" ]; then
            echo "Creating Python virtual environment..."
            cd "$LOAD_TEST_DIR/locust"
            python3 -m venv venv
            echo -e "${GREEN}✓ Virtual environment created${NC}"
        else
            echo -e "${GREEN}✓ Virtual environment exists${NC}"
        fi

        # Activate virtual environment and install requirements
        echo "Installing Locust..."
        cd "$LOAD_TEST_DIR/locust"
        source venv/bin/activate
        pip install -r requirements.txt
        deactivate
        echo -e "${GREEN}✓ Locust installed${NC}"
    fi
fi
echo ""

echo -e "${BLUE}3. Creating results directory${NC}"
echo "-----------------------------------"
mkdir -p "$LOAD_TEST_DIR/results"
echo -e "${GREEN}✓ Results directory created${NC}"
echo ""

echo -e "${GREEN}========================================"
echo "  Setup Complete!"
echo "========================================${NC}"
echo ""
echo "Next steps:"
echo ""
echo -e "${BLUE}1. Start the application server:${NC}"
echo "   cd $PROJECT_ROOT"
echo "   npm run dev"
echo ""
echo -e "${BLUE}2. Run Autocannon tests:${NC}"
echo "   cd $LOAD_TEST_DIR"
echo "   bash scripts/run-all-tests.sh"
echo ""
echo -e "${BLUE}3. Run Locust tests:${NC}"
echo "   cd $LOAD_TEST_DIR/locust"
echo "   source venv/bin/activate"
echo "   locust -f locustfile.py --host=http://localhost:3001"
echo "   # Then open http://localhost:8089 in your browser"
echo ""
echo -e "${BLUE}4. For simple Locust test (headless):${NC}"
echo "   source venv/bin/activate"
echo "   locust -f simple-load-test.py --host=http://localhost:3001 --headless -u 50 -r 10 -t 60s"
echo ""
