# Design & UX Guidelines

## CLI Design Principles

DevFlow CLI prioritizes clarity, speed, and developer ergonomics.

### Core Principles

1. **Fast Feedback** — Show results instantly or within 2 seconds
2. **Clear Output** — Use structured formatting, colors, tables
3. **Error First** — Explicit errors with actionable suggestions
4. **Sensible Defaults** — Work without excessive configuration
5. **Composable** — Combine commands for complex workflows
6. **Discoverable** — Built-in help and suggestions

## Output Formatting

### Success Messages

```javascript
logger.success('✓ Task fetched successfully');
```

**Style:**
- Green color (#22C55E)
- Checkmark symbol (✓)
- Clear, present-tense description
- Include duration if long operation

### Error Messages

```javascript
logger.error('✗ Jira API error: 401 Unauthorized');
logger.error('  Set DEVFLOW_JIRA_TOKEN environment variable');
```

**Style:**
- Red color (#EF4444)
- X symbol (✗)
- Error type first, then details
- Include suggestions for resolution
- Use indentation for sub-messages

### Warning Messages

```javascript
logger.warn('⚠ SSH key not found, using default');
```

**Style:**
- Yellow color (#FBBF24)
- Warning symbol (⚠)
- Actionable suggestion below

### Info Messages

```javascript
logger.info('ℹ Connecting to Jira...');
```

**Style:**
- Blue color (#3B82F6)
- Info symbol (ℹ)
- Progress indicators for long operations

## Progress Indicators

### Spinners for Long Operations

```javascript
const spinner = ora('Fetching design specs...').start();

// ... async operation ...

spinner.succeed('Design specs fetched (2.3s)');
// or
spinner.fail('Failed to fetch design specs');
```

**Usage:**
- API calls > 500ms
- File processing > 1 second
- Test generation > 3 seconds
- Don't use for <500ms operations

### Progress Bars

```javascript
const bar = new ProgressBar('[:bar] :percent', {
  total: tasks.length,
  width: 30
});

tasks.forEach(task => {
  bar.tick();
});
```

## Data Display

### Tables

```bash
$ devflow task list

╔═══════════════════════════════════════════════════════════╗
║  Your Tasks                                                ║
╠═══════════════════════════════════════════════════════════╣
║  ID        │ Title              │ Status      │ Priority    ║
├─────────────────────────────────────────────────────────────
║ PROJ-456   │ User Profile API   │ In Progress │ High ⬆      ║
║ PROJ-457   │ Design DB Schema   │ Done        │ Medium ➡     ║
║ PROJ-458   │ Create Tests       │ To Do       │ High ⬆      ║
╚═══════════════════════════════════════════════════════════╝
```

**Guidelines:**
- Use boxen for emphasis
- Use table for structured data
- Align columns neatly
- Include 1-2 emoji for visual scanning
- Bold important columns

### JSON Output

```bash
$ devflow task PROJ-456 --json

{
  "key": "PROJ-456",
  "title": "User Profile API",
  "status": "In Progress",
  "priority": "High",
  "description": "...",
  "acceptance_criteria": [...]
}
```

**Guidelines:**
- Always provide `--json` for piping
- Pretty-print with 2-space indent
- Include all relevant fields
- Useful for automation/scripting

## Interactive Prompts

### Simple Yes/No

```javascript
const confirmed = await inquirer.prompt([
  {
    type: 'confirm',
    name: 'deploy',
    message: 'Deploy to production?',
    default: false
  }
]);
```

**Usage:** Binary decisions, confirmation gates

### Single Selection

```javascript
const framework = await inquirer.prompt([
  {
    type: 'list',
    name: 'framework',
    message: 'Select backend framework:',
    choices: [
      'laravel',
      'symfony',
      'django',
      'express'
    ]
  }
]);
```

**Usage:** Choose from options, pick environment

### Multiple Selection

```javascript
const services = await inquirer.prompt([
  {
    type: 'checkbox',
    name: 'services',
    message: 'Select infrastructure services:',
    choices: [
      { name: 'PostgreSQL', checked: true },
      { name: 'Redis', checked: true },
      { name: 'RabbitMQ' }
    ]
  }
]);
```

**Usage:** Multi-select, enable features

### Text Input

```javascript
const projectName = await inquirer.prompt([
  {
    type: 'input',
    name: 'name',
    message: 'Project name:',
    default: 'my-app',
    validate: (input) => input.length > 0
  }
]);
```

**Usage:** Free-form input, configuration values

## Help & Documentation

### Command Help

```bash
$ devflow task --help

Usage: devflow task [options] <issue-key>

Fetch Jira task and display details

Arguments:
  issue-key          JIRA issue key (e.g., PROJ-123)

Options:
  --json             Output as JSON
  --with-comments    Include Jira comments
  --with-history     Include status change history
  --with-links       Include linked issues
  -h, --help         Display help

Examples:
  $ devflow task PROJ-456
  $ devflow task PROJ-456 --json
  $ devflow task PROJ-456 --with-comments
```

**Guidelines:**
- Brief description (1 line)
- Required arguments first
- Options grouped by category
- Provide 2-3 examples
- Include `--help` and `-h`

### Contextual Suggestions

```bash
$ devflow deploy
? No environment specified

Did you mean:
  devflow deploy staging
  devflow deploy production

Or run: devflow deploy --help
```

**Usage:** Common errors, typos, missing arguments

### In-Command Guidance

```bash
$ devflow init

? Project name: my-app
  💡 Tip: Use lowercase, no spaces (e.g., user-service)

? Framework:
  1) Laravel
  2) Symfony
  3) Django
  ...
  ℹ Laravel recommended for PHP projects
```

## Visual Hierarchy

### Command Sections

```bash
$ devflow task PROJ-456

╔════════════════════════════════════════════╗
║  PROJ-456: Implement User Profile API      ║  ← Header
╚════════════════════════════════════════════╝

Type: Story | Priority: High | Status: In Progress  ← Meta

Description:
  Implement REST API endpoints for user profile...  ← Content

Acceptance Criteria:
  ✓ GET /api/users/{id}/profile
  ✓ PUT /api/users/{id}/profile
  ✓ Profile image upload support
```

**Hierarchy:**
1. **Header** — Task ID + title (boxed, centered)
2. **Meta** — Status, priority, type (inline badges)
3. **Content** — Description, detailed info
4. **Sections** — Grouped with sub-headers

## Color Scheme

| Element | Color | Hex | Usage |
|---------|-------|-----|-------|
| Success | Green | #22C55E | Completed actions |
| Error | Red | #EF4444 | Failures, warnings |
| Warning | Amber | #FBBF24 | Cautions, alerts |
| Info | Blue | #3B82F6 | Information, progress |
| Muted | Gray | #9CA3AF | Secondary info |
| Highlight | Purple | #A855F7 | Important data |

**Usage:**
- One primary color per message
- Minimal color mix (max 2-3 per section)
- Colorblind-friendly palette
- Sufficient contrast (WCAG AA)

## Emoji Usage

**Recommended:**
- ✓ Success
- ✗ Error / Failure
- ⚠ Warning
- ℹ Information
- 🔧 Settings / Config
- 🚀 Deploy / Launch
- 📋 List / Report
- 💡 Tip / Suggestion
- ⏳ Loading / Waiting
- ⟳ Retry / Rollback

**Avoid:**
- Decorative-only emoji
- Redundant emoji (with color)
- Emoji without meaning
- Non-ASCII symbols on all systems

## Accessibility

### Terminal Compatibility

**Support:**
- 256-color terminals
- Basic color support (8 colors)
- Monochrome terminals
- Screen readers

**Test:**
```bash
# Force monochrome
NO_COLOR=1 devflow task PROJ-456

# Force 8-color mode
TERM=xterm-256color devflow task PROJ-456
```

### Readable Output

- Font size: ≥10pt (user configurable)
- Line length: ≤120 characters
- Spacing: 1.5 line height minimum
- Contrast: WCAG AA (4.5:1 text, 3:1 graphics)

### Keyboard Navigation

- Tab to navigate options
- Enter to confirm
- Escape to cancel
- Arrow keys for selection

## Response Time Guidelines

| Operation | Target | Max |
|-----------|--------|-----|
| Command parsing | <50ms | 100ms |
| Config load | <100ms | 200ms |
| Simple API call | <2s | 5s |
| Test generation | <10s | 20s |
| Full workflow | <30s | 60s |

**Slow Operations:**
- Show spinner
- Provide ETA if possible
- Allow cancellation
- Cache results when safe

## Error Handling UX

### Clear Error Messages

```
❌ ERROR: Jira API error
   Status: 401 Unauthorized

Possible causes:
  • DEVFLOW_JIRA_TOKEN not set
  • Token expired or invalid
  • Jira host unreachable

Solutions:
  1. Set token: export DEVFLOW_JIRA_TOKEN="..."
  2. Verify token: curl -H "Authorization: Bearer $DEVFLOW_JIRA_TOKEN" \
     https://company.atlassian.net/rest/api/3/myself
  3. Test connection: devflow doctor

For more help: devflow task --help
```

**Structure:**
1. Error type (prefix with symbol)
2. Error details (status code, message)
3. Possible causes (numbered list)
4. Solutions (actionable steps)
5. Help reference

### Validation Errors

```
? Project name: my_app!@#

❌ Invalid project name

Requirements:
  • Lowercase letters, numbers, hyphens only
  • Start with letter
  • 3-50 characters
  • No spaces or special characters

Example: user-service, api-gateway, ml-model
```

### Confirmation Gates

For destructive operations:

```bash
$ devflow deploy production

⚠ WARNING: Deploying to PRODUCTION

Current version:  abc123d
Target host:      prod.company.com
Deployment time:  ~5 minutes
Estimated downtime: <1 second

This action is permanent. Are you sure?

  Type "yes" to confirm: yes
  ✓ Deployment started
```

## Web Dashboard Design

### Component Library

Use consistent components:
- Buttons: Primary, secondary, danger
- Cards: Task, deployment, test result
- Alerts: Success, error, warning, info
- Forms: Input, select, checkbox
- Tables: Tasks, deployments, logs

### Responsive Layout

```
Desktop (1200px+)      Tablet (768px-1199px)    Mobile (< 768px)
┌─────────────────┐    ┌──────────────┐         ┌──────────┐
│ Sidebar │ Main  │    │ Main Content │         │ Main     │
│         │       │    │              │         │          │
│ Tasks   │ Board │    │ (Sidebar     │         │ (Menu in │
│         │ View  │    │  collapses)  │         │  header) │
└─────────────────┘    └──────────────┘         └──────────┘
```

## Configuration File Design

### `.devflow.yml` Structure

```yaml
# Top-level sections in reading order
project:      # What project is this?
jira:         # Where are tasks?
figma:        # Where are designs?
git:          # How to manage git?
deploy:       # How to deploy?
test:         # How to test?
```

**Principles:**
- Flat structure (avoid deep nesting)
- Sensible defaults (minimal required)
- Comments explaining each section
- Examples inline
- Environment variable substitution

## Performance Considerations

### UI Responsiveness

- Interactive prompts: <200ms response
- Command output: <1s total
- Progress indication: Show within 300ms
- Cancel operation: Respond within 500ms

### Memory Usage

- Keep command memory footprint < 50MB
- Cache wisely (1000s of items max)
- Stream large files instead of loading
- Cleanup temp files after operations

## Terminal Size Handling

### Detect Terminal Size

```javascript
const width = process.stdout.columns || 80;
const height = process.stdout.rows || 24;

// Adapt output to fit
if (width < 80) {
  // Compact layout for small terminals
} else {
  // Full layout for wide terminals
}
```

### Responsive Output

```bash
# Wide terminal (120+ columns)
╔═══════════════════════════════════════════════════════════════╗
║ Task ID │ Title              │ Status      │ Assigned   │ ...  ║
╚═══════════════════════════════════════════════════════════════╝

# Narrow terminal (< 80 columns)
╔═════════════════════════════════════╗
║ Task PROJ-456                       ║
╠─────────────────────────────────────╣
║ Title: User Profile API             ║
║ Status: In Progress                 ║
║ Assigned: dev@company.com           ║
╚─────────────────────────────────────╝
```

## Localization

### Multi-Language Support

Currently: English primary

Future support:
- Vietnamese (vi)
- Japanese (ja)
- Spanish (es)
- French (fr)

### Translation Keys

```javascript
const messages = {
  en: {
    'success.task_fetched': '✓ Task fetched successfully',
    'error.jira_unauthorized': 'Jira API error: 401 Unauthorized',
    'prompt.confirm_deploy': 'Deploy to production?'
  },
  vi: {
    'success.task_fetched': '✓ Tải task thành công',
    'error.jira_unauthorized': 'Lỗi Jira API: 401 Unauthorized',
    'prompt.confirm_deploy': 'Deploy lên production?'
  }
};
```

## Design Consistency Checklist

Before releasing features:

- [ ] Error messages include suggestions
- [ ] Long operations show progress
- [ ] Colors consistent with scheme
- [ ] Help text available (`--help`)
- [ ] JSON output option provided
- [ ] Keyboard navigation works
- [ ] Works in narrow terminals
- [ ] Color-blind friendly
- [ ] All platforms tested (Mac, Linux, Windows)
- [ ] Response times acceptable

## Related Documentation

- **Code Standards:** docs/code-standards.md
- **System Architecture:** docs/system-architecture.md
- **README:** README.md
