import { describe, it, expect } from 'vitest';
import { validateConfig, migrateV1toV2 } from '../../src/schemas/config-schema.js';

describe('validateConfig', () => {
  const minimalValid = {
    version: 2,
    project: { name: 'test-app' },
    services: {
      api: { role: 'backend', stack: 'laravel', language: { name: 'php' } },
    },
  };

  it('accepts a minimal valid config', () => {
    const result = validateConfig(minimalValid);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects missing version', () => {
    const result = validateConfig({ project: { name: 'x' }, services: { a: { role: 'backend', stack: 'laravel', language: { name: 'php' } } } });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ field: 'version' }));
  });

  it('rejects missing project.name', () => {
    const result = validateConfig({ version: 2, project: {}, services: { a: { role: 'backend', stack: 'laravel', language: { name: 'php' } } } });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ field: 'project.name' }));
  });

  it('rejects empty services', () => {
    const result = validateConfig({ version: 2, project: { name: 'x' }, services: {} });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ field: 'services' }));
  });

  it('rejects service missing required fields', () => {
    const result = validateConfig({ version: 2, project: { name: 'x' }, services: { a: { role: 'backend' } } });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field.includes('stack'))).toBe(true);
  });

  it('rejects unknown stack', () => {
    const result = validateConfig({
      version: 2, project: { name: 'x' },
      services: { a: { role: 'backend', stack: 'cobol', language: { name: 'cobol' } } },
    });
    expect(result.valid).toBe(false);
  });

  it('validates infrastructure.database when present', () => {
    const config = { ...minimalValid, infrastructure: { database: { engine: 'postgresql' } } };
    const result = validateConfig(config);
    expect(result.valid).toBe(true);
  });

  it('rejects infrastructure.database without engine', () => {
    const config = { ...minimalValid, infrastructure: { database: { version: '16' } } };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
  });

  it('applies defaults to optional fields', () => {
    const result = validateConfig(minimalValid);
    expect(result.config.project.structure).toBe('monorepo');
    expect(result.config.services.api.path).toBe('.');
  });
});

describe('migrateV1toV2', () => {
  it('migrates v1 config to v2 schema', () => {
    const v1 = {
      project: { name: 'my-app', type: 'laravel', php_version: '8.2' },
      frontend: { framework: 'react', src_dir: 'resources/js', component_style: 'functional', testing: 'vitest' },
      jira: { host: 'https://x.atlassian.net', project_key: 'X' },
      git: { base_branch: 'main' },
    };
    const v2 = migrateV1toV2(v1);
    expect(v2.version).toBe(2);
    expect(v2.services.api.stack).toBe('laravel');
    expect(v2.services.api.language.version).toBe('8.2');
    expect(v2.services.web.stack).toBe('react');
    expect(v2.services.web.src_dir).toBe('resources/js');
    expect(v2.services.web.component_style).toBe('functional');
    expect(v2.services.web.test_framework).toBe('vitest');
    expect(v2.jira.host).toBe('https://x.atlassian.net');
    expect(v2.git.base_branch).toBe('main');
  });

  it('detects v1 config (no version field)', () => {
    const v1 = { project: { name: 'x', type: 'laravel' } };
    const v2 = migrateV1toV2(v1);
    expect(v2.version).toBe(2);
  });
});
