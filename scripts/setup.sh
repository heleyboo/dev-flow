#!/bin/bash
set -e

# ═══════════════════════════════════════
# DevFlow - Local Development Setup
# ═══════════════════════════════════════

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════╗"
echo "║       DevFlow - Dev Setup             ║"
echo "╚═══════════════════════════════════════╝"
echo -e "${NC}"

# ─── Check prerequisites ─────────────────────
echo -e "${YELLOW}[1/5] Checking prerequisites...${NC}"

check_command() {
  if command -v "$1" &> /dev/null; then
    echo -e "  ${GREEN}✅${NC} $1 $(${1} --version 2>/dev/null | head -1)"
  else
    echo -e "  ${RED}❌${NC} $1 not found"
    return 1
  fi
}

MISSING=0
check_command docker || MISSING=1
check_command docker compose version > /dev/null 2>&1 && echo -e "  ${GREEN}✅${NC} docker compose" || {
  check_command docker-compose || MISSING=1
}
check_command git || MISSING=1

if [ "$MISSING" -eq 1 ]; then
  echo -e "\n${RED}Missing prerequisites. Please install them first:${NC}"
  echo "  Docker: https://docs.docker.com/get-docker/"
  echo "  Git:    https://git-scm.com/downloads"
  exit 1
fi

# ─── Create .env file ────────────────────────
echo -e "\n${YELLOW}[2/5] Setting up environment...${NC}"

if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "  ${GREEN}✅${NC} Created .env from .env.example"
  echo -e "  ${YELLOW}⚠️  Edit .env and add your API tokens!${NC}"
else
  echo -e "  ${GREEN}✅${NC} .env already exists"
fi

# ─── Create required directories ─────────────
echo -e "\n${YELLOW}[3/5] Creating directories...${NC}"

mkdir -p .devflow/{prompts,templates,cache/figma,figma-specs,tests/fixtures}
echo -e "  ${GREEN}✅${NC} .devflow/ directories created"

# ─── Build Docker containers ─────────────────
echo -e "\n${YELLOW}[4/5] Building Docker containers...${NC}"

docker compose build --no-cache

echo -e "  ${GREEN}✅${NC} Containers built"

# ─── Install dependencies ────────────────────
echo -e "\n${YELLOW}[5/5] Installing npm dependencies...${NC}"

docker compose run --rm --no-deps app npm install

echo -e "  ${GREEN}✅${NC} Dependencies installed"

# ─── Done ─────────────────────────────────────
echo -e "\n${GREEN}"
echo "╔═══════════════════════════════════════════════════╗"
echo "║  Setup complete!                                  ║"
echo "╠═══════════════════════════════════════════════════╣"
echo "║                                                   ║"
echo "║  Quick Start:                                     ║"
echo "║  ─────────────────────────────────────            ║"
echo "║                                                   ║"
echo "║  1. Edit .env with your API tokens                ║"
echo "║                                                   ║"
echo "║  2. Start dev environment:                        ║"
echo "║     docker compose up -d                          ║"
echo "║                                                   ║"
echo "║  3. Run CLI commands:                             ║"
echo "║     docker compose exec app devflow --help        ║"
echo "║     docker compose exec app devflow init          ║"
echo "║     docker compose exec app devflow doctor        ║"
echo "║                                                   ║"
echo "║  4. Run tests:                                    ║"
echo "║     docker compose --profile testing up test      ║"
echo "║                                                   ║"
echo "║  5. Start web dashboard (Phase 7):                ║"
echo "║     docker compose --profile dashboard up web     ║"
echo "║                                                   ║"
echo "║  Useful commands:                                 ║"
echo "║  ─────────────────────────────────────            ║"
echo "║  docker compose logs -f app    # View app logs    ║"
echo "║  docker compose down           # Stop all         ║"
echo "║  docker compose up -d --build  # Rebuild & start  ║"
echo "║                                                   ║"
echo "╚═══════════════════════════════════════════════════╝"
echo -e "${NC}"
