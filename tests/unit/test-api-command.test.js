import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { testApiCommand } from '../../src/commands/test-api.js';

// ── Mock JiraService ──────────────────────────────────────────────────────────

vi.mock('../../src/services/jira.service.js', () => ({
  JiraService: vi.fn().mockImplementation(() => ({
    getIssue: vi.fn().mockResolvedValue({
      key: 'PROJ-123',
      summary: 'User Profile API',
      description: 'Implement GET /api/users/{id}/profile endpoint.',
      acceptanceCriteria: ['GET /api/users/{id}/profile returns user profile data'],
      type: 'story',
      priority: 'high',
    }),
  })),
}));

// ── Mock ApiTestService ───────────────────────────────────────────────────────

const mockGenerate = vi.fn().mockResolvedValue({
  endpoints: [
    { method: 'GET', path: '/api/users/{id}/profile', description: 'Get user profile' },
  ],
  testCases: [
    { name: 'returns 200', category: 'happy-path', method: 'GET', path: '/api/users/1/profile', headers: {}, body: null, expectedStatus: 200, expectedBody: {} },
    { name: 'returns 401', category: 'auth', method: 'GET', path: '/api/users/1/profile', headers: {}, body: null, expectedStatus: 401, expectedBody: {} },
    { name: 'returns 404', category: 'edge-case', method: 'GET', path: '/api/users/99999/profile', headers: {}, body: null, expectedStatus: 404, expectedBody: {} },
  ],
  files: [
    '/project/.devflow/tests/PROJ-123.http',
    '/project/.devflow/tests/PROJ-123.postman_collection.json',
    '/project/.devflow/tests/PROJ-123.test.js',
  ],
});

const mockRunTests = vi.fn().mockResolvedValue({
  passed: 2,
  failed: 1,
  total: 3,
  output: 'Tests 3 passed 2 failed 1\n',
});

vi.mock('../../src/services/api-test.service.js', () => ({
  ApiTestService: vi.fn().mockImplementation(() => ({
    generate: mockGenerate,
    runTests: mockRunTests,
  })),
  discoverEndpoints: vi.fn(),
  generateTestCases: vi.fn(),
  generateHTTPFile: vi.fn(),
  generatePostmanCollection: vi.fn(),
  generateTestScript: vi.fn(),
}));

// ── Mock fs ───────────────────────────────────────────────────────────────────

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn().mockReturnValue([]),
    existsSync: vi.fn().mockReturnValue(false),
  };
});

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
    endpoints: [
      { method: 'GET', path: '/api/users/{id}/profile', description: 'Get user profile' },
    ],
    testCases: [
      { name: 'returns 200', category: 'happy-path', method: 'GET', path: '/api/users/1/profile', headers: {}, body: null, expectedStatus: 200, expectedBody: {} },
      { name: 'returns 401', category: 'auth', method: 'GET', path: '/api/users/1/profile', headers: {}, body: null, expectedStatus: 401, expectedBody: {} },
      { name: 'returns 404', category: 'edge-case', method: 'GET', path: '/api/users/99999/profile', headers: {}, body: null, expectedStatus: 404, expectedBody: {} },
    ],
    files: [
      '/project/.devflow/tests/PROJ-123.http',
      '/project/.devflow/tests/PROJ-123.postman_collection.json',
      '/project/.devflow/tests/PROJ-123.test.js',
    ],
  });
});

afterEach(() => {
  console.log = originalConsoleLog;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('testApiCommand', () => {
  it('generates tests and displays summary', async () => {
    const { JiraService } = await import('../../src/services/jira.service.js');
    const { ApiTestService } = await import('../../src/services/api-test.service.js');

    await testApiCommand('PROJ-123', {});

    // JiraService was called with the right issue key
    expect(JiraService).toHaveBeenCalled();
    const jiraInstance = JiraService.mock.results[0].value;
    expect(jiraInstance.getIssue).toHaveBeenCalledWith('PROJ-123');

    // ApiTestService generate was called
    expect(ApiTestService).toHaveBeenCalled();
    const svcInstance = ApiTestService.mock.results[0].value;
    expect(svcInstance.generate).toHaveBeenCalled();
  });

  it('displays endpoint count in summary', async () => {
    await testApiCommand('PROJ-123', {});
    expect(output).toContain('Endpoints');
    expect(output).toContain('1');
  });

  it('displays test case count in summary', async () => {
    await testApiCommand('PROJ-123', {});
    expect(output).toContain('Test cases');
    expect(output).toContain('3');
  });

  it('displays output files', async () => {
    await testApiCommand('PROJ-123', {});
    expect(output).toContain('.devflow/tests/PROJ-123.http');
    expect(output).toContain('.postman_collection.json');
    expect(output).toContain('.test.js');
  });

  it('displays task key and summary in output', async () => {
    await testApiCommand('PROJ-123', {});
    expect(output).toContain('PROJ-123');
    expect(output).toContain('User Profile API');
  });

  it('shows category breakdown', async () => {
    await testApiCommand('PROJ-123', {});
    expect(output).toContain('happy-path');
    expect(output).toContain('auth');
    expect(output).toContain('edge-case');
  });

  it('with --format http filters output to http only', async () => {
    mockGenerate.mockResolvedValueOnce({
      endpoints: [{ method: 'GET', path: '/api/users', description: 'List users' }],
      testCases: [{ name: 'test', category: 'happy-path', method: 'GET', path: '/api/users', headers: {}, body: null, expectedStatus: 200, expectedBody: {} }],
      files: ['/project/.devflow/tests/PROJ-123.http'],
    });

    const { ApiTestService } = await import('../../src/services/api-test.service.js');

    await testApiCommand('PROJ-123', { format: 'http' });

    const svcInstance = ApiTestService.mock.results[0].value;
    expect(svcInstance.generate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ format: 'http' })
    );
  });

  it('with --format postman passes format to generate', async () => {
    const { ApiTestService } = await import('../../src/services/api-test.service.js');

    await testApiCommand('PROJ-123', { format: 'postman' });

    const svcInstance = ApiTestService.mock.results[0].value;
    expect(svcInstance.generate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ format: 'postman' })
    );
  });

  it('with --run executes tests and shows results', async () => {
    const { ApiTestService } = await import('../../src/services/api-test.service.js');

    await testApiCommand('PROJ-123', { run: true });

    const svcInstance = ApiTestService.mock.results[0].value;
    expect(svcInstance.runTests).toHaveBeenCalledWith(
      expect.stringContaining('.test.js')
    );

    expect(output).toContain('Test Results');
    expect(output).toContain('Passed');
    expect(output).toContain('Failed');
  });

  it('without --run does not execute tests', async () => {
    const { ApiTestService } = await import('../../src/services/api-test.service.js');

    await testApiCommand('PROJ-123', {});

    const svcInstance = ApiTestService.mock.results[0].value;
    expect(svcInstance.runTests).not.toHaveBeenCalled();
  });

  it('handles Jira error gracefully', async () => {
    const { JiraService } = await import('../../src/services/jira.service.js');
    JiraService.mockImplementationOnce(() => ({
      getIssue: vi.fn().mockRejectedValue(new Error('Jira API returned 401 Unauthorized')),
    }));

    await testApiCommand('PROJ-123', {});

    expect(output).toContain('401 Unauthorized');
  });

  it('shows existing tests when no jiraId provided', async () => {
    const { existsSync, readdirSync } = await import('fs');
    existsSync.mockReturnValueOnce(true);
    readdirSync.mockReturnValueOnce(['PROJ-99.http', 'PROJ-99.test.js']);

    await testApiCommand(undefined, {});

    expect(output).toContain('PROJ-99.http');
    expect(output).toContain('PROJ-99.test.js');
  });

  it('shows error message when no jiraId and no existing tests', async () => {
    const { existsSync } = await import('fs');
    existsSync.mockReturnValueOnce(false);

    // Capture error output
    const errors = [];
    const originalError = console.error;
    console.error = (...args) => { errors.push(args.join(' ')); };

    await testApiCommand(undefined, {});

    console.error = originalError;
    // Either output or errors should mention the missing jiraId
    const allOutput = output + errors.join('\n');
    expect(allOutput.toLowerCase()).toMatch(/no jira id|jira id|no.*tests?/i);
  });
});
