# Jira Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Jira REST API v3 to fetch, parse, and display tasks with ADF-to-markdown conversion, link extraction, and acceptance criteria parsing.

**Architecture:** Three layers — ADF parser (converts Jira's Atlassian Document Format to markdown), JiraService (API client wrapping fetch with auth/retry), and task commands (CLI display). The ADF parser is a standalone pure-function module. JiraService uses the existing `apiRequest` utility for retry/rate-limit handling. Config comes from `.devflow.yml` jira section + `DEVFLOW_JIRA_TOKEN` env var.

**Tech Stack:** Node.js ES modules, Vitest, native fetch (Node 18+), chalk for display, existing `apiRequest` utility for retry logic.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/parsers/adf-parser.js` | Pure function: ADF JSON → markdown string |
| `src/services/jira.service.js` | Jira API client: auth, fetch issues, search, transitions, comments |
| `src/commands/task.js` | CLI handlers: `task get`, `task list` — fetch + format + display |
| `tests/unit/adf-parser.test.js` | ADF parser tests |
| `tests/unit/jira.service.test.js` | Jira service tests (mocked fetch) |
| `tests/unit/task.test.js` | Task command tests (mocked JiraService) |

---

## Chunk 1: ADF Parser

### Task 1: ADF Parser — Basic Node Types

**Files:**
- Create: `src/parsers/adf-parser.js`
- Create: `tests/unit/adf-parser.test.js`

- [ ] **Step 1: Write failing tests for basic ADF nodes**

```javascript
// tests/unit/adf-parser.test.js
import { describe, it, expect } from 'vitest';
import { adfToMarkdown } from '../../src/parsers/adf-parser.js';

describe('ADF Parser', () => {
  it('converts empty doc', () => {
    const adf = { type: 'doc', version: 1, content: [] };
    expect(adfToMarkdown(adf)).toBe('');
  });

  it('converts paragraph', () => {
    const adf = {
      type: 'doc', version: 1,
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Hello world' }],
      }],
    };
    expect(adfToMarkdown(adf)).toBe('Hello world');
  });

  it('converts headings (h1-h3)', () => {
    const adf = {
      type: 'doc', version: 1,
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Subtitle' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Section' }] },
      ],
    };
    const md = adfToMarkdown(adf);
    expect(md).toContain('# Title');
    expect(md).toContain('## Subtitle');
    expect(md).toContain('### Section');
  });

  it('converts text marks (bold, italic, code, link)', () => {
    const adf = {
      type: 'doc', version: 1,
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'bold', marks: [{ type: 'strong' }] },
          { type: 'text', text: ' ' },
          { type: 'text', text: 'italic', marks: [{ type: 'em' }] },
          { type: 'text', text: ' ' },
          { type: 'text', text: 'code', marks: [{ type: 'code' }] },
          { type: 'text', text: ' ' },
          { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
        ],
      }],
    };
    const md = adfToMarkdown(adf);
    expect(md).toContain('**bold**');
    expect(md).toContain('*italic*');
    expect(md).toContain('`code`');
    expect(md).toContain('[link](https://example.com)');
  });

  it('converts bullet list', () => {
    const adf = {
      type: 'doc', version: 1,
      content: [{
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] }] },
        ],
      }],
    };
    const md = adfToMarkdown(adf);
    expect(md).toContain('- Item 1');
    expect(md).toContain('- Item 2');
  });

  it('converts ordered list', () => {
    const adf = {
      type: 'doc', version: 1,
      content: [{
        type: 'orderedList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }] },
        ],
      }],
    };
    const md = adfToMarkdown(adf);
    expect(md).toContain('1. First');
    expect(md).toContain('2. Second');
  });

  it('converts code block', () => {
    const adf = {
      type: 'doc', version: 1,
      content: [{
        type: 'codeBlock',
        attrs: { language: 'javascript' },
        content: [{ type: 'text', text: 'const x = 1;' }],
      }],
    };
    const md = adfToMarkdown(adf);
    expect(md).toContain('```javascript');
    expect(md).toContain('const x = 1;');
    expect(md).toContain('```');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/adf-parser.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ADF parser**

```javascript
// src/parsers/adf-parser.js

export function adfToMarkdown(adf) {
  if (!adf || !adf.content) return '';
  return renderNodes(adf.content).trim();
}

function renderNodes(nodes, context = {}) {
  if (!nodes) return '';
  return nodes.map(node => renderNode(node, context)).join('');
}

function renderNode(node, context = {}) {
  switch (node.type) {
    case 'doc':
      return renderNodes(node.content, context);

    case 'paragraph':
      return renderNodes(node.content, context) + '\n\n';

    case 'heading': {
      const level = node.attrs?.level || 1;
      const prefix = '#'.repeat(level);
      return `${prefix} ${renderNodes(node.content, context)}\n\n`;
    }

    case 'text':
      return applyMarks(node.text || '', node.marks);

    case 'hardBreak':
      return '\n';

    case 'bulletList':
      return node.content.map(item =>
        renderListItem(item, '- ')
      ).join('') + '\n';

    case 'orderedList':
      return node.content.map((item, i) =>
        renderListItem(item, `${i + 1}. `)
      ).join('') + '\n';

    case 'listItem':
      return renderNodes(node.content, context);

    case 'codeBlock': {
      const lang = node.attrs?.language || '';
      const code = renderNodes(node.content, context).trim();
      return `\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
    }

    case 'blockquote':
      return renderNodes(node.content, context)
        .split('\n')
        .filter(line => line !== '')
        .map(line => `> ${line}`)
        .join('\n') + '\n\n';

    case 'rule':
      return '---\n\n';

    case 'table':
      return renderTable(node) + '\n';

    case 'mediaSingle':
    case 'mediaGroup':
      return renderNodes(node.content, context);

    case 'media':
      return `![image](${node.attrs?.url || node.attrs?.id || ''})\n\n`;

    case 'inlineCard':
      return `[${node.attrs?.url || ''}](${node.attrs?.url || ''})`;

    case 'mention':
      return `@${node.attrs?.text || node.attrs?.id || 'unknown'}`;

    case 'emoji':
      return node.attrs?.shortName || node.attrs?.text || '';

    case 'panel': {
      const panelType = node.attrs?.panelType || 'info';
      const prefix = panelType === 'warning' ? '⚠️ ' : panelType === 'error' ? '❌ ' : 'ℹ️ ';
      const body = renderNodes(node.content, context).trim();
      return `> ${prefix}${body}\n\n`;
    }

    default:
      if (node.content) return renderNodes(node.content, context);
      return '';
  }
}

function renderListItem(item, prefix) {
  const content = renderNodes(item.content).replace(/\n\n$/, '\n');
  return `${prefix}${content.trim()}\n`;
}

function applyMarks(text, marks) {
  if (!marks || marks.length === 0) return text;
  let result = text;
  for (const mark of marks) {
    switch (mark.type) {
      case 'strong':
        result = `**${result}**`;
        break;
      case 'em':
        result = `*${result}*`;
        break;
      case 'code':
        result = `\`${result}\``;
        break;
      case 'strike':
        result = `~~${result}~~`;
        break;
      case 'link':
        result = `[${result}](${mark.attrs?.href || ''})`;
        break;
      case 'underline':
        result = `<u>${result}</u>`;
        break;
    }
  }
  return result;
}

function renderTable(tableNode) {
  if (!tableNode.content) return '';
  const rows = tableNode.content;
  const result = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = (row.content || []).map(cell => {
      return renderNodes(cell.content).replace(/\n+/g, ' ').trim();
    });
    result.push(`| ${cells.join(' | ')} |`);

    if (i === 0) {
      result.push(`| ${cells.map(() => '---').join(' | ')} |`);
    }
  }

  return result.join('\n') + '\n';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/adf-parser.test.js`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/parsers/adf-parser.js tests/unit/adf-parser.test.js
git commit -m "feat: add ADF-to-markdown parser for Jira descriptions"
```

### Task 2: ADF Parser — Advanced Nodes (table, panel, inlineCard, mention)

**Files:**
- Modify: `tests/unit/adf-parser.test.js`

- [ ] **Step 1: Add tests for advanced ADF nodes**

```javascript
// Add to tests/unit/adf-parser.test.js

  it('converts table', () => {
    const adf = {
      type: 'doc', version: 1,
      content: [{
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Name' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Value' }] }] },
            ],
          },
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'foo' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'bar' }] }] },
            ],
          },
        ],
      }],
    };
    const md = adfToMarkdown(adf);
    expect(md).toContain('| Name | Value |');
    expect(md).toContain('| --- | --- |');
    expect(md).toContain('| foo | bar |');
  });

  it('converts panel (info/warning/error)', () => {
    const adf = {
      type: 'doc', version: 1,
      content: [{
        type: 'panel',
        attrs: { panelType: 'warning' },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Be careful!' }] }],
      }],
    };
    const md = adfToMarkdown(adf);
    expect(md).toContain('> ⚠️ Be careful!');
  });

  it('converts inlineCard (Figma/Confluence links)', () => {
    const adf = {
      type: 'doc', version: 1,
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Design: ' },
          { type: 'inlineCard', attrs: { url: 'https://figma.com/file/abc123' } },
        ],
      }],
    };
    const md = adfToMarkdown(adf);
    expect(md).toContain('[https://figma.com/file/abc123](https://figma.com/file/abc123)');
  });

  it('converts mention', () => {
    const adf = {
      type: 'doc', version: 1,
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Assigned to ' },
          { type: 'mention', attrs: { id: '123', text: 'John' } },
        ],
      }],
    };
    const md = adfToMarkdown(adf);
    expect(md).toContain('@John');
  });

  it('handles null/undefined input', () => {
    expect(adfToMarkdown(null)).toBe('');
    expect(adfToMarkdown(undefined)).toBe('');
    expect(adfToMarkdown({})).toBe('');
  });

  it('handles blockquote', () => {
    const adf = {
      type: 'doc', version: 1,
      content: [{
        type: 'blockquote',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quoted text' }] }],
      }],
    };
    const md = adfToMarkdown(adf);
    expect(md).toContain('> Quoted text');
  });
```

- [ ] **Step 2: Run tests — all should pass since implementation already handles these**

Run: `npx vitest run tests/unit/adf-parser.test.js`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add tests/unit/adf-parser.test.js
git commit -m "test: add advanced ADF node tests (table, panel, inlineCard, mention)"
```

### Task 3: Link Extractor and Acceptance Criteria Parser

**Files:**
- Create: `src/parsers/link-extractor.js`
- Create: `tests/unit/link-extractor.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
// tests/unit/link-extractor.test.js
import { describe, it, expect } from 'vitest';
import { extractFigmaLinks, extractSrsReferences, extractAcceptanceCriteria } from '../../src/parsers/link-extractor.js';

describe('extractFigmaLinks', () => {
  it('extracts Figma file URLs from text', () => {
    const text = 'See design at https://figma.com/file/abc123/My-Design and also https://www.figma.com/design/xyz789/Other';
    const links = extractFigmaLinks(text);
    expect(links).toHaveLength(2);
    expect(links[0]).toContain('figma.com/file/abc123');
    expect(links[1]).toContain('figma.com/design/xyz789');
  });

  it('extracts Figma proto and board URLs', () => {
    const text = 'Proto: https://figma.com/proto/abc123 Board: https://figma.com/board/def456';
    const links = extractFigmaLinks(text);
    expect(links).toHaveLength(2);
  });

  it('returns empty array when no Figma links', () => {
    expect(extractFigmaLinks('No links here')).toEqual([]);
    expect(extractFigmaLinks('')).toEqual([]);
  });

  it('deduplicates links', () => {
    const text = 'https://figma.com/file/abc123 and again https://figma.com/file/abc123';
    expect(extractFigmaLinks(text)).toHaveLength(1);
  });
});

describe('extractSrsReferences', () => {
  it('extracts SRS section references', () => {
    const text = 'See SRS Section 4.2 and SRS-Section 5.1';
    const refs = extractSrsReferences(text);
    expect(refs.length).toBeGreaterThanOrEqual(2);
  });

  it('extracts requirement IDs', () => {
    const text = 'Implements REQ-4.2.1 and requirement #AUTH-001';
    const refs = extractSrsReferences(text);
    expect(refs.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty array when no references', () => {
    expect(extractSrsReferences('No refs')).toEqual([]);
  });
});

describe('extractAcceptanceCriteria', () => {
  it('extracts numbered list after AC heading', () => {
    const md = `## Acceptance Criteria\n1. User can login\n2. User sees dashboard\n3. Error shown on bad password`;
    const ac = extractAcceptanceCriteria(md);
    expect(ac).toHaveLength(3);
    expect(ac[0]).toContain('User can login');
  });

  it('extracts checkbox list', () => {
    const md = `## AC\n- [ ] Create endpoint\n- [ ] Add validation\n- [x] Design schema`;
    const ac = extractAcceptanceCriteria(md);
    expect(ac).toHaveLength(3);
  });

  it('extracts Given/When/Then format', () => {
    const md = `## Acceptance Criteria\nGiven a logged-in user\nWhen they visit /profile\nThen they see their name`;
    const ac = extractAcceptanceCriteria(md);
    expect(ac.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty array when no AC found', () => {
    expect(extractAcceptanceCriteria('Just a description')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/link-extractor.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement link extractor**

```javascript
// src/parsers/link-extractor.js

const FIGMA_PATTERNS = [
  /https?:\/\/(?:www\.)?figma\.com\/(?:file|design|proto|board)\/[\w-]+(?:\/[\w%-]*)*/g,
];

const SRS_PATTERNS = [
  /SRS[\s-]*(?:Section|§)?\s*[\d.]+/gi,
  /(?:requirement|req)[\s-]*#?\s*[\w.-]+/gi,
];

export function extractFigmaLinks(text) {
  if (!text) return [];
  const links = new Set();
  for (const pattern of FIGMA_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) matches.forEach(m => links.add(m));
  }
  return [...links];
}

export function extractSrsReferences(text) {
  if (!text) return [];
  const refs = new Set();
  for (const pattern of SRS_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) matches.forEach(m => refs.add(m.trim()));
  }
  return [...refs];
}

export function extractAcceptanceCriteria(markdown) {
  if (!markdown) return [];

  // Find AC section by heading
  const acHeadingPattern = /^#{1,3}\s*(?:Acceptance\s*Criteria|AC)\s*:?\s*$/im;
  const headingMatch = markdown.match(acHeadingPattern);

  let acSection = '';
  if (headingMatch) {
    const startIdx = headingMatch.index + headingMatch[0].length;
    const nextHeading = markdown.slice(startIdx).search(/^#{1,3}\s/m);
    acSection = nextHeading >= 0
      ? markdown.slice(startIdx, startIdx + nextHeading)
      : markdown.slice(startIdx);
  } else {
    // Try "AC:" inline prefix
    const inlineMatch = markdown.match(/^AC\s*:\s*(.+)/im);
    if (inlineMatch) {
      acSection = markdown.slice(inlineMatch.index);
    }
  }

  if (!acSection.trim()) return [];

  const criteria = [];

  // Numbered list: "1. something"
  const numbered = acSection.match(/^\d+\.\s+.+$/gm);
  if (numbered) {
    numbered.forEach(item => criteria.push(item.replace(/^\d+\.\s+/, '').trim()));
  }

  // Checkbox list: "- [ ] something" or "- [x] something"
  const checkboxes = acSection.match(/^-\s*\[[ x]\]\s+.+$/gm);
  if (checkboxes) {
    checkboxes.forEach(item => criteria.push(item.replace(/^-\s*\[[ x]\]\s+/, '').trim()));
  }

  // Given/When/Then blocks
  if (criteria.length === 0) {
    const gwtBlocks = acSection.match(/Given\s.+?(?=Given\s|$)/gs);
    if (gwtBlocks) {
      gwtBlocks.forEach(block => criteria.push(block.trim()));
    }
  }

  return criteria;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/link-extractor.test.js`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/parsers/link-extractor.js tests/unit/link-extractor.test.js
git commit -m "feat: add Figma link, SRS reference, and acceptance criteria extractors"
```

---

## Chunk 2: Jira Service

### Task 4: JiraService — Authentication and getIssue

**Files:**
- Modify: `src/services/jira.service.js`
- Create: `tests/unit/jira.service.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
// tests/unit/jira.service.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JiraService } from '../../src/services/jira.service.js';

// Mock config
vi.mock('../../src/utils/config.js', () => ({
  loadConfig: () => ({
    jira: {
      host: 'https://test.atlassian.net',
      email: 'dev@test.com',
      project_key: 'PROJ',
    },
  }),
  resetConfig: vi.fn(),
}));

describe('JiraService', () => {
  let service;
  let mockFetch;

  beforeEach(() => {
    service = new JiraService();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  describe('constructor', () => {
    it('builds auth header from config and env', () => {
      process.env.DEVFLOW_JIRA_TOKEN = 'test-token';
      const svc = new JiraService();
      expect(svc.baseUrl).toBe('https://test.atlassian.net');
      expect(svc.headers.Authorization).toContain('Basic ');
      delete process.env.DEVFLOW_JIRA_TOKEN;
    });
  });

  describe('getIssue', () => {
    it('fetches and parses issue into ParsedTask', async () => {
      process.env.DEVFLOW_JIRA_TOKEN = 'test-token';
      const svc = new JiraService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          key: 'PROJ-123',
          fields: {
            summary: 'Test task',
            description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A description' }] }] },
            issuetype: { name: 'Story' },
            priority: { name: 'High' },
            status: { name: 'In Progress' },
            assignee: { displayName: 'Dev User', emailAddress: 'dev@test.com' },
            reporter: { displayName: 'PM User' },
            labels: ['backend'],
            components: [{ name: 'API' }],
            fixVersions: [{ name: '1.0' }],
            subtasks: [
              { key: 'PROJ-124', fields: { summary: 'Sub 1', status: { name: 'Done' } } },
            ],
            issuelinks: [],
            comment: { comments: [] },
            customfield_10016: 5, // story points
            parent: { key: 'PROJ-100', fields: { summary: 'Epic name' } },
          },
        }),
      });

      const task = await svc.getIssue('PROJ-123');
      expect(task.key).toBe('PROJ-123');
      expect(task.summary).toBe('Test task');
      expect(task.type).toBe('story');
      expect(task.priority).toBe('high');
      expect(task.status).toBe('In Progress');
      expect(task.description).toContain('A description');
      expect(task.subtasks).toHaveLength(1);
      expect(task.storyPoints).toBe(5);

      delete process.env.DEVFLOW_JIRA_TOKEN;
    });

    it('throws on 401', async () => {
      process.env.DEVFLOW_JIRA_TOKEN = 'bad-token';
      const svc = new JiraService();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(svc.getIssue('PROJ-123')).rejects.toThrow(/401|Unauthorized|auth/i);
      delete process.env.DEVFLOW_JIRA_TOKEN;
    });

    it('throws on 404', async () => {
      process.env.DEVFLOW_JIRA_TOKEN = 'test-token';
      const svc = new JiraService();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(svc.getIssue('PROJ-999')).rejects.toThrow(/404|not found/i);
      delete process.env.DEVFLOW_JIRA_TOKEN;
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/jira.service.test.js`
Expected: FAIL

- [ ] **Step 3: Implement JiraService**

```javascript
// src/services/jira.service.js
import { loadConfig } from '../utils/config.js';
import { adfToMarkdown } from '../parsers/adf-parser.js';
import { extractFigmaLinks, extractSrsReferences, extractAcceptanceCriteria } from '../parsers/link-extractor.js';

export class JiraService {
  constructor(config) {
    const cfg = config || loadConfig();
    const jira = cfg?.jira || {};
    this.baseUrl = jira.host || '';
    this.projectKey = jira.project_key || '';
    this.email = jira.email || '';
    this.token = process.env.DEVFLOW_JIRA_TOKEN || '';
    this.storyPointsField = jira.story_points_field || 'customfield_10016';
    this.customFields = jira.custom_fields || {};

    const auth = Buffer.from(`${this.email}:${this.token}`).toString('base64');
    this.headers = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  async getIssue(issueKey) {
    const url = `${this.baseUrl}/rest/api/3/issue/${issueKey}?expand=names`;
    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      if (response.status === 401) throw new Error(`401 Unauthorized: Check DEVFLOW_JIRA_TOKEN and jira.email in config`);
      if (response.status === 404) throw new Error(`404 Not Found: Issue ${issueKey} not found`);
      throw new Error(`Jira API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return this.parseIssue(data);
  }

  parseIssue(data) {
    const f = data.fields;
    const descriptionMd = f.description ? adfToMarkdown(f.description) : '';
    const figmaLinksFromDesc = extractFigmaLinks(descriptionMd);
    const srsFromDesc = extractSrsReferences(descriptionMd);
    const acceptanceCriteria = extractAcceptanceCriteria(descriptionMd);

    // Also check custom fields for Figma links
    const figmaFromCustom = [];
    for (const [, fieldKey] of Object.entries(this.customFields)) {
      const val = f[fieldKey];
      if (typeof val === 'string') {
        figmaFromCustom.push(...extractFigmaLinks(val));
      }
    }

    const figmaLinks = [...new Set([...figmaLinksFromDesc, ...figmaFromCustom])];
    const srsReferences = [...new Set(srsFromDesc)];

    const linkedIssues = (f.issuelinks || []).map(link => {
      const isInward = !!link.inwardIssue;
      const issue = link.inwardIssue || link.outwardIssue;
      return {
        type: isInward ? link.type.inward : link.type.outward,
        key: issue?.key || '',
        summary: issue?.fields?.summary || '',
        status: issue?.fields?.status?.name || '',
      };
    }).filter(l => l.key);

    const comments = (f.comment?.comments || []).map(c => ({
      author: c.author?.displayName || '',
      body: c.body ? adfToMarkdown(c.body) : '',
      created: c.created || '',
    }));

    return {
      key: data.key,
      summary: f.summary || '',
      description: descriptionMd,
      type: (f.issuetype?.name || '').toLowerCase(),
      priority: (f.priority?.name || '').toLowerCase(),
      status: f.status?.name || '',
      assignee: f.assignee?.displayName || f.assignee?.emailAddress || '',
      reporter: f.reporter?.displayName || '',
      sprint: f.sprint?.name || null,
      storyPoints: f[this.storyPointsField] || null,
      epic: f.parent?.fields?.issuetype?.name === 'Epic'
        ? { key: f.parent.key, summary: f.parent.fields.summary }
        : null,
      parent: f.parent
        ? { key: f.parent.key, summary: f.parent.fields?.summary || '' }
        : null,
      subtasks: (f.subtasks || []).map(s => ({
        key: s.key,
        summary: s.fields?.summary || '',
        status: s.fields?.status?.name || '',
      })),
      figmaLinks,
      srsReferences,
      linkedIssues,
      acceptanceCriteria,
      labels: f.labels || [],
      components: (f.components || []).map(c => c.name),
      fixVersions: (f.fixVersions || []).map(v => v.name),
      comments,
      customFields: {},
      _raw: data,
    };
  }

  async searchIssues(jql) {
    const url = `${this.baseUrl}/rest/api/3/search`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        jql,
        maxResults: 50,
        fields: ['summary', 'status', 'priority', 'issuetype', 'assignee', 'sprint', this.storyPointsField],
      }),
    });

    if (!response.ok) {
      throw new Error(`Jira search error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return (data.issues || []).map(issue => ({
      key: issue.key,
      summary: issue.fields?.summary || '',
      status: issue.fields?.status?.name || '',
      priority: (issue.fields?.priority?.name || '').toLowerCase(),
      type: (issue.fields?.issuetype?.name || '').toLowerCase(),
      assignee: issue.fields?.assignee?.displayName || '',
    }));
  }

  async listMyTasks(filters = {}) {
    const parts = ['assignee = currentUser()'];
    if (filters.status) {
      const statusMap = { todo: '"To Do"', inprogress: '"In Progress"', review: '"In Review"', done: '"Done"' };
      parts.push(`status = ${statusMap[filters.status] || `"${filters.status}"`}`);
    }
    if (filters.sprint) {
      parts.push(`sprint = "${filters.sprint}"`);
    }
    if (filters.priority) {
      parts.push(`priority = "${filters.priority}"`);
    }
    if (this.projectKey) {
      parts.push(`project = ${this.projectKey}`);
    }
    parts.push('ORDER BY status ASC, priority DESC');
    return this.searchIssues(parts.join(' AND '));
  }

  async transitionIssue(issueKey, transitionName) {
    const transUrl = `${this.baseUrl}/rest/api/3/issue/${issueKey}/transitions`;
    const transResponse = await fetch(transUrl, { headers: this.headers });
    if (!transResponse.ok) throw new Error(`Failed to get transitions: ${transResponse.status}`);

    const { transitions } = await transResponse.json();
    const target = transitions.find(t => t.name.toLowerCase() === transitionName.toLowerCase());
    if (!target) throw new Error(`Transition "${transitionName}" not found. Available: ${transitions.map(t => t.name).join(', ')}`);

    const response = await fetch(transUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ transition: { id: target.id } }),
    });
    if (!response.ok) throw new Error(`Transition failed: ${response.status}`);
  }

  async addComment(issueKey, body) {
    const url = `${this.baseUrl}/rest/api/3/issue/${issueKey}/comment`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        body: {
          type: 'doc', version: 1,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }],
        },
      }),
    });
    if (!response.ok) throw new Error(`Add comment failed: ${response.status}`);
    return response.json();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/jira.service.test.js`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/jira.service.js tests/unit/jira.service.test.js
git commit -m "feat: implement JiraService with getIssue, search, transitions, and comments"
```

### Task 5: JiraService — listMyTasks, transitionIssue, addComment tests

**Files:**
- Modify: `tests/unit/jira.service.test.js`

- [ ] **Step 1: Add tests for remaining methods**

```javascript
// Add to tests/unit/jira.service.test.js

  describe('listMyTasks', () => {
    it('searches with JQL for current user', async () => {
      process.env.DEVFLOW_JIRA_TOKEN = 'test-token';
      const svc = new JiraService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          issues: [
            { key: 'PROJ-1', fields: { summary: 'Task 1', status: { name: 'To Do' }, priority: { name: 'High' }, issuetype: { name: 'Story' }, assignee: { displayName: 'Dev' } } },
            { key: 'PROJ-2', fields: { summary: 'Task 2', status: { name: 'In Progress' }, priority: { name: 'Medium' }, issuetype: { name: 'Bug' }, assignee: { displayName: 'Dev' } } },
          ],
        }),
      });

      const tasks = await svc.listMyTasks();
      expect(tasks).toHaveLength(2);
      expect(tasks[0].key).toBe('PROJ-1');

      // Verify JQL includes assignee and project
      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.jql).toContain('assignee = currentUser()');
      expect(body.jql).toContain('project = PROJ');

      delete process.env.DEVFLOW_JIRA_TOKEN;
    });

    it('applies status filter', async () => {
      process.env.DEVFLOW_JIRA_TOKEN = 'test-token';
      const svc = new JiraService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ issues: [] }),
      });

      await svc.listMyTasks({ status: 'inprogress' });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.jql).toContain('"In Progress"');

      delete process.env.DEVFLOW_JIRA_TOKEN;
    });
  });

  describe('transitionIssue', () => {
    it('finds transition by name and applies it', async () => {
      process.env.DEVFLOW_JIRA_TOKEN = 'test-token';
      const svc = new JiraService();

      // GET transitions
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transitions: [
            { id: '21', name: 'In Progress' },
            { id: '31', name: 'Done' },
          ],
        }),
      });
      // POST transition
      mockFetch.mockResolvedValueOnce({ ok: true });

      await svc.transitionIssue('PROJ-123', 'In Progress');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      const postCall = mockFetch.mock.calls[1];
      const body = JSON.parse(postCall[1].body);
      expect(body.transition.id).toBe('21');

      delete process.env.DEVFLOW_JIRA_TOKEN;
    });

    it('throws when transition name not found', async () => {
      process.env.DEVFLOW_JIRA_TOKEN = 'test-token';
      const svc = new JiraService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transitions: [{ id: '21', name: 'In Progress' }],
        }),
      });

      await expect(svc.transitionIssue('PROJ-123', 'Nonexistent'))
        .rejects.toThrow(/not found/i);

      delete process.env.DEVFLOW_JIRA_TOKEN;
    });
  });

  describe('addComment', () => {
    it('posts comment in ADF format', async () => {
      process.env.DEVFLOW_JIRA_TOKEN = 'test-token';
      const svc = new JiraService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '10001' }),
      });

      await svc.addComment('PROJ-123', 'My comment');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.body.type).toBe('doc');
      expect(body.body.content[0].content[0].text).toBe('My comment');

      delete process.env.DEVFLOW_JIRA_TOKEN;
    });
  });
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/unit/jira.service.test.js`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add tests/unit/jira.service.test.js
git commit -m "test: add JiraService tests for listMyTasks, transitionIssue, addComment"
```

---

## Chunk 3: Task Commands

### Task 6: Task Get Command

**Files:**
- Modify: `src/commands/task.js`
- Create: `tests/unit/task-commands.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
// tests/unit/task-commands.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { taskGetCommand, taskListCommand } from '../../src/commands/task.js';

// Mock JiraService
vi.mock('../../src/services/jira.service.js', () => ({
  JiraService: vi.fn().mockImplementation(() => ({
    getIssue: vi.fn().mockResolvedValue({
      key: 'PROJ-456',
      summary: 'Implement User Profile API',
      description: 'Full description here',
      type: 'story',
      priority: 'high',
      status: 'In Progress',
      assignee: 'dev@company.com',
      reporter: 'pm@company.com',
      sprint: 'Sprint 23',
      storyPoints: 5,
      epic: null,
      parent: { key: 'PROJ-100', summary: 'User Management Module' },
      subtasks: [
        { key: 'PROJ-457', summary: 'Design DB schema', status: 'Done' },
        { key: 'PROJ-458', summary: 'Create API endpoints', status: 'To Do' },
      ],
      figmaLinks: ['https://figma.com/file/abc123'],
      srsReferences: ['SRS Section 4.2'],
      linkedIssues: [],
      acceptanceCriteria: ['GET /api/users/{id}/profile returns profile', 'PUT updates profile'],
      labels: ['backend'],
      components: ['API'],
      fixVersions: ['1.0'],
      comments: [],
      customFields: {},
      _raw: {},
    }),
    listMyTasks: vi.fn().mockResolvedValue([
      { key: 'PROJ-456', summary: 'Implement User Profile API', status: 'In Progress', priority: 'high', type: 'story' },
      { key: 'PROJ-461', summary: 'Fix password reset flow', status: 'To Do', priority: 'medium', type: 'bug' },
    ]),
  })),
}));

// Capture console output
let output = '';
const originalLog = console.log;

beforeEach(() => {
  output = '';
  console.log = (...args) => { output += args.join(' ') + '\n'; };
});

describe('taskGetCommand', () => {
  it('displays task details', async () => {
    await taskGetCommand('PROJ-456', {});
    expect(output).toContain('PROJ-456');
    expect(output).toContain('Implement User Profile API');
    expect(output).toContain('In Progress');
    expect(output).toContain('Sprint 23');
  });

  it('outputs JSON with --json flag', async () => {
    await taskGetCommand('PROJ-456', { json: true });
    const parsed = JSON.parse(output.trim());
    expect(parsed.key).toBe('PROJ-456');
  });

  it('shows subtasks', async () => {
    await taskGetCommand('PROJ-456', {});
    expect(output).toContain('PROJ-457');
    expect(output).toContain('PROJ-458');
  });

  it('shows acceptance criteria', async () => {
    await taskGetCommand('PROJ-456', {});
    expect(output).toContain('GET /api/users/{id}/profile');
  });
});

describe('taskListCommand', () => {
  it('displays list of tasks', async () => {
    await taskListCommand({});
    expect(output).toContain('PROJ-456');
    expect(output).toContain('PROJ-461');
    expect(output).toContain('In Progress');
    expect(output).toContain('To Do');
  });
});

// Restore console
afterAll(() => { console.log = originalLog; });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/task-commands.test.js`
Expected: FAIL

- [ ] **Step 3: Implement task commands**

```javascript
// src/commands/task.js
import chalk from 'chalk';
import { JiraService } from '../services/jira.service.js';
import { logger } from '../utils/logger.js';

export async function taskGetCommand(jiraId, options) {
  try {
    const jira = new JiraService();
    const task = await jira.getIssue(jiraId);

    if (options.json) {
      const { _raw, ...clean } = task;
      console.log(JSON.stringify(clean, null, 2));
      return;
    }

    displayTask(task, options);
  } catch (error) {
    logger.error(error.message);
    if (error.message.includes('401')) {
      logger.dim('  Check DEVFLOW_JIRA_TOKEN env var and jira.email in .devflow.yml');
    } else if (error.message.includes('404')) {
      logger.dim('  Check project key and issue number');
    }
  }
}

export async function taskListCommand(options) {
  try {
    const jira = new JiraService();
    const tasks = await jira.listMyTasks(options);

    if (tasks.length === 0) {
      logger.info('No tasks found.');
      return;
    }

    const title = options.sprint ? `Your Tasks (${options.sprint})` : 'Your Tasks';
    console.log(chalk.bold(`\n  ${title}:`));
    console.log(chalk.dim('  ' + '─'.repeat(50)));

    for (const task of tasks) {
      const statusColor = getStatusColor(task.status);
      console.log(`  ${chalk.cyan(task.key.padEnd(12))} ${statusColor(`[${task.status}]`.padEnd(16))} ${task.summary}`);
    }
    console.log('');
  } catch (error) {
    logger.error(error.message);
  }
}

function displayTask(task, options = {}) {
  const width = 56;
  const line = '═'.repeat(width);
  const thin = '─'.repeat(width);

  console.log(chalk.dim(`╔${line}╗`));
  console.log(chalk.dim('║') + chalk.bold(` ${task.key}: ${task.summary}`.padEnd(width)) + chalk.dim('║'));
  console.log(chalk.dim(`╠${line}╣`));

  const row = (label, value) => {
    const content = `  ${chalk.dim(label + ':')} ${value}`;
    console.log(content);
  };

  row('Type', task.type);
  row('Priority', task.priority);
  row('Status', task.status);
  row('Assignee', task.assignee);
  if (task.sprint) row('Sprint', task.sprint);
  if (task.storyPoints) row('Story Points', task.storyPoints);

  if (task.parent) {
    console.log(chalk.dim(`\n  ${thin}`));
    row('Parent', `${task.parent.key} (${task.parent.summary})`);
  }

  if (task.figmaLinks.length > 0) {
    console.log(chalk.dim(`\n  ${thin}`));
    console.log(chalk.bold('  Figma:'));
    task.figmaLinks.forEach(link => console.log(`    ${chalk.cyan(link)}`));
  }

  if (task.srsReferences.length > 0) {
    console.log(chalk.bold('  SRS:'));
    task.srsReferences.forEach(ref => console.log(`    ${ref}`));
  }

  if (task.subtasks.length > 0) {
    console.log(chalk.dim(`\n  ${thin}`));
    console.log(chalk.bold('  Subtasks:'));
    for (const sub of task.subtasks) {
      const icon = sub.status === 'Done' ? chalk.green('☑') : chalk.dim('☐');
      console.log(`    ${icon} ${chalk.cyan(sub.key)}: ${sub.summary}`);
    }
  }

  if (task.acceptanceCriteria.length > 0) {
    console.log(chalk.dim(`\n  ${thin}`));
    console.log(chalk.bold('  Acceptance Criteria:'));
    task.acceptanceCriteria.forEach((ac, i) => {
      console.log(`    ${i + 1}. ${ac}`);
    });
  }

  if (task.linkedIssues.length > 0) {
    console.log(chalk.dim(`\n  ${thin}`));
    console.log(chalk.bold('  Linked Issues:'));
    for (const link of task.linkedIssues) {
      console.log(`    ${link.type}: ${chalk.cyan(link.key)} ${link.summary} [${link.status}]`);
    }
  }

  if (options.withComments && task.comments.length > 0) {
    console.log(chalk.dim(`\n  ${thin}`));
    console.log(chalk.bold('  Comments:'));
    for (const comment of task.comments) {
      console.log(`    ${chalk.dim(comment.created)} ${chalk.bold(comment.author)}:`);
      console.log(`    ${comment.body.split('\n')[0]}`);
    }
  }

  console.log('');
}

function getStatusColor(status) {
  const lower = status.toLowerCase();
  if (lower.includes('done') || lower.includes('closed')) return chalk.green;
  if (lower.includes('progress')) return chalk.yellow;
  if (lower.includes('review')) return chalk.magenta;
  return chalk.blue;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/task-commands.test.js`
Expected: ALL PASS

- [ ] **Step 5: Run all tests to ensure no regressions**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/commands/task.js tests/unit/task-commands.test.js
git commit -m "feat: implement task get and task list commands with formatted display"
```

### Task 7: Jira Config Validation in Doctor

**Files:**
- Modify: `src/commands/doctor.js`

- [ ] **Step 1: Add Jira connection check to doctor**

Add a check in `runChecks()` after the config checks that verifies the Jira config section exists and `DEVFLOW_JIRA_TOKEN` env var is set. Do NOT make actual API calls — just validate config presence.

```javascript
// Add after infrastructure checks in runChecks():

  // Jira config checks
  if (raw.jira) {
    if (raw.jira.host) {
      results.push({ category: 'jira', name: 'Jira host configured', status: 'pass' });
    } else {
      results.push({ category: 'jira', name: 'Jira host configured', status: 'fail', message: 'jira.host not set in .devflow.yml' });
    }
    if (raw.jira.email) {
      results.push({ category: 'jira', name: 'Jira email configured', status: 'pass' });
    } else {
      results.push({ category: 'jira', name: 'Jira email configured', status: 'fail', message: 'jira.email not set in .devflow.yml' });
    }
    if (process.env.DEVFLOW_JIRA_TOKEN) {
      results.push({ category: 'jira', name: 'DEVFLOW_JIRA_TOKEN set', status: 'pass' });
    } else {
      results.push({ category: 'jira', name: 'DEVFLOW_JIRA_TOKEN set', status: 'warn', message: 'Set DEVFLOW_JIRA_TOKEN env var for Jira integration' });
    }
  }
```

- [ ] **Step 2: Add fix suggestion for Jira token**

In `generateFixSuggestions()`, add:

```javascript
    } else if (r.name.includes('DEVFLOW_JIRA_TOKEN')) {
      fixes.push({ check: r.name, command: 'export DEVFLOW_JIRA_TOKEN=your_jira_api_token' });
    } else if (r.name.includes('Jira host')) {
      fixes.push({ check: r.name, command: 'Add jira.host to .devflow.yml' });
    }
```

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/commands/doctor.js
git commit -m "feat: add Jira config checks to doctor command"
```
