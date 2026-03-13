import { describe, it, expect, beforeEach } from 'vitest';
import { loadConfig, resetConfig, loadAndValidateConfig } from '../../src/utils/config.js';

describe('Config Loader', () => {
  beforeEach(() => resetConfig());

  it('returns null when no config file exists', () => {
    const config = loadConfig('/nonexistent/path');
    expect(config).toBeNull();
  });
});

describe('loadAndValidateConfig', () => {
  beforeEach(() => resetConfig());

  it('returns null when no config file exists', () => {
    const result = loadAndValidateConfig('/nonexistent/path');
    expect(result).toBeNull();
  });
});
