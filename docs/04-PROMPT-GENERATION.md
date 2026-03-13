# Feature 3: Prompt Generation Engine

## 4.1 Mục tiêu

Kết hợp data từ Jira + Figma + codebase context → sinh ra structured prompt tối ưu cho Claude Code. Đây là **core value** của DevFlow — biến bước thủ công tốn thời gian nhất thành tự động.

## 4.2 Commands

### `devflow prompt <JIRA-ID>`

Generate full prompt từ Jira task. Đây là lệnh chính, gọi tất cả services.

```bash
$ devflow prompt PROJ-456

🔍 Fetching PROJ-456 from Jira...
📐 Found Figma link → extracting specs...
📁 Scanning codebase for related files...
🧠 Generating prompt...

✅ Prompt saved to: .devflow/prompts/PROJ-456.md

Preview:
────────────────────────────────────────
# Task: Implement User Profile API [PROJ-456]

## Context
...
────────────────────────────────────────

📋 Copied to clipboard!
💡 Paste into Claude Code hoặc chạy: devflow prompt PROJ-456 --open
```

**Options:**
- `--template <name>` — Force specific template (api-endpoint, crud-feature, bug-fix, custom)
- `--no-figma` — Skip Figma extraction
- `--no-code-context` — Skip codebase scanning
- `--include <file1,file2>` — Manually include specific files
- `--exclude <pattern>` — Exclude files matching pattern
- `--open` — Open prompt in default editor
- `--copy` — Copy to clipboard (default: true)
- `--dry-run` — Show what would be generated without calling APIs
- `--lang vi|en` — Language of prompt instructions

### `devflow prompt edit <JIRA-ID>`

Mở generated prompt trong editor để chỉnh sửa trước khi dùng.

### `devflow prompt templates`

List available templates.

```bash
$ devflow prompt templates

  Built-in Templates:
  ─────────────────────────────
  api-endpoint    REST API endpoint (CRUD)
  crud-feature    Full CRUD feature with UI specs
  bug-fix         Bug investigation & fix
  migration       Database migration task
  refactor        Code refactoring task
  integration     Third-party integration

  Custom Templates (.devflow/templates/):
  ─────────────────────────────
  payment-flow    Payment integration standard
  report-gen      Report generation task
```

## 4.3 Prompt Templates

Sử dụng Handlebars (.hbs) cho templating.

### 4.3.1 Base Template Structure

Tất cả templates đều follow cấu trúc này:

```handlebars
# Task: {{task.summary}} [{{task.key}}]

## Context

### Project Info
- **Framework**: {{project.type}} {{project.php_version}}
- **Task Type**: {{task.type}} | **Priority**: {{task.priority}}
{{#if task.epic}}
- **Epic**: {{task.epic.key}} — {{task.epic.summary}}
{{/if}}
{{#if task.parent}}
- **Parent Task**: {{task.parent.key}} — {{task.parent.summary}}
{{/if}}

### Task Description
{{task.description}}

### Acceptance Criteria
{{#each task.acceptanceCriteria}}
{{@index}}. {{this}}
{{/each}}

{{#if task.subtasks.length}}
### Subtasks
{{#each task.subtasks}}
- [{{status}}] {{key}}: {{summary}}
{{/each}}
{{/if}}

{{#if task.linkedIssues.length}}
### Related Issues
{{#each task.linkedIssues}}
- {{type}}: {{key}} ({{status}}) — {{summary}}
{{/each}}
{{/if}}

{{#if figma}}
## UI/Design Specs

### Component Structure
{{figma.componentTreeMarkdown}}

### Implied API Fields
| Field | Type | Input | Required | Validation |
|-------|------|-------|----------|------------|
{{#each figma.impliedFields}}
| {{name}} | {{type}} | {{inputType}} | {{#if required}}✅{{else}}❌{{/if}} | {{validationSummary}} |
{{/each}}

### Design Tokens
{{#each figma.designTokens.colors}}
- {{name}}: {{hex}} ({{usage}})
{{/each}}

{{#if figma.responsiveBreakpoints.length}}
### Responsive
{{#each figma.responsiveBreakpoints}}
- **{{name}}** ({{width}}px): {{layout}}
{{/each}}
{{/if}}
{{/if}}

{{#if codeContext}}
## Existing Codebase Context

### Related Files
{{#each codeContext.files}}
#### `{{path}}`
```{{language}}
{{content}}
```
{{/each}}

{{#if codeContext.dbSchema}}
### Database Schema (Related Tables)
```sql
{{codeContext.dbSchema}}
```
{{/if}}

{{#if codeContext.routes}}
### Existing Routes
```php
{{codeContext.routes}}
```
{{/if}}

{{#if codeContext.models}}
### Existing Models
{{#each codeContext.models}}
#### `{{name}}`
```php
{{content}}
```
{{/each}}
{{/if}}
{{/if}}

## Implementation Instructions

{{> (lookup . 'templatePartial') }}

## Constraints & Standards
{{#each project.standards}}
- {{this}}
{{/each}}

## Output Requirements
1. Viết code production-ready, không placeholder
2. Follow PSR-12 coding standard
3. Tạo migration files nếu cần thay đổi DB
4. Viết unit tests cho business logic
5. Viết feature tests cho API endpoints
6. Handle errors properly với appropriate HTTP status codes
7. Thêm validation rules theo Laravel conventions
8. Comment code nơi logic phức tạp
```

### 4.3.2 Template: API Endpoint (`api-endpoint.hbs`)

```handlebars
{{!-- Partial cho API endpoint tasks --}}
### Yêu cầu implement

1. **Route**: Tạo route(s) trong `routes/api.php`
2. **Controller**: Tạo controller với các methods cần thiết
3. **Request Validation**: Tạo Form Request class cho mỗi endpoint
4. **Resource/Transformer**: Tạo API Resource để format response
5. **Service Layer**: Business logic trong Service class, không để trong Controller
6. **Repository** (nếu cần): Data access layer
7. **Migration**: Nếu cần thay đổi DB schema
8. **Tests**: Feature tests cho mỗi endpoint + unit tests cho service

### API Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "Success message",
  "meta": {
    "pagination": { ... }
  }
}
```

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "errors": {
    "field": ["Validation message"]
  }
}
```
```

### 4.3.3 Template: Bug Fix (`bug-fix.hbs`)

```handlebars
{{!-- Partial cho bug fix tasks --}}
### Yêu cầu xử lý

1. **Phân tích root cause**: Đọc description và trace code path liên quan
2. **Reproduce**: Xác nhận có thể reproduce bug theo steps mô tả
3. **Fix**: Implement fix với minimal changes, không refactor không liên quan
4. **Regression test**: Viết test case cover bug scenario
5. **Side effects**: Kiểm tra fix không break functionality khác

### Bug Info
{{#if task.comments.length}}
**Additional context từ comments:**
{{#each task.comments}}
> **{{author}}** ({{created}}): {{body}}
{{/each}}
{{/if}}
```

### 4.3.4 Template: CRUD Feature (`crud-feature.hbs`)

```handlebars
{{!-- Partial cho full CRUD feature --}}
### Yêu cầu implement

1. **Migration**: Tạo DB migration cho table(s) mới
2. **Model**: Eloquent model với relationships, casts, fillable
3. **Routes**: RESTful routes (index, store, show, update, destroy)
4. **Controller**: Resource controller
5. **Form Requests**: StoreRequest + UpdateRequest
6. **API Resources**: Resource + Collection
7. **Service**: CRUD operations + business logic
8. **Policy** (nếu cần): Authorization rules
9. **Observer** (nếu cần): Model events
10. **Tests**: Full CRUD test suite

### CRUD Endpoints
| Method | URI | Action | Middleware |
|--------|-----|--------|-----------|
| GET | /api/{{resourcePlural}} | index | auth:sanctum |
| POST | /api/{{resourcePlural}} | store | auth:sanctum |
| GET | /api/{{resourcePlural}}/{id} | show | auth:sanctum |
| PUT | /api/{{resourcePlural}}/{id} | update | auth:sanctum |
| DELETE | /api/{{resourcePlural}}/{id} | destroy | auth:sanctum |
```

## 4.4 Codebase Context Scanner

### 4.4.1 Mục tiêu

Tự động tìm và attach các file trong codebase liên quan đến task, giúp Claude Code hiểu codebase hiện tại.

### 4.4.2 Scan Strategy

```javascript
// Step 1: Keyword extraction từ task
// Lấy keywords từ: summary, description, acceptance criteria
// Ví dụ: "Implement User Profile API" → ["user", "profile"]

// Step 2: File discovery bằng multiple strategies
const strategies = [
  // a) Name matching — tìm files có tên chứa keywords
  //    "user" → UserController.php, User.php, UserService.php, etc.
  findByFileName(keywords),

  // b) Route matching — scan routes/api.php cho related routes
  //    Tìm routes chứa keywords: Route::resource('users', ...)
  findByRoutes(keywords),

  // c) Model matching — tìm Eloquent models liên quan
  //    User.php → xem relationships → Profile.php, etc.
  findByModels(keywords),

  // d) Migration matching — tìm migrations liên quan
  //    *_create_users_table.php, *_create_profiles_table.php
  findByMigrations(keywords),

  // e) Test matching — tìm existing tests
  //    UserTest.php, UserProfileTest.php
  findByTests(keywords),

  // f) Config/Service Provider — nếu task mention specific service
  findByConfig(keywords),
];

// Step 3: Relevance scoring & dedup
// Rank files by relevance score, limit to config.prompt.max_context_files

// Step 4: Content extraction
// Đọc file content, truncate nếu quá dài (>200 lines → extract key sections)
```

### 4.4.3 DB Schema Extraction

```javascript
// Tìm relevant DB schema từ:
// 1. Migration files → parse Schema::create/table calls
// 2. Model $fillable, $casts, $hidden properties
// 3. Nếu có DB connection config → SHOW CREATE TABLE (optional, risky)

// Output format:
// CREATE TABLE users (
//   id bigint unsigned NOT NULL AUTO_INCREMENT,
//   name varchar(255) NOT NULL,
//   email varchar(255) NOT NULL,
//   ...
// );

// Relationships:
// users hasOne profiles (profiles.user_id → users.id)
// users hasMany posts (posts.user_id → users.id)
```

### 4.4.4 Laravel/Symfony Auto-Detection

```javascript
// Auto-detect framework & conventions:

// Laravel detection:
//   - artisan file exists
//   - composer.json has laravel/framework
//   - app/ directory structure

// Symfony detection:
//   - bin/console exists
//   - composer.json has symfony/framework-bundle
//   - src/ directory structure

// Based on framework, adjust:
//   - File paths to scan (app/Http/Controllers vs src/Controller)
//   - Route file locations
//   - Model/Entity locations
//   - Migration locations
//   - Test locations
//   - Naming conventions
```

## 4.5 Template Auto-Selection

```javascript
// Auto-detect which template to use based on task content:

function selectTemplate(task: ParsedTask): string {
  const text = `${task.summary} ${task.description}`.toLowerCase();

  // Bug fix indicators
  if (task.type === 'bug') return 'bug-fix';
  if (/\b(bug|fix|error|crash|broken|issue|not working)\b/.test(text)) return 'bug-fix';

  // Migration indicators
  if (/\b(migration|migrate|schema|alter table|add column)\b/.test(text)) return 'migration';

  // Refactor indicators
  if (/\b(refactor|refactoring|restructure|optimize|clean.?up)\b/.test(text)) return 'refactor';

  // Integration indicators
  if (/\b(integrat|third.?party|external api|webhook|sdk)\b/.test(text)) return 'integration';

  // CRUD indicators (most common for features)
  if (/\b(crud|create|list|update|delete|manage)\b/.test(text)) return 'crud-feature';

  // API endpoint (default for stories)
  if (/\b(api|endpoint|rest|route)\b/.test(text)) return 'api-endpoint';
  if (task.type === 'story') return 'api-endpoint';

  // Fallback
  return 'api-endpoint';
}
```

## 4.6 Custom Project Standards

Cho phép user define project-specific standards trong `.devflow.yml`:

```yaml
prompt:
  standards:
    - "Sử dụng Repository Pattern cho data access"
    - "Service class cho business logic, không để trong Controller"
    - "Tất cả responses đều wrap trong ApiResponse helper"
    - "Sử dụng Laravel Actions cho complex operations"
    - "DB queries phải dùng Eloquent, tránh raw SQL"
    - "Validate input bằng Form Request, không validate trong controller"
    - "Sử dụng API Resources để transform response"
    - "Mỗi feature phải có Feature Test"
    - "Naming convention: PascalCase cho class, camelCase cho method, snake_case cho DB"
    - "Viết comment bằng tiếng Việt cho business logic phức tạp"
```

## 4.7 Output

Prompt được save dưới dạng Markdown tại `.devflow/prompts/{JIRA-ID}.md` và tự động copy vào clipboard.

Cấu trúc thư mục:
```
.devflow/
├── prompts/
│   ├── PROJ-456.md           # Generated prompt
│   ├── PROJ-456.meta.json    # Metadata (generated at, sources used, etc.)
│   └── PROJ-461.md
├── figma-specs/
│   ├── PROJ-456-figma.json   # Raw Figma data
│   └── PROJ-456-figma.md     # Formatted specs
├── cache/
│   └── figma/                # Figma API cache
└── templates/                # Custom templates
    └── payment-flow.hbs
```
