// Phase 6: E2E test generation
// Spec: docs/11-E2E-TESTING.md

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

// ── Pure exported functions ────────────────────────────────────────────────────

/**
 * Parse acceptance criteria strings into structured test scenarios.
 * @param {string[]} criteria
 * @returns {{ name: string, steps: string[], expectedResult: string }[]}
 */
export function parseAcceptanceCriteria(criteria) {
  if (!Array.isArray(criteria) || criteria.length === 0) return [];

  return criteria.map((ac) => {
    const trimmed = ac.trim();

    // Given/When/Then format
    if (/\b(given|when|then)\b/i.test(trimmed)) {
      return _parseGivenWhenThen(trimmed);
    }

    // "User can X" / "User should X" patterns
    const canMatch = trimmed.match(/^User\s+(can|should|must|is able to)\s+(.+)$/i);
    if (canMatch) {
      const action = canMatch[2].replace(/\.$/, '');
      return {
        name: trimmed.replace(/\.$/, ''),
        steps: [`do ${action}`],
        expectedResult: `${action} works`,
      };
    }

    // Generic fallback
    return {
      name: trimmed.replace(/\.$/, ''),
      steps: [trimmed],
      expectedResult: `${trimmed} is satisfied`,
    };
  });
}

/**
 * Map Figma component specs to data-testid selectors.
 * @param {object[]} figmaSpecs - Array of Figma component nodes
 * @returns {{ name: string, selector: string, elementType: string }[]}
 */
export function mapFigmaToSelectors(figmaSpecs) {
  if (!figmaSpecs || !Array.isArray(figmaSpecs)) return [];

  const selectors = [];
  const seen = new Set();

  for (const spec of figmaSpecs) {
    _extractSelectors(spec, selectors, seen);
  }

  return selectors;
}

/**
 * Generate complete test scenarios combining AC parsing and Figma selectors.
 * @param {object} task - Jira task with summary, acceptanceCriteria, etc.
 * @param {object[]} figmaSpecs - Array of Figma component nodes
 * @param {{ mobile?: boolean }} options
 * @returns {object[]}
 */
export function generateScenarios(task, figmaSpecs, options = {}) {
  const acCriteria = task?.acceptanceCriteria ?? [];
  const scenarios = parseAcceptanceCriteria(acCriteria);
  const selectors = mapFigmaToSelectors(figmaSpecs ?? []);

  // Attach relevant selectors to each scenario
  const enriched = scenarios.map((scenario) => ({
    ...scenario,
    selectors,
  }));

  // Add auth check scenario
  enriched.push({
    name: 'Unauthenticated user is redirected to login',
    steps: ['visit page without authentication'],
    expectedResult: 'redirected to login page',
    selectors,
    isAuthCheck: true,
  });

  // Add responsive check if mobile option
  if (options.mobile) {
    enriched.push({
      name: 'Page is responsive on mobile viewport',
      steps: ['resize viewport to mobile dimensions', 'visit page'],
      expectedResult: 'page renders correctly on mobile',
      selectors,
      isMobileCheck: true,
    });
  }

  return enriched;
}

// ── E2eTestService class ──────────────────────────────────────────────────────

export class E2eTestService {
  constructor(config) {
    this.config = config ?? {};
    const e2e = this.config.test?.e2e ?? {};
    this.framework = e2e.framework ?? 'playwright';
    this.language = e2e.language ?? 'typescript';
    this.baseUrl = e2e.base_url ?? 'http://localhost:3000';
    this.outputDir = e2e.output_dir ?? 'tests/e2e';
    this.viewport = e2e.viewport ?? null;
    this.auth = e2e.auth ?? null;
  }

  /**
   * Generate a Playwright test file string.
   * @param {object[]} scenarios
   * @param {object} options
   * @returns {string}
   */
  generatePlaywrightTest(scenarios, options = {}) {
    const task = options.task ?? { summary: 'Feature' };
    const hasAuth = !!(this.auth || options.auth);
    const hasSelectors = scenarios.some((s) => s.selectors && s.selectors.length > 0);

    const lines = [];

    lines.push(`import { test, expect } from '@playwright/test';`);
    if (hasSelectors) {
      lines.push(`// Page Object imports would go here`);
    }
    lines.push('');
    lines.push(`test.describe('Feature: ${task.summary}', () => {`);

    // beforeEach
    lines.push(`  test.beforeEach(async ({ page }) => {`);
    if (hasAuth) {
      const loginUrl = this.auth?.login_url ?? '/login';
      const username = this.auth?.username ?? '{{username}}';
      const password = this.auth?.password ?? '{{password}}';
      lines.push(`    // Login`);
      lines.push(`    await page.goto('${loginUrl}');`);
      lines.push(`    await page.fill('[name="email"]', '${username}');`);
      lines.push(`    await page.fill('[name="password"]', '${password}');`);
      lines.push(`    await page.click('[type="submit"]');`);
    } else {
      lines.push(`    // Setup`);
    }
    lines.push(`  });`);
    lines.push('');

    // Generate test cases for each scenario
    for (const scenario of scenarios) {
      lines.push(`  test('${scenario.name}', async ({ page }) => {`);
      lines.push(`    await page.goto('${this.baseUrl}');`);
      for (const step of scenario.steps ?? []) {
        lines.push(`    // ${step}`);
      }
      lines.push(`    // Expected: ${scenario.expectedResult}`);
      lines.push(`    expect(await page.title()).toBeTruthy();`);
      lines.push(`  });`);
      lines.push('');
    }

    // Add mobile viewport tests if option enabled
    if (options.mobile) {
      lines.push(`  test.describe('Mobile viewport', () => {`);
      lines.push(`    test.use({ viewport: { width: 375, height: 667 } });`);
      lines.push('');
      lines.push(`    test('renders correctly on mobile', async ({ page }) => {`);
      lines.push(`      await page.goto('${this.baseUrl}');`);
      lines.push(`      expect(await page.title()).toBeTruthy();`);
      lines.push(`    });`);
      lines.push(`  });`);
      lines.push('');
    }

    lines.push('});');

    return lines.join('\n');
  }

  /**
   * Generate a Cypress test file string.
   * @param {object[]} scenarios
   * @param {object} options
   * @returns {string}
   */
  generateCypressTest(scenarios, options = {}) {
    const task = options.task ?? { summary: 'Feature' };
    const hasAuth = !!(this.auth || options.auth);

    const lines = [];

    lines.push(`describe('Feature: ${task.summary}', () => {`);
    lines.push(`  beforeEach(() => {`);
    if (hasAuth) {
      lines.push(`    cy.login();`);
    } else {
      lines.push(`    // Setup`);
    }
    lines.push(`  });`);
    lines.push('');

    for (const scenario of scenarios) {
      lines.push(`  it('${scenario.name}', () => {`);
      lines.push(`    cy.visit('${this.baseUrl}');`);
      for (const step of scenario.steps ?? []) {
        lines.push(`    // ${step}`);
      }
      lines.push(`    // Expected: ${scenario.expectedResult}`);
      lines.push(`    cy.title().should('not.be.empty');`);
      lines.push(`  });`);
      lines.push('');
    }

    lines.push('});');

    return lines.join('\n');
  }

  /**
   * Generate a Page Object Model class.
   * @param {{ name: string, selector: string, elementType: string }[]} selectors
   * @param {string} pageName
   * @returns {string}
   */
  generatePageObject(selectors, pageName) {
    const className = `${_toPascalCase(pageName)}Page`;

    const lines = [];
    lines.push(`export class ${className} {`);

    for (const sel of selectors ?? []) {
      const propName = _toCamelCase(sel.name);
      lines.push(`  readonly ${propName} = '${sel.selector}';`);
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Generate a markdown checklist of all data-testid attributes needed.
   * @param {object[]} figmaSpecs
   * @returns {string}
   */
  generateTestIdList(figmaSpecs) {
    const selectors = mapFigmaToSelectors(figmaSpecs ?? []);

    if (selectors.length === 0) {
      return '## Test IDs\n\nNo test IDs generated.';
    }

    const lines = ['## Test IDs', ''];
    for (const sel of selectors) {
      const testId = sel.selector.replace(/^\[data-testid="(.+)"\]$/, '$1');
      lines.push(`- [ ] \`${testId}\` — ${sel.name} (${sel.elementType})`);
    }

    return lines.join('\n');
  }

  /**
   * Orchestrate E2E test generation.
   * @param {object} task
   * @param {object[]} figmaSpecs
   * @param {object} options
   * @returns {{ scenarios: object[], files: string[] }}
   */
  async generate(task, figmaSpecs, options = {}) {
    const scenarios = generateScenarios(task, figmaSpecs, options);
    const selectors = mapFigmaToSelectors(figmaSpecs ?? []);

    const outputDir = resolve(this.outputDir);
    mkdirSync(outputDir, { recursive: true });

    const files = [];
    const taskKey = task?.key ?? 'task';

    const testOptions = { ...options, task };

    // Generate test file based on framework
    let testContent;
    let testFileName;
    if (this.framework === 'cypress') {
      testContent = this.generateCypressTest(scenarios, testOptions);
      testFileName = `${taskKey}.cy.ts`;
    } else {
      testContent = this.generatePlaywrightTest(scenarios, testOptions);
      testFileName = `${taskKey}.spec.ts`;
    }

    const testFile = resolve(outputDir, testFileName);
    writeFileSync(testFile, testContent, 'utf-8');
    files.push(testFile);

    // Generate page object if we have selectors
    if (selectors.length > 0) {
      const pageName = task?.summary ?? 'Page';
      const pageObjectContent = this.generatePageObject(selectors, pageName);
      const pageObjectFile = resolve(outputDir, `${taskKey}.page.ts`);
      writeFileSync(pageObjectFile, pageObjectContent, 'utf-8');
      files.push(pageObjectFile);
    }

    // Generate test ID list
    const testIdList = this.generateTestIdList(figmaSpecs ?? []);
    const testIdFile = resolve(outputDir, `${taskKey}.testids.md`);
    writeFileSync(testIdFile, testIdList, 'utf-8');
    files.push(testIdFile);

    return { scenarios, files };
  }

  /**
   * Run E2E tests using playwright or cypress.
   * @param {object} options
   * @returns {{ output: string, exitCode: number }}
   */
  async runTests(options = {}) {
    const file = options.file ?? '';
    let cmd;

    if (this.framework === 'cypress') {
      cmd = `npx cypress run${file ? ` --spec ${file}` : ''}`;
    } else {
      cmd = `npx playwright test${file ? ` ${file}` : ''} --reporter=list`;
    }

    if (options.headed) {
      cmd += ' --headed';
    }

    let output = '';
    let exitCode = 0;

    try {
      output = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
    } catch (err) {
      output = err.stdout ?? err.message ?? '';
      exitCode = err.status ?? 1;
    }

    return { output, exitCode };
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _parseGivenWhenThen(text) {
  const steps = [];
  let expectedResult = '';
  let name = text.replace(/\.$/, '');

  // Extract Given/When/Then clauses
  const givenMatch = text.match(/\bGiven\s+(.+?)(?=\bWhen\b|\bThen\b|$)/i);
  const whenMatch = text.match(/\bWhen\s+(.+?)(?=\bThen\b|$)/i);
  const thenMatch = text.match(/\bThen\s+(.+?)(?=\bAnd\b|$)/i);

  if (givenMatch) steps.push(`Given ${givenMatch[1].trim()}`);
  if (whenMatch) steps.push(`When ${whenMatch[1].trim()}`);
  if (thenMatch) {
    expectedResult = thenMatch[1].trim();
    name = thenMatch[1].trim();
  }

  if (steps.length === 0) steps.push(text);
  if (!expectedResult) expectedResult = text;

  return { name, steps, expectedResult };
}

function _extractSelectors(node, selectors, seen) {
  if (!node || typeof node !== 'object') return;

  const name = node.name ?? node.label ?? '';
  const type = (node.type ?? node.componentType ?? '').toLowerCase();

  if (name) {
    const selector = _inferSelector(name, type);
    if (selector && !seen.has(selector.selector)) {
      seen.add(selector.selector);
      selectors.push(selector);
    }
  }

  // Recurse into children
  const children = node.children ?? node.components ?? [];
  if (Array.isArray(children)) {
    for (const child of children) {
      _extractSelectors(child, selectors, seen);
    }
  }
}

function _inferSelector(name, type) {
  const lowerType = type.toLowerCase();
  const lowerName = name.toLowerCase().trim();

  let elementType;

  if (lowerType.includes('button') || lowerName.includes('button') || lowerName.includes('btn') || lowerName.includes('submit') || lowerName.includes('save') || lowerName.includes('cancel') || lowerName.includes('delete') || lowerName.includes('create') || lowerName.includes('update')) {
    elementType = 'button';
  } else if (lowerType.includes('input') || lowerName.includes('input') || lowerName.includes('field') || lowerName.includes('name') || lowerName.includes('email') || lowerName.includes('password') || lowerName.includes('phone') || lowerName.includes('address') || lowerName.includes('text')) {
    elementType = 'input';
  } else if (lowerType.includes('form') || lowerName.includes('form')) {
    elementType = 'form';
  } else if (lowerType.includes('link') || lowerName.includes('link')) {
    elementType = 'link';
  } else if (lowerType.includes('list') || lowerName.includes('list')) {
    elementType = 'list';
  } else if (lowerType.includes('modal') || lowerName.includes('modal') || lowerName.includes('dialog')) {
    elementType = 'modal';
  } else if (lowerType.includes('select') || lowerName.includes('select') || lowerName.includes('dropdown')) {
    elementType = 'select';
  } else if (lowerType.includes('checkbox') || lowerName.includes('checkbox')) {
    elementType = 'checkbox';
  } else {
    // Skip nodes we can't categorize
    return null;
  }

  const sanitized = _sanitizeName(name);
  const testId = `${sanitized}-${elementType}`;
  const selector = `[data-testid="${testId}"]`;

  return { name, selector, elementType };
}

function _sanitizeName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function _toPascalCase(str) {
  return str
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function _toCamelCase(str) {
  const pascal = _toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
