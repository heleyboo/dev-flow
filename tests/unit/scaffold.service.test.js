import { describe, it, expect, beforeEach } from 'vitest';
import { ScaffoldService } from '../../src/services/scaffold.service.js';

describe('ScaffoldService', () => {
  let scaffold;

  beforeEach(() => {
    scaffold = new ScaffoldService();
  });

  describe('buildScaffoldCommand', () => {
    it('builds docker run command for Laravel scaffold', () => {
      const cmd = scaffold.buildScaffoldCommand({
        stack: 'laravel',
        language: { name: 'php', version: '8.3' },
        path: './api',
        scaffold: {
          command: 'composer create-project laravel/laravel {path}',
          docker_image: 'composer:latest',
        },
      });
      expect(cmd).toContain('docker run');
      expect(cmd).toContain('composer:latest');
      expect(cmd).toContain('composer create-project laravel/laravel');
    });

    it('builds docker run command for React scaffold', () => {
      const cmd = scaffold.buildScaffoldCommand({
        stack: 'react',
        language: { name: 'typescript', version: '5.5' },
        path: './frontend',
        scaffold: {
          command: 'npx create-vite {path} --template react-ts',
          docker_image: 'node:20-alpine',
        },
      });
      expect(cmd).toContain('node:20-alpine');
      expect(cmd).toContain('create-vite');
    });

    it('uses stack map defaults when no scaffold config provided', () => {
      const cmd = scaffold.buildScaffoldCommand({
        stack: 'django',
        language: { name: 'python', version: '3.12' },
        path: './backend',
      });
      expect(cmd).toContain('docker run');
      expect(cmd).toContain('django-admin startproject');
    });
  });

  describe('buildScaffoldSteps', () => {
    it('returns ordered steps for a full project', () => {
      const config = {
        services: {
          api: { stack: 'laravel', role: 'backend', language: { name: 'php', version: '8.3' }, path: '.',
                 scaffold: { command: 'composer create-project laravel/laravel {path}', docker_image: 'composer:latest' } },
          web: { stack: 'react', role: 'frontend', language: { name: 'typescript', version: '20' }, path: './frontend',
                 scaffold: { command: 'npx create-vite {path} --template react-ts', docker_image: 'node:20-alpine' } },
        },
      };
      const steps = scaffold.buildScaffoldSteps(config);
      expect(steps).toHaveLength(2);
      expect(steps[0].name).toBe('api');
      expect(steps[1].name).toBe('web');
    });
  });
});
