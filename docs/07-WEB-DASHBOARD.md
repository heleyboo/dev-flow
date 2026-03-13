# Feature 6: Web Dashboard (Optional)

## 7.1 Mục tiêu

Giao diện web visual cho DevFlow, chạy local hoặc trên server nội bộ. Dashboard giúp visualize workflow, quản lý tasks, và thực hiện các thao tác mà CLI hỗ trợ nhưng qua UI thân thiện hơn.

## 7.2 Commands

### `devflow web`

Start web dashboard.

```bash
$ devflow web

🌐 DevFlow Dashboard running at http://localhost:3456
   Press Ctrl+C to stop
```

**Options:**
- `--port <n>` — Custom port (default: 3456)
- `--host <ip>` — Bind host (default: localhost)
- `--open` — Auto-open browser

## 7.3 Dashboard Pages

### 7.3.1 Home / Task Board

```
┌─────────────────────────────────────────────────────────────┐
│  DevFlow Dashboard                           [Settings] [⟳] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  My Tasks (Sprint 23)                    [Refresh] [Filter] │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐  │
│  │  TO DO    │ │IN PROGRESS│ │ IN REVIEW │ │   DONE    │  │
│  ├───────────┤ ├───────────┤ ├───────────┤ ├───────────┤  │
│  │ PROJ-470  │ │ PROJ-456  │ │ PROJ-448  │ │ PROJ-440  │  │
│  │ Add pagi- │ │ User Pro- │ │ Email     │ │ Auth mid- │  │
│  │ nation    │ │ file API  │ │ template  │ │ dleware   │  │
│  │ [Start]   │ │ [Ship]    │ │           │ │           │  │
│  ├───────────┤ ├───────────┤ └───────────┘ └───────────┘  │
│  │ PROJ-461  │ └───────────┘                               │
│  │ Fix pass- │                                             │
│  │ word reset│                                             │
│  │ [Start]   │                                             │
│  └───────────┘                                             │
│                                                             │
│  Recent Activity                                            │
│  ─────────────────────────────────────────                  │
│  14:30  Deployed to staging (abc1234)                       │
│  14:25  PR #142 created for PROJ-456                        │
│  13:00  Started PROJ-456                                    │
│  11:30  Deployed to staging (def5678)                       │
│                                                             │
│  Deploy Status                                              │
│  ─────────────────────────────────────────                  │
│  Staging:    ✅ Healthy    develop @ abc1234                │
│  Production: ✅ Healthy    main @ xyz7890                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.3.2 Task Detail Page

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back    PROJ-456: Implement User Profile API             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ Task Info ──────────────────────────────────────────┐  │
│  │ Type: Story  Priority: High  Points: 5  Sprint: 23  │  │
│  │ Epic: PROJ-100 (User Management Module)              │  │
│  │ Status: In Progress                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ Actions ────────────────────────────────────────────┐  │
│  │ [Generate Prompt]  [View Figma]  [Ship]  [Deploy]    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ Generated Prompt ───────────────────────────────────┐  │
│  │ # Task: Implement User Profile API [PROJ-456]        │  │
│  │ ## Context                                           │  │
│  │ ...                                                  │  │
│  │                              [Copy] [Edit] [Refresh] │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ Figma Specs ────────────────────────────────────────┐  │
│  │ Profile Header (1440x280)                            │  │
│  │   ├── Avatar (120x120)                               │  │
│  │   ├── UserName (24px, bold)                          │  │
│  │   └── EditButton                                     │  │
│  │ ...                                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ Git Activity ───────────────────────────────────────┐  │
│  │ Branch: feature/PROJ-456-implement-user-profile-api  │  │
│  │ Commits: 3                                           │  │
│  │   abc1234  feat: add profile controller              │  │
│  │   def5678  feat: add profile service + migration     │  │
│  │   ghi9012  test: add profile api tests               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.3.3 Deploy Page

```
┌─────────────────────────────────────────────────────────────┐
│  Deployments                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ Staging ────────────────────────────────────────────┐  │
│  │ Status: ✅ Healthy                                   │  │
│  │ Branch: develop @ abc1234                            │  │
│  │ Last: 2024-01-15 14:30 (2 hours ago)                 │  │
│  │                                                      │  │
│  │ [Deploy Now]  [Rollback]  [View Log]                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ Production ─────────────────────────────────────────┐  │
│  │ Status: ✅ Healthy                                   │  │
│  │ Branch: main @ xyz7890                               │  │
│  │ Last: 2024-01-14 09:00 (1 day ago)                   │  │
│  │                                                      │  │
│  │ [Deploy Now ⚠️]  [Rollback]  [View Log]              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Deploy History                                             │
│  ─────────────────────────────────────────                  │
│  #12  staging     2024-01-15 14:30  ✅  PROJ-456  23s     │
│  #11  staging     2024-01-14 16:00  ✅  PROJ-450  18s     │
│  #10  staging     2024-01-14 11:00  ❌  PROJ-445  45s     │
│  #9   production  2024-01-13 09:30  ✅  PROJ-440  31s     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 7.4 Tech Stack cho Web

```
Backend:  Express.js
Frontend: React + TailwindCSS (simple SPA)
State:    Zustand (lightweight)
API:      REST endpoints calling same services as CLI
Realtime: Server-Sent Events (SSE) cho deploy log streaming
Auth:     Optional — basic token auth nếu expose ra network
```

## 7.5 API Endpoints (Backend)

```
GET    /api/tasks                    List assigned tasks
GET    /api/tasks/:jiraId            Task detail
POST   /api/tasks/:jiraId/prompt     Generate prompt
GET    /api/tasks/:jiraId/figma      Get Figma specs
POST   /api/tasks/:jiraId/start      Start task (create branch)
POST   /api/tasks/:jiraId/ship       Ship (push + PR)

GET    /api/deploy/status            All environments status
POST   /api/deploy/:env              Deploy to environment
POST   /api/deploy/:env/rollback     Rollback
GET    /api/deploy/log               Deploy history
GET    /api/deploy/:env/stream       SSE stream for live deploy log

GET    /api/config                   Current config
PUT    /api/config                   Update config
```

## 7.6 Priority

Web Dashboard là **Phase 2**. Focus CLI trước vì:
1. CLI tích hợp tốt với Claude Code workflow
2. Nhanh hơn để build MVP
3. Web chỉ là UI wrapper quanh cùng service layer
