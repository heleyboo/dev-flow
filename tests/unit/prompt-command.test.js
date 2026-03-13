import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promptCommand } from '../../src/commands/prompt.js';

// ── Mock JiraService ──────────────────────────────────────────────────────────

vi.mock('../../src/services/jira.service.js', () => ({
  JiraService: vi.fn().mockImplementation(() => ({
    getIssue: vi.fn().mockResolvedValue({
      key: 'PROJ-456',
      summary: 'Implement User Profile API',
      type: 'story',
      priority: 'high',
      description: 'Build user profile endpoints',
      acceptanceCriteria: ['GET endpoint works'],
      subtasks: [],
      linkedIssues: [],
      figmaLinks: [],
      comments: [],
      sprint: 'Sprint 23',
      epic: null,
      parent: null,
    }),
  })),
}));

// ── Mock PromptService ────────────────────────────────────────────────────────

vi.mock('../../src/services/prompt.service.js', () => ({
  selectTemplate: vi.fn().mockReturnValue('api-endpoint'),
  PromptService: vi.fn().mockImplementation(() => ({
    generatePrompt: vi.fn().mockResolvedValue(
      '# Task: Implement User Profile API [PROJ-456]\n\n## Context\nGenerated prompt content here...'
    ),
    listTemplates: vi.fn().mockReturnValue([
      { name: 'api-endpoint', description: 'REST API endpoint', builtin: true },
    ]),
  })),
}));

// ── Mock fs ───────────────────────────────────────────────────────────────────

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return { ...actual, writeFileSync: vi.fn(), mkdirSync: vi.fn() };
});

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('promptCommand', () => {
  it('fetches task and generates prompt', async () => {
    const { JiraService } = await import('../../src/services/jira.service.js');
    const { PromptService } = await import('../../src/services/prompt.service.js');

    await promptCommand('PROJ-456', {});

    // JiraService was instantiated and getIssue was called
    expect(JiraService).toHaveBeenCalled();
    const jiraInstance = JiraService.mock.results[0].value;
    expect(jiraInstance.getIssue).toHaveBeenCalledWith('PROJ-456');

    // PromptService was instantiated and generatePrompt was called
    expect(PromptService).toHaveBeenCalled();
    const promptInstance = PromptService.mock.results[0].value;
    expect(promptInstance.generatePrompt).toHaveBeenCalled();
  });

  it('saves prompt to .devflow/prompts/', async () => {
    const { writeFileSync, mkdirSync } = await import('fs');

    await promptCommand('PROJ-456', {});

    expect(mkdirSync).toHaveBeenCalled();
    const mkdirCall = mkdirSync.mock.calls[0];
    expect(mkdirCall[0]).toContain('.devflow/prompts');
    expect(mkdirCall[1]).toEqual({ recursive: true });

    expect(writeFileSync).toHaveBeenCalled();
    const writeCall = writeFileSync.mock.calls[0];
    expect(writeCall[0]).toContain('PROJ-456.md');
    expect(writeCall[1]).toContain('Implement User Profile API');
  });

  it('displays preview of the generated prompt', async () => {
    await promptCommand('PROJ-456', {});

    expect(output).toContain('Prompt Preview');
    expect(output).toContain('# Task: Implement User Profile API [PROJ-456]');
    expect(output).toContain('Generated prompt content here...');
  });

  it('handles error gracefully', async () => {
    const { JiraService } = await import('../../src/services/jira.service.js');
    JiraService.mockImplementationOnce(() => ({
      getIssue: vi.fn().mockRejectedValue(new Error('Jira API returned 401 Unauthorized')),
    }));

    await promptCommand('PROJ-456', {});

    expect(output).toContain('401 Unauthorized');
    expect(output).toContain('DEVFLOW_JIRA_TOKEN');
  });
});
