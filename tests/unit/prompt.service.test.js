import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { selectTemplate, extractKeywords, PromptService } from '../../src/services/prompt.service.js';

// ──────────────────────────────────────────────────────────────────────────────
// 1. selectTemplate
// ──────────────────────────────────────────────────────────────────────────────

describe('selectTemplate', () => {
  it('returns bug-fix for a task with type=bug', () => {
    const task = { type: 'bug', summary: 'Something is broken', description: '' };
    expect(selectTemplate(task)).toBe('bug-fix');
  });

  it('returns bug-fix when summary contains bug keywords', () => {
    const task = { type: 'story', summary: 'Fix the crash in payment flow', description: '' };
    expect(selectTemplate(task)).toBe('bug-fix');
  });

  it('returns bug-fix when description contains error keyword', () => {
    const task = { type: 'task', summary: 'Payment issue', description: 'There is an error in the checkout' };
    expect(selectTemplate(task)).toBe('bug-fix');
  });

  it('returns migration for migration keywords in summary', () => {
    const task = { type: 'task', summary: 'Add migration for users table', description: '' };
    expect(selectTemplate(task)).toBe('migration');
  });

  it('returns migration for schema keyword in description', () => {
    const task = { type: 'story', summary: 'Update database', description: 'We need a migration to alter the schema' };
    expect(selectTemplate(task)).toBe('migration');
  });

  it('returns refactor for refactor keywords', () => {
    const task = { type: 'task', summary: 'Refactor the user service', description: '' };
    expect(selectTemplate(task)).toBe('refactor');
  });

  it('returns refactor for cleanup keyword', () => {
    const task = { type: 'task', summary: 'Cleanup old code in auth module', description: '' };
    expect(selectTemplate(task)).toBe('refactor');
  });

  it('returns integration for integration keywords', () => {
    const task = { type: 'story', summary: 'Integrate with Stripe payment gateway', description: '' };
    expect(selectTemplate(task)).toBe('integration');
  });

  it('returns integration for webhook keyword', () => {
    const task = { type: 'story', summary: 'Add webhook support', description: '' };
    expect(selectTemplate(task)).toBe('integration');
  });

  it('returns crud-feature for CRUD keywords', () => {
    const task = { type: 'story', summary: 'Create CRUD for products', description: '' };
    expect(selectTemplate(task)).toBe('crud-feature');
  });

  it('returns api-endpoint for api/endpoint keywords', () => {
    const task = { type: 'story', summary: 'Create an API endpoint for user profiles', description: '' };
    expect(selectTemplate(task)).toBe('api-endpoint');
  });

  it('returns api-endpoint as default for story type', () => {
    const task = { type: 'story', summary: 'New feature', description: 'Build something' };
    expect(selectTemplate(task)).toBe('api-endpoint');
  });

  it('returns api-endpoint as fallback for unknown task type', () => {
    const task = { type: 'unknown', summary: 'Do something', description: '' };
    expect(selectTemplate(task)).toBe('api-endpoint');
  });

  it('handles missing type gracefully', () => {
    const task = { type: '', summary: 'Some task', description: '' };
    expect(selectTemplate(task)).toBe('api-endpoint');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. extractKeywords
// ──────────────────────────────────────────────────────────────────────────────

describe('extractKeywords', () => {
  it('extracts meaningful keywords from summary and description', () => {
    const task = {
      summary: 'Create user authentication endpoint',
      description: 'Build a login API with JWT tokens',
    };
    const keywords = extractKeywords(task);
    expect(keywords).toContain('create');
    expect(keywords).toContain('user');
    expect(keywords).toContain('authentication');
    expect(keywords).toContain('endpoint');
    expect(keywords).toContain('login');
    expect(keywords).toContain('jwt');
    expect(keywords).toContain('tokens');
  });

  it('removes stop words', () => {
    const task = {
      summary: 'This is a task with the word and',
      description: 'It has some filler words in it',
    };
    const keywords = extractKeywords(task);
    expect(keywords).not.toContain('this');
    expect(keywords).not.toContain('is');
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('and');
    expect(keywords).not.toContain('it');
    expect(keywords).not.toContain('in');
  });

  it('lowercases all keywords', () => {
    const task = {
      summary: 'Create UserService Controller',
      description: '',
    };
    const keywords = extractKeywords(task);
    // Check all are lowercase
    keywords.forEach((kw) => {
      expect(kw).toBe(kw.toLowerCase());
    });
  });

  it('deduplicates repeated keywords', () => {
    const task = {
      summary: 'create user create',
      description: 'create another create',
    };
    const keywords = extractKeywords(task);
    const createCount = keywords.filter((k) => k === 'create').length;
    expect(createCount).toBe(1);
  });

  it('returns an array', () => {
    const task = { summary: 'some task', description: '' };
    const keywords = extractKeywords(task);
    expect(Array.isArray(keywords)).toBe(true);
  });

  it('handles empty summary and description', () => {
    const task = { summary: '', description: '' };
    const keywords = extractKeywords(task);
    expect(Array.isArray(keywords)).toBe(true);
    expect(keywords.length).toBe(0);
  });

  it('handles missing fields gracefully', () => {
    const task = {};
    const keywords = extractKeywords(task);
    expect(Array.isArray(keywords)).toBe(true);
  });

  it('filters out very short words (length <= 2)', () => {
    const task = { summary: 'do it go up', description: '' };
    const keywords = extractKeywords(task);
    keywords.forEach((kw) => {
      expect(kw.length).toBeGreaterThan(2);
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3 & 4. PromptService.renderTemplate
// ──────────────────────────────────────────────────────────────────────────────

describe('PromptService.renderTemplate', () => {
  let svc;

  beforeEach(() => {
    svc = new PromptService();
  });

  it('renders the base template with task data', () => {
    const data = {
      task: {
        key: 'PROJ-123',
        summary: 'Add user login',
        description: 'Implement JWT-based login',
        type: 'story',
        priority: 'high',
        sprint: null,
        epic: null,
        parent: null,
        subtasks: [],
        acceptanceCriteria: [],
      },
      figma: null,
      codeContext: null,
      standards: [],
    };
    const result = svc.renderTemplate('api-endpoint', data);
    expect(result).toContain('Add user login');
    expect(result).toContain('PROJ-123');
    expect(result).toContain('Implement JWT-based login');
  });

  it('includes the correct partial based on template name', () => {
    const data = {
      task: {
        key: 'BUG-1',
        summary: 'Fix null pointer',
        description: 'App crashes on login',
        type: 'bug',
        priority: 'critical',
        sprint: null,
        epic: null,
        parent: null,
        subtasks: [],
        acceptanceCriteria: [],
      },
      figma: null,
      codeContext: null,
      standards: [],
    };

    const bugResult = svc.renderTemplate('bug-fix', data);
    expect(bugResult).toContain('Analyze root cause');
    expect(bugResult).toContain('regression test');

    const apiResult = svc.renderTemplate('api-endpoint', data);
    expect(apiResult).toContain('Create route');
    expect(apiResult).toContain('controller');
  });

  it('renders crud-feature partial correctly', () => {
    const data = {
      task: {
        key: 'FEAT-10',
        summary: 'CRUD for products',
        description: '',
        type: 'story',
        priority: 'medium',
        sprint: null,
        epic: null,
        parent: null,
        subtasks: [],
        acceptanceCriteria: [],
      },
      figma: null,
      codeContext: null,
      standards: [],
    };
    const result = svc.renderTemplate('crud-feature', data);
    expect(result).toContain('Create database migration');
    expect(result).toContain('CRUD test suite');
  });

  it('renders migration partial correctly', () => {
    const data = {
      task: {
        key: 'DB-5',
        summary: 'Add users table migration',
        description: '',
        type: 'task',
        priority: 'high',
        sprint: null,
        epic: null,
        parent: null,
        subtasks: [],
        acceptanceCriteria: [],
      },
      figma: null,
      codeContext: null,
      standards: [],
    };
    const result = svc.renderTemplate('migration', data);
    expect(result).toContain('migration file');
    expect(result).toContain('up()');
    expect(result).toContain('down()');
  });

  it('renders refactor partial correctly', () => {
    const data = {
      task: {
        key: 'TECH-2',
        summary: 'Refactor auth module',
        description: '',
        type: 'task',
        priority: 'low',
        sprint: null,
        epic: null,
        parent: null,
        subtasks: [],
        acceptanceCriteria: [],
      },
      figma: null,
      codeContext: null,
      standards: [],
    };
    const result = svc.renderTemplate('refactor', data);
    expect(result).toContain('Identify code to refactor');
    expect(result).toContain('No functional changes');
  });

  it('renders integration partial correctly', () => {
    const data = {
      task: {
        key: 'INT-3',
        summary: 'Integrate Stripe',
        description: '',
        type: 'story',
        priority: 'high',
        sprint: null,
        epic: null,
        parent: null,
        subtasks: [],
        acceptanceCriteria: [],
      },
      figma: null,
      codeContext: null,
      standards: [],
    };
    const result = svc.renderTemplate('integration', data);
    expect(result).toContain('API client');
    expect(result).toContain('authentication');
    expect(result).toContain('mocked external calls');
  });

  it('renders acceptance criteria with 1-based indexing', () => {
    const data = {
      task: {
        key: 'AC-1',
        summary: 'Task with criteria',
        description: '',
        type: 'story',
        priority: 'medium',
        sprint: null,
        epic: null,
        parent: null,
        subtasks: [],
        acceptanceCriteria: ['First criterion', 'Second criterion'],
      },
      figma: null,
      codeContext: null,
      standards: [],
    };
    const result = svc.renderTemplate('api-endpoint', data);
    expect(result).toContain('1. First criterion');
    expect(result).toContain('2. Second criterion');
  });

  it('renders epic and parent info when present', () => {
    const data = {
      task: {
        key: 'FEAT-20',
        summary: 'Sub task',
        description: '',
        type: 'story',
        priority: 'medium',
        sprint: 'Sprint 5',
        epic: { key: 'EPIC-1', summary: 'Big feature' },
        parent: { key: 'STORY-5', summary: 'Parent story' },
        subtasks: [],
        acceptanceCriteria: [],
      },
      figma: null,
      codeContext: null,
      standards: [],
    };
    const result = svc.renderTemplate('api-endpoint', data);
    expect(result).toContain('EPIC-1');
    expect(result).toContain('Big feature');
    expect(result).toContain('STORY-5');
    expect(result).toContain('Sprint 5');
  });

  it('renders standards when provided', () => {
    const data = {
      task: {
        key: 'STD-1',
        summary: 'Task',
        description: '',
        type: 'story',
        priority: 'low',
        sprint: null,
        epic: null,
        parent: null,
        subtasks: [],
        acceptanceCriteria: [],
      },
      figma: null,
      codeContext: null,
      standards: ['Follow PSR-12', 'Write unit tests'],
    };
    const result = svc.renderTemplate('api-endpoint', data);
    expect(result).toContain('Follow PSR-12');
    expect(result).toContain('Write unit tests');
  });

  it('renders code context when provided', () => {
    const data = {
      task: {
        key: 'CTX-1',
        summary: 'Task with code context',
        description: '',
        type: 'story',
        priority: 'medium',
        sprint: null,
        epic: null,
        parent: null,
        subtasks: [],
        acceptanceCriteria: [],
      },
      figma: null,
      codeContext: {
        files: [
          {
            path: 'src/controllers/UserController.js',
            content: 'class UserController {}',
            language: 'javascript',
          },
        ],
        routes: [],
        models: [],
        dbSchema: [],
      },
      standards: [],
    };
    const result = svc.renderTemplate('api-endpoint', data);
    expect(result).toContain('UserController.js');
    expect(result).toContain('class UserController {}');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. PromptService.listTemplates
// ──────────────────────────────────────────────────────────────────────────────

describe('PromptService.listTemplates', () => {
  it('lists built-in templates', () => {
    const svc = new PromptService();
    const templates = svc.listTemplates();

    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBeGreaterThan(0);

    const names = templates.map((t) => t.name);
    expect(names).toContain('api-endpoint');
    expect(names).toContain('crud-feature');
    expect(names).toContain('bug-fix');
    expect(names).toContain('migration');
    expect(names).toContain('refactor');
    expect(names).toContain('integration');
  });

  it('marks built-in templates as builtin: true', () => {
    const svc = new PromptService();
    const templates = svc.listTemplates();
    const builtins = templates.filter((t) => t.builtin);
    expect(builtins.length).toBeGreaterThan(0);
    builtins.forEach((t) => {
      expect(t.builtin).toBe(true);
    });
  });

  it('returns objects with name, description, builtin fields', () => {
    const svc = new PromptService();
    const templates = svc.listTemplates();
    templates.forEach((t) => {
      expect(t).toHaveProperty('name');
      expect(t).toHaveProperty('description');
      expect(t).toHaveProperty('builtin');
      expect(typeof t.name).toBe('string');
      expect(typeof t.description).toBe('string');
      expect(typeof t.builtin).toBe('boolean');
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 6. PromptService.scanCodebase — non-existent project
// ──────────────────────────────────────────────────────────────────────────────

describe('PromptService.scanCodebase', () => {
  it('returns empty result when no matching files are found', () => {
    const svc = new PromptService();
    // Use keywords unlikely to match any files
    const result = svc.scanCodebase(['zzz_nonexistent_keyword_xyz123']);
    expect(result).toHaveProperty('files');
    expect(result).toHaveProperty('routes');
    expect(result).toHaveProperty('models');
    expect(result).toHaveProperty('dbSchema');
    expect(Array.isArray(result.files)).toBe(true);
    expect(result.files).toHaveLength(0);
  });

  it('returns the correct shape for an empty result', () => {
    const svc = new PromptService();
    const result = svc.scanCodebase([]);
    expect(result.files).toEqual([]);
    expect(result.routes).toEqual([]);
    expect(result.models).toEqual([]);
    expect(result.dbSchema).toEqual([]);
  });

  it('handles undefined keywords gracefully', () => {
    const svc = new PromptService();
    expect(() => svc.scanCodebase(undefined)).not.toThrow();
    const result = svc.scanCodebase(undefined);
    expect(Array.isArray(result.files)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 7. PromptService.generatePrompt — orchestration test
// ──────────────────────────────────────────────────────────────────────────────

describe('PromptService.generatePrompt', () => {
  let svc;

  beforeEach(() => {
    svc = new PromptService();
    // Stub scanCodebase to avoid filesystem access
    vi.spyOn(svc, 'scanCodebase').mockReturnValue({
      files: [],
      routes: [],
      models: [],
      dbSchema: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a rendered prompt string', async () => {
    const task = {
      key: 'PROJ-100',
      type: 'story',
      summary: 'Add user registration endpoint',
      description: 'Create a POST /register endpoint',
      priority: 'high',
      figmaLinks: [],
      acceptanceCriteria: [],
      subtasks: [],
      sprint: null,
      epic: null,
      parent: null,
      labels: [],
    };

    const result = await svc.generatePrompt(task, { noCodeContext: true });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('PROJ-100');
    expect(result).toContain('Add user registration endpoint');
  });

  it('uses options.template when provided', async () => {
    const task = {
      key: 'PROJ-200',
      type: 'story',
      summary: 'Some task',
      description: '',
      priority: 'medium',
      figmaLinks: [],
      acceptanceCriteria: [],
      subtasks: [],
      sprint: null,
      epic: null,
      parent: null,
      labels: [],
    };

    const result = await svc.generatePrompt(task, {
      noCodeContext: true,
      template: 'bug-fix',
    });
    expect(result).toContain('Analyze root cause');
  });

  it('skips figma when task has no figmaLinks', async () => {
    const task = {
      key: 'PROJ-300',
      type: 'story',
      summary: 'Simple task',
      description: '',
      priority: 'low',
      figmaLinks: [],
      acceptanceCriteria: [],
      subtasks: [],
      sprint: null,
      epic: null,
      parent: null,
      labels: [],
    };

    const result = await svc.generatePrompt(task, { noCodeContext: true });
    expect(typeof result).toBe('string');
    // No figma section when no figmaLinks
    expect(result).not.toContain('UI/Design Specs');
  });

  it('skips figma when options.noFigma is true', async () => {
    const task = {
      key: 'PROJ-400',
      type: 'story',
      summary: 'Task with figma link',
      description: '',
      priority: 'medium',
      figmaLinks: ['https://www.figma.com/file/abc123/Design'],
      acceptanceCriteria: [],
      subtasks: [],
      sprint: null,
      epic: null,
      parent: null,
      labels: [],
    };

    // Mock FigmaService to ensure it's never called
    const figmaSpy = vi.fn();
    vi.mock('../../src/services/figma.service.js', () => ({
      FigmaService: vi.fn().mockImplementation(() => ({
        extractSpecs: figmaSpy,
      })),
    }));

    const result = await svc.generatePrompt(task, {
      noCodeContext: true,
      noFigma: true,
    });
    expect(typeof result).toBe('string');
    // figmaSpy should not have been called
    expect(figmaSpy).not.toHaveBeenCalled();
  });

  it('uses scanCodebase when noCodeContext is not set', async () => {
    const task = {
      key: 'PROJ-500',
      type: 'story',
      summary: 'Task for code context',
      description: '',
      priority: 'low',
      figmaLinks: [],
      acceptanceCriteria: [],
      subtasks: [],
      sprint: null,
      epic: null,
      parent: null,
      labels: [],
    };

    const result = await svc.generatePrompt(task);
    expect(svc.scanCodebase).toHaveBeenCalled();
    expect(typeof result).toBe('string');
  });

  it('selects template automatically based on task type', async () => {
    const task = {
      key: 'BUG-10',
      type: 'bug',
      summary: 'Application crashes on login',
      description: 'Fix the error in auth module',
      priority: 'critical',
      figmaLinks: [],
      acceptanceCriteria: [],
      subtasks: [],
      sprint: null,
      epic: null,
      parent: null,
      labels: [],
    };

    const result = await svc.generatePrompt(task, { noCodeContext: true });
    expect(result).toContain('Analyze root cause');
    expect(result).toContain('regression test');
  });
});
