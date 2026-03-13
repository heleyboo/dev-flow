# Feature 4: Auto Git (Branch, Commit, PR)

## 5.1 Mục tiêu

Tự động hóa toàn bộ git workflow: tạo branch đúng convention, commit message chuẩn, push, và tạo Pull Request với description tự động.

## 5.2 Commands

### `devflow start <JIRA-ID>`

Bắt đầu làm việc trên task: tạo branch, transition Jira status.

```bash
$ devflow start PROJ-456

🔄 Switching to develop and pulling latest...
🌿 Creating branch: feature/PROJ-456-implement-user-profile-api
📋 Jira PROJ-456 → status changed to "In Progress"
✅ Ready! You're on feature/PROJ-456-implement-user-profile-api
```

**Logic:**
1. `git checkout develop && git pull origin develop`
2. Generate branch name từ Jira task
3. `git checkout -b {branch_name}`
4. Transition Jira issue → "In Progress" (nếu configured)

**Options:**
- `--base <branch>` — Override base branch (default: from config)
- `--no-transition` — Don't update Jira status
- `--prefix <type>` — Override prefix (feature/fix/hotfix)

### `devflow commit [message]`

Smart commit với auto-generated message.

```bash
# Auto-generate commit message from staged changes
$ devflow commit

📝 Analyzing staged changes...

  Modified: app/Http/Controllers/UserProfileController.php
  Added:    app/Http/Requests/UpdateProfileRequest.php
  Added:    app/Services/UserProfileService.php
  Added:    database/migrations/2024_01_15_add_bio_to_users.php

Suggested commit message:
  [PROJ-456] feat: implement user profile update endpoint

  - Add UserProfileController with update method
  - Create UpdateProfileRequest validation
  - Add UserProfileService for business logic
  - Add bio column migration to users table

? Use this message? (Y/n/edit)

# Hoặc manual message (auto-prefix với Jira ID)
$ devflow commit "add profile validation"
→ [PROJ-456] feat: add profile validation
```

**Logic:**
1. Detect current branch → extract JIRA-ID
2. `git diff --staged --stat` → analyze changes
3. Generate commit message based on changes
4. Detect commit type (feat/fix/refactor/test/docs/chore)
5. Format: `[{JIRA-ID}] {type}: {message}`

**Options:**
- `--all` / `-a` — Stage all changes before commit
- `--amend` — Amend previous commit
- `--no-verify` — Skip pre-commit hooks
- `--type <type>` — Force commit type

### `devflow ship [JIRA-ID]`

Push code và tạo Pull Request. Đây là lệnh "done coding, send for review".

```bash
$ devflow ship

🔍 Current branch: feature/PROJ-456-implement-user-profile-api
📤 Pushing to origin...
🔗 Creating Pull Request...

╔══════════════════════════════════════════════════════╗
║  PR Created: #142                                    ║
║  Title: [PROJ-456] Implement User Profile API        ║
║  Base: develop ← feature/PROJ-456-...                ║
║  URL: https://github.com/company/repo/pull/142       ║
╠══════════════════════════════════════════════════════╣
║  📋 Jira PROJ-456 → status changed to "In Review"   ║
║  🔗 PR link added to Jira issue                      ║
╚══════════════════════════════════════════════════════╝
```

**Logic:**
1. Run lint/tests (configurable)
2. `git push origin {branch}`
3. Create PR via GitHub/GitLab/Bitbucket API
4. Auto-generate PR description
5. Transition Jira → "In Review"
6. Add PR link as comment on Jira issue

**Options:**
- `--draft` — Create as draft PR
- `--no-test` — Skip tests before push
- `--reviewer <user1,user2>` — Assign reviewers
- `--target <branch>` — Override target branch
- `--no-transition` — Don't update Jira status

## 5.3 Git Service — Chi tiết kỹ thuật

### 5.3.1 Branch Name Generation

```javascript
function generateBranchName(task: ParsedTask, config: Config): string {
  const prefix = detectPrefix(task);  // feature/fix/hotfix
  const jiraId = task.key;            // PROJ-456

  // Generate short description from summary
  const shortDesc = task.summary
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')     // Remove special chars
    .trim()
    .replace(/\s+/g, '-')            // Spaces to hyphens
    .substring(0, 50)                 // Limit length
    .replace(/-+$/, '');              // Remove trailing hyphens

  // Apply format from config
  return config.git.branch_format
    .replace('{prefix}', prefix)
    .replace('{jira_id}', jiraId)
    .replace('{short_desc}', shortDesc);
}

function detectPrefix(task: ParsedTask): string {
  if (task.type === 'bug') return 'fix';
  if (task.priority === 'highest' && task.type === 'bug') return 'hotfix';
  return 'feature';
}
```

### 5.3.2 Commit Type Detection

```javascript
function detectCommitType(stagedFiles: StagedFile[]): string {
  const paths = stagedFiles.map(f => f.path);

  // Test files only
  if (paths.every(p => p.includes('/tests/') || p.includes('.test.'))) return 'test';

  // Migration files
  if (paths.some(p => p.includes('/migrations/'))) return 'feat';

  // Documentation
  if (paths.every(p => p.match(/\.(md|txt|doc)$/) || p.includes('/docs/'))) return 'docs';

  // Config files only
  if (paths.every(p => p.match(/\.(yml|yaml|json|env|ini|conf)$/) || p.includes('/config/'))) return 'chore';

  // Has deletions without additions → refactor
  if (stagedFiles.every(f => f.status === 'deleted' || f.status === 'modified')) return 'refactor';

  // Default
  return 'feat';
}
```

### 5.3.3 Commit Message Generator

```javascript
interface StagedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
}

function generateCommitMessage(
  files: StagedFile[],
  jiraId: string,
  type: string
): string {
  // Categorize changes
  const categories = {
    controllers: files.filter(f => f.path.includes('Controller')),
    models: files.filter(f => f.path.includes('Models/')),
    migrations: files.filter(f => f.path.includes('migrations/')),
    services: files.filter(f => f.path.includes('Services/')),
    requests: files.filter(f => f.path.includes('Requests/')),
    resources: files.filter(f => f.path.includes('Resources/')),
    tests: files.filter(f => f.path.includes('tests/')),
    routes: files.filter(f => f.path.includes('routes/')),
    config: files.filter(f => f.path.includes('config/')),
    views: files.filter(f => f.path.includes('views/')),
    other: [] // remaining
  };

  // Build summary line (max 72 chars)
  const summary = buildSummaryLine(categories);

  // Build description body
  const body = buildDescriptionBody(categories);

  return `[${jiraId}] ${type}: ${summary}\n\n${body}`;
}
```

### 5.3.4 PR Description Generator

```javascript
function generatePRDescription(
  task: ParsedTask,
  commits: Commit[],
  config: Config
): string {
  // Sử dụng PR template nếu có (.github/PULL_REQUEST_TEMPLATE.md)
  // Fill in template sections:
  //   ## Description → Jira task summary + link
  //   ## Changes → Categorized commit list
  //   ## Testing → Checklist from acceptance criteria
  //   ## Screenshots → Placeholder (manual add)
  //   ## Jira → Link to task

  return `
## Description
${task.summary}

**Jira**: [${task.key}](${config.jira.host}/browse/${task.key})

## Changes
${formatCommitList(commits)}

## Acceptance Criteria Checklist
${task.acceptanceCriteria.map(ac => `- [ ] ${ac}`).join('\n')}

## Testing
- [ ] Unit tests added/updated
- [ ] Feature tests added/updated
- [ ] Manual testing done on local
- [ ] No regressions found

## Notes
<!-- Add any additional context for reviewers -->
  `.trim();
}
```

### 5.3.5 Git Platform APIs

Hỗ trợ 3 platforms:

```javascript
// Auto-detect platform từ git remote URL:
//   github.com → GitHub API
//   gitlab.com hoặc self-hosted → GitLab API
//   bitbucket.org → Bitbucket API

// GitHub (most common):
//   POST /repos/{owner}/{repo}/pulls
//   Auth: DEVFLOW_GITHUB_TOKEN

// GitLab:
//   POST /api/v4/projects/{id}/merge_requests
//   Auth: DEVFLOW_GITLAB_TOKEN

// Bitbucket:
//   POST /2.0/repositories/{workspace}/{repo}/pullrequests
//   Auth: DEVFLOW_BITBUCKET_TOKEN
```

## 5.4 Pre-ship Checks

Trước khi ship, chạy configurable checks:

```yaml
# .devflow.yml
git:
  pre_ship:
    lint: true                    # php-cs-fixer / phpcs
    test: true                    # phpunit
    test_command: "php artisan test --parallel"
    lint_command: "vendor/bin/pint --test"
    static_analysis: false        # phpstan (optional)
    static_analysis_command: "vendor/bin/phpstan analyse"
```

```bash
$ devflow ship

🔍 Running pre-ship checks...
  ✅ Lint: passed
  ✅ Tests: 42 passed, 0 failed
  📤 Pushing...
```

Nếu check fail → hiện error rõ ràng, không push.

## 5.5 Error Handling

| Scenario | Behavior |
|----------|----------|
| Uncommitted changes khi `start` | Stash automatically, hoặc prompt user |
| Branch already exists | Offer to switch or create with suffix |
| Merge conflicts | Detect & show conflicted files, don't auto-resolve |
| No staged files khi `commit` | Prompt to stage files or use --all |
| Tests fail khi `ship` | Block push, show failed tests |
| PR API fails | Show error, offer to open manual PR URL |
| No JIRA-ID in branch name | Prompt user to provide JIRA-ID |
