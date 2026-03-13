# DevFlow Documentation Index

Quick reference guide to all documentation.

## Getting Started

- **[README.md](./README.md)** — Project overview, quick start, features, commands
  - 5-minute start: `devflow init` → `devflow task list` → `devflow prompt <ID>`

## Core Documentation (Essential Reading)

### For New Developers
1. **[README.md](./README.md)** — What is DevFlow, why it exists
2. **[docs/codebase-summary.md](./docs/codebase-summary.md)** — Where files are, what each does
3. **[docs/code-standards.md](./docs/code-standards.md)** — How to write code in this project
4. **[docs/system-architecture.md](./docs/system-architecture.md)** — How everything connects

### For Architecture & Design
1. **[docs/system-architecture.md](./docs/system-architecture.md)** — 3-layer design, data flows
2. **[docs/project-overview-pdr.md](./docs/project-overview-pdr.md)** — Features, requirements, APIs
3. **[docs/design-guidelines.md](./docs/design-guidelines.md)** — CLI/UX principles

### For Operations & Deployment
1. **[docs/deployment-guide.md](./docs/deployment-guide.md)** — How to deploy, rollback, monitor
2. **[docs/project-roadmap.md](./docs/project-roadmap.md)** — What's coming next, timelines

## Feature-Specific Documentation

### Jira Integration
- [docs/02-JIRA-INTEGRATION.md](./docs/02-JIRA-INTEGRATION.md) — Task fetching, parsing, status sync

### Figma Integration
- [docs/03-FIGMA-INTEGRATION.md](./docs/03-FIGMA-INTEGRATION.md) — Design parsing, token extraction

### Prompt Generation
- [docs/04-PROMPT-GENERATION.md](./docs/04-PROMPT-GENERATION.md) — Context compilation, templates

### Git Automation
- [docs/05-GIT-AUTOMATION.md](./docs/05-GIT-AUTOMATION.md) — Branch, commit, PR workflow

### Deployment
- [docs/06-DEPLOY-AUTOMATION.md](./docs/06-DEPLOY-AUTOMATION.md) — Deployment orchestration
- [docs/deployment-guide.md](./docs/deployment-guide.md) — Strategies, safety, rollback

### Web Dashboard
- [docs/07-WEB-DASHBOARD.md](./docs/07-WEB-DASHBOARD.md) — REST API, task board

### Frontend Support
- [docs/09-FRONTEND-SUPPORT.md](./docs/09-FRONTEND-SUPPORT.md) — React, Vue, Angular integration

### Testing
- [docs/10-API-TESTING.md](./docs/10-API-TESTING.md) — API test generation
- [docs/11-E2E-TESTING.md](./docs/11-E2E-TESTING.md) — E2E test generation (Playwright/Cypress)

## Development Reference

### Standards & Guidelines
- **[docs/code-standards.md](./docs/code-standards.md)**
  - File naming (kebab-case)
  - File organization (commands, services, utils)
  - Testing (80% coverage)
  - Security practices
  - Pre-commit checklist

### Architecture
- **[docs/system-architecture.md](./docs/system-architecture.md)**
  - 3-layer pattern (commands → services → utils)
  - Service interfaces
  - Data flow diagrams
  - Error handling
  - Performance optimization

### Operations
- **[docs/deployment-guide.md](./docs/deployment-guide.md)**
  - SSH/Docker/Custom strategies
  - Pre-deploy validation
  - Health checks
  - Rollback procedures
  - Disaster recovery

## Navigation by Task

### "I want to understand DevFlow"
1. Read: [README.md](./README.md)
2. Read: [docs/project-overview-pdr.md](./docs/project-overview-pdr.md)
3. Read: [docs/system-architecture.md](./docs/system-architecture.md)

### "I want to contribute code"
1. Read: [docs/code-standards.md](./docs/code-standards.md)
2. Read: [docs/codebase-summary.md](./docs/codebase-summary.md)
3. Reference: [docs/system-architecture.md](./docs/system-architecture.md)

### "I want to deploy to production"
1. Read: [docs/deployment-guide.md](./docs/deployment-guide.md)
2. Reference: [docs/06-DEPLOY-AUTOMATION.md](./docs/06-DEPLOY-AUTOMATION.md)
3. Checklist: Pre-deploy validation in [docs/deployment-guide.md](./docs/deployment-guide.md)

### "I want to add a new feature"
1. Read: [docs/project-roadmap.md](./docs/project-roadmap.md) (Is it planned?)
2. Read: [docs/system-architecture.md](./docs/system-architecture.md)
3. Follow: [docs/code-standards.md](./docs/code-standards.md)

### "I want to understand the testing strategy"
1. Read: [docs/code-standards.md](./docs/code-standards.md) — Testing section
2. Reference: [docs/10-API-TESTING.md](./docs/10-API-TESTING.md)
3. Reference: [docs/11-E2E-TESTING.md](./docs/11-E2E-TESTING.md)

## Quick Reference

### File Organization
```
src/
├── commands/     — CLI interface (thin wrappers)
├── services/     — Business logic (testable)
├── utils/        — Helpers (logging, config, HTTP)
├── parsers/      — Data transformation
├── maps/         — Static data (stacks, infrastructure)
├── schemas/      — Validation
├── templates/    — Handlebars prompt templates
└── web/          — Express server
```

### Key Files
- **Entry:** `bin/devflow.js`
- **Config:** `.devflow.yml` (per-project)
- **Cache:** `.devflow/` directory
- **Tests:** `tests/unit/`

### Commands Reference
| Command | Purpose | Doc |
|---------|---------|-----|
| `devflow init` | Setup | README |
| `devflow task <ID>` | Fetch Jira | docs/02 |
| `devflow doctor` | Health check | docs/codebase-summary |
| `devflow figma <URL>` | Parse design | docs/03 |
| `devflow prompt <ID>` | Generate prompt | docs/04 |
| `devflow start <ID>` | Create branch | docs/05 |
| `devflow ship` | PR & deploy | docs/05 |
| `devflow deploy [env]` | Deploy | docs/06, deployment-guide |
| `devflow test:api <ID>` | API tests | docs/10 |
| `devflow test:e2e <ID>` | E2E tests | docs/11 |

### Services Reference
| Service | Purpose | Location |
|---------|---------|----------|
| JiraService | Jira API | src/services/jira.service.js |
| FigmaService | Figma API | src/services/figma.service.js |
| GitService | Git operations | src/services/git.service.js |
| DeployService | Deployment | src/services/deploy.service.js |
| PromptService | Prompt generation | src/services/prompt.service.js |
| APITestService | API test gen | src/services/api-test.service.js |
| E2ETestService | E2E test gen | src/services/e2e-test.service.js |

## Checklists

### Pre-Commit Checklist
See: [docs/code-standards.md](./docs/code-standards.md) — "Pre-commit Checklist"

### Pre-Deploy Checklist
See: [docs/deployment-guide.md](./docs/deployment-guide.md) — "Pre-Deployment Checklist"

## Roadmap & Status

**Current Version:** v1.0.0 (✅ Production-ready)

**Planned Releases:**
- v1.1.0 — Q2 2026 (Web dashboard, IDE integration)
- v1.2.0 — Q3 2026 (Webhooks, plugins, advanced deploy)
- v2.0.0 — Q4 2026 (Full platform, API, marketplace)

See: [docs/project-roadmap.md](./docs/project-roadmap.md)

## Troubleshooting

### CLI not found
```bash
npm install -g devflow-cli
# or
npm install --save-dev devflow-cli
```

### Config error
```bash
devflow doctor  # Shows issues and suggestions
```

### Jira connection failed
```bash
echo $DEVFLOW_JIRA_TOKEN  # Check token is set
devflow doctor            # Verify Jira config
```

See detailed troubleshooting in: [docs/deployment-guide.md](./docs/deployment-guide.md) — "Troubleshooting"

## Contributing

1. Read: [docs/code-standards.md](./docs/code-standards.md)
2. Read: [docs/system-architecture.md](./docs/system-architecture.md)
3. Follow: Pre-commit checklist
4. Submit: Clean, focused commits

## Questions?

- Check relevant doc above
- Search in `.md` files: `grep -r "your question" docs/`
- Ask team: See CLAUDE.md for communication protocol

---

**Last Updated:** 2026-03-13
**Total Docs:** 15 files (8 standard + 7 feature-specific)
**Status:** Complete & Production-Ready
