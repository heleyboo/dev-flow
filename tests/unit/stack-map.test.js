import { describe, it, expect } from 'vitest';
import { STACK_MAP, getStackDefaults } from '../../src/maps/stack-map.js';

describe('STACK_MAP', () => {
  it('has entries for all supported backend stacks', () => {
    const backends = ['laravel', 'symfony', 'django', 'fastapi', 'express', 'nestjs', 'spring-boot', 'dotnet'];
    for (const stack of backends) {
      expect(STACK_MAP[stack]).toBeDefined();
      expect(STACK_MAP[stack].base).toBeDefined();
      expect(STACK_MAP[stack].scaffold).toBeDefined();
      expect(STACK_MAP[stack].entry_point).toBeDefined();
    }
  });

  it('has entries for all supported frontend stacks', () => {
    const frontends = ['react', 'vue', 'angular', 'nextjs', 'nuxtjs', 'svelte'];
    for (const stack of frontends) {
      expect(STACK_MAP[stack]).toBeDefined();
      expect(STACK_MAP[stack].base).toBeDefined();
      expect(STACK_MAP[stack].scaffold).toBeDefined();
    }
  });

  it('provides language info per stack', () => {
    expect(STACK_MAP.laravel.language).toEqual({ name: 'php', version: '8.3' });
    expect(STACK_MAP.django.language).toEqual({ name: 'python', version: '3.12' });
    expect(STACK_MAP.express.language).toEqual({ name: 'javascript', version: '20' });
    expect(STACK_MAP['spring-boot'].language).toEqual({ name: 'java', version: '21' });
    expect(STACK_MAP.dotnet.language).toEqual({ name: 'csharp', version: '8.0' });
  });

  it('provides default commands per stack', () => {
    const laravel = STACK_MAP.laravel;
    expect(laravel.build_command).toBe('composer install');
    expect(laravel.dev_command).toBe('php artisan serve');
    expect(laravel.test_command).toBe('php artisan test');
    expect(laravel.lint_command).toBe('vendor/bin/pint');
  });
});

describe('getStackDefaults', () => {
  it('returns defaults for known stack', () => {
    const defaults = getStackDefaults('laravel');
    expect(defaults.language.name).toBe('php');
    expect(defaults.entry_point).toBe('public/index.php');
  });

  it('interpolates version into base image', () => {
    const defaults = getStackDefaults('django', '3.11');
    expect(defaults.base).toBe('python:3.11-slim');
  });

  it('returns null for unknown stack', () => {
    expect(getStackDefaults('cobol')).toBeNull();
  });
});
