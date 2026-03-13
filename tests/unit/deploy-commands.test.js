import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  deployCommand,
  deployStatusCommand,
  deployRollbackCommand,
  deployLogCommand,
} from '../../src/commands/deploy.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../src/services/deploy.service.js', () => ({
  DeployService: vi.fn().mockImplementation(() => ({
    preDeployChecks: vi.fn().mockResolvedValue([
      { name: 'git_clean', passed: true },
      { name: 'correct_branch', passed: true },
    ]),
    deploy: vi.fn().mockResolvedValue({ success: true, duration: 23 }),
    rollback: vi.fn().mockResolvedValue({ success: true }),
    getDeployHistory: vi.fn().mockReturnValue([
      {
        id: 1,
        environment: 'staging',
        timestamp: '2024-01-15T14:30:00Z',
        commitHash: 'abc1234def',
        jiraId: 'PROJ-456',
        status: 'success',
        deployedBy: 'dev@co.com',
        duration: 23,
      },
      {
        id: 2,
        environment: 'staging',
        timestamp: '2024-01-14T16:00:00Z',
        commitHash: 'def5678ghi',
        jiraId: 'PROJ-450',
        status: 'success',
        deployedBy: 'dev@co.com',
        duration: 18,
      },
    ]),
    getEnvironmentStatus: vi.fn().mockResolvedValue([
      {
        environment: 'staging',
        branch: 'develop',
        lastDeploy: '2024-01-15T14:30:00Z',
        status: 'success',
      },
      {
        environment: 'production',
        branch: 'main',
        lastDeploy: '2024-01-14T09:00:00Z',
        status: 'success',
      },
    ]),
  })),
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

// ── deployCommand tests ───────────────────────────────────────────────────────

describe('deployCommand', () => {
  it('displays pre-deploy checks', async () => {
    await deployCommand('staging', {});

    expect(output).toContain('git clean');
    expect(output).toContain('correct branch');
  });

  it('shows success result after deploy', async () => {
    await deployCommand('staging', {});

    expect(output).toContain('staging');
    expect(output).toContain('23');
  });

  it('aborts when checks fail and force is not set', async () => {
    const { DeployService } = await import('../../src/services/deploy.service.js');
    DeployService.mockImplementationOnce(() => ({
      preDeployChecks: vi.fn().mockResolvedValue([
        { name: 'git_clean', passed: false, message: 'Uncommitted changes' },
      ]),
      deploy: vi.fn().mockResolvedValue({ success: true, duration: 10 }),
    }));

    await deployCommand('staging', {});

    expect(output).toContain('Pre-deploy checks failed');
  });

  it('shows dry run message when dryRun option is set', async () => {
    await deployCommand('staging', { dryRun: true });

    expect(output).toContain('Dry run — no changes made');
  });
});

// ── deployStatusCommand tests ─────────────────────────────────────────────────

describe('deployStatusCommand', () => {
  it('displays environment table with environment names and statuses', async () => {
    await deployStatusCommand();

    expect(output).toContain('staging');
    expect(output).toContain('production');
    expect(output).toContain('develop');
    expect(output).toContain('main');
  });
});

// ── deployRollbackCommand tests ───────────────────────────────────────────────

describe('deployRollbackCommand', () => {
  it('triggers rollback with target commit', async () => {
    const { DeployService } = await import('../../src/services/deploy.service.js');

    await deployRollbackCommand('staging');

    const deployInstance = DeployService.mock.results[0].value;
    expect(deployInstance.rollback).toHaveBeenCalledWith('staging', 'def5678ghi');
  });

  it('shows rollback success message', async () => {
    await deployRollbackCommand('staging');

    expect(output).toContain('staging');
  });

  it('shows error when no deploy history exists', async () => {
    const { DeployService } = await import('../../src/services/deploy.service.js');
    DeployService.mockImplementationOnce(() => ({
      getDeployHistory: vi.fn().mockReturnValue([]),
      rollback: vi.fn(),
    }));

    await deployRollbackCommand('staging');

    expect(output).toContain('No deploy history');
  });
});

// ── deployLogCommand tests ────────────────────────────────────────────────────

describe('deployLogCommand', () => {
  it('displays deploy history', async () => {
    await deployLogCommand('staging');

    expect(output).toContain('PROJ-456');
    expect(output).toContain('PROJ-450');
    expect(output).toContain('abc1234');
    expect(output).toContain('dev@co.com');
  });

  it('shows "No deploy history" when history is empty', async () => {
    const { DeployService } = await import('../../src/services/deploy.service.js');
    DeployService.mockImplementationOnce(() => ({
      getDeployHistory: vi.fn().mockReturnValue([]),
    }));

    await deployLogCommand('staging');

    expect(output).toContain('No deploy history');
  });
});
