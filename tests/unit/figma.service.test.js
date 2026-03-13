import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseFigmaUrl,
  sanitizeFieldName,
  inferUIElement,
  extractDesignTokens,
  extractImpliedFields,
  FigmaService,
} from '../../src/services/figma.service.js';

// ── Mock fetch ────────────────────────────────────────────────────────────────
let mockFetch;
beforeEach(() => {
  mockFetch = vi.fn();
  global.fetch = mockFetch;
  process.env.DEVFLOW_FIGMA_TOKEN = 'test-token';
});
afterEach(() => {
  delete process.env.DEVFLOW_FIGMA_TOKEN;
  vi.restoreAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeFetchResponse(json, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => json,
    text: async () => JSON.stringify(json),
  });
}

// ── 1. parseFigmaUrl ──────────────────────────────────────────────────────────
describe('parseFigmaUrl', () => {
  it('parses a /file/ URL', () => {
    const result = parseFigmaUrl('https://www.figma.com/file/abc123/MyDesign');
    expect(result.fileKey).toBe('abc123');
    expect(result.type).toBe('file');
    expect(result.nodeId).toBeNull();
  });

  it('parses a /design/ URL with node-id', () => {
    const result = parseFigmaUrl(
      'https://www.figma.com/design/XYZ789/MyApp?node-id=456:789'
    );
    expect(result.fileKey).toBe('XYZ789');
    expect(result.type).toBe('design');
    expect(result.nodeId).toBe('456:789');
  });

  it('normalizes node-id hyphen format to colon format', () => {
    const result = parseFigmaUrl(
      'https://www.figma.com/design/XYZ789/MyApp?node-id=456-789'
    );
    expect(result.nodeId).toBe('456:789');
  });

  it('parses a /proto/ URL', () => {
    const result = parseFigmaUrl('https://www.figma.com/proto/KEY001/Prototype');
    expect(result.fileKey).toBe('KEY001');
    expect(result.type).toBe('proto');
    expect(result.nodeId).toBeNull();
  });

  it('parses a /board/ URL', () => {
    const result = parseFigmaUrl('https://www.figma.com/board/BRD123/Whiteboard');
    expect(result.fileKey).toBe('BRD123');
    expect(result.type).toBe('board');
    expect(result.nodeId).toBeNull();
  });

  it('throws on an invalid/non-Figma URL', () => {
    expect(() => parseFigmaUrl('https://example.com/something')).toThrow();
  });

  it('throws on null/empty input', () => {
    expect(() => parseFigmaUrl(null)).toThrow();
    expect(() => parseFigmaUrl('')).toThrow();
  });
});

// ── 2. sanitizeFieldName ──────────────────────────────────────────────────────
describe('sanitizeFieldName', () => {
  it('converts "Full Name" to "full_name"', () => {
    expect(sanitizeFieldName('Full Name')).toBe('full_name');
  });

  it('converts "Email Address" to "email_address"', () => {
    expect(sanitizeFieldName('Email Address')).toBe('email_address');
  });

  it('removes parenthetical notes: "Phone Number (Optional)" → "phone_number"', () => {
    expect(sanitizeFieldName('Phone Number (Optional)')).toBe('phone_number');
  });

  it('removes "Upload" prefix: "Upload Avatar" → "avatar"', () => {
    expect(sanitizeFieldName('Upload Avatar')).toBe('avatar');
  });

  it('removes "Select" prefix: "Select Country" → "country"', () => {
    expect(sanitizeFieldName('Select Country')).toBe('country');
  });

  it('removes "Choose" prefix: "Choose Plan" → "plan"', () => {
    expect(sanitizeFieldName('Choose Plan')).toBe('plan');
  });

  it('removes "Enter" prefix: "Enter Password" → "password"', () => {
    expect(sanitizeFieldName('Enter Password')).toBe('password');
  });

  it('removes "Input" prefix: "Input Code" → "code"', () => {
    expect(sanitizeFieldName('Input Code')).toBe('code');
  });

  it('removes special characters', () => {
    expect(sanitizeFieldName('First & Last Name!')).toBe('first_last_name');
  });

  it('handles empty/null gracefully', () => {
    expect(sanitizeFieldName('')).toBe('');
    expect(sanitizeFieldName(null)).toBe('');
  });
});

// ── 3. inferUIElement ─────────────────────────────────────────────────────────
describe('inferUIElement', () => {
  it('detects button by name', () => {
    expect(inferUIElement({ name: 'Submit Button' })).toBe('button');
    expect(inferUIElement({ name: 'btn-primary' })).toBe('button');
    expect(inferUIElement({ name: 'CTA Hero' })).toBe('button');
  });

  it('detects button by structure (fills + text child + cornerRadius)', () => {
    const node = {
      name: 'Primary Action',
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1 } }],
      cornerRadius: 8,
      children: [{ type: 'TEXT', name: 'Click me' }],
    };
    expect(inferUIElement(node)).toBe('button');
  });

  it('detects input by name', () => {
    expect(inferUIElement({ name: 'Email Input' })).toBe('input');
    expect(inferUIElement({ name: 'Name Field' })).toBe('input');
    expect(inferUIElement({ name: 'Username TextField' })).toBe('input');
  });

  it('detects input by structure (rectangle with border)', () => {
    const node = {
      name: 'Some Box',
      type: 'RECTANGLE',
      strokes: [{ type: 'SOLID' }],
    };
    expect(inferUIElement(node)).toBe('input');
  });

  it('detects select by name', () => {
    expect(inferUIElement({ name: 'Country Select' })).toBe('select');
    expect(inferUIElement({ name: 'Plan Dropdown' })).toBe('select');
  });

  it('detects avatar by name', () => {
    expect(inferUIElement({ name: 'User Avatar' })).toBe('avatar');
    expect(inferUIElement({ name: 'Profile Pic' })).toBe('avatar');
  });

  it('detects checkbox by name', () => {
    expect(inferUIElement({ name: 'Remember Me Checkbox' })).toBe('checkbox');
    expect(inferUIElement({ name: 'Accept Terms Check' })).toBe('checkbox');
  });

  it('detects table by name', () => {
    expect(inferUIElement({ name: 'Users Table' })).toBe('table');
    expect(inferUIElement({ name: 'Data Grid' })).toBe('table');
  });

  it('detects form by name', () => {
    expect(inferUIElement({ name: 'Login Form' })).toBe('form');
  });

  it('detects form by structure (multiple input children)', () => {
    const node = {
      name: 'Signup Panel',
      children: [
        { name: 'Email Field' },
        { name: 'Password Field' },
        { name: 'Confirm Input' },
      ],
    };
    expect(inferUIElement(node)).toBe('form');
  });

  it('detects card by name', () => {
    expect(inferUIElement({ name: 'User Card' })).toBe('card');
  });

  it('returns null for unrecognized nodes', () => {
    expect(inferUIElement({ name: 'Generic Frame', type: 'FRAME' })).toBeNull();
    expect(inferUIElement({ name: 'Rectangle 1', type: 'RECTANGLE' })).toBeNull();
    expect(inferUIElement(null)).toBeNull();
  });
});

// ── 4. extractDesignTokens ────────────────────────────────────────────────────
describe('extractDesignTokens', () => {
  it('extracts solid fill colors from nodes', () => {
    const nodes = [
      {
        name: 'Primary Button',
        fills: [{ type: 'SOLID', color: { r: 0, g: 0.47, b: 1 } }],
        children: [],
      },
    ];
    const { colors } = extractDesignTokens(nodes);
    expect(colors).toHaveLength(1);
    expect(colors[0].hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(colors[0].name).toBe('Primary Button');
  });

  it('extracts typography from TEXT nodes', () => {
    const nodes = [
      {
        name: 'Heading',
        type: 'TEXT',
        style: {
          fontFamily: 'Inter',
          fontSize: 24,
          fontWeight: 700,
          lineHeightPx: 32,
        },
        children: [],
      },
    ];
    const { typography } = extractDesignTokens(nodes);
    expect(typography).toHaveLength(1);
    expect(typography[0].fontFamily).toBe('Inter');
    expect(typography[0].fontSize).toBe(24);
    expect(typography[0].fontWeight).toBe(700);
    expect(typography[0].lineHeight).toBe(32);
  });

  it('deduplicates identical colors', () => {
    const nodes = [
      {
        name: 'Box A',
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }],
        children: [],
      },
      {
        name: 'Box B',
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }],
        children: [],
      },
    ];
    const { colors } = extractDesignTokens(nodes);
    expect(colors).toHaveLength(1);
  });

  it('extracts spacing from padding properties', () => {
    const nodes = [
      {
        name: 'Card',
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 24,
        paddingBottom: 24,
        children: [],
      },
    ];
    const { spacing } = extractDesignTokens(nodes);
    expect(spacing).toContain(16);
    expect(spacing).toContain(24);
  });

  it('extracts border radius from cornerRadius', () => {
    const nodes = [
      { name: 'Pill Button', cornerRadius: 50, children: [] },
      { name: 'Card', cornerRadius: 8, children: [] },
    ];
    const { borderRadius } = extractDesignTokens(nodes);
    expect(borderRadius).toContain(8);
    expect(borderRadius).toContain(50);
  });

  it('walks nested children', () => {
    const nodes = [
      {
        name: 'Container',
        children: [
          {
            name: 'Heading',
            type: 'TEXT',
            style: { fontFamily: 'Roboto', fontSize: 16, fontWeight: 400, lineHeightPx: 24 },
            children: [],
          },
        ],
      },
    ];
    const { typography } = extractDesignTokens(nodes);
    expect(typography).toHaveLength(1);
    expect(typography[0].fontFamily).toBe('Roboto');
  });

  it('returns empty arrays for empty input', () => {
    const result = extractDesignTokens([]);
    expect(result.colors).toEqual([]);
    expect(result.typography).toEqual([]);
    expect(result.spacing).toEqual([]);
    expect(result.borderRadius).toEqual([]);
  });
});

// ── 5. extractImpliedFields ───────────────────────────────────────────────────
describe('extractImpliedFields', () => {
  it('extracts input fields from form-like structure', () => {
    const nodes = [
      {
        name: 'Login Form',
        children: [
          {
            name: 'Email Input',
            children: [{ type: 'TEXT', characters: 'Enter your email' }],
          },
          {
            name: 'Password Field',
            children: [],
          },
        ],
      },
    ];
    const fields = extractImpliedFields(nodes);
    const names = fields.map((f) => f.name);
    expect(names).toContain('email_input');
    expect(names).toContain('password_field');
  });

  it('infers email inputType for email-named fields', () => {
    const nodes = [{ name: 'Email Input', children: [] }];
    const fields = extractImpliedFields(nodes);
    const emailField = fields.find((f) => f.name === 'email_input');
    expect(emailField?.inputType).toBe('email');
  });

  it('infers password inputType for password-named fields', () => {
    const nodes = [{ name: 'Password Field', children: [] }];
    const fields = extractImpliedFields(nodes);
    expect(fields[0]?.inputType).toBe('password');
  });

  it('marks required when asterisk is in name', () => {
    const nodes = [{ name: 'Email Input *', children: [] }];
    const fields = extractImpliedFields(nodes);
    expect(fields[0]?.required).toBe(true);
    expect(fields[0]?.validation).toContain('required');
  });

  it('extracts placeholder from text child', () => {
    const nodes = [
      {
        name: 'Username Input',
        children: [{ type: 'TEXT', characters: 'Enter username' }],
      },
    ];
    const fields = extractImpliedFields(nodes);
    expect(fields[0]?.placeholder).toBe('Enter username');
  });

  it('detects select type from select/dropdown nodes', () => {
    const nodes = [{ name: 'Country Select', children: [] }];
    const fields = extractImpliedFields(nodes);
    expect(fields[0]?.type).toBe('select');
    expect(fields[0]?.inputType).toBe('select');
  });

  it('detects checkbox type', () => {
    const nodes = [{ name: 'Accept Terms Checkbox', children: [] }];
    const fields = extractImpliedFields(nodes);
    expect(fields[0]?.type).toBe('checkbox');
    expect(fields[0]?.inputType).toBe('checkbox');
  });

  it('returns empty array for nodes with no form elements', () => {
    const nodes = [{ name: 'Hero Section', children: [] }];
    const fields = extractImpliedFields(nodes);
    expect(fields).toEqual([]);
  });
});

// ── 6. FigmaService.getFile ───────────────────────────────────────────────────
describe('FigmaService.getFile', () => {
  it('fetches file data and returns it', async () => {
    const fileData = { name: 'My Design', document: { id: '0:0', name: 'Document' } };
    global.fetch = makeFetchResponse(fileData);

    const svc = new FigmaService();
    // Stub out cache so we always hit the network in tests
    vi.spyOn(svc, 'getCached').mockResolvedValue(null);
    vi.spyOn(svc, 'setCache').mockResolvedValue(undefined);

    const result = await svc.getFile('abc123');

    expect(result.name).toBe('My Design');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.figma.com/v1/files/abc123',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Figma-Token': 'test-token' }),
      })
    );
  });

  it('throws on 403 (token error)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => null },
      json: async () => ({}),
      text: async () => 'Forbidden',
    });

    const svc = new FigmaService();
    vi.spyOn(svc, 'getCached').mockResolvedValue(null);
    await expect(svc.getFile('bad-key')).rejects.toThrow('403');
  });

  it('throws on 404 (file not found)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => null },
      json: async () => ({}),
      text: async () => 'Not Found',
    });

    const svc = new FigmaService();
    vi.spyOn(svc, 'getCached').mockResolvedValue(null);
    await expect(svc.getFile('nonexistent')).rejects.toThrow('404');
  });

  it('uses token from DEVFLOW_FIGMA_TOKEN env', () => {
    process.env.DEVFLOW_FIGMA_TOKEN = 'my-special-token';
    const svc = new FigmaService();
    expect(svc.headers['X-Figma-Token']).toBe('my-special-token');
  });
});

// ── 7. FigmaService.getNodes ──────────────────────────────────────────────────
describe('FigmaService.getNodes', () => {
  it('fetches specific nodes and returns the nodes map', async () => {
    const nodesData = {
      nodes: {
        '1:2': { document: { id: '1:2', name: 'Header' } },
        '1:3': { document: { id: '1:3', name: 'Footer' } },
      },
    };
    global.fetch = makeFetchResponse(nodesData);

    const svc = new FigmaService();
    const result = await svc.getNodes('fileABC', ['1:2', '1:3']);

    expect(result['1:2'].document.name).toBe('Header');
    expect(result['1:3'].document.name).toBe('Footer');
  });

  it('calls the correct Figma nodes endpoint', async () => {
    global.fetch = makeFetchResponse({ nodes: {} });

    const svc = new FigmaService();
    await svc.getNodes('fileXYZ', ['5:10']);

    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain('files/fileXYZ/nodes');
    expect(calledUrl).toContain('5');
    expect(calledUrl).toContain('10');
  });
});

// ── 8. FigmaService.buildComponentTree ───────────────────────────────────────
describe('FigmaService.buildComponentTree', () => {
  it('converts a Figma node to ComponentNode format', () => {
    const node = {
      id: '1:1',
      name: 'Frame',
      type: 'FRAME',
      children: [],
    };
    const svc = new FigmaService();
    const result = svc.buildComponentTree(node, 0, 3);

    expect(result.id).toBe('1:1');
    expect(result.name).toBe('Frame');
    expect(result.type).toBe('FRAME');
    expect(result.depth).toBe(0);
    expect(result.children).toEqual([]);
  });

  it('applies inferUIElement to each node', () => {
    const node = {
      id: '2:1',
      name: 'Submit Button',
      type: 'FRAME',
      children: [],
    };
    const svc = new FigmaService();
    const result = svc.buildComponentTree(node, 0, 3);
    expect(result.uiElement).toBe('button');
  });

  it('stops recursing at maxDepth', () => {
    const node = {
      id: '1:1',
      name: 'Root',
      type: 'FRAME',
      children: [
        {
          id: '1:2',
          name: 'Level 1',
          type: 'FRAME',
          children: [
            {
              id: '1:3',
              name: 'Level 2',
              type: 'FRAME',
              children: [
                {
                  id: '1:4',
                  name: 'Level 3 — should not appear',
                  type: 'FRAME',
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    };
    const svc = new FigmaService();
    const result = svc.buildComponentTree(node, 0, 2);

    expect(result.depth).toBe(0);
    expect(result.children[0].depth).toBe(1);
    expect(result.children[0].children[0].depth).toBe(2);
    // At maxDepth=2, depth-2 node should not have its children expanded
    expect(result.children[0].children[0].children).toEqual([]);
  });

  it('walks children and increments depth', () => {
    const node = {
      id: '1:1',
      name: 'Container',
      type: 'FRAME',
      children: [
        { id: '1:2', name: 'Child A', type: 'TEXT', children: [] },
        { id: '1:3', name: 'Child B', type: 'TEXT', children: [] },
      ],
    };
    const svc = new FigmaService();
    const result = svc.buildComponentTree(node, 0, 3);

    expect(result.children).toHaveLength(2);
    expect(result.children[0].depth).toBe(1);
    expect(result.children[1].depth).toBe(1);
    expect(result.children[0].name).toBe('Child A');
  });

  it('returns null for null node', () => {
    const svc = new FigmaService();
    expect(svc.buildComponentTree(null, 0, 3)).toBeNull();
  });
});
