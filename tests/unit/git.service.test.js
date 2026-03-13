import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateBranchName,
  detectCommitType,
  generateCommitMessage,
  extractJiraIdFromBranch,
  GitService,
} from '../../src/services/git.service.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../src/utils/config.js', () => ({
  loadConfig: () => ({
    git: {
      base_branch: 'develop',
      branch_format: '{prefix}/{jira_id}-{short_desc}',
      commit_format: '[{jira_id}] {type}: {message}',
    },
  }),
  resetConfig: vi.fn(),
}));

vi.mock('simple-git', () => ({
  default: () => ({
    branchLocal: vi.fn().mockResolvedValue({ current: 'feature/PROJ-456-some-task' }),
    diff: vi.fn().mockResolvedValue('A\tsrc/new-file.js\nM\tsrc/existing.js\nD\tsrc/old.js'),
    checkout: vi.fn().mockResolvedValue(undefined),
    pull: vi.fn().mockResolvedValue(undefined),
    checkoutLocalBranch: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue({ commit: 'abc123' }),
    push: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(undefined),
    log: vi.fn().mockResolvedValue({
      all: [{ hash: 'abc123', message: 'feat: something', date: '2024-01-01' }],
    }),
  }),
}));

// ── generateBranchName ────────────────────────────────────────────────────────

describe('generateBranchName', () => {
  it('uses "feature" prefix for story/task types', () => {
    const task = { key: 'PROJ-123', summary: 'Add login page', type: 'Story', priority: 'Medium' };
    const branch = generateBranchName(task);
    expect(branch).toBe('feature/PROJ-123-add-login-page');
  });

  it('uses "fix" prefix for bug type', () => {
    const task = { key: 'PROJ-200', summary: 'Fix null pointer', type: 'Bug', priority: 'High' };
    const branch = generateBranchName(task);
    expect(branch).toBe('fix/PROJ-200-fix-null-pointer');
  });

  it('uses "hotfix" prefix for highest priority bug', () => {
    const task = { key: 'PROJ-300', summary: 'Critical crash fix', type: 'Bug', priority: 'Highest' };
    const branch = generateBranchName(task);
    expect(branch).toBe('hotfix/PROJ-300-critical-crash-fix');
  });

  it('sanitizes special characters from summary', () => {
    const task = { key: 'PROJ-400', summary: 'Fix: (issue) with @login & passwords!', type: 'Story', priority: 'Low' };
    const branch = generateBranchName(task);
    // special chars removed, spaces become hyphens
    expect(branch).toMatch(/^feature\/PROJ-400-/);
    expect(branch).not.toMatch(/[():@&!]/);
  });

  it('truncates long summaries to 50 characters for short_desc', () => {
    const task = {
      key: 'PROJ-500',
      summary: 'This is a very long summary that exceeds the maximum allowed length for branch names',
      type: 'Story',
      priority: 'Low',
    };
    const branch = generateBranchName(task);
    const shortDesc = branch.split('PROJ-500-')[1];
    expect(shortDesc.length).toBeLessThanOrEqual(50);
  });

  it('respects custom branch_format from config', () => {
    const task = { key: 'PROJ-600', summary: 'my feature', type: 'Story', priority: 'Low' };
    const config = { branch_format: '{jira_id}/{prefix}-{short_desc}' };
    const branch = generateBranchName(task, config);
    expect(branch).toBe('PROJ-600/feature-my-feature');
  });
});

// ── detectCommitType ──────────────────────────────────────────────────────────

describe('detectCommitType', () => {
  it('returns "test" when all files are test files', () => {
    const files = [
      { path: 'tests/unit/auth.test.js', status: 'modified' },
      { path: 'tests/unit/user.spec.js', status: 'added' },
    ];
    expect(detectCommitType(files)).toBe('test');
  });

  it('returns "docs" when all files are documentation files', () => {
    const files = [
      { path: 'docs/setup.md', status: 'modified' },
      { path: 'README.txt', status: 'modified' },
    ];
    expect(detectCommitType(files)).toBe('docs');
  });

  it('returns "chore" when all files are config files', () => {
    const files = [
      { path: 'config/app.yml', status: 'modified' },
      { path: '.env', status: 'modified' },
    ];
    expect(detectCommitType(files)).toBe('chore');
  });

  it('returns "feat" for mixed files', () => {
    const files = [
      { path: 'src/controllers/UserController.js', status: 'modified' },
      { path: 'tests/unit/user.test.js', status: 'added' },
    ];
    expect(detectCommitType(files)).toBe('feat');
  });

  it('returns "feat" when migration files are present', () => {
    const files = [
      { path: 'database/migrations/create_users_table.js', status: 'added' },
      { path: 'src/models/User.js', status: 'modified' },
    ];
    expect(detectCommitType(files)).toBe('feat');
  });

  it('returns "feat" as default for unclassified files', () => {
    const files = [
      { path: 'src/utils/helpers.js', status: 'modified' },
    ];
    expect(detectCommitType(files)).toBe('feat');
  });
});

// ── generateCommitMessage ─────────────────────────────────────────────────────

describe('generateCommitMessage', () => {
  it('formats message with jira ID and type', () => {
    const files = [
      { path: 'src/controllers/UserController.js', status: 'modified' },
    ];
    const message = generateCommitMessage(files, 'PROJ-123', 'feat');
    expect(message).toMatch(/^\[PROJ-123\] feat:/);
  });

  it('includes body bullets for categorized files', () => {
    const files = [
      { path: 'src/controllers/UserController.js', status: 'added' },
      { path: 'src/models/User.js', status: 'modified' },
    ];
    const message = generateCommitMessage(files, 'PROJ-123', 'feat');
    expect(message).toContain('- Add controllers');
    expect(message).toContain('- Update models');
  });

  it('keeps summary line within 72 characters', () => {
    const files = [
      { path: 'src/controllers/a.js', status: 'added' },
      { path: 'src/models/b.js', status: 'added' },
      { path: 'src/services/c.js', status: 'added' },
      { path: 'src/routes/d.js', status: 'added' },
      { path: 'src/views/e.vue', status: 'added' },
      { path: 'src/config/f.yml', status: 'added' },
    ];
    const message = generateCommitMessage(files, 'PROJ-999', 'feat');
    const firstLine = message.split('\n')[0];
    expect(firstLine.length).toBeLessThanOrEqual(72);
  });

  it('uses "Delete" verb for deleted files', () => {
    const files = [
      { path: 'src/models/OldModel.js', status: 'deleted' },
    ];
    const message = generateCommitMessage(files, 'PROJ-123', 'refactor');
    expect(message).toContain('- Delete models');
  });
});

// ── extractJiraIdFromBranch ───────────────────────────────────────────────────

describe('extractJiraIdFromBranch', () => {
  it('extracts JIRA ID from a standard branch name', () => {
    expect(extractJiraIdFromBranch('feature/PROJ-123-add-login')).toBe('PROJ-123');
  });

  it('extracts JIRA ID with different project keys', () => {
    expect(extractJiraIdFromBranch('fix/ABC-9999-critical-fix')).toBe('ABC-9999');
  });

  it('returns null when no JIRA ID is present', () => {
    expect(extractJiraIdFromBranch('main')).toBeNull();
    expect(extractJiraIdFromBranch('feature/add-something')).toBeNull();
  });
});

// ── GitService class methods ──────────────────────────────────────────────────

describe('GitService', () => {
  let service;
  let gitMock;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-import to get fresh mock instance
    const simpleGitModule = await import('simple-git');
    service = new GitService();
    gitMock = service.git;
  });

  describe('getStagedFiles', () => {
    it('parses git diff output into path/status objects', async () => {
      const files = await service.getStagedFiles();
      expect(files).toHaveLength(3);
      expect(files[0]).toEqual({ path: 'src/new-file.js', status: 'added' });
      expect(files[1]).toEqual({ path: 'src/existing.js', status: 'modified' });
      expect(files[2]).toEqual({ path: 'src/old.js', status: 'deleted' });
    });

    it('returns empty array when no staged files', async () => {
      gitMock.diff.mockResolvedValueOnce('');
      const files = await service.getStagedFiles();
      expect(files).toEqual([]);
    });
  });

  describe('getCurrentBranch', () => {
    it('returns the current branch name', async () => {
      const branch = await service.getCurrentBranch();
      expect(branch).toBe('feature/PROJ-456-some-task');
    });
  });

  describe('createBranch', () => {
    it('calls checkout, pull, and checkoutLocalBranch in order', async () => {
      const calls = [];
      gitMock.checkout.mockImplementation(() => { calls.push('checkout'); return Promise.resolve(); });
      gitMock.pull.mockImplementation(() => { calls.push('pull'); return Promise.resolve(); });
      gitMock.checkoutLocalBranch.mockImplementation(() => { calls.push('checkoutLocalBranch'); return Promise.resolve(); });

      await service.createBranch('feature/PROJ-789-new-feature', 'develop');

      expect(calls).toEqual(['checkout', 'pull', 'checkoutLocalBranch']);
      expect(gitMock.checkout).toHaveBeenCalledWith('develop');
      expect(gitMock.pull).toHaveBeenCalledWith('origin', 'develop');
      expect(gitMock.checkoutLocalBranch).toHaveBeenCalledWith('feature/PROJ-789-new-feature');
    });
  });

  describe('commit', () => {
    it('calls git.commit with the message', async () => {
      await service.commit('fix: resolve issue');
      expect(gitMock.commit).toHaveBeenCalledWith('fix: resolve issue');
    });

    it('calls git.add("-A") when options.all is true', async () => {
      await service.commit('feat: add feature', { all: true });
      expect(gitMock.add).toHaveBeenCalledWith('-A');
      expect(gitMock.commit).toHaveBeenCalledWith('feat: add feature');
    });

    it('passes --amend flag when options.amend is true', async () => {
      await service.commit('fix: amend last commit', { amend: true });
      expect(gitMock.commit).toHaveBeenCalledWith(
        'fix: amend last commit',
        undefined,
        { '--amend': null }
      );
    });
  });

  describe('push', () => {
    it('calls push with origin, branch, and --set-upstream', async () => {
      await service.push('feature/PROJ-123-my-feature');
      expect(gitMock.push).toHaveBeenCalledWith(
        'origin',
        'feature/PROJ-123-my-feature',
        ['--set-upstream']
      );
    });
  });

  describe('getCommitLog', () => {
    it('returns mapped commit objects', async () => {
      const log = await service.getCommitLog('develop');
      expect(log).toEqual([
        { hash: 'abc123', message: 'feat: something', date: '2024-01-01' },
      ]);
    });
  });
});
