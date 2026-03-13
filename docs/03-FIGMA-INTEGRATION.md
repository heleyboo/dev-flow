# Feature 2: Figma → Extract Specs

## 3.1 Mục tiêu

Tự động extract thông tin design từ Figma, biến thành technical specs mà developer và Claude Code có thể hiểu: danh sách components, layout structure, spacing, colors, API fields implied by UI, và responsive breakpoints.

## 3.2 Commands

### `devflow figma <URL_OR_JIRA_ID>`

Extract specs từ Figma file/frame.

```bash
# Từ Figma URL trực tiếp
$ devflow figma "https://figma.com/design/abc123/Project?node-id=456:789"

# Hoặc tự động lấy Figma link từ Jira task
$ devflow figma PROJ-456

📐 Figma Specs: User Profile Page
══════════════════════════════════════

📄 Page: User Profile
├── Frame: Profile Header (1440x280)
│   ├── Component: Avatar (120x120, circle, border: 2px #E5E7EB)
│   ├── Component: UserName (Text, 24px, font-weight: 700, #111827)
│   ├── Component: UserBio (Text, 14px, font-weight: 400, #6B7280, max-lines: 3)
│   └── Component: EditButton (Button, 36x36, icon: pencil)
│
├── Frame: Profile Form (1440x auto)
│   ├── Input: Full Name (text, required, placeholder: "Enter full name")
│   ├── Input: Email (email, required, disabled)
│   ├── Input: Phone (tel, optional, placeholder: "+84...")
│   ├── Input: Bio (textarea, optional, max: 500 chars)
│   ├── Select: Country (dropdown, required)
│   ├── Input: Avatar Upload (file, image/*, max: 5MB)
│   └── Button: Save Changes (primary, full-width-mobile)
│
└── Frame: Profile Stats (1440x160)
    ├── Stat: Posts Count
    ├── Stat: Followers
    └── Stat: Following

🎨 Design Tokens:
  Primary: #2563EB    Text: #111827    Border: #E5E7EB
  Background: #FFFFFF  Muted: #6B7280  Error: #DC2626

📱 Responsive Notes:
  Desktop: 1440px (3 columns)
  Tablet: 768px (2 columns)
  Mobile: 375px (1 column, stack vertical)

💡 Implied API Fields:
  - full_name (string, required, max: 100)
  - email (string, required, readonly)
  - phone (string, nullable)
  - bio (string, nullable, max: 500)
  - country_id (integer, required, FK: countries)
  - avatar (file, image/*, max: 5MB)
```

**Options:**
- `--node <node-id>` — Target specific frame/component
- `--depth <n>` — How deep to traverse component tree (default: 3)
- `--format md|json|yaml` — Output format (default: md)
- `--save` — Save to `.devflow/figma-specs/`
- `--images` — Export key frames as PNG (for reference)
- `--tokens` — Extract only design tokens (colors, typography, spacing)

### `devflow figma components <URL>`

List tất cả reusable components trong Figma file.

```bash
$ devflow figma components "https://figma.com/file/abc123"

📦 Components Found: 24
  Button/Primary    Button/Secondary    Button/Danger
  Input/Text        Input/Textarea      Input/Select
  Card/Default      Card/Compact        Avatar/Circle
  Badge/Status      Modal/Default       Toast/Success
  ...
```

## 3.3 Figma Service — Chi tiết kỹ thuật

### 3.3.1 Authentication

```javascript
// Figma REST API
// Auth: Personal Access Token

const headers = {
  'X-Figma-Token': process.env.DEVFLOW_FIGMA_TOKEN
};
```

### 3.3.2 API Endpoints cần dùng

| Mục đích | Method | Endpoint |
|----------|--------|----------|
| Lấy file structure | GET | `/v1/files/{file_key}` |
| Lấy specific nodes | GET | `/v1/files/{file_key}/nodes?ids={node_ids}` |
| Lấy images (export) | GET | `/v1/images/{file_key}?ids={node_ids}&format=png` |
| Lấy components | GET | `/v1/files/{file_key}/components` |
| Lấy styles | GET | `/v1/files/{file_key}/styles` |
| Lấy comments | GET | `/v1/files/{file_key}/comments` |

### 3.3.3 URL Parser

```javascript
// Parse Figma URL thành file_key và node_id
// Formats:
//   https://figma.com/file/{file_key}/{title}
//   https://figma.com/design/{file_key}/{title}?node-id={node_id}
//   https://figma.com/proto/{file_key}/{title}?node-id={node_id}
//   https://figma.com/board/{file_key}/{title}

function parseFigmaUrl(url: string): {
  fileKey: string;
  nodeId: string | null;
  type: 'file' | 'design' | 'proto' | 'board';
}
```

### 3.3.4 Data Model — Extracted Specs

```typescript
interface FigmaSpecs {
  fileName: string;
  fileKey: string;
  lastModified: string;

  // Targeted frame/page
  targetNode: {
    id: string;
    name: string;
    type: string;       // "FRAME", "PAGE", "COMPONENT"
    width: number;
    height: number;
  };

  // Component tree
  componentTree: ComponentNode[];

  // Design tokens
  designTokens: {
    colors: Array<{
      name: string;
      hex: string;
      usage: string;    // "primary", "background", "text", etc.
    }>;
    typography: Array<{
      name: string;
      fontFamily: string;
      fontSize: number;
      fontWeight: number;
      lineHeight: number;
      letterSpacing: number;
    }>;
    spacing: Array<{
      name: string;
      value: number;
    }>;
    borderRadius: Array<{
      name: string;
      value: number;
    }>;
  };

  // Implied from UI
  impliedFields: Array<{
    name: string;           // "full_name" (sanitized from label)
    type: string;           // "string", "integer", "file", "boolean"
    inputType: string;      // "text", "email", "textarea", "select", "file", "checkbox"
    required: boolean;      // Inferred from asterisk (*) or "required" text
    validation: {
      maxLength?: number;   // From counter or placeholder hints
      pattern?: string;     // From input type (email, phone, etc.)
      maxFileSize?: string; // From helper text
      acceptedTypes?: string[];
    };
    placeholder?: string;
    defaultValue?: string;
    options?: string[];     // For selects/dropdowns
  }>;

  // Responsive
  responsiveBreakpoints: Array<{
    name: string;          // "desktop", "tablet", "mobile"
    width: number;
    layout: string;        // Description of layout changes
  }>;

  // Images exported
  exportedImages: Array<{
    nodeId: string;
    name: string;
    url: string;           // Temporary Figma CDN URL
    localPath: string;     // After download
  }>;
}

interface ComponentNode {
  id: string;
  name: string;
  type: 'FRAME' | 'COMPONENT' | 'INSTANCE' | 'TEXT' | 'RECTANGLE'
       | 'ELLIPSE' | 'GROUP' | 'VECTOR';
  bounds: { x: number; y: number; width: number; height: number };

  // Visual properties
  fills: Array<{ type: string; color: string; opacity: number }>;
  strokes: Array<{ type: string; color: string; weight: number }>;
  cornerRadius: number | null;
  opacity: number;

  // Text specific
  textContent?: string;
  textStyle?: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    textAlign: string;
  };

  // Layout
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  spacing?: number;
  padding?: { top: number; right: number; bottom: number; left: number };

  // Nesting
  children: ComponentNode[];

  // UI element inference
  inferredType?: 'button' | 'input' | 'select' | 'checkbox' | 'radio'
                | 'toggle' | 'card' | 'modal' | 'avatar' | 'badge'
                | 'table' | 'list' | 'navigation' | 'form' | 'image';
}
```

### 3.3.5 UI Element Inference Engine

Đây là phần quan trọng nhất — tự động nhận diện UI element từ Figma node structure:

```javascript
// Inference rules (heuristics):

// Button detection:
//   - Rectangle/Frame + Text child
//   - Name contains "button", "btn", "cta"
//   - Has fill color + text centered
//   - Corner radius > 0
//   - Width/height ratio suggests clickable element

// Input detection:
//   - Rectangle with border, light/white fill
//   - Name contains "input", "field", "textfield"
//   - Has placeholder text (lighter color text)
//   - Child text node with specific patterns

// Select/Dropdown detection:
//   - Input-like + chevron/arrow icon child
//   - Name contains "select", "dropdown", "picker"

// Form detection:
//   - Frame containing multiple input-like children
//   - Vertical layout with consistent spacing
//   - Has a button child (submit)

// Table detection:
//   - Grid-like layout with consistent row heights
//   - Header row with different styling
//   - Name contains "table", "list", "grid"

// Avatar detection:
//   - Circle (equal w/h + full corner radius) with image fill
//   - Name contains "avatar", "profile", "photo"

// Required field detection:
//   - Label text contains "*" or "(required)"
//   - Red asterisk as separate text node near label

// Validation hint detection:
//   - Small text below input with specific patterns:
//     "max X characters", "X chars remaining"
//     "format: xxx", "e.g., xxx"
//     Helper text about constraints
```

### 3.3.6 Field Name Sanitization

```javascript
// Convert Figma label text → code-friendly field name
// "Full Name" → "full_name"
// "Email Address" → "email_address"
// "Phone Number (Optional)" → "phone_number"
// "Upload Avatar" → "avatar"
// "Select Country" → "country_id" (append _id for selects)
// "I agree to Terms" → "agree_terms" (boolean for checkboxes)

function sanitizeFieldName(label: string): string {
  return label
    .replace(/\(.*?\)/g, '')         // Remove parenthetical notes
    .replace(/[^a-zA-Z0-9\s]/g, '')  // Remove special chars
    .trim()
    .replace(/\s+/g, '_')            // Spaces to underscores
    .toLowerCase()
    .replace(/^(upload|select|choose|enter|input)_/i, '') // Remove action prefixes
    ;
}
```

## 3.4 Limitations & Fallbacks

| Scenario | Behavior |
|----------|----------|
| File quá lớn (>500 nodes) | Warn user, suggest targeting specific frame via --node |
| Private file không có quyền | Guide user check token permissions |
| Design dùng variants phức tạp | Flatten to base states, note variants in output |
| Auto-import fonts không có | List fonts needed, skip font rendering |
| Inference sai element type | Output includes raw data, user có thể correct |
| Rate limit (Figma ~30 req/min) | Auto-batch requests, add delay between calls |

## 3.5 Caching

```javascript
// Cache Figma responses locally vì API chậm (~2-5s per call)
// Location: .devflow/cache/figma/
// Key: {file_key}_{node_id}_{last_modified}.json
// TTL: 1 hour (configurable)
// Invalidation: khi lastModified của file thay đổi

// Cache strategy:
// 1. Check local cache first
// 2. HEAD request to check lastModified
// 3. If unchanged → use cache
// 4. If changed → fetch fresh, update cache
```
