import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startCommand, commitCommand, shipCommand } from '../../src/commands/ship.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../src/services/jira.service.js', () => ({
  JiraService: vi.fn().mockImplementation(() => ({
    getIssue: vi.fn().mockResolvedValue({
      key: 'PROJ-456',
      summary: 'Implement feature',
      type: 'story',
      priority: 'high',
      acceptanceCriteria: ['AC 1', 'AC 2'],
    }),
    transitionIssue: vi.fn().mockResolvedValue(undefined),
    addComment: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../src/services/git.service.js', () => {
  const actual = {
    generateBranchName: (task, config) => `feature/${task.key}-implement-feature`,
    detectCommitType: () => 'feat',
    generateCommitMessage: (files, jiraId, type) => `[${jiraId}] ${type}: auto message`,
    extractJiraIdFromBranch: (branch) => branch.match(/([A-Z]+-\d+)/)?.[1] || null,
    detectPlatform: () => ({ platform: 'github', owner: 'owner', repo: 'repo' }),
    generatePRDescription: () => '## Description\nPR body',
  };
  return {
    ...actual,
    GitService: vi.fn().mockImplementation(() => ({
      getCurrentBranch: vi.fn().mockResolvedValue('feature/PROJ-456-implement-feature'),
      createBranch: vi.fn().mockResolvedValue(undefined),
      getStagedFiles: vi.fn().mockResolvedValue([{ path: 'src/file.js', status: 'modified' }]),
      commit: vi.fn().mockResolvedValue({ commit: 'abc123' }),
      push: vi.fn().mockResolvedValue(undefined),
      getCommitLog: vi.fn().mockResolvedValue([{ hash: 'abc', message: 'feat: test', date: '2024-01-01' }]),
      getRemoteUrl: vi.fn().mockResolvedValue('git@github.com:owner/repo.git'),
      createPR: vi.fn().mockResolvedValue({ number: 42, url: 'https://api.github.com/...', htmlUrl: 'https://github.com/owner/repo/pull/42' }),
      runPreShipChecks: vi.fn().mockResolvedValue({ passed: true, results: [] }),
    })),
  };
});

vi.mock('../../src/utils/config.js', () => ({
  loadConfig: () => ({ git: { base_branch: 'develop' }, jira: { host: 'https://test.atlassian.net' } }),
  resetConfig: vi.fn(),
}));

// ── Console capture ───────────────────────────────────────────────────────────

let output = '';
const originalConsoleLog = console.log;

beforeEach(() => {
  output = '';
  console.log = (...args) => {
    output += args.join(' ') + '\n';
  };
});

afterEach(() => {
  console.log = originalConsoleLog;
  vi.clearAllMocks();
});

// ── startCommand tests ────────────────────────────────────────────────────────

describe('startCommand', () => {
  it('creates branch and transitions Jira issue to In Progress', async () => {
    const { JiraService } = await import('../../src/services/jira.service.js');
    const { GitService } = await import('../../src/services/git.service.js');

    await startCommand('PROJ-456', {});

    const jiraInstance = JiraService.mock.results[0].value;
    const gitInstance = GitService.mock.results[0].value;

    expect(jiraInstance.getIssue).toHaveBeenCalledWith('PROJ-456');
    expect(gitInstance.createBranch).toHaveBeenCalledWith(
      'feature/PROJ-456-implement-feature',
      'develop'
    );
    expect(jiraInstance.transitionIssue).toHaveBeenCalledWith('PROJ-456', 'In Progress');
    expect(output).toContain('feature/PROJ-456-implement-feature');
  });

  it('skips Jira transition when --no-transition flag is set', async () => {
    const { JiraService } = await import('../../src/services/jira.service.js');

    await startCommand('PROJ-456', { noTransition: true });

    const jiraInstance = JiraService.mock.results[0].value;
    expect(jiraInstance.transitionIssue).not.toHaveBeenCalled();
    expect(output).toContain('feature/PROJ-456-implement-feature');
  });
});

// ── commitCommand tests ───────────────────────────────────────────────────────

describe('commitCommand', () => {
  it('formats commit message with Jira ID and type when message is provided', async () => {
    const { GitService } = await import('../../src/services/git.service.js');

    await commitCommand('my commit message', {});

    const gitInstance = GitService.mock.results[0].value;
    expect(gitInstance.commit).toHaveBeenCalledWith(
      '[PROJ-456] feat: my commit message',
      { all: undefined, amend: undefined }
    );
    expect(output).toContain('[PROJ-456] feat: my commit message');
  });

  it('auto-generates commit message when no message is given', async () => {
    const { GitService } = await import('../../src/services/git.service.js');

    await commitCommand(undefined, {});

    const gitInstance = GitService.mock.results[0].value;
    expect(gitInstance.commit).toHaveBeenCalledWith(
      '[PROJ-456] feat: auto message',
      { all: undefined, amend: undefined }
    );
  });

  it('shows error when no staged files and -a flag not set', async () => {
    const { GitService } = await import('../../src/services/git.service.js');

    GitService.mockImplementationOnce(() => ({
      getCurrentBranch: vi.fn().mockResolvedValue('feature/PROJ-456-implement-feature'),
      getStagedFiles: vi.fn().mockResolvedValue([]),
      commit: vi.fn().mockResolvedValue({ commit: 'abc123' }),
    }));

    await commitCommand('some message', {});

    expect(output).toContain('No staged changes');
    expect(output).toContain('-a');
  });
});

// ── shipCommand tests ─────────────────────────────────────────────────────────

describe('shipCommand', () => {
  it('pushes branch and creates PR', async () => {
    const { GitService } = await import('../../src/services/git.service.js');
    const { JiraService } = await import('../../src/services/jira.service.js');

    await shipCommand(null, {});

    const gitInstance = GitService.mock.results[0].value;
    const jiraInstance = JiraService.mock.results[0].value;

    expect(gitInstance.push).toHaveBeenCalledWith('feature/PROJ-456-implement-feature');
    expect(gitInstance.createPR).toHaveBeenCalled();
    expect(jiraInstance.transitionIssue).toHaveBeenCalledWith('PROJ-456', 'In Review');
    expect(jiraInstance.addComment).toHaveBeenCalledWith(
      'PROJ-456',
      expect.stringContaining('https://github.com/owner/repo/pull/42')
    );
    expect(output).toContain('https://github.com/owner/repo/pull/42');
  });

  it('creates a draft PR when --draft flag is set', async () => {
    const { GitService } = await import('../../src/services/git.service.js');

    await shipCommand(null, { draft: true });

    const gitInstance = GitService.mock.results[0].value;
    expect(gitInstance.createPR).toHaveBeenCalledWith(
      expect.objectContaining({ draft: true })
    );
  });
});
