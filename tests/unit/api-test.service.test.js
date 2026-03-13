import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  discoverEndpoints,
  generateTestCases,
  generateHTTPFile,
  generatePostmanCollection,
  generateTestScript,
  ApiTestService,
} from '../../src/services/api-test.service.js';

// ── Mock fs ───────────────────────────────────────────────────────────────────

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return { ...actual, writeFileSync: vi.fn(), mkdirSync: vi.fn() };
});

// ── 1. discoverEndpoints: from description ────────────────────────────────────

describe('discoverEndpoints', () => {
  it('extracts endpoints from task description', () => {
    const task = {
      description: 'Create a GET /api/users/{id}/profile endpoint to return user data.',
      acceptanceCriteria: [],
    };
    const endpoints = discoverEndpoints(task);
    expect(endpoints.length).toBeGreaterThan(0);
    const ep = endpoints[0];
    expect(ep.method).toBe('GET');
    expect(ep.path).toContain('/api/users');
  });

  it('extracts multiple endpoints from description', () => {
    const task = {
      description: `
        POST /api/users to create a user.
        GET /api/users/{id} to get user details.
        DELETE /api/users/{id} to remove a user.
      `,
      acceptanceCriteria: [],
    };
    const endpoints = discoverEndpoints(task);
    expect(endpoints.length).toBe(3);
    const methods = endpoints.map((e) => e.method);
    expect(methods).toContain('POST');
    expect(methods).toContain('GET');
    expect(methods).toContain('DELETE');
  });

  it('extracts endpoints from acceptance criteria', () => {
    const task = {
      description: '',
      acceptanceCriteria: [
        'The POST /api/orders endpoint must accept JSON body with items array.',
        'GET /api/orders/{id} must return order details.',
      ],
    };
    const endpoints = discoverEndpoints(task);
    expect(endpoints.length).toBe(2);
    expect(endpoints[0].method).toBe('POST');
    expect(endpoints[0].path).toContain('/api/orders');
    expect(endpoints[1].method).toBe('GET');
  });

  it('extracts route: /api/x patterns', () => {
    const task = {
      description: 'Create route: /api/products for GET requests.',
      acceptanceCriteria: [],
    };
    const endpoints = discoverEndpoints(task);
    expect(endpoints.length).toBeGreaterThan(0);
    expect(endpoints[0].path).toContain('/api/products');
  });

  it('deduplicates identical endpoints', () => {
    const task = {
      description: 'GET /api/users returns list. Also GET /api/users should be paginated.',
      acceptanceCriteria: [],
    };
    const endpoints = discoverEndpoints(task);
    const keys = endpoints.map((e) => `${e.method}:${e.path}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('returns empty array when no endpoints found', () => {
    const task = { description: 'No endpoints here.', acceptanceCriteria: [] };
    const endpoints = discoverEndpoints(task);
    expect(Array.isArray(endpoints)).toBe(true);
    expect(endpoints.length).toBe(0);
  });

  it('returns objects with method, path, description', () => {
    const task = {
      description: 'Build PUT /api/items/{id} to update an item.',
      acceptanceCriteria: [],
    };
    const endpoints = discoverEndpoints(task);
    expect(endpoints.length).toBeGreaterThan(0);
    endpoints.forEach((ep) => {
      expect(ep).toHaveProperty('method');
      expect(ep).toHaveProperty('path');
      expect(ep).toHaveProperty('description');
    });
  });

  it('handles missing fields gracefully', () => {
    expect(() => discoverEndpoints({})).not.toThrow();
    expect(discoverEndpoints({})).toEqual([]);
  });
});

// ── 2. generateTestCases ──────────────────────────────────────────────────────

describe('generateTestCases', () => {
  const endpoint = { method: 'POST', path: '/api/users', description: 'Create user' };
  const task = {
    acceptanceCriteria: ['User must provide name and email'],
    figma: null,
  };

  it('generates happy path tests', () => {
    const cases = generateTestCases(endpoint, task);
    const happyPath = cases.filter((c) => c.category === 'happy-path');
    expect(happyPath.length).toBeGreaterThan(0);
    // POST → 201
    expect(happyPath[0].expectedStatus).toBe(201);
  });

  it('generates happy path 200 for GET endpoint', () => {
    const getEndpoint = { method: 'GET', path: '/api/users/1', description: 'Get user' };
    const cases = generateTestCases(getEndpoint, task);
    const happyPath = cases.filter((c) => c.category === 'happy-path');
    expect(happyPath[0].expectedStatus).toBe(200);
  });

  it('generates auth tests', () => {
    const cases = generateTestCases(endpoint, task);
    const authTests = cases.filter((c) => c.category === 'auth');
    expect(authTests.length).toBeGreaterThanOrEqual(2);
    const statuses = authTests.map((c) => c.expectedStatus);
    expect(statuses).toContain(401);
  });

  it('auth test without token has no Authorization header', () => {
    const cases = generateTestCases(endpoint, task);
    const noTokenTest = cases.find(
      (c) => c.category === 'auth' && c.name.includes('no token')
    );
    expect(noTokenTest).toBeDefined();
    expect(noTokenTest.headers.Authorization).toBeUndefined();
  });

  it('auth test with invalid token has Authorization header', () => {
    const cases = generateTestCases(endpoint, task);
    const invalidTokenTest = cases.find(
      (c) => c.category === 'auth' && c.name.includes('invalid token')
    );
    expect(invalidTokenTest).toBeDefined();
    expect(invalidTokenTest.headers.Authorization).toContain('Bearer');
  });

  it('generates validation tests', () => {
    const cases = generateTestCases(endpoint, task);
    const validationTests = cases.filter((c) => c.category === 'validation');
    expect(validationTests.length).toBeGreaterThanOrEqual(3);
    const statuses = validationTests.map((c) => c.expectedStatus);
    statuses.forEach((s) => expect(s).toBe(422));
  });

  it('skips validation tests for GET endpoint', () => {
    const getEndpoint = { method: 'GET', path: '/api/users', description: 'List users' };
    const cases = generateTestCases(getEndpoint, task);
    const validationTests = cases.filter((c) => c.category === 'validation');
    expect(validationTests.length).toBe(0);
  });

  it('generates edge case tests', () => {
    const cases = generateTestCases(endpoint, task);
    const edgeCases = cases.filter((c) => c.category === 'edge-case');
    expect(edgeCases.length).toBeGreaterThan(0);
    const statuses = edgeCases.map((c) => c.expectedStatus);
    expect(statuses).toContain(404);
    expect(statuses).toContain(403);
    expect(statuses).toContain(409);
  });

  it('returns array of test case objects with required fields', () => {
    const cases = generateTestCases(endpoint, task);
    expect(Array.isArray(cases)).toBe(true);
    cases.forEach((c) => {
      expect(c).toHaveProperty('name');
      expect(c).toHaveProperty('category');
      expect(c).toHaveProperty('method');
      expect(c).toHaveProperty('path');
      expect(c).toHaveProperty('headers');
      expect(c).toHaveProperty('expectedStatus');
      expect(c).toHaveProperty('expectedBody');
    });
  });

  it('infers required fields from acceptance criteria', () => {
    const richTask = {
      acceptanceCriteria: ['User must provide email and password'],
    };
    const cases = generateTestCases(endpoint, richTask);
    const happyPath = cases.find((c) => c.category === 'happy-path');
    expect(happyPath.body).toHaveProperty('email');
    expect(happyPath.body).toHaveProperty('password');
  });
});

// ── 3. generateHTTPFile ───────────────────────────────────────────────────────

describe('generateHTTPFile', () => {
  const tests = [
    {
      name: 'returns 200 with valid profile',
      method: 'GET',
      path: '/api/users/1/profile',
      headers: { Authorization: 'Bearer {{token}}' },
      body: null,
      expectedStatus: 200,
    },
    {
      name: 'returns 401 when no token',
      method: 'GET',
      path: '/api/users/1/profile',
      headers: {},
      body: null,
      expectedStatus: 401,
    },
  ];

  it('generates valid .http format with ### separators', () => {
    const content = generateHTTPFile(tests, { base_url: 'http://localhost:8000' });
    expect(typeof content).toBe('string');
    expect(content).toContain('### Test:');
    expect(content).toContain('###');
  });

  it('includes base URL variable', () => {
    const content = generateHTTPFile(tests, { base_url: 'http://localhost:8000' });
    expect(content).toContain('@baseUrl = http://localhost:8000');
  });

  it('includes method and path', () => {
    const content = generateHTTPFile(tests, {});
    expect(content).toContain('GET {{baseUrl}}/api/users/1/profile');
  });

  it('includes Authorization header when present', () => {
    const content = generateHTTPFile(tests, {});
    expect(content).toContain('Authorization: Bearer {{token}}');
  });

  it('includes test names in comments', () => {
    const content = generateHTTPFile(tests, {});
    expect(content).toContain('returns 200 with valid profile');
    expect(content).toContain('returns 401 when no token');
  });

  it('includes request body for POST requests', () => {
    const postTests = [
      {
        name: 'create user',
        method: 'POST',
        path: '/api/users',
        headers: { Authorization: 'Bearer {{token}}', 'Content-Type': 'application/json' },
        body: { name: 'John', email: 'john@example.com' },
        expectedStatus: 201,
      },
    ];
    const content = generateHTTPFile(postTests, {});
    expect(content).toContain('john@example.com');
  });

  it('uses default base_url when not provided', () => {
    const content = generateHTTPFile(tests);
    expect(content).toContain('@baseUrl = http://localhost:8000');
  });
});

// ── 4. generatePostmanCollection ─────────────────────────────────────────────

describe('generatePostmanCollection', () => {
  const tests = [
    {
      name: 'returns 201 with valid data',
      method: 'POST',
      path: '/api/orders',
      headers: { Authorization: 'Bearer {{token}}', 'Content-Type': 'application/json' },
      body: { item: 'Widget', quantity: 1 },
      expectedStatus: 201,
    },
    {
      name: 'returns 401 when no token',
      method: 'POST',
      path: '/api/orders',
      headers: {},
      body: null,
      expectedStatus: 401,
    },
  ];

  it('generates valid Postman collection JSON structure', () => {
    const collection = generatePostmanCollection(tests, { base_url: 'http://localhost:8000' });
    expect(collection).toHaveProperty('info');
    expect(collection).toHaveProperty('item');
    expect(collection.info.schema).toContain('v2.1');
  });

  it('groups tests by endpoint', () => {
    const collection = generatePostmanCollection(tests, {});
    expect(collection.item.length).toBe(1); // both tests are for the same endpoint
    expect(collection.item[0].name).toContain('/api/orders');
    expect(collection.item[0].item.length).toBe(2);
  });

  it('includes variables for baseUrl and token', () => {
    const collection = generatePostmanCollection(tests, { base_url: 'http://localhost:8000' });
    expect(collection.variable).toBeDefined();
    const keys = collection.variable.map((v) => v.key);
    expect(keys).toContain('baseUrl');
    expect(keys).toContain('token');
  });

  it('includes request method and url', () => {
    const collection = generatePostmanCollection(tests, {});
    const folder = collection.item[0];
    const request = folder.item[0].request;
    expect(request.method).toBe('POST');
    expect(request.url.raw).toContain('/api/orders');
  });

  it('includes request body for POST requests', () => {
    const collection = generatePostmanCollection(tests, {});
    const folder = collection.item[0];
    const bodyTest = folder.item.find((i) => i.name.includes('valid data'));
    expect(bodyTest.request.body).toBeDefined();
    expect(bodyTest.request.body.raw).toContain('Widget');
  });

  it('groups different endpoints into separate folders', () => {
    const multiTests = [
      { name: 'test1', method: 'GET', path: '/api/users', headers: {}, body: null, expectedStatus: 200 },
      { name: 'test2', method: 'POST', path: '/api/orders', headers: {}, body: null, expectedStatus: 201 },
    ];
    const collection = generatePostmanCollection(multiTests, {});
    expect(collection.item.length).toBe(2);
  });
});

// ── 5. generateTestScript ─────────────────────────────────────────────────────

describe('generateTestScript', () => {
  const tests = [
    {
      name: 'returns 200 with valid profile',
      method: 'GET',
      path: '/api/users/1/profile',
      headers: { Authorization: 'Bearer {{token}}' },
      body: null,
      expectedStatus: 200,
    },
    {
      name: 'returns 401 when no token',
      method: 'GET',
      path: '/api/users/1/profile',
      headers: {},
      body: null,
      expectedStatus: 401,
    },
  ];

  it('generates valid vitest code with describe and it blocks', () => {
    const script = generateTestScript(tests, { base_url: 'http://localhost:8000' });
    expect(typeof script).toBe('string');
    expect(script).toContain("describe('");
    expect(script).toContain("it('");
  });

  it('imports from vitest', () => {
    const script = generateTestScript(tests, {});
    expect(script).toContain("from 'vitest'");
  });

  it('uses fetch for HTTP requests', () => {
    const script = generateTestScript(tests, {});
    expect(script).toContain('fetch(');
  });

  it('asserts response.status', () => {
    const script = generateTestScript(tests, {});
    expect(script).toContain('expect(response.status).toBe(200)');
    expect(script).toContain('expect(response.status).toBe(401)');
  });

  it('groups tests by endpoint using describe', () => {
    const script = generateTestScript(tests, {});
    expect(script).toContain("describe('GET /api/users/1/profile'");
  });

  it('uses BASE_URL constant', () => {
    const script = generateTestScript(tests, { base_url: 'http://localhost:9000' });
    expect(script).toContain("const BASE_URL = 'http://localhost:9000'");
  });

  it('includes test names in it() descriptions', () => {
    const script = generateTestScript(tests, {});
    expect(script).toContain("it('returns 200 with valid profile'");
    expect(script).toContain("it('returns 401 when no token'");
  });

  it('includes body for POST requests', () => {
    const postTests = [
      {
        name: 'creates user',
        method: 'POST',
        path: '/api/users',
        headers: { Authorization: 'Bearer {{token}}', 'Content-Type': 'application/json' },
        body: { name: 'Alice', email: 'alice@example.com' },
        expectedStatus: 201,
      },
    ];
    const script = generateTestScript(postTests, {});
    expect(script).toContain('alice@example.com');
    expect(script).toContain('JSON.stringify');
  });
});

// ── 6. ApiTestService constructor ─────────────────────────────────────────────

describe('ApiTestService constructor', () => {
  it('uses default base_url when config not provided', () => {
    const svc = new ApiTestService();
    expect(svc.baseUrl).toBe('http://localhost:8000');
  });

  it('uses config.test.base_url when provided', () => {
    const svc = new ApiTestService({ test: { base_url: 'https://api.example.com' } });
    expect(svc.baseUrl).toBe('https://api.example.com');
  });

  it('uses default auth_type bearer when not set', () => {
    const svc = new ApiTestService();
    expect(svc.authType).toBe('bearer');
  });

  it('uses config.test.auth_type when provided', () => {
    const svc = new ApiTestService({ test: { auth_type: 'api-key' } });
    expect(svc.authType).toBe('api-key');
  });
});

// ── 7. ApiTestService.generate ────────────────────────────────────────────────

describe('ApiTestService.generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const task = {
    key: 'PROJ-100',
    summary: 'User profile API',
    description: 'Implement GET /api/users/{id}/profile and POST /api/users endpoints.',
    acceptanceCriteria: ['GET /api/users/{id}/profile returns user data'],
  };

  it('returns endpoints, testCases, and files', async () => {
    const svc = new ApiTestService();
    const result = await svc.generate(task);
    expect(result).toHaveProperty('endpoints');
    expect(result).toHaveProperty('testCases');
    expect(result).toHaveProperty('files');
    expect(Array.isArray(result.endpoints)).toBe(true);
    expect(Array.isArray(result.testCases)).toBe(true);
    expect(Array.isArray(result.files)).toBe(true);
  });

  it('generates 3 files by default (http, postman, vitest)', async () => {
    const svc = new ApiTestService();
    const result = await svc.generate(task);
    expect(result.files.length).toBe(3);
  });

  it('generates only http file when format=http', async () => {
    const svc = new ApiTestService();
    const result = await svc.generate(task, { format: 'http' });
    expect(result.files.length).toBe(1);
    expect(result.files[0]).toContain('.http');
  });

  it('generates only postman file when format=postman', async () => {
    const svc = new ApiTestService();
    const result = await svc.generate(task, { format: 'postman' });
    expect(result.files.length).toBe(1);
    expect(result.files[0]).toContain('.postman_collection.json');
  });

  it('generates only vitest file when format=vitest', async () => {
    const svc = new ApiTestService();
    const result = await svc.generate(task, { format: 'vitest' });
    expect(result.files.length).toBe(1);
    expect(result.files[0]).toContain('.test.js');
  });

  it('saves files to .devflow/tests/', async () => {
    const { mkdirSync, writeFileSync } = await import('fs');
    const svc = new ApiTestService();
    await svc.generate(task);
    expect(mkdirSync).toHaveBeenCalledWith(expect.stringContaining('.devflow/tests'), { recursive: true });
    expect(writeFileSync).toHaveBeenCalled();
  });

  it('discovers endpoints from task', async () => {
    const svc = new ApiTestService();
    const result = await svc.generate(task);
    expect(result.endpoints.length).toBeGreaterThan(0);
  });

  it('generates test cases for each endpoint', async () => {
    const svc = new ApiTestService();
    const result = await svc.generate(task);
    expect(result.testCases.length).toBeGreaterThan(0);
  });
});
