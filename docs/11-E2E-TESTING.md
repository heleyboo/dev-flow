# Feature 9: E2E Testing

## 11.1 Mục tiêu

Tự động generate end-to-end test scenarios từ Jira acceptance criteria + Figma UI specs. Generate Playwright hoặc Cypress test scripts có thể chạy ngay, cover full user flows từ UI đến API.

## 11.2 Supported Frameworks

```yaml
# .devflow.yml
test:
  e2e:
    framework: "playwright"           # playwright | cypress
    language: "typescript"            # typescript | javascript
    base_url: "http://localhost:3000" # Frontend URL
    api_url: "http://localhost:8000"  # Backend API URL
    output_dir: "tests/e2e"           # Output directory cho test files
    fixtures_dir: "tests/e2e/fixtures"
    screenshot_on_fail: true
    video: false                      # Record video of test runs
    browsers: ["chromium"]            # chromium | firefox | webkit
    viewport:
      desktop: { width: 1440, height: 900 }
      tablet: { width: 768, height: 1024 }
      mobile: { width: 375, height: 812 }
    auth:
      login_url: "/login"
      test_user:
        email: "test@example.com"
        password: "password123"
      selectors:
        email_input: "[data-testid='email-input']"
        password_input: "[data-testid='password-input']"
        submit_button: "[data-testid='login-submit']"
```

## 11.3 Commands

### `devflow test:e2e <JIRA-ID>`

Generate E2E tests từ task.

```bash
$ devflow test:e2e PROJ-456

🔍 Analyzing PROJ-456 acceptance criteria...
📐 Extracting UI selectors from Figma...
🧪 Generating E2E test scenarios...

╔══════════════════════════════════════════════════════╗
║  E2E Tests Generated for PROJ-456                    ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  Scenarios: 6                                        ║
║    1. User views their profile                       ║
║    2. User updates profile successfully              ║
║    3. User uploads avatar                            ║
║    4. Validation errors displayed on form             ║
║    5. Profile page responsive on mobile              ║
║    6. Unauthorized access redirects to login          ║
║                                                      ║
║  Output:                                             ║
║    tests/e2e/user-profile.spec.ts                    ║
║    tests/e2e/fixtures/test-avatar.jpg                ║
║    tests/e2e/pages/ProfilePage.ts (Page Object)      ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
```

**Options:**
- `--framework playwright|cypress` — Override framework
- `--run` — Immediately run after generating
- `--headed` — Run tests in headed mode (visible browser)
- `--mobile` — Include mobile viewport tests
- `--responsive` — Generate tests for all breakpoints
- `--debug` — Generate with debug helpers (pause, slow-mo)

### `devflow test:e2e run [file]`

Chạy E2E tests.

```bash
$ devflow test:e2e run

🎭 Running E2E tests (Playwright)...
═══════════════════════════════════════

  user-profile.spec.ts
    ✅ User views their profile                        1.2s
    ✅ User updates profile successfully               2.8s
    ✅ User uploads avatar                             3.1s
    ✅ Validation errors displayed on form             1.5s
    ✅ Profile page responsive on mobile               2.0s
    ✅ Unauthorized access redirects to login           0.8s

  6 passed (11.4s)

  📸 Screenshots: tests/e2e/screenshots/
  📹 Videos: tests/e2e/videos/ (disabled)
```

### `devflow test:e2e codegen`

Interactive mode — mở browser, record user actions, generate test code.

```bash
$ devflow test:e2e codegen

🎭 Opening browser in codegen mode...
💡 Interact with the app, DevFlow will record your actions as test code.
   Press Ctrl+C when done.

📝 Test recorded: tests/e2e/recorded-test.spec.ts (42 lines)
```

## 11.4 Test Generation Engine

### 11.4.1 Acceptance Criteria → Test Scenarios

```javascript
// Parse acceptance criteria thành testable scenarios
// Input: "GET /api/users/{id}/profile returns user profile"
// Output: Test scenario with steps

interface E2EScenario {
  id: string;
  name: string;
  description: string;
  category: 'functional' | 'validation' | 'responsive' | 'auth' | 'error';
  preconditions: string[];
  steps: TestStep[];
  assertions: Assertion[];
  viewport?: { width: number; height: number };
  tags: string[];
}

interface TestStep {
  action: 'navigate' | 'click' | 'fill' | 'select' | 'upload'
        | 'wait' | 'scroll' | 'hover' | 'keyboard' | 'assert';
  target?: string;           // Selector or URL
  value?: string;            // Input value
  description: string;       // Human-readable step description
}

interface Assertion {
  type: 'visible' | 'text' | 'url' | 'count' | 'attribute'
      | 'api_response' | 'toast' | 'redirect' | 'screenshot';
  target?: string;           // Selector
  expected: any;             // Expected value
  description: string;
}
```

### 11.4.2 AC Parser

```javascript
function parseAcceptanceCriteria(criteria: string[]): E2EScenario[] {
  const scenarios = [];

  for (const ac of criteria) {
    // Pattern 1: Given/When/Then (BDD)
    const gwtMatch = ac.match(
      /given\s+(.+?)\s*,?\s*when\s+(.+?)\s*,?\s*then\s+(.+)/i
    );
    if (gwtMatch) {
      scenarios.push({
        name: summarize(ac),
        preconditions: [gwtMatch[1]],
        steps: parseWhenClause(gwtMatch[2]),
        assertions: parseThenClause(gwtMatch[3]),
      });
      continue;
    }

    // Pattern 2: "X should Y" / "X must Y"
    const shouldMatch = ac.match(
      /(.+?)\s+(should|must|shall|will)\s+(.+)/i
    );
    if (shouldMatch) {
      scenarios.push({
        name: summarize(ac),
        steps: inferStepsFromSubject(shouldMatch[1]),
        assertions: [{ description: shouldMatch[3] }],
      });
      continue;
    }

    // Pattern 3: Action → Result
    // "User clicks save → profile updated"
    const arrowMatch = ac.match(/(.+?)\s*[→\->]+\s*(.+)/);
    if (arrowMatch) {
      scenarios.push({
        name: summarize(ac),
        steps: inferStepsFromAction(arrowMatch[1]),
        assertions: [{ description: arrowMatch[2] }],
      });
      continue;
    }

    // Pattern 4: API endpoint description
    // "GET /api/users/{id}/profile returns user profile"
    const apiMatch = ac.match(
      /(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)\s+(.+)/i
    );
    if (apiMatch) {
      scenarios.push({
        name: `API: ${apiMatch[1]} ${apiMatch[2]}`,
        category: 'functional',
        steps: [
          { action: 'navigate', target: inferPageUrl(apiMatch[2]) },
          { action: 'wait', description: 'Wait for data to load' },
        ],
        assertions: inferUIAssertions(apiMatch[3], apiMatch[2]),
      });
      continue;
    }

    // Pattern 5: Validation rule
    // "Name max 100 chars" / "Bio max 500 characters"
    const validationMatch = ac.match(
      /(\w+)\s+(max|min|required|optional|format|must be)\s+(.+)/i
    );
    if (validationMatch) {
      scenarios.push({
        name: `Validation: ${validationMatch[1]} ${validationMatch[2]} ${validationMatch[3]}`,
        category: 'validation',
        steps: generateValidationSteps(validationMatch[1], validationMatch[2], validationMatch[3]),
        assertions: [{ type: 'visible', description: 'Error message displayed' }],
      });
      continue;
    }

    // Fallback: tạo generic scenario, cần user review
    scenarios.push({
      name: summarize(ac),
      category: 'functional',
      steps: [{ action: 'navigate', description: `TODO: implement steps for "${ac}"` }],
      assertions: [{ description: `TODO: verify "${ac}"` }],
      tags: ['needs-review'],
    });
  }

  // Auto-add thêm standard scenarios
  scenarios.push(...generateStandardScenarios(criteria));

  return scenarios;
}

// Standard scenarios luôn generate:
function generateStandardScenarios(criteria: string[]): E2EScenario[] {
  return [
    // Auth test: truy cập page khi chưa login
    {
      name: 'Unauthorized access redirects to login',
      category: 'auth',
      preconditions: ['User is NOT logged in'],
      steps: [{ action: 'navigate', target: '{{pageUrl}}' }],
      assertions: [{ type: 'redirect', expected: '/login' }],
    },
    // Responsive test: mobile viewport
    {
      name: 'Page displays correctly on mobile',
      category: 'responsive',
      viewport: { width: 375, height: 812 },
      steps: [
        { action: 'navigate', target: '{{pageUrl}}' },
        { action: 'wait', description: 'Wait for layout adjustment' },
      ],
      assertions: [
        { type: 'screenshot', description: 'Visual comparison' },
        { type: 'visible', description: 'All critical elements visible' },
      ],
    },
  ];
}
```

### 11.4.3 Figma → Selector Mapping

```javascript
// Map Figma component names → CSS selectors / test IDs

function mapFigmaToSelectors(figmaSpecs: FigmaSpecs): SelectorMap {
  const selectors = {};

  for (const node of flattenTree(figmaSpecs.componentTree)) {
    const testId = generateTestId(node);

    selectors[node.name] = {
      // Preferred: data-testid (most reliable)
      primary: `[data-testid="${testId}"]`,

      // Fallback: role + name
      fallback: inferAriaSelector(node),

      // Last resort: CSS selector
      css: inferCSSSelector(node),
    };
  }

  return selectors;
}

function generateTestId(node: ComponentNode): string {
  // "Profile Header" → "profile-header"
  // "Full Name Input" → "full-name-input"
  // "Save Button" → "save-button"
  return node.name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function inferAriaSelector(node: ComponentNode): string {
  switch (node.inferredType) {
    case 'button':
      return `role=button[name="${node.textContent || node.name}"]`;
    case 'input':
      return `role=textbox[name="${node.name}"]`;
    case 'select':
      return `role=combobox[name="${node.name}"]`;
    case 'checkbox':
      return `role=checkbox[name="${node.name}"]`;
    case 'navigation':
      return `role=navigation`;
    case 'modal':
      return `role=dialog`;
    default:
      return `text="${node.textContent || node.name}"`;
  }
}
```

## 11.5 Output: Playwright Test

```typescript
// Generated: tests/e2e/user-profile.spec.ts

import { test, expect } from '@playwright/test';
import { ProfilePage } from './pages/ProfilePage';

// ═══════════════════════════════════════
// PROJ-456: User Profile
// Generated by DevFlow
// ═══════════════════════════════════════

test.describe('User Profile [PROJ-456]', () => {

  let profilePage: ProfilePage;

  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL('**/dashboard');

    profilePage = new ProfilePage(page);
  });

  test('User views their profile', async ({ page }) => {
    await profilePage.goto();

    // Assert profile data is displayed
    await expect(profilePage.userName).toBeVisible();
    await expect(profilePage.userBio).toBeVisible();
    await expect(profilePage.avatar).toBeVisible();
    await expect(profilePage.statsSection).toBeVisible();
  });

  test('User updates profile successfully', async ({ page }) => {
    await profilePage.goto();
    await profilePage.clickEdit();

    // Fill form
    await profilePage.fillName('Updated Name');
    await profilePage.fillBio('Updated bio text');
    await profilePage.fillPhone('+84912345678');
    await profilePage.selectCountry('Vietnam');

    // Submit
    await profilePage.submit();

    // Assert success
    await expect(profilePage.successToast).toBeVisible();
    await expect(profilePage.userName).toHaveText('Updated Name');
  });

  test('User uploads avatar', async ({ page }) => {
    await profilePage.goto();
    await profilePage.clickEdit();

    // Upload file
    await profilePage.uploadAvatar('fixtures/test-avatar.jpg');

    // Assert preview shown
    await expect(profilePage.avatarPreview).toBeVisible();

    // Submit and verify
    await profilePage.submit();
    await expect(profilePage.successToast).toBeVisible();
  });

  test('Validation errors displayed on form', async ({ page }) => {
    await profilePage.goto();
    await profilePage.clickEdit();

    // Clear required field and submit
    await profilePage.clearName();
    await profilePage.submit();

    // Assert validation error
    await expect(profilePage.nameError).toBeVisible();
    await expect(profilePage.nameError).toContainText('required');

    // Test max length
    await profilePage.fillName('a'.repeat(101));
    await profilePage.submit();
    await expect(profilePage.nameError).toContainText('100');

    // Test bio max length
    await profilePage.fillBio('a'.repeat(501));
    await profilePage.submit();
    await expect(profilePage.bioError).toContainText('500');
  });

  test('Profile page responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await profilePage.goto();

    // Assert mobile layout
    await expect(profilePage.profileForm).toBeVisible();
    await expect(profilePage.container).toHaveCSS('flex-direction', 'column');

    // Screenshot comparison
    await expect(page).toHaveScreenshot('profile-mobile.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('Unauthorized access redirects to login', async ({ browser }) => {
    // New context without auth
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/profile');
    await expect(page).toHaveURL(/.*\/login/);

    await context.close();
  });

});
```

## 11.6 Output: Page Object

```typescript
// Generated: tests/e2e/pages/ProfilePage.ts

import { Page, Locator } from '@playwright/test';

export class ProfilePage {
  readonly page: Page;

  // ─── Locators ───────────────────────
  readonly container: Locator;
  readonly userName: Locator;
  readonly userBio: Locator;
  readonly avatar: Locator;
  readonly avatarPreview: Locator;
  readonly editButton: Locator;
  readonly statsSection: Locator;

  // Form
  readonly profileForm: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly phoneInput: Locator;
  readonly bioInput: Locator;
  readonly countrySelect: Locator;
  readonly avatarUpload: Locator;
  readonly submitButton: Locator;

  // Feedback
  readonly successToast: Locator;
  readonly nameError: Locator;
  readonly bioError: Locator;

  constructor(page: Page) {
    this.page = page;

    this.container = page.locator('[data-testid="profile-container"]');
    this.userName = page.locator('[data-testid="user-name"]');
    this.userBio = page.locator('[data-testid="user-bio"]');
    this.avatar = page.locator('[data-testid="avatar"]');
    this.avatarPreview = page.locator('[data-testid="avatar-preview"]');
    this.editButton = page.locator('[data-testid="edit-button"]');
    this.statsSection = page.locator('[data-testid="profile-stats"]');

    this.profileForm = page.locator('[data-testid="profile-form"]');
    this.nameInput = page.locator('[data-testid="full-name-input"]');
    this.emailInput = page.locator('[data-testid="email-input"]');
    this.phoneInput = page.locator('[data-testid="phone-input"]');
    this.bioInput = page.locator('[data-testid="bio-input"]');
    this.countrySelect = page.locator('[data-testid="country-select"]');
    this.avatarUpload = page.locator('[data-testid="avatar-upload"]');
    this.submitButton = page.locator('[data-testid="save-button"]');

    this.successToast = page.locator('[data-testid="toast-success"]');
    this.nameError = page.locator('[data-testid="full-name-error"]');
    this.bioError = page.locator('[data-testid="bio-error"]');
  }

  // ─── Actions ────────────────────────

  async goto() {
    await this.page.goto('/profile');
    await this.page.waitForLoadState('networkidle');
  }

  async clickEdit() {
    await this.editButton.click();
    await this.profileForm.waitFor({ state: 'visible' });
  }

  async fillName(name: string) {
    await this.nameInput.clear();
    await this.nameInput.fill(name);
  }

  async clearName() {
    await this.nameInput.clear();
  }

  async fillBio(bio: string) {
    await this.bioInput.clear();
    await this.bioInput.fill(bio);
  }

  async fillPhone(phone: string) {
    await this.phoneInput.clear();
    await this.phoneInput.fill(phone);
  }

  async selectCountry(country: string) {
    await this.countrySelect.click();
    await this.page.locator(`text="${country}"`).click();
  }

  async uploadAvatar(filePath: string) {
    await this.avatarUpload.setInputFiles(filePath);
  }

  async submit() {
    await this.submitButton.click();
  }
}
```

## 11.7 Output: Cypress (Alternative)

```typescript
// Generated: cypress/e2e/user-profile.cy.ts

describe('User Profile [PROJ-456]', () => {

  beforeEach(() => {
    cy.login('test@example.com', 'password123');
  });

  it('User views their profile', () => {
    cy.visit('/profile');

    cy.getByTestId('user-name').should('be.visible');
    cy.getByTestId('user-bio').should('be.visible');
    cy.getByTestId('avatar').should('be.visible');
    cy.getByTestId('profile-stats').should('be.visible');
  });

  it('User updates profile successfully', () => {
    cy.visit('/profile');
    cy.getByTestId('edit-button').click();

    cy.getByTestId('full-name-input').clear().type('Updated Name');
    cy.getByTestId('bio-input').clear().type('Updated bio');
    cy.getByTestId('phone-input').clear().type('+84912345678');
    cy.getByTestId('country-select').click();
    cy.contains('Vietnam').click();

    cy.getByTestId('save-button').click();

    cy.getByTestId('toast-success').should('be.visible');
    cy.getByTestId('user-name').should('have.text', 'Updated Name');
  });

  it('Validation errors displayed', () => {
    cy.visit('/profile');
    cy.getByTestId('edit-button').click();

    cy.getByTestId('full-name-input').clear();
    cy.getByTestId('save-button').click();

    cy.getByTestId('full-name-error').should('be.visible');
    cy.getByTestId('full-name-error').should('contain', 'required');
  });

  it('Unauthorized access redirects to login', () => {
    cy.clearCookies();
    cy.visit('/profile');
    cy.url().should('include', '/login');
  });
});

// cypress/support/commands.ts
Cypress.Commands.add('getByTestId', (testId: string) => {
  cy.get(`[data-testid="${testId}"]`);
});

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.getByTestId('email-input').type(email);
    cy.getByTestId('password-input').type(password);
    cy.getByTestId('login-submit').click();
    cy.url().should('include', '/dashboard');
  });
});
```

## 11.8 data-testid Convention Generator

DevFlow tự động generate danh sách `data-testid` cần thêm vào frontend code:

```bash
$ devflow test:e2e selectors PROJ-456

📋 Required data-testid attributes:
═══════════════════════════════════════

Add these to your frontend components:

  Profile Page:
    data-testid="profile-container"     → Main wrapper
    data-testid="user-name"             → Username display
    data-testid="user-bio"              → Bio text
    data-testid="avatar"                → Avatar image
    data-testid="avatar-preview"        → Upload preview
    data-testid="edit-button"           → Edit profile button
    data-testid="profile-stats"         → Stats section

  Profile Form:
    data-testid="profile-form"          → Form wrapper
    data-testid="full-name-input"       → Name input
    data-testid="email-input"           → Email input (disabled)
    data-testid="phone-input"           → Phone input
    data-testid="bio-input"             → Bio textarea
    data-testid="country-select"        → Country dropdown
    data-testid="avatar-upload"         → File upload input
    data-testid="save-button"           → Submit button

  Feedback:
    data-testid="toast-success"         → Success notification
    data-testid="full-name-error"       → Name validation error
    data-testid="bio-error"             → Bio validation error

💡 Tip: Include these testids in your frontend prompt
   so Claude Code adds them during implementation.
```

## 11.9 CI Integration

```yaml
# Suggest thêm vào .github/workflows/e2e.yml

name: E2E Tests
on: [pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      - name: Start backend
        run: php artisan serve &
      - name: Start frontend
        run: npm run dev &
      - name: Wait for servers
        run: npx wait-on http://localhost:3000 http://localhost:8000
      - name: Run E2E tests
        run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```
