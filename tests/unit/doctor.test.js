import { describe, it, expect } from 'vitest';
import { runChecks, generateFixSuggestions } from '../../src/commands/doctor.js';

describe('runChecks', () => {
  it('returns config error when no .devflow.yml', () => {
    const results = runChecks('/nonexistent/path');
    expect(results.some(r => r.category === 'config' && r.status === 'fail')).toBe(true);
  });

  it('skips infrastructure checks when no config', () => {
    const results = runChecks('/nonexistent/path');
    const infraResults = results.filter(r => r.category === 'infrastructure');
    expect(infraResults).toEqual([]);
  });

  it('skips linked checks when no config', () => {
    const results = runChecks('/nonexistent/path');
    const linkedResults = results.filter(r => r.category === 'linked');
    expect(linkedResults).toEqual([]);
  });
});

describe('generateFixSuggestions', () => {
  it('suggests devflow init for missing config', () => {
    const results = [{ category: 'config', name: '.devflow.yml exists', status: 'fail', message: 'Not found.' }];
    const fixes = generateFixSuggestions(results);
    expect(fixes).toHaveLength(1);
    expect(fixes[0].command).toContain('devflow init');
  });

  it('returns empty for all-passing results', () => {
    const results = [{ category: 'config', name: 'test', status: 'pass' }];
    const fixes = generateFixSuggestions(results);
    expect(fixes).toHaveLength(0);
  });
});
