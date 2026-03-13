# DevFlow — Specification Index

## Bộ tài liệu đặc tả tính năng

Dự án DevFlow — CLI tool + Web Dashboard tự động hóa workflow cho PHP Backend Developer, tối ưu cho việc sử dụng cùng Claude Code.

## Danh sách tài liệu

| # | File | Nội dung | Dùng khi |
|---|------|----------|----------|
| 01 | `01-OVERVIEW.md` | Tổng quan kiến trúc, tech stack, config file, cấu trúc thư mục | Đọc đầu tiên, setup project skeleton |
| 02 | `02-JIRA-INTEGRATION.md` | Jira API, ADF parser, data model, commands `task` | Implement Phase 1 |
| 03 | `03-FIGMA-INTEGRATION.md` | Figma API, UI inference engine, specs extraction | Implement Phase 2 |
| 04 | `04-PROMPT-GENERATION.md` | Template engine, codebase scanner, auto-selection | Implement Phase 3 |
| 05 | `05-GIT-AUTOMATION.md` | Branch, commit, PR, pre-ship checks | Implement Phase 4 |
| 06 | `06-DEPLOY-AUTOMATION.md` | SSH deploy, health check, rollback, notifications | Implement Phase 5 |
| 07 | `07-WEB-DASHBOARD.md` | Web UI wireframes, API endpoints, tech stack | Implement Phase 7 |
| 08 | `08-ROADMAP-AND-SETUP.md` | `init`, `doctor`, env vars, phases, testing | Planning + setup |
| 09 | `09-FRONTEND-SUPPORT.md` | Frontend prompt gen, component props inference, FE codebase scanner | Implement Phase 3 (cùng prompt gen) |
| 10 | `10-API-TESTING.md` | Auto-generate API tests (HTTP/Postman/Vitest), endpoint discovery | Implement Phase 6 |
| 11 | `11-E2E-TESTING.md` | E2E test gen (Playwright/Cypress), AC parser, Page Objects, selectors | Implement Phase 6 |

## Cách sử dụng với Claude Code

### Cách 1: Feed từng phase

```bash
# Khi bắt đầu Phase 1
claude "Đọc file 01-OVERVIEW.md và 02-JIRA-INTEGRATION.md, sau đó implement Phase 1"

# Khi bắt đầu Phase 2
claude "Đọc file 03-FIGMA-INTEGRATION.md, implement Figma service và commands"

# ... tương tự cho các phase khác
```

### Cách 2: Dùng CLAUDE.md

Copy nội dung file `01-OVERVIEW.md` vào `CLAUDE.md` tại root project để Claude Code luôn có context về kiến trúc tổng thể. Khi implement từng feature, reference tới spec file tương ứng.

### Cách 3: Feed toàn bộ

```bash
# Nếu context window đủ lớn
claude "Đọc tất cả files trong thư mục devflow-specs/ và implement theo roadmap trong 08-ROADMAP-AND-SETUP.md"
```

## Ghi chú

- Mỗi file spec được thiết kế để Claude Code có thể đọc và implement **độc lập** từng feature
- Data models dùng TypeScript interfaces cho rõ ràng — convert sang JSDoc hoặc actual TS tùy preference
- Config example (`.devflow.yml`) trong file 01 là **template hoàn chỉnh** — có thể dùng trực tiếp
- Templates `.hbs` trong file 04 là **nội dung thực** — có thể copy thẳng vào project
