# DevFlow — Project Overview & PDR

## Overview

**DevFlow** is a CLI tool + optional Web Dashboard that automates PHP developer workflows from task receipt to deployment. It eliminates ~30-40% manual work by consolidating Jira, Figma, Git, and deployment into intelligent automated pipelines.

### Problem Statement

Developers manually perform:
1. Jira task fetch → read requirements
2. Figma design review → note specs
3. SRS document search → extract requirements
4. Consolidate into Claude Code prompt
5. Manual git/PR workflow
6. Manual deployment

**Bottleneck:** Steps 1-4 consume 30-40% of dev time.

### Solution

One command generates complete task context (Jira + Figma + specs). Full workflow: `devflow start` → `devflow prompt` → implement → `devflow ship` → `devflow deploy`.

### Quick Stats

- **Language:** Node.js (ESM, no build)
- **Entry:** `bin/devflow.js` (Commander.js CLI)
- **Min Node:** >= 18 LTS
- **Tests:** Vitest
- **Lint:** ESLint 9
- **License:** MIT
- **Total LOC:** ~3,500 across 34 source files
- **Commands:** 10 core (init, task, doctor, ship, deploy, figma, prompt, test-api, test-e2e, web)

## Core Architecture

### 3-Layer Design

```
Commands (CLI/Output)
    ↓
Services (Business Logic)
    ↓
Utils + Parsers + Maps (Data)
```

**Layer 1: Commands** (`src/commands/`)
- CLI interface, user I/O, formatted display
- Examples: init.js, task.js, prompt.js, deploy.js

**Layer 2: Services** (`src/services/`)
- Business logic, API integrations, test generation
- Examples: JiraService, FigmaService, GitService, DeployService

**Layer 3: Utils** (`src/utils/`, `src/maps/`, `src/parsers/`, `src/schemas/`)
- Config loading, logging, API client, data mapping
- Examples: config.js, logger.js, adf-parser.js, stack-map.js

### File Structure

```
devflow/
├── bin/devflow.js                 # CLI entry point
├── src/
│   ├── commands/                  # 10 commands
│   │   ├── init.js (319 LOC)
│   │   ├── task.js (163)
│   │   ├── doctor.js (208)
│   │   ├── ship.js (164)
│   │   ├── deploy.js (156)
│   │   ├── figma.js (264)
│   │   ├── prompt.js (82)
│   │   ├── test-api.js (103)
│   │   ├── test-e2e.js (83)
│   │   └── web.js (23)
│   ├── services/                  # 11 services
│   │   ├── detector.service.js (152)
│   │   ├── docker.service.js (126)
│   │   ├── scaffold.service.js (36)
│   │   ├── linked.service.js (57)
│   │   ├── jira.service.js (330)
│   │   ├── git.service.js (410)
│   │   ├── deploy.service.js (435)
│   │   ├── figma.service.js (250+)
│   │   ├── prompt.service.js (350+)
│   │   ├── api-test.service.js (200+)
│   │   └── e2e-test.service.js (200+)
│   ├── utils/
│   │   ├── config.js (43)
│   │   ├── logger.js (11)
│   │   ├── api-client.js (29)
│   │   └── port-resolver.js (13)
│   ├── maps/
│   │   ├── stack-map.js (166)     # 15 stacks
│   │   ├── infra-map.js (122)     # 13 infra services
│   │   └── env-map.js (111)
│   ├── schemas/
│   │   └── config-schema.js (124)
│   ├── parsers/
│   │   ├── adf-parser.js (299)
│   │   └── link-extractor.js (209)
│   ├── presets/
│   │   └── index.js (77)
│   ├── templates/                 # Handlebars templates
│   │   ├── base.hbs
│   │   ├── api-endpoint.hbs
│   │   ├── crud-feature.hbs
│   │   ├── bug-fix.hbs
│   │   ├── migration.hbs
│   │   ├── refactor.hbs
│   │   └── integration.hbs
│   └── web/
│       ├── server.js (45)
│       └── routes/api.js (100)
├── .devflow.yml                   # Project config (YAML)
├── package.json
└── tests/                         # Vitest tests
```

## Key Commands

| Command | Purpose | Implementation |
|---------|---------|-----------------|
| `devflow init` | Setup project config, presets, Docker | DetectorService, DockerService |
| `devflow task <ID>` | Fetch & format Jira task | JiraService, ADFParser |
| `devflow doctor` | Health check config, connections | Detector, all Services |
| `devflow figma <URL>` | Parse Figma design, extract tokens | FigmaService, LinkExtractor |
| `devflow prompt <ID>` | Generate AI context from task+design | PromptService, Handlebars |
| `devflow start <ID>` | Create branch, transition Jira | GitService, JiraService |
| `devflow ship` | Push, PR, transition Jira | GitService, JiraService |
| `devflow deploy [env]` | Deploy with safety checks, rollback | DeployService |
| `devflow test:api <ID>` | Generate API test cases | APITestService |
| `devflow test:e2e <ID>` | Generate E2E test scenarios | E2ETestService |

## Configuration

### `.devflow.yml` (per-project)

```yaml
project:
  name: "my-php-project"
  type: "laravel"  # laravel|symfony|django|fastapi|express|nestjs|spring|dotnet
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

deploy:
  staging:
    type: "ssh"
    host: "staging.company.com"
  production:
    type: "ssh"
    host: "prod.company.com"
    requires_approval: true

test:
  api:
    base_url: "http://localhost:8000"
    default_format: "all"  # http|postman|jest|all
  e2e:
    framework: "playwright"  # playwright|cypress
```

### Environment Variables

```bash
DEVFLOW_JIRA_TOKEN      # Required
DEVFLOW_FIGMA_TOKEN     # Optional
DEVFLOW_GITHUB_TOKEN    # Optional
DEVFLOW_SLACK_WEBHOOK   # Optional
```

## Tech Stack

### Runtime & CLI
- Node.js >= 18 (LTS)
- Commander.js (CLI framework)
- Inquirer.js (interactive prompts)
- Chalk (colors)

### Integrations
- Jira REST API
- Figma API
- GitHub API
- SSH (node-ssh)

### Build & Templates
- Handlebars (prompt templates)
- simple-git (Git wrapper)
- YAML (config)

### Web (optional)
- Express.js (backend)
- React (frontend, optional)

### Testing
- Vitest (unit tests)
- ESLint 9 (linting)

## Key Features

### Feature 1: Jira Integration
- Fetch tasks with custom fields
- Parse Jira ADF → Markdown
- Extract links (Figma, SRS, etc.)
- List assigned tasks
- Transition task status

### Feature 2: Figma Design Extraction
- Parse design file by URL
- Extract component tree
- Infer UI element properties
- Extract design tokens
- Cache for performance

### Feature 3: Prompt Generation
- Detect task type (CRUD, API, bug fix, etc.)
- Auto-select Handlebars template
- Inject Jira info, Figma specs, code context
- Generate backend + frontend prompts
- Copy to clipboard

### Feature 4: Git Automation
- Smart branch naming
- Commit message templates
- PR creation (GitHub)
- Jira status transitions

### Feature 5: Deployment
- Multi-environment support
- SSH, Docker, custom strategies
- Health checks + rollback
- Deploy history logging
- Production safeguards

### Feature 6: Test Generation
- API test generation (HTTP, Postman, Jest format)
- E2E test generation (Playwright, Cypress)
- Page Object generation
- Acceptance criteria → test scenarios

### Feature 7: Stack & Infra Detection
- Auto-detect backend/frontend stacks
- Database, cache, queue detection
- Generate Docker Compose
- Environment variable mapping

## Supported Technologies

### Backend Stacks
Laravel, Symfony, Django, FastAPI, Express, NestJS, Spring Boot, .NET

### Frontend Frameworks
React, Vue, Angular, Next.js, Nuxt.js, Svelte

### Infrastructure
PostgreSQL, MySQL, MariaDB, MongoDB, Redis, Memcached, RabbitMQ, Kafka, Elasticsearch, Meilisearch, Typesense, MinIO

## PDR: Functional Requirements

1. **Jira Integration** - Fetch tasks, parse ADF, extract links ✅
2. **Figma Parsing** - Extract design specs, tokens, component tree ✅
3. **Prompt Generation** - Template-based context compilation ✅
4. **Git Automation** - Branch, commit, PR, Jira sync ✅
5. **Deployment** - SSH/Docker strategies, health checks, rollback ✅
6. **API Test Generation** - Multiple output formats ✅
7. **E2E Test Generation** - Playwright/Cypress with Page Objects ✅
8. **Stack Detection** - Auto-detect tech stacks, infra services ✅
9. **Web Dashboard** - Task board, deploy dashboard, test results (optional) ⏳

## PDR: Non-Functional Requirements

- **Performance:** Config loaded in <100ms, API calls cached
- **Reliability:** Error handling for API failures, graceful degradation
- **Security:** Token validation, no secrets in output, SSH key verification
- **Compatibility:** Node.js >= 18, works on Linux/macOS/Windows
- **Maintainability:** Modular services, comprehensive tests, clear logging
- **Extensibility:** Plugin system for custom templates, deploy strategies (future)

## Success Metrics

1. **Time Savings:** Reduce task→deploy time from 2+ hours to <10 minutes
2. **Developer Adoption:** >80% of developers using devflow for daily tasks
3. **Test Coverage:** >80% unit test coverage on core services
4. **Error Rate:** <1% CLI failures, proper error messages
5. **API Reliability:** >99% success rate on Jira/Figma API calls (with retries)

## Dependencies

**Core:**
- commander (CLI)
- inquirer (prompts)
- chalk (colors)
- ora (spinners)
- yaml (config)

**APIs:**
- node-fetch (HTTP)
- handlebars (templates)

**Git/Deploy:**
- simple-git (Git)
- node-ssh (SSH)

**Web:**
- express (server)
- cors (cross-origin)

**Data:**
- date-fns (dates)
- conf (persistent config)
- ioredis (caching)

**Dev:**
- vitest (tests)
- eslint (linting)

## Related Documentation

For detailed specs, see:
- **Jira Integration:** docs/02-JIRA-INTEGRATION.md
- **Figma Integration:** docs/03-FIGMA-INTEGRATION.md
- **Prompt Generation:** docs/04-PROMPT-GENERATION.md
- **Git Automation:** docs/05-GIT-AUTOMATION.md
- **Deployment:** docs/06-DEPLOY-AUTOMATION.md
- **Web Dashboard:** docs/07-WEB-DASHBOARD.md
- **Roadmap:** docs/08-ROADMAP-AND-SETUP.md
- **API Testing:** docs/10-API-TESTING.md
- **E2E Testing:** docs/11-E2E-TESTING.md
