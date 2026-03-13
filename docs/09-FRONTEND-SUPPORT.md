# Feature 7: Frontend Code Support

## 9.1 Mục tiêu

Mở rộng DevFlow để hỗ trợ generate prompt cho frontend development. Từ Figma specs, tự động sinh ra structured prompt giúp Claude Code implement UI components, pages, và kết nối với backend API.

## 9.2 Supported Frontend Stacks

```yaml
# .devflow.yml
frontend:
  framework: "react"              # react | vue | nextjs | nuxtjs | angular | vanilla
  styling: "tailwindcss"          # tailwindcss | scss | styled-components | css-modules
  state_management: "zustand"     # zustand | redux | pinia | vuex | none
  api_client: "axios"             # axios | fetch | tanstack-query | swr
  language: "typescript"          # typescript | javascript
  component_style: "functional"   # functional | class (React only)
  testing: "vitest"               # vitest | jest | testing-library
  src_dir: "src"                  # Frontend source directory
  component_dir: "src/components" # Component directory
  page_dir: "src/pages"           # Pages directory
  api_dir: "src/api"              # API service directory
  ui_library: "shadcn"            # shadcn | antd | mui | chakra | none
```

## 9.3 Commands

### `devflow prompt <JIRA-ID> --frontend`

Generate prompt cho frontend implementation.

```bash
$ devflow prompt PROJ-456 --frontend

🔍 Fetching PROJ-456 from Jira...
📐 Extracting Figma specs (UI-focused mode)...
📁 Scanning frontend codebase...
🧠 Generating frontend prompt...

✅ Prompt saved to: .devflow/prompts/PROJ-456-frontend.md
📋 Copied to clipboard!
```

### `devflow prompt <JIRA-ID> --fullstack`

Generate cả backend + frontend prompts cùng lúc.

```bash
$ devflow prompt PROJ-456 --fullstack

✅ Backend prompt: .devflow/prompts/PROJ-456-backend.md
✅ Frontend prompt: .devflow/prompts/PROJ-456-frontend.md
📋 Backend prompt copied to clipboard!
💡 Run: devflow prompt PROJ-456 --frontend --copy  (to copy frontend prompt)
```

### `devflow figma <URL> --components`

Extract component specs chi tiết cho frontend dev.

```bash
$ devflow figma "https://figma.com/design/abc123..." --components

📦 Component Breakdown:
═══════════════════════════════════════

1. ProfileHeader
   Props: { user: User, onEdit: () => void }
   Layout: flex row, gap-4, items-center
   Responsive: stack vertical on mobile
   Children: Avatar, UserName, EditButton

2. ProfileForm
   Props: { user: User, onSubmit: (data) => void, loading: boolean }
   Fields: 6 inputs (see field table)
   Validation: client-side + server-side
   Layout: grid 2-col desktop, 1-col mobile

3. ProfileStats
   Props: { stats: { posts: number, followers: number, following: number } }
   Layout: flex row, justify-around
   Children: 3x StatCard

📄 Saved to: .devflow/figma-specs/PROJ-456-components.md
```

## 9.4 Frontend Prompt Templates

### 9.4.1 Template: Component (`fe-component.hbs`)

```handlebars
# Task: {{task.summary}} [{{task.key}}] — Frontend

## Context

### Project Info
- **Framework**: {{frontend.framework}} + {{frontend.styling}}
- **Language**: {{frontend.language}}
- **State Management**: {{frontend.state_management}}
- **API Client**: {{frontend.api_client}}
- **UI Library**: {{frontend.ui_library}}

### Task Description
{{task.description}}

### Acceptance Criteria
{{#each task.acceptanceCriteria}}
{{@index}}. {{this}}
{{/each}}

## UI Specs (from Figma)

### Component Tree
{{figma.componentTreeMarkdown}}

### Component Breakdown
{{#each figma.components}}
#### `{{name}}`
- **Type**: {{inferredType}}
- **Props**:
{{#each props}}
  - `{{name}}`: {{type}} {{#if required}}(required){{/if}}
{{/each}}
- **Layout**: {{layoutDescription}}
- **Responsive**: {{responsiveNotes}}
{{#if children.length}}
- **Children**: {{#each children}}{{name}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}
{{/each}}

### Design Tokens
```{{frontend.language}}
// Colors
{{#each figma.designTokens.colors}}
export const {{camelCase name}} = '{{hex}}';
{{/each}}

// Typography
{{#each figma.designTokens.typography}}
// {{name}}: {{fontFamily}} {{fontSize}}px / {{fontWeight}}
{{/each}}

// Spacing
{{#each figma.designTokens.spacing}}
export const spacing{{pascalCase name}} = {{value}};
{{/each}}
```

### Form Fields
{{#if figma.impliedFields.length}}
| Field | Type | Required | Validation | Placeholder |
|-------|------|----------|------------|-------------|
{{#each figma.impliedFields}}
| {{name}} | {{inputType}} | {{#if required}}✅{{else}}❌{{/if}} | {{validationSummary}} | {{placeholder}} |
{{/each}}
{{/if}}

## Backend API (for integration)

### Endpoints to consume
{{#if backendApi}}
{{#each backendApi.endpoints}}
#### `{{method}} {{path}}`
- **Request**: {{requestDescription}}
- **Response**: {{responseDescription}}
- **Auth**: {{auth}}
{{/each}}
{{else}}
> ⚠️ Backend chưa implement. Dùng mock data trước, kết nối API sau.
{{/if}}

{{#if codeContext}}
## Existing Frontend Code

### Related Components
{{#each codeContext.components}}
#### `{{path}}`
```{{language}}
{{content}}
```
{{/each}}

### Existing API Services
{{#each codeContext.apiServices}}
#### `{{path}}`
```{{language}}
{{content}}
```
{{/each}}

### Existing Types/Interfaces
{{#each codeContext.types}}
#### `{{path}}`
```{{language}}
{{content}}
```
{{/each}}
{{/if}}

## Implementation Instructions

### Yêu cầu implement

1. **Component(s)**: Tạo React/Vue component theo Figma specs
2. **Types**: Define TypeScript interfaces cho props và API data
3. **API Service**: Tạo API service function(s) kết nối backend
4. **Form Handling**: Implement form với validation ({{frontend.formLibrary}})
5. **State**: Manage state với {{frontend.state_management}} nếu cần
6. **Responsive**: Mobile-first, match Figma breakpoints
7. **Loading States**: Skeleton/spinner cho async operations
8. **Error Handling**: Display API errors, network errors, validation errors
9. **Tests**: Unit tests cho component + integration tests cho API calls
10. **Accessibility**: Semantic HTML, ARIA labels, keyboard navigation

### File Structure
```
{{frontend.component_dir}}/
├── {{componentName}}/
│   ├── {{componentName}}.{{ext}}       # Main component
│   ├── {{componentName}}.test.{{ext}}  # Tests
│   ├── {{componentName}}.types.ts      # TypeScript types
│   └── index.ts                        # Re-export
{{frontend.api_dir}}/
│   └── {{apiServiceName}}.ts           # API service
```

## Constraints & Standards
{{#each frontend.standards}}
- {{this}}
{{/each}}
```

### 9.4.2 Template: Page (`fe-page.hbs`)

```handlebars
{{!-- Partial cho full page implementation --}}
### Yêu cầu implement

1. **Page Component**: Tạo page component tại `{{frontend.page_dir}}/`
2. **Routing**: Thêm route vào router config
3. **Layout**: Sử dụng existing layout wrapper
4. **SEO**: Page title, meta description (nếu SSR)
5. **Data Fetching**: Load data on mount / SSR prefetch
6. **Sub-components**: Tạo hoặc reuse components cần thiết
7. **Responsive**: Full responsive theo Figma specs
8. **Loading**: Page-level loading state
9. **Error**: Page-level error boundary
10. **Tests**: Page-level integration tests
```

## 9.5 Frontend Codebase Scanner

### 9.5.1 Scan Targets

```javascript
// Khác với backend scanner, frontend scanner tìm:

const frontendScanTargets = {
  // Components liên quan
  components: {
    paths: [config.frontend.component_dir],
    patterns: [/\.tsx?$/, /\.vue$/, /\.jsx?$/],
    matchBy: 'keywords',  // Match component name với task keywords
  },

  // API service files
  apiServices: {
    paths: [config.frontend.api_dir],
    patterns: [/api|service|client/i],
    matchBy: 'keywords',
  },

  // Type definitions
  types: {
    paths: ['src/types', 'src/interfaces', 'src/@types'],
    patterns: [/\.d\.ts$/, /types?\.ts$/, /interface/i],
    matchBy: 'keywords',
  },

  // Store/State files
  stores: {
    paths: ['src/store', 'src/stores', 'src/state'],
    patterns: [/store|slice|atom/i],
    matchBy: 'keywords',
  },

  // Hooks (React)
  hooks: {
    paths: ['src/hooks', 'src/composables'],
    patterns: [/^use[A-Z]/, /\.hook\./],
    matchBy: 'keywords',
  },

  // Router config
  routes: {
    paths: ['src/router', 'src/app'],
    patterns: [/route|router/i],
    matchBy: 'always',  // Always include router context
  },

  // Shared utilities
  utils: {
    paths: ['src/utils', 'src/helpers', 'src/lib'],
    patterns: [/util|helper|lib/i],
    matchBy: 'keywords',
  },
};
```

### 9.5.2 Figma → Component Props Inference

```javascript
// Từ Figma component tree, infer React/Vue props:

function inferComponentProps(figmaNode: ComponentNode): InferredProp[] {
  const props = [];

  // Text nodes → string props
  figmaNode.children
    .filter(c => c.type === 'TEXT' && isDynamic(c))
    .forEach(c => {
      props.push({
        name: camelCase(c.name),        // "User Name" → "userName"
        type: 'string',
        required: true,
      });
    });

  // Image/Avatar → string (url) or File props
  figmaNode.children
    .filter(c => c.inferredType === 'avatar' || c.inferredType === 'image')
    .forEach(c => {
      props.push({
        name: camelCase(c.name) + 'Url',
        type: 'string',
        required: false,
      });
    });

  // Buttons → callback props
  figmaNode.children
    .filter(c => c.inferredType === 'button')
    .forEach(c => {
      props.push({
        name: 'on' + pascalCase(c.name),  // "Edit Button" → "onEditButton"
        type: '() => void',
        required: false,
      });
    });

  // Form → onSubmit + field data type
  if (figmaNode.inferredType === 'form') {
    props.push({
      name: 'onSubmit',
      type: `(data: ${pascalCase(figmaNode.name)}FormData) => void`,
      required: true,
    });
    props.push({
      name: 'loading',
      type: 'boolean',
      required: false,
      defaultValue: 'false',
    });
    props.push({
      name: 'initialValues',
      type: `Partial<${pascalCase(figmaNode.name)}FormData>`,
      required: false,
    });
  }

  // Lists/tables → array data prop
  if (figmaNode.inferredType === 'list' || figmaNode.inferredType === 'table') {
    props.push({
      name: 'items',
      type: `${pascalCase(figmaNode.name)}Item[]`,
      required: true,
    });
  }

  return props;
}

// isDynamic: kiểm tra text có phải placeholder/dynamic content
// Heuristics: text giống "John Doe", "user@email.com", "Lorem ipsum",
// hoặc text ngắn trong component có variant states
function isDynamic(textNode: ComponentNode): boolean {
  const text = textNode.textContent || '';
  const placeholderPatterns = [
    /^(john|jane|user|admin|example)/i,
    /@(example|email|mail)\./i,
    /lorem ipsum/i,
    /\d{1,3}\.\d{1,3}/,  // IP-like
    /^#\d+$/,             // ID-like
    /^\$[\d,.]+$/,        // Price-like
    /^\d+$/,              // Pure numbers
  ];
  return placeholderPatterns.some(p => p.test(text));
}
```

### 9.5.3 API Endpoint Discovery (from Backend)

```javascript
// Nếu backend cùng repo hoặc accessible:
// Scan Laravel routes để biết FE cần gọi API nào

async function discoverBackendAPI(keywords: string[]): Promise<APIEndpoint[]> {
  // Strategy 1: Parse routes/api.php
  const routeFile = findFile('routes/api.php');
  if (routeFile) {
    return parseRoutesPhp(routeFile, keywords);
  }

  // Strategy 2: Parse OpenAPI/Swagger spec nếu có
  const swaggerFile = findFile(['swagger.json', 'openapi.yaml', 'api-docs.json']);
  if (swaggerFile) {
    return parseOpenAPISpec(swaggerFile, keywords);
  }

  // Strategy 3: Parse Postman collection nếu có
  const postmanFile = findFile(['*.postman_collection.json']);
  if (postmanFile) {
    return parsePostmanCollection(postmanFile, keywords);
  }

  // Strategy 4: Không tìm được → return empty, note trong prompt
  return [];
}

interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  auth: string;
  requestBody?: Record<string, FieldSpec>;
  responseBody?: Record<string, FieldSpec>;
  queryParams?: Record<string, FieldSpec>;
}
```

## 9.6 Frontend-specific Config Standards

```yaml
# .devflow.yml
frontend:
  standards:
    - "Component đặt tên PascalCase, file đặt tên PascalCase.tsx"
    - "Dùng named exports, re-export qua index.ts"
    - "Props interface đặt tên {ComponentName}Props"
    - "Mỗi component có thư mục riêng: ComponentName/ComponentName.tsx"
    - "API response phải type-safe, define interface cho mọi response"
    - "Dùng React Query/TanStack Query cho server state"
    - "Dùng Zustand cho client state"
    - "Form validation dùng Zod + React Hook Form"
    - "Tất cả text hiển thị phải qua i18n (nếu multi-language)"
    - "Mobile-first responsive design"
    - "Mọi interactive element phải có loading + error state"
    - "Viết unit test cho business logic, integration test cho user flows"
```

## 9.7 Template Auto-Selection (Updated)

```javascript
function selectTemplate(task: ParsedTask, target: 'backend' | 'frontend' | 'fullstack'): string {
  if (target === 'frontend' || target === 'fullstack') {
    const text = `${task.summary} ${task.description}`.toLowerCase();

    // Page-level task
    if (/\b(page|screen|view|dashboard|landing)\b/.test(text)) return 'fe-page';

    // Component task
    if (/\b(component|widget|card|modal|form|dialog)\b/.test(text)) return 'fe-component';

    // Default: nếu có Figma link → component, không → page
    if (task.figmaLinks.length > 0) return 'fe-component';
    return 'fe-page';
  }

  // Backend selection (existing logic)
  return selectBackendTemplate(task);
}
```
