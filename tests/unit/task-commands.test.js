import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { taskGetCommand, taskListCommand } from '../../src/commands/task.js';

// ── Mock JiraService ──────────────────────────────────────────────────────────

const mockTask = {
  key: 'PROJ-123',
  summary: 'Implement login page',
  description: 'Users should be able to log in.\n\nAcceptance Criteria:\n- User can enter email and password\n- Invalid credentials show error',
  type: 'story',
  priority: 'high',
  status: 'In Progress',
  assignee: 'Alice Dev',
  sprint: 'Sprint 10',
  storyPoints: 5,
  parent: null,
  epic: null,
  figmaLinks: ['https://figma.com/file/abc123/LoginPage'],
  srsReferences: ['SRS-4.2'],
  subtasks: [
    { key: 'PROJ-124', summary: 'Build login form', status: 'Done' },
    { key: 'PROJ-125', summary: 'Validate credentials', status: 'To Do' },
  ],
  acceptanceCriteria: [
    'User can enter email and password',
    'Invalid credentials show error',
  ],
  linkedIssues: [
    { type: 'blocks', key: 'PROJ-200', summary: 'User profile page', status: 'To Do' },
  ],
  comments: [
    { author: 'Bob', body: 'LGTM!', created: '2024-01-01T00:00:00.000Z' },
  ],
  labels: [],
  components: [],
  fixVersions: [],
  customFields: {},
};

const mockTaskList = [
  { key: 'PROJ-1', summary: 'Build API endpoint', status: 'In Progress', priority: 'high', type: 'task', assignee: 'Alice' },
  { key: 'PROJ-2', summary: 'Write unit tests', status: 'To Do', priority: 'medium', type: 'task', assignee: 'Alice' },
  { key: 'PROJ-3', summary: 'Deploy to staging', status: 'Done', priority: 'low', type: 'task', assignee: 'Alice' },
];

vi.mock('../../src/services/jira.service.js', () => ({
  JiraService: vi.fn().mockImplementation(() => ({
    getIssue: vi.fn().mockResolvedValue(mockTask),
    listMyTasks: vi.fn().mockResolvedValue(mockTaskList),
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

// ── taskGetCommand tests ──────────────────────────────────────────────────────

describe('taskGetCommand', () => {
  it('displays task key and summary', async () => {
    await taskGetCommand('PROJ-123', {});
    expect(output).toContain('PROJ-123');
    expect(output).toContain('Implement login page');
  });

  it('--json outputs valid JSON without _raw field', async () => {
    const { JiraService } = await import('../../src/services/jira.service.js');
    const mockGetIssue = vi.fn().mockResolvedValue({ ...mockTask, _raw: { raw: 'data' } });
    JiraService.mockImplementationOnce(() => ({ getIssue: mockGetIssue }));

    await taskGetCommand('PROJ-123', { json: true });

    // Output should be parseable JSON
    const trimmed = output.trim();
    let parsed;
    expect(() => { parsed = JSON.parse(trimmed); }).not.toThrow();
    expect(parsed.key).toBe('PROJ-123');
    expect(parsed.summary).toBe('Implement login page');
    // _raw should be excluded
    expect(parsed._raw).toBeUndefined();
  });

  it('shows subtasks with ☑/☐ icons', async () => {
    await taskGetCommand('PROJ-123', {});
    expect(output).toContain('☑');
    expect(output).toContain('☐');
    expect(output).toContain('PROJ-124');
    expect(output).toContain('Build login form');
    expect(output).toContain('PROJ-125');
    expect(output).toContain('Validate credentials');
  });

  it('shows acceptance criteria numbered', async () => {
    await taskGetCommand('PROJ-123', {});
    expect(output).toContain('Acceptance Criteria');
    expect(output).toContain('1.');
    expect(output).toContain('2.');
    expect(output).toContain('User can enter email and password');
    expect(output).toContain('Invalid credentials show error');
  });

  it('shows figma links when present', async () => {
    await taskGetCommand('PROJ-123', {});
    expect(output).toContain('Figma');
    expect(output).toContain('https://figma.com/file/abc123/LoginPage');
  });

  it('shows comments when --withComments flag is set', async () => {
    await taskGetCommand('PROJ-123', { withComments: true });
    expect(output).toContain('Comments');
    expect(output).toContain('Bob');
    expect(output).toContain('LGTM!');
  });

  it('does not show comments when --withComments is not set', async () => {
    await taskGetCommand('PROJ-123', {});
    expect(output).not.toContain('LGTM!');
  });

  it('shows linked issues when present', async () => {
    await taskGetCommand('PROJ-123', {});
    expect(output).toContain('Linked Issues');
    expect(output).toContain('PROJ-200');
    expect(output).toContain('blocks');
  });

  it('shows parent info when present', async () => {
    const { JiraService } = await import('../../src/services/jira.service.js');
    const taskWithParent = {
      ...mockTask,
      parent: { key: 'PROJ-100', summary: 'Parent Epic' },
    };
    JiraService.mockImplementationOnce(() => ({
      getIssue: vi.fn().mockResolvedValue(taskWithParent),
    }));

    await taskGetCommand('PROJ-123', {});
    expect(output).toContain('Parent');
    expect(output).toContain('PROJ-100');
    expect(output).toContain('Parent Epic');
  });

  it('shows error and hint for 401 errors', async () => {
    const { JiraService } = await import('../../src/services/jira.service.js');
    JiraService.mockImplementationOnce(() => ({
      getIssue: vi.fn().mockRejectedValue(new Error('Jira API returned 401 Unauthorized')),
    }));

    await taskGetCommand('PROJ-123', {});
    expect(output).toContain('401 Unauthorized');
    expect(output).toContain('DEVFLOW_JIRA_TOKEN');
  });

  it('shows error and hint for 404 errors', async () => {
    const { JiraService } = await import('../../src/services/jira.service.js');
    JiraService.mockImplementationOnce(() => ({
      getIssue: vi.fn().mockRejectedValue(new Error('Jira API returned 404 Not Found')),
    }));

    await taskGetCommand('PROJ-999', {});
    expect(output).toContain('404 Not Found');
    expect(output).toContain('issue key');
  });
});

// ── taskListCommand tests ─────────────────────────────────────────────────────

describe('taskListCommand', () => {
  it('displays task list with key, status, and summary', async () => {
    await taskListCommand({});
    expect(output).toContain('PROJ-1');
    expect(output).toContain('Build API endpoint');
    expect(output).toContain('PROJ-2');
    expect(output).toContain('Write unit tests');
    expect(output).toContain('PROJ-3');
    expect(output).toContain('Deploy to staging');
  });

  it('shows "No tasks found" message when list is empty', async () => {
    const { JiraService } = await import('../../src/services/jira.service.js');
    JiraService.mockImplementationOnce(() => ({
      listMyTasks: vi.fn().mockResolvedValue([]),
    }));

    await taskListCommand({});
    expect(output).toContain('No tasks found');
  });

  it('passes filter options to listMyTasks', async () => {
    const { JiraService } = await import('../../src/services/jira.service.js');
    const mockListMyTasks = vi.fn().mockResolvedValue(mockTaskList);
    JiraService.mockImplementationOnce(() => ({ listMyTasks: mockListMyTasks }));

    await taskListCommand({ status: 'inprogress', sprint: 'Sprint 10', priority: 'high' });

    expect(mockListMyTasks).toHaveBeenCalledWith({
      status: 'inprogress',
      sprint: 'Sprint 10',
      priority: 'high',
    });
  });

  it('displays all tasks in the list', async () => {
    await taskListCommand({});
    const lines = output.split('\n').filter((l) => l.trim());
    // Should have at least 3 non-empty lines for the 3 tasks
    const taskLines = lines.filter(
      (l) => l.includes('PROJ-1') || l.includes('PROJ-2') || l.includes('PROJ-3')
    );
    expect(taskLines).toHaveLength(3);
  });
});
