import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseAcceptanceCriteria,
  mapFigmaToSelectors,
  generateScenarios,
  E2eTestService,
} from '../../src/services/e2e-test.service.js';

// ── Mock fs ───────────────────────────────────────────────────────────────────

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return { ...actual, writeFileSync: vi.fn(), mkdirSync: vi.fn() };
});

// ── 1. parseAcceptanceCriteria: parses simple criteria ────────────────────────

describe('parseAcceptanceCriteria', () => {
  it('parses simple "User can X" criteria', () => {
    const criteria = ['User can update their profile'];
    const scenarios = parseAcceptanceCriteria(criteria);
    expect(scenarios.length).toBe(1);
    expect(scenarios[0].name).toContain('User can update their profile');
    expect(scenarios[0].steps.length).toBeGreaterThan(0);
    expect(typeof scenarios[0].expectedResult).toBe('string');
  });

  it('parses "User should X" criteria', () => {
    const criteria = ['User should see a success message after saving'];
    const scenarios = parseAcceptanceCriteria(criteria);
    expect(scenarios.length).toBe(1);
    expect(scenarios[0].name).toContain('User should');
  });

  it('parses Given/When/Then format', () => {
    const criteria = ['Given I am logged in When I click save Then my data is saved'];
    const scenarios = parseAcceptanceCriteria(criteria);
    expect(scenarios.length).toBe(1);
    const s = scenarios[0];
    expect(s.steps.some((step) => /given/i.test(step))).toBe(true);
    expect(s.steps.some((step) => /when/i.test(step))).toBe(true);
    expect(s.expectedResult).toBeTruthy();
  });

  it('handles empty array', () => {
    const scenarios = parseAcceptanceCriteria([]);
    expect(Array.isArray(scenarios)).toBe(true);
    expect(scenarios.length).toBe(0);
  });

  it('handles null/undefined gracefully', () => {
    expect(parseAcceptanceCriteria(null)).toEqual([]);
    expect(parseAcceptanceCriteria(undefined)).toEqual([]);
  });

  it('returns array of scenario objects with name, steps, expectedResult', () => {
    const criteria = ['User can log in', 'User can log out'];
    const scenarios = parseAcceptanceCriteria(criteria);
    expect(scenarios.length).toBe(2);
    scenarios.forEach((s) => {
      expect(s).toHaveProperty('name');
      expect(s).toHaveProperty('steps');
      expect(s).toHaveProperty('expectedResult');
      expect(Array.isArray(s.steps)).toBe(true);
    });
  });

  it('handles multiple criteria', () => {
    const criteria = [
      'User can view their dashboard',
      'User can edit their profile',
      'User can delete their account',
    ];
    const scenarios = parseAcceptanceCriteria(criteria);
    expect(scenarios.length).toBe(3);
  });

  it('parses Given/When/Then into structured steps', () => {
    const criteria = ['Given the user is on the profile page When they submit the form Then the profile is updated'];
    const scenarios = parseAcceptanceCriteria(criteria);
    const s = scenarios[0];
    expect(s.steps.length).toBeGreaterThanOrEqual(2);
  });
});

// ── 2. mapFigmaToSelectors ────────────────────────────────────────────────────

describe('mapFigmaToSelectors', () => {
  it('maps a button component to a selector', () => {
    const specs = [{ name: 'Save', type: 'button' }];
    const selectors = mapFigmaToSelectors(specs);
    expect(selectors.length).toBeGreaterThan(0);
    const saveBtn = selectors.find((s) => s.selector.includes('save'));
    expect(saveBtn).toBeDefined();
    expect(saveBtn.selector).toBe('[data-testid="save-button"]');
    expect(saveBtn.elementType).toBe('button');
  });

  it('maps an input component to a selector', () => {
    const specs = [{ name: 'Full Name', type: 'input' }];
    const selectors = mapFigmaToSelectors(specs);
    const fullNameInput = selectors.find((s) => s.selector.includes('full-name'));
    expect(fullNameInput).toBeDefined();
    expect(fullNameInput.selector).toBe('[data-testid="full-name-input"]');
    expect(fullNameInput.elementType).toBe('input');
  });

  it('maps a form component to a selector', () => {
    const specs = [{ name: 'Profile Form', type: 'form' }];
    const selectors = mapFigmaToSelectors(specs);
    const profileForm = selectors.find((s) => s.selector.includes('profile-form'));
    expect(profileForm).toBeDefined();
    expect(profileForm.selector).toBe('[data-testid="profile-form-form"]');
    expect(profileForm.elementType).toBe('form');
  });

  it('sanitizes names properly: lowercase, spaces to hyphens', () => {
    const specs = [{ name: 'My Cool Button', type: 'button' }];
    const selectors = mapFigmaToSelectors(specs);
    expect(selectors[0].selector).toBe('[data-testid="my-cool-button-button"]');
  });

  it('handles empty array', () => {
    const selectors = mapFigmaToSelectors([]);
    expect(Array.isArray(selectors)).toBe(true);
    expect(selectors.length).toBe(0);
  });

  it('handles null/undefined gracefully', () => {
    expect(mapFigmaToSelectors(null)).toEqual([]);
    expect(mapFigmaToSelectors(undefined)).toEqual([]);
  });

  it('returns objects with name, selector, elementType', () => {
    const specs = [{ name: 'Save', type: 'button' }];
    const selectors = mapFigmaToSelectors(specs);
    selectors.forEach((sel) => {
      expect(sel).toHaveProperty('name');
      expect(sel).toHaveProperty('selector');
      expect(sel).toHaveProperty('elementType');
    });
  });

  it('deduplicates identical selectors', () => {
    const specs = [
      { name: 'Save', type: 'button' },
      { name: 'Save', type: 'button' },
    ];
    const selectors = mapFigmaToSelectors(specs);
    const saveButtons = selectors.filter((s) => s.selector.includes('save-button'));
    expect(saveButtons.length).toBe(1);
  });

  it('recursively processes children components', () => {
    const specs = [
      {
        name: 'Profile Form',
        type: 'form',
        children: [
          { name: 'Full Name', type: 'input' },
          { name: 'Save', type: 'button' },
        ],
      },
    ];
    const selectors = mapFigmaToSelectors(specs);
    expect(selectors.length).toBeGreaterThanOrEqual(3);
    const types = selectors.map((s) => s.elementType);
    expect(types).toContain('form');
    expect(types).toContain('input');
    expect(types).toContain('button');
  });
});

// ── 3. generateScenarios ──────────────────────────────────────────────────────

describe('generateScenarios', () => {
  const task = {
    key: 'PROJ-42',
    summary: 'User Profile Page',
    acceptanceCriteria: ['User can view their profile', 'User can edit their profile'],
  };
  const figmaSpecs = [{ name: 'Save', type: 'button' }];

  it('combines AC and selectors into scenarios', () => {
    const scenarios = generateScenarios(task, figmaSpecs);
    expect(scenarios.length).toBeGreaterThanOrEqual(2);
    const names = scenarios.map((s) => s.name);
    expect(names.some((n) => n.includes('view their profile'))).toBe(true);
    expect(names.some((n) => n.includes('edit their profile'))).toBe(true);
  });

  it('attaches selectors to each scenario', () => {
    const scenarios = generateScenarios(task, figmaSpecs);
    scenarios.forEach((s) => {
      expect(s).toHaveProperty('selectors');
    });
  });

  it('adds auth check scenario', () => {
    const scenarios = generateScenarios(task, figmaSpecs);
    const authCheck = scenarios.find((s) => s.isAuthCheck);
    expect(authCheck).toBeDefined();
  });

  it('adds mobile responsive check when mobile option set', () => {
    const scenarios = generateScenarios(task, figmaSpecs, { mobile: true });
    const mobileCheck = scenarios.find((s) => s.isMobileCheck);
    expect(mobileCheck).toBeDefined();
  });

  it('does not add mobile check without mobile option', () => {
    const scenarios = generateScenarios(task, figmaSpecs);
    const mobileCheck = scenarios.find((s) => s.isMobileCheck);
    expect(mobileCheck).toBeUndefined();
  });

  it('handles task with no acceptance criteria', () => {
    const minTask = { key: 'PROJ-1', summary: 'Test' };
    const scenarios = generateScenarios(minTask, []);
    expect(Array.isArray(scenarios)).toBe(true);
    // Should at least have the auth check
    expect(scenarios.length).toBeGreaterThan(0);
  });
});

// ── 4. E2eTestService constructor ─────────────────────────────────────────────

describe('E2eTestService constructor', () => {
  it('uses default framework playwright when not configured', () => {
    const svc = new E2eTestService();
    expect(svc.framework).toBe('playwright');
  });

  it('uses config.test.e2e.framework when provided', () => {
    const svc = new E2eTestService({ test: { e2e: { framework: 'cypress' } } });
    expect(svc.framework).toBe('cypress');
  });

  it('uses default language typescript', () => {
    const svc = new E2eTestService();
    expect(svc.language).toBe('typescript');
  });

  it('uses default output_dir tests/e2e', () => {
    const svc = new E2eTestService();
    expect(svc.outputDir).toBe('tests/e2e');
  });

  it('uses config output_dir when provided', () => {
    const svc = new E2eTestService({ test: { e2e: { output_dir: 'e2e-tests' } } });
    expect(svc.outputDir).toBe('e2e-tests');
  });
});

// ── 5. generatePlaywrightTest ─────────────────────────────────────────────────

describe('E2eTestService.generatePlaywrightTest', () => {
  const scenarios = [
    {
      name: 'User can view profile',
      steps: ['navigate to profile page'],
      expectedResult: 'profile page is displayed',
      selectors: [],
    },
  ];
  const task = { key: 'PROJ-42', summary: 'User Profile' };

  it('generates valid Playwright test structure with import and describe', () => {
    const svc = new E2eTestService();
    const content = svc.generatePlaywrightTest(scenarios, { task });
    expect(typeof content).toBe('string');
    expect(content).toContain("import { test, expect } from '@playwright/test'");
    expect(content).toContain('test.describe(');
  });

  it('includes feature name from task summary', () => {
    const svc = new E2eTestService();
    const content = svc.generatePlaywrightTest(scenarios, { task });
    expect(content).toContain('User Profile');
  });

  it('includes test() blocks for each scenario', () => {
    const svc = new E2eTestService();
    const content = svc.generatePlaywrightTest(scenarios, { task });
    expect(content).toContain("test('User can view profile'");
  });

  it('includes beforeEach with async page fixture', () => {
    const svc = new E2eTestService();
    const content = svc.generatePlaywrightTest(scenarios, { task });
    expect(content).toContain('test.beforeEach');
    expect(content).toContain('async ({ page })');
  });

  it('includes auth setup when auth configured', () => {
    const svc = new E2eTestService({ test: { e2e: { auth: { login_url: '/login', username: 'user@test.com', password: 'pass' } } } });
    const content = svc.generatePlaywrightTest(scenarios, { task });
    expect(content).toContain('/login');
    expect(content).toContain('user@test.com');
  });

  it('does not include auth setup when auth not configured', () => {
    const svc = new E2eTestService();
    const content = svc.generatePlaywrightTest(scenarios, { task });
    expect(content).not.toContain('cy.login');
    expect(content).not.toContain("page.goto('/login')");
  });

  it('includes mobile viewport tests when options.mobile is true', () => {
    const svc = new E2eTestService();
    const content = svc.generatePlaywrightTest(scenarios, { task, mobile: true });
    expect(content).toContain('Mobile viewport');
    expect(content).toContain('viewport');
  });
});

// ── 6. generateCypressTest ────────────────────────────────────────────────────

describe('E2eTestService.generateCypressTest', () => {
  const scenarios = [
    {
      name: 'User can log in',
      steps: ['visit login page', 'enter credentials', 'click submit'],
      expectedResult: 'user is redirected to dashboard',
      selectors: [],
    },
  ];
  const task = { key: 'PROJ-10', summary: 'Login Feature' };

  it('generates valid Cypress test structure with describe and it', () => {
    const svc = new E2eTestService({ test: { e2e: { framework: 'cypress' } } });
    const content = svc.generateCypressTest(scenarios, { task });
    expect(typeof content).toBe('string');
    expect(content).toContain("describe('");
    expect(content).toContain("it('");
  });

  it('includes feature name from task summary', () => {
    const svc = new E2eTestService({ test: { e2e: { framework: 'cypress' } } });
    const content = svc.generateCypressTest(scenarios, { task });
    expect(content).toContain('Login Feature');
  });

  it('includes beforeEach with cy.login when auth configured', () => {
    const svc = new E2eTestService({ test: { e2e: { framework: 'cypress', auth: { login_url: '/login' } } } });
    const content = svc.generateCypressTest(scenarios, { task });
    expect(content).toContain('cy.login()');
  });

  it('includes cy.visit for each test', () => {
    const svc = new E2eTestService({ test: { e2e: { framework: 'cypress' } } });
    const content = svc.generateCypressTest(scenarios, { task });
    expect(content).toContain('cy.visit(');
  });

  it('includes it() block for each scenario', () => {
    const svc = new E2eTestService({ test: { e2e: { framework: 'cypress' } } });
    const content = svc.generateCypressTest(scenarios, { task });
    expect(content).toContain("it('User can log in'");
  });
});

// ── 7. generatePageObject ─────────────────────────────────────────────────────

describe('E2eTestService.generatePageObject', () => {
  const selectors = [
    { name: 'Save', selector: '[data-testid="save-button"]', elementType: 'button' },
    { name: 'Full Name', selector: '[data-testid="full-name-input"]', elementType: 'input' },
    { name: 'Profile Form', selector: '[data-testid="profile-form-form"]', elementType: 'form' },
  ];

  it('generates POM class with correct class name', () => {
    const svc = new E2eTestService();
    const content = svc.generatePageObject(selectors, 'Profile Page');
    expect(content).toContain('class ProfilePagePage');
  });

  it('includes readonly properties for each selector', () => {
    const svc = new E2eTestService();
    const content = svc.generatePageObject(selectors, 'Profile');
    expect(content).toContain('readonly');
    expect(content).toContain('[data-testid="save-button"]');
    expect(content).toContain('[data-testid="full-name-input"]');
  });

  it('exports the class', () => {
    const svc = new E2eTestService();
    const content = svc.generatePageObject(selectors, 'Profile');
    expect(content).toContain('export class');
  });

  it('handles empty selectors array', () => {
    const svc = new E2eTestService();
    const content = svc.generatePageObject([], 'Profile');
    expect(content).toContain('class');
    expect(content).toContain('}');
  });
});

// ── 8. generateTestIdList ─────────────────────────────────────────────────────

describe('E2eTestService.generateTestIdList', () => {
  it('returns markdown checklist of test IDs', () => {
    const svc = new E2eTestService();
    const figmaSpecs = [
      { name: 'Save', type: 'button' },
      { name: 'Email', type: 'input' },
    ];
    const list = svc.generateTestIdList(figmaSpecs);
    expect(typeof list).toBe('string');
    expect(list).toContain('- [ ]');
    expect(list).toContain('save-button');
    expect(list).toContain('email-input');
  });

  it('includes element type in the description', () => {
    const svc = new E2eTestService();
    const figmaSpecs = [{ name: 'Submit', type: 'button' }];
    const list = svc.generateTestIdList(figmaSpecs);
    expect(list).toContain('button');
  });

  it('handles empty figmaSpecs', () => {
    const svc = new E2eTestService();
    const list = svc.generateTestIdList([]);
    expect(typeof list).toBe('string');
    expect(list).toContain('Test ID');
  });

  it('starts with a markdown heading', () => {
    const svc = new E2eTestService();
    const list = svc.generateTestIdList([{ name: 'Save', type: 'button' }]);
    expect(list).toMatch(/^## /);
  });
});

// ── 9. E2eTestService.generate ────────────────────────────────────────────────

describe('E2eTestService.generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const task = {
    key: 'PROJ-99',
    summary: 'User Profile',
    acceptanceCriteria: ['User can view profile'],
  };

  it('returns scenarios and files', async () => {
    const svc = new E2eTestService();
    const result = await svc.generate(task, []);
    expect(result).toHaveProperty('scenarios');
    expect(result).toHaveProperty('files');
    expect(Array.isArray(result.scenarios)).toBe(true);
    expect(Array.isArray(result.files)).toBe(true);
  });

  it('creates output directory', async () => {
    const { mkdirSync } = await import('fs');
    const svc = new E2eTestService();
    await svc.generate(task, []);
    expect(mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  it('writes test file', async () => {
    const { writeFileSync } = await import('fs');
    const svc = new E2eTestService();
    await svc.generate(task, []);
    expect(writeFileSync).toHaveBeenCalled();
  });

  it('generates .spec.ts file for playwright framework', async () => {
    const svc = new E2eTestService({ test: { e2e: { framework: 'playwright' } } });
    const result = await svc.generate(task, []);
    expect(result.files.some((f) => f.endsWith('.spec.ts'))).toBe(true);
  });

  it('generates .cy.ts file for cypress framework', async () => {
    const svc = new E2eTestService({ test: { e2e: { framework: 'cypress' } } });
    const result = await svc.generate(task, []);
    expect(result.files.some((f) => f.endsWith('.cy.ts'))).toBe(true);
  });

  it('generates page object when selectors are found from figma', async () => {
    const svc = new E2eTestService();
    const figmaSpecs = [{ name: 'Save', type: 'button' }];
    const result = await svc.generate(task, figmaSpecs);
    expect(result.files.some((f) => f.endsWith('.page.ts'))).toBe(true);
  });

  it('generates test ID list file', async () => {
    const svc = new E2eTestService();
    const figmaSpecs = [{ name: 'Save', type: 'button' }];
    const result = await svc.generate(task, figmaSpecs);
    expect(result.files.some((f) => f.endsWith('.testids.md'))).toBe(true);
  });
});
