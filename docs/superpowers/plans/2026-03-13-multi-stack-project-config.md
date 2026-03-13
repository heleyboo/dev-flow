# Multi-Stack Project Config Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable DevFlow to support any backend+frontend stack combination with Docker-first local dev, presets, project detection, and multi-repo linking.

**Architecture:** Strategy pattern per stack. Core data maps (`STACK_MAP`, `INFRA_MAP`, `ENV_MAP`) drive all generation. Services are composed: preset → config → docker → scaffold. The `devflow init` command orchestrates the full flow with interactive prompts.

**Tech Stack:** Node.js ES modules, YAML, Inquirer.js prompts, Handlebars templates, Vitest tests.

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `src/maps/stack-map.js` | Stack defaults: base images, scaffold commands, entry points, default commands |
| `src/maps/infra-map.js` | Infrastructure defaults: images, ports, healthchecks, companions |
| `src/maps/env-map.js` | Per-stack environment variable naming |
| `src/schemas/config-schema.js` | V2 schema validation rules + v1→v2 migration logic |
| `src/services/preset.service.js` | Load preset YAML files, merge with user overrides |
| `src/services/detector.service.js` | Scan existing project directories to detect stack/infra |
| `src/services/docker.service.js` | Generate docker-compose.yml + per-service Dockerfiles |
| `src/services/scaffold.service.js` | Run framework CLI scaffolds inside Docker containers |
| `src/presets/index.js` | Preset registry: list, load by name |
| `src/presets/laravel-starter.yml` | Preset: Laravel + MySQL + Redis |
| `src/presets/laravel-api.yml` | Preset: Laravel API-only + PostgreSQL + Redis |
| `src/presets/laravel-react.yml` | Preset: Laravel + React + PostgreSQL + Redis |
| `src/presets/laravel-vue.yml` | Preset: Laravel + Vue + MySQL + Redis |
| `src/presets/django-starter.yml` | Preset: Django + PostgreSQL + Redis |
| `src/presets/django-react.yml` | Preset: Django + React + PostgreSQL + Redis |
| `src/presets/fastapi-starter.yml` | Preset: FastAPI + PostgreSQL + Redis |
| `src/presets/fastapi-nextjs.yml` | Preset: FastAPI + Next.js + PostgreSQL + Redis |
| `src/presets/express-starter.yml` | Preset: Express + MongoDB + Redis |
| `src/presets/express-react.yml` | Preset: Express + React + MongoDB + Redis |
| `src/presets/spring-starter.yml` | Preset: Spring Boot + PostgreSQL + Redis |
| `src/presets/spring-react.yml` | Preset: Spring Boot + React + PostgreSQL + Redis |
| `src/presets/dotnet-starter.yml` | Preset: .NET + PostgreSQL + Redis |
| `src/presets/dotnet-angular.yml` | Preset: .NET + Angular + PostgreSQL + Redis |
| `src/presets/microservice-base.yml` | Preset: FastAPI + RabbitMQ + PostgreSQL + Redis + MinIO |
| `src/presets/fullstack-enterprise.yml` | Preset: Laravel + React + PostgreSQL + Redis + RabbitMQ + ES + MinIO |
| `src/docker-templates/php.Dockerfile` | PHP/Laravel/Symfony dev Dockerfile |
| `src/docker-templates/python.Dockerfile` | Python/Django/FastAPI dev Dockerfile |
| `src/docker-templates/node.Dockerfile` | Node.js/Express/NestJS/React/Vue/Angular dev Dockerfile |
| `src/docker-templates/java.Dockerfile` | Java/Spring Boot dev Dockerfile |
| `src/docker-templates/dotnet.Dockerfile` | .NET dev Dockerfile |
| `tests/unit/stack-map.test.js` | Tests for stack map |
| `tests/unit/infra-map.test.js` | Tests for infra map |
| `tests/unit/env-map.test.js` | Tests for env map |
| `tests/unit/config-schema.test.js` | Tests for v2 schema validation + v1 migration |
| `tests/unit/preset.service.test.js` | Tests for preset loading + merging |
| `tests/unit/detector.service.test.js` | Tests for project detection |
| `tests/unit/docker.service.test.js` | Tests for docker-compose + Dockerfile generation |
| `tests/unit/scaffold.service.test.js` | Tests for scaffold service |
| `tests/unit/init.test.js` | Tests for init command flows |
| `tests/unit/doctor.test.js` | Tests for doctor checks |
| `src/utils/port-resolver.js` | Project-scoped port offset computation |
| `src/services/linked.service.js` | Linked project resolution, workspace compose generation |
| `tests/unit/port-resolver.test.js` | Tests for port resolver |
| `tests/unit/linked.service.test.js` | Tests for linked projects service |

### Modified Files

| File | What Changes |
|---|---|
| `src/utils/config.js` | Add `validateConfig()`, `migrateV1toV2()`, use schema module |
| `src/commands/init.js` | Full rewrite: multi-stack wizard with preset/custom/existing flows, .gitignore update |
| `src/commands/doctor.js` | Full rewrite: 6 check categories, `--fix` mode |
| `bin/devflow.js` | Update description from "PHP" to "multi-stack", add `init --workspace`, `doctor --fix` |

---

## Chunk 1: Data Maps + Config Schema

### Task 1: Stack Map

**Files:**
- Create: `src/maps/stack-map.js`
- Test: `tests/unit/stack-map.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/stack-map.test.js
import { describe, it, expect } from 'vitest';
import { STACK_MAP, getStackDefaults } from '../../src/maps/stack-map.js';

describe('STACK_MAP', () => {
  it('has entries for all supported backend stacks', () => {
    const backends = ['laravel', 'symfony', 'django', 'fastapi', 'express', 'nestjs', 'spring-boot', 'dotnet'];
    for (const stack of backends) {
      expect(STACK_MAP[stack]).toBeDefined();
      expect(STACK_MAP[stack].base).toBeDefined();
      expect(STACK_MAP[stack].scaffold).toBeDefined();
      expect(STACK_MAP[stack].entry_point).toBeDefined();
    }
  });

  it('has entries for all supported frontend stacks', () => {
    const frontends = ['react', 'vue', 'angular', 'nextjs', 'nuxtjs', 'svelte'];
    for (const stack of frontends) {
      expect(STACK_MAP[stack]).toBeDefined();
      expect(STACK_MAP[stack].base).toBeDefined();
      expect(STACK_MAP[stack].scaffold).toBeDefined();
    }
  });

  it('provides language info per stack', () => {
    expect(STACK_MAP.laravel.language).toEqual({ name: 'php', version: '8.3' });
    expect(STACK_MAP.django.language).toEqual({ name: 'python', version: '3.12' });
    expect(STACK_MAP.express.language).toEqual({ name: 'javascript', version: '20' });
    expect(STACK_MAP['spring-boot'].language).toEqual({ name: 'java', version: '21' });
    expect(STACK_MAP.dotnet.language).toEqual({ name: 'csharp', version: '8.0' });
  });

  it('provides default commands per stack', () => {
    const laravel = STACK_MAP.laravel;
    expect(laravel.build_command).toBe('composer install');
    expect(laravel.dev_command).toBe('php artisan serve');
    expect(laravel.test_command).toBe('php artisan test');
    expect(laravel.lint_command).toBe('vendor/bin/pint');
  });
});

describe('getStackDefaults', () => {
  it('returns defaults for known stack', () => {
    const defaults = getStackDefaults('laravel');
    expect(defaults.language.name).toBe('php');
    expect(defaults.entry_point).toBe('public/index.php');
  });

  it('interpolates version into base image', () => {
    const defaults = getStackDefaults('django', '3.11');
    expect(defaults.base).toBe('python:3.11-slim');
  });

  it('returns null for unknown stack', () => {
    expect(getStackDefaults('cobol')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/stack-map.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/maps/stack-map.js

export const STACK_MAP = {
  // Backend stacks
  laravel: {
    base: 'php:{v}-fpm-alpine',
    scaffold: 'composer create-project laravel/laravel {path}',
    scaffold_image: 'composer:latest',
    entry_point: 'public/index.php',
    language: { name: 'php', version: '8.3' },
    build_command: 'composer install',
    dev_command: 'php artisan serve',
    test_command: 'php artisan test',
    lint_command: 'vendor/bin/pint',
  },
  symfony: {
    base: 'php:{v}-fpm-alpine',
    scaffold: 'composer create-project symfony/skeleton {path}',
    scaffold_image: 'composer:latest',
    entry_point: 'public/index.php',
    language: { name: 'php', version: '8.3' },
    build_command: 'composer install',
    dev_command: 'symfony server:start',
    test_command: 'php bin/phpunit',
    lint_command: 'vendor/bin/php-cs-fixer fix --dry-run',
  },
  django: {
    base: 'python:{v}-slim',
    scaffold: 'django-admin startproject {name} {path}',
    scaffold_image: 'python:{v}-slim',
    entry_point: 'manage.py',
    language: { name: 'python', version: '3.12' },
    build_command: 'pip install -r requirements.txt',
    dev_command: 'python manage.py runserver 0.0.0.0:8000',
    test_command: 'python manage.py test',
    lint_command: 'ruff check .',
  },
  fastapi: {
    base: 'python:{v}-slim',
    scaffold: 'pip install fastapi uvicorn',
    scaffold_image: 'python:{v}-slim',
    entry_point: 'main.py',
    language: { name: 'python', version: '3.12' },
    build_command: 'pip install -r requirements.txt',
    dev_command: 'uvicorn main:app --host 0.0.0.0 --reload',
    test_command: 'pytest',
    lint_command: 'ruff check .',
  },
  express: {
    base: 'node:{v}-alpine',
    scaffold: 'npx express-generator {path}',
    scaffold_image: 'node:{v}-alpine',
    entry_point: 'src/index.js',
    language: { name: 'javascript', version: '20' },
    build_command: 'npm install',
    dev_command: 'npm run dev',
    test_command: 'npm test',
    lint_command: 'npm run lint',
  },
  nestjs: {
    base: 'node:{v}-alpine',
    scaffold: 'npx @nestjs/cli new {path}',
    scaffold_image: 'node:{v}-alpine',
    entry_point: 'src/main.ts',
    language: { name: 'typescript', version: '20' },
    build_command: 'npm install',
    dev_command: 'npm run start:dev',
    test_command: 'npm run test',
    lint_command: 'npm run lint',
  },
  'spring-boot': {
    base: 'eclipse-temurin:{v}-jdk',
    scaffold: 'spring init --dependencies=web,data-jpa --type=maven-project {path}',
    scaffold_image: 'eclipse-temurin:{v}-jdk',
    entry_point: 'auto-detect',
    language: { name: 'java', version: '21' },
    build_command: './mvnw install',
    dev_command: './mvnw spring-boot:run',
    test_command: './mvnw test',
    lint_command: './mvnw checkstyle:check',
  },
  dotnet: {
    base: 'mcr.microsoft.com/dotnet/sdk:{v}',
    scaffold: 'dotnet new webapi -o {path}',
    scaffold_image: 'mcr.microsoft.com/dotnet/sdk:{v}',
    entry_point: 'Program.cs',
    language: { name: 'csharp', version: '8.0' },
    build_command: 'dotnet restore',
    dev_command: 'dotnet watch run',
    test_command: 'dotnet test',
    lint_command: 'dotnet format --verify-no-changes',
  },

  // Frontend stacks
  react: {
    base: 'node:{v}-alpine',
    scaffold: 'npx create-vite {path} --template react-ts',
    scaffold_image: 'node:{v}-alpine',
    language: { name: 'typescript', version: '5.5' },
    build_command: 'npm run build',
    dev_command: 'npm run dev',
    test_command: 'npm run test',
    lint_command: 'npm run lint',
  },
  vue: {
    base: 'node:{v}-alpine',
    scaffold: 'npx create-vue {path}',
    scaffold_image: 'node:{v}-alpine',
    language: { name: 'typescript', version: '5.5' },
    build_command: 'npm run build',
    dev_command: 'npm run dev',
    test_command: 'npm run test',
    lint_command: 'npm run lint',
  },
  angular: {
    base: 'node:{v}-alpine',
    scaffold: 'npx @angular/cli new {path}',
    scaffold_image: 'node:{v}-alpine',
    language: { name: 'typescript', version: '5.5' },
    build_command: 'npm run build',
    dev_command: 'ng serve',
    test_command: 'ng test',
    lint_command: 'ng lint',
  },
  nextjs: {
    base: 'node:{v}-alpine',
    scaffold: 'npx create-next-app {path} --typescript',
    scaffold_image: 'node:{v}-alpine',
    language: { name: 'typescript', version: '5.5' },
    build_command: 'npm run build',
    dev_command: 'npm run dev',
    test_command: 'npm run test',
    lint_command: 'npm run lint',
  },
  nuxtjs: {
    base: 'node:{v}-alpine',
    scaffold: 'npx nuxi init {path}',
    scaffold_image: 'node:{v}-alpine',
    language: { name: 'typescript', version: '5.5' },
    build_command: 'npm run build',
    dev_command: 'npm run dev',
    test_command: 'npm run test',
    lint_command: 'npm run lint',
  },
  svelte: {
    base: 'node:{v}-alpine',
    scaffold: 'npx create-svelte {path}',
    scaffold_image: 'node:{v}-alpine',
    language: { name: 'typescript', version: '5.5' },
    build_command: 'npm run build',
    dev_command: 'npm run dev',
    test_command: 'npm run test',
    lint_command: 'npm run lint',
  },
};

/**
 * Get stack defaults with version interpolation.
 * @param {string} stack - Stack name (e.g., 'laravel', 'django')
 * @param {string} [version] - Override language version for image interpolation
 * @returns {object|null} Stack defaults with interpolated base image, or null if unknown
 */
export function getStackDefaults(stack, version) {
  const entry = STACK_MAP[stack];
  if (!entry) return null;

  const v = version || entry.language.version;
  return {
    ...entry,
    base: entry.base.replace('{v}', v),
    scaffold: entry.scaffold.replace('{v}', v),
    scaffold_image: entry.scaffold_image.replace('{v}', v),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/stack-map.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/maps/stack-map.js tests/unit/stack-map.test.js
git commit -m "feat: add STACK_MAP with defaults for all supported stacks"
```

---

### Task 2: Infrastructure Map

**Files:**
- Create: `src/maps/infra-map.js`
- Test: `tests/unit/infra-map.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/infra-map.test.js
import { describe, it, expect } from 'vitest';
import { INFRA_MAP, getInfraDefaults } from '../../src/maps/infra-map.js';

describe('INFRA_MAP', () => {
  it('has entries for all supported engines', () => {
    const engines = [
      'postgresql', 'mysql', 'mariadb', 'mongodb',
      'redis', 'memcached',
      'rabbitmq', 'kafka',
      'elasticsearch', 'meilisearch', 'typesense',
      'minio',
    ];
    for (const engine of engines) {
      expect(INFRA_MAP[engine]).toBeDefined();
      expect(INFRA_MAP[engine].image).toBeDefined();
      expect(INFRA_MAP[engine].port).toBeTypeOf('number');
      expect(INFRA_MAP[engine].healthcheck).toBeDefined();
    }
  });

  it('kafka has zookeeper companion', () => {
    expect(INFRA_MAP.kafka.companions).toBeDefined();
    expect(INFRA_MAP.kafka.companions.zookeeper).toBeDefined();
    expect(INFRA_MAP.kafka.companions.zookeeper.port).toBe(2181);
  });

  it('elasticsearch has extra_env and host_requirements', () => {
    expect(INFRA_MAP.elasticsearch.extra_env).toBeDefined();
    expect(INFRA_MAP.elasticsearch.host_requirements).toBeDefined();
  });
});

describe('getInfraDefaults', () => {
  it('interpolates version into image', () => {
    const defaults = getInfraDefaults('postgresql', '16');
    expect(defaults.image).toBe('postgres:16-alpine');
  });

  it('uses default version when none specified', () => {
    const defaults = getInfraDefaults('redis');
    expect(defaults.image).toContain('redis:');
    expect(defaults.image).toContain('-alpine');
  });

  it('returns null for unknown engine', () => {
    expect(getInfraDefaults('oracle')).toBeNull();
  });

  it('includes companions with interpolated versions for kafka', () => {
    const defaults = getInfraDefaults('kafka', '7.5');
    expect(defaults.companions.zookeeper.image).toBe('confluentinc/cp-zookeeper:7.5');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/infra-map.test.js`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/maps/infra-map.js

export const INFRA_MAP = {
  postgresql: {
    image: 'postgres:{v}-alpine',
    port: 5432,
    default_version: '16',
    healthcheck: 'pg_isready -U {user} -d {db}',
    env: { POSTGRES_USER: '{user}', POSTGRES_PASSWORD: '{password}', POSTGRES_DB: '{db}' },
  },
  mysql: {
    image: 'mysql:{v}',
    port: 3306,
    default_version: '8.0',
    healthcheck: 'mysqladmin ping -h localhost',
    env: { MYSQL_ROOT_PASSWORD: '{password}', MYSQL_DATABASE: '{db}', MYSQL_USER: '{user}', MYSQL_PASSWORD: '{password}' },
  },
  mariadb: {
    image: 'mariadb:{v}',
    port: 3306,
    default_version: '11',
    healthcheck: 'healthcheck.sh --connect',
    env: { MARIADB_ROOT_PASSWORD: '{password}', MARIADB_DATABASE: '{db}', MARIADB_USER: '{user}', MARIADB_PASSWORD: '{password}' },
  },
  mongodb: {
    image: 'mongo:{v}',
    port: 27017,
    default_version: '7',
    healthcheck: "mongosh --eval 'db.runCommand(\"ping\")'",
    env: { MONGO_INITDB_ROOT_USERNAME: '{user}', MONGO_INITDB_ROOT_PASSWORD: '{password}' },
  },
  redis: {
    image: 'redis:{v}-alpine',
    port: 6379,
    default_version: '7',
    healthcheck: 'redis-cli ping',
    env: {},
  },
  memcached: {
    image: 'memcached:{v}-alpine',
    port: 11211,
    default_version: '1.6',
    healthcheck: 'echo stats | nc localhost 11211',
    env: {},
  },
  rabbitmq: {
    image: 'rabbitmq:{v}-management-alpine',
    port: 5672,
    default_version: '3',
    healthcheck: 'rabbitmq-diagnostics -q ping',
    env: { RABBITMQ_DEFAULT_USER: '{user}', RABBITMQ_DEFAULT_PASS: '{password}' },
    extra_ports: [15672],
  },
  kafka: {
    image: 'confluentinc/cp-kafka:{v}',
    port: 9092,
    default_version: '7.5',
    healthcheck: 'kafka-broker-api-versions --bootstrap-server localhost:9092',
    env: {},
    companions: {
      zookeeper: {
        image: 'confluentinc/cp-zookeeper:{v}',
        port: 2181,
        healthcheck: 'echo ruok | nc localhost 2181',
        env: { ZOOKEEPER_CLIENT_PORT: '2181' },
      },
    },
  },
  elasticsearch: {
    image: 'elasticsearch:{v}',
    port: 9200,
    default_version: '8.12.0',
    healthcheck: 'curl -f localhost:9200/_cluster/health',
    env: {},
    extra_env: { 'discovery.type': 'single-node', 'xpack.security.enabled': 'false' },
    host_requirements: ['vm.max_map_count=262144 (see docs)'],
  },
  meilisearch: {
    image: 'getmeili/meilisearch:{v}',
    port: 7700,
    default_version: 'v1.6',
    healthcheck: 'curl -f localhost:7700/health',
    env: { MEILI_MASTER_KEY: '{password}' },
  },
  typesense: {
    image: 'typesense/typesense:{v}',
    port: 8108,
    default_version: '0.25',
    healthcheck: 'curl -f localhost:8108/health',
    env: { TYPESENSE_API_KEY: '{password}' },
  },
  minio: {
    image: 'minio/minio:latest',
    port: 9000,
    default_version: 'latest',
    healthcheck: 'mc ready local',
    env: { MINIO_ROOT_USER: '{user}', MINIO_ROOT_PASSWORD: '{password}' },
    extra_ports: [9001],
  },
};

/**
 * Get infra defaults with version interpolation.
 * @param {string} engine - Engine name
 * @param {string} [version] - Override version
 * @returns {object|null} Infra defaults or null if unknown
 */
export function getInfraDefaults(engine, version) {
  const entry = INFRA_MAP[engine];
  if (!entry) return null;

  const v = version || entry.default_version;
  const result = {
    ...entry,
    image: entry.image.replace('{v}', v),
  };

  if (entry.companions) {
    result.companions = {};
    for (const [name, companion] of Object.entries(entry.companions)) {
      result.companions[name] = {
        ...companion,
        image: companion.image.replace('{v}', v),
      };
    }
  }

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/infra-map.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/maps/infra-map.js tests/unit/infra-map.test.js
git commit -m "feat: add INFRA_MAP with defaults for all supported infrastructure"
```

---

### Task 3: Env Map

**Files:**
- Create: `src/maps/env-map.js`
- Test: `tests/unit/env-map.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/env-map.test.js
import { describe, it, expect } from 'vitest';
import { generateEnvVars } from '../../src/maps/env-map.js';

describe('generateEnvVars', () => {
  const infra = {
    database: { engine: 'postgresql', port: 5432, name: 'mydb' },
    cache: { engine: 'redis', port: 6379 },
    queue: { engine: 'rabbitmq', port: 5672 },
  };

  it('generates Laravel-style env vars', () => {
    const env = generateEnvVars('laravel', infra);
    expect(env.DB_HOST).toBe('database');
    expect(env.DB_DATABASE).toBe('mydb');
    expect(env.DB_USERNAME).toBeDefined();
    expect(env.DB_PASSWORD).toBeDefined();
    expect(env.REDIS_HOST).toBe('cache');
    expect(env.QUEUE_CONNECTION).toBe('rabbitmq');
  });

  it('generates Django-style env vars with DATABASE_URL', () => {
    const env = generateEnvVars('django', infra);
    expect(env.DATABASE_URL).toContain('postgresql://');
    expect(env.DATABASE_URL).toContain('mydb');
    expect(env.REDIS_URL).toContain('redis://');
    expect(env.CELERY_BROKER_URL).toContain('amqp://');
  });

  it('generates Spring Boot-style env vars', () => {
    const env = generateEnvVars('spring-boot', infra);
    expect(env.SPRING_DATASOURCE_URL).toContain('jdbc:postgresql://');
    expect(env.SPRING_REDIS_HOST).toBe('cache');
    expect(env.SPRING_RABBITMQ_HOST).toBe('queue');
  });

  it('generates both URL and individual vars', () => {
    const env = generateEnvVars('laravel', infra);
    expect(env.DATABASE_URL).toContain('postgresql://');
    expect(env.DB_HOST).toBe('database');
  });

  it('handles missing infrastructure gracefully', () => {
    const env = generateEnvVars('laravel', { database: null, cache: null, queue: null });
    expect(env.DB_HOST).toBeUndefined();
    expect(env.REDIS_HOST).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/env-map.test.js`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/maps/env-map.js

const DB_DEFAULTS = { user: 'devflow', password: 'devflow_secret' };

const DB_SERVICE_NAME = 'database';
const CACHE_SERVICE_NAME = 'cache';
const QUEUE_SERVICE_NAME = 'queue';

function buildDatabaseUrl(engine, name, port) {
  const { user, password } = DB_DEFAULTS;
  const protocols = {
    postgresql: 'postgresql', mysql: 'mysql', mariadb: 'mysql', mongodb: 'mongodb',
  };
  const proto = protocols[engine] || engine;
  return `${proto}://${user}:${password}@${DB_SERVICE_NAME}:${port}/${name}`;
}

function buildJdbcUrl(engine, name, port) {
  const jdbcDrivers = { postgresql: 'postgresql', mysql: 'mysql', mariadb: 'mariadb' };
  const driver = jdbcDrivers[engine] || engine;
  return `jdbc:${driver}://${DB_SERVICE_NAME}:${port}/${name}`;
}

const STACK_ENV_GENERATORS = {
  laravel: (infra) => {
    const env = {};
    if (infra.database) {
      env.DB_CONNECTION = infra.database.engine === 'mongodb' ? 'mongodb' : (infra.database.engine === 'mysql' || infra.database.engine === 'mariadb') ? 'mysql' : 'pgsql';
      env.DB_HOST = DB_SERVICE_NAME;
      env.DB_PORT = String(infra.database.port);
      env.DB_DATABASE = infra.database.name;
      env.DB_USERNAME = DB_DEFAULTS.user;
      env.DB_PASSWORD = DB_DEFAULTS.password;
    }
    if (infra.cache) {
      env.REDIS_HOST = CACHE_SERVICE_NAME;
      env.REDIS_PORT = String(infra.cache.port);
    }
    if (infra.queue) {
      env.QUEUE_CONNECTION = infra.queue.engine === 'redis' ? 'redis' : infra.queue.engine;
    }
    return env;
  },

  django: (infra) => {
    const env = {};
    if (infra.database) {
      env.DATABASE_URL = buildDatabaseUrl(infra.database.engine, infra.database.name, infra.database.port);
    }
    if (infra.cache) {
      env.REDIS_URL = `redis://${CACHE_SERVICE_NAME}:${infra.cache.port}/0`;
    }
    if (infra.queue) {
      env.CELERY_BROKER_URL = infra.queue.engine === 'rabbitmq'
        ? `amqp://${DB_DEFAULTS.user}:${DB_DEFAULTS.password}@${QUEUE_SERVICE_NAME}:${infra.queue.port}/`
        : `redis://${QUEUE_SERVICE_NAME}:${infra.queue.port}/1`;
    }
    return env;
  },

  fastapi: (infra) => STACK_ENV_GENERATORS.django(infra), // Same URL-based style

  'spring-boot': (infra) => {
    const env = {};
    if (infra.database) {
      env.SPRING_DATASOURCE_URL = buildJdbcUrl(infra.database.engine, infra.database.name, infra.database.port);
      env.SPRING_DATASOURCE_USERNAME = DB_DEFAULTS.user;
      env.SPRING_DATASOURCE_PASSWORD = DB_DEFAULTS.password;
    }
    if (infra.cache) {
      env.SPRING_REDIS_HOST = CACHE_SERVICE_NAME;
      env.SPRING_REDIS_PORT = String(infra.cache.port);
    }
    if (infra.queue) {
      env.SPRING_RABBITMQ_HOST = QUEUE_SERVICE_NAME;
      env.SPRING_RABBITMQ_PORT = String(infra.queue.port);
      env.SPRING_RABBITMQ_USERNAME = DB_DEFAULTS.user;
      env.SPRING_RABBITMQ_PASSWORD = DB_DEFAULTS.password;
    }
    return env;
  },

  express: (infra) => {
    const env = {};
    if (infra.database) {
      env.DB_HOST = DB_SERVICE_NAME;
      env.DB_PORT = String(infra.database.port);
      env.DB_NAME = infra.database.name;
      env.DB_USER = DB_DEFAULTS.user;
      env.DB_PASSWORD = DB_DEFAULTS.password;
    }
    if (infra.cache) {
      env.REDIS_URL = `redis://${CACHE_SERVICE_NAME}:${infra.cache.port}/0`;
    }
    if (infra.queue) {
      env.AMQP_URL = `amqp://${DB_DEFAULTS.user}:${DB_DEFAULTS.password}@${QUEUE_SERVICE_NAME}:${infra.queue.port}/`;
    }
    return env;
  },
};

// Aliases
STACK_ENV_GENERATORS.symfony = STACK_ENV_GENERATORS.laravel;
STACK_ENV_GENERATORS.nestjs = STACK_ENV_GENERATORS.express;
STACK_ENV_GENERATORS.dotnet = STACK_ENV_GENERATORS.express;

/**
 * Generate env vars for a given stack + infrastructure config.
 * Always includes DATABASE_URL alongside stack-specific vars.
 */
export function generateEnvVars(stack, infra) {
  const generator = STACK_ENV_GENERATORS[stack] || STACK_ENV_GENERATORS.express;
  const env = generator(infra);

  // Always add DATABASE_URL if database exists (any stack can use it)
  if (infra.database && !env.DATABASE_URL) {
    env.DATABASE_URL = buildDatabaseUrl(infra.database.engine, infra.database.name, infra.database.port);
  }

  return env;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/env-map.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/maps/env-map.js tests/unit/env-map.test.js
git commit -m "feat: add per-stack env var generation"
```

---

### Task 4: Config Schema V2 Validation

**Files:**
- Create: `src/schemas/config-schema.js`
- Test: `tests/unit/config-schema.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/config-schema.test.js
import { describe, it, expect } from 'vitest';
import { validateConfig, migrateV1toV2 } from '../../src/schemas/config-schema.js';

describe('validateConfig', () => {
  const minimalValid = {
    version: 2,
    project: { name: 'test-app' },
    services: {
      api: { role: 'backend', stack: 'laravel', language: { name: 'php' } },
    },
  };

  it('accepts a minimal valid config', () => {
    const result = validateConfig(minimalValid);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects missing version', () => {
    const result = validateConfig({ project: { name: 'x' }, services: { a: { role: 'backend', stack: 'laravel', language: { name: 'php' } } } });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ field: 'version' }));
  });

  it('rejects missing project.name', () => {
    const result = validateConfig({ version: 2, project: {}, services: { a: { role: 'backend', stack: 'laravel', language: { name: 'php' } } } });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ field: 'project.name' }));
  });

  it('rejects empty services', () => {
    const result = validateConfig({ version: 2, project: { name: 'x' }, services: {} });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ field: 'services' }));
  });

  it('rejects service missing required fields', () => {
    const result = validateConfig({ version: 2, project: { name: 'x' }, services: { a: { role: 'backend' } } });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field.includes('stack'))).toBe(true);
  });

  it('rejects unknown stack', () => {
    const result = validateConfig({
      version: 2,
      project: { name: 'x' },
      services: { a: { role: 'backend', stack: 'cobol', language: { name: 'cobol' } } },
    });
    expect(result.valid).toBe(false);
  });

  it('validates infrastructure.database when present', () => {
    const config = {
      ...minimalValid,
      infrastructure: { database: { engine: 'postgresql' } },
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(true);
  });

  it('rejects infrastructure.database without engine', () => {
    const config = {
      ...minimalValid,
      infrastructure: { database: { version: '16' } },
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
  });

  it('applies defaults to optional fields', () => {
    const result = validateConfig(minimalValid);
    expect(result.config.project.structure).toBe('monorepo');
    expect(result.config.services.api.path).toBe('.');
  });
});

describe('migrateV1toV2', () => {
  it('migrates v1 config to v2 schema', () => {
    const v1 = {
      project: { name: 'my-app', type: 'laravel', php_version: '8.2' },
      frontend: {
        framework: 'react',
        src_dir: 'resources/js',
        component_style: 'functional',
        testing: 'vitest',
      },
      jira: { host: 'https://x.atlassian.net', project_key: 'X' },
      git: { base_branch: 'main' },
    };

    const v2 = migrateV1toV2(v1);
    expect(v2.version).toBe(2);
    expect(v2.services.api.stack).toBe('laravel');
    expect(v2.services.api.language.version).toBe('8.2');
    expect(v2.services.web.stack).toBe('react');
    expect(v2.services.web.src_dir).toBe('resources/js');
    expect(v2.services.web.component_style).toBe('functional');
    expect(v2.services.web.test_framework).toBe('vitest');
    expect(v2.jira.host).toBe('https://x.atlassian.net');
    expect(v2.git.base_branch).toBe('main');
  });

  it('detects v1 config (no version field)', () => {
    const v1 = { project: { name: 'x', type: 'laravel' } };
    const v2 = migrateV1toV2(v1);
    expect(v2.version).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/config-schema.test.js`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/schemas/config-schema.js

import { STACK_MAP, getStackDefaults } from '../maps/stack-map.js';
import { INFRA_MAP } from '../maps/infra-map.js';

const VALID_ROLES = ['backend', 'frontend', 'fullstack', 'worker', 'gateway'];
const VALID_STACKS = Object.keys(STACK_MAP);
const VALID_LANGUAGES = ['php', 'python', 'javascript', 'typescript', 'java', 'csharp', 'go', 'rust'];
const VALID_STRUCTURES = ['monorepo', 'multi-repo'];
const VALID_DB_ENGINES = ['postgresql', 'mysql', 'mariadb', 'mongodb', 'sqlite'];
const VALID_CACHE_ENGINES = ['redis', 'memcached', 'none'];
const VALID_QUEUE_ENGINES = ['rabbitmq', 'redis', 'sqs', 'kafka', 'none'];
const VALID_SEARCH_ENGINES = ['elasticsearch', 'meilisearch', 'typesense', 'none'];
const VALID_STORAGE_ENGINES = ['minio', 'localstack', 'none'];

/**
 * Validate a v2 .devflow.yml config.
 * Returns { valid: boolean, errors: Array<{field, message}>, config: object (with defaults applied) }
 */
export function validateConfig(config) {
  const errors = [];

  // version
  if (config.version !== 2) {
    errors.push({ field: 'version', message: 'version must be 2' });
  }

  // project
  if (!config.project?.name) {
    errors.push({ field: 'project.name', message: 'project.name is required' });
  }

  // services
  if (!config.services || Object.keys(config.services).length === 0) {
    errors.push({ field: 'services', message: 'at least one service is required' });
  } else {
    for (const [name, svc] of Object.entries(config.services)) {
      if (!svc.role || !VALID_ROLES.includes(svc.role)) {
        errors.push({ field: `services.${name}.role`, message: `invalid role: ${svc.role}` });
      }
      if (!svc.stack || !VALID_STACKS.includes(svc.stack)) {
        errors.push({ field: `services.${name}.stack`, message: `invalid stack: ${svc.stack}` });
      }
      if (!svc.language?.name || !VALID_LANGUAGES.includes(svc.language.name)) {
        errors.push({ field: `services.${name}.language.name`, message: `invalid language: ${svc.language?.name}` });
      }
    }
  }

  // infrastructure (optional)
  if (config.infrastructure) {
    const infra = config.infrastructure;
    if (infra.database && typeof infra.database === 'object') {
      if (!infra.database.engine) {
        errors.push({ field: 'infrastructure.database.engine', message: 'engine is required when database is defined' });
      } else if (!VALID_DB_ENGINES.includes(infra.database.engine)) {
        errors.push({ field: 'infrastructure.database.engine', message: `invalid engine: ${infra.database.engine}` });
      }
    }
  }

  // Apply defaults
  const enriched = applyDefaults(structuredClone(config));

  return { valid: errors.length === 0, errors, config: enriched };
}

function applyDefaults(config) {
  if (config.project) {
    config.project.structure = config.project.structure || 'monorepo';
    config.project.description = config.project.description || '';
    config.project.preset = config.project.preset ?? null;
  }

  if (config.services) {
    for (const [name, svc] of Object.entries(config.services)) {
      const stackDefaults = getStackDefaults(svc.stack, svc.language?.version);
      svc.path = svc.path || '.';
      svc.repo = svc.repo ?? null;
      svc.framework_version = svc.framework_version || 'latest';
      if (stackDefaults) {
        svc.language = svc.language || {};
        svc.language.version = svc.language.version || stackDefaults.language.version;
        svc.build_command = svc.build_command || stackDefaults.build_command;
        svc.dev_command = svc.dev_command || stackDefaults.dev_command;
        svc.test_command = svc.test_command || stackDefaults.test_command;
        svc.lint_command = svc.lint_command || stackDefaults.lint_command;
        svc.entry_point = svc.entry_point || stackDefaults.entry_point;
      }
    }
  }

  return config;
}

/**
 * Migrate a v1 .devflow.yml to v2 schema.
 */
export function migrateV1toV2(v1Config) {
  const v2 = {
    version: 2,
    project: {
      name: v1Config.project?.name || 'unnamed',
      description: v1Config.project?.description || '',
      preset: null,
      structure: 'monorepo',
    },
    services: {},
  };

  // Migrate backend service
  const stack = v1Config.project?.type || 'laravel';
  const langVersion = v1Config.project?.php_version || v1Config.project?.python_version || null;
  const stackDefaults = getStackDefaults(stack);

  v2.services.api = {
    role: 'backend',
    stack,
    language: {
      name: stackDefaults?.language?.name || 'php',
      ...(langVersion ? { version: langVersion } : {}),
    },
    path: '.',
  };

  // Migrate frontend if exists
  if (v1Config.frontend?.framework) {
    v2.services.web = {
      role: 'frontend',
      stack: v1Config.frontend.framework,
      language: { name: 'typescript' },
      ...(v1Config.frontend.src_dir ? { src_dir: v1Config.frontend.src_dir } : {}),
      ...(v1Config.frontend.component_style ? { component_style: v1Config.frontend.component_style } : {}),
      ...(v1Config.frontend.testing ? { test_framework: v1Config.frontend.testing } : {}),
    };
  }

  // Copy through unchanged sections
  for (const section of ['jira', 'figma', 'git', 'deploy', 'prompt', 'test']) {
    if (v1Config[section]) {
      v2[section] = v1Config[section];
    }
  }

  return v2;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/config-schema.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/schemas/config-schema.js tests/unit/config-schema.test.js
git commit -m "feat: add v2 config schema validation and v1→v2 migration"
```

---

### Task 5: Update config.js to use schema

**Files:**
- Modify: `src/utils/config.js`
- Modify: `tests/unit/config.test.js`

- [ ] **Step 1: Update existing test + add new tests**

```javascript
// tests/unit/config.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadConfig, resetConfig, loadAndValidateConfig } from '../../src/utils/config.js';

describe('Config Loader', () => {
  beforeEach(() => resetConfig());

  it('returns null when no config file exists', () => {
    const config = loadConfig('/nonexistent/path');
    expect(config).toBeNull();
  });
});

describe('loadAndValidateConfig', () => {
  beforeEach(() => resetConfig());

  it('returns null when no config file exists', () => {
    const result = loadAndValidateConfig('/nonexistent/path');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify the new test fails**

Run: `npx vitest run tests/unit/config.test.js`
Expected: FAIL on `loadAndValidateConfig` import

- [ ] **Step 3: Add loadAndValidateConfig to config.js**

Add to `src/utils/config.js` after existing code:

```javascript
import { validateConfig, migrateV1toV2 } from '../schemas/config-schema.js';

export function loadAndValidateConfig(projectRoot = process.cwd()) {
  const raw = loadConfig(projectRoot);
  if (!raw) return null;

  // Auto-detect v1 and migrate
  if (!raw.version) {
    const migrated = migrateV1toV2(raw);
    return validateConfig(migrated);
  }

  return validateConfig(raw);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/config.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/config.js tests/unit/config.test.js
git commit -m "feat: integrate v2 schema validation into config loader"
```

---

## Chunk 2: Preset System + Detector Service

### Task 6: Preset Registry

**Files:**
- Create: `src/presets/index.js`
- Create: `src/presets/laravel-react.yml` (as representative example)
- Test: `tests/unit/preset.service.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/preset.service.test.js
import { describe, it, expect } from 'vitest';
import { listPresets, loadPreset, applyPresetOverrides } from '../../src/presets/index.js';

describe('listPresets', () => {
  it('returns array of preset names', () => {
    const presets = listPresets();
    expect(presets).toBeInstanceOf(Array);
    expect(presets.length).toBeGreaterThan(0);
    expect(presets).toContain('laravel-react');
  });
});

describe('loadPreset', () => {
  it('loads a preset by name', () => {
    const preset = loadPreset('laravel-react');
    expect(preset.name).toBe('laravel-react');
    expect(preset.services.api.stack).toBe('laravel');
    expect(preset.services.web.stack).toBe('react');
    expect(preset.infrastructure.database.engine).toBe('postgresql');
  });

  it('returns null for unknown preset', () => {
    expect(loadPreset('nonexistent')).toBeNull();
  });
});

describe('applyPresetOverrides', () => {
  it('user overrides take precedence over preset', () => {
    const preset = loadPreset('laravel-react');
    const overrides = {
      infrastructure: { database: { engine: 'mysql' } },
    };
    const merged = applyPresetOverrides(preset, overrides);
    expect(merged.infrastructure.database.engine).toBe('mysql');
    // Auto-fills version/port from INFRA_MAP
    expect(merged.infrastructure.database.port).toBe(3306);
  });

  it('changing stack re-populates defaults', () => {
    const preset = loadPreset('laravel-react');
    const overrides = {
      services: { api: { stack: 'django' } },
    };
    const merged = applyPresetOverrides(preset, overrides);
    expect(merged.services.api.stack).toBe('django');
    expect(merged.services.api.language.name).toBe('python');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/preset.service.test.js`
Expected: FAIL

- [ ] **Step 3: Create laravel-react.yml preset file**

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

- [ ] **Step 4: Create preset index.js**

```javascript
// src/presets/index.js
import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import { getStackDefaults } from '../maps/stack-map.js';
import { getInfraDefaults } from '../maps/infra-map.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function listPresets() {
  return readdirSync(__dirname)
    .filter(f => f.endsWith('.yml'))
    .map(f => f.replace('.yml', ''));
}

export function loadPreset(name) {
  const filePath = resolve(__dirname, `${name}.yml`);
  try {
    const content = readFileSync(filePath, 'utf-8');
    return YAML.parse(content);
  } catch {
    return null;
  }
}

/**
 * Merge user overrides onto a preset.
 * Order: preset defaults → INFRA_MAP/STACK_MAP auto-fill → user overrides.
 */
export function applyPresetOverrides(preset, overrides) {
  const merged = structuredClone(preset);

  // Merge services
  if (overrides.services) {
    for (const [name, svcOverrides] of Object.entries(overrides.services)) {
      if (!merged.services[name]) {
        merged.services[name] = svcOverrides;
        continue;
      }
      // If stack changed, re-populate from STACK_MAP
      if (svcOverrides.stack && svcOverrides.stack !== merged.services[name].stack) {
        const stackDefaults = getStackDefaults(svcOverrides.stack);
        if (stackDefaults) {
          merged.services[name] = {
            ...merged.services[name],
            stack: svcOverrides.stack,
            language: stackDefaults.language,
            build_command: stackDefaults.build_command,
            dev_command: stackDefaults.dev_command,
            test_command: stackDefaults.test_command,
            lint_command: stackDefaults.lint_command,
            entry_point: stackDefaults.entry_point,
          };
        }
      }
      Object.assign(merged.services[name], svcOverrides);
    }
  }

  // Merge infrastructure
  if (overrides.infrastructure) {
    if (!merged.infrastructure) merged.infrastructure = {};
    for (const [key, val] of Object.entries(overrides.infrastructure)) {
      if (val && typeof val === 'object' && val.engine) {
        // Engine changed — re-populate from INFRA_MAP
        const infraDefaults = getInfraDefaults(val.engine, val.version);
        if (infraDefaults) {
          merged.infrastructure[key] = {
            engine: val.engine,
            version: val.version || infraDefaults.default_version,
            port: val.port || infraDefaults.port,
            ...val,
          };
        } else {
          merged.infrastructure[key] = val;
        }
      } else {
        merged.infrastructure[key] = val;
      }
    }
  }

  return merged;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/preset.service.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/presets/ tests/unit/preset.service.test.js
git commit -m "feat: add preset system with loading, listing, and override merging"
```

---

### Task 7: Create remaining preset files

**Files:**
- Create: all preset YAML files listed in File Structure

- [ ] **Step 1: Create all preset YAML files**

Each file follows the same format as `laravel-react.yml`. Use values from the spec Section 4.2.

Create these files in `src/presets/`:
- `laravel-starter.yml` — Laravel + MySQL + Redis
- `laravel-api.yml` — Laravel API-only + PostgreSQL + Redis
- `laravel-vue.yml` — Laravel + Vue + MySQL + Redis
- `django-starter.yml` — Django + PostgreSQL + Redis
- `django-react.yml` — Django + React + PostgreSQL + Redis
- `fastapi-starter.yml` — FastAPI + PostgreSQL + Redis
- `fastapi-nextjs.yml` — FastAPI + Next.js + PostgreSQL + Redis
- `express-starter.yml` — Express.js + MongoDB + Redis
- `express-react.yml` — Express + React + MongoDB + Redis
- `spring-starter.yml` — Spring Boot + PostgreSQL + Redis
- `spring-react.yml` — Spring Boot + React + PostgreSQL + Redis
- `dotnet-starter.yml` — .NET + PostgreSQL + Redis
- `dotnet-angular.yml` — .NET + Angular + PostgreSQL + Redis
- `microservice-base.yml` — FastAPI + RabbitMQ + PostgreSQL + Redis + MinIO
- `fullstack-enterprise.yml` — Laravel + React + PostgreSQL + Redis + RabbitMQ + ES + MinIO

Each preset must include: `name`, `description`, `services` (with `role`, `stack`, `language`, `port`, `scaffold`), `infrastructure` (with `database`, `cache`, `queue`, `search`, `storage`).

- [ ] **Step 2: Verify preset loading**

Run: `npx vitest run tests/unit/preset.service.test.js`
Expected: PASS (listPresets now returns all presets)

- [ ] **Step 3: Commit**

```bash
git add src/presets/
git commit -m "feat: add all preset YAML files for supported stack combinations"
```

---

### Task 8: Detector Service

**Files:**
- Create: `src/services/detector.service.js`
- Test: `tests/unit/detector.service.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/detector.service.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DetectorService } from '../../src/services/detector.service.js';

// Mock fs for controlled scanning
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual };
});

describe('DetectorService', () => {
  let detector;

  beforeEach(() => {
    detector = new DetectorService();
  });

  describe('detectFromFiles', () => {
    it('detects Laravel from composer.json with laravel/framework', () => {
      const result = detector.detectFromFiles({
        'composer.json': '{"require":{"laravel/framework":"^11.0"}}',
      });
      expect(result.services).toHaveLength(1);
      expect(result.services[0].stack).toBe('laravel');
      expect(result.services[0].role).toBe('backend');
    });

    it('detects Django from requirements.txt with Django', () => {
      const result = detector.detectFromFiles({
        'requirements.txt': 'Django==5.0\npsycopg2==2.9',
      });
      expect(result.services[0].stack).toBe('django');
    });

    it('detects React from package.json with react dep', () => {
      const result = detector.detectFromFiles({
        'package.json': '{"dependencies":{"react":"^18.0"}}',
      });
      expect(result.services[0].stack).toBe('react');
      expect(result.services[0].role).toBe('frontend');
    });

    it('detects monorepo with backend + frontend subdirs', () => {
      const result = detector.detectFromFiles({
        'backend/composer.json': '{"require":{"laravel/framework":"^11.0"}}',
        'frontend/package.json': '{"dependencies":{"react":"^18.0"}}',
      });
      expect(result.services).toHaveLength(2);
      expect(result.structure).toBe('monorepo');
    });

    it('detects Spring Boot from pom.xml', () => {
      const result = detector.detectFromFiles({
        'pom.xml': '<dependency><groupId>org.springframework.boot</groupId></dependency>',
      });
      expect(result.services[0].stack).toBe('spring-boot');
    });

    it('detects .NET from .csproj', () => {
      const result = detector.detectFromFiles({
        'MyApp.csproj': '<PackageReference Include="Microsoft.AspNetCore" />',
      });
      expect(result.services[0].stack).toBe('dotnet');
    });
  });

  describe('detectInfraFromDockerCompose', () => {
    it('detects PostgreSQL and Redis from docker-compose', () => {
      const compose = `
services:
  db:
    image: postgres:16-alpine
  cache:
    image: redis:7-alpine
`;
      const infra = detector.detectInfraFromDockerCompose(compose);
      expect(infra.database.engine).toBe('postgresql');
      expect(infra.cache.engine).toBe('redis');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/detector.service.test.js`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```javascript
// src/services/detector.service.js
import YAML from 'yaml';

const STACK_DETECTORS = [
  // Backend
  {
    files: ['composer.json'],
    detect: (content) => {
      const pkg = JSON.parse(content);
      if (pkg.require?.['laravel/framework']) return { stack: 'laravel', role: 'backend', language: { name: 'php' } };
      if (pkg.require?.['symfony/framework-bundle']) return { stack: 'symfony', role: 'backend', language: { name: 'php' } };
      return { stack: 'php', role: 'backend', language: { name: 'php' } };
    },
  },
  {
    files: ['requirements.txt', 'pyproject.toml'],
    detect: (content) => {
      if (/django/i.test(content)) return { stack: 'django', role: 'backend', language: { name: 'python' } };
      if (/fastapi/i.test(content)) return { stack: 'fastapi', role: 'backend', language: { name: 'python' } };
      return { stack: 'python', role: 'backend', language: { name: 'python' } };
    },
  },
  {
    files: ['pom.xml', 'build.gradle'],
    detect: (content) => {
      if (/springframework.*boot/i.test(content)) return { stack: 'spring-boot', role: 'backend', language: { name: 'java' } };
      return { stack: 'java', role: 'backend', language: { name: 'java' } };
    },
  },
  {
    files: ['*.csproj', '*.sln'],
    detect: () => ({ stack: 'dotnet', role: 'backend', language: { name: 'csharp' } }),
  },
  // Frontend / Fullstack Node
  {
    files: ['package.json'],
    detect: (content) => {
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['next']) return { stack: 'nextjs', role: 'frontend', language: { name: 'typescript' } };
      if (deps['nuxt']) return { stack: 'nuxtjs', role: 'frontend', language: { name: 'typescript' } };
      if (deps['@angular/core']) return { stack: 'angular', role: 'frontend', language: { name: 'typescript' } };
      if (deps['vue']) return { stack: 'vue', role: 'frontend', language: { name: 'typescript' } };
      if (deps['svelte']) return { stack: 'svelte', role: 'frontend', language: { name: 'typescript' } };
      if (deps['react']) return { stack: 'react', role: 'frontend', language: { name: 'typescript' } };
      if (deps['@nestjs/core']) return { stack: 'nestjs', role: 'backend', language: { name: 'typescript' } };
      if (deps['express']) return { stack: 'express', role: 'backend', language: { name: 'javascript' } };
      return null;
    },
  },
];

const IMAGE_TO_INFRA = {
  postgres: 'postgresql',
  mysql: 'mysql',
  mariadb: 'mariadb',
  mongo: 'mongodb',
  redis: 'redis',
  memcached: 'memcached',
  rabbitmq: 'rabbitmq',
  elasticsearch: 'elasticsearch',
  meilisearch: 'meilisearch',
  minio: 'minio',
};

const INFRA_CATEGORIES = {
  postgresql: 'database', mysql: 'database', mariadb: 'database', mongodb: 'database',
  redis: 'cache', memcached: 'cache',
  rabbitmq: 'queue',
  elasticsearch: 'search', meilisearch: 'search',
  minio: 'storage',
};

export class DetectorService {
  /**
   * Detect stack from a map of { relativePath: fileContent }.
   * Used for testing with mock data; real scanning reads from disk.
   */
  detectFromFiles(fileMap) {
    const services = [];
    let structure = 'monorepo';
    const rootFiles = {};
    const subdirFiles = {};

    for (const [path, content] of Object.entries(fileMap)) {
      const parts = path.split('/');
      if (parts.length === 1) {
        rootFiles[path] = content;
      } else {
        const dir = parts[0];
        if (!subdirFiles[dir]) subdirFiles[dir] = {};
        subdirFiles[dir][parts.slice(1).join('/')] = content;
      }
    }

    // Scan root
    const rootResult = this._scanLevel(rootFiles);
    if (rootResult) services.push({ ...rootResult, path: '.' });

    // Scan one-level-deep (monorepo detection)
    for (const [dir, files] of Object.entries(subdirFiles)) {
      const result = this._scanLevel(files);
      if (result) {
        services.push({ ...result, path: `./${dir}` });
      }
    }

    if (services.length > 1) structure = 'monorepo';

    return { services, structure };
  }

  _scanLevel(files) {
    for (const detector of STACK_DETECTORS) {
      for (const pattern of detector.files) {
        // Simple matching: exact or wildcard suffix
        const matchingFile = Object.keys(files).find(f => {
          if (pattern.includes('*')) {
            const suffix = pattern.replace('*', '');
            return f.endsWith(suffix);
          }
          return f === pattern;
        });
        if (matchingFile) {
          const result = detector.detect(files[matchingFile]);
          if (result) return result;
        }
      }
    }
    return null;
  }

  /**
   * Detect infrastructure from docker-compose.yml content.
   */
  detectInfraFromDockerCompose(composeContent) {
    const infra = { database: null, cache: null, queue: null, search: null, storage: null };
    let parsed;
    try {
      parsed = YAML.parse(composeContent);
    } catch {
      return infra;
    }

    const services = parsed.services || {};
    for (const [, svc] of Object.entries(services)) {
      const image = svc.image || '';
      for (const [prefix, engine] of Object.entries(IMAGE_TO_INFRA)) {
        if (image.startsWith(prefix) || image.includes(`/${prefix}`)) {
          const category = INFRA_CATEGORIES[engine];
          if (category && !infra[category]) {
            const versionMatch = image.match(/:([0-9][0-9.]*)/);
            infra[category] = {
              engine,
              ...(versionMatch ? { version: versionMatch[1] } : {}),
            };
          }
        }
      }
    }

    return infra;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/detector.service.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/detector.service.js tests/unit/detector.service.test.js
git commit -m "feat: add project detector service for stack and infra detection"
```

---

## Chunk 3: Docker Generation + Scaffold

### Task 9: Docker Templates (Dockerfiles)

**Files:**
- Create: `src/docker-templates/php.Dockerfile`
- Create: `src/docker-templates/python.Dockerfile`
- Create: `src/docker-templates/node.Dockerfile`
- Create: `src/docker-templates/java.Dockerfile`
- Create: `src/docker-templates/dotnet.Dockerfile`

- [ ] **Step 1: Create php.Dockerfile**

```dockerfile
# src/docker-templates/php.Dockerfile
FROM php:{{version}}-fpm-alpine

RUN apk add --no-cache \
    git curl zip unzip libpq-dev icu-dev \
    && docker-php-ext-install pdo pdo_pgsql pdo_mysql intl opcache

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /app

COPY . .

RUN composer install --no-interaction --prefer-dist

EXPOSE {{port}}

CMD ["php-fpm"]
```

- [ ] **Step 2: Create python.Dockerfile**

```dockerfile
# src/docker-templates/python.Dockerfile
FROM python:{{version}}-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt* pyproject.toml* ./
RUN pip install --no-cache-dir -r requirements.txt 2>/dev/null || pip install --no-cache-dir . 2>/dev/null || true

COPY . .

EXPOSE {{port}}

CMD ["python", "{{entry_point}}"]
```

- [ ] **Step 3: Create node.Dockerfile**

```dockerfile
# src/docker-templates/node.Dockerfile
FROM node:{{version}}-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE {{port}}

CMD ["npm", "run", "dev"]
```

- [ ] **Step 4: Create java.Dockerfile**

```dockerfile
# src/docker-templates/java.Dockerfile
FROM eclipse-temurin:{{version}}-jdk

WORKDIR /app

COPY . .

RUN ./mvnw install -DskipTests 2>/dev/null || true

EXPOSE {{port}}

CMD ["./mvnw", "spring-boot:run"]
```

- [ ] **Step 5: Create dotnet.Dockerfile**

```dockerfile
# src/docker-templates/dotnet.Dockerfile
FROM mcr.microsoft.com/dotnet/sdk:{{version}}

WORKDIR /app

COPY *.csproj ./
RUN dotnet restore

COPY . .

EXPOSE {{port}}

CMD ["dotnet", "watch", "run"]
```

- [ ] **Step 6: Commit**

```bash
git add src/docker-templates/
git commit -m "feat: add dev Dockerfile templates for all supported languages"
```

---

### Task 10: Docker Service — docker-compose.yml Generation

**Files:**
- Create: `src/services/docker.service.js`
- Test: `tests/unit/docker.service.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/docker.service.test.js
import { describe, it, expect } from 'vitest';
import { DockerService } from '../../src/services/docker.service.js';
import YAML from 'yaml';

describe('DockerService', () => {
  const config = {
    version: 2,
    project: { name: 'test-app' },
    services: {
      api: {
        role: 'backend', stack: 'laravel',
        language: { name: 'php', version: '8.3' },
        path: '.', port: 8000,
      },
      web: {
        role: 'frontend', stack: 'react',
        language: { name: 'typescript', version: '20' },
        path: './frontend', port: 3000,
      },
    },
    infrastructure: {
      database: { engine: 'postgresql', version: '16', port: 5432, name: 'test_app_db' },
      cache: { engine: 'redis', version: '7', port: 6379 },
      queue: null,
      search: null,
      storage: null,
    },
  };

  let docker;

  beforeEach(() => {
    docker = new DockerService();
  });

  describe('generateCompose', () => {
    it('generates valid YAML with all services', () => {
      const output = docker.generateCompose(config);
      const parsed = YAML.parse(output);
      expect(parsed.services).toBeDefined();
      expect(parsed.services.api).toBeDefined();
      expect(parsed.services.web).toBeDefined();
      expect(parsed.services.database).toBeDefined();
      expect(parsed.services.cache).toBeDefined();
    });

    it('includes health checks for infrastructure', () => {
      const output = docker.generateCompose(config);
      const parsed = YAML.parse(output);
      expect(parsed.services.database.healthcheck).toBeDefined();
      expect(parsed.services.cache.healthcheck).toBeDefined();
    });

    it('sets depends_on with service_healthy condition', () => {
      const output = docker.generateCompose(config);
      const parsed = YAML.parse(output);
      expect(parsed.services.api.depends_on.database.condition).toBe('service_healthy');
    });

    it('uses named volumes', () => {
      const output = docker.generateCompose(config);
      const parsed = YAML.parse(output);
      expect(parsed.volumes).toBeDefined();
    });

    it('maps ports correctly', () => {
      const output = docker.generateCompose(config);
      const parsed = YAML.parse(output);
      expect(parsed.services.api.ports).toContainEqual('8000:8000');
      expect(parsed.services.web.ports).toContainEqual('3000:3000');
    });
  });

  describe('generateDockerfile', () => {
    it('generates Dockerfile for PHP service', () => {
      const df = docker.generateDockerfile(config.services.api);
      expect(df).toContain('FROM php:8.3-fpm-alpine');
      expect(df).toContain('EXPOSE 8000');
    });

    it('generates Dockerfile for Node service', () => {
      const df = docker.generateDockerfile(config.services.web);
      expect(df).toContain('FROM node:20-alpine');
      expect(df).toContain('EXPOSE 3000');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/docker.service.test.js`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```javascript
// src/services/docker.service.js
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import { getInfraDefaults } from '../maps/infra-map.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, '../docker-templates');

const LANGUAGE_TO_TEMPLATE = {
  php: 'php.Dockerfile',
  python: 'python.Dockerfile',
  javascript: 'node.Dockerfile',
  typescript: 'node.Dockerfile',
  java: 'java.Dockerfile',
  csharp: 'dotnet.Dockerfile',
};

export class DockerService {
  /**
   * Generate docker-compose.yml content from a v2 config.
   */
  generateCompose(config) {
    const compose = {
      services: {},
      volumes: {},
      networks: {
        devflow: { driver: 'bridge' },
      },
    };

    const infraServices = [];

    // Infrastructure services
    if (config.infrastructure) {
      for (const [category, infra] of Object.entries(config.infrastructure)) {
        if (!infra || !infra.engine || infra.engine === 'none') continue;

        const defaults = getInfraDefaults(infra.engine, infra.version);
        if (!defaults) continue;

        const serviceName = category; // database, cache, queue, search, storage
        const volumeName = `${serviceName}_data`;

        compose.services[serviceName] = {
          image: defaults.image,
          ports: [`${infra.port || defaults.port}:${defaults.port}`],
          environment: { ...defaults.env, ...(defaults.extra_env || {}) },
          volumes: [`${volumeName}:/data`],
          healthcheck: {
            test: ['CMD-SHELL', defaults.healthcheck],
            interval: '10s',
            timeout: '5s',
            retries: 5,
          },
          networks: ['devflow'],
          restart: 'unless-stopped',
        };

        // Extra ports (e.g., RabbitMQ management, MinIO console)
        if (defaults.extra_ports) {
          for (const p of defaults.extra_ports) {
            compose.services[serviceName].ports.push(`${p}:${p}`);
          }
        }

        compose.volumes[volumeName] = {};
        infraServices.push(serviceName);

        // Companions (e.g., ZooKeeper for Kafka)
        if (defaults.companions) {
          for (const [compName, comp] of Object.entries(defaults.companions)) {
            compose.services[compName] = {
              image: comp.image,
              ports: [`${comp.port}:${comp.port}`],
              environment: comp.env || {},
              healthcheck: {
                test: ['CMD-SHELL', comp.healthcheck],
                interval: '10s',
                timeout: '5s',
                retries: 5,
              },
              networks: ['devflow'],
              restart: 'unless-stopped',
            };
          }
        }
      }
    }

    // Application services
    for (const [name, svc] of Object.entries(config.services)) {
      const buildContext = svc.path === '.' ? '.' : svc.path;

      compose.services[name] = {
        build: {
          context: buildContext,
          dockerfile: 'Dockerfile',
        },
        ports: [`${svc.port}:${svc.port}`],
        volumes: [
          `${buildContext === '.' ? '.' : buildContext}:/app`,
          `${name}_deps:/app/node_modules`,
        ],
        environment: {
          NODE_ENV: 'development',
        },
        depends_on: {},
        networks: ['devflow'],
        restart: 'unless-stopped',
      };

      // Add depends_on for infra
      for (const infraName of infraServices) {
        compose.services[name].depends_on[infraName] = { condition: 'service_healthy' };
      }

      compose.volumes[`${name}_deps`] = {};
    }

    return YAML.stringify(compose, { lineWidth: 120 });
  }

  /**
   * Generate a Dockerfile for a given service config.
   */
  generateDockerfile(service) {
    const templateFile = LANGUAGE_TO_TEMPLATE[service.language.name];
    if (!templateFile) return null;

    let template;
    try {
      template = readFileSync(resolve(TEMPLATES_DIR, templateFile), 'utf-8');
    } catch {
      return null;
    }

    return template
      .replace(/\{\{version\}\}/g, service.language.version)
      .replace(/\{\{port\}\}/g, String(service.port))
      .replace(/\{\{entry_point\}\}/g, service.entry_point || '');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/docker.service.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/docker.service.js tests/unit/docker.service.test.js
git commit -m "feat: add docker service for compose and Dockerfile generation"
```

---

### Task 11: Scaffold Service

**Files:**
- Create: `src/services/scaffold.service.js`
- Test: `tests/unit/scaffold.service.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/scaffold.service.test.js
import { describe, it, expect, vi } from 'vitest';
import { ScaffoldService } from '../../src/services/scaffold.service.js';

describe('ScaffoldService', () => {
  let scaffold;

  beforeEach(() => {
    scaffold = new ScaffoldService();
  });

  describe('buildScaffoldCommand', () => {
    it('builds docker run command for Laravel scaffold', () => {
      const cmd = scaffold.buildScaffoldCommand({
        stack: 'laravel',
        language: { name: 'php', version: '8.3' },
        path: './api',
        scaffold: {
          command: 'composer create-project laravel/laravel {path}',
          docker_image: 'composer:latest',
        },
      });
      expect(cmd).toContain('docker run');
      expect(cmd).toContain('composer:latest');
      expect(cmd).toContain('composer create-project laravel/laravel');
    });

    it('builds docker run command for React scaffold', () => {
      const cmd = scaffold.buildScaffoldCommand({
        stack: 'react',
        language: { name: 'typescript', version: '5.5' },
        path: './frontend',
        scaffold: {
          command: 'npx create-vite {path} --template react-ts',
          docker_image: 'node:20-alpine',
        },
      });
      expect(cmd).toContain('node:20-alpine');
      expect(cmd).toContain('create-vite');
    });

    it('uses stack map defaults when no scaffold config provided', () => {
      const cmd = scaffold.buildScaffoldCommand({
        stack: 'django',
        language: { name: 'python', version: '3.12' },
        path: './backend',
      });
      expect(cmd).toContain('docker run');
      expect(cmd).toContain('django-admin startproject');
    });
  });

  describe('buildScaffoldSteps', () => {
    it('returns ordered steps for a full project', () => {
      const config = {
        services: {
          api: { stack: 'laravel', language: { name: 'php', version: '8.3' }, path: '.',
                 scaffold: { command: 'composer create-project laravel/laravel {path}', docker_image: 'composer:latest' } },
          web: { stack: 'react', language: { name: 'typescript', version: '20' }, path: './frontend',
                 scaffold: { command: 'npx create-vite {path} --template react-ts', docker_image: 'node:20-alpine' } },
        },
      };
      const steps = scaffold.buildScaffoldSteps(config);
      expect(steps).toHaveLength(2);
      expect(steps[0].name).toBe('api');
      expect(steps[1].name).toBe('web');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/scaffold.service.test.js`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```javascript
// src/services/scaffold.service.js
import { getStackDefaults } from '../maps/stack-map.js';

export class ScaffoldService {
  /**
   * Build a `docker run` command string for scaffolding a service.
   */
  buildScaffoldCommand(service) {
    const scaffoldConfig = service.scaffold || {};
    const stackDefaults = getStackDefaults(service.stack, service.language?.version);

    const image = scaffoldConfig.docker_image || stackDefaults?.scaffold_image || `node:20-alpine`;
    const scaffoldCmd = (scaffoldConfig.command || stackDefaults?.scaffold || '')
      .replace(/\{path\}/g, '/output')
      .replace(/\{name\}/g, 'app');

    const hostPath = service.path === '.' ? '$(pwd)' : `$(pwd)/${service.path}`;

    return `docker run --rm -v ${hostPath}:/output -w /output ${image} sh -c "${scaffoldCmd}"`;
  }

  /**
   * Build ordered scaffold steps for all services in a config.
   * Backends first, then frontends.
   */
  buildScaffoldSteps(config) {
    const steps = [];

    // Sort: backends first
    const entries = Object.entries(config.services);
    const backends = entries.filter(([, s]) => s.role !== 'frontend');
    const frontends = entries.filter(([, s]) => s.role === 'frontend');

    for (const [name, svc] of [...backends, ...frontends]) {
      steps.push({
        name,
        command: this.buildScaffoldCommand(svc),
        path: svc.path,
        stack: svc.stack,
      });
    }

    return steps;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/scaffold.service.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/scaffold.service.js tests/unit/scaffold.service.test.js
git commit -m "feat: add scaffold service for Docker-based project creation"
```

---

## Chunk 4: devflow init + devflow doctor + Linked Projects + CLI Update

### Task 12: Init Command — New Project Flow

**Files:**
- Modify: `src/commands/init.js` (full rewrite)
- Test: `tests/unit/init.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/init.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the helper functions, not the interactive prompts
import { buildConfigFromPreset, buildConfigFromCustom, detectExistingProject } from '../../src/commands/init.js';

describe('buildConfigFromPreset', () => {
  it('builds v2 config from preset name + project info', () => {
    const config = buildConfigFromPreset({
      presetName: 'laravel-react',
      projectName: 'my-app',
      projectDescription: 'Test project',
    });
    expect(config.version).toBe(2);
    expect(config.project.name).toBe('my-app');
    expect(config.project.preset).toBe('laravel-react');
    expect(config.services.api.stack).toBe('laravel');
    expect(config.services.web.stack).toBe('react');
    expect(config.infrastructure.database.engine).toBe('postgresql');
  });
});

describe('buildConfigFromCustom', () => {
  it('builds v2 config from custom selections', () => {
    const config = buildConfigFromCustom({
      projectName: 'custom-app',
      projectDescription: '',
      backend: { stack: 'django', port: 8000 },
      frontend: { stack: 'vue', port: 3000 },
      database: { engine: 'mysql' },
      cache: { engine: 'redis' },
      queue: null,
      search: null,
      storage: null,
    });
    expect(config.version).toBe(2);
    expect(config.services.api.stack).toBe('django');
    expect(config.services.api.language.name).toBe('python');
    expect(config.services.web.stack).toBe('vue');
    expect(config.infrastructure.database.engine).toBe('mysql');
    expect(config.infrastructure.database.port).toBe(3306);
  });

  it('handles no frontend', () => {
    const config = buildConfigFromCustom({
      projectName: 'api-only',
      backend: { stack: 'fastapi', port: 8000 },
      frontend: null,
      database: { engine: 'postgresql' },
      cache: null, queue: null, search: null, storage: null,
    });
    expect(config.services.web).toBeUndefined();
  });
});

describe('detectExistingProject', () => {
  it('returns detected services and infrastructure', () => {
    // Uses DetectorService internally — just verify the interface
    const result = detectExistingProject('/nonexistent');
    expect(result).toHaveProperty('services');
    expect(result).toHaveProperty('infrastructure');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/init.test.js`
Expected: FAIL

- [ ] **Step 3: Rewrite init.js**

```javascript
// src/commands/init.js
import inquirer from 'inquirer';
import { writeFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import YAML from 'yaml';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';
import { loadPreset, listPresets, applyPresetOverrides } from '../presets/index.js';
import { getStackDefaults } from '../maps/stack-map.js';
import { getInfraDefaults } from '../maps/infra-map.js';
import { generateEnvVars } from '../maps/env-map.js';
import { DetectorService } from '../services/detector.service.js';
import { DockerService } from '../services/docker.service.js';
import { validateConfig, migrateV1toV2 } from '../schemas/config-schema.js';

const BACKEND_STACKS = ['laravel', 'symfony', 'django', 'fastapi', 'express', 'nestjs', 'spring-boot', 'dotnet'];
const FRONTEND_STACKS = ['react', 'vue', 'angular', 'nextjs', 'nuxtjs', 'svelte', 'none'];
const DB_ENGINES = ['postgresql', 'mysql', 'mariadb', 'mongodb', 'sqlite', 'none'];
const CACHE_ENGINES = ['redis', 'memcached', 'none'];
const QUEUE_ENGINES = ['rabbitmq', 'redis', 'sqs', 'kafka', 'none'];

// ─── Exported helpers (testable without prompts) ────────────

export function buildConfigFromPreset({ presetName, projectName, projectDescription, overrides }) {
  const preset = loadPreset(presetName);
  if (!preset) throw new Error(`Unknown preset: ${presetName}`);

  const merged = overrides ? applyPresetOverrides(preset, overrides) : preset;
  return {
    version: 2,
    project: {
      name: projectName,
      description: projectDescription || '',
      preset: presetName,
      structure: 'monorepo',
    },
    services: merged.services,
    infrastructure: merged.infrastructure,
  };
}

export function buildConfigFromCustom({ projectName, projectDescription, backend, frontend, database, cache, queue, search, storage }) {
  const config = {
    version: 2,
    project: { name: projectName, description: projectDescription || '', preset: null, structure: 'monorepo' },
    services: {},
    infrastructure: {},
  };

  if (backend) {
    const defaults = getStackDefaults(backend.stack);
    config.services.api = {
      role: 'backend',
      stack: backend.stack,
      language: defaults?.language || { name: 'unknown' },
      path: '.',
      port: backend.port || 8000,
    };
  }

  if (frontend) {
    const defaults = getStackDefaults(frontend.stack);
    config.services.web = {
      role: 'frontend',
      stack: frontend.stack,
      language: defaults?.language || { name: 'typescript' },
      path: './frontend',
      port: frontend.port || 3000,
    };
  }

  for (const [category, selection] of Object.entries({ database, cache, queue, search, storage })) {
    if (selection && selection.engine && selection.engine !== 'none') {
      const infraDefaults = getInfraDefaults(selection.engine, selection.version);
      config.infrastructure[category] = {
        engine: selection.engine,
        version: selection.version || infraDefaults?.default_version,
        port: selection.port || infraDefaults?.port,
        ...(category === 'database' ? { name: `${projectName.replace(/-/g, '_')}_db` } : {}),
      };
    }
  }

  return config;
}

export function detectExistingProject(projectRoot) {
  const detector = new DetectorService();
  const fileMap = {};

  // Scan root-level files
  const rootFiles = ['composer.json', 'requirements.txt', 'pyproject.toml', 'package.json', 'pom.xml', 'build.gradle', 'go.mod', 'Cargo.toml'];
  for (const f of rootFiles) {
    const p = resolve(projectRoot, f);
    if (existsSync(p)) {
      fileMap[f] = readFileSync(p, 'utf-8');
    }
  }

  // Scan one level deep
  try {
    const dirs = readdirSync(projectRoot, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules' && d.name !== 'vendor');
    for (const dir of dirs) {
      for (const f of rootFiles) {
        const p = resolve(projectRoot, dir.name, f);
        if (existsSync(p)) {
          fileMap[`${dir.name}/${f}`] = readFileSync(p, 'utf-8');
        }
      }
    }
  } catch { /* ignore */ }

  // Scan glob for .csproj / .sln
  try {
    const entries = readdirSync(projectRoot);
    for (const e of entries) {
      if (e.endsWith('.csproj') || e.endsWith('.sln')) {
        fileMap[e] = readFileSync(resolve(projectRoot, e), 'utf-8');
      }
    }
  } catch { /* ignore */ }

  const detection = detector.detectFromFiles(fileMap);

  // Infrastructure detection from docker-compose
  let infrastructure = { database: null, cache: null, queue: null, search: null, storage: null };
  const composePath = resolve(projectRoot, 'docker-compose.yml');
  if (existsSync(composePath)) {
    infrastructure = detector.detectInfraFromDockerCompose(readFileSync(composePath, 'utf-8'));
  }

  return { ...detection, infrastructure };
}

// ─── Interactive init command ───────────────────────────────

export async function initCommand() {
  logger.info('DevFlow Setup');
  console.log(chalk.dim('═'.repeat(50)));

  const projectRoot = process.cwd();

  // Check for existing .devflow.yml
  const existingConfig = resolve(projectRoot, '.devflow.yml');
  if (existsSync(existingConfig)) {
    const raw = YAML.parse(readFileSync(existingConfig, 'utf-8'));
    if (!raw.version) {
      const { migrate } = await inquirer.prompt([{
        type: 'confirm', name: 'migrate',
        message: 'Found v1 .devflow.yml. Migrate to v2 multi-stack schema?', default: true,
      }]);
      if (migrate) {
        const v2 = migrateV1toV2(raw);
        writeFileSync(existingConfig + '.v1.bak', readFileSync(existingConfig, 'utf-8'));
        writeFileSync(existingConfig, YAML.stringify(v2));
        logger.success('Migrated to v2. Backup saved to .devflow.yml.v1.bak');
        return;
      }
    } else {
      logger.warn('.devflow.yml already exists. Use `devflow doctor` to check setup.');
      return;
    }
  }

  // Detect if existing project or empty
  const isEmpty = readdirSync(projectRoot).filter(f => !f.startsWith('.')).length === 0;

  const { projectName, projectDescription } = await inquirer.prompt([
    { type: 'input', name: 'projectName', message: 'Project name:', default: projectRoot.split('/').pop() },
    { type: 'input', name: 'projectDescription', message: 'Description (optional):' },
  ]);

  let config;

  if (isEmpty) {
    // New project flow
    const { mode } = await inquirer.prompt([{
      type: 'list', name: 'mode', message: 'Setup mode:',
      choices: [
        { name: 'Preset (quick start)', value: 'preset' },
        { name: 'Custom (pick each component)', value: 'custom' },
      ],
    }]);

    if (mode === 'preset') {
      const presets = listPresets();
      const { presetName } = await inquirer.prompt([{
        type: 'list', name: 'presetName', message: 'Select preset:', choices: presets,
      }]);
      config = buildConfigFromPreset({ presetName, projectName, projectDescription });
    } else {
      config = await runCustomFlow(projectName, projectDescription);
    }
  } else {
    // Existing project flow
    logger.step('Scanning project directory...');
    const detected = detectExistingProject(projectRoot);

    if (detected.services.length > 0) {
      console.log(chalk.cyan('\nDetected:'));
      for (const svc of detected.services) {
        console.log(`  ${svc.role}: ${svc.stack} (${svc.path})`);
      }

      const { confirm } = await inquirer.prompt([{
        type: 'confirm', name: 'confirm', message: 'Use detected configuration?', default: true,
      }]);

      if (confirm) {
        config = {
          version: 2,
          project: { name: projectName, description: projectDescription, preset: null, structure: detected.structure },
          services: {},
          infrastructure: detected.infrastructure,
        };
        for (const svc of detected.services) {
          const name = svc.role === 'frontend' ? 'web' : 'api';
          config.services[name] = { ...svc };
        }
      }
    }

    if (!config) {
      config = await runCustomFlow(projectName, projectDescription);
    }
  }

  // Validate
  const result = validateConfig(config);
  if (!result.valid) {
    logger.error('Config validation failed:');
    for (const err of result.errors) {
      console.log(`  ${err.field}: ${err.message}`);
    }
    return;
  }

  config = result.config;

  // Write files
  writeFileSync(resolve(projectRoot, '.devflow.yml'), YAML.stringify(config));
  logger.success('Created .devflow.yml');

  // Generate Docker files
  const docker = new DockerService();
  const composeContent = docker.generateCompose(config);
  writeFileSync(resolve(projectRoot, 'docker-compose.yml'), composeContent);
  logger.success('Created docker-compose.yml');

  for (const [name, svc] of Object.entries(config.services)) {
    const svcPath = svc.path === '.' ? projectRoot : resolve(projectRoot, svc.path);
    mkdirSync(svcPath, { recursive: true });
    const dockerfile = docker.generateDockerfile(svc);
    if (dockerfile) {
      writeFileSync(resolve(svcPath, 'Dockerfile'), dockerfile);
      logger.success(`Created ${svc.path}/Dockerfile`);
    }
  }

  // Generate .env
  const backendService = Object.values(config.services).find(s => s.role === 'backend');
  if (backendService && config.infrastructure) {
    const envVars = generateEnvVars(backendService.stack, config.infrastructure);
    const envContent = Object.entries(envVars).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
    const envExample = Object.entries(envVars).map(([k]) => `${k}=`).join('\n') + '\n';
    writeFileSync(resolve(projectRoot, '.env'), envContent);
    writeFileSync(resolve(projectRoot, '.env.example'), envExample);
    logger.success('Created .env and .env.example');
  }

  // Create .devflow directories
  mkdirSync(resolve(projectRoot, '.devflow/cache'), { recursive: true });
  mkdirSync(resolve(projectRoot, '.devflow/prompts'), { recursive: true });

  console.log('');
  logger.success('DevFlow initialized! Run `devflow doctor` to verify setup.');
}

async function runCustomFlow(projectName, projectDescription) {
  const { backendStack } = await inquirer.prompt([{
    type: 'list', name: 'backendStack', message: 'Backend stack:', choices: BACKEND_STACKS,
  }]);

  const { frontendStack } = await inquirer.prompt([{
    type: 'list', name: 'frontendStack', message: 'Frontend stack:', choices: FRONTEND_STACKS,
  }]);

  const { dbEngine } = await inquirer.prompt([{
    type: 'list', name: 'dbEngine', message: 'Database:', choices: DB_ENGINES,
  }]);

  const { cacheEngine } = await inquirer.prompt([{
    type: 'list', name: 'cacheEngine', message: 'Cache:', choices: CACHE_ENGINES,
  }]);

  const { queueEngine } = await inquirer.prompt([{
    type: 'list', name: 'queueEngine', message: 'Queue:', choices: QUEUE_ENGINES,
  }]);

  return buildConfigFromCustom({
    projectName,
    projectDescription,
    backend: { stack: backendStack, port: 8000 },
    frontend: frontendStack !== 'none' ? { stack: frontendStack, port: 3000 } : null,
    database: dbEngine !== 'none' ? { engine: dbEngine } : null,
    cache: cacheEngine !== 'none' ? { engine: cacheEngine } : null,
    queue: queueEngine !== 'none' ? { engine: queueEngine } : null,
    search: null,
    storage: null,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/init.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/init.js tests/unit/init.test.js
git commit -m "feat: rewrite devflow init with multi-stack, preset, and detection flows"
```

---

### Task 13: Doctor Command

**Files:**
- Modify: `src/commands/doctor.js` (full rewrite)
- Test: `tests/unit/doctor.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/doctor.test.js
import { describe, it, expect } from 'vitest';
import { runChecks } from '../../src/commands/doctor.js';

describe('runChecks', () => {
  it('returns config error when no .devflow.yml', () => {
    const results = runChecks('/nonexistent/path');
    expect(results.some(r => r.category === 'config' && r.status === 'fail')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/doctor.test.js`
Expected: FAIL

- [ ] **Step 3: Rewrite doctor.js**

```javascript
// src/commands/doctor.js
import { existsSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';
import { loadConfig } from '../utils/config.js';
import { validateConfig, migrateV1toV2 } from '../schemas/config-schema.js';

/**
 * Run all doctor checks against a project root. Returns array of results.
 */
export function runChecks(projectRoot) {
  const results = [];

  // Config checks
  const configPath = resolve(projectRoot, '.devflow.yml');
  if (!existsSync(configPath)) {
    results.push({ category: 'config', name: '.devflow.yml exists', status: 'fail', message: 'Not found. Run `devflow init`.' });
    return results;
  }
  results.push({ category: 'config', name: '.devflow.yml exists', status: 'pass' });

  const raw = loadConfig(projectRoot);
  if (!raw) {
    results.push({ category: 'config', name: 'Config parseable', status: 'fail', message: 'Failed to parse YAML.' });
    return results;
  }
  results.push({ category: 'config', name: 'Config parseable', status: 'pass' });

  // Version check
  if (!raw.version) {
    results.push({ category: 'config', name: 'Schema version', status: 'warn', message: 'v1 schema detected. Run `devflow init` to migrate.' });
  } else {
    const validation = validateConfig(raw);
    if (validation.valid) {
      results.push({ category: 'config', name: 'Schema valid', status: 'pass' });
    } else {
      for (const err of validation.errors) {
        results.push({ category: 'config', name: `Schema: ${err.field}`, status: 'fail', message: err.message });
      }
    }
  }

  // Docker checks
  try {
    execSync('docker --version', { stdio: 'pipe' });
    results.push({ category: 'docker', name: 'Docker installed', status: 'pass' });
  } catch {
    results.push({ category: 'docker', name: 'Docker installed', status: 'fail', message: 'Docker not found.' });
  }

  try {
    execSync('docker compose version', { stdio: 'pipe' });
    results.push({ category: 'docker', name: 'Docker Compose installed', status: 'pass' });
  } catch {
    results.push({ category: 'docker', name: 'Docker Compose installed', status: 'fail', message: 'Docker Compose not found.' });
  }

  // Service path checks
  if (raw.services) {
    for (const [name, svc] of Object.entries(raw.services)) {
      const svcPath = svc.path === '.' ? projectRoot : resolve(projectRoot, svc.path);
      if (existsSync(svcPath)) {
        results.push({ category: 'services', name: `${name}: path exists`, status: 'pass' });
      } else {
        results.push({ category: 'services', name: `${name}: path exists`, status: 'fail', message: `Path not found: ${svc.path}` });
      }
    }
  }

  // Port checks
  if (raw.services) {
    for (const [name, svc] of Object.entries(raw.services)) {
      if (svc.port) {
        try {
          execSync(`ss -tlnp | grep :${svc.port}`, { stdio: 'pipe' });
          results.push({ category: 'services', name: `${name}: port ${svc.port}`, status: 'warn', message: 'Port already in use.' });
        } catch {
          results.push({ category: 'services', name: `${name}: port ${svc.port}`, status: 'pass' });
        }
      }
    }
  }

  return results;
}

export async function doctorCommand() {
  logger.info('DevFlow Health Check');
  console.log(chalk.dim('═'.repeat(50)));

  const results = runChecks(process.cwd());

  const icons = { pass: chalk.green('PASS'), fail: chalk.red('FAIL'), warn: chalk.yellow('WARN') };

  let lastCategory = '';
  for (const r of results) {
    if (r.category !== lastCategory) {
      console.log(chalk.bold(`\n${r.category.toUpperCase()}`));
      lastCategory = r.category;
    }
    const msg = r.message ? chalk.dim(` — ${r.message}`) : '';
    console.log(`  ${icons[r.status]} ${r.name}${msg}`);
  }

  const failed = results.filter(r => r.status === 'fail').length;
  const warned = results.filter(r => r.status === 'warn').length;
  console.log('');
  if (failed > 0) {
    logger.error(`${failed} check(s) failed, ${warned} warning(s).`);
  } else if (warned > 0) {
    logger.warn(`All checks passed with ${warned} warning(s).`);
  } else {
    logger.success('All checks passed!');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/doctor.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/doctor.js tests/unit/doctor.test.js
git commit -m "feat: rewrite devflow doctor with multi-service health checks"
```

---

### Task 14: Update CLI Entry Point

**Files:**
- Modify: `bin/devflow.js`

- [ ] **Step 1: Update description and add --workspace option to init**

In `bin/devflow.js`, change:
- Line 10: `'CLI tool to automate PHP developer workflow'` → `'CLI tool to automate multi-stack developer workflow'`
- Add `--workspace` option to the `init` command

```javascript
// Update the init command registration:
program
  .command('init')
  .description('Setup DevFlow for current project')
  .option('--workspace', 'Generate workspace docker-compose for multi-repo')
  .action(async (options) => {
    const { initCommand } = await import('../src/commands/init.js');
    await initCommand(options);
  });
```

- [ ] **Step 2: Run all tests to verify nothing breaks**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add bin/devflow.js
git commit -m "feat: update CLI for multi-stack support, add init --workspace"
```

---

### Task 15: Run Full Test Suite + Final Verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Run `devflow doctor` manually to smoke test**

Run: `node bin/devflow.js doctor`
Expected: Shows health check output (config will fail since no .devflow.yml in project root — that's OK)

- [ ] **Step 3: Verify all new files exist**

Run: `ls src/maps/ src/schemas/ src/presets/ src/services/docker.service.js src/services/scaffold.service.js src/services/detector.service.js src/docker-templates/`
Expected: All files listed

- [ ] **Step 4: Final commit if any loose changes**

```bash
git status
# If anything unstaged, add and commit
```

---

## Chunk 5: Linked Projects + Port Conflict Resolution + Gaps

> **Note on deferred work:** Scanners (`src/scanners/`), parsers (`src/parsers/`), and prompt template restructuring (`src/templates/{backend,frontend}/{stack}/`) are intentionally deferred from this plan. They are described in spec Sections 9.1 and 9.3 as "need per-stack implementation" and will be addressed in a follow-up plan. Similarly, `src/docker-templates/compose-fragments/` is deferred until compose generation needs composable fragments.

> **Note on file path deviations from spec:** This plan groups data maps in `src/maps/` (spec uses `src/utils/env-map.js`) and schema logic in `src/schemas/` (spec uses `src/utils/config.js`). Preset logic lives in `src/presets/index.js` (spec uses `src/services/preset.service.js`). These are intentional for better separation of concerns.

### Task 16: Port Conflict Resolution

**Files:**
- Create: `src/utils/port-resolver.js`
- Test: `tests/unit/port-resolver.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/port-resolver.test.js
import { describe, it, expect } from 'vitest';
import { computePortOffset, resolvePort } from '../../src/utils/port-resolver.js';

describe('computePortOffset', () => {
  it('returns 0 for consistent hash result', () => {
    const offset = computePortOffset('my-app');
    expect(offset).toBeTypeOf('number');
    expect(offset).toBeGreaterThanOrEqual(0);
    expect(offset).toBeLessThan(200);
  });

  it('returns same offset for same name', () => {
    expect(computePortOffset('my-app')).toBe(computePortOffset('my-app'));
  });

  it('returns different offset for different names', () => {
    expect(computePortOffset('app-a')).not.toBe(computePortOffset('app-b'));
  });
});

describe('resolvePort', () => {
  it('returns explicit port as-is (user override wins)', () => {
    expect(resolvePort({ explicitPort: 9999, basePort: 8000, offset: 100 })).toBe(9999);
  });

  it('applies offset to base port when no explicit port', () => {
    expect(resolvePort({ explicitPort: null, basePort: 8000, offset: 100 })).toBe(8100);
  });

  it('applies offset to infra ports', () => {
    expect(resolvePort({ explicitPort: null, basePort: 5432, offset: 50 })).toBe(5482);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/port-resolver.test.js`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```javascript
// src/utils/port-resolver.js

/**
 * Compute a deterministic port offset from project name.
 * Range: 0-199 (step of 1) to avoid collisions with well-known ports.
 */
export function computePortOffset(projectName) {
  let hash = 0;
  for (let i = 0; i < projectName.length; i++) {
    hash = ((hash << 5) - hash + projectName.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 200;
}

/**
 * Resolve a port with offset. User-specified explicit ports always win.
 */
export function resolvePort({ explicitPort, basePort, offset }) {
  if (explicitPort != null) return explicitPort;
  return basePort + offset;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/port-resolver.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/port-resolver.js tests/unit/port-resolver.test.js
git commit -m "feat: add port conflict resolution with project-scoped offset"
```

---

### Task 17: Linked Projects Service

**Files:**
- Create: `src/services/linked.service.js`
- Test: `tests/unit/linked.service.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/linked.service.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LinkedService } from '../../src/services/linked.service.js';

describe('LinkedService', () => {
  let service;

  beforeEach(() => {
    service = new LinkedService();
  });

  describe('resolveLinkedProject', () => {
    it('returns local path config when directory exists', () => {
      // Mock existsSync for local path
      const linkedConfig = {
        repo: 'company/my-app-web',
        local_path: '../my-app-web',
        branch: 'develop',
        role: 'frontend',
        infrastructure_from: 'api',
      };
      const result = service.resolveLinkedProject('web', linkedConfig, '/fake/project');
      expect(result).toHaveProperty('resolvedPath');
      expect(result).toHaveProperty('source'); // 'local' | 'cache' | 'remote'
    });
  });

  describe('resolveInfrastructureFrom', () => {
    it('returns infrastructure from the referenced service config', () => {
      const mainConfig = {
        services: {
          api: { role: 'backend', stack: 'laravel' },
        },
        infrastructure: {
          database: { engine: 'postgresql', version: '16', port: 5432 },
          cache: { engine: 'redis', version: '7', port: 6379 },
        },
      };
      const infra = service.resolveInfrastructureFrom('api', mainConfig);
      expect(infra.database.engine).toBe('postgresql');
      expect(infra.cache.engine).toBe('redis');
    });

    it('returns null when target service not found', () => {
      const infra = service.resolveInfrastructureFrom('nonexistent', { services: {}, infrastructure: {} });
      expect(infra).toBeNull();
    });
  });

  describe('generateWorkspaceCompose', () => {
    it('generates a workspace docker-compose with all repos', () => {
      const projects = [
        {
          name: 'api',
          path: './my-app-api',
          config: {
            services: { api: { role: 'backend', stack: 'laravel', language: { name: 'php', version: '8.3' }, port: 8000, path: '.' } },
            infrastructure: { database: { engine: 'postgresql', version: '16', port: 5432 }, cache: { engine: 'redis', version: '7', port: 6379 } },
          },
        },
        {
          name: 'web',
          path: './my-app-web',
          config: {
            services: { web: { role: 'frontend', stack: 'react', language: { name: 'typescript', version: '20' }, port: 3000, path: '.' } },
          },
          infrastructure_from: 'api',
        },
      ];
      const compose = service.generateWorkspaceCompose(projects);
      expect(compose).toContain('api');
      expect(compose).toContain('web');
      expect(compose).toContain('database');
      expect(compose).toContain('cache');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/linked.service.test.js`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```javascript
// src/services/linked.service.js
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import YAML from 'yaml';
import { DockerService } from './docker.service.js';

export class LinkedService {
  /**
   * Resolve a linked project's config by trying local path, cache, then remote.
   */
  resolveLinkedProject(name, linkedConfig, projectRoot) {
    // 1. Try local_path
    const localPath = resolve(projectRoot, linkedConfig.local_path);
    if (existsSync(localPath)) {
      return { resolvedPath: localPath, source: 'local' };
    }

    // 2. Try cache
    const cachePath = resolve(projectRoot, '.devflow/cache/linked', name);
    if (existsSync(cachePath)) {
      return { resolvedPath: cachePath, source: 'cache' };
    }

    // 3. Remote would require git clone — return info for caller to handle
    return {
      resolvedPath: null,
      source: 'remote',
      repo: linkedConfig.repo,
      branch: linkedConfig.branch || 'main',
    };
  }

  /**
   * Resolve infrastructure from a named service in the main config.
   */
  resolveInfrastructureFrom(serviceName, mainConfig) {
    if (!mainConfig.services?.[serviceName] && !mainConfig.infrastructure) {
      return null;
    }
    return mainConfig.infrastructure || null;
  }

  /**
   * Generate a workspace-level docker-compose.yml for multi-repo setups.
   * Reads infrastructure from whichever project defines it.
   */
  generateWorkspaceCompose(projects) {
    // Find the project that owns infrastructure
    const infraOwner = projects.find(p => p.config.infrastructure && !p.infrastructure_from);

    // Build a merged config for DockerService
    const mergedConfig = {
      project: { name: 'workspace' },
      services: {},
      infrastructure: infraOwner?.config.infrastructure || {},
    };

    for (const proj of projects) {
      for (const [svcName, svc] of Object.entries(proj.config.services)) {
        mergedConfig.services[svcName] = {
          ...svc,
          // Override path to be relative to workspace root
          path: `${proj.path}/${svc.path === '.' ? '' : svc.path}`.replace(/\/+$/, '') || proj.path,
        };
      }
    }

    const docker = new DockerService();
    return docker.generateCompose(mergedConfig);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/linked.service.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/linked.service.js tests/unit/linked.service.test.js
git commit -m "feat: add linked projects service with workspace compose generation"
```

---

### Task 18: Doctor — Add Missing Check Categories + --fix Mode

**Files:**
- Modify: `src/commands/doctor.js`
- Modify: `tests/unit/doctor.test.js`

- [ ] **Step 1: Add tests for missing categories**

Append to `tests/unit/doctor.test.js`:

```javascript
describe('runChecks - infrastructure', () => {
  it('skips infrastructure checks when no infrastructure config', () => {
    // runChecks against a path with .devflow.yml but no infrastructure
    // infrastructure checks should not appear in results
    const results = runChecks('/nonexistent/path');
    const infraResults = results.filter(r => r.category === 'infrastructure');
    expect(infraResults).toEqual([]);
  });
});

describe('runChecks - linked projects', () => {
  it('skips linked checks when no linked_projects config', () => {
    const results = runChecks('/nonexistent/path');
    const linkedResults = results.filter(r => r.category === 'linked');
    expect(linkedResults).toEqual([]);
  });
});

describe('generateFixSuggestions', () => {
  it('suggests devflow init for missing config', () => {
    const results = [{ category: 'config', name: '.devflow.yml exists', status: 'fail', message: 'Not found.' }];
    const { generateFixSuggestions } = require('../../src/commands/doctor.js');
    const fixes = generateFixSuggestions(results);
    expect(fixes).toHaveLength(1);
    expect(fixes[0].command).toContain('devflow init');
  });
});
```

- [ ] **Step 2: Run test to verify new tests fail**

Run: `npx vitest run tests/unit/doctor.test.js`
Expected: FAIL on `generateFixSuggestions`

- [ ] **Step 3: Add infrastructure, linked checks, and --fix to doctor.js**

Add to `runChecks` in `src/commands/doctor.js` before the `return results` line:

```javascript
  // Infrastructure checks (if config has infrastructure)
  if (raw.infrastructure) {
    for (const [category, infra] of Object.entries(raw.infrastructure)) {
      if (!infra || !infra.engine || infra.engine === 'none') continue;
      // Check if container is running
      try {
        execSync(`docker compose ps --status running ${category} 2>/dev/null | grep ${category}`, { stdio: 'pipe' });
        results.push({ category: 'infrastructure', name: `${category}: container running`, status: 'pass' });
      } catch {
        results.push({ category: 'infrastructure', name: `${category}: container running`, status: 'warn', message: 'Container not running. Run `docker compose up -d`.' });
      }
    }
  }

  // Linked project checks
  if (raw.linked_projects) {
    for (const [name, linked] of Object.entries(raw.linked_projects)) {
      const localPath = resolve(projectRoot, linked.local_path);
      if (existsSync(localPath)) {
        results.push({ category: 'linked', name: `${name}: local path`, status: 'pass' });
        // Check if linked project has .devflow.yml
        if (existsSync(resolve(localPath, '.devflow.yml'))) {
          results.push({ category: 'linked', name: `${name}: has config`, status: 'pass' });
        } else {
          results.push({ category: 'linked', name: `${name}: has config`, status: 'warn', message: 'No .devflow.yml in linked project.' });
        }
      } else {
        results.push({ category: 'linked', name: `${name}: local path`, status: 'fail', message: `Not found: ${linked.local_path}` });
      }

      // Check infrastructure_from target exists
      if (linked.infrastructure_from) {
        if (raw.services?.[linked.infrastructure_from] || linked.infrastructure_from === Object.keys(raw.services || {})[0]) {
          results.push({ category: 'linked', name: `${name}: infrastructure_from target`, status: 'pass' });
        } else {
          results.push({ category: 'linked', name: `${name}: infrastructure_from target`, status: 'fail', message: `Target "${linked.infrastructure_from}" not found in services.` });
        }
      }
    }
  }
```

Add `generateFixSuggestions` export:

```javascript
export function generateFixSuggestions(results) {
  const fixes = [];
  for (const r of results) {
    if (r.status !== 'fail') continue;
    if (r.name.includes('.devflow.yml exists')) {
      fixes.push({ check: r.name, command: 'devflow init' });
    } else if (r.name.includes('Docker installed')) {
      fixes.push({ check: r.name, command: 'Install Docker: https://docs.docker.com/get-docker/' });
    } else if (r.name.includes('Docker Compose')) {
      fixes.push({ check: r.name, command: 'Install Docker Compose: https://docs.docker.com/compose/install/' });
    } else if (r.name.includes('path exists')) {
      fixes.push({ check: r.name, command: `mkdir -p ${r.message?.split(': ')[1] || 'path'}` });
    } else if (r.name.includes('container running')) {
      fixes.push({ check: r.name, command: 'docker compose up -d' });
    }
  }
  return fixes;
}
```

Update `doctorCommand` to accept `--fix` option:

```javascript
export async function doctorCommand(options = {}) {
  // ... existing code ...

  if (options.fix) {
    const fixes = generateFixSuggestions(results);
    if (fixes.length > 0) {
      console.log(chalk.bold('\nSuggested fixes:'));
      for (const fix of fixes) {
        console.log(`  ${chalk.cyan(fix.check)}: ${chalk.yellow(fix.command)}`);
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/doctor.test.js`
Expected: PASS

- [ ] **Step 5: Update CLI to add --fix flag to doctor**

In `bin/devflow.js`, update the doctor command:

```javascript
program
  .command('doctor')
  .description('Check DevFlow setup and connections')
  .option('--fix', 'Show suggested fix commands')
  .action(async (options) => {
    const { doctorCommand } = await import('../src/commands/doctor.js');
    await doctorCommand(options);
  });
```

- [ ] **Step 6: Commit**

```bash
git add src/commands/doctor.js tests/unit/doctor.test.js bin/devflow.js
git commit -m "feat: add infrastructure, linked checks, and --fix mode to doctor"
```

---

### Task 19: Init — Add .gitignore Update, Search/Storage Prompts

**Files:**
- Modify: `src/commands/init.js`

- [ ] **Step 1: Add .gitignore update to init command**

In `src/commands/init.js`, after writing `.env` and `.env.example`, add:

```javascript
  // Update .gitignore
  const gitignorePath = resolve(projectRoot, '.gitignore');
  const gitignoreEntries = ['.env', '.devflow/cache/'];
  if (existsSync(gitignorePath)) {
    const existing = readFileSync(gitignorePath, 'utf-8');
    const toAdd = gitignoreEntries.filter(e => !existing.includes(e));
    if (toAdd.length > 0) {
      writeFileSync(gitignorePath, existing.trimEnd() + '\n' + toAdd.join('\n') + '\n');
      logger.success('Updated .gitignore');
    }
  } else {
    writeFileSync(gitignorePath, gitignoreEntries.join('\n') + '\n');
    logger.success('Created .gitignore');
  }
```

- [ ] **Step 2: Add search and storage prompts to custom flow**

Update `runCustomFlow` to include search and storage:

```javascript
  const SEARCH_ENGINES = ['elasticsearch', 'meilisearch', 'typesense', 'none'];
  const STORAGE_ENGINES = ['minio', 'localstack', 'none'];

  const { searchEngine } = await inquirer.prompt([{
    type: 'list', name: 'searchEngine', message: 'Search engine:', choices: SEARCH_ENGINES,
  }]);

  const { storageEngine } = await inquirer.prompt([{
    type: 'list', name: 'storageEngine', message: 'Object storage:', choices: STORAGE_ENGINES,
  }]);

  // Update the return to include:
  // search: searchEngine !== 'none' ? { engine: searchEngine } : null,
  // storage: storageEngine !== 'none' ? { engine: storageEngine } : null,
```

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/commands/init.js
git commit -m "feat: add .gitignore update and search/storage prompts to init"
```

---

### Task 20: Add Go/Rust Warning Detectors

**Files:**
- Modify: `src/services/detector.service.js`

- [ ] **Step 1: Add detector entries for Go and Rust**

Add to `STACK_DETECTORS` array in `src/services/detector.service.js`:

```javascript
  {
    files: ['go.mod'],
    detect: () => ({ stack: 'go', role: 'backend', language: { name: 'go' }, unsupported: true }),
  },
  {
    files: ['Cargo.toml'],
    detect: () => ({ stack: 'rust', role: 'backend', language: { name: 'rust' }, unsupported: true }),
  },
```

- [ ] **Step 2: Add test for Go/Rust detection**

Add to `tests/unit/detector.service.test.js`:

```javascript
    it('detects Go with unsupported flag', () => {
      const result = detector.detectFromFiles({ 'go.mod': 'module example.com/app' });
      expect(result.services[0].stack).toBe('go');
      expect(result.services[0].unsupported).toBe(true);
    });

    it('detects Rust with unsupported flag', () => {
      const result = detector.detectFromFiles({ 'Cargo.toml': '[package]\nname = "app"' });
      expect(result.services[0].stack).toBe('rust');
      expect(result.services[0].unsupported).toBe(true);
    });
```

- [ ] **Step 3: Run test**

Run: `npx vitest run tests/unit/detector.service.test.js`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/services/detector.service.js tests/unit/detector.service.test.js
git commit -m "feat: detect Go and Rust projects with unsupported warning"
```

---

### Task 21: Final Integration Test + Full Suite

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Verify file structure matches plan**

Run: `find src/maps src/schemas src/presets src/services src/docker-templates src/utils/port-resolver.js -type f 2>/dev/null | sort`

Expected output:
```
src/docker-templates/dotnet.Dockerfile
src/docker-templates/java.Dockerfile
src/docker-templates/node.Dockerfile
src/docker-templates/php.Dockerfile
src/docker-templates/python.Dockerfile
src/maps/env-map.js
src/maps/infra-map.js
src/maps/stack-map.js
src/presets/index.js
src/presets/laravel-react.yml
src/presets/... (all preset files)
src/schemas/config-schema.js
src/services/detector.service.js
src/services/docker.service.js
src/services/linked.service.js
src/services/scaffold.service.js
src/utils/port-resolver.js
```

- [ ] **Step 3: Smoke test CLI**

Run: `node bin/devflow.js --help`
Expected: Shows "CLI tool to automate multi-stack developer workflow"

Run: `node bin/devflow.js doctor`
Expected: Shows health check output

- [ ] **Step 4: Final commit if needed**

```bash
git status
```

---

## Modified Files Summary (Updated)

| File | What Changes |
|---|---|
| `src/utils/config.js` | Add `loadAndValidateConfig()` using schema module |
| `src/commands/init.js` | Full rewrite: multi-stack wizard with preset/custom/existing flows, .gitignore update |
| `src/commands/doctor.js` | Full rewrite: 6 check categories, `--fix` mode, `generateFixSuggestions` |
| `bin/devflow.js` | Update description, add `init --workspace`, add `doctor --fix` |
| `tests/unit/config.test.js` | Add test for `loadAndValidateConfig` |
