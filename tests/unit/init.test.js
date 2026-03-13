import { describe, it, expect } from 'vitest';
import { buildConfigFromPreset, buildConfigFromCustom, detectExistingProject } from '../../src/commands/init.js';

describe('buildConfigFromPreset', () => {
  it('builds v2 config from preset name + project info', () => {
    const config = buildConfigFromPreset({
      presetName: 'laravel-react',
      projectName: 'my-app',
      projectDescription: 'Test project',
    });
    expect(config.version).toBe(2);
    expect(config.project.name).toBe('my-app');
    expect(config.project.preset).toBe('laravel-react');
    expect(config.services.api.stack).toBe('laravel');
    expect(config.services.web.stack).toBe('react');
    expect(config.infrastructure.database.engine).toBe('postgresql');
  });
});

describe('buildConfigFromCustom', () => {
  it('builds v2 config from custom selections', () => {
    const config = buildConfigFromCustom({
      projectName: 'custom-app',
      projectDescription: '',
      backend: { stack: 'django', port: 8000 },
      frontend: { stack: 'vue', port: 3000 },
      database: { engine: 'mysql' },
      cache: { engine: 'redis' },
      queue: null,
      search: null,
      storage: null,
    });
    expect(config.version).toBe(2);
    expect(config.services.api.stack).toBe('django');
    expect(config.services.api.language.name).toBe('python');
    expect(config.services.web.stack).toBe('vue');
    expect(config.infrastructure.database.engine).toBe('mysql');
    expect(config.infrastructure.database.port).toBe(3306);
  });

  it('handles no frontend', () => {
    const config = buildConfigFromCustom({
      projectName: 'api-only',
      backend: { stack: 'fastapi', port: 8000 },
      frontend: null,
      database: { engine: 'postgresql' },
      cache: null, queue: null, search: null, storage: null,
    });
    expect(config.services.web).toBeUndefined();
  });
});

describe('detectExistingProject', () => {
  it('returns detected services and infrastructure for nonexistent path', () => {
    const result = detectExistingProject('/nonexistent');
    expect(result).toHaveProperty('services');
    expect(result).toHaveProperty('infrastructure');
  });
});
