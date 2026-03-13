# Deployment Guide

## Overview

DevFlow supports multiple deployment strategies for different infrastructure setups. This guide covers production deployment, safety checks, rollback procedures, and monitoring.

## Pre-Deployment Checklist

Before deploying to any environment, ensure:

### Code Quality
```bash
npm run test         # All tests pass
npm run lint         # No linting errors
npm run test:coverage  # Coverage meets threshold
```

### Configuration
```bash
devflow doctor       # All connections verified
cat .devflow.yml     # Review deployment config
```

### Git Status
```bash
git status           # Clean working tree
git pull origin develop  # Up-to-date with main
```

## Deployment Strategies

### 1. SSH Strategy (Production Recommended)

**Best for:** Traditional servers with SSH access

**Configuration:**
```yaml
deploy:
  production:
    type: "ssh"
    host: "prod.company.com"
    user: "deployer"
    port: 22
    path: "/var/www/production"
    requires_approval: true
    pre_deploy:
      - "cd {path} && git pull origin main"
      - "composer install --no-dev"
    deploy:
      - "php artisan migrate --force"
      - "php artisan cache:clear"
      - "php artisan queue:restart"
    post_deploy:
      - "php artisan config:cache"
      - "sudo systemctl reload php8.2-fpm"
    health_check:
      url: "https://prod.company.com/api/health"
      timeout: 30
      retries: 3
```

**How It Works:**
1. Validates SSH key exists & is accessible
2. Connects to remote host
3. Executes pre-deploy commands
4. Runs main deployment commands
5. Runs post-deploy commands
6. Checks health endpoint
7. Logs deployment history

**Command:**
```bash
devflow deploy production
# → Prompts for confirmation
# → Executes deployment
# → Monitors health checks
```

### 2. Docker Strategy

**Best for:** Containerized apps, Kubernetes-ready

**Configuration:**
```yaml
deploy:
  staging:
    type: "docker"
    image: "myapp:latest"
    registry: "docker.io"
    registry_user: "${DOCKER_USER}"
    registry_token: "${DOCKER_TOKEN}"
    compose_file: "docker-compose.yml"
    container_name: "myapp-staging"
    pull: true
    environment:
      APP_ENV: "staging"
      LOG_LEVEL: "debug"
    health_check:
      url: "http://localhost:8000/api/health"
      timeout: 30
```

**How It Works:**
1. Pulls latest image from registry
2. Stops current container
3. Starts new container from image
4. Waits for health check
5. Cleans up old containers

**Command:**
```bash
devflow deploy staging
# → Pulls Docker image
# → Restarts container
# → Health check
```

### 3. Custom Strategy

**Best for:** Specialized workflows, complex deployments

**Configuration:**
```yaml
deploy:
  production:
    type: "custom"
    script: "./scripts/deploy-production.sh"
    environment:
      BRANCH: "main"
      TARGET_ENV: "production"
```

**Script Example (deploy-production.sh):**
```bash
#!/bin/bash
set -e

echo "Starting custom deployment..."
cd /var/www/production

# Pull code
git pull origin main

# Install dependencies
composer install --no-dev --optimize-autoloader

# Migrate database
php artisan migrate --force

# Clear caches
php artisan config:cache
php artisan route:cache

# Reload PHP
sudo systemctl reload php8.2-fpm

# Health check
curl -f http://localhost/api/health || exit 1

echo "Deployment successful"
```

## Safety Features

### Pre-Deploy Validation

```bash
$ devflow deploy production

1. Checking configuration... ✓
2. Validating branch... ✓
3. Checking SSH connection... ✓
4. Running pre-deploy checks... ✓
5. Verifying health check endpoint... ✓

All checks passed. Continue? (yes/no)
```

**Validations Performed:**
- SSH key exists & is accessible
- Remote host is reachable
- Health check endpoint is valid
- No uncommitted changes locally
- Branch is up-to-date

### Production Safeguards

```javascript
// Production requires explicit confirmation
if (environment === 'production') {
  const confirmed = await prompt.confirm(
    'Deploy to PRODUCTION?\n' +
    'Branch: ' + currentBranch + '\n' +
    'Host: ' + config.host + '\n' +
    'This action is irreversible. Continue?'
  );

  if (!confirmed) {
    throw new Error('Deploy cancelled');
  }
}
```

### Health Checks

```yaml
health_check:
  url: "https://prod.company.com/api/health"
  timeout: 30
  retries: 3
  retry_delay: 5000  # 5 seconds between retries
```

**Health Check Flow:**
1. Wait for endpoint to return 200 OK
2. Retry up to 3 times with backoff
3. If all retries fail, initiate rollback
4. Log failure details

## Deployment Flow

### Standard Deployment

```
1. Pre-Deploy Checks
   ├─ Validate configuration
   ├─ Check SSH connection
   ├─ Verify branch is up-to-date
   └─ Confirm with user (production only)

2. Pre-Deploy Commands
   ├─ git pull
   ├─ composer install
   └─ Custom pre-deploy hooks

3. Deploy Commands
   ├─ Database migrations
   ├─ Cache clear
   └─ Queue restart

4. Post-Deploy Commands
   ├─ Config cache
   ├─ Route cache
   └─ Service reload

5. Health Checks
   ├─ Check health endpoint
   ├─ Verify API responses
   └─ Monitor error logs

6. Log Deployment
   ├─ Record success/failure
   ├─ Store execution time
   └─ Archive output logs
```

## Rollback Procedures

### Manual Rollback

```bash
# View deployment history
$ devflow deploy log production

# Rollback to specific version
$ devflow deploy rollback production --to=abc123

# Or rollback to previous
$ devflow deploy rollback production --previous
```

### Automatic Rollback

If health checks fail, automatic rollback triggers:

```yaml
deploy:
  production:
    auto_rollback: true
    rollback_on_health_check_failure: true
```

### Rollback Strategy (Git-based)

```bash
1. Current: Commit ABC (deploy failed)
2. Previous: Commit ZYX (healthy)

Rollback steps:
  git checkout ZYX
  git pull origin main
  php artisan migrate --force
  php artisan cache:clear
  php artisan queue:restart
  # Health checks...
```

### Rollback Strategy (Database-safe)

For Laravel apps with migrations:

```bash
# Forward migrations tracked
php artisan migrate --force

# Rollback tracked in deploy log
php artisan migrate:rollback --batch=5 --force
```

## Deployment History

### View Deployment Logs

```bash
$ devflow deploy log production

╔════════════════════════════════════════════════════════════╗
║  Deployment History: production                            ║
╠════════════════════════════════════════════════════════════╣
║  Commit    │ Date               │ Status    │ Duration      ║
├─────────────────────────────────────────────────────────────┤
║ abc123d    │ 2026-03-13 14:30   │ ✓ Success │ 2min 15sec    ║
║ xyz789a    │ 2026-03-13 10:15   │ ✓ Success │ 3min 02sec    ║
║ def456b    │ 2026-03-12 18:45   │ ✗ Failed  │ 1min 34sec    ║
║ ghi012c    │ 2026-03-12 14:20   │ ⟲ Rolled  │ -             ║
╚════════════════════════════════════════════════════════════╝
```

### Detailed Deploy Logs

```bash
$ devflow deploy log production --commit=abc123d

[14:30:15] Starting deployment to production...
[14:30:16] Connecting to prod.company.com...
[14:30:18] SSH connection established
[14:30:20] Running pre-deploy commands...
[14:30:21]   git pull origin main... OK
[14:30:35]   composer install... OK
[14:30:55] Running deploy commands...
[14:30:56]   php artisan migrate... OK
[14:31:10]   php artisan cache:clear... OK
[14:31:15] Running post-deploy commands...
[14:31:16]   php artisan config:cache... OK
[14:31:20]   systemctl reload php8.2-fpm... OK
[14:31:25] Running health checks...
[14:31:26]   GET https://prod.company.com/api/health
[14:31:27]   Status: 200 OK, Response time: 145ms
[14:31:27] ✓ Deployment successful (2min 12sec)
```

## Environment-Specific Configuration

### Development

```yaml
deploy:
  development:
    type: "ssh"
    host: "localhost"
    requires_approval: false
    auto_rollback: false
```

### Staging

```yaml
deploy:
  staging:
    type: "ssh"
    host: "staging.company.com"
    requires_approval: false
    auto_rollback: true
```

### Production

```yaml
deploy:
  production:
    type: "ssh"
    host: "prod.company.com"
    requires_approval: true
    auto_rollback: true
    health_check:
      retries: 5
      timeout: 60
```

## Multi-Server Deployment

### Deploy to Multiple Servers

```yaml
deploy:
  production:
    type: "ssh"
    servers:
      - name: "web-1"
        host: "prod-1.company.com"
      - name: "web-2"
        host: "prod-2.company.com"
      - name: "api"
        host: "api.company.com"
    parallel: true  # Deploy to all simultaneously
    strategy: "rolling"  # Or: "blue-green", "canary"
```

### Sequential Deployment

```bash
$ devflow deploy production --sequential

1. Deploy to web-1... ✓
2. Deploy to web-2... ✓
3. Deploy to api... ✓
```

### Rolling Deployment

Deploy to servers one-by-one, verifying health between each.

### Blue-Green Deployment

Maintain two identical environments, switch traffic:

```bash
$ devflow deploy production --strategy=blue-green

Current: Blue (prod-blue-1, prod-blue-2)
New: Green (prod-green-1, prod-green-2)

1. Deploy to Green servers... ✓
2. Health check Green... ✓
3. Switch load balancer... ✓
4. Monitor for 5 minutes...
5. Keep Blue as rollback target
```

## Monitoring & Alerts

### Post-Deploy Monitoring

```bash
$ devflow deploy status production

╔═══════════════════════════════════════════════════════════╗
║  Deployment Status: production                             ║
╠═══════════════════════════════════════════════════════════╣
║  Version: abc123d (deployed 5 minutes ago)                 ║
║  Branch: main                                              ║
║  Status: ✓ Healthy                                         ║
║  Uptime: 99.99%                                            ║
║  Error Rate: 0.01%                                         ║
║  Response Time: 145ms (avg)                                ║
║  Active Requests: 24                                       ║
║  Last Health Check: 4 minutes ago                          ║
╚═══════════════════════════════════════════════════════════╝
```

### Health Check Endpoints

Recommended health check endpoint:

```javascript
// src/routes/health.js
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime(),
    checks: {
      database: await checkDatabase(),
      cache: await checkCache(),
      queue: await checkQueue(),
      api: await checkExternalAPIs()
    }
  };

  const isHealthy = Object.values(health.checks).every(c => c.ok);
  res.status(isHealthy ? 200 : 503).json(health);
});
```

### Slack Notifications

```yaml
deploy:
  production:
    notifications:
      slack:
        webhook: "${SLACK_WEBHOOK}"
        on: ["success", "failure"]
        message: |
          Deployment {{ status }}
          Version: {{ commit }}
          Duration: {{ duration }}
```

## Troubleshooting

### SSH Connection Failed

```bash
$ devflow doctor

SSH Checks:
  ✗ Cannot connect to prod.company.com:22

Suggestions:
  1. Verify SSH key: ssh-keygen -t rsa
  2. Add to authorized_keys: ssh-copy-id user@host
  3. Check firewall rules
  4. Test manual SSH: ssh -i ~/.ssh/id_rsa user@prod.company.com
```

### Health Check Failed

```bash
Deployment started but health check failed:
  GET https://prod.company.com/api/health
  Status: 503 (expected 200)

Action: Initiating automatic rollback...
  Rolling back to previous commit...
  Health check passed ✓
```

### Deployment Timeout

```bash
Pre-deploy command exceeded timeout:
  git pull origin main (timeout: 30s)

Action: Connection likely stalled
Suggestion: Check network or SSH host responsiveness
```

## Security Best Practices

### SSH Key Management

```bash
# Generate SSH key (if not exists)
ssh-keygen -t rsa -b 4096 -f ~/.ssh/devflow_rsa

# Add to deployment server
ssh-copy-id -i ~/.ssh/devflow_rsa user@prod.company.com

# Configure in .devflow.yml
deploy:
  production:
    ssh_key: "~/.ssh/devflow_rsa"
```

### Secrets Management

```bash
# Store tokens in environment
export DEVFLOW_DEPLOY_TOKEN="xxx"

# Reference in config (not hardcoded)
deploy:
  production:
    auth_token: "${DEVFLOW_DEPLOY_TOKEN}"
```

### Audit Logging

All deployments logged with:
- Who deployed (git user)
- What was deployed (commit hash, branch)
- When (timestamp)
- To where (environment, host)
- With what outcome (success/failure)

## Continuous Deployment (CD)

### GitHub Actions Integration

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy to Staging

on:
  push:
    branches: [develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - uses: actions/setup-node@v2
        with:
          node-version: 18

      - run: npm install
      - run: npm run test
      - run: npm run lint

      - name: Deploy to staging
        env:
          DEVFLOW_JIRA_TOKEN: ${{ secrets.DEVFLOW_JIRA_TOKEN }}
          DEVFLOW_SSH_KEY: ${{ secrets.DEVFLOW_SSH_KEY }}
        run: devflow deploy staging
```

## Performance Optimization

### Parallel Deployments

Deploy to multiple servers simultaneously:

```bash
devflow deploy production --parallel --max-workers=4
```

### Caching Strategy

Cache dependencies between deployments:

```yaml
deploy:
  production:
    cache:
      - vendor/
      - node_modules/
      - .composer-cache/
```

## Disaster Recovery

### Backup Strategy

Before production deployment:

```bash
# Automatic database backup
php artisan backup:run --only-db

# Store backup
gsutil cp backup.sql gs://backups/production/
```

### Point-in-Time Recovery

```bash
# List available backups
devflow deploy backups production

# Restore from backup
devflow deploy restore production --backup=2026-03-13-14-30-00
```

## Related Documentation

- **Deployment Command:** docs/06-DEPLOY-AUTOMATION.md
- **System Architecture:** docs/system-architecture.md
- **Code Standards:** docs/code-standards.md
