import { describe, it, expect } from 'vitest';
import { listPresets, loadPreset, applyPresetOverrides } from '../../src/presets/index.js';

describe('listPresets', () => {
  it('returns array of preset names', () => {
    const presets = listPresets();
    expect(presets).toBeInstanceOf(Array);
    expect(presets.length).toBeGreaterThan(0);
    expect(presets).toContain('laravel-react');
  });
});

describe('loadPreset', () => {
  it('loads a preset by name', () => {
    const preset = loadPreset('laravel-react');
    expect(preset.name).toBe('laravel-react');
    expect(preset.services.api.stack).toBe('laravel');
    expect(preset.services.web.stack).toBe('react');
    expect(preset.infrastructure.database.engine).toBe('postgresql');
  });

  it('returns null for unknown preset', () => {
    expect(loadPreset('nonexistent')).toBeNull();
  });
});

describe('applyPresetOverrides', () => {
  it('user overrides take precedence over preset', () => {
    const preset = loadPreset('laravel-react');
    const overrides = { infrastructure: { database: { engine: 'mysql' } } };
    const merged = applyPresetOverrides(preset, overrides);
    expect(merged.infrastructure.database.engine).toBe('mysql');
    expect(merged.infrastructure.database.port).toBe(3306);
  });

  it('changing stack re-populates defaults', () => {
    const preset = loadPreset('laravel-react');
    const overrides = { services: { api: { stack: 'django' } } };
    const merged = applyPresetOverrides(preset, overrides);
    expect(merged.services.api.stack).toBe('django');
    expect(merged.services.api.language.name).toBe('python');
  });
});
