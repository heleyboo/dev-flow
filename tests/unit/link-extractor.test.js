import { describe, it, expect } from 'vitest';
import {
  extractFigmaLinks,
  extractSrsReferences,
  extractAcceptanceCriteria,
} from '../../src/parsers/link-extractor.js';

// ─────────────────────────────────────────────────────────────────────────────
// extractFigmaLinks
// ─────────────────────────────────────────────────────────────────────────────
describe('extractFigmaLinks', () => {
  it('returns empty array for null input', () => {
    expect(extractFigmaLinks(null)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(extractFigmaLinks('')).toEqual([]);
  });

  it('returns empty array when no Figma links present', () => {
    expect(extractFigmaLinks('No links here, just plain text.')).toEqual([]);
  });

  it('extracts a figma.com/file URL', () => {
    const text = 'See the design: https://figma.com/file/abc123/My-Design';
    expect(extractFigmaLinks(text)).toEqual([
      'https://figma.com/file/abc123/My-Design',
    ]);
  });

  it('extracts a figma.com/design URL', () => {
    const text = 'Link: https://figma.com/design/xyz789/Component-Library';
    expect(extractFigmaLinks(text)).toEqual([
      'https://figma.com/design/xyz789/Component-Library',
    ]);
  });

  it('extracts a figma.com/proto URL', () => {
    const text = 'Prototype: https://figma.com/proto/pqr456/Prototype';
    expect(extractFigmaLinks(text)).toEqual([
      'https://figma.com/proto/pqr456/Prototype',
    ]);
  });

  it('extracts a figma.com/board URL', () => {
    const text = 'Board: https://figma.com/board/board123/Sprint-Board';
    expect(extractFigmaLinks(text)).toEqual([
      'https://figma.com/board/board123/Sprint-Board',
    ]);
  });

  it('extracts URLs with www. prefix', () => {
    const text = 'Check https://www.figma.com/file/abc/My-File for more.';
    expect(extractFigmaLinks(text)).toEqual([
      'https://www.figma.com/file/abc/My-File',
    ]);
  });

  it('deduplicates identical URLs', () => {
    const url = 'https://figma.com/file/abc123/My-Design';
    const text = `${url} and again ${url}`;
    expect(extractFigmaLinks(text)).toEqual([url]);
  });

  it('extracts multiple distinct Figma URLs', () => {
    const text = [
      'Design: https://figma.com/file/aaa/Design-A',
      'Proto: https://figma.com/proto/bbb/Proto-B',
    ].join('\n');
    const result = extractFigmaLinks(text);
    expect(result).toHaveLength(2);
    expect(result).toContain('https://figma.com/file/aaa/Design-A');
    expect(result).toContain('https://figma.com/proto/bbb/Proto-B');
  });

  it('does not match non-Figma paths like figma.com/about', () => {
    const text = 'Visit https://figma.com/about for info.';
    expect(extractFigmaLinks(text)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// extractSrsReferences
// ─────────────────────────────────────────────────────────────────────────────
describe('extractSrsReferences', () => {
  it('returns empty array for null input', () => {
    expect(extractSrsReferences(null)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(extractSrsReferences('')).toEqual([]);
  });

  it('returns empty array when no references present', () => {
    expect(extractSrsReferences('No references here.')).toEqual([]);
  });

  it('matches "SRS Section 4.2"', () => {
    const result = extractSrsReferences('See SRS Section 4.2 for details.');
    expect(result).toContain('SRS Section 4.2');
  });

  it('matches "SRS-Section 5.1"', () => {
    const result = extractSrsReferences('Refer to SRS-Section 5.1.');
    expect(result).toContain('SRS-Section 5.1');
  });

  it('matches "SRS §4.2"', () => {
    const result = extractSrsReferences('As per SRS §4.2 the system shall…');
    expect(result).toContain('SRS §4.2');
  });

  it('matches "REQ-4.2.1"', () => {
    const result = extractSrsReferences('Implements REQ-4.2.1.');
    expect(result).toContain('REQ-4.2.1');
  });

  it('matches "requirement #AUTH-001"', () => {
    const result = extractSrsReferences('See requirement #AUTH-001 for auth flow.');
    expect(result).toContain('requirement #AUTH-001');
  });

  it('matches "req-AUTH-001"', () => {
    const result = extractSrsReferences('This covers req-AUTH-001 and req-USER-002.');
    expect(result).toContain('req-AUTH-001');
    expect(result).toContain('req-USER-002');
  });

  it('deduplicates identical references', () => {
    const result = extractSrsReferences('REQ-1.0 and again REQ-1.0');
    const reqMatches = result.filter((r) => r === 'REQ-1.0');
    expect(reqMatches).toHaveLength(1);
  });

  it('extracts multiple different reference types from one text', () => {
    const text = 'See SRS Section 3.1 and REQ-2.0 for context.';
    const result = extractSrsReferences(text);
    expect(result).toContain('SRS Section 3.1');
    expect(result).toContain('REQ-2.0');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// extractAcceptanceCriteria
// ─────────────────────────────────────────────────────────────────────────────
describe('extractAcceptanceCriteria', () => {
  it('returns empty array for null input', () => {
    expect(extractAcceptanceCriteria(null)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(extractAcceptanceCriteria('')).toEqual([]);
  });

  it('returns empty array when no AC section or inline AC present', () => {
    const md = '## Description\nSome description text.\n\n## Notes\nMore notes.';
    expect(extractAcceptanceCriteria(md)).toEqual([]);
  });

  // ── Numbered list after heading ───────────────────────────────────────────

  it('extracts numbered list items after "## Acceptance Criteria"', () => {
    const md = [
      '## Acceptance Criteria',
      '1. User can login with valid credentials',
      '2. Invalid password shows error message',
      '3. Session expires after 30 minutes',
    ].join('\n');
    const result = extractAcceptanceCriteria(md);
    expect(result).toEqual([
      'User can login with valid credentials',
      'Invalid password shows error message',
      'Session expires after 30 minutes',
    ]);
  });

  it('stops extracting at the next heading', () => {
    const md = [
      '## Acceptance Criteria',
      '1. User can login',
      '',
      '## Notes',
      '1. This is not a criterion',
    ].join('\n');
    const result = extractAcceptanceCriteria(md);
    expect(result).toEqual(['User can login']);
    expect(result).not.toContain('This is not a criterion');
  });

  // ── Checkbox list ─────────────────────────────────────────────────────────

  it('extracts unchecked checkbox items', () => {
    const md = [
      '## AC',
      '- [ ] Create the login endpoint',
      '- [ ] Return JWT token on success',
    ].join('\n');
    const result = extractAcceptanceCriteria(md);
    expect(result).toEqual([
      'Create the login endpoint',
      'Return JWT token on success',
    ]);
  });

  it('extracts checked checkbox items', () => {
    const md = [
      '## AC',
      '- [x] Done task',
      '- [X] Another done task',
    ].join('\n');
    const result = extractAcceptanceCriteria(md);
    expect(result).toEqual(['Done task', 'Another done task']);
  });

  // ── Given/When/Then ───────────────────────────────────────────────────────

  it('collects a Given/When/Then block as a single criterion', () => {
    const md = [
      '## Acceptance Criteria',
      'Given the user is on the login page',
      'When they enter valid credentials',
      'Then they are redirected to the dashboard',
    ].join('\n');
    const result = extractAcceptanceCriteria(md);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('Given the user is on the login page');
    expect(result[0]).toContain('When they enter valid credentials');
    expect(result[0]).toContain('Then they are redirected to the dashboard');
  });

  it('handles multiple Given/When/Then blocks separated by blank lines', () => {
    const md = [
      '## Acceptance Criteria',
      'Given state A',
      'When action A',
      'Then result A',
      '',
      'Given state B',
      'When action B',
      'Then result B',
    ].join('\n');
    const result = extractAcceptanceCriteria(md);
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('Given state A');
    expect(result[1]).toContain('Given state B');
  });

  // ── Heading variants ──────────────────────────────────────────────────────

  it('recognises "### AC:" as an AC heading', () => {
    const md = [
      '### AC:',
      '1. System stores the record',
    ].join('\n');
    const result = extractAcceptanceCriteria(md);
    expect(result).toEqual(['System stores the record']);
  });

  it('recognises "## AC" (no colon) as an AC heading', () => {
    const md = [
      '## AC',
      '1. Feature works correctly',
    ].join('\n');
    const result = extractAcceptanceCriteria(md);
    expect(result).toEqual(['Feature works correctly']);
  });

  // ── Inline AC: fallback ───────────────────────────────────────────────────

  it('extracts inline "AC:" prefix as a single criterion', () => {
    const md = 'AC: User must be authenticated before accessing the resource.';
    const result = extractAcceptanceCriteria(md);
    expect(result).toEqual([
      'User must be authenticated before accessing the resource.',
    ]);
  });

  it('returns empty array for "AC:" prefix with no value', () => {
    const md = 'AC:   ';
    // Edge case: empty value after AC:
    const result = extractAcceptanceCriteria(md);
    expect(result).toEqual([]);
  });

  // ── Mixed content ─────────────────────────────────────────────────────────

  it('handles mixed numbered and checkbox items in same section', () => {
    const md = [
      '## Acceptance Criteria',
      '1. First criterion',
      '- [ ] Second criterion',
      '2. Third criterion',
    ].join('\n');
    const result = extractAcceptanceCriteria(md);
    expect(result).toContain('First criterion');
    expect(result).toContain('Second criterion');
    expect(result).toContain('Third criterion');
  });
});
