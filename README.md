# DevFlow — Developer Workflow Automation

Automate your entire development workflow from task to deployment. **DevFlow** is a CLI tool that integrates Jira, Figma, Git, and deployment infrastructure, reducing manual work by 30-40%.

## Features

### 🎯 Smart Task Management
- Fetch Jira tasks with full context
- Extract designs, specs, and requirements
- Auto-detect task type and generate targeted prompts

### 📋 Intelligent Prompt Generation
- Automatic context compilation (Jira + Figma + code)
- Template-based generation (CRUD, API, bug fixes, etc.)
- Copy to clipboard for Claude Code integration
- Backend & frontend support

### 🔀 Git Automation
- Smart branch naming from Jira IDs
- Intelligent commit messages
- One-command PR creation
- Automatic Jira status sync

### 🚀 Deployment Made Easy
- Multi-environment support (staging, production)
- Pre-deploy health checks & validation
- Rollback with one command
- Deploy history tracking

### ✅ Test Generation
- API tests (HTTP, Postman, Jest formats)
- E2E tests (Playwright, Cypress)
- Page Object generation
- Acceptance criteria → test scenarios

### 🛠️ Stack Detection
- Auto-detect backend/frontend stacks
- Support for 15+ backend frameworks
- Infrastructure detection (DB, cache, queue)
- Automatic Docker/Compose generation

## Quick Start

### Install

```bash
# Global (recommended for system-wide use)
npm install -g devflow-cli

# Or project-level
npm install --save-dev devflow-cli
```

### Initial Setup

```bash
# 1. Initialize project
devflow init

# 2. Set environment tokens
export DEVFLOW_JIRA_TOKEN="your-jira-api-token"
export DEVFLOW_FIGMA_TOKEN="your-figma-token"  # optional

# 3. Verify setup
devflow doctor
```

### Typical Workflow

```bash
# Morning: Check your tasks
devflow task list

# Start a task
devflow start PROJ-123

# Generate prompt context (auto-copies to clipboard)
devflow prompt PROJ-123

# Paste into Claude Code, implement features...

# Generate tests
devflow test:api PROJ-123
devflow test:e2e PROJ-123

# Commit & ship
devflow commit
devflow ship

# Deploy
devflow deploy staging
devflow deploy production
```

## Commands

| Command | Purpose | Time Saved |
|---------|---------|-----------|
| `devflow init` | Setup project | 10 min |
| `devflow task <ID>` | Fetch task details | 2 min |
| `devflow task list` | List your tasks | 1 min |
| `devflow doctor` | Health check | 5 min |
| `devflow figma <URL>` | Parse design specs | 10 min |
| `devflow prompt <ID>` | Generate AI prompt | 15 min |
| `devflow start <ID>` | Create branch, transition Jira | 2 min |
| `devflow ship` | Push, PR, update Jira | 5 min |
| `devflow deploy [env]` | Deploy with checks | 10 min |
| `devflow test:api <ID>` | Generate API tests | 20 min |
| `devflow test:e2e <ID>` | Generate E2E tests | 20 min |
| `devflow web` | Start web dashboard | - |

**Total Typical Task:** 2+ hours → ~10 minutes with DevFlow

## Configuration

### Project Config (`.devflow.yml`)

```yaml
project:
  name: "my-app"
  type: "laravel"          # laravel, symfony, django, express, nestjs, spring, dotnet, etc.
  php_version: "8.2"

jira:
  host: "https://company.atlassian.net"
  email: "dev@company.com"
  project_key: "PROJ"

figma:
  default_project: "figma-project-id"

git:
  branch_prefix: "feature"
  base_branch: "develop"
  create_pr: true

deploy:
  staging:
    type: "ssh"
    host: "staging.company.com"
    user: "deployer"
    path: "/var/www/staging"
  production:
    type: "ssh"
    host: "prod.company.com"
    user: "deployer"
    path: "/var/www/production"
    requires_approval: true
```

### Environment Variables

```bash
# Required
export DEVFLOW_JIRA_TOKEN="jira-api-token"

# Optional
export DEVFLOW_FIGMA_TOKEN="figma-token"
export DEVFLOW_GITHUB_TOKEN="github-token"
export DEVFLOW_SLACK_WEBHOOK="slack-webhook"
```

## Supported Technologies

### Backend
Laravel, Symfony, Django, FastAPI, Express, NestJS, Spring Boot, .NET Core

### Frontend
React, Vue, Angular, Next.js, Nuxt.js, Svelte

### Infrastructure
PostgreSQL, MySQL, MongoDB, Redis, RabbitMQ, Elasticsearch, MinIO, Docker

## Documentation

- **[Project Overview & PDR](./docs/project-overview-pdr.md)** — Features, architecture, requirements
- **[Codebase Summary](./docs/codebase-summary.md)** — Source structure, modules, statistics
- **[Code Standards](./docs/code-standards.md)** — Development guidelines, testing, security
- **[System Architecture](./docs/system-architecture.md)** — Data flow, design patterns, integrations
- **[Project Roadmap](./docs/project-roadmap.md)** — Planned features, timelines
- **[Jira Integration](./docs/02-JIRA-INTEGRATION.md)** — Task fetching, parsing, status sync
- **[Figma Integration](./docs/03-FIGMA-INTEGRATION.md)** — Design parsing, token extraction
- **[Prompt Generation](./docs/04-PROMPT-GENERATION.md)** — Context compilation, templates
- **[Git Automation](./docs/05-GIT-AUTOMATION.md)** — Branch, commit, PR workflow
- **[Deployment](./docs/06-DEPLOY-AUTOMATION.md)** — SSH, Docker, rollback strategies
- **[Web Dashboard](./docs/07-WEB-DASHBOARD.md)** — REST API, task board, deploy status
- **[API Testing](./docs/10-API-TESTING.md)** — Test generation, formats, execution
- **[E2E Testing](./docs/11-E2E-TESTING.md)** — Playwright, Cypress, Page Objects

## Architecture Overview

```
Commands (CLI Interface)
    ↓ orchestrate
Services (Jira, Figma, Git, Deploy, Prompt, Test)
    ↓ use
Utils (Config, Logger, Parsers, Maps, API Client)
```

**Key Services:**
- **JiraService** — Fetch tasks, parse ADF, transition status
- **FigmaService** — Parse designs, extract tokens
- **GitService** — Branch, commit, PR creation
- **DeployService** — SSH/Docker deployment, health checks
- **PromptService** — Template-based prompt generation
- **APITestService** — Test generation (HTTP, Postman, Jest)
- **E2ETestService** — E2E test generation (Playwright, Cypress)

## Performance

- Config load: <100ms (cached)
- API calls: <2s with retry (3 retries, exponential backoff)
- Prompt generation: <5s (includes code scanning)
- Test generation: <10s (endpoint discovery + code gen)

## Requirements

- **Node.js** >= 18 LTS
- **npm** >= 8
- **Git** 2.0+
- Jira account with API token access
- Figma account (optional, for design features)
- SSH key for deployment (if using SSH)

## Installation from Source

```bash
git clone https://github.com/yourcompany/devflow-cli
cd devflow-cli
npm install
npm run test
npm run lint

# Development mode
npm run dev

# Use local version
node bin/devflow.js --help
```

## Scripts

```bash
npm start           # Run CLI
npm run dev         # Watch mode + web dashboard
npm run test        # Run tests
npm run test:watch  # Watch tests
npm run test:coverage  # Coverage report
npm run lint        # Check code style
npm run lint:fix    # Auto-fix lint issues
```

## Usage Examples

### Fetch a Task
```bash
$ devflow task PROJ-456
```
Displays task details: description, AC, custom fields, subtasks, linked resources.

### Generate Smart Prompt
```bash
$ devflow prompt PROJ-456
```
Automatically:
1. Fetches task from Jira
2. Extracts design URL from task
3. Parses Figma design specs
4. Scans codebase for relevant files
5. Detects task type (CRUD, API, bug fix)
6. Selects appropriate template
7. Compiles everything into structured prompt
8. Copies to clipboard

### Deploy with Safeguards
```bash
$ devflow deploy production
```
Automatically:
1. Validates branch is up-to-date
2. Verifies SSH connection
3. Runs pre-deploy health checks
4. Executes deployment commands
5. Validates health checks post-deploy
6. Logs deployment history
7. (Optional) Rolls back on failure

### Generate Tests
```bash
$ devflow test:api PROJ-456
```
Generates API tests in multiple formats (HTTP, Postman, Jest).

```bash
$ devflow test:e2e PROJ-456
```
Generates E2E tests with Page Objects (Playwright/Cypress).

## Troubleshooting

### Config not found
```bash
$ devflow doctor
# Check output for missing .devflow.yml
$ devflow init  # Create config
```

### Jira connection failed
```bash
# Verify token
echo $DEVFLOW_JIRA_TOKEN

# Check Jira host in .devflow.yml
cat .devflow.yml | grep jira
```

### Deploy failed
```bash
# Check SSH key
devflow doctor

# Check deploy logs
devflow deploy log production
```

### Prompt not generated
```bash
# Check config
devflow doctor

# Verify Jira task exists
devflow task PROJ-456

# Check template selection
devflow prompt PROJ-456 --debug
```

## Contributing

DevFlow welcomes contributions! See [Code Standards](./docs/code-standards.md) for development guidelines.

### Development Setup

```bash
git clone <repo>
cd devflow-cli
npm install

# Run tests
npm run test

# Watch mode
npm run test:watch

# Code style
npm run lint
npm run lint:fix
```

### Commit Guidelines

Use conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Test additions

Example: `feat: add Jira custom field support`

## Support & Feedback

- **Issues:** GitHub Issues
- **Discussions:** GitHub Discussions
- **Email:** support@devflow.io

## Roadmap

Current version: **1.0.0** (core features)

Upcoming:
- **1.1.0:** Web dashboard frontend, IDE integration
- **1.2.0:** Webhooks, plugin system, advanced deployment
- **2.0.0:** Full platform with API, mobile app, marketplace

See [Project Roadmap](./docs/project-roadmap.md) for detailed timeline.

## License

MIT © 2026 DevFlow Contributors

## Changelog

See [Release Notes](./docs/project-changelog.md) for version history and breaking changes.

---

**Get started:** `devflow init` → `devflow task list` → `devflow prompt <ID>`

**Save time:** Automate 30-40% of your workflow. Focus on building great software.
