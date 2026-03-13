import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeployService } from '../../src/services/deploy.service.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock config
vi.mock('../../src/utils/config.js', () => ({
  loadConfig: () => ({
    deploy: {
      staging: {
        type: 'ssh',
        host: 'staging.example.com',
        username: 'deploy',
        path: '/var/www/staging',
        branch: 'develop',
        commands: ['cd {path} && git pull', 'cd {path} && composer install'],
        health_check_url: 'https://staging.example.com/health',
      },
      production: {
        type: 'ssh',
        host: 'prod.example.com',
        username: 'deploy',
        path: '/var/www/production',
        branch: 'main',
        commands: ['cd {path} && git pull'],
        safeguards: {
          cooldown_minutes: 30,
        },
      },
    },
  }),
}));

// Mock child_process
const mockExecSync = vi.fn();
vi.mock('child_process', () => ({
  execSync: (...args) => mockExecSync(...args),
}));

// Mock fs
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();

vi.mock('fs', () => ({
  existsSync: (...args) => mockExistsSync(...args),
  readFileSync: (...args) => mockReadFileSync(...args),
  writeFileSync: (...args) => mockWriteFileSync(...args),
  mkdirSync: (...args) => mockMkdirSync(...args),
}));

// Mock node-ssh
const mockExecCommand = vi.fn();
const mockConnect = vi.fn();
const mockDispose = vi.fn();

vi.mock('node-ssh', () => ({
  NodeSSH: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    execCommand: mockExecCommand,
    dispose: mockDispose,
  })),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ── helpers ───────────────────────────────────────────────────────────────────

function makeService(configOverride) {
  return new DeployService(configOverride || null);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DeployService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
    mockDispose.mockReturnValue(undefined);
  });

  // 1. preDeployChecks returns array of check results
  describe('preDeployChecks', () => {
    it('returns array of check results with name, passed, message', async () => {
      mockExecSync
        .mockReturnValueOnce('') // git status --porcelain (clean)
        .mockReturnValueOnce('develop\n') // git branch --show-current
        .mockReturnValueOnce(undefined) // git fetch origin
        .mockReturnValueOnce('abc123\n') // git rev-parse HEAD
        .mockReturnValueOnce('develop\n') // git branch --show-current (2nd time)
        .mockReturnValueOnce('abc123\n'); // git rev-parse origin/develop

      const service = makeService();
      const results = await service.preDeployChecks('staging');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((r) => {
        expect(r).toHaveProperty('name');
        expect(r).toHaveProperty('passed');
        expect(r).toHaveProperty('message');
      });
    });

    it('marks git_clean as passed when no uncommitted changes', async () => {
      mockExecSync
        .mockReturnValueOnce('') // git status --porcelain
        .mockReturnValueOnce('develop\n')
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce('abc\n')
        .mockReturnValueOnce('develop\n')
        .mockReturnValueOnce('abc\n');

      const service = makeService();
      const results = await service.preDeployChecks('staging');
      const gitClean = results.find((r) => r.name === 'git_clean');

      expect(gitClean.passed).toBe(true);
    });

    it('marks git_clean as failed when there are uncommitted changes', async () => {
      mockExecSync
        .mockReturnValueOnce(' M src/file.js\n') // git status --porcelain (dirty)
        .mockReturnValueOnce('develop\n')
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce('abc\n')
        .mockReturnValueOnce('develop\n')
        .mockReturnValueOnce('abc\n');

      const service = makeService();
      const results = await service.preDeployChecks('staging');
      const gitClean = results.find((r) => r.name === 'git_clean');

      expect(gitClean.passed).toBe(false);
    });

    it('does not throw if a check errors — returns failed check instead', async () => {
      // All execSync calls throw
      mockExecSync.mockImplementation(() => {
        throw new Error('git not found');
      });

      const service = makeService();
      const results = await service.preDeployChecks('staging');

      expect(Array.isArray(results)).toBe(true);
      results.forEach((r) => {
        expect(r.passed).toBe(false);
      });
    });
  });

  // 2. deploy throws when no config for environment
  describe('deploy — no config', () => {
    it('throws when environment has no deploy config', async () => {
      const service = makeService();
      await expect(service.deploy('nonexistent')).rejects.toThrow(
        'No deploy configuration for "nonexistent"'
      );
    });
  });

  // 3. deploy with dryRun logs but doesn't execute
  describe('deploy — dryRun', () => {
    it('returns success without running any commands', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const service = makeService();
      const result = await service.deploy('staging', { dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.success).toBe(true);
      expect(mockConnect).not.toHaveBeenCalled();
      expect(mockExecSync).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // 4. deploySSH connects and runs commands
  describe('deploySSH', () => {
    it('connects with host/username/privateKey and runs commands', async () => {
      mockExecCommand.mockResolvedValue({ stdout: 'ok', stderr: '', code: 0 });

      // prevent saveDeployRecord from running via existsSync
      mockExistsSync.mockReturnValue(false);
      mockWriteFileSync.mockReturnValue(undefined);

      const config = {
        host: 'staging.example.com',
        username: 'deploy',
        path: '/var/www/staging',
        commands: ['cd {path} && git pull', 'cd {path} && composer install'],
      };

      const service = makeService();
      const results = await service.deploySSH(config);

      expect(mockConnect).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'staging.example.com', username: 'deploy' })
      );
      expect(mockExecCommand).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
      results.forEach((r) => {
        expect(r.code).toBe(0);
      });
    });

    it('replaces {path} placeholder in commands', async () => {
      mockExecCommand.mockResolvedValue({ stdout: '', stderr: '', code: 0 });
      mockExistsSync.mockReturnValue(false);
      mockWriteFileSync.mockReturnValue(undefined);

      const config = {
        host: 'host',
        username: 'user',
        path: '/app',
        commands: ['ls {path}'],
      };

      const service = makeService();
      await service.deploySSH(config);

      expect(mockExecCommand).toHaveBeenCalledWith('ls /app', expect.any(Object));
    });
  });

  // 5. deploySSH throws on command failure
  describe('deploySSH — command failure', () => {
    it('throws when a command returns non-zero exit code', async () => {
      mockExecCommand
        .mockResolvedValueOnce({ stdout: 'ok', stderr: '', code: 0 })
        .mockResolvedValueOnce({ stdout: '', stderr: 'permission denied', code: 1 });

      const config = {
        host: 'host',
        username: 'user',
        path: '/app',
        commands: ['cmd1', 'cmd2'],
      };

      const service = makeService();
      await expect(service.deploySSH(config)).rejects.toThrow('Command failed');
      expect(mockDispose).toHaveBeenCalled();
    });
  });

  // 6. deployDocker runs docker commands
  describe('deployDocker', () => {
    it('runs docker commands with placeholder substitution', async () => {
      mockExecSync.mockReturnValue('docker output');

      const config = {
        compose_file: 'docker-compose.staging.yml',
        service: 'app',
        commands: [
          'docker compose -f {compose_file} pull {service}',
          'docker compose -f {compose_file} up -d {service}',
        ],
      };

      const service = makeService();
      const results = await service.deployDocker(config);

      expect(mockExecSync).toHaveBeenCalledTimes(2);
      expect(mockExecSync).toHaveBeenCalledWith(
        'docker compose -f docker-compose.staging.yml pull app',
        expect.any(Object)
      );
      expect(results).toHaveLength(2);
      results.forEach((r) => expect(r.code).toBe(0));
    });
  });

  // 7. healthCheck returns true on 200
  describe('healthCheck', () => {
    it('returns true when response is ok', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const service = makeService();
      const result = await service.healthCheck({
        health_check_url: 'https://staging.example.com/health',
      });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // 8. healthCheck returns false after retries
    it('returns false after all retries fail', async () => {
      mockFetch.mockRejectedValue(new Error('connection refused'));

      const service = makeService();
      // Override setTimeout to speed up test
      vi.useFakeTimers();

      const healthCheckPromise = service.healthCheck({
        health_check_url: 'https://unreachable.example.com/health',
      });

      // Fast-forward all timers
      await vi.runAllTimersAsync();
      const result = await healthCheckPromise;

      expect(result).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });
  });

  // 9. getDeployHistory reads and filters by environment
  describe('getDeployHistory', () => {
    it('returns empty array when history file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const service = makeService();
      const history = service.getDeployHistory('staging');

      expect(history).toEqual([]);
    });

    it('filters history by environment and sorts by timestamp desc', () => {
      const fakeHistory = [
        { id: 1, environment: 'staging', timestamp: '2024-01-01T10:00:00Z', status: 'success' },
        { id: 2, environment: 'production', timestamp: '2024-01-02T10:00:00Z', status: 'success' },
        { id: 3, environment: 'staging', timestamp: '2024-01-03T10:00:00Z', status: 'failed' },
      ];

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(fakeHistory));

      const service = makeService();
      const history = service.getDeployHistory('staging');

      expect(history).toHaveLength(2);
      expect(history[0].id).toBe(3); // most recent first
      expect(history[1].id).toBe(1);
      history.forEach((r) => expect(r.environment).toBe('staging'));
    });
  });

  // 10. saveDeployRecord creates and appends records
  describe('saveDeployRecord', () => {
    it('creates history file with first record when none exists', async () => {
      mockExistsSync.mockReturnValue(false);
      mockWriteFileSync.mockReturnValue(undefined);

      const service = makeService();
      const record = await service.saveDeployRecord({
        environment: 'staging',
        timestamp: '2024-01-01T10:00:00Z',
        status: 'success',
      });

      expect(record.id).toBe(1);
      expect(mockMkdirSync).toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalled();

      const writtenData = JSON.parse(mockWriteFileSync.mock.calls[0][1]);
      expect(writtenData).toHaveLength(1);
      expect(writtenData[0].id).toBe(1);
    });

    it('appends to existing history and assigns next ID', async () => {
      const existing = [
        { id: 1, environment: 'staging', status: 'success' },
        { id: 2, environment: 'production', status: 'success' },
      ];

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(existing));
      mockWriteFileSync.mockReturnValue(undefined);

      const service = makeService();
      const record = await service.saveDeployRecord({
        environment: 'staging',
        status: 'failed',
      });

      expect(record.id).toBe(3);

      const writtenData = JSON.parse(mockWriteFileSync.mock.calls[0][1]);
      expect(writtenData).toHaveLength(3);
    });
  });

  // 11. getEnvironmentStatus returns latest for each env
  describe('getEnvironmentStatus', () => {
    it('returns status for each configured environment', async () => {
      const fakeHistory = [
        {
          id: 1,
          environment: 'staging',
          timestamp: '2024-01-01T10:00:00Z',
          status: 'success',
        },
      ];

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(fakeHistory));

      const service = makeService();
      const statuses = await service.getEnvironmentStatus();

      expect(Array.isArray(statuses)).toBe(true);
      expect(statuses.length).toBe(2); // staging + production from mock config

      const stagingStatus = statuses.find((s) => s.environment === 'staging');
      expect(stagingStatus).toBeDefined();
      expect(stagingStatus.branch).toBe('develop');
      expect(stagingStatus.lastDeploy).toBe('2024-01-01T10:00:00Z');
      expect(stagingStatus.status).toBe('success');
    });

    it('returns never_deployed when no history exists', async () => {
      mockExistsSync.mockReturnValue(false);

      const service = makeService();
      const statuses = await service.getEnvironmentStatus();

      statuses.forEach((s) => {
        expect(s.status).toBe('never_deployed');
        expect(s.lastDeploy).toBeNull();
      });
    });
  });

  // 12. rollback saves rollback record
  describe('rollback', () => {
    it('saves rollback record with rolled_back status', async () => {
      mockConnect.mockResolvedValue(undefined);
      mockExecCommand.mockResolvedValue({ stdout: '', stderr: '', code: 0 });
      mockExistsSync.mockReturnValue(false);
      mockWriteFileSync.mockReturnValue(undefined);

      const service = makeService();
      const result = await service.rollback('staging', 'abc1234');

      expect(result.success).toBe(true);
      expect(mockWriteFileSync).toHaveBeenCalled();

      const writtenData = JSON.parse(mockWriteFileSync.mock.calls[0][1]);
      const rollbackRecord = writtenData[0];
      expect(rollbackRecord.status).toBe('rolled_back');
      expect(rollbackRecord.rollbackTarget).toBe('abc1234');
      expect(rollbackRecord.environment).toBe('staging');
    });

    it('throws when environment has no deploy config', async () => {
      const service = makeService();
      await expect(service.rollback('nonexistent')).rejects.toThrow(
        'No deploy configuration for "nonexistent"'
      );
    });
  });
});
