import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JiraService } from '../../src/services/jira.service.js';

// ── Mock config ──────────────────────────────────────────────────────────────
vi.mock('../../src/utils/config.js', () => ({
  loadConfig: () => ({
    jira: {
      host: 'https://test.atlassian.net',
      email: 'dev@test.com',
      project_key: 'PROJ',
    },
  }),
  resetConfig: vi.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal valid Jira issue response */
function makeIssueResponse(overrides = {}) {
  return {
    key: 'PROJ-123',
    fields: {
      summary: 'Test issue summary',
      description: null,
      issuetype: { name: 'Story' },
      priority: { name: 'High' },
      status: { name: 'In Progress' },
      assignee: { displayName: 'Alice', emailAddress: 'alice@test.com' },
      reporter: { displayName: 'Bob', emailAddress: 'bob@test.com' },
      labels: ['backend'],
      components: [{ name: 'API' }],
      fixVersions: [{ name: '1.0.0' }],
      subtasks: [],
      issuelinks: [],
      comment: { comments: [] },
      ...overrides,
    },
  };
}

/** Create a fetch mock that returns the given JSON with the given status */
function mockFetch(json, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => json,
    text: async () => JSON.stringify(json),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('JiraService', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env.DEVFLOW_JIRA_TOKEN;
    process.env.DEVFLOW_JIRA_TOKEN = 'test-api-token';
    global.fetch = undefined; // reset before each test
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.DEVFLOW_JIRA_TOKEN;
    } else {
      process.env.DEVFLOW_JIRA_TOKEN = originalEnv;
    }
    vi.restoreAllMocks();
  });

  // ── 1. Constructor builds auth header ─────────────────────────────────────
  describe('constructor', () => {
    it('builds the Basic auth header from email and token', () => {
      process.env.DEVFLOW_JIRA_TOKEN = 'my-secret-token';
      const svc = new JiraService();
      const expected = `Basic ${Buffer.from('dev@test.com:my-secret-token').toString('base64')}`;
      expect(svc.authHeader).toBe(expected);
    });

    it('reads host, email, and project_key from config', () => {
      const svc = new JiraService();
      expect(svc.host).toBe('https://test.atlassian.net');
      expect(svc.email).toBe('dev@test.com');
      expect(svc.projectKey).toBe('PROJ');
    });

    it('accepts an explicit config object', () => {
      const cfg = {
        jira: {
          host: 'https://custom.atlassian.net',
          email: 'custom@test.com',
          project_key: 'CUSTOM',
          story_points_field: 'customfield_99999',
          custom_fields: { design: 'customfield_12345' },
        },
      };
      const svc = new JiraService(cfg);
      expect(svc.host).toBe('https://custom.atlassian.net');
      expect(svc.storyPointsField).toBe('customfield_99999');
      expect(svc.customFieldsConfig).toEqual({ design: 'customfield_12345' });
    });

    it('defaults story_points_field to customfield_10016', () => {
      const svc = new JiraService();
      expect(svc.storyPointsField).toBe('customfield_10016');
    });
  });

  // ── 2. getIssue fetches and returns a ParsedTask ───────────────────────────
  describe('getIssue', () => {
    it('fetches the issue and returns a ParsedTask', async () => {
      const raw = makeIssueResponse();
      global.fetch = mockFetch(raw);

      const svc = new JiraService();
      const task = await svc.getIssue('PROJ-123');

      expect(task.key).toBe('PROJ-123');
      expect(task.summary).toBe('Test issue summary');
      expect(task.type).toBe('story');
      expect(task.priority).toBe('high');
      expect(task.status).toBe('In Progress');
      expect(task.assignee).toBe('Alice');
      expect(task.reporter).toBe('Bob');
      expect(task.labels).toEqual(['backend']);
      expect(task.components).toEqual(['API']);
      expect(task.fixVersions).toEqual(['1.0.0']);
      expect(task._raw).toBe(raw);
    });

    it('calls the correct URL', async () => {
      global.fetch = mockFetch(makeIssueResponse());
      const svc = new JiraService();
      await svc.getIssue('PROJ-456');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.atlassian.net/rest/api/3/issue/PROJ-456',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: svc.authHeader }),
        })
      );
    });

    it('parses ADF description to markdown', async () => {
      const adfDescription = {
        version: 1,
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello from ADF' }],
          },
        ],
      };
      global.fetch = mockFetch(makeIssueResponse({ description: adfDescription }));
      const svc = new JiraService();
      const task = await svc.getIssue('PROJ-123');
      expect(task.description).toContain('Hello from ADF');
    });

    it('extracts figma links from description', async () => {
      const adfDescription = {
        version: 1,
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Design: https://figma.com/file/abc123/MyDesign' },
            ],
          },
        ],
      };
      global.fetch = mockFetch(makeIssueResponse({ description: adfDescription }));
      const svc = new JiraService();
      const task = await svc.getIssue('PROJ-123');
      expect(task.figmaLinks).toContain('https://figma.com/file/abc123/MyDesign');
    });

    // ── 3. getIssue throws on 401 ─────────────────────────────────────────────
    it('throws an error mentioning "401 Unauthorized" on a 401 response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: { get: () => 'application/json' },
        json: async () => ({ message: 'Unauthorized' }),
        text: async () => 'Unauthorized',
      });

      const svc = new JiraService();
      await expect(svc.getIssue('PROJ-123')).rejects.toThrow('401 Unauthorized');
    });

    it('includes hint about DEVFLOW_JIRA_TOKEN in 401 error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: { get: () => 'application/json' },
        json: async () => ({}),
        text: async () => '',
      });

      const svc = new JiraService();
      await expect(svc.getIssue('PROJ-123')).rejects.toThrow('DEVFLOW_JIRA_TOKEN');
    });

    // ── 4. getIssue throws on 404 ─────────────────────────────────────────────
    it('throws an error mentioning "404 Not Found" on a 404 response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: { get: () => 'application/json' },
        json: async () => ({}),
        text: async () => 'Not found',
      });

      const svc = new JiraService();
      await expect(svc.getIssue('PROJ-999')).rejects.toThrow('404 Not Found');
    });
  });

  // ── 5. listMyTasks sends correct JQL ──────────────────────────────────────
  describe('listMyTasks', () => {
    it('includes assignee = currentUser() in JQL', async () => {
      global.fetch = mockFetch({ issues: [] });
      const svc = new JiraService();
      await svc.listMyTasks();

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.jql).toContain('assignee = currentUser()');
    });

    it('includes project key in JQL', async () => {
      global.fetch = mockFetch({ issues: [] });
      const svc = new JiraService();
      await svc.listMyTasks();

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.jql).toContain('"PROJ"');
    });

    it('adds no extra conditions when no filters are passed', async () => {
      global.fetch = mockFetch({ issues: [] });
      const svc = new JiraService();
      await svc.listMyTasks();

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.jql).not.toContain('status');
      expect(body.jql).not.toContain('sprint');
      expect(body.jql).not.toContain('priority');
    });

    // ── 6. listMyTasks applies status filter ────────────────────────────────
    it('maps "inprogress" to "In Progress" in JQL', async () => {
      global.fetch = mockFetch({ issues: [] });
      const svc = new JiraService();
      await svc.listMyTasks({ status: 'inprogress' });

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.jql).toContain('status = "In Progress"');
    });

    it('maps "todo" to "To Do" in JQL', async () => {
      global.fetch = mockFetch({ issues: [] });
      const svc = new JiraService();
      await svc.listMyTasks({ status: 'todo' });

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.jql).toContain('status = "To Do"');
    });

    it('maps "review" to "In Review" in JQL', async () => {
      global.fetch = mockFetch({ issues: [] });
      const svc = new JiraService();
      await svc.listMyTasks({ status: 'review' });

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.jql).toContain('status = "In Review"');
    });

    it('maps "done" to "Done" in JQL', async () => {
      global.fetch = mockFetch({ issues: [] });
      const svc = new JiraService();
      await svc.listMyTasks({ status: 'done' });

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.jql).toContain('status = "Done"');
    });

    it('adds sprint filter when provided', async () => {
      global.fetch = mockFetch({ issues: [] });
      const svc = new JiraService();
      await svc.listMyTasks({ sprint: 'Sprint 23' });

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.jql).toContain('sprint = "Sprint 23"');
    });

    it('adds priority filter when provided', async () => {
      global.fetch = mockFetch({ issues: [] });
      const svc = new JiraService();
      await svc.listMyTasks({ priority: 'high' });

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.jql).toContain('priority = "High"');
    });

    it('returns mapped issue objects', async () => {
      const issues = [
        {
          key: 'PROJ-1',
          fields: {
            summary: 'Do something',
            status: { name: 'To Do' },
            priority: { name: 'Medium' },
            issuetype: { name: 'Task' },
            assignee: { displayName: 'Dev User' },
          },
        },
      ];
      global.fetch = mockFetch({ issues });
      const svc = new JiraService();
      const result = await svc.listMyTasks();

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('PROJ-1');
      expect(result[0].summary).toBe('Do something');
      expect(result[0].status).toBe('To Do');
      expect(result[0].type).toBe('task');
    });
  });

  // ── 7. transitionIssue finds and applies transition ───────────────────────
  describe('transitionIssue', () => {
    it('fetches transitions and posts the correct transition id', async () => {
      const transitionsData = {
        transitions: [
          { id: '11', name: 'To Do' },
          { id: '21', name: 'In Progress' },
          { id: '31', name: 'Done' },
        ],
      };

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async (url, opts) => {
        callCount++;
        if (callCount === 1) {
          // GET transitions
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => transitionsData,
          };
        }
        // POST transition (returns 204)
        return {
          ok: true,
          status: 204,
          headers: { get: () => null },
          json: async () => null,
          text: async () => '',
        };
      });

      const svc = new JiraService();
      const result = await svc.transitionIssue('PROJ-123', 'In Progress');

      expect(result.success).toBe(true);
      expect(result.transitionId).toBe('21');
      expect(result.transitionName).toBe('In Progress');

      // Verify POST body
      const postCall = global.fetch.mock.calls[1];
      const body = JSON.parse(postCall[1].body);
      expect(body.transition.id).toBe('21');
    });

    it('is case-insensitive when matching transition name', async () => {
      const transitionsData = {
        transitions: [{ id: '21', name: 'In Progress' }],
      };

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => transitionsData,
          };
        }
        return {
          ok: true,
          status: 204,
          headers: { get: () => null },
          json: async () => null,
          text: async () => '',
        };
      });

      const svc = new JiraService();
      const result = await svc.transitionIssue('PROJ-123', 'in progress');
      expect(result.success).toBe(true);
    });

    // ── 8. transitionIssue throws when name not found ──────────────────────
    it('throws when transition name is not found', async () => {
      const transitionsData = {
        transitions: [
          { id: '11', name: 'To Do' },
          { id: '21', name: 'In Progress' },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => transitionsData,
      });

      const svc = new JiraService();
      await expect(svc.transitionIssue('PROJ-123', 'Nonexistent Status')).rejects.toThrow(
        'Nonexistent Status'
      );
    });

    it('lists available transitions in the error message', async () => {
      const transitionsData = {
        transitions: [
          { id: '11', name: 'To Do' },
          { id: '21', name: 'In Progress' },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => transitionsData,
      });

      const svc = new JiraService();
      await expect(svc.transitionIssue('PROJ-123', 'Done')).rejects.toThrow('To Do');
    });
  });

  // ── 9. addComment posts in ADF format ─────────────────────────────────────
  describe('addComment', () => {
    it('posts a comment in ADF doc format', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 'comment-1' }),
      });

      const svc = new JiraService();
      await svc.addComment('PROJ-123', 'This is a test comment');

      const call = global.fetch.mock.calls[0];
      expect(call[0]).toContain('/rest/api/3/issue/PROJ-123/comment');
      expect(call[1].method).toBe('POST');

      const body = JSON.parse(call[1].body);
      expect(body.body.type).toBe('doc');
      expect(body.body.version).toBe(1);
    });

    it('wraps text in doc > paragraph > text ADF nodes', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 'comment-2' }),
      });

      const svc = new JiraService();
      await svc.addComment('PROJ-456', 'Hello world');

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      const paragraph = body.body.content[0];
      expect(paragraph.type).toBe('paragraph');

      const textNode = paragraph.content[0];
      expect(textNode.type).toBe('text');
      expect(textNode.text).toBe('Hello world');
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────
  describe('parseIssue edge cases', () => {
    it('handles null assignee gracefully', async () => {
      global.fetch = mockFetch(makeIssueResponse({ assignee: null }));
      const svc = new JiraService();
      const task = await svc.getIssue('PROJ-123');
      expect(task.assignee).toBeNull();
    });

    it('handles missing description (null) gracefully', async () => {
      global.fetch = mockFetch(makeIssueResponse({ description: null }));
      const svc = new JiraService();
      const task = await svc.getIssue('PROJ-123');
      expect(task.description).toBe('');
      expect(task.figmaLinks).toEqual([]);
      expect(task.srsReferences).toEqual([]);
      expect(task.acceptanceCriteria).toEqual([]);
    });

    it('parses subtasks correctly', async () => {
      const subtasks = [
        { key: 'PROJ-124', fields: { summary: 'Subtask A', status: { name: 'Done' } } },
        { key: 'PROJ-125', fields: { summary: 'Subtask B', status: { name: 'To Do' } } },
      ];
      global.fetch = mockFetch(makeIssueResponse({ subtasks }));
      const svc = new JiraService();
      const task = await svc.getIssue('PROJ-123');
      expect(task.subtasks).toHaveLength(2);
      expect(task.subtasks[0]).toEqual({ key: 'PROJ-124', summary: 'Subtask A', status: 'Done' });
    });

    it('parses linked issues correctly', async () => {
      const issuelinks = [
        {
          type: { name: 'Blocks', outward: 'blocks', inward: 'is blocked by' },
          outwardIssue: {
            key: 'PROJ-200',
            fields: { summary: 'Blocking issue', status: { name: 'Open' } },
          },
        },
      ];
      global.fetch = mockFetch(makeIssueResponse({ issuelinks }));
      const svc = new JiraService();
      const task = await svc.getIssue('PROJ-123');
      expect(task.linkedIssues).toHaveLength(1);
      expect(task.linkedIssues[0].key).toBe('PROJ-200');
      expect(task.linkedIssues[0].type).toBe('blocks');
    });

    it('parses sprint name from array field', async () => {
      const customfield_10020 = [
        { id: 1, name: 'Sprint 22', state: 'closed' },
        { id: 2, name: 'Sprint 23', state: 'active' },
      ];
      global.fetch = mockFetch(makeIssueResponse({ customfield_10020 }));
      const svc = new JiraService();
      const task = await svc.getIssue('PROJ-123');
      // Should use the last sprint in the array
      expect(task.sprint).toBe('Sprint 23');
    });

    it('parses comments and converts body to markdown', async () => {
      const comment = {
        comments: [
          {
            author: { displayName: 'Reviewer' },
            body: {
              version: 1,
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'LGTM!' }],
                },
              ],
            },
            created: '2024-01-01T00:00:00.000Z',
          },
        ],
      };
      global.fetch = mockFetch(makeIssueResponse({ comment }));
      const svc = new JiraService();
      const task = await svc.getIssue('PROJ-123');
      expect(task.comments).toHaveLength(1);
      expect(task.comments[0].author).toBe('Reviewer');
      expect(task.comments[0].body).toContain('LGTM!');
    });
  });
});
