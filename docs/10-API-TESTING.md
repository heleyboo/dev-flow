# Feature 8: API Testing

## 10.1 Mục tiêu

Tự động generate API test cases từ Jira task + Figma specs + backend code. Hỗ trợ nhiều format: HTTP files (VS Code REST Client), Postman collections, và test scripts chạy được (vitest/jest hoặc PHPUnit).

## 10.2 Commands

### `devflow test:api <JIRA-ID>`

Generate API test suite cho task.

```bash
$ devflow test:api PROJ-456

🔍 Analyzing PROJ-456...
📡 Discovering API endpoints...
🧪 Generating test cases...

╔══════════════════════════════════════════════════════╗
║  API Tests Generated for PROJ-456                    ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  Endpoints found: 3                                  ║
║    GET  /api/users/{id}/profile                      ║
║    PUT  /api/users/{id}/profile                      ║
║    POST /api/users/{id}/profile/avatar               ║
║                                                      ║
║  Test cases generated: 18                            ║
║    ✅ Happy path: 3                                  ║
║    🔒 Auth tests: 3                                  ║
║    ❌ Validation tests: 8                            ║
║    🔥 Edge cases: 4                                  ║
║                                                      ║
║  Output files:                                       ║
║    .devflow/tests/PROJ-456.http                      ║
║    .devflow/tests/PROJ-456.postman.json              ║
║    .devflow/tests/PROJ-456.test.ts                   ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
```

**Options:**
- `--format http|postman|jest|phpunit|all` — Output format (default: all)
- `--base-url <url>` — API base URL (default: from config)
- `--auth <type>` — Auth type: bearer, basic, none (default: from config)
- `--run` — Immediately run generated tests
- `--watch` — Run in watch mode
- `--coverage` — Include coverage report
- `--only happy|auth|validation|edge` — Generate specific category only

### `devflow test:api run [file]`

Chạy API tests.

```bash
$ devflow test:api run

🧪 Running API tests for PROJ-456...
═══════════════════════════════════════

  GET /api/users/{id}/profile
    ✅ returns 200 with valid user profile           12ms
    ✅ returns 404 for non-existent user              8ms
    ✅ returns 401 without auth token                  5ms

  PUT /api/users/{id}/profile
    ✅ updates profile successfully                  45ms
    ✅ returns 422 when name exceeds 100 chars        9ms
    ✅ returns 422 when bio exceeds 500 chars          7ms
    ✅ returns 422 with invalid email format           6ms
    ✅ returns 403 when updating other user profile   11ms
    ❌ returns 422 when country_id is invalid         15ms
       Expected: 422, Got: 500
       Body: {"message": "SQLSTATE[23000] ..."}

  POST /api/users/{id}/profile/avatar
    ✅ uploads avatar successfully                   89ms
    ✅ returns 422 when file exceeds 5MB             12ms
    ✅ returns 422 with non-image file                8ms

  Results: 11 passed, 1 failed (Total: 227ms)
```

### `devflow test:api discover`

Scan codebase và list tất cả API endpoints hiện có.

```bash
$ devflow test:api discover

📡 API Endpoints Found:
═══════════════════════════════════════

  Auth:
    POST   /api/auth/login
    POST   /api/auth/register
    POST   /api/auth/logout
    POST   /api/auth/refresh

  Users:
    GET    /api/users                     [index]
    GET    /api/users/{id}                [show]
    PUT    /api/users/{id}                [update]
    GET    /api/users/{id}/profile        [profile.show]     ← PROJ-456
    PUT    /api/users/{id}/profile        [profile.update]   ← PROJ-456
    POST   /api/users/{id}/profile/avatar [profile.avatar]   ← PROJ-456

  Posts:
    GET    /api/posts                     [index]
    POST   /api/posts                     [store]
    ...

  Total: 24 endpoints (3 related to current task)
```

## 10.3 Test Generation Engine

### 10.3.1 Test Case Categories

```typescript
interface TestCase {
  id: string;
  category: 'happy_path' | 'auth' | 'validation' | 'edge_case' | 'error';
  name: string;
  description: string;
  endpoint: {
    method: string;
    path: string;
    pathParams?: Record<string, string>;
  };
  request: {
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: Record<string, any>;
    files?: Array<{ field: string; filename: string; mimeType: string; size?: string }>;
  };
  expected: {
    status: number;
    bodyContains?: Record<string, any>;    // Partial match
    bodySchema?: object;                    // JSON Schema validation
    headers?: Record<string, string>;
  };
  setup?: string;       // Description of preconditions
  teardown?: string;    // Cleanup after test
  tags: string[];
}
```

### 10.3.2 Test Generation Rules

```javascript
function generateTestCases(endpoint: APIEndpoint, task: ParsedTask): TestCase[] {
  const tests = [];

  // ═══════════════════════════════════════
  // HAPPY PATH — mỗi endpoint ít nhất 1
  // ═══════════════════════════════════════
  tests.push({
    category: 'happy_path',
    name: `${endpoint.method} ${endpoint.path} — success`,
    request: {
      headers: { Authorization: 'Bearer {{token}}' },
      body: generateValidPayload(endpoint),
    },
    expected: {
      status: endpoint.method === 'POST' ? 201 : 200,
      bodyContains: { success: true },
    },
  });

  // ═══════════════════════════════════════
  // AUTH TESTS — cho mọi protected endpoint
  // ═══════════════════════════════════════
  if (endpoint.auth !== 'none') {
    // No token
    tests.push({
      category: 'auth',
      name: `${endpoint.method} ${endpoint.path} — 401 without token`,
      request: { headers: {} },
      expected: { status: 401 },
    });

    // Invalid token
    tests.push({
      category: 'auth',
      name: `${endpoint.method} ${endpoint.path} — 401 with invalid token`,
      request: { headers: { Authorization: 'Bearer invalid-token' } },
      expected: { status: 401 },
    });

    // Forbidden (another user's resource)
    if (endpoint.path.includes('{id}') || endpoint.path.includes('{userId}')) {
      tests.push({
        category: 'auth',
        name: `${endpoint.method} ${endpoint.path} — 403 accessing other user's resource`,
        request: {
          headers: { Authorization: 'Bearer {{token}}' },
          pathParams: { id: '{{other_user_id}}' },
        },
        expected: { status: 403 },
      });
    }
  }

  // ═══════════════════════════════════════
  // VALIDATION TESTS — cho mỗi field
  // ═══════════════════════════════════════
  if (endpoint.requestBody && ['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
    for (const [field, spec] of Object.entries(endpoint.requestBody)) {

      // Required field missing
      if (spec.required) {
        tests.push({
          category: 'validation',
          name: `${endpoint.method} ${endpoint.path} — 422 missing ${field}`,
          request: {
            body: generateValidPayload(endpoint, { omit: [field] }),
          },
          expected: {
            status: 422,
            bodyContains: { errors: { [field]: expect.any(Array) } },
          },
        });
      }

      // Max length exceeded
      if (spec.maxLength) {
        tests.push({
          category: 'validation',
          name: `${endpoint.method} ${endpoint.path} — 422 ${field} exceeds max length`,
          request: {
            body: generateValidPayload(endpoint, {
              override: { [field]: 'a'.repeat(spec.maxLength + 1) }
            }),
          },
          expected: { status: 422 },
        });
      }

      // Invalid type/format
      if (spec.type === 'email' || spec.format === 'email') {
        tests.push({
          category: 'validation',
          name: `${endpoint.method} ${endpoint.path} — 422 invalid ${field} format`,
          request: {
            body: generateValidPayload(endpoint, {
              override: { [field]: 'not-an-email' }
            }),
          },
          expected: { status: 422 },
        });
      }

      // File validation
      if (spec.type === 'file') {
        if (spec.maxFileSize) {
          tests.push({
            category: 'validation',
            name: `${endpoint.method} ${endpoint.path} — 422 ${field} exceeds max size`,
            request: {
              files: [{ field, filename: 'large.jpg', mimeType: 'image/jpeg', size: 'oversized' }],
            },
            expected: { status: 422 },
          });
        }
        if (spec.acceptedTypes) {
          tests.push({
            category: 'validation',
            name: `${endpoint.method} ${endpoint.path} — 422 ${field} invalid mime type`,
            request: {
              files: [{ field, filename: 'doc.pdf', mimeType: 'application/pdf' }],
            },
            expected: { status: 422 },
          });
        }
      }
    }

    // Empty body
    tests.push({
      category: 'validation',
      name: `${endpoint.method} ${endpoint.path} — 422 empty body`,
      request: { body: {} },
      expected: { status: 422 },
    });
  }

  // ═══════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════

  // 404 for non-existent resource
  if (endpoint.path.includes('{id}')) {
    tests.push({
      category: 'edge_case',
      name: `${endpoint.method} ${endpoint.path} — 404 non-existent resource`,
      request: { pathParams: { id: '999999' } },
      expected: { status: 404 },
    });
  }

  // SQL injection attempt
  if (endpoint.path.includes('{id}')) {
    tests.push({
      category: 'edge_case',
      name: `${endpoint.method} ${endpoint.path} — handles SQL injection in path`,
      request: { pathParams: { id: "1' OR '1'='1" } },
      expected: { status: 404 },  // Should not be 500
    });
  }

  // XSS in text fields
  if (endpoint.requestBody) {
    const textFields = Object.entries(endpoint.requestBody)
      .filter(([_, spec]) => spec.type === 'string');
    if (textFields.length > 0) {
      const [field] = textFields[0];
      tests.push({
        category: 'edge_case',
        name: `${endpoint.method} ${endpoint.path} — sanitizes XSS in ${field}`,
        request: {
          body: generateValidPayload(endpoint, {
            override: { [field]: '<script>alert("xss")</script>' }
          }),
        },
        expected: {
          status: expect.oneOf([200, 201, 422]),
          // If accepted, response should not contain raw script tag
        },
      });
    }
  }

  return tests;
}
```

### 10.3.3 Endpoint Discovery

```javascript
// Auto-discover endpoints từ nhiều nguồn:

async function discoverEndpoints(task: ParsedTask, config: Config): Promise<APIEndpoint[]> {
  const endpoints = [];

  // Source 1: Laravel routes/api.php parsing
  endpoints.push(...await parseLaravelRoutes(task));

  // Source 2: Jira task description (thường list endpoints trong AC)
  endpoints.push(...extractEndpointsFromText(task.description));
  endpoints.push(...extractEndpointsFromText(task.acceptanceCriteria.join('\n')));

  // Source 3: Figma implied fields → infer CRUD endpoints
  if (task.figmaSpecs) {
    endpoints.push(...inferEndpointsFromFigma(task.figmaSpecs));
  }

  // Source 4: OpenAPI/Swagger spec
  endpoints.push(...await parseOpenAPIIfExists());

  // Dedup & merge (same method+path → merge field info)
  return deduplicateEndpoints(endpoints);
}

// Regex patterns cho endpoint extraction từ text:
const ENDPOINT_PATTERNS = [
  // "GET /api/users/{id}/profile returns user profile"
  /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[\w/{}\-]+)/gi,

  // "- API: GET /api/users"
  /API:\s*(GET|POST|PUT|PATCH|DELETE)\s+(\/[\w/{}\-]+)/gi,

  // "Endpoint: /api/users/{id}"
  /endpoint:\s*(\/[\w/{}\-]+)/gi,
];
```

## 10.4 Output Formats

### 10.4.1 HTTP File (VS Code REST Client / IntelliJ)

```http
### ═══════════════════════════════════════
### PROJ-456: User Profile API Tests
### Generated by DevFlow
### ═══════════════════════════════════════

@baseUrl = http://localhost:8000
@token = {{$dotenv DEVFLOW_TEST_TOKEN}}
@userId = 1
@otherUserId = 2

### ─── Happy Path ────────────────────────

### Get user profile — 200
GET {{baseUrl}}/api/users/{{userId}}/profile
Authorization: Bearer {{token}}
Accept: application/json

### Update user profile — 200
PUT {{baseUrl}}/api/users/{{userId}}/profile
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "full_name": "John Doe",
  "phone": "+84912345678",
  "bio": "Hello world",
  "country_id": 1
}

### Upload avatar — 201
POST {{baseUrl}}/api/users/{{userId}}/profile/avatar
Authorization: Bearer {{token}}
Content-Type: multipart/form-data; boundary=boundary

--boundary
Content-Disposition: form-data; name="avatar"; filename="photo.jpg"
Content-Type: image/jpeg

< ./fixtures/test-image.jpg
--boundary--

### ─── Auth Tests ────────────────────────

### Get profile without token — 401
GET {{baseUrl}}/api/users/{{userId}}/profile
Accept: application/json

### Get profile with invalid token — 401
GET {{baseUrl}}/api/users/{{userId}}/profile
Authorization: Bearer invalid-token-here
Accept: application/json

### Get other user's profile — 403
GET {{baseUrl}}/api/users/{{otherUserId}}/profile
Authorization: Bearer {{token}}
Accept: application/json

### ─── Validation Tests ──────────────────

### Update profile — missing required field — 422
PUT {{baseUrl}}/api/users/{{userId}}/profile
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "phone": "+84912345678"
}

### Update profile — name too long — 422
PUT {{baseUrl}}/api/users/{{userId}}/profile
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "full_name": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "country_id": 1
}

### ─── Edge Cases ────────────────────────

### Get non-existent user — 404
GET {{baseUrl}}/api/users/999999/profile
Authorization: Bearer {{token}}
Accept: application/json
```

### 10.4.2 Postman Collection

```javascript
// Generate Postman Collection v2.1 format
function generatePostmanCollection(tests: TestCase[], config: Config): object {
  return {
    info: {
      name: `PROJ-456: User Profile API Tests`,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [
      { key: 'baseUrl', value: config.test.base_url },
      { key: 'token', value: '' },
    ],
    item: groupByCategory(tests).map(group => ({
      name: group.category,
      item: group.tests.map(test => ({
        name: test.name,
        request: {
          method: test.endpoint.method,
          url: buildPostmanUrl(test),
          header: buildPostmanHeaders(test),
          body: buildPostmanBody(test),
        },
        event: [{
          listen: 'test',
          script: {
            exec: generatePostmanTestScript(test),
          },
        }],
      })),
    })),
  };
}
```

### 10.4.3 Vitest/Jest Test Script

```javascript
// Generate executable test file
function generateTestScript(tests: TestCase[], config: Config): string {
  return `
import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = '${config.test.base_url}';
let authToken: string;

beforeAll(async () => {
  // Login to get token
  const res = await fetch(\`\${BASE_URL}/api/auth/login\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: '${config.test.user_email}',
      password: '${config.test.user_password}',
    }),
  });
  const data = await res.json();
  authToken = data.data.token;
});

${tests.map(test => generateSingleTest(test)).join('\n\n')}
`;
}

function generateSingleTest(test: TestCase): string {
  return `
describe('${test.endpoint.method} ${test.endpoint.path}', () => {
  it('${test.name}', async () => {
    const res = await fetch(\`\${BASE_URL}${resolvedPath(test)}\`, {
      method: '${test.endpoint.method}',
      headers: ${JSON.stringify(test.request.headers || {}, null, 6)},
      ${test.request.body ? `body: JSON.stringify(${JSON.stringify(test.request.body, null, 6)}),` : ''}
    });

    expect(res.status).toBe(${test.expected.status});
    ${test.expected.bodyContains ? `
    const body = await res.json();
    ${Object.entries(test.expected.bodyContains).map(([key, val]) =>
      `expect(body.${key}).toEqual(${JSON.stringify(val)});`
    ).join('\n    ')}` : ''}
  });
});`;
}
```

## 10.5 Config

```yaml
# .devflow.yml
test:
  api:
    base_url: "http://localhost:8000"
    auth:
      type: "bearer"                    # bearer | basic | api_key | none
      login_endpoint: "/api/auth/login"
      login_body:
        email: "test@example.com"
        password: "password123"
      token_path: "data.token"          # JSON path to token in login response
    default_format: "all"               # http | postman | jest | phpunit | all
    output_dir: ".devflow/tests"
    fixtures_dir: ".devflow/tests/fixtures"
    timeout: 10000                      # ms
    auto_generate_fixtures: true        # Tạo test images, files cho upload tests
```

## 10.6 Test Fixtures Generator

```javascript
// Auto-create fixture files needed for tests:

async function generateFixtures(tests: TestCase[], config: Config) {
  const fixturesDir = config.test.fixtures_dir;

  // Generate test image cho avatar upload tests
  if (testsNeedImage(tests)) {
    // Create 100x100 PNG (minimal valid PNG)
    await createTestImage(`${fixturesDir}/test-image.jpg`, { width: 100, height: 100 });

    // Create oversized image (>5MB) cho max size test
    await createTestImage(`${fixturesDir}/large-image.jpg`, { sizeKB: 6000 });

    // Create non-image file cho mime type test
    await fs.writeFile(`${fixturesDir}/not-image.pdf`, '%PDF-1.4 fake pdf content');
  }

  // Generate test CSV cho import tests
  if (testsNeedCSV(tests)) {
    await createTestCSV(`${fixturesDir}/test-data.csv`);
  }
}
```
