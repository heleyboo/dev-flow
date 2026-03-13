# DevFlow Codebase Summary

## Repository Statistics

- **Total Files:** 82
- **Total Tokens:** ~253K
- **Total Characters:** ~723K
- **Primary Language:** JavaScript (Node.js ESM)
- **Source Files:** ~34 (commands + services + utils)
- **Test Files:** Vitest suite
- **Total LOC (Source):** ~3,500+

## Directory Structure

```
devflow/
├── bin/
│   └── devflow.js                  # CLI entry point
├── src/
│   ├── commands/                   # 10 CLI commands
│   │   ├── deploy.js (156)
│   │   ├── doctor.js (208)
│   │   ├── figma.js (264)
│   │   ├── init.js (319)
│   │   ├── prompt.js (82)
│   │   ├── ship.js (164)
│   │   ├── task.js (163)
│   │   ├── test-api.js (103)
│   │   ├── test-e2e.js (83)
│   │   └── web.js (23)
│   ├── services/                   # 11 business logic services
│   │   ├── api-test.service.js (200+)
│   │   ├── deploy.service.js (435)
│   │   ├── detector.service.js (152)
│   │   ├── docker.service.js (126)
│   │   ├── e2e-test.service.js (200+)
│   │   ├── figma.service.js (250+)
│   │   ├── git.service.js (410)
│   │   ├── jira.service.js (330)
│   │   ├── linked.service.js (57)
│   │   ├── prompt.service.js (350+)
│   │   └── scaffold.service.js (36)
│   ├── utils/
│   │   ├── api-client.js (29)
│   │   ├── config.js (43)
│   │   ├── logger.js (11)
│   │   └── port-resolver.js (13)
│   ├── maps/                       # Tech stack/infra definitions
│   │   ├── env-map.js (111)
│   │   ├── infra-map.js (122)
│   │   └── stack-map.js (166)
│   ├── schemas/
│   │   └── config-schema.js (124)
│   ├── parsers/
│   │   ├── adf-parser.js (299)
│   │   └── link-extractor.js (209)
│   ├── presets/
│   │   └── index.js (77) + 15 .yml files
│   ├── docker-templates/           # Dockerfile templates
│   │   ├── dotnet.Dockerfile
│   │   ├── java.Dockerfile
│   │   ├── node.Dockerfile
│   │   ├── php.Dockerfile
│   │   └── python.Dockerfile
│   ├── templates/                  # Handlebars prompt templates
│   │   ├── base.hbs
│   │   └── partials/
│   │       ├── api-endpoint.hbs
│   │       ├── bug-fix.hbs
│   │       ├── crud-feature.hbs
│   │       ├── integration.hbs
│   │       ├── migration.hbs
│   │       └── refactor.hbs
│   └── web/                        # Express server + API
│       ├── server.js (45)
│       └── routes/api.js (100)
├── scripts/
│   └── setup.sh
├── tests/                          # Vitest test suite
│   └── unit/
├── .devflow/                       # Project-specific cache
│   └── prompts/                    # Generated prompt examples
├── .devflow.yml                    # Project configuration (YAML)
├── package.json
├── vitest.config.js
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Commands (10)

| Command | File | LOC | Purpose |
|---------|------|-----|---------|
| `devflow init` | init.js | 319 | Multi-stack project setup, presets, Docker config |
| `devflow task <ID>` | task.js | 163 | Fetch & format Jira tasks |
| `devflow task list` | task.js | 163 | List assigned Jira tasks |
| `devflow doctor` | doctor.js | 208 | Health check, config validation, connection testing |
| `devflow figma <URL>` | figma.js | 264 | Parse Figma design, extract specs, tokens, components |
| `devflow prompt <ID>` | prompt.js | 82 | Generate AI context prompt from Jira + Figma + code |
| `devflow start <ID>` | ship.js | 164 | Create git branch, transition Jira status |
| `devflow commit` | ship.js | 164 | Generate smart commit message |
| `devflow ship` | ship.js | 164 | Push, create PR, transition Jira status |
| `devflow deploy [env]` | deploy.js | 156 | Deploy with health checks, rollback, logging |
| `devflow test:api <ID>` | test-api.js | 103 | Generate API test cases (HTTP, Postman, Jest) |
| `devflow test:e2e <ID>` | test-e2e.js | 83 | Generate E2E test scenarios (Playwright, Cypress) |
| `devflow web` | web.js | 23 | Start web dashboard server |

## Services (11)

### Core Services

**JiraService** (330 LOC)
- REST API client with retry logic
- Fetch issues, custom fields, subtasks
- Transition statuses, add comments
- ADF (Atlassian Document Format) parsing

**FigmaService** (250+ LOC)
- Figma API client with auth
- Parse design files, fetch components
- Extract UI properties (colors, typography, spacing)
- Design token extraction
- Caching layer for performance

**GitService** (410 LOC)
- simple-git wrapper for Git operations
- Branch name generation (smart formatting)
- Commit message templates
- PR creation (GitHub API integration)
- Remote push with tracking

**PromptService** (350+ LOC)
- Handlebars template engine
- Template auto-selection (CRUD, bug-fix, API, etc.)
- Context compilation (Jira + Figma + code files)
- Backend & frontend prompt modes
- Clipboard integration

**DeployService** (435 LOC)
- Multi-strategy deployment (SSH, Docker, custom)
- Pre-deploy health checks
- Rollback mechanism with version tracking
- Deployment history logging
- SSH key management
- Environment-specific configuration

### Supporting Services

**DetectorService** (152 LOC)
- Auto-detect backend stack (Laravel, Symfony, Django, etc.)
- Auto-detect frontend framework (React, Vue, Angular, etc.)
- Infrastructure service detection (DB, cache, queue)
- PHP version detection
- Generate appropriate environment variables

**DockerService** (126 LOC)
- Generate Docker Compose files based on stack
- Create Dockerfile for each language
- Network, volume, and environment setup
- Multi-container orchestration

**ScaffoldService** (36 LOC)
- Generate scaffold commands for detected stack
- Artisan commands for Laravel
- Django/Symfony CLI wrapper

**LinkedService** (57 LOC)
- Multi-project workspace management
- Link related projects
- Cross-project context sharing

**APITestService** (200+ LOC)
- Parse API endpoints from code
- Generate test cases from acceptance criteria
- Multiple output formats: .http files, Postman collections, Jest/Vitest scripts
- Request/response validation templates

**E2ETestService** (200+ LOC)
- Parse acceptance criteria into test scenarios
- Generate Playwright + Cypress test code
- Page Object Model generation
- Selector mapping from Figma designs
- Screenshot & video on failure helpers

## Utilities & Parsers

**config.js** (43 LOC)
- Load .devflow.yml from project root
- Schema validation
- v1→v2 config migration
- Environment variable interpolation
- Caching for performance

**api-client.js** (29 LOC)
- HTTP client with exponential backoff retry
- Jira/Figma API request wrapper
- Error handling and logging

**logger.js** (11 LOC)
- Colored terminal output (Chalk integration)
- Info/warn/error/success helpers
- Emoji support for visual feedback

**port-resolver.js** (13 LOC)
- Deterministic port allocation
- Hash-based offset from project name
- Multi-project port collision avoidance

**adf-parser.js** (299 LOC)
- Convert Jira ADF JSON to Markdown
- Handle lists, links, code blocks, tables
- Extract plain text summaries

**link-extractor.js** (209 LOC)
- Extract Figma URLs from task descriptions
- Find SRS references
- Parse acceptance criteria links

**config-schema.js** (124 LOC)
- YAML schema validation
- Config structure definition
- Type checking and defaults
- Migration from v1 format

## Data Maps

**stack-map.js** (166 LOC) — 15 Backend Stacks
```
Backend:
  - Laravel (PHP 7.4-8.3)
  - Symfony (PHP 8.0-8.3)
  - Django (Python 3.8-3.11)
  - FastAPI (Python 3.8-3.11)
  - Express (Node.js 16+)
  - NestJS (Node.js 16+)
  - Spring Boot (Java 11-21)
  - .NET Core (C# 8-12)
```

**infra-map.js** (122 LOC) — 13 Infrastructure Services
```
Database:
  - PostgreSQL
  - MySQL / MariaDB
  - MongoDB

Cache:
  - Redis
  - Memcached

Queue:
  - RabbitMQ
  - Kafka

Search:
  - Elasticsearch
  - Meilisearch
  - Typesense

Object Storage:
  - MinIO
```

**env-map.js** (111 LOC)
- Stack-specific environment variables
- Default values per framework
- Database connection strings
- Cache & queue configuration
- API keys and service integration

## Presets System

**presets/index.js** (77 LOC)
- Load YAML preset files
- Merge with user overrides
- 15 predefined stacks:
  - laravel-starter, laravel-api, laravel-react, laravel-vue
  - django-starter, django-react
  - fastapi-starter, fastapi-nextjs
  - express-starter, express-react
  - spring-starter, spring-react
  - dotnet-starter, dotnet-angular
  - fullstack-enterprise
  - microservice-base

Each preset includes: project structure, dependencies, config, Docker setup.

## Templates (Handlebars)

**base.hbs** — Main template with dynamic partial selection

**Partials:**
- **api-endpoint.hbs** — REST endpoint implementation
- **crud-feature.hbs** — CRUD operations
- **bug-fix.hbs** — Bug fix walkthrough
- **migration.hbs** — Database migration
- **refactor.hbs** — Code refactoring
- **integration.hbs** — Third-party integration

Template auto-selection based on:
- Task type (Story, Bug, Task)
- Acceptance criteria keywords
- Jira issue history

## Web Dashboard

**server.js** (45 LOC)
- Express.js REST API server
- CORS enabled
- Landing page route
- Default port: 3456

**routes/api.js** (100 LOC)
- `/health` — Server status
- `/config` — Current project config
- `/tasks` — Jira task list
- `/deploy` — Deploy status
- `/prompt` — Generated prompts

## Docker Support

**Dockerfile** — Multi-stage build for Node.js
**docker-compose.yml** — Optional local dev stack

**Templates per language:**
- php.Dockerfile
- node.Dockerfile
- python.Dockerfile
- java.Dockerfile
- dotnet.Dockerfile

## Configuration Format

**.devflow.yml** (per-project YAML)
```yaml
project:
  name: string
  type: string (stack type)

jira:
  host: string
  email: string
  project_key: string

git:
  branch_prefix: string
  base_branch: string

deploy:
  env_name:
    type: string (ssh|docker|custom)
    host: string

test:
  api:
    base_url: string
  e2e:
    framework: string
```

## NPM Dependencies (23 total)

**Core CLI:**
- commander (v12.1) — CLI framework
- inquirer (v9.3) — Interactive prompts
- chalk (v5.3) — Terminal colors
- ora (v8.1) — Loading spinners
- boxen (v8) — Pretty boxes
- table (v6.8) — Terminal tables

**APIs & HTTP:**
- node-fetch (v3.3) — HTTP client
- ioredis (v5.4) — Redis client (caching)
- node-ssh (v13.2) — SSH operations
- cors (v2.8) — CORS middleware

**Data & Config:**
- yaml (v2.5) — YAML parser
- conf (v13) — Persistent config
- date-fns (v4.1) — Date utilities
- handlebars (v4.7) — Template engine

**Git & Utilities:**
- simple-git (v3.27) — Git wrapper
- clipboardy (v4) — Clipboard access
- open (v10.1) — Open browser

**Web:**
- express (v4.21) — Web framework

**Dev Dependencies:**
- vitest (v2.1) — Test runner
- eslint (v9.12) — Linter
- @vitest/coverage-v8 — Coverage reporter

## Test Coverage

**Unit Test Suites:**
- JiraService tests
- FigmaService tests
- GitService tests
- ADFParser tests
- LinkExtractor tests
- ConfigLoader tests
- StackDetector tests
- TemplateSelector tests

**Test Framework:** Vitest (with coverage)

## Build & Runtime

**Entry Point:** `bin/devflow.js`
- Commander.js CLI setup
- Command registration
- Global error handling

**Runtime Requirements:**
- Node.js >= 18 LTS
- npm >= 8

**Scripts:**
```json
{
  "start": "node bin/devflow.js",
  "dev": "node --watch bin/devflow.js web",
  "test": "vitest run",
  "test:watch": "vitest watch",
  "test:coverage": "vitest run --coverage",
  "lint": "eslint src/",
  "lint:fix": "eslint src/ --fix"
}
```

## Key Integration Points

1. **Jira → Git:** Task ID → branch name, issue transition on action
2. **Jira → Figma:** Extract design URL from task, fetch and parse
3. **Jira → Prompt:** Task info → context compilation
4. **Figma → Props:** Design specs → component properties
5. **Code → Context:** Scan codebase → relevant files for prompt
6. **Task → Tests:** AC parsing → test scenarios
7. **Config → Deploy:** Environment config → SSH/Docker deployment

## Performance Optimizations

- API response caching (Redis-ready)
- Config loaded once and cached
- Figma design tree traversal optimization
- Batch Jira API requests
- Lazy loading of templates
- CLI spinner feedback during long operations

## Security Considerations

- API tokens stored in environment variables only
- SSH key validation before deployment
- Production deployment requires explicit confirmation
- No secrets logged or cached
- CORS enabled for web dashboard (configurable)
- Token validation in Jira/Figma services

## Future Extensibility

- Plugin system for custom templates
- Custom deploy strategy hooks
- Webhook integration for notifications
- GraphQL API (future)
- Desktop app wrapper (Electron)
- IDE plugins (VS Code, JetBrains)
