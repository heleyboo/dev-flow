import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServer } from '../../src/web/server.js';

// Mock services
vi.mock('../../src/services/jira.service.js', () => ({
  JiraService: vi.fn().mockImplementation(() => ({
    listMyTasks: vi.fn().mockResolvedValue([
      { key: 'PROJ-1', summary: 'Task 1', status: 'To Do' },
    ]),
    getIssue: vi.fn().mockResolvedValue({
      key: 'PROJ-1', summary: 'Task 1', status: 'To Do',
      _raw: {},
    }),
  })),
}));

vi.mock('../../src/services/deploy.service.js', () => ({
  DeployService: vi.fn().mockImplementation(() => ({
    getEnvironmentStatus: vi.fn().mockResolvedValue([]),
    getDeployHistory: vi.fn().mockReturnValue([]),
    deploy: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

vi.mock('../../src/utils/config.js', () => ({
  loadConfig: () => ({ project: { name: 'test' } }),
  resetConfig: vi.fn(),
}));

// Test by starting server on random port and using fetch
describe('Web Dashboard API', () => {
  let server;
  let baseUrl;

  beforeEach(async () => {
    const app = createServer();
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://localhost:${server.address().port}`;
        resolve();
      });
    });
  });

  afterEach(() => { server?.close(); });

  it('GET / returns landing page HTML', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('DevFlow Dashboard');
  });

  it('GET /api/health returns ok', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('GET /api/config returns config', async () => {
    const res = await fetch(`${baseUrl}/api/config`);
    const data = await res.json();
    expect(data.project.name).toBe('test');
  });

  it('GET /api/tasks returns task list', async () => {
    const res = await fetch(`${baseUrl}/api/tasks`);
    const data = await res.json();
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0].key).toBe('PROJ-1');
  });

  it('GET /api/tasks/:id returns task detail', async () => {
    const res = await fetch(`${baseUrl}/api/tasks/PROJ-1`);
    const data = await res.json();
    expect(data.key).toBe('PROJ-1');
    expect(data._raw).toBeUndefined();
  });

  it('GET /api/deploy/status returns environment status', async () => {
    const res = await fetch(`${baseUrl}/api/deploy/status`);
    const data = await res.json();
    expect(data.environments).toBeDefined();
  });
});
