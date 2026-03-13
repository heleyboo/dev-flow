import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { testE2eCommand } from '../../src/commands/test-e2e.js';

// ── Mock JiraService ──────────────────────────────────────────────────────────

vi.mock('../../src/services/jira.service.js', () => ({
  JiraService: vi.fn().mockImplementation(() => ({
    getIssue: vi.fn().mockResolvedValue({
      key: 'PROJ-123',
      summary: 'User Profile Page',
      description: 'Implement the user profile page.',
      acceptanceCriteria: ['User can view their profile', 'User can edit their profile'],
      type: 'story',
      priority: 'high',
      figmaLinks: [],
    }),
  })),
}));

// ── Mock FigmaService ─────────────────────────────────────────────────────────

vi.mock('../../src/services/figma.service.js', () => ({
  FigmaService: vi.fn().mockImplementation(() => ({
    extractSpecs: vi.fn().mockResolvedValue({
      fileKey: 'abc123',
      name: 'Profile Design',
      componentTree: null,
    }),
  })),
}));

// ── Mock E2eTestService ───────────────────────────────────────────────────────

const mockGenerate = vi.fn().mockResolvedValue({
  scenarios: [
    { name: 'User can view their profile', steps: [], expectedResult: 'profile displayed', selectors: [] },
    { name: 'User can edit their profile', steps: [], expectedResult: 'profile updated', selectors: [] },
    { name: 'Unauthenticated user is redirected to login', steps: [], expectedResult: 'redirect', selectors: [], isAuthCheck: true },
  ],
  files: [
    '/project/tests/e2e/PROJ-123.spec.ts',
    '/project/tests/e2e/PROJ-123.testids.md',
  ],
});

const mockRunTests = vi.fn().mockResolvedValue({
  output: 'Running tests...\n2 passed\n',
  exitCode: 0,
});

vi.mock('../../src/services/e2e-test.service.js', () => ({
  E2eTestService: vi.fn().mockImplementation(() => ({
    generate: mockGenerate,
    runTests: mockRunTests,
  })),
  parseAcceptanceCriteria: vi.fn(),
  mapFigmaToSelectors: vi.fn(),
  generateScenarios: vi.fn(),
}));

// ── Console capture ───────────────────────────────────────────────────────────

let output = '';
const originalConsoleLog = console.log;

beforeEach(() => {
  output = '';
  console.log = (...args) => {
    output += args.join(' ') + '\n';
  };
  vi.clearAllMocks();
  mockGenerate.mockResolvedValue({
    scenarios: [
      { name: 'User can view their profile', steps: [], expectedResult: 'profile displayed', selectors: [] },
      { name: 'User can edit their profile', steps: [], expectedResult: 'profile updated', selectors: [] },
      { name: 'Unauthenticated user is redirected to login', steps: [], expectedResult: 'redirect', selectors: [], isAuthCheck: true },
    ],
    files: [
      '/project/tests/e2e/PROJ-123.spec.ts',
      '/project/tests/e2e/PROJ-123.testids.md',
    ],
  });
  mockRunTests.mockResolvedValue({
    output: 'Running tests...\n2 passed\n',
    exitCode: 0,
  });
});

afterEach(() => {
  console.log = originalConsoleLog;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('testE2eCommand', () => {
  it('generates tests and displays summary with scenario count', async () => {
    const { JiraService } = await import('../../src/services/jira.service.js');
    const { E2eTestService } = await import('../../src/services/e2e-test.service.js');

    await testE2eCommand('PROJ-123', {});

    // JiraService was called with the right issue key
    expect(JiraService).toHaveBeenCalled();
    const jiraInstance = JiraService.mock.results[0].value;
    expect(jiraInstance.getIssue).toHaveBeenCalledWith('PROJ-123');

    // E2eTestService generate was called
    expect(E2eTestService).toHaveBeenCalled();
    const svcInstance = E2eTestService.mock.results[0].value;
    expect(svcInstance.generate).toHaveBeenCalled();

    // Output contains scenario count
    expect(output).toContain('Scenarios');
    expect(output).toContain('3');
  });

  it('displays output files in summary', async () => {
    await testE2eCommand('PROJ-123', {});
    expect(output).toContain('.spec.ts');
    expect(output).toContain('.testids.md');
  });

  it('displays task key and summary', async () => {
    await testE2eCommand('PROJ-123', {});
    expect(output).toContain('PROJ-123');
    expect(output).toContain('User Profile Page');
  });

  it('with --run executes tests and shows results', async () => {
    const { E2eTestService } = await import('../../src/services/e2e-test.service.js');

    await testE2eCommand('PROJ-123', { run: true });

    const svcInstance = E2eTestService.mock.results[0].value;
    expect(svcInstance.runTests).toHaveBeenCalledWith(
      expect.objectContaining({ file: expect.stringContaining('.spec.ts') })
    );

    expect(output).toContain('Test Results');
    expect(output).toContain('Exit code');
  });

  it('without --run does not execute tests', async () => {
    const { E2eTestService } = await import('../../src/services/e2e-test.service.js');

    await testE2eCommand('PROJ-123', {});

    const svcInstance = E2eTestService.mock.results[0].value;
    expect(svcInstance.runTests).not.toHaveBeenCalled();
  });

  it('handles task without figma links gracefully', async () => {
    const { JiraService } = await import('../../src/services/jira.service.js');
    JiraService.mockImplementationOnce(() => ({
      getIssue: vi.fn().mockResolvedValue({
        key: 'PROJ-200',
        summary: 'No Figma Task',
        acceptanceCriteria: [],
        figmaLinks: [],
      }),
    }));

    const { E2eTestService } = await import('../../src/services/e2e-test.service.js');
    await testE2eCommand('PROJ-200', {});

    const svcInstance = E2eTestService.mock.results[0].value;
    expect(svcInstance.generate).toHaveBeenCalled();

    // Should still show summary
    expect(output).toContain('Scenarios');
  });

  it('handles Figma fetch error gracefully (no crash)', async () => {
    const { JiraService } = await import('../../src/services/jira.service.js');
    JiraService.mockImplementationOnce(() => ({
      getIssue: vi.fn().mockResolvedValue({
        key: 'PROJ-300',
        summary: 'Figma Error Task',
        acceptanceCriteria: ['User can view page'],
        figmaLinks: ['https://figma.com/file/abc123'],
      }),
    }));

    const { FigmaService } = await import('../../src/services/figma.service.js');
    FigmaService.mockImplementationOnce(() => ({
      extractSpecs: vi.fn().mockRejectedValue(new Error('Figma API Error')),
    }));

    // Should not throw
    await expect(testE2eCommand('PROJ-300', {})).resolves.not.toThrow();
    // E2e generation should still happen
    expect(output).toContain('Scenarios');
  });

  it('handles missing jiraId gracefully', async () => {
    const errors = [];
    const originalError = console.error;
    console.error = (...args) => { errors.push(args.join(' ')); };

    await testE2eCommand(undefined, {});

    console.error = originalError;

    // No crash, some kind of error output
    const allOutput = output + errors.join('\n');
    expect(allOutput.toLowerCase()).toMatch(/no jira id|jira id/i);
  });

  it('handles Jira error gracefully', async () => {
    const { JiraService } = await import('../../src/services/jira.service.js');
    JiraService.mockImplementationOnce(() => ({
      getIssue: vi.fn().mockRejectedValue(new Error('Jira API returned 401 Unauthorized')),
    }));

    await testE2eCommand('PROJ-999', {});

    expect(output).toContain('401 Unauthorized');
  });
});
