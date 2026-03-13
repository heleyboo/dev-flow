import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { figmaCommand } from '../../src/commands/figma.js';

// ── Mock FigmaService ─────────────────────────────────────────────────────────

vi.mock('../../src/services/figma.service.js', () => {
  return {
    parseFigmaUrl: vi.fn().mockReturnValue({ fileKey: 'abc123', nodeId: '456:789', type: 'design' }),
    extractDesignTokens: vi.fn(),
    extractImpliedFields: vi.fn(),
    FigmaService: vi.fn().mockImplementation(() => ({
      extractSpecs: vi.fn().mockResolvedValue({
        fileName: 'Test Design',
        fileKey: 'abc123',
        targetNode: { name: 'Profile Page', type: 'FRAME', width: 1440, height: 900 },
        componentTree: [
          {
            name: 'Header',
            type: 'FRAME',
            inferredType: null,
            children: [
              { name: 'Avatar', type: 'ELLIPSE', inferredType: 'avatar', children: [] },
              { name: 'Save Button', type: 'FRAME', inferredType: 'button', children: [] },
            ],
          },
        ],
        designTokens: {
          colors: [{ name: 'primary', hex: '#2563EB', usage: 'primary' }],
          typography: [{ fontFamily: 'Inter', fontSize: 16, fontWeight: 400 }],
          spacing: [],
          borderRadius: [],
        },
        impliedFields: [
          { name: 'full_name', type: 'string', inputType: 'text', required: true },
        ],
        responsiveBreakpoints: [],
        exportedImages: [],
      }),
    })),
  };
});

vi.mock('../../src/services/jira.service.js', () => ({
  JiraService: vi.fn().mockImplementation(() => ({
    getIssue: vi.fn().mockResolvedValue({
      figmaLinks: ['https://figma.com/design/abc123/Test?node-id=456:789'],
    }),
  })),
}));

// ── Console capture ───────────────────────────────────────────────────────────

let output = '';
const originalConsoleLog = console.log;

beforeEach(() => {
  output = '';
  console.log = (...args) => {
    output += args.join(' ') + '\n';
  };
});

afterEach(() => {
  console.log = originalConsoleLog;
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('figmaCommand', () => {
  it('with URL displays specs', async () => {
    await figmaCommand('https://figma.com/design/abc123/Test?node-id=456:789', {});

    expect(output).toContain('Test Design');
    expect(output).toContain('Profile Page');
    expect(output).toContain('Header');
    expect(output).toContain('#2563EB');
    expect(output).toContain('full_name');
  });

  it('with Jira ID looks up figma link and displays specs', async () => {
    const { JiraService } = await import('../../src/services/jira.service.js');
    const mockGetIssue = vi.fn().mockResolvedValue({
      figmaLinks: ['https://figma.com/design/abc123/Test?node-id=456:789'],
    });
    JiraService.mockImplementationOnce(() => ({ getIssue: mockGetIssue }));

    await figmaCommand('PROJ-123', {});

    expect(mockGetIssue).toHaveBeenCalledWith('PROJ-123');
    expect(output).toContain('Test Design');
  });

  it('--json outputs valid JSON', async () => {
    await figmaCommand('https://figma.com/design/abc123/Test?node-id=456:789', { format: 'json' });

    // Find JSON portion in output (strip chalk/logger prefixes)
    const trimmed = output.trim();
    // The JSON.stringify output should be present
    expect(trimmed).toContain('"fileKey"');
    expect(trimmed).toContain('"abc123"');
    expect(trimmed).toContain('"fileName"');
    expect(trimmed).toContain('"Test Design"');

    // Find and parse the JSON block
    const jsonStart = trimmed.indexOf('{');
    const jsonStr = trimmed.slice(jsonStart);
    let parsed;
    expect(() => { parsed = JSON.parse(jsonStr); }).not.toThrow();
    expect(parsed.fileKey).toBe('abc123');
    expect(parsed.fileName).toBe('Test Design');
  });

  it('--tokens shows only tokens section', async () => {
    await figmaCommand('https://figma.com/design/abc123/Test?node-id=456:789', { tokens: true });

    expect(output).toContain('#2563EB');
    expect(output).toContain('Inter');
    // Should NOT show component tree or implied fields sections
    expect(output).not.toContain('full_name');
    expect(output).not.toContain('Component Tree');
  });

  it('shows error when no figma links in Jira task', async () => {
    const { JiraService } = await import('../../src/services/jira.service.js');
    JiraService.mockImplementationOnce(() => ({
      getIssue: vi.fn().mockResolvedValue({ figmaLinks: [] }),
    }));

    await figmaCommand('PROJ-999', {});

    expect(output).toContain('No Figma links found in PROJ-999');
  });
});
