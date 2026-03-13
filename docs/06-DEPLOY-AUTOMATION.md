# Feature 5: Auto Deploy

## 6.1 Mục tiêu

Tự động hóa quy trình deploy code lên các môi trường (staging, production) với safety checks và rollback capability.

## 6.2 Commands

### `devflow deploy [environment]`

Deploy code lên target environment.

```bash
# Deploy to staging (default)
$ devflow deploy

🚀 Deploying to STAGING
═══════════════════════════════════════

📋 Pre-deploy checklist:
  ✅ Branch: develop (up to date)
  ✅ Tests: all passing
  ✅ No uncommitted changes

🔗 Connecting to staging.company.com...
  ▶ cd /var/www/staging && git pull origin develop
    Already up to date. → Changed: 3 files
  ▶ composer install --no-dev
    Installing dependencies... Done.
  ▶ php artisan migrate --force
    Migrating: 2024_01_15_add_bio_to_users
    Migrated. (0.05s)
  ▶ php artisan cache:clear
    Cache cleared.
  ▶ php artisan queue:restart
    Queue restart signal sent.

✅ Deploy to STAGING completed in 23s
🔗 https://staging.company.com

# Deploy to production (requires confirmation)
$ devflow deploy production

🚀 Deploying to PRODUCTION
═══════════════════════════════════════

⚠️  PRODUCTION DEPLOYMENT
   Branch: main
   Last commit: [PROJ-456] feat: implement user profile api
   Pending migrations: 1

? Are you sure you want to deploy to PRODUCTION? (y/N) y
? Type "DEPLOY PRODUCTION" to confirm: DEPLOY PRODUCTION

🔗 Connecting to prod.company.com...
  ...
```

**Options:**
- `--dry-run` — Show what would happen without executing
- `--skip-checks` — Skip pre-deploy checks (dangerous, requires --force)
- `--force` — Required with --skip-checks
- `--rollback` — Rollback to previous version
- `--tag <version>` — Deploy specific tag/version
- `--notify` — Send notification after deploy (Slack/Discord)

### `devflow deploy status`

Xem trạng thái các environments.

```bash
$ devflow deploy status

  Environment    Branch     Last Deploy          Status
  ─────────────────────────────────────────────────────
  staging        develop    2024-01-15 14:30     ✅ Healthy
  production     main       2024-01-14 09:00     ✅ Healthy
```

### `devflow deploy rollback [environment]`

Rollback về version trước.

```bash
$ devflow deploy rollback staging

⏪ Rolling back STAGING
  Current: abc1234 [PROJ-456] feat: implement user profile api
  Target:  def5678 [PROJ-450] fix: email validation

? Confirm rollback? (y/N) y

🔗 Connecting to staging.company.com...
  ▶ cd /var/www/staging && git checkout def5678
  ▶ composer install --no-dev
  ▶ php artisan migrate:rollback --step=1
  ▶ php artisan cache:clear

✅ Rollback completed.
```

### `devflow deploy log [environment]`

Xem deploy history.

```bash
$ devflow deploy log

  Deploy History (staging):
  ─────────────────────────────────────────────────
  #12  2024-01-15 14:30  abc1234  PROJ-456  ✅ Success  dev@company.com
  #11  2024-01-14 16:00  def5678  PROJ-450  ✅ Success  dev@company.com
  #10  2024-01-14 11:00  ghi9012  PROJ-445  ❌ Failed   dev@company.com
  #9   2024-01-13 09:30  jkl3456  PROJ-440  ✅ Success  dev@company.com
```

## 6.3 Deploy Service — Chi tiết kỹ thuật

### 6.3.1 Deploy Strategies

```typescript
interface DeployStrategy {
  type: 'ssh' | 'docker' | 'k8s' | 'custom';
  execute(config: DeployConfig): Promise<DeployResult>;
  rollback(config: DeployConfig): Promise<DeployResult>;
  healthCheck(config: DeployConfig): Promise<boolean>;
}
```

**Strategy: SSH Deploy** (phổ biến nhất cho PHP projects)

```javascript
// SSH deploy flow:
// 1. SSH connect to server
// 2. Execute commands sequentially
// 3. If any command fails → auto-rollback
// 4. Health check sau deploy

// Sử dụng node-ssh hoặc child_process spawn('ssh', ...)
// Prefer ssh2 library cho programmatic control

const { NodeSSH } = require('node-ssh');

async function deploySSH(config) {
  const ssh = new NodeSSH();
  await ssh.connect({
    host: config.host,
    username: config.user,
    privateKey: config.privateKeyPath || `${os.homedir()}/.ssh/id_rsa`,
  });

  const results = [];
  for (const cmd of config.commands) {
    const resolved = cmd.replace('{path}', config.path);
    const result = await ssh.execCommand(resolved, { cwd: config.path });

    results.push({
      command: resolved,
      stdout: result.stdout,
      stderr: result.stderr,
      code: result.code,
    });

    if (result.code !== 0) {
      throw new DeployError(`Command failed: ${resolved}`, result, results);
    }
  }

  ssh.dispose();
  return results;
}
```

**Strategy: Docker Deploy**

```yaml
# .devflow.yml
deploy:
  staging:
    type: "docker"
    compose_file: "docker-compose.staging.yml"
    service: "app"
    commands:
      - "docker compose -f {compose_file} pull {service}"
      - "docker compose -f {compose_file} up -d {service}"
      - "docker compose -f {compose_file} exec {service} php artisan migrate --force"
```

**Strategy: Custom Script**

```yaml
# .devflow.yml
deploy:
  staging:
    type: "custom"
    script: "./scripts/deploy-staging.sh"
    rollback_script: "./scripts/rollback-staging.sh"
```

### 6.3.2 Pre-deploy Checks

```javascript
async function preDeployChecks(env: string, config: Config): Promise<CheckResult[]> {
  const checks = [];

  // 1. Git status — clean working directory
  checks.push({
    name: 'git_clean',
    check: async () => {
      const status = execSync('git status --porcelain').toString();
      return status.trim() === '';
    },
    errorMessage: 'Uncommitted changes detected. Commit or stash first.',
  });

  // 2. Branch — đúng branch cho environment
  checks.push({
    name: 'correct_branch',
    check: async () => {
      const branch = execSync('git branch --show-current').toString().trim();
      const expectedBranch = env === 'production'
        ? config.deploy[env].branch || 'main'
        : config.deploy[env].branch || 'develop';
      return branch === expectedBranch;
    },
    errorMessage: `Not on expected branch for ${env}.`,
  });

  // 3. Up to date — pull latest
  checks.push({
    name: 'up_to_date',
    check: async () => {
      execSync('git fetch origin');
      const local = execSync('git rev-parse HEAD').toString().trim();
      const remote = execSync(`git rev-parse origin/${branch}`).toString().trim();
      return local === remote;
    },
    errorMessage: 'Local branch is behind remote. Pull first.',
  });

  // 4. Tests passing (if configured)
  if (config.deploy[env].run_tests !== false) {
    checks.push({
      name: 'tests',
      check: async () => {
        const result = execSync(config.git.pre_ship.test_command || 'php artisan test');
        return true; // No error thrown = passed
      },
      errorMessage: 'Tests are failing.',
    });
  }

  // 5. Pending migrations check
  checks.push({
    name: 'pending_migrations',
    check: async () => {
      // Check if there are new migration files not yet run
      // This is informational, not blocking
      return true;
    },
    warning: 'There are pending migrations that will run during deploy.',
  });

  return checks;
}
```

### 6.3.3 Health Check

```javascript
// Post-deploy health check:
// 1. HTTP GET to configured health endpoint
// 2. Check response status === 200
// 3. Check response body contains expected content
// 4. If fail → auto-rollback (if configured)

async function healthCheck(config: DeployEnvConfig): Promise<boolean> {
  const url = config.health_check_url || `https://${config.host}/api/health`;
  const maxRetries = 3;
  const retryDelay = 5000; // 5s

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, { timeout: 10000 });
      if (response.ok) return true;
    } catch (e) {
      // Retry
    }
    await sleep(retryDelay);
  }

  return false;
}
```

### 6.3.4 Deploy History / Log

```javascript
// Lưu deploy history locally:
// File: .devflow/deploy-history.json

interface DeployRecord {
  id: number;
  environment: string;
  timestamp: string;
  commitHash: string;
  commitMessage: string;
  jiraId: string | null;
  branch: string;
  status: 'success' | 'failed' | 'rolled_back';
  deployedBy: string;        // git user.name
  duration: number;          // seconds
  commandResults: Array<{
    command: string;
    exitCode: number;
    duration: number;
  }>;
  rollbackTarget: string | null; // commit hash nếu đây là rollback
}
```

### 6.3.5 Notifications

```yaml
# .devflow.yml
deploy:
  notifications:
    slack:
      webhook_url: "${DEVFLOW_SLACK_WEBHOOK}"  # env var
      channel: "#deployments"
      on_success: true
      on_failure: true
    discord:
      webhook_url: "${DEVFLOW_DISCORD_WEBHOOK}"
      on_success: false
      on_failure: true
```

```javascript
// Notification payload:
// ✅ Deploy SUCCESS: staging
//    Branch: develop (abc1234)
//    Task: [PROJ-456] Implement User Profile API
//    Duration: 23s
//    By: dev@company.com

// ❌ Deploy FAILED: staging
//    Branch: develop (abc1234)
//    Failed at: php artisan migrate --force
//    Error: SQLSTATE[42S01] Table already exists
//    By: dev@company.com
```

## 6.4 Safety Features

### 6.4.1 Production Safeguards

```javascript
// Production deploy requires:
// 1. Explicit --env=production flag
// 2. Interactive confirmation prompt
// 3. Type environment name to confirm (nếu requires_approval: true)
// 4. Cannot deploy on Friday after 4pm (configurable)
// 5. Cannot deploy if last deploy was < 30min ago (configurable)

const safeguards = {
  require_confirmation: true,
  require_type_confirm: true,   // Type "DEPLOY PRODUCTION"
  blocked_hours: {              // No deploys during these times
    friday: { after: '16:00' },
    saturday: 'all',
    sunday: 'all',
  },
  cooldown_minutes: 30,         // Min time between deploys
  max_deploys_per_day: 5,
};
```

### 6.4.2 Auto-Rollback

```javascript
// If health check fails after deploy:
// 1. Notify team immediately
// 2. Auto-rollback to previous version
// 3. Run health check again
// 4. If rollback also fails → alert critical

async function deployWithRollback(env, config) {
  const previousCommit = getCurrentDeployedCommit(env);

  try {
    await deploy(env, config);
    const healthy = await healthCheck(config);

    if (!healthy) {
      console.error('Health check failed! Auto-rolling back...');
      await rollback(env, config, previousCommit);
      await notify('Deploy failed, auto-rolled back', 'error');
    }
  } catch (error) {
    console.error(`Deploy error: ${error.message}`);
    await rollback(env, config, previousCommit);
    await notify(`Deploy failed: ${error.message}`, 'error');
  }
}
```

## 6.5 Error Handling

| Scenario | Behavior |
|----------|----------|
| SSH connection failed | Retry once, then show troubleshooting tips |
| Command failed mid-deploy | Stop execution, log which command failed, offer rollback |
| Migration failed | Specific hint about checking migration file, offer migrate:rollback |
| Permission denied | Guide user to check SSH key and server permissions |
| Health check timeout | Retry 3 times, then trigger rollback |
| Disk space full on server | Detect from error output, suggest cleanup commands |
