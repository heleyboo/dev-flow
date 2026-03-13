# DevFlow Multi-Stack Project Config — Design Spec

**Date**: 2026-03-13
**Status**: Approved
**Scope**: Config schema, `devflow init`, Docker generation, presets, linked projects, doctor, multi-stack impact

---

## 1. Problem Statement

DevFlow's original spec assumes a single PHP/Laravel backend project with optional frontend. Real-world teams use diverse stacks (Python, Java, .NET, Go...), various frontends (React, Vue, Angular...), multiple infrastructure services (PostgreSQL, Redis, RabbitMQ...), and both monorepo and multi-repo structures.

DevFlow needs to support:
- **Multi-stack**: Any backend + frontend combination
- **Multi-structure**: Monorepo and multi-repo
- **Docker-first**: Auto-generate `docker-compose.yml` + Dockerfiles for local dev
- **Scaffold**: Create new projects from presets or custom selection, delegating to framework CLIs
- **Existing projects**: Auto-detect stack, suggest config, fill gaps (missing Docker setup, etc.)

---

## 2. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Config approach | **Multi-service (Approach B)** — services + infrastructure in single `.devflow.yml` | Maps to docker-compose, scales for multi-service, simple for single-service |
| Scaffold strategy | **Hybrid** — delegate to framework CLIs + DevFlow overlay | Always up-to-date scaffolds, DevFlow adds config/Docker on top |
| Preset system | **Both preset + custom** — preset for quick start, custom for full control | Covers fast onboarding and power users |
| Existing project | **Detect + suggest + fill gaps** — scan, confirm, generate missing pieces | Respects existing code while adding DevFlow value |
| Multi-repo | **Linked projects** — each repo has own config, `linked_projects` for cross-context | Each repo self-contained, linking is opt-in |

---

## 3. Config Schema (`.devflow.yml`)

```yaml
# ═══════════════════════════════════════
# .devflow.yml — DevFlow Project Config
# ═══════════════════════════════════════

# ─── Project metadata ─────────────────
project:
  name: "my-app"
  description: "E-commerce platform"
  preset: "fullstack-spa"           # null if custom
  structure: "monorepo"             # monorepo | multi-repo

# ─── Application services ────────────
services:
  api:
    role: "backend"                 # backend | frontend | fullstack | worker | gateway
    stack: "laravel"                # laravel | symfony | django | fastapi | express | nestjs | spring-boot | dotnet
    language:
      name: "php"                   # php | python | javascript | typescript | java | csharp | go | rust
      version: "8.3"
    framework_version: "11"
    path: "."                       # Relative path in monorepo, or "." if root
    repo: null                      # Git repo URL if multi-repo (null = same repo)
    port: 8000
    entry_point: "public/index.php"
    build_command: "composer install"
    dev_command: "php artisan serve"
    test_command: "php artisan test"
    lint_command: "vendor/bin/pint"

  web:
    role: "frontend"
    stack: "react"                  # react | vue | angular | nextjs | nuxtjs | svelte
    language:
      name: "typescript"
      version: "5.5"
    framework_version: "18"
    path: "./frontend"
    repo: null
    port: 3000
    build_command: "npm run build"
    dev_command: "npm run dev"
    test_command: "npm run test"
    lint_command: "npm run lint"
    styling: "tailwindcss"          # tailwindcss | scss | styled-components | css-modules
    state_management: "zustand"     # zustand | redux | pinia | vuex | none
    api_client: "axios"             # axios | fetch | tanstack-query | swr
    ui_library: "shadcn"            # shadcn | antd | mui | none
    component_dir: "src/components"
    page_dir: "src/pages"
    api_dir: "src/api"

# ─── Infrastructure ──────────────────
infrastructure:
  database:
    engine: "postgresql"            # postgresql | mysql | mariadb | mongodb | sqlite
    version: "16"
    port: 5432
    name: "my_app_db"
  cache:
    engine: "redis"                 # redis | memcached | none
    version: "7"
    port: 6379
  queue:
    engine: "rabbitmq"              # rabbitmq | redis | sqs | kafka | none
    version: "3"
    port: 5672
    management_port: 15672
  search:
    engine: null                    # elasticsearch | meilisearch | typesense | none
  storage:
    engine: null                    # minio | localstack | none

# ─── Linked projects (multi-repo) ────
linked_projects:                    # Only used when structure: "multi-repo"
  web:
    repo: "company/my-app-web"
    local_path: "../my-app-web"
    branch: "develop"
    role: "frontend"

# ─── Integrations ────────────────────
jira:
  host: "https://company.atlassian.net"
  email: "dev@company.com"
  project_key: "PROJ"
  custom_fields:
    figma_link: "customfield_10002"

figma:
  default_project: "figma-project-id"

git:
  branch_prefix: "feature"
  branch_format: "{prefix}/{jira_id}-{short_desc}"
  commit_format: "[{jira_id}] {type}: {message}"
  remote: "origin"
  base_branch: "develop"
  auto_push: true
  create_pr: true
  pre_ship:
    lint: true
    test: true

# ─── Deploy ──────────────────────────
deploy:
  staging:
    type: "docker"                  # ssh | docker | k8s | custom
    compose_file: "docker-compose.staging.yml"
    host: "staging.company.com"
    health_check_url: "https://staging.company.com/api/health"
  production:
    type: "docker"
    requires_approval: true
    host: "prod.company.com"

# ─── Prompt generation ───────────────
prompt:
  output_dir: ".devflow/prompts"
  include_db_schema: true
  include_existing_code: true
  max_context_files: 10
  language: "vi"
  standards:
    - "Service layer cho business logic"
    - "Repository pattern cho data access"

# ─── Testing ─────────────────────────
test:
  api:
    base_url: "http://localhost:8000"
    auth:
      type: "bearer"
      login_endpoint: "/api/auth/login"
    output_dir: ".devflow/tests"
  e2e:
    framework: "playwright"
    base_url: "http://localhost:3000"
    output_dir: "tests/e2e"
```

---

## 4. Presets System

### 4.1 Preset file format

Each preset is a YAML file in `src/presets/`:

```yaml
# src/presets/laravel-react.yml
name: "laravel-react"
description: "Laravel API + React SPA + PostgreSQL + Redis"
services:
  api:
    role: "backend"
    stack: "laravel"
    language: { name: "php", version: "8.3" }
    framework_version: "11"
    port: 8000
    scaffold:
      command: "composer create-project laravel/laravel {path}"
      docker_image: "composer:latest"
  web:
    role: "frontend"
    stack: "react"
    language: { name: "typescript", version: "5.5" }
    port: 3000
    styling: "tailwindcss"
    ui_library: "shadcn"
    scaffold:
      command: "npx create-vite {path} --template react-ts"
      docker_image: "node:20-alpine"
infrastructure:
  database: { engine: "postgresql", version: "16", port: 5432 }
  cache: { engine: "redis", version: "7", port: 6379 }
  queue: { engine: null }
  search: { engine: null }
  storage: { engine: null }
```

### 4.2 Preset catalog

**Backend Only:**
| Preset | Stack |
|---|---|
| `laravel-starter` | Laravel + MySQL + Redis |
| `laravel-api` | Laravel API-only + PostgreSQL + Redis |
| `django-starter` | Django + PostgreSQL + Redis |
| `fastapi-starter` | FastAPI + PostgreSQL + Redis |
| `express-starter` | Express.js + MongoDB + Redis |
| `spring-starter` | Spring Boot + PostgreSQL + Redis |
| `dotnet-starter` | .NET Web API + PostgreSQL + Redis |

**Fullstack:**
| Preset | Stack |
|---|---|
| `laravel-react` | Laravel + React + PostgreSQL + Redis |
| `laravel-vue` | Laravel + Vue + MySQL + Redis |
| `django-react` | Django + React + PostgreSQL + Redis |
| `fastapi-nextjs` | FastAPI + Next.js + PostgreSQL + Redis |
| `spring-react` | Spring Boot + React + PostgreSQL + Redis |
| `express-react` | Express + React + MongoDB + Redis |
| `dotnet-angular` | .NET + Angular + PostgreSQL + Redis |

**Advanced:**
| Preset | Stack |
|---|---|
| `microservice-base` | FastAPI + RabbitMQ + PostgreSQL + Redis + MinIO |
| `fullstack-enterprise` | Laravel + React + PostgreSQL + Redis + RabbitMQ + Elasticsearch + MinIO |

---

## 5. `devflow init` — Flows

### 5.1 New project flow

```
devflow init

Step 1: Detect empty directory → confirm new project
Step 2: Project name + description
Step 3: Setup mode → Preset or Custom
Step 4a (Preset): Select preset → optionally customize (swap DB, add queue, etc.)
Step 4b (Custom): Pick backend → frontend → database → cache → queue → search → storage
Step 5: Structure → monorepo (set paths) or multi-repo
Step 6: Integrations → Jira, Figma, Git platform (all optional)
Step 7: Generate:
  - Directory structure
  - docker-compose.yml + Dockerfiles
  - Scaffold via Docker (delegate to framework CLIs)
  - .devflow.yml + .env + .gitignore
  - Start containers + health check
```

### 5.2 Existing project flow

```
devflow init

Step 1: Scan directory → detect stack, framework, infrastructure
Step 2: Present findings → user confirms/corrects
Step 3: Detect gaps → missing Docker setup, missing .env.example, etc.
Step 4: Offer to fill gaps → generate missing files
Step 5: Write .devflow.yml → does NOT overwrite existing code
```

### 5.3 Project detector scan order

```
1. composer.json         → Laravel / Symfony / vanilla PHP
2. requirements.txt / pyproject.toml → Django / FastAPI / Flask
3. package.json          → Express / NestJS / React / Vue / Next / Nuxt / Angular
4. pom.xml / build.gradle → Spring Boot
5. *.csproj / *.sln      → .NET
6. go.mod                → Go
7. Cargo.toml            → Rust
8. docker-compose.yml    → Parse services → detect DB / cache / queue
9. Dockerfile(s)         → Detect base images
10. .git/config          → Detect remote platform
```

---

## 6. Docker-compose Generation

### 6.1 Output structure

DevFlow generates:
- `docker-compose.yml` — all services + infrastructure with health checks, named volumes, networking
- `{service}/Dockerfile` — per-service Dockerfile optimized for dev mode
- `.env` — environment variables referenced by compose

### 6.2 Infrastructure image map

```javascript
const INFRA_MAP = {
  postgresql:    { image: "postgres:{v}-alpine",           healthcheck: "pg_isready -U {user} -d {db}" },
  mysql:         { image: "mysql:{v}",                     healthcheck: "mysqladmin ping -h localhost" },
  mariadb:       { image: "mariadb:{v}",                   healthcheck: "healthcheck.sh --connect" },
  mongodb:       { image: "mongo:{v}",                     healthcheck: "mongosh --eval 'db.runCommand(\"ping\")'"},
  redis:         { image: "redis:{v}-alpine",              healthcheck: "redis-cli ping" },
  memcached:     { image: "memcached:{v}-alpine",          healthcheck: "echo stats | nc localhost 11211" },
  rabbitmq:      { image: "rabbitmq:{v}-management-alpine",healthcheck: "rabbitmq-diagnostics -q ping" },
  kafka:         { image: "confluentinc/cp-kafka:{v}",     healthcheck: "kafka-broker-api-versions --bootstrap-server localhost:9092" },
  elasticsearch: { image: "elasticsearch:{v}",             healthcheck: "curl -f localhost:9200/_cluster/health" },
  meilisearch:   { image: "getmeili/meilisearch:{v}",      healthcheck: "curl -f localhost:7700/health" },
  typesense:     { image: "typesense/typesense:{v}",       healthcheck: "curl -f localhost:8108/health" },
  minio:         { image: "minio/minio:latest",            healthcheck: "mc ready local" },
};
```

### 6.3 Stack Dockerfile + scaffold map

```javascript
const STACK_MAP = {
  // Backend
  laravel:       { base: "php:{v}-fpm-alpine",               scaffold: "composer create-project laravel/laravel" },
  symfony:       { base: "php:{v}-fpm-alpine",               scaffold: "composer create-project symfony/skeleton" },
  django:        { base: "python:{v}-slim",                  scaffold: "django-admin startproject" },
  fastapi:       { base: "python:{v}-slim",                  scaffold: "pip install fastapi uvicorn" },
  express:       { base: "node:{v}-alpine",                  scaffold: "npx express-generator" },
  nestjs:        { base: "node:{v}-alpine",                  scaffold: "npx @nestjs/cli new" },
  "spring-boot": { base: "eclipse-temurin:{v}-jdk",          scaffold: "spring init" },
  dotnet:        { base: "mcr.microsoft.com/dotnet/sdk:{v}", scaffold: "dotnet new webapi" },
  // Frontend
  react:         { base: "node:{v}-alpine",                  scaffold: "npx create-vite --template react-ts" },
  vue:           { base: "node:{v}-alpine",                  scaffold: "npx create-vue" },
  angular:       { base: "node:{v}-alpine",                  scaffold: "npx @angular/cli new" },
  nextjs:        { base: "node:{v}-alpine",                  scaffold: "npx create-next-app --typescript" },
  nuxtjs:        { base: "node:{v}-alpine",                  scaffold: "npx nuxi init" },
  svelte:        { base: "node:{v}-alpine",                  scaffold: "npx create-svelte" },
};
```

### 6.4 Key principles

- All scaffolding runs inside Docker containers (no host dependencies except Docker)
- Dev mode: source code mounted as volumes, hot-reload enabled
- Named volumes for dependencies (`vendor/`, `node_modules/`) to avoid host conflicts
- Health checks on all infrastructure services
- `depends_on` with `condition: service_healthy` for proper startup order

---

## 7. Linked Projects (Multi-repo)

### 7.1 Config

Each repo has its own `.devflow.yml` with a `linked_projects` section:

```yaml
linked_projects:
  web:
    repo: "company/my-app-web"     # Git repo URL
    local_path: "../my-app-web"    # Convention-based local path
    branch: "develop"
    role: "frontend"
```

### 7.2 Resolution logic

When cross-context is needed (e.g., `devflow prompt --fullstack`):

1. Try `local_path` first (fastest)
2. If not found, check `.devflow/cache/linked/{name}` for cached clone
3. If no cache, `git clone --depth 1` into cache
4. Read linked project's `.devflow.yml` + scan codebase

### 7.3 Workspace docker-compose

For multi-repo, `devflow init --workspace` generates a parent-level `docker-compose.yml`:

```
workspace/
├── my-app-api/          # Backend repo
├── my-app-web/          # Frontend repo
└── docker-compose.yml   # Generated, references both repos
```

Infrastructure config only needs to be defined in one repo (typically backend); linked repo references it.

---

## 8. `devflow doctor`

### 8.1 Check categories

| Category | Checks |
|---|---|
| config | `.devflow.yml` exists, valid YAML, schema valid, preset matches |
| services | Path exists, dependency files found, Dockerfile valid, port available |
| infrastructure | Container running, healthy, port reachable |
| docker | Docker installed, Compose installed, compose file valid, all containers healthy |
| integrations | Jira connection, Figma connection, Git platform, SSH access |
| linked | Linked repo accessible (local or remote), config valid |

### 8.2 `--fix` mode

Suggests specific commands to resolve each warning. Does NOT auto-fix — only shows what to run.

---

## 9. Impact on Existing Features

### 9.1 Multi-stack aware (need per-stack implementation)

| Component | What changes |
|---|---|
| Prompt templates | `src/templates/{backend,frontend}/{stack}/` — per-stack Handlebars templates |
| Codebase scanner | Per-stack file patterns (controllers, models, routes locations differ) |
| Route/endpoint parser | Per-stack parsing logic (Laravel routes/api.php vs Django urls.py vs Spring @RequestMapping) |

### 9.2 Stack-agnostic (minimal or no changes)

| Component | Why no change |
|---|---|
| Jira integration | Tasks are stack-independent |
| Figma integration | Design specs are stack-independent |
| Git automation | Branch/commit/PR mechanics are universal; reads `test_command` and `lint_command` from service config |
| Deploy | Docker-based deploy is stack-agnostic |
| E2E testing | Tests frontend UI, not backend stack |
| Web dashboard | UI wrapper around service layer |

### 9.3 Extension pattern

Adding a new stack requires:
1. Preset file in `src/presets/`
2. Dockerfile template in `src/docker-templates/{stack}.Dockerfile`
3. Prompt templates in `src/templates/{role}/{stack}/`
4. Codebase scan patterns in scanner registry
5. Route parser in parser registry

Core logic unchanged — strategy pattern per stack.

---

## 10. File Structure (Updated)

```
devflow/
├── bin/devflow.js
├── src/
│   ├── commands/
│   │   ├── init.js                    # Updated: multi-stack, preset, detect
│   │   ├── doctor.js                  # Updated: multi-service checks
│   │   ├── task.js
│   │   ├── figma.js
│   │   ├── prompt.js
│   │   ├── ship.js
│   │   ├── deploy.js
│   │   ├── test-api.js
│   │   └── test-e2e.js
│   ├── services/
│   │   ├── jira.service.js
│   │   ├── figma.service.js
│   │   ├── git.service.js
│   │   ├── deploy.service.js
│   │   ├── prompt.service.js
│   │   ├── api-test.service.js
│   │   ├── e2e-test.service.js
│   │   ├── docker.service.js          # NEW: docker-compose + Dockerfile generation
│   │   ├── scaffold.service.js        # NEW: project scaffolding via Docker
│   │   ├── detector.service.js        # NEW: existing project detection
│   │   └── preset.service.js          # NEW: preset loading and applying
│   ├── presets/                        # NEW
│   │   ├── laravel-starter.yml
│   │   ├── laravel-react.yml
│   │   ├── django-react.yml
│   │   ├── fastapi-nextjs.yml
│   │   ├── ...
│   │   └── index.js                   # Preset registry
│   ├── docker-templates/              # NEW
│   │   ├── php.Dockerfile
│   │   ├── python.Dockerfile
│   │   ├── node.Dockerfile
│   │   ├── java.Dockerfile
│   │   ├── dotnet.Dockerfile
│   │   └── compose-fragments/         # Composable docker-compose pieces
│   ├── templates/                     # RESTRUCTURED
│   │   ├── backend/
│   │   │   ├── laravel/
│   │   │   ├── django/
│   │   │   ├── fastapi/
│   │   │   ├── express/
│   │   │   ├── spring-boot/
│   │   │   └── _shared/
│   │   ├── frontend/
│   │   │   ├── react/
│   │   │   ├── vue/
│   │   │   ├── angular/
│   │   │   └── _shared/
│   │   └── _base.hbs
│   ├── scanners/                      # NEW: per-stack codebase scanners
│   │   ├── laravel.scanner.js
│   │   ├── django.scanner.js
│   │   ├── fastapi.scanner.js
│   │   ├── express.scanner.js
│   │   ├── spring.scanner.js
│   │   ├── react.scanner.js
│   │   ├── vue.scanner.js
│   │   └── index.js                   # Scanner registry
│   ├── parsers/                       # NEW: per-stack route parsers
│   │   ├── laravel.parser.js
│   │   ├── django.parser.js
│   │   ├── fastapi.parser.js
│   │   ├── express.parser.js
│   │   ├── spring.parser.js
│   │   └── index.js                   # Parser registry
│   ├── generators/
│   ├── utils/
│   │   ├── config.js
│   │   ├── logger.js
│   │   └── api-client.js
│   └── web/
├── .devflow.yml
├── docker-compose.yml
├── Dockerfile
├── package.json
└── tests/
```
