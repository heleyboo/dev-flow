import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { execSync } from 'child_process';
import { loadConfig } from '../utils/config.js';
import { homedir } from 'os';

export class DeployService {
  constructor(config = null) {
    this.config = config || loadConfig() || {};
    this.historyPath = resolve(process.cwd(), '.devflow/deploy-history.json');
  }

  async preDeployChecks(environment) {
    const results = [];

    // Check 1: git clean
    try {
      const status = execSync('git status --porcelain').toString();
      const passed = status.trim() === '';
      results.push({
        name: 'git_clean',
        passed,
        message: passed
          ? 'Working directory is clean'
          : 'Uncommitted changes detected. Commit or stash first.',
      });
    } catch (err) {
      results.push({
        name: 'git_clean',
        passed: false,
        message: `Could not check git status: ${err.message}`,
      });
    }

    // Check 2: correct branch
    try {
      const branch = execSync('git branch --show-current').toString().trim();
      const deployConfig = this.config.deploy?.[environment] || {};
      const expectedBranch =
        deployConfig.branch || (environment === 'production' ? 'main' : 'develop');
      const passed = branch === expectedBranch;
      results.push({
        name: 'correct_branch',
        passed,
        message: passed
          ? `On correct branch: ${branch}`
          : `Expected branch "${expectedBranch}", currently on "${branch}"`,
      });
    } catch (err) {
      results.push({
        name: 'correct_branch',
        passed: false,
        message: `Could not check branch: ${err.message}`,
      });
    }

    // Check 3: up to date with remote
    try {
      execSync('git fetch origin');
      const local = execSync('git rev-parse HEAD').toString().trim();
      const branch = execSync('git branch --show-current').toString().trim();
      const remote = execSync(`git rev-parse origin/${branch}`).toString().trim();
      const passed = local === remote;
      results.push({
        name: 'up_to_date',
        passed,
        message: passed
          ? 'Local branch is up to date with remote'
          : 'Local branch is behind remote. Pull first.',
      });
    } catch (err) {
      results.push({
        name: 'up_to_date',
        passed: false,
        message: `Could not check remote sync: ${err.message}`,
      });
    }

    return results;
  }

  async deploy(environment, options = {}) {
    const deployConfig = this.config.deploy?.[environment];

    if (!deployConfig) {
      throw new Error(`No deploy configuration for "${environment}"`);
    }

    // Production safeguards
    if (environment === 'production' && deployConfig.safeguards) {
      const safeguards = deployConfig.safeguards;
      const now = new Date();

      // Check cooldown
      if (safeguards.cooldown_minutes) {
        const history = this.getDeployHistory(environment);
        if (history.length > 0) {
          const lastDeploy = new Date(history[0].timestamp);
          const minutesAgo = (now - lastDeploy) / (1000 * 60);
          if (minutesAgo < safeguards.cooldown_minutes) {
            throw new Error(
              `Production cooldown active. Last deploy was ${Math.floor(minutesAgo)} minutes ago. Wait ${safeguards.cooldown_minutes} minutes between production deploys.`
            );
          }
        }
      }

      // Check blocked hours
      if (safeguards.blocked_hours) {
        const day = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const blockRule = safeguards.blocked_hours[day];
        if (blockRule === 'all') {
          throw new Error(`Production deploys are blocked on ${day}.`);
        }
        if (blockRule?.after) {
          const [blockedHour, blockedMin] = blockRule.after.split(':').map(Number);
          const currentMinutes = now.getHours() * 60 + now.getMinutes();
          const blockedMinutes = blockedHour * 60 + blockedMin;
          if (currentMinutes >= blockedMinutes) {
            throw new Error(
              `Production deploys are blocked after ${blockRule.after} on ${day}.`
            );
          }
        }
      }
    }

    // Dry run
    if (options.dryRun) {
      console.log(`[DRY RUN] Would deploy to ${environment}`);
      console.log(`[DRY RUN] Type: ${deployConfig.type}`);
      console.log(`[DRY RUN] Commands: ${JSON.stringify(deployConfig.commands || [])}`);
      return { success: true, dryRun: true, duration: 0, results: [] };
    }

    const startTime = Date.now();
    let results = [];
    let success = false;
    let error = null;

    try {
      switch (deployConfig.type) {
        case 'ssh':
          results = await this.deploySSH(deployConfig);
          break;
        case 'docker':
          results = await this.deployDocker(deployConfig);
          break;
        case 'custom':
          results = await this.deployCustom(deployConfig);
          break;
        default:
          throw new Error(`Unknown deploy type: ${deployConfig.type}`);
      }

      // Health check
      if (deployConfig.health_check_url) {
        const healthy = await this.healthCheck(deployConfig);
        if (!healthy) {
          if (deployConfig.auto_rollback) {
            await this.rollback(environment);
          }
          throw new Error('Health check failed after deploy');
        }
      }

      success = true;
    } catch (err) {
      error = err;
      success = false;
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    // Save deploy record
    await this.saveDeployRecord({
      environment,
      timestamp: new Date().toISOString(),
      status: success ? 'success' : 'failed',
      duration,
      commandResults: results,
      error: error?.message || null,
    });

    if (!success) {
      throw error;
    }

    return { success, duration, results };
  }

  async deploySSH(deployConfig) {
    const { NodeSSH } = await import('node-ssh');
    const ssh = new NodeSSH();

    await ssh.connect({
      host: deployConfig.host,
      username: deployConfig.username || deployConfig.user,
      privateKey: deployConfig.privateKey || `${homedir()}/.ssh/id_rsa`,
    });

    const results = [];
    try {
      for (const cmd of deployConfig.commands || []) {
        const resolved = cmd.replace(/\{path\}/g, deployConfig.path || '');
        const result = await ssh.execCommand(resolved, {
          cwd: deployConfig.path,
        });

        results.push({
          command: resolved,
          stdout: result.stdout,
          stderr: result.stderr,
          code: result.code,
        });

        if (result.code !== 0) {
          throw new Error(
            `Command failed: ${resolved}\n${result.stderr}`
          );
        }
      }
    } finally {
      ssh.dispose();
    }

    return results;
  }

  async deployDocker(deployConfig) {
    const results = [];

    for (const cmd of deployConfig.commands || []) {
      const resolved = cmd
        .replace(/\{compose_file\}/g, deployConfig.compose_file || '')
        .replace(/\{service\}/g, deployConfig.service || '');

      try {
        const stdout = execSync(resolved, { encoding: 'utf-8' });
        results.push({ command: resolved, stdout, code: 0 });
      } catch (err) {
        results.push({
          command: resolved,
          stdout: err.stdout || '',
          stderr: err.stderr || err.message,
          code: err.status || 1,
        });
        throw new Error(`Docker command failed: ${resolved}\n${err.stderr || err.message}`);
      }
    }

    return results;
  }

  async deployCustom(deployConfig) {
    try {
      const stdout = execSync(deployConfig.script, { encoding: 'utf-8' });
      return [{ command: deployConfig.script, stdout, code: 0 }];
    } catch (err) {
      throw new Error(
        `Custom deploy script failed: ${deployConfig.script}\n${err.stderr || err.message}`
      );
    }
  }

  async healthCheck(deployConfig) {
    const url = deployConfig.health_check_url;
    const maxRetries = 3;
    const retryDelay = 2000;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url);
        if (response.ok) return true;
      } catch {
        // retry
      }
      if (i < maxRetries - 1) {
        await new Promise((res) => setTimeout(res, retryDelay));
      }
    }

    return false;
  }

  async rollback(environment, targetCommit = null) {
    const deployConfig = this.config.deploy?.[environment];

    if (!deployConfig) {
      throw new Error(`No deploy configuration for "${environment}"`);
    }

    const results = [];

    if (deployConfig.type === 'ssh') {
      const { NodeSSH } = await import('node-ssh');
      const ssh = new NodeSSH();

      await ssh.connect({
        host: deployConfig.host,
        username: deployConfig.username || deployConfig.user,
        privateKey: deployConfig.privateKey || `${homedir()}/.ssh/id_rsa`,
      });

      try {
        if (targetCommit) {
          const checkoutCmd = `git checkout ${targetCommit}`;
          const checkoutResult = await ssh.execCommand(checkoutCmd, {
            cwd: deployConfig.path,
          });
          results.push({
            command: checkoutCmd,
            stdout: checkoutResult.stdout,
            stderr: checkoutResult.stderr,
            code: checkoutResult.code,
          });
        }

        for (const cmd of deployConfig.rollback_commands || []) {
          const resolved = cmd.replace(/\{path\}/g, deployConfig.path || '');
          const result = await ssh.execCommand(resolved, { cwd: deployConfig.path });
          results.push({
            command: resolved,
            stdout: result.stdout,
            stderr: result.stderr,
            code: result.code,
          });
        }
      } finally {
        ssh.dispose();
      }
    }

    await this.saveDeployRecord({
      environment,
      timestamp: new Date().toISOString(),
      status: 'rolled_back',
      rollbackTarget: targetCommit,
      commandResults: results,
    });

    return { success: true, results };
  }

  getDeployHistory(environment) {
    if (!existsSync(this.historyPath)) {
      return [];
    }

    try {
      const content = readFileSync(this.historyPath, 'utf-8');
      const history = JSON.parse(content);
      const filtered = environment
        ? history.filter((r) => r.environment === environment)
        : history;
      return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch {
      return [];
    }
  }

  async saveDeployRecord(record) {
    const dir = dirname(this.historyPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    let history = [];
    if (existsSync(this.historyPath)) {
      try {
        const content = readFileSync(this.historyPath, 'utf-8');
        history = JSON.parse(content);
      } catch {
        history = [];
      }
    }

    const nextId =
      history.length > 0 ? Math.max(...history.map((r) => r.id || 0)) + 1 : 1;
    record.id = nextId;

    history.push(record);
    writeFileSync(this.historyPath, JSON.stringify(history, null, 2), 'utf-8');

    return record;
  }

  async getEnvironmentStatus() {
    const deployConfigs = this.config.deploy || {};
    const envNames = Object.keys(deployConfigs);

    return envNames.map((env) => {
      const deployConfig = deployConfigs[env];
      const history = this.getDeployHistory(env);
      const lastDeploy = history.length > 0 ? history[0] : null;

      return {
        environment: env,
        branch: deployConfig.branch || null,
        lastDeploy: lastDeploy ? lastDeploy.timestamp : null,
        status: lastDeploy ? lastDeploy.status : 'never_deployed',
      };
    });
  }

  async notify(message, level, deployConfig) {
    try {
      const notifications = deployConfig?.notifications;

      if (notifications?.slack?.webhook_url) {
        await fetch(notifications.slack.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `[${level.toUpperCase()}] ${message}`,
            channel: notifications.slack.channel,
          }),
        }).catch(() => {});
      }

      if (notifications?.discord?.webhook_url) {
        await fetch(notifications.discord.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `[${level.toUpperCase()}] ${message}`,
          }),
        }).catch(() => {});
      }
    } catch {
      // Notifications should never fail the deploy
    }
  }
}
