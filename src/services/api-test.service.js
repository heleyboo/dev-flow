// Phase 6: API test generation
// Spec: docs/10-API-TESTING.md

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

// ── Pure exported functions ────────────────────────────────────────────────────

/**
 * Extract endpoint patterns from a task.
 * @param {{ description?: string, acceptanceCriteria?: string[] }} task
 * @returns {{ method: string, path: string, description: string }[]}
 */
export function discoverEndpoints(task) {
  const text = [
    task.description ?? '',
    ...(task.acceptanceCriteria ?? []),
  ].join('\n');

  const endpoints = [];
  const seen = new Set();

  // Match: GET/POST/PUT/PATCH/DELETE + /api/path
  const methodPathRe = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/api\/[^\s,;`'")\]]+)/gi;
  let m;
  while ((m = methodPathRe.exec(text)) !== null) {
    const method = m[1].toUpperCase();
    const path = m[2];
    const key = `${method}:${path}`;
    if (!seen.has(key)) {
      seen.add(key);
      endpoints.push({ method, path, description: `${method} ${path}` });
    }
  }

  // Match: "endpoint for X" → infer path from context
  const endpointForRe = /endpoint\s+for\s+([^\s,;.]+(?:\s+[^\s,;.]+){0,3})/gi;
  while ((m = endpointForRe.exec(text)) !== null) {
    const description = m[1].trim();
    // Try to find associated method+path from surrounding text
    const start = Math.max(0, m.index - 100);
    const snippet = text.slice(start, m.index + m[0].length + 100);
    const nearbyMethod = snippet.match(/\b(GET|POST|PUT|PATCH|DELETE)\b/i);
    const nearbyPath = snippet.match(/\/api\/[^\s,;`'")\]]+/);
    if (nearbyMethod && nearbyPath) {
      const method = nearbyMethod[1].toUpperCase();
      const path = nearbyPath[0];
      const key = `${method}:${path}`;
      if (!seen.has(key)) {
        seen.add(key);
        endpoints.push({ method, path, description });
      }
    }
  }

  // Match: "route: /api/X" with optional method
  const routeRe = /route:\s*(\/api\/[^\s,;`'")\]]+)/gi;
  while ((m = routeRe.exec(text)) !== null) {
    const path = m[1];
    // Look for nearby method
    const start = Math.max(0, m.index - 50);
    const snippet = text.slice(start, m.index + m[0].length + 50);
    const nearbyMethod = snippet.match(/\b(GET|POST|PUT|PATCH|DELETE)\b/i);
    const method = nearbyMethod ? nearbyMethod[1].toUpperCase() : 'GET';
    const key = `${method}:${path}`;
    if (!seen.has(key)) {
      seen.add(key);
      endpoints.push({ method, path, description: `${method} ${path}` });
    }
  }

  return endpoints;
}

/**
 * Generate test cases for a given endpoint.
 * @param {{ method: string, path: string, description: string }} endpoint
 * @param {{ acceptanceCriteria?: string[], figma?: { impliedFields?: string[] } }} task
 * @returns {{ name: string, category: string, method: string, path: string, headers: object, body: object|null, expectedStatus: number, expectedBody: object }[]}
 */
export function generateTestCases(endpoint, task) {
  const { method, path } = endpoint;
  const tests = [];

  // Infer required fields from acceptance criteria and figma
  const requiredFields = _inferRequiredFields(task);

  // ── Happy path ────────────────────────────────────────────────────────────
  const successStatus = method === 'POST' ? 201 : 200;
  tests.push({
    name: `returns ${successStatus} with valid request`,
    category: 'happy-path',
    method,
    path,
    headers: { Authorization: 'Bearer {{token}}', 'Content-Type': 'application/json' },
    body: method !== 'GET' && method !== 'DELETE' ? _buildValidBody(requiredFields) : null,
    expectedStatus: successStatus,
    expectedBody: { success: true },
  });

  // ── Auth tests ────────────────────────────────────────────────────────────
  tests.push({
    name: 'returns 401 when no token provided',
    category: 'auth',
    method,
    path,
    headers: { 'Content-Type': 'application/json' },
    body: null,
    expectedStatus: 401,
    expectedBody: { message: 'Unauthenticated.' },
  });

  tests.push({
    name: 'returns 401 when invalid token provided',
    category: 'auth',
    method,
    path,
    headers: { Authorization: 'Bearer invalid_token', 'Content-Type': 'application/json' },
    body: null,
    expectedStatus: 401,
    expectedBody: { message: 'Unauthenticated.' },
  });

  // ── Validation tests ──────────────────────────────────────────────────────
  if (method !== 'GET' && method !== 'DELETE') {
    tests.push({
      name: 'returns 422 when required fields are missing',
      category: 'validation',
      method,
      path,
      headers: { Authorization: 'Bearer {{token}}', 'Content-Type': 'application/json' },
      body: {},
      expectedStatus: 422,
      expectedBody: { message: 'The given data was invalid.' },
    });

    tests.push({
      name: 'returns 422 when fields have invalid formats',
      category: 'validation',
      method,
      path,
      headers: { Authorization: 'Bearer {{token}}', 'Content-Type': 'application/json' },
      body: _buildInvalidFormatBody(requiredFields),
      expectedStatus: 422,
      expectedBody: { message: 'The given data was invalid.' },
    });

    tests.push({
      name: 'returns 422 when max length is exceeded',
      category: 'validation',
      method,
      path,
      headers: { Authorization: 'Bearer {{token}}', 'Content-Type': 'application/json' },
      body: _buildMaxLengthBody(requiredFields),
      expectedStatus: 422,
      expectedBody: { message: 'The given data was invalid.' },
    });
  }

  // ── Edge cases ────────────────────────────────────────────────────────────
  tests.push({
    name: 'returns 404 when resource not found',
    category: 'edge-case',
    method,
    path: path.replace(/\{[^}]+\}/g, '99999'),
    headers: { Authorization: 'Bearer {{token}}', 'Content-Type': 'application/json' },
    body: null,
    expectedStatus: 404,
    expectedBody: { message: 'Not found.' },
  });

  tests.push({
    name: 'returns 403 when access is forbidden',
    category: 'edge-case',
    method,
    path,
    headers: { Authorization: 'Bearer {{other_user_token}}', 'Content-Type': 'application/json' },
    body: null,
    expectedStatus: 403,
    expectedBody: { message: 'Forbidden.' },
  });

  if (method === 'POST') {
    tests.push({
      name: 'returns 409 when duplicate resource',
      category: 'edge-case',
      method,
      path,
      headers: { Authorization: 'Bearer {{token}}', 'Content-Type': 'application/json' },
      body: _buildValidBody(requiredFields),
      expectedStatus: 409,
      expectedBody: { message: 'Conflict.' },
    });
  }

  return tests;
}

/**
 * Generate a VS Code REST Client .http file.
 * @param {{ name: string, method: string, path: string, headers: object, body: object|null, expectedStatus: number }[]} tests
 * @param {{ base_url?: string }} config
 * @returns {string}
 */
export function generateHTTPFile(tests, config = {}) {
  const baseUrl = config.base_url ?? 'http://localhost:8000';
  const lines = [
    `@baseUrl = ${baseUrl}`,
    '@token = your_token_here',
    '',
  ];

  for (const test of tests) {
    lines.push(`### Test: ${test.name}`);
    lines.push(`${test.method} {{baseUrl}}${test.path}`);
    for (const [key, value] of Object.entries(test.headers ?? {})) {
      lines.push(`${key}: ${value}`);
    }
    if (test.body && Object.keys(test.body).length > 0) {
      lines.push('Content-Type: application/json');
      lines.push('');
      lines.push(JSON.stringify(test.body, null, 2));
    }
    lines.push('');
    lines.push('###');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate a Postman collection v2.1 JSON.
 * @param {{ name: string, method: string, path: string, headers: object, body: object|null, expectedStatus: number }[]} tests
 * @param {{ base_url?: string }} config
 * @returns {object}
 */
export function generatePostmanCollection(tests, config = {}) {
  const baseUrl = config.base_url ?? 'http://localhost:8000';

  // Group by endpoint (method + path)
  const groups = new Map();
  for (const test of tests) {
    const key = `${test.method} ${test.path}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(test);
  }

  const items = [];
  for (const [groupName, groupTests] of groups) {
    const folder = {
      name: groupName,
      item: groupTests.map((test) => {
        const rawUrl = `${baseUrl}${test.path}`;
        const headers = Object.entries(test.headers ?? {}).map(([key, value]) => ({ key, value }));

        const item = {
          name: test.name,
          request: {
            method: test.method,
            header: headers,
            url: {
              raw: rawUrl,
              protocol: rawUrl.startsWith('https') ? 'https' : 'http',
              host: [rawUrl.replace(/^https?:\/\//, '').split('/')[0]],
              path: test.path.split('/').filter(Boolean),
            },
          },
          response: [],
        };

        if (test.body && Object.keys(test.body).length > 0) {
          item.request.body = {
            mode: 'raw',
            raw: JSON.stringify(test.body, null, 2),
            options: { raw: { language: 'json' } },
          };
        }

        return item;
      }),
    };
    items.push(folder);
  }

  return {
    info: {
      name: 'DevFlow API Tests',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: items,
    variable: [
      { key: 'baseUrl', value: baseUrl },
      { key: 'token', value: 'your_token_here' },
    ],
  };
}

/**
 * Generate a Vitest test file.
 * @param {{ name: string, method: string, path: string, headers: object, body: object|null, expectedStatus: number }[]} tests
 * @param {{ base_url?: string }} config
 * @returns {string}
 */
export function generateTestScript(tests, config = {}) {
  const baseUrl = config.base_url ?? 'http://localhost:8000';

  // Group by endpoint
  const groups = new Map();
  for (const test of tests) {
    const key = `${test.method} ${test.path}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(test);
  }

  const lines = [
    `import { describe, it, expect } from 'vitest';`,
    '',
    `const BASE_URL = '${baseUrl}';`,
    `const token = process.env.API_TOKEN ?? 'test_token';`,
    '',
  ];

  for (const [groupName, groupTests] of groups) {
    lines.push(`describe('${groupName}', () => {`);
    for (const test of groupTests) {
      lines.push(`  it('${test.name}', async () => {`);
      lines.push(`    const response = await fetch(\`\${BASE_URL}${test.path}\`, {`);
      lines.push(`      method: '${test.method}',`);
      lines.push(`      headers: {`);
      for (const [hKey, hVal] of Object.entries(test.headers ?? {})) {
        if (hVal.includes('{{token}}')) {
          lines.push(`        '${hKey}': \`Bearer \${token}\`,`);
        } else {
          lines.push(`        '${hKey}': '${hVal}',`);
        }
      }
      lines.push(`      },`);
      if (test.body && Object.keys(test.body).length > 0) {
        lines.push(`      body: JSON.stringify(${JSON.stringify(test.body)}),`);
      }
      lines.push(`    });`);
      lines.push(`    expect(response.status).toBe(${test.expectedStatus});`);
      lines.push(`  });`);
      lines.push('');
    }
    lines.push('});');
    lines.push('');
  }

  return lines.join('\n');
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _inferRequiredFields(task) {
  const fields = [];
  const text = [
    ...(task.acceptanceCriteria ?? []),
    task.figma?.impliedFields?.join(' ') ?? '',
  ].join(' ').toLowerCase();

  if (text.includes('email')) fields.push('email');
  if (text.includes('password')) fields.push('password');
  if (text.includes('name')) fields.push('name');
  if (text.includes('title')) fields.push('title');
  if (text.includes('phone')) fields.push('phone');

  return fields.length > 0 ? fields : ['name', 'email'];
}

function _buildValidBody(fields) {
  const body = {};
  for (const field of fields) {
    if (field === 'email') body[field] = 'test@example.com';
    else if (field === 'password') body[field] = 'Password123!';
    else if (field === 'phone') body[field] = '+1234567890';
    else body[field] = `test_${field}`;
  }
  return body;
}

function _buildInvalidFormatBody(fields) {
  const body = {};
  for (const field of fields) {
    if (field === 'email') body[field] = 'not-an-email';
    else if (field === 'password') body[field] = '123'; // too short
    else if (field === 'phone') body[field] = 'not-a-phone';
    else body[field] = 123; // wrong type
  }
  return body;
}

function _buildMaxLengthBody(fields) {
  const body = {};
  const longString = 'a'.repeat(256);
  for (const field of fields) {
    body[field] = longString;
  }
  return body;
}

// ── ApiTestService class ──────────────────────────────────────────────────────

export class ApiTestService {
  constructor(config) {
    this.config = config ?? {};
    this.baseUrl = this.config.test?.base_url ?? 'http://localhost:8000';
    this.authType = this.config.test?.auth_type ?? 'bearer';
  }

  /**
   * Generate test artifacts for a task.
   * @param {object} task
   * @param {{ format?: string }} options
   * @returns {{ endpoints: object[], testCases: object[], files: string[] }}
   */
  async generate(task, options = {}) {
    const format = options.format ?? 'all';

    // 1. Discover endpoints
    const endpoints = discoverEndpoints(task);

    // 2. Generate test cases for each endpoint
    const testCases = [];
    for (const endpoint of endpoints) {
      const cases = generateTestCases(endpoint, task);
      testCases.push(...cases);
    }

    // 3. Prepare output directory
    const outputDir = resolve('.devflow/tests');
    mkdirSync(outputDir, { recursive: true });

    const files = [];
    const serviceConfig = { base_url: this.baseUrl, auth_type: this.authType };
    const taskKey = task.key ?? 'task';

    // 4. Generate and save files based on format
    if (format === 'all' || format === 'http') {
      const httpContent = generateHTTPFile(testCases, serviceConfig);
      const httpFile = resolve(outputDir, `${taskKey}.http`);
      writeFileSync(httpFile, httpContent, 'utf-8');
      files.push(httpFile);
    }

    if (format === 'all' || format === 'postman') {
      const postmanContent = generatePostmanCollection(testCases, serviceConfig);
      const postmanFile = resolve(outputDir, `${taskKey}.postman_collection.json`);
      writeFileSync(postmanFile, JSON.stringify(postmanContent, null, 2), 'utf-8');
      files.push(postmanFile);
    }

    if (format === 'all' || format === 'vitest') {
      const vitestContent = generateTestScript(testCases, serviceConfig);
      const vitestFile = resolve(outputDir, `${taskKey}.test.js`);
      writeFileSync(vitestFile, vitestContent, 'utf-8');
      files.push(vitestFile);
    }

    return { endpoints, testCases, files };
  }

  /**
   * Run tests using npx vitest.
   * @param {string} testFile
   * @returns {{ passed: number, failed: number, total: number, output: string }}
   */
  async runTests(testFile) {
    let output = '';
    let passed = 0;
    let failed = 0;
    let total = 0;

    try {
      output = execSync(`npx vitest run ${testFile}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (err) {
      output = err.stdout ?? err.message ?? '';
    }

    // Parse vitest output: "Tests N passed" / "N failed"
    const passedMatch = output.match(/(\d+)\s+passed/);
    const failedMatch = output.match(/(\d+)\s+failed/);
    const totalMatch = output.match(/Tests\s+(\d+)/);

    if (passedMatch) passed = parseInt(passedMatch[1], 10);
    if (failedMatch) failed = parseInt(failedMatch[1], 10);
    if (totalMatch) total = parseInt(totalMatch[1], 10);
    if (total === 0) total = passed + failed;

    return { passed, failed, total, output };
  }
}
