// Phase 4: Git automation
// Spec: docs/05-GIT-AUTOMATION.md

import { execSync } from 'child_process';
import simpleGit from 'simple-git';
import { loadConfig } from '../utils/config.js';

// ── Pure helper functions (exported for testing) ──────────────────────────────

/**
 * Generate a branch name from a Jira task.
 * @param {{ key: string, summary: string, type: string, priority: string }} task
 * @param {{ branch_format?: string }} config  - git config section
 * @returns {string}
 */
export function generateBranchName(task, config = {}) {
  const branchFormat = config.branch_format ?? '{prefix}/{jira_id}-{short_desc}';

  // Determine prefix
  const typeLower = (task.type ?? '').toLowerCase();
  const priorityLower = (task.priority ?? '').toLowerCase();

  let prefix;
  if (typeLower === 'bug' && (priorityLower === 'highest' || priorityLower === 'critical')) {
    prefix = 'hotfix';
  } else if (typeLower === 'bug') {
    prefix = 'fix';
  } else {
    prefix = 'feature';
  }

  // Generate short description
  let shortDesc = (task.summary ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')   // remove special chars
    .trim()
    .replace(/\s+/g, '-')            // spaces → hyphens
    .replace(/-+/g, '-')             // collapse multiple hyphens
    .slice(0, 50)
    .replace(/-+$/, '');             // trim trailing hyphens

  const jiraId = task.key ?? '';

  return branchFormat
    .replace('{prefix}', prefix)
    .replace('{jira_id}', jiraId)
    .replace('{short_desc}', shortDesc);
}

/**
 * Detect commit type from staged files.
 * @param {Array<{ path: string, status: string }>} stagedFiles
 * @returns {string}
 */
export function detectCommitType(stagedFiles) {
  if (!stagedFiles || stagedFiles.length === 0) return 'feat';

  const isTestFile = (f) => /\.(test|spec)\.(js|ts|jsx|tsx|php)$/.test(f.path) || /\/tests?\//i.test(f.path);
  const isDocFile = (f) => /\.(md|txt)$/.test(f.path) || /\/docs?\//i.test(f.path);
  const isConfigFile = (f) => /\.(yml|yaml|json|env)$/.test(f.path) || /\/config\//i.test(f.path);
  const isMigrationFile = (f) => /\/migrations?\//i.test(f.path) || /migration/i.test(f.path);

  if (stagedFiles.every(isTestFile)) return 'test';
  if (stagedFiles.every(isDocFile)) return 'docs';
  if (stagedFiles.every(isConfigFile)) return 'chore';
  if (stagedFiles.some(isMigrationFile)) return 'feat';

  return 'feat';
}

/**
 * Generate a conventional commit message.
 * @param {Array<{ path: string, status: string }>} files
 * @param {string} jiraId
 * @param {string} type
 * @returns {string}
 */
export function generateCommitMessage(files, jiraId, type) {
  const categories = {
    controllers: [],
    models: [],
    migrations: [],
    services: [],
    requests: [],
    tests: [],
    routes: [],
    config: [],
    views: [],
    other: [],
  };

  for (const file of files) {
    const p = file.path.toLowerCase();
    if (/\/controllers?\//i.test(p) || /controller/i.test(p)) {
      categories.controllers.push(file);
    } else if (/\/models?\//i.test(p) || /model/i.test(p)) {
      categories.models.push(file);
    } else if (/\/migrations?\//i.test(p) || /migration/i.test(p)) {
      categories.migrations.push(file);
    } else if (/\/services?\//i.test(p) || /service/i.test(p)) {
      categories.services.push(file);
    } else if (/\/requests?\//i.test(p) || /request/i.test(p)) {
      categories.requests.push(file);
    } else if (/\.(test|spec)\.(js|ts|jsx|tsx|php)$/.test(p) || /\/tests?\//i.test(p)) {
      categories.tests.push(file);
    } else if (/\/routes?\//i.test(p) || /route/i.test(p)) {
      categories.routes.push(file);
    } else if (/\.(yml|yaml|json|env)$/.test(p) || /\/config\//i.test(p)) {
      categories.config.push(file);
    } else if (/\/views?\//i.test(p) || /\.(html|blade\.php|vue|jsx|tsx)$/.test(p)) {
      categories.views.push(file);
    } else {
      categories.other.push(file);
    }
  }

  // Build body bullets
  const bodyLines = [];
  for (const [category, fileList] of Object.entries(categories)) {
    if (fileList.length === 0) continue;
    const hasAdded = fileList.some((f) => f.status === 'added');
    const hasDeleted = fileList.some((f) => f.status === 'deleted');
    const verb = hasAdded ? 'Add' : hasDeleted ? 'Delete' : 'Update';
    bodyLines.push(`- ${verb} ${category}`);
  }

  // Build summary from non-empty category names (max 72 chars total line)
  const usedCategories = Object.entries(categories)
    .filter(([, list]) => list.length > 0)
    .map(([cat]) => cat);

  let summary = usedCategories.join(', ');
  const prefix = `[${jiraId}] ${type}: `;
  if ((prefix + summary).length > 72) {
    summary = summary.slice(0, 72 - prefix.length).replace(/,?\s*$/, '');
  }

  const body = bodyLines.join('\n');
  return `[${jiraId}] ${type}: ${summary}\n\n${body}`;
}

/**
 * Extract JIRA ID from a branch name.
 * @param {string} branchName
 * @returns {string|null}
 */
export function extractJiraIdFromBranch(branchName) {
  const match = branchName.match(/([A-Z]+-\d+)/);
  return match ? match[1] : null;
}

// ── GitService class ──────────────────────────────────────────────────────────

export class GitService {
  constructor(config = null) {
    this.config = config ?? loadConfig() ?? {};
    this.gitConfig = this.config.git ?? {};
    this.baseBranch = this.gitConfig.base_branch ?? 'develop';
    this.branchFormat = this.gitConfig.branch_format ?? '{prefix}/{jira_id}-{short_desc}';
    this.commitFormat = this.gitConfig.commit_format ?? '[{jira_id}] {type}: {message}';
    this.preShipConfig = this.gitConfig.pre_ship ?? {};
    this.git = simpleGit();
  }

  /**
   * Return staged files as [{ path, status }].
   * @returns {Promise<Array<{ path: string, status: string }>>}
   */
  async getStagedFiles() {
    const output = await this.git.diff(['--cached', '--name-status']);
    if (!output || !output.trim()) return [];

    const statusMap = {
      A: 'added',
      M: 'modified',
      D: 'deleted',
      R: 'renamed',
    };

    return output
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const parts = line.split('\t');
        const rawStatus = parts[0][0]; // first char handles R100, etc.
        const filePath = parts[parts.length - 1];
        return {
          path: filePath,
          status: statusMap[rawStatus] ?? rawStatus.toLowerCase(),
        };
      });
  }

  /**
   * Return the current branch name.
   * @returns {Promise<string>}
   */
  async getCurrentBranch() {
    const result = await this.git.branchLocal();
    return result.current;
  }

  /**
   * Create and checkout a new branch from baseBranch.
   * @param {string} branchName
   * @param {string} [baseBranch]
   */
  async createBranch(branchName, baseBranch) {
    const base = baseBranch ?? this.baseBranch;
    await this.git.checkout(base);
    await this.git.pull('origin', base);
    await this.git.checkoutLocalBranch(branchName);
  }

  /**
   * Create a git commit.
   * @param {string} message
   * @param {{ all?: boolean, amend?: boolean }} [options]
   */
  async commit(message, options = {}) {
    if (options.all) {
      await this.git.add('-A');
    }
    if (options.amend) {
      await this.git.commit(message, undefined, { '--amend': null });
    } else {
      await this.git.commit(message);
    }
  }

  /**
   * Push the given branch to origin with --set-upstream.
   * @param {string} branch
   */
  async push(branch) {
    await this.git.push('origin', branch, ['--set-upstream']);
  }

  /**
   * Get commit log from baseBranch to HEAD.
   * @param {string} [baseBranch]
   * @returns {Promise<Array<{ hash: string, message: string, date: string }>>}
   */
  async getCommitLog(baseBranch) {
    const base = baseBranch ?? this.baseBranch;
    const result = await this.git.log({ from: base, to: 'HEAD' });
    return result.all.map(({ hash, message, date }) => ({ hash, message, date }));
  }

  /**
   * Run pre-ship checks (lint + test).
   * @param {object} [config]  - optional override of pre_ship config
   * @returns {{ passed: boolean, results: Array<{ name: string, passed: boolean, output: string }> }}
   */
  async runPreShipChecks(config) {
    const preShip = config ?? this.preShipConfig;
    const results = [];

    const runCheck = (name, command) => {
      try {
        const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
        results.push({ name, passed: true, output: output.trim() });
      } catch (err) {
        results.push({ name, passed: false, output: (err.stdout ?? '') + (err.stderr ?? '') });
      }
    };

    if (preShip.lint?.enabled && preShip.lint?.command) {
      runCheck('lint', preShip.lint.command);
    }

    if (preShip.test?.enabled && preShip.test?.command) {
      runCheck('test', preShip.test.command);
    }

    const passed = results.every((r) => r.passed);
    return { passed, results };
  }
}
