# System Architecture

## High-Level Design

DevFlow is a **3-layer automation platform** that connects Jira, Figma, Git, and deployment infrastructure through intelligent orchestration.

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: CLI Commands (User Interface)                     │
│  init | task | doctor | figma | prompt | start | ship       │
│  deploy | test:api | test:e2e | web                         │
└────────────────────┬────────────────────────────────────────┘
                     │ orchestrate
┌────────────────────▼────────────────────────────────────────┐
│  Layer 2: Services (Business Logic)                         │
│  Jira | Figma | Git | Deploy | Prompt | Test | Detector   │
└────────────────────┬────────────────────────────────────────┘
                     │ use
┌────────────────────▼────────────────────────────────────────┐
│  Layer 3: Utilities & Data                                  │
│  Config | Logger | APIClient | Parsers | Maps              │
└─────────────────────────────────────────────────────────────┘
```

## Architecture Patterns

### Command → Service Pattern

Each command is a thin wrapper around one or more services:

```javascript
// src/commands/task.js
export async function handleTaskCommand(taskId, options) {
  const config = loadConfig();
  const jira = new JiraService(config.jira);
  const task = await jira.getIssue(taskId);
  displayTask(task);  // Format output
}
```

**Benefits:**
- Commands: ~80-200 LOC (thin)
- Services: ~100-450 LOC (testable)
- Clear separation of concerns
- Easy to test services independently

### Service Composition

Services are self-contained, composable modules:

```javascript
// Services use other services
class PromptService {
  constructor(jiraService, figmaService, codebaseService) {
    this.jira = jiraService;
    this.figma = figmaService;
    this.codebase = codebaseService;
  }

  async generatePrompt(taskId) {
    const task = await this.jira.getIssue(taskId);
    const design = await this.figma.getDesignFromTask(task);
    const code = await this.codebase.getRelevantFiles(task);
    return this.compilePrompt(task, design, code);
  }
}
```

**Benefits:**
- Reusable logic
- Easy to mock for testing
- Single responsibility

### Caching Layer

Multiple layers of caching for performance:

```javascript
// Layer 1: In-memory cache (process lifetime)
class ConfigCache {
  #cache = null;

  async load() {
    if (!this.#cache) {
      this.#cache = await loadConfigFile();
    }
    return this.#cache;
  }
}

// Layer 2: Redis cache (across processes)
async function getCachedIssue(issueKey) {
  const cached = await redis.get(`jira:${issueKey}`);
  if (cached) return JSON.parse(cached);

  const issue = await jiraAPI.getIssue(issueKey);
  await redis.set(`jira:${issueKey}`, JSON.stringify(issue), 'EX', 3600);
  return issue;
}
```

## Data Flow Diagrams

### Workflow 1: Task → Prompt Generation

```
User: devflow prompt PROJ-123
    ↓
PromptCommand
    ├─ LoadConfig() → .devflow.yml
    ├─ JiraService.getIssue(PROJ-123)
    │  └─ APIClient.fetch(jira.host/rest/api/3/issues/PROJ-123)
    │     └─ Return: task description, AC, custom fields
    │
    ├─ LinkExtractor.extractLinks(task.description)
    │  └─ Return: [ figma URLs, SRS links ]
    │
    ├─ FigmaService.getDesign(figmaURL)
    │  └─ APIClient.fetch(figma.api/files/{fileKey})
    │     └─ Return: design tree, components, tokens
    │
    ├─ CodebaseScanner.findRelevantFiles(task)
    │  └─ Scan src/ for related models, routes, components
    │     └─ Return: [ file paths, code snippets ]
    │
    └─ PromptService.generatePrompt(task, design, code)
       ├─ Detect task type (CRUD, API, bug-fix)
       ├─ Select template (api-endpoint.hbs)
       ├─ Compile with Handlebars
       └─ Copy to clipboard

Output: Prompt copied to clipboard
```

### Workflow 2: Start → Ship → Deploy

```
User: devflow start PROJ-123
    ↓
ShipCommand
    ├─ JiraService.getIssue(PROJ-123)
    ├─ GitService.createBranch(PROJ-123)
    │  └─ simple-git: git checkout -b feature/PROJ-123-short-desc
    ├─ JiraService.transitionIssue(PROJ-123, "In Progress")
    └─ Output: "Branch created, issue updated"

User: (implement, commit, push)

User: devflow ship
    ├─ GitService.validateWorkingTree()
    ├─ GitService.commitAll() → "[PROJ-123] feat: message"
    ├─ GitService.push() → git push origin feature/PROJ-123-...
    ├─ GitService.createPR(branchName, "PROJ-123: Title")
    ├─ JiraService.transitionIssue(PROJ-123, "In Review")
    └─ Output: "PR created, issue transitioned"

User: devflow deploy
    ├─ LoadConfig() → deployment config
    ├─ DeployService.preDeployChecks()
    │  ├─ Validate branch is up-to-date
    │  ├─ Verify SSH key
    │  └─ Run health checks on staging
    ├─ DeployService.deploy("staging")
    │  ├─ SSH to host
    │  ├─ Execute deployment commands
    │  └─ Health check
    └─ Output: "Deploy successful"
```

### Workflow 3: Test Generation

```
User: devflow test:api PROJ-123
    ↓
APITestCommand
    ├─ JiraService.getIssue(PROJ-123)
    ├─ LinkExtractor.extractEndpoints(task.description)
    │  └─ Parse AC: "GET /api/users returns 200"
    ├─ CodebaseScanner.discoverEndpoints()
    │  └─ Scan routes/ for actual endpoints
    ├─ APITestService.generateTests(endpoints)
    │  ├─ Generate .http files
    │  ├─ Generate Postman collection
    │  └─ Generate Jest test code
    └─ Output: "Tests generated in .devflow/tests/"

User: devflow test:api run
    ├─ Load generated tests
    ├─ Run Jest/Vitest
    └─ Output: "Test results"
```

## Service Architecture

### JiraService

```javascript
class JiraService {
  // Constructor
  constructor(config)  // host, email, token

  // Core Methods
  async getIssue(issueKey)           // Fetch issue details
  async listIssues(query)            // Query with JQL
  async transitionIssue(key, status) // Change status
  async addComment(key, comment)     // Post comment
  async getCustomField(key, field)   // Extract custom field

  // Helpers
  async searchLinkedIssues(parentKey)
  async getSubtasks(issueKey)

  // Dependencies
  - APIClient (HTTP calls)
  - ADFParser (Jira format → Markdown)
}
```

### FigmaService

```javascript
class FigmaService {
  constructor(config)  // project_id, token

  // Core Methods
  async getFile(fileKey)             // Fetch design file
  async getComponent(componentId)    // Get single component
  async extractComponentTree(file)   // Parse hierarchy
  async extractTokens(file)          // Design system tokens
  async inferProperties(component)   // UI property inference

  // Caching
  async getCachedFile(fileKey)       // With TTL

  // Dependencies
  - APIClient (HTTP calls)
  - Cache layer (Redis-ready)
}
```

### GitService

```javascript
class GitService {
  constructor(config)  // branch_prefix, base_branch, etc.

  // Workflow Methods
  async createBranch(issueId)        // Create feature branch
  async commitAll(message)           // Commit all changes
  async push(branchName)             // Push to remote
  async createPullRequest(...)       // GitHub API

  // Helpers
  generateBranchName(issueId)        // Smart naming
  generateCommitMessage(issueId, type)

  // Dependencies
  - simple-git (Git operations)
  - APIClient (GitHub API)
}
```

### PromptService

```javascript
class PromptService {
  constructor(jiraService, figmaService, codebaseService)

  // Core Methods
  async generatePrompt(taskId, options)  // Complete pipeline
  async detectTaskType(task)             // CRUD | API | Bug | etc.
  async selectTemplate(type)             // Pick .hbs file
  async compileTemplate(template, data)  // Handlebars render
  async getRelevantCode(task)            // Code scanner

  // Template Methods
  async renderBackendPrompt(task, figma, code)
  async renderFrontendPrompt(task, figma, api)

  // Dependencies
  - JiraService
  - FigmaService
  - CodebaseScanner
  - Handlebars (template engine)
}
```

### DeployService

```javascript
class DeployService {
  constructor(config)  // environments with SSH/Docker strategies

  // Deploy Methods
  async deploy(environment)          // Main deployment
  async preDeployChecks()            // Validation
  async postDeployChecks()           // Health check
  async rollback(version)            // Revert to previous
  async getDeployStatus()            // Current status
  async getDeployLog(environment)    // History

  // Strategy Methods
  async deployViaSsh(host, commands)
  async deployViaDocker(...)
  async deployCustom(hooks)

  // Dependencies
  - node-ssh (SSH operations)
  - Docker API
}
```

### APITestService & E2ETestService

```javascript
class APITestService {
  async generateTests(endpoints, options)
  async formatAsHTTP(endpoint)       // .http file
  async formatAsPostman(endpoints)   // JSON collection
  async formatAsJest(endpoints)      // Test code
}

class E2ETestService {
  async generateTests(acceptanceCriteria)
  async generatePlaywright(scenarios)
  async generateCypress(scenarios)
  async generatePageObjects(...)
}
```

## Configuration Architecture

### Config Loading Pipeline

```
.devflow.yml (project config)
    ↓
Config.load()
    ├─ Parse YAML
    ├─ Validate against schema
    ├─ Handle v1→v2 migration
    ├─ Interpolate env vars
    └─ Cache in memory
```

### Config Structure

```yaml
project:          # Project metadata
  name: string
  type: stack     # backend stack type

jira:             # Jira API config
  host: url
  email: string
  project_key: string

figma:            # Figma API config
  default_project: string

git:              # Git workflow config
  branch_prefix: string
  base_branch: string

deploy:           # Environment-specific deploy config
  environment:
    type: strategy (ssh|docker|custom)
    host: string
    ...

test:             # Test generation config
  api:
    base_url: url
  e2e:
    framework: playwright|cypress
```

## External Integrations

### Jira REST API (v3)

**Endpoints Used:**
- `GET /rest/api/3/issues/{issueKey}` - Fetch issue
- `GET /rest/api/3/issues/search` - Query issues
- `POST /rest/api/3/issues/{issueKey}/transitions` - Transition
- `POST /rest/api/3/issues/{issueKey}/comments` - Comment

**Authentication:** Bearer token in Authorization header

### Figma API

**Endpoints Used:**
- `GET /v1/files/{file_key}` - Get design file
- `GET /v1/files/{file_key}/comments` - Get comments

**Authentication:** Bearer token in X-Figma-Token header

### GitHub API

**Endpoints Used:**
- `POST /repos/{owner}/{repo}/pulls` - Create PR
- `GET /repos/{owner}/{repo}/branches` - List branches

**Authentication:** Personal Access Token

### SSH Deployment

**Operations:**
- SSH key validation
- Remote command execution
- File upload via SCP
- Health check via HTTP

**Authentication:** SSH keypair

## Error Handling Strategy

### Retry Logic with Exponential Backoff

```javascript
async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      logger.warn(`Retry attempt ${attempt}/${maxRetries} in ${delay}ms`);
      await sleep(delay);
    }
  }
}
```

### Error Classification

```javascript
// API errors (retryable)
if (error.status >= 500) {
  return withRetry(apiCall);
}

// User input errors (not retryable)
if (error.status === 400 || error.status === 401) {
  throw new Error(`Invalid input: ${error.message}`);
}

// Network errors (retryable)
if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
  return withRetry(apiCall);
}
```

## Performance Optimizations

### API Call Optimization

1. **Batching:** Fetch multiple resources in one request when possible
2. **Caching:** Cache Jira/Figma responses with TTL
3. **Lazy Loading:** Load design details only when needed
4. **Parallel Requests:** Concurrent API calls where safe

```javascript
// Parallel API calls
const [task, design, code] = await Promise.all([
  jira.getIssue(issueKey),
  figma.getDesign(designUrl),
  codebase.getRelevantFiles(issueKey)
]);
```

### Caching Strategy

```javascript
// Layer 1: In-process cache
const configCache = {};
configCache[projectPath] = config;

// Layer 2: File-based cache (.devflow/cache/)
fs.writeFileSync('.devflow/cache/jira-PROJ-123.json', JSON.stringify(issue));

// Layer 3: Redis cache (if configured)
await redis.setex(`jira:${issueKey}`, 3600, JSON.stringify(issue));
```

## Security Architecture

### Credential Management

```
Environment Variables (Secrets)
    ↓
APIClient (adds to headers)
    ↓
API Calls (over HTTPS)
    ↓
Response (never logged)
```

**Never logged:**
- API tokens
- SSH keys
- Passwords
- Private URLs

### Deploy Safety

```javascript
// Production requires explicit confirmation
if (environment === 'production') {
  const confirmed = await prompt.confirm('Deploy to PRODUCTION?');
  if (!confirmed) throw new Error('Deploy cancelled');
}

// Pre-deploy validation
await validateBranchUpToDate();
await validateSSHConnection();
await validateDeployScripts();
```

## Scalability Considerations

### Current Design

- Single-process CLI tool
- Works for 1-3 developers per machine
- Config per project (.devflow.yml)

### Future Scaling

1. **Web Dashboard** - Multi-user via Express server
2. **Redis Cache** - Shared cache across processes
3. **API Server** - Standalone API for IDE plugins
4. **Worker Queue** - Background deploys via Bull/Kue
5. **Webhook Integration** - Listen to Jira/GitHub events

## Testing Architecture

### Unit Test Layers

```
Commands (thin wrappers)
    ↓ mock services
Services (business logic)
    ↓ mock APIs
Utils (pure functions)
    ↓ no mocks (pure functions)
```

### Mock Strategy

```javascript
// Mock external APIs
vi.mock('../services/jira.service.js', () => ({
  JiraService: vi.fn().mockImplementation(() => ({
    getIssue: vi.fn().mockResolvedValue(mockIssue)
  }))
}));

// Test in isolation
const service = new JiraService(config);
expect(service.getIssue).toHaveBeenCalledWith('PROJ-123');
```

## Deployment Architecture

### Local Development

```
npm run dev → node --watch bin/devflow.js web
    ↓
Watch for file changes
    ↓
Restart CLI when modified
```

### Production Install

```bash
npm install -g devflow-cli
# Or: npm install --save-dev devflow-cli (project-level)

devflow init  # Setup per-project
devflow task PROJ-123
```

### Web Dashboard

```
Express Server (port 3456)
    ├─ REST API
    │  ├─ /config
    │  ├─ /tasks
    │  ├─ /deploy
    │  └─ /prompt
    ├─ Static files
    └─ WebSocket (SSE for live logs)
```

## Data Persistence

### File-Based Storage

```
project-root/
├── .devflow.yml         # Config
├── .devflow/
│   ├── cache/          # API response cache
│   ├── prompts/        # Generated prompts
│   ├── tests/          # Generated tests
│   └── deploy-logs/    # Deploy history
└── .gitignore          # Exclude cache
```

### Caching

- **In-memory:** Config, small API responses
- **File-based:** Larger responses (.devflow/cache/)
- **Redis:** Distributed cache (future)

## Related Diagrams

For architecture diagrams, see:
- **Data Flow:** system-architecture.md (this file)
- **Deployment:** docs/06-DEPLOY-AUTOMATION.md
- **API Routes:** docs/07-WEB-DASHBOARD.md
- **Testing:** docs/10-API-TESTING.md, docs/11-E2E-TESTING.md
