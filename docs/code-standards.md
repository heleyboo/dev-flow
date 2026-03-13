# Code Standards & Architecture Guidelines

## Language & Runtime

- **Language:** JavaScript (ES Modules)
- **Node.js:** >= 18 LTS
- **Module System:** ESM (type: "module" in package.json)
- **No Build Step:** Pure JS, no transpilation needed
- **Linter:** ESLint 9

## File & Naming Conventions

### JavaScript Files

**Naming Pattern:** kebab-case with descriptive name

```
src/services/jira.service.js
src/commands/task.js
src/utils/api-client.js
src/parsers/adf-parser.js
src/maps/stack-map.js
```

**Rationale:** Self-documenting names for LLM tool discovery (Grep, Glob)

### File Size Management

**Target:** Keep individual files under 200 LOC for optimal context
- Commands: ~80-300 LOC (vary by complexity)
- Services: ~100-450 LOC (split if exceeding)
- Utils: ~10-50 LOC (focused utilities)
- Parsers: ~100-300 LOC (single concern)

**Strategy:** If a file approaches 200 LOC:
1. Identify logical subsystems
2. Extract helper functions to separate files
3. Use composition over inheritance
4. Create dedicated modules for each concern

### Directory Structure

```
src/
├── commands/          # CLI entry points (import from services)
├── services/          # Business logic (orchestration, APIs)
├── utils/             # Helper functions (logging, config, HTTP)
├── parsers/           # Data transformation (ADF, links)
├── maps/              # Static data (stacks, infrastructure)
├── schemas/           # Validation & config structure
├── templates/         # Handlebars prompt templates
├── presets/           # YAML preset configurations
├── docker-templates/  # Dockerfile templates
└── web/               # Express server & API routes
```

## Code Organization

### 3-Layer Architecture

```
Layer 1: Commands (CLI Interface)
  ↓ imports services
Layer 2: Services (Business Logic)
  ↓ imports utils + parsers
Layer 3: Utils + Maps (Data & Helpers)
```

**Dependency Flow:**
- Commands CAN import from Services, Utils, Maps, Parsers
- Services CAN import from Utils, Maps, Parsers, other Services
- Utils/Maps/Parsers CANNOT import from Commands or Services (no circular dependencies)

### Command Pattern

**Each command:** Minimal I/O handling, delegates to service

```javascript
// src/commands/task.js
export async function handleTaskCommand(taskId, options) {
  const config = await loadConfig();
  const service = new JiraService(config.jira);

  const task = await service.getIssue(taskId);
  displayTask(task);
  return task;
}
```

### Service Pattern

**Each service:** Pure business logic, testable, composable

```javascript
// src/services/jira.service.js
export class JiraService {
  constructor(config) {
    this.config = config;
    this.client = new APIClient(config.host, config.token);
  }

  async getIssue(issueKey) {
    // API call + error handling
  }

  async transitionIssue(issueKey, status) {
    // Transition logic
  }
}
```

## Code Quality Standards

### Error Handling

**Always use try-catch for async operations:**

```javascript
try {
  const result = await service.action();
  return result;
} catch (error) {
  logger.error(`Failed to ${action}:`, error.message);
  throw new Error(`${action} failed: ${error.message}`);
}
```

**Specific error messages:**
```javascript
// Good
throw new Error(`Jira API error: ${response.status} - ${response.body}`);

// Avoid
throw new Error('API call failed');
```

### Logging

**Use logger utility (no console.log):**

```javascript
import { logger } from '../utils/logger.js';

logger.success('Task fetched successfully');
logger.info('Connecting to Jira...');
logger.warn('Config file not found, using defaults');
logger.error('Deploy failed:', error);
```

**Format:** [action] [status] [message]

### Async/Await

**Prefer async/await over .then():**

```javascript
// Good
const tasks = await jira.listTasks();
const specs = await figma.getDesign(designId);

// Avoid
jira.listTasks().then(tasks => {...}).catch(...);
```

### Variable Naming

**Use descriptive camelCase:**

```javascript
// Good
const taskDescription = task.fields.summary;
const isProductionEnvironment = env === 'production';
const maxRetries = 3;
const apiResponseData = response.body;

// Avoid
const d = task.fields.summary;
const prod = env === 'production';
const max = 3;
const data = response.body;
```

### Constants

**UPPERCASE_SNAKE_CASE for constants:**

```javascript
const MAX_RETRIES = 3;
const DEFAULT_PORT = 8000;
const JIRA_API_VERSION = 3;
const SUPPORTED_STACKS = ['laravel', 'django', 'express'];
```

### Function Naming

**Verb + Noun pattern:**

```javascript
// Good
async function fetchTaskFromJira(taskId) {}
function formatCommitMessage(taskId, type, message) {}
function validateConfig(config) {}
function parseADFToMarkdown(adfContent) {}

// Avoid
async function getTask(taskId) {}  // "get" vs "fetch" inconsistent
function format(data) {}             // unclear what's formatted
function check(config) {}             // "check" is vague
```

## Testing Standards

### Test Framework

**Vitest** with coverage reporting

```javascript
// tests/unit/jira.service.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { JiraService } from '../../src/services/jira.service.js';

describe('JiraService', () => {
  let service;

  beforeEach(() => {
    service = new JiraService({
      host: 'https://example.atlassian.net',
      token: 'test-token'
    });
  });

  it('should fetch issue by key', async () => {
    const issue = await service.getIssue('PROJ-123');
    expect(issue.key).toBe('PROJ-123');
  });
});
```

### Coverage Requirements

- **Unit Tests:** ≥80% coverage for services/parsers
- **Commands:** ≥50% coverage (UI layer, OK to have less)
- **Utils:** ≥80% coverage (critical for reliability)

### Test Naming

**Describe + clear assertion:**

```javascript
// Good
it('should return formatted markdown when ADF contains lists', () => {});
it('should throw error when API token is missing', () => {});
it('should cache results for 1 hour', () => {});

// Avoid
it('works', () => {});
it('test getMarkdown', () => {});
it('error handling', () => {});
```

## Security Standards

### Secrets Management

**NEVER commit secrets:**
- API tokens → environment variables
- SSH keys → .ssh directory (gitignored)
- Database passwords → .env file (gitignored)

**Check before commit:**
```bash
npm run lint
grep -r "password" src/ --exclude-dir=node_modules
grep -r "token" src/ --exclude-dir=node_modules
```

### API Calls

**Always use environment variables:**

```javascript
// Good
const token = process.env.DEVFLOW_JIRA_TOKEN;
const client = new APIClient(host, token);

// Avoid
const token = 'hardcoded-token-123';
const client = new APIClient(host, token);
```

### SSH/Deploy

**Validate before executing:**

```javascript
if (env === 'production' && !isConfirmed) {
  throw new Error('Production deployment requires explicit confirmation');
}

await validateSSHKey(host, user);
await executeDeploymentSteps(commands);
```

## Performance Standards

### API Caching

**Cache API responses when appropriate:**

```javascript
// Use Redis or in-memory cache for repeated calls
async function getCachedIssue(issueKey) {
  const cacheKey = `jira:issue:${issueKey}`;
  const cached = await cache.get(cacheKey);

  if (cached) return cached;

  const issue = await jiraAPI.getIssue(issueKey);
  await cache.set(cacheKey, issue, 3600); // 1 hour TTL
  return issue;
}
```

### Config Loading

**Load and cache config once:**

```javascript
let cachedConfig = null;

export async function getConfig() {
  if (!cachedConfig) {
    cachedConfig = await loadConfigFile();
  }
  return cachedConfig;
}
```

### Retry Logic

**Use exponential backoff for API calls:**

```javascript
async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
```

## Documentation Standards

### JSDoc Comments

**Use for public APIs:**

```javascript
/**
 * Fetch Jira issue by key
 * @param {string} issueKey - The JIRA issue key (e.g., 'PROJ-123')
 * @returns {Promise<Object>} Issue object with fields, transitions, etc.
 * @throws {Error} If API call fails or issue not found
 * @example
 * const issue = await jira.getIssue('PROJ-123');
 */
export async function getIssue(issueKey) {
  // implementation
}
```

### Inline Comments

**Only for complex logic:**

```javascript
// Good
// ADF stores emphasis as { mark: 'em' }, convert to markdown *text*
const markdownText = adf.content.map(node => {
  if (node.mark.name === 'em') {
    return `*${node.text}*`;
  }
});

// Avoid
// This is a variable
const x = 5;
```

### README for Services

**Top of each service file:**

```javascript
/**
 * JiraService - Jira REST API integration
 *
 * Handles:
 * - Issue fetching and parsing
 * - Status transitions
 * - Custom field reading
 * - Comment posting
 *
 * Dependencies: APIClient
 * Used by: Commands (task, prompt, ship)
 */
export class JiraService {
  // ...
}
```

## Git & Commit Standards

### Commit Message Format

**Conventional Commits:**

```
feat: add Figma token caching
fix: handle missing custom fields in Jira response
docs: update deployment guide
refactor: simplify ADFParser into smaller functions
test: add coverage for edge cases
chore: update dependencies
```

**Format:** `<type>: <description>`

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `refactor` - Code refactoring (no feature/fix)
- `test` - Test additions/changes
- `chore` - Dependency updates, build scripts

### No Secrets in Commits

**Before commit:**
```bash
npm run lint
grep -r "DEVFLOW_" src/commands/ | grep -v "process.env"
grep -r "password\|token\|secret" . --include="*.js" | grep -v "node_modules"
```

## ESLint Configuration

**Run before committing:**

```bash
npm run lint
npm run lint:fix
```

**Key Rules:**
- No unused variables
- No console.log (use logger)
- Consistent arrow function style
- Require async/await over promises
- Enforce error handling in try-catch

## Dependencies Management

### Adding Dependencies

**Process:**
1. Check if existing dependency covers the need
2. Prefer established packages (lodash, date-fns, etc.)
3. Update package.json
4. Run `npm install`
5. Commit package-lock.json
6. Add to devDependencies if it's a dev-only tool

### Version Pinning

```json
{
  "dependencies": {
    "express": "^4.21.0",     // Allow patch updates
    "commander": "^12.1.0"     // Allow minor updates
  }
}
```

## Module Imports/Exports

**Prefer named exports:**

```javascript
// Good - explicit about what's exported
export async function fetchIssue(id) {}
export class JiraService {}

// Use
import { fetchIssue, JiraService } from './jira.service.js';

// Avoid - default exports (harder to search)
export default { fetchIssue, JiraService };
```

**Use absolute imports within src:**

```javascript
// From src/commands/task.js
import { JiraService } from '../services/jira.service.js';
import { logger } from '../utils/logger.js';

// Not relative paths when possible
```

## Special File Types

### Configuration Files (.yml)

**Use YAML for project config (.devflow.yml):**

```yaml
project:
  name: "my-app"
  type: "laravel"

jira:
  host: "https://company.atlassian.net"
  email: "dev@company.com"
```

### Handlebars Templates

**Keep templates simple, logic in service:**

```handlebars
# {{taskId}}: {{title}}

## Task Details
- Type: {{type}}
- Priority: {{priority}}

## Acceptance Criteria
{{#each acceptanceCriteria}}
- {{this}}
{{/each}}

{{> api-endpoint}}  {{!-- Include partial --}}
```

### Docker Templates

**Language-specific Dockerfiles:**

```dockerfile
FROM php:8.2-fpm-alpine
WORKDIR /app
COPY . .
RUN composer install --no-dev
CMD ["php-fpm"]
```

## Pre-commit Checklist

Before pushing:

- [ ] All tests pass: `npm run test`
- [ ] No linting errors: `npm run lint`
- [ ] No secrets committed: `grep -r "password\|token" src/`
- [ ] Descriptive commit message (conventional format)
- [ ] Related documentation updated
- [ ] Code follows 200 LOC file size guidelines
- [ ] Error handling in place for external APIs

## Refactoring Guidelines

**When to refactor:**

1. **File Size:** Exceeds 200 LOC
2. **Complexity:** Cyclomatic complexity > 10
3. **Duplication:** Same logic appears 3+ times
4. **Clarity:** Hard to understand at first read

**How to refactor:**

1. Write tests first
2. Extract to new file/function
3. Update imports
4. Run tests: `npm run test`
5. Commit: `refactor: extract X from Y`

## Performance Profiling

**For long-running operations:**

```javascript
const startTime = Date.now();
// operation
const duration = Date.now() - startTime;
logger.info(`Operation completed in ${duration}ms`);
```

**Measure API call times:**

```javascript
async function getIssueWithTiming(issueKey) {
  const start = Date.now();
  const issue = await jira.getIssue(issueKey);
  const duration = Date.now() - start;
  logger.debug(`Fetched ${issueKey} in ${duration}ms`);
  return issue;
}
```

## Accessibility & CLI Output

**Format terminal output clearly:**

```javascript
// Use Chalk for colors
console.log(chalk.green('✓ Success'));
console.log(chalk.red('✗ Error'));
console.log(chalk.yellow('⚠ Warning'));

// Use Boxen for emphasis
console.log(boxen('Important Message', { padding: 1 }));

// Use Table for data
console.table([{ id: 1, name: 'Task' }]);
```

**Always provide `--json` output option:**

```javascript
// Allow piping to other tools
if (options.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  displayFormattedOutput(result);
}
```

## Summary

**Key Principles:**
- Modular: Small, focused files and functions
- Tested: ≥80% unit test coverage
- Documented: JSDoc for public APIs
- Secure: No secrets in code
- Performant: Cache, retry, optimize
- Maintainable: Clear naming, error handling, logging
