# Feature 1: Jira → Structured Prompt

## 2.1 Mục tiêu

Tự động fetch task từ Jira, parse toàn bộ thông tin, và biến thành structured context mà Claude Code có thể hiểu ngay.

## 2.2 Commands

### `devflow task <JIRA-ID>`

Fetch và hiển thị task summary trong terminal.

```bash
$ devflow task PROJ-456

╔══════════════════════════════════════════════════════╗
║  PROJ-456: Implement User Profile API                ║
╠══════════════════════════════════════════════════════╣
║  Type: Story          Priority: High                 ║
║  Sprint: Sprint 23    Assignee: dev@company.com      ║
║  Status: In Progress  Story Points: 5                ║
╠══════════════════════════════════════════════════════╣
║  Parent Epic: PROJ-100 (User Management Module)      ║
║  Figma: https://figma.com/file/abc123...             ║
║  SRS Ref: Section 4.2 - User Profile                 ║
╠══════════════════════════════════════════════════════╣
║  Subtasks:                                           ║
║    ☑ PROJ-457: Design DB schema                      ║
║    ☐ PROJ-458: Create API endpoints                  ║
║    ☐ PROJ-459: Write unit tests                      ║
╠══════════════════════════════════════════════════════╣
║  Acceptance Criteria:                                ║
║  1. GET /api/users/{id}/profile returns user profile ║
║  2. PUT /api/users/{id}/profile updates profile      ║
║  3. Profile image upload via multipart/form-data     ║
║  4. Validation: name max 100 chars, bio max 500      ║
╚══════════════════════════════════════════════════════╝
```

**Options:**
- `--json` — Output raw JSON (pipe to other tools)
- `--with-comments` — Include Jira comments
- `--with-history` — Include status change history
- `--with-links` — Include linked issues

### `devflow task list`

Hiển thị danh sách tasks được assign cho current user.

```bash
$ devflow task list

  Your Tasks (Sprint 23):
  ─────────────────────────────────────────
  PROJ-456  [In Progress]  Implement User Profile API
  PROJ-461  [To Do]        Fix password reset flow
  PROJ-470  [To Do]        Add pagination to list API
```

**Options:**
- `--status <status>` — Filter by status (todo, inprogress, review, done)
- `--sprint <name>` — Filter by sprint
- `--priority <level>` — Filter by priority

## 2.3 Jira Service — Chi tiết kỹ thuật

### 2.3.1 Authentication

```javascript
// Sử dụng Jira REST API v3
// Auth: Basic Auth (email:api_token) encoded Base64

const auth = Buffer.from(
  `${config.jira.email}:${process.env.DEVFLOW_JIRA_TOKEN}`
).toString('base64');

const headers = {
  'Authorization': `Basic ${auth}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};
```

### 2.3.2 API Endpoints cần dùng

| Mục đích | Method | Endpoint |
|----------|--------|----------|
| Lấy issue detail | GET | `/rest/api/3/issue/{issueKey}` |
| Lấy issue comments | GET | `/rest/api/3/issue/{issueKey}/comment` |
| Lấy subtasks | GET | `/rest/api/3/search?jql=parent={issueKey}` |
| Lấy linked issues | GET | (included in issue detail `fields.issuelinks`) |
| Lấy sprint board | GET | `/rest/agile/1.0/board/{boardId}/sprint` |
| Lấy tasks của user | GET | `/rest/api/3/search?jql=assignee=currentUser()` |
| Transition issue | POST | `/rest/api/3/issue/{issueKey}/transitions` |
| Add comment | POST | `/rest/api/3/issue/{issueKey}/comment` |

### 2.3.3 Data Model — Parsed Task

```typescript
interface ParsedTask {
  key: string;                  // "PROJ-456"
  summary: string;              // "Implement User Profile API"
  description: string;          // Full description (parsed from ADF to markdown)
  type: 'story' | 'bug' | 'task' | 'subtask' | 'epic';
  priority: 'highest' | 'high' | 'medium' | 'low' | 'lowest';
  status: string;
  assignee: string;
  reporter: string;
  sprint: string | null;
  storyPoints: number | null;

  // Parent & children
  epic: { key: string; summary: string } | null;
  parent: { key: string; summary: string } | null;
  subtasks: Array<{
    key: string;
    summary: string;
    status: string;
  }>;

  // Links & references
  figmaLinks: string[];         // Extracted from description + custom fields
  srsReferences: string[];      // Extracted from description + custom fields
  linkedIssues: Array<{
    type: string;               // "blocks", "is blocked by", "relates to"
    key: string;
    summary: string;
    status: string;
  }>;

  // Acceptance criteria
  acceptanceCriteria: string[]; // Parsed from description

  // Metadata
  labels: string[];
  components: string[];
  fixVersions: string[];
  comments: Array<{
    author: string;
    body: string;
    created: string;
  }>;

  // Custom fields (configurable)
  customFields: Record<string, any>;

  // Raw
  _raw: object;                 // Original Jira response
}
```

### 2.3.4 Description Parser

Jira sử dụng Atlassian Document Format (ADF). Cần convert sang markdown:

```javascript
// ADF → Markdown converter
// Xử lý các node types:
//   - paragraph → plain text + \n\n
//   - heading → # ## ### tương ứng
//   - bulletList → - items
//   - orderedList → 1. items
//   - codeBlock → ```lang\ncode\n```
//   - table → markdown table
//   - mediaSingle → ![image](url)
//   - inlineCard → [title](url)   ← đây thường chứa Figma links
//   - mention → @username
//   - panel → > blockquote (info/warning/error panels)

// Acceptance Criteria extraction:
// Tìm section có heading "Acceptance Criteria" hoặc patterns:
//   - "AC:" hoặc "AC :"
//   - Numbered list sau heading
//   - Checkbox list (☐ / ☑)
//   - "Given/When/Then" format
```

### 2.3.5 Smart Link Extraction

Tự động tìm Figma links và SRS references từ nhiều nguồn:

```javascript
// Sources to scan:
// 1. Custom fields (configured in .devflow.yml)
// 2. Description body
// 3. Comments
// 4. Linked Confluence pages

// Figma URL patterns:
const FIGMA_PATTERNS = [
  /https?:\/\/(www\.)?figma\.com\/(file|design|proto)\/[\w-]+/g,
  /https?:\/\/(www\.)?figma\.com\/board\/[\w-]+/g,
];

// SRS reference patterns:
const SRS_PATTERNS = [
  /SRS[\s-]*(?:Section|§)?\s*[\d.]+/gi,       // "SRS Section 4.2"
  /(?:requirement|req)[\s-]*#?\s*[\w.-]+/gi,   // "REQ-4.2.1"
  /confluence\.[\w.]+\/[\w/]+-srs/gi,          // Confluence SRS links
];
```

## 2.4 Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid JIRA-ID format | Show format hint, suggest valid format |
| 401 Unauthorized | Guide user to check token in env vars |
| 404 Not Found | Suggest checking project key and issue number |
| Rate limited (429) | Auto-retry with exponential backoff (max 3 retries) |
| Network timeout | Retry once, then show offline suggestions |
| ADF parse error | Fallback to raw text, warn user |
