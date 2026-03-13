# DevFlow Multi-Stack Project Config — Design Spec

**Date**: 2026-03-13
**Status**: Approved
**Version**: 2 (revision after spec review)
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
| Config versioning | **Explicit `version` field** | Enables migration detection between schema versions |

---

## 3. Config Schema (`.devflow.yml`)

### 3.0 Schema Migration from Original Spec

This schema (version 2) replaces the original single-stack schema. Key changes:

| Original field | New location | Notes |
|---|---|---|
| `project.type` | `services.{name}.stack` | Was `"laravel"`, now per-service |
| `project.php_version` | `services.{name}.language.version` | Now generic, any language |
| `frontend.*` (top-level) | `services.{name}.*` where `role: "frontend"` | Frontend is now a service |
| `frontend.src_dir` | `services.{name}.src_dir` | Retained per frontend service |
| `frontend.component_style` | `services.{name}.component_style` | Retained per frontend service |
| `frontend.testing` | `services.{name}.test_framework` | Renamed for clarity |
| `deploy.*.commands` | `deploy.*.commands` | Retained for SSH strategy |
| `deploy.*.user`, `deploy.*.path` | `deploy.*.user`, `deploy.*.path` | Retained for SSH strategy |
| `deploy.notifications` | `deploy.notifications` | Retained |
| `git.pr_template` | `git.pr_template` | Retained |
| `git.pre_ship.*_command` | Reads from `services.{name}.*_command` | `pre_ship.services` specifies which |
| `test.api.auth.login_body` | `test.api.auth.login_body` | Retained |
| `test.api.auth.token_path` | `test.api.auth.token_path` | Retained |
| `test.e2e.browsers`, `viewport`, `auth`, etc. | All retained under `test.e2e` | Full config preserved |

### 3.1 Full Schema

```yaml
# ═══════════════════════════════════════
# .devflow.yml — DevFlow Project Config
# ═══════════════════════════════════════

version: 2                            # Schema version (enables migration detection)

# ─── Project metadata ─────────────────
project:
  name: "my-app"
  description: "E-commerce platform"
  preset: "laravel-react"             # null if custom
  structure: "monorepo"               # monorepo | multi-repo

# ─── Application services ────────────
services:
  api:
    role: "backend"                   # backend | frontend | fullstack | worker | gateway
    stack: "laravel"                  # laravel | symfony | django | fastapi | express | nestjs | spring-boot | dotnet
    language:
      name: "php"                     # php | python | javascript | typescript | java | csharp
      version: "8.3"
    framework_version: "11"
    path: "."                         # Relative path in monorepo, or "." if root
    repo: null                        # Git repo URL if multi-repo (null = same repo)
    port: 8000

    # Commands
    entry_point: "public/index.php"   # Stack-specific, see Section 3.3
    build_command: "composer install"
    dev_command: "php artisan serve"
    test_command: "php artisan test"
    lint_command: "vendor/bin/pint"
    static_analysis_command: null      # e.g., "vendor/bin/phpstan analyse"

  web:
    role: "frontend"
    stack: "react"                    # react | vue | angular | nextjs | nuxtjs | svelte
    language:
      name: "typescript"
      version: "5.5"
    framework_version: "18"
    path: "./frontend"
    repo: null
    port: 3000

    # Commands
    build_command: "npm run build"
    dev_command: "npm run dev"
    test_command: "npm run test"
    lint_command: "npm run lint"

    # Frontend-specific
    src_dir: "src"                    # Frontend source directory
    component_dir: "src/components"
    page_dir: "src/pages"
    api_dir: "src/api"
    styling: "tailwindcss"            # tailwindcss | scss | styled-components | css-modules
    state_management: "zustand"       # zustand | redux | pinia | vuex | none
    api_client: "axios"               # axios | fetch | tanstack-query | swr
    ui_library: "shadcn"              # shadcn | antd | mui | none
    component_style: "functional"     # functional | class (React only)
    test_framework: "vitest"          # vitest | jest | testing-library
    form_library: "react-hook-form"   # react-hook-form | formik | none

# ─── Infrastructure ──────────────────
infrastructure:
  database:
    engine: "postgresql"              # postgresql | mysql | mariadb | mongodb | sqlite
    version: "16"
    port: 5432
    name: "my_app_db"
  cache:
    engine: "redis"                   # redis | memcached | none
    version: "7"
    port: 6379
  queue:
    engine: "rabbitmq"                # rabbitmq | redis | sqs | kafka | none
    version: "3"
    port: 5672
    management_port: 15672
  search:
    engine: null                      # elasticsearch | meilisearch | typesense | none
  storage:
    engine: null                      # minio | localstack | none

# ─── Linked projects (multi-repo) ────
linked_projects:                      # Only used when structure: "multi-repo"
  web:
    repo: "company/my-app-web"
    local_path: "../my-app-web"
    branch: "develop"
    role: "frontend"
    infrastructure_source: true       # This linked project reads infra config from current repo

# ─── Integrations ────────────────────
jira:
  host: "https://company.atlassian.net"
  email: "dev@company.com"
  project_key: "PROJ"
  custom_fields:
    srs_link: "customfield_10001"
    figma_link: "customfield_10002"
    api_specs: "customfield_10003"

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
  pr_template: ".github/PULL_REQUEST_TEMPLATE.md"
  pre_ship:
    lint: true
    test: true
    static_analysis: false
    services: ["api"]                 # Which services to run lint/test for. Default: all

# ─── Deploy ──────────────────────────
deploy:
  # Example: Docker-based deploy
  staging:
    type: "docker"                    # ssh | docker | k8s | custom
    compose_file: "docker-compose.staging.yml"
    host: "staging.company.com"
    health_check_url: "https://staging.company.com/api/health"
    auto_rollback: true

  # Example: SSH-based deploy (retained from original spec)
  production:
    type: "ssh"
    host: "prod.company.com"
    user: "deployer"
    path: "/var/www/production"
    requires_approval: true
    commands:
      - "cd {path} && git pull origin main"
      - "composer install --no-dev --optimize-autoloader"
      - "php artisan migrate --force"
      - "php artisan config:cache"
      - "php artisan route:cache"
      - "php artisan queue:restart"
      - "sudo systemctl reload php8.2-fpm"
    rollback_commands:
      - "cd {path} && git checkout {previous_commit}"
      - "composer install --no-dev"
      - "php artisan migrate:rollback --step=1"
      - "php artisan cache:clear"
    health_check_url: "https://prod.company.com/api/health"

  # Example: Custom script deploy
  # staging-custom:
  #   type: "custom"
  #   script: "./scripts/deploy-staging.sh"
  #   rollback_script: "./scripts/rollback-staging.sh"

  notifications:
    slack:
      webhook_url: "${DEVFLOW_SLACK_WEBHOOK}"
      channel: "#deployments"
      on_success: true
      on_failure: true
    discord:
      webhook_url: "${DEVFLOW_DISCORD_WEBHOOK}"
      on_success: false
      on_failure: true

  safeguards:
    blocked_hours:
      friday: { after: "16:00" }
      saturday: "all"
      sunday: "all"
    cooldown_minutes: 30
    max_deploys_per_day: 5

# ─── Prompt generation ───────────────
prompt:
  output_dir: ".devflow/prompts"
  template: "auto"                    # auto | specific template name
  include_db_schema: true
  include_existing_code: true
  max_context_files: 10
  language: "vi"                      # vi | en
  standards:
    - "Service layer cho business logic"
    - "Repository pattern cho data access"

# ─── Testing ─────────────────────────
test:
  api:
    base_url: "http://localhost:8000"
    auth:
      type: "bearer"                  # bearer | basic | api_key | none
      login_endpoint: "/api/auth/login"
      login_body:
        email: "test@example.com"
        password: "password123"
      token_path: "data.token"
    default_format: "all"             # http | postman | jest | phpunit | all
    output_dir: ".devflow/tests"
    fixtures_dir: ".devflow/tests/fixtures"
    timeout: 10000
    auto_generate_fixtures: true
  e2e:
    framework: "playwright"           # playwright | cypress
    language: "typescript"
    base_url: "http://localhost:3000"
    api_url: "http://localhost:8000"
    output_dir: "tests/e2e"
    fixtures_dir: "tests/e2e/fixtures"
    browsers: ["chromium"]
    screenshot_on_fail: true
    video: false
    viewport:
      desktop: { width: 1440, height: 900 }
      tablet: { width: 768, height: 1024 }
      mobile: { width: 375, height: 812 }
    auth:
      login_url: "/login"
      test_user:
        email: "test@example.com"
        password: "password123"
      selectors:
        email_input: "[data-testid='email-input']"
        password_input: "[data-testid='password-input']"
        submit_button: "[data-testid='login-submit']"
```

### 3.2 Schema Validation Rules

| Field | Required | Default | Type |
|---|---|---|---|
| `version` | yes | — | `2` (literal) |
| `project.name` | yes | — | string |
| `project.description` | no | `""` | string |
| `project.preset` | no | `null` | string or null |
| `project.structure` | no | `"monorepo"` | `"monorepo"` or `"multi-repo"` |
| `services` | yes | — | object (at least 1 service) |
| `services.{name}.role` | yes | — | enum |
| `services.{name}.stack` | yes | — | enum |
| `services.{name}.language.name` | yes | — | enum |
| `services.{name}.language.version` | no | inferred from stack | string |
| `services.{name}.framework_version` | no | `"latest"` | string |
| `services.{name}.path` | no | `"."` | string |
| `services.{name}.repo` | no | `null` | string or null |
| `services.{name}.port` | no | auto-assigned | number |
| `services.{name}.build_command` | no | inferred from stack | string |
| `services.{name}.dev_command` | no | inferred from stack | string |
| `services.{name}.test_command` | no | inferred from stack | string |
| `services.{name}.lint_command` | no | inferred from stack | string |
| `infrastructure` | no | `{}` (no infra) | object |
| `infrastructure.database` | no | `null` | object or null |
| `infrastructure.database.engine` | yes (if database defined) | — | enum |
| `infrastructure.database.version` | no | latest stable | string |
| `infrastructure.database.port` | no | engine default | number |
| `infrastructure.database.name` | no | `"{project.name}_db"` | string |
| `jira` | no | `null` | object or null |
| `figma` | no | `null` | object or null |
| `git` | no | defaults applied | object |
| `deploy` | no | `{}` | object |
| `prompt` | no | defaults applied | object |
| `test` | no | `{}` | object |
| `linked_projects` | no | `{}` | object |

### 3.3 Entry point defaults per stack

| Stack | Default entry_point |
|---|---|
| `laravel` | `public/index.php` |
| `symfony` | `public/index.php` |
| `django` | `manage.py` |
| `fastapi` | `main.py` |
| `express` | `src/index.js` |
| `nestjs` | `src/main.ts` |
| `spring-boot` | `src/main/java/.../Application.java` |
| `dotnet` | `Program.cs` |

### 3.4 Environment variable naming per stack

Different stacks expect different env var names. DevFlow generates `.env` with stack-appropriate names:

| Variable | Laravel | Django | FastAPI | Spring Boot | Express |
|---|---|---|---|---|---|
| DB host | `DB_HOST` | `DATABASE_URL` | `DATABASE_URL` | `SPRING_DATASOURCE_URL` | `DB_HOST` |
| DB name | `DB_DATABASE` | (in URL) | (in URL) | (in URL) | `DB_NAME` |
| DB user | `DB_USERNAME` | (in URL) | (in URL) | (in URL) | `DB_USER` |
| DB pass | `DB_PASSWORD` | (in URL) | (in URL) | (in URL) | `DB_PASSWORD` |
| Cache | `REDIS_HOST` | `REDIS_URL` | `REDIS_URL` | `SPRING_REDIS_HOST` | `REDIS_URL` |
| Queue | `QUEUE_CONNECTION` | `CELERY_BROKER_URL` | `CELERY_BROKER_URL` | `SPRING_RABBITMQ_HOST` | `AMQP_URL` |

DevFlow generates both `DATABASE_URL` (connection string) and individual vars, so any stack works.

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

### 4.3 Preset override/merge rules

When a user customizes a preset:

1. **Changing `infrastructure.database.engine`**: version, port, and healthcheck auto-populate from `INFRA_MAP` defaults. User-specified values always take precedence.
2. **Adding a new infrastructure** (e.g., adding queue to a preset with `queue.engine: null`): version and port populated from `INFRA_MAP` defaults.
3. **Changing `services.*.stack`**: language, entry_point, build/dev/test/lint commands all re-populated from `STACK_MAP` defaults.
4. **Explicit user values always win** over preset defaults and auto-populated values.
5. **Merge order**: preset defaults → INFRA_MAP/STACK_MAP auto-fill → user overrides.

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
1. Root-level scan:
   composer.json         → Laravel / Symfony / vanilla PHP
   requirements.txt / pyproject.toml → Django / FastAPI / Flask
   package.json          → Express / NestJS / React / Vue / Next / Nuxt / Angular
   pom.xml / build.gradle → Spring Boot
   *.csproj / *.sln      → .NET
   go.mod                → Go
   Cargo.toml            → Rust

2. One-level-deep scan (monorepo detection):
   If root has multiple subdirectories with their own dependency files
   (e.g., backend/composer.json + frontend/package.json),
   create multiple service entries automatically.

3. Infrastructure detection:
   docker-compose.yml    → Parse services → detect DB / cache / queue
   Dockerfile(s)         → Detect base images

4. Platform detection:
   .git/config           → Detect remote platform (GitHub/GitLab/Bitbucket)
```

### 5.4 Version migration

When `devflow init` detects an existing `.devflow.yml` without `version` field (v1 schema from original spec), it offers automatic migration:

```
🔍 Found existing .devflow.yml (v1 schema)
? Migrate to v2 multi-stack schema? (Y/n) Y

  Migrating:
    project.type → services.api.stack
    project.php_version → services.api.language.version
    frontend.* → services.web.*
    ...

✅ Migrated to v2. Backup saved to .devflow.yml.v1.bak
```

---

## 6. Docker-compose Generation

### 6.1 Output structure

DevFlow generates:
- `docker-compose.yml` — all services + infrastructure with health checks, named volumes, networking
- `{service}/Dockerfile` — per-service Dockerfile optimized for dev mode
- `.env` — environment variables referenced by compose (stack-specific naming per Section 3.4)

### 6.2 Infrastructure image map

```javascript
const INFRA_MAP = {
  postgresql:    { image: "postgres:{v}-alpine",           port: 5432, healthcheck: "pg_isready -U {user} -d {db}" },
  mysql:         { image: "mysql:{v}",                     port: 3306, healthcheck: "mysqladmin ping -h localhost" },
  mariadb:       { image: "mariadb:{v}",                   port: 3306, healthcheck: "healthcheck.sh --connect" },
  mongodb:       { image: "mongo:{v}",                     port: 27017, healthcheck: "mongosh --eval 'db.runCommand(\"ping\")'" },
  redis:         { image: "redis:{v}-alpine",              port: 6379, healthcheck: "redis-cli ping" },
  memcached:     { image: "memcached:{v}-alpine",          port: 11211, healthcheck: "echo stats | nc localhost 11211" },
  rabbitmq:      { image: "rabbitmq:{v}-management-alpine",port: 5672, healthcheck: "rabbitmq-diagnostics -q ping" },
  elasticsearch: { image: "elasticsearch:{v}",             port: 9200, healthcheck: "curl -f localhost:9200/_cluster/health",
                   extra_env: { "discovery.type": "single-node", "xpack.security.enabled": "false" },
                   host_requirements: ["vm.max_map_count=262144 (see docs)"] },
  meilisearch:   { image: "getmeili/meilisearch:{v}",      port: 7700, healthcheck: "curl -f localhost:7700/health" },
  typesense:     { image: "typesense/typesense:{v}",       port: 8108, healthcheck: "curl -f localhost:8108/health" },
  minio:         { image: "minio/minio:latest",            port: 9000, healthcheck: "mc ready local" },

  // Companion services (auto-added when needed)
  kafka: {
    image: "confluentinc/cp-kafka:{v}",
    port: 9092,
    healthcheck: "kafka-broker-api-versions --bootstrap-server localhost:9092",
    companions: {
      zookeeper: {
        image: "confluentinc/cp-zookeeper:{v}",
        port: 2181,
        healthcheck: "echo ruok | nc localhost 2181",
        note: "Required by Kafka. Alternatively use KRaft mode for Kafka 3.3+."
      }
    }
  },
};
```

### 6.3 Stack Dockerfile + scaffold map

```javascript
const STACK_MAP = {
  // Backend
  laravel:       { base: "php:{v}-fpm-alpine",               scaffold: "composer create-project laravel/laravel",
                   entry_point: "public/index.php" },
  symfony:       { base: "php:{v}-fpm-alpine",               scaffold: "composer create-project symfony/skeleton",
                   entry_point: "public/index.php" },
  django:        { base: "python:{v}-slim",                  scaffold: "django-admin startproject",
                   entry_point: "manage.py" },
  fastapi:       { base: "python:{v}-slim",                  scaffold: "pip install fastapi uvicorn",
                   entry_point: "main.py" },
  express:       { base: "node:{v}-alpine",                  scaffold: "npx express-generator",
                   entry_point: "src/index.js" },
  nestjs:        { base: "node:{v}-alpine",                  scaffold: "npx @nestjs/cli new",
                   entry_point: "src/main.ts" },
  "spring-boot": { base: "eclipse-temurin:{v}-jdk",          scaffold: "spring init",
                   entry_point: "src/main/java/.../Application.java" },
  dotnet:        { base: "mcr.microsoft.com/dotnet/sdk:{v}", scaffold: "dotnet new webapi",
                   entry_point: "Program.cs" },
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
- Infrastructure services with companion requirements (e.g., Kafka + ZooKeeper) auto-generate all required containers

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
    infrastructure_source: true    # This project reads infra config from current repo
```

### 7.2 Resolution logic

When cross-context is needed (e.g., `devflow prompt --fullstack`):

1. Try `local_path` first (fastest)
2. If not found, check `.devflow/cache/linked/{name}` for cached clone
3. If no cache, `git clone --depth 1` into cache
4. Read linked project's `.devflow.yml` + scan codebase

### 7.3 Infrastructure sharing in multi-repo

When `infrastructure_source: true` is set on a linked project:
- The linked project does NOT define its own infrastructure
- It reads infrastructure config from the repo that defines it
- In the workspace `docker-compose.yml`, all services share the same Docker network
- Service discovery via Docker DNS: linked frontend accesses API via `http://api:{port}`, database via `database:{port}`

### 7.4 Workspace docker-compose

For multi-repo, `devflow init --workspace` generates a parent-level `docker-compose.yml`:

```
workspace/
├── my-app-api/          # Backend repo
├── my-app-web/          # Frontend repo
└── docker-compose.yml   # Generated, references both repos via build context paths
```

The workspace compose reads infrastructure from whichever repo defines it and makes it available to all services via shared Docker networking.

---

## 8. `devflow doctor`

### 8.1 Check categories

| Category | Checks |
|---|---|
| config | `.devflow.yml` exists, valid YAML, schema valid, version check (v1→v2 migration), preset matches |
| services | Path exists, dependency files found, Dockerfile valid, port available |
| infrastructure | Container running, healthy, port reachable, host requirements met (e.g., vm.max_map_count for ES) |
| docker | Docker installed, Compose installed, compose file valid, all containers healthy |
| integrations | Jira connection, Figma connection, Git platform, SSH access |
| linked | Linked repo accessible (local or remote), config valid, infrastructure_source consistent |

### 8.2 `--fix` mode

Suggests specific commands to resolve each warning. Does NOT auto-fix — only shows what to run.

---

## 9. Impact on Existing Features

### 9.1 Multi-stack aware (need per-stack implementation)

| Component | What changes |
|---|---|
| Prompt templates | `src/templates/{backend,frontend}/{stack}/` — per-stack Handlebars templates. `_base.hbs` becomes stack-aware: Output Requirements section adapts to stack conventions (PSR-12 for PHP, PEP-8 for Python, etc.) |
| Codebase scanner | Per-stack file patterns (controllers, models, routes locations differ) |
| Route/endpoint parser | Per-stack parsing logic (Laravel routes/api.php vs Django urls.py vs Spring @RequestMapping) |

### 9.2 Stack-agnostic (minimal or no changes)

| Component | Why no change |
|---|---|
| Jira integration | Tasks are stack-independent |
| Figma integration | Design specs are stack-independent |
| Git automation (`start`, `commit`, `ship`) | Branch/commit/PR mechanics are universal; reads `test_command` and `lint_command` from service config via `pre_ship.services` |
| Deploy | Docker-based deploy is stack-agnostic; SSH deploy uses configured commands |
| E2E testing | Tests frontend UI, not backend stack |
| Web dashboard | UI wrapper around service layer |

### 9.3 Extension pattern

Adding a new stack requires:
1. Preset file in `src/presets/`
2. Dockerfile template in `src/docker-templates/{stack}.Dockerfile`
3. Prompt templates in `src/templates/{role}/{stack}/`
4. Codebase scan patterns in scanner registry
5. Route parser in parser registry
6. Env var mapping in `src/utils/env-map.js`

Core logic unchanged — strategy pattern per stack.

### 9.4 Initial scope

Go and Rust are excluded from initial implementation (no presets, templates, or scanners). The `language.name` enum supports them for config purposes, but DevFlow will warn that full stack support is not yet available. They can be added later following the extension pattern in 9.3.

---

## 10. File Structure (Updated)

```
devflow/
├── bin/devflow.js
├── src/
│   ├── commands/
│   │   ├── init.js                    # Updated: multi-stack, preset, detect, v1→v2 migration
│   │   ├── doctor.js                  # Updated: multi-service checks, version check
│   │   ├── start.js                   # Retained: create branch, transition Jira (stack-agnostic)
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
│   │   └── _base.hbs                  # Stack-aware base template
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
│   │   ├── config.js                  # Updated: v2 schema validation, v1 migration
│   │   ├── env-map.js                 # NEW: per-stack env var naming
│   │   ├── logger.js
│   │   └── api-client.js
│   └── web/
├── .devflow.yml
├── docker-compose.yml
├── Dockerfile
├── package.json
└── tests/
```
