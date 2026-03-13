# Implementation Roadmap & CLI Setup

## 8.1 Command: `devflow init`

Setup DevFlow cho project mới.

```bash
$ devflow init

🔧 DevFlow Setup
════════════════════════════

? Project name: my-php-project
? Framework: (Laravel / Symfony / Vanilla PHP)
? PHP version: (8.2)

? Jira host URL: https://company.atlassian.net
? Jira email: dev@company.com
? Jira project key: PROJ
? → Set DEVFLOW_JIRA_TOKEN in your shell (see docs)

? Figma project ID (optional): abc123
? → Set DEVFLOW_FIGMA_TOKEN in your shell (see docs)

? Git platform: (GitHub / GitLab / Bitbucket)
? → Set DEVFLOW_GITHUB_TOKEN in your shell (see docs)
? Base branch: develop
? Branch format: {prefix}/{jira_id}-{short_desc}
? Commit format: [{jira_id}] {type}: {message}

? Deploy staging host (optional): staging.company.com
? Deploy staging path: /var/www/staging

✅ Config saved to .devflow.yml
✅ Created .devflow/ directory
✅ Added .devflow/cache/ to .gitignore

💡 Next steps:
   1. Set environment variables (tokens)
   2. Run: devflow task list (verify Jira connection)
   3. Run: devflow start PROJ-XXX (start your first task)
```

## 8.2 Command: `devflow doctor`

Kiểm tra setup và connections.

```bash
$ devflow doctor

🏥 DevFlow Health Check
════════════════════════════

  Config:
    ✅ .devflow.yml found and valid
    ✅ Project type: laravel

  Connections:
    ✅ Jira: connected (PROJ — 42 active issues)
    ✅ Figma: connected (3 recent files)
    ✅ GitHub: connected (company/repo — write access)
    ⚠️  SSH staging: connection timeout (check host/key)
    ✅ SSH production: connected

  Tools:
    ✅ git 2.43.0
    ✅ node 20.11.0
    ✅ php 8.2.14
    ✅ composer 2.6.6
    ⚠️  php-cs-fixer: not found (optional — for lint)

  2 warnings found. Run 'devflow doctor --fix' for suggestions.
```

## 8.3 Environment Variables

```bash
# Required
export DEVFLOW_JIRA_TOKEN="your-jira-api-token"

# Optional (depending on features used)
export DEVFLOW_FIGMA_TOKEN="your-figma-personal-access-token"
export DEVFLOW_GITHUB_TOKEN="your-github-pat"
export DEVFLOW_GITLAB_TOKEN="your-gitlab-pat"
export DEVFLOW_BITBUCKET_TOKEN="your-bitbucket-app-password"
export DEVFLOW_SLACK_WEBHOOK="https://hooks.slack.com/services/..."
export DEVFLOW_DISCORD_WEBHOOK="https://discord.com/api/webhooks/..."
```

## 8.4 NPM Dependencies

```json
{
  "name": "devflow-cli",
  "version": "1.0.0",
  "bin": {
    "devflow": "./bin/devflow.js"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "inquirer": "^9.0.0",
    "chalk": "^5.0.0",
    "ora": "^7.0.0",
    "yaml": "^2.0.0",
    "handlebars": "^4.7.0",
    "node-fetch": "^3.0.0",
    "clipboardy": "^4.0.0",
    "node-ssh": "^13.0.0",
    "simple-git": "^3.0.0",
    "express": "^4.18.0",
    "boxen": "^7.0.0",
    "table": "^6.8.0",
    "date-fns": "^3.0.0",
    "conf": "^12.0.0",
    "open": "^10.0.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "eslint": "^9.0.0"
  }
}
```

## 8.5 Implementation Phases

### Phase 1 — Foundation + Jira (Tuần 1)
```
Priority: ⬛⬛⬛⬛⬛ CRITICAL

Deliverables:
├── CLI skeleton (commander.js setup, config loader)
├── devflow init
├── devflow doctor
├── Jira service (auth, fetch task, parse ADF, extract links)
├── devflow task <ID>
├── devflow task list
└── Unit tests cho Jira service

Definition of Done:
  $ devflow init → tạo được .devflow.yml
  $ devflow task PROJ-123 → hiện đầy đủ task info
  $ devflow task list → hiện danh sách tasks
```

### Phase 2 — Figma Integration (Tuần 2)
```
Priority: ⬛⬛⬛⬛ HIGH

Deliverables:
├── Figma service (auth, fetch file, parse nodes)
├── UI element inference engine
├── Field extraction logic
├── Design token extraction
├── devflow figma <URL>
├── Caching layer
└── Unit tests cho Figma service + inference

Definition of Done:
  $ devflow figma "https://figma.com/..." → hiện component tree + implied fields
  $ devflow figma PROJ-123 → auto-extract từ Jira link
```

### Phase 3 — Prompt Generation + Frontend Support (Tuần 2-3)
```
Priority: ⬛⬛⬛⬛⬛ CRITICAL

Deliverables:
├── Prompt service (template engine, context scanner)
├── Handlebars templates — Backend: api-endpoint, crud-feature, bug-fix,
│   migration, refactor, integration
├── Handlebars templates — Frontend: fe-component, fe-page
├── Backend codebase scanner (file discovery, DB schema extraction)
├── Frontend codebase scanner (components, types, hooks, stores, routes)
├── Figma → Component Props inference engine
├── Backend API discovery (for frontend prompts)
├── Template auto-selection logic (backend + frontend)
├── devflow prompt <JIRA-ID> (backend, default)
├── devflow prompt <JIRA-ID> --frontend
├── devflow prompt <JIRA-ID> --fullstack
├── devflow prompt templates
├── Clipboard integration
└── Integration tests (Jira + Figma → Prompt)

Spec files: 04-PROMPT-GENERATION.md + 09-FRONTEND-SUPPORT.md

Definition of Done:
  $ devflow prompt PROJ-123 → generate backend prompt, copy to clipboard
  $ devflow prompt PROJ-123 --frontend → generate frontend prompt
  $ devflow prompt PROJ-123 --fullstack → cả hai prompts
  Prompt chứa đầy đủ: task info, figma specs, code context, instructions
```

### Phase 4 — Git Automation (Tuần 3)
```
Priority: ⬛⬛⬛⬛ HIGH

Deliverables:
├── Git service (simple-git wrapper)
├── Branch name generator
├── Commit message generator
├── PR creator (GitHub API)
├── Jira status transition
├── devflow start <ID>
├── devflow commit
├── devflow ship
├── Pre-ship checks (lint, test)
└── Tests

Definition of Done:
  $ devflow start PROJ-123 → tạo branch, transition Jira
  $ devflow commit → smart commit message
  $ devflow ship → push + PR + transition Jira
```

### Phase 5 — Deploy (Tuần 4)
```
Priority: ⬛⬛⬛ MEDIUM

Deliverables:
├── Deploy service (SSH strategy)
├── Pre-deploy checks
├── Health check
├── Rollback mechanism
├── Deploy history log
├── Notifications (Slack/Discord)
├── devflow deploy [env]
├── devflow deploy rollback
├── devflow deploy status
├── devflow deploy log
└── Safety tests

Definition of Done:
  $ devflow deploy → deploy to staging with checks
  $ devflow deploy production → with confirmation
  $ devflow deploy rollback → rollback successfully
```

### Phase 6 — API Testing + E2E Testing (Tuần 5)
```
Priority: ⬛⬛⬛⬛ HIGH

Deliverables:
├── API test generator (endpoint discovery, test case generation)
├── Output formats: .http, Postman collection, Vitest/Jest scripts
├── devflow test:api <JIRA-ID>
├── devflow test:api run
├── devflow test:api discover
├── Test fixtures generator (images, files cho upload tests)
├── E2E test generator (AC parser, Figma → selector mapping)
├── Page Object generator
├── Output: Playwright + Cypress test scripts
├── devflow test:e2e <JIRA-ID>
├── devflow test:e2e run
├── devflow test:e2e selectors
├── devflow test:e2e codegen (interactive recording)
└── CI integration config generator

Spec files: 10-API-TESTING.md + 11-E2E-TESTING.md

Definition of Done:
  $ devflow test:api PROJ-123 → generate API tests (HTTP + Postman + Vitest)
  $ devflow test:api run → chạy tests, report results
  $ devflow test:e2e PROJ-123 → generate Playwright tests + Page Objects
  $ devflow test:e2e run → chạy E2E tests trong browser
  $ devflow test:e2e selectors PROJ-123 → list data-testid cần thêm
```

### Phase 7 — Web Dashboard (Tuần 6-7)
```
Priority: ⬛⬛ LOW (nice to have)

Deliverables:
├── Express.js API server
├── React frontend
├── Task board view
├── Task detail + prompt viewer
├── Deploy dashboard
├── Test results dashboard
├── SSE for live deploy logs
└── Basic auth

Definition of Done:
  $ devflow web → dashboard chạy tại localhost:3456
  Tất cả features CLI đều có thể thực hiện qua web
```

## 8.6 Workflow tổng hợp (Happy Path)

```bash
# 1. Sáng: check tasks
$ devflow task list

# 2. Chọn task và bắt đầu
$ devflow start PROJ-456
# → Tạo branch, Jira → In Progress

# 3. Generate prompt cho backend
$ devflow prompt PROJ-456
# → Backend prompt copied to clipboard
# → Paste vào Claude Code, Claude implement backend

# 4. Generate prompt cho frontend
$ devflow prompt PROJ-456 --frontend
# → Frontend prompt copied to clipboard
# → Paste vào Claude Code, Claude implement frontend

# 5. Generate & run API tests
$ devflow test:api PROJ-456
# → Tạo test files (.http + Postman + Vitest)
$ devflow test:api run
# → Chạy tests, xem kết quả

# 6. Generate & run E2E tests
$ devflow test:e2e PROJ-456
# → Tạo Playwright tests + Page Objects
$ devflow test:e2e run
# → Chạy E2E tests trong browser

# 7. Commit & ship
$ devflow commit
# → Smart commit message
$ devflow ship
# → Push, PR, Jira → In Review

# 8. PR approved? Deploy
$ devflow deploy
# → Deploy staging, health check

# 9. Test staging OK? Deploy production
$ devflow deploy production
# → Safety checks, confirm, deploy, health check, notify team

# Total thời gian thủ công: ~5 phút (vs ~1-2 giờ trước đây)
```

## 8.7 Combo Command (Future Enhancement)

```bash
# One command to rule them all:
$ devflow go PROJ-456

# Equivalent to:
# devflow start PROJ-456
# devflow prompt PROJ-456 --copy
# (opens prompt in editor for review)
# → user pastes to Claude Code
# → user reviews generated code
# devflow commit -a
# devflow ship
```

## 8.8 Testing Strategy

```
Unit Tests:
├── Jira ADF parser
├── Figma URL parser
├── Figma inference engine
├── Figma → Component Props inference
├── Branch name generator
├── Commit message generator
├── Template auto-selector
├── Config loader
├── Field name sanitizer
├── AC parser (acceptance criteria → test scenarios)
├── Endpoint discovery (route parsing)
├── Test case generator
└── Selector mapper (Figma → data-testid)

Integration Tests:
├── Jira API (mock HTTP)
├── Figma API (mock HTTP)
├── Git operations (temp repo)
├── Deploy (mock SSH)
├── Full prompt generation pipeline (backend)
├── Full prompt generation pipeline (frontend)
├── API test generation pipeline
└── E2E test generation pipeline

E2E Tests (optional):
├── devflow init → task → prompt → commit → ship flow
├── devflow deploy → rollback flow
├── devflow test:api → run flow
└── devflow test:e2e → run flow
```
