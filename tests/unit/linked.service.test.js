import { describe, it, expect, beforeEach } from 'vitest';
import { LinkedService } from '../../src/services/linked.service.js';

describe('LinkedService', () => {
  let service;

  beforeEach(() => {
    service = new LinkedService();
  });

  describe('resolveLinkedProject', () => {
    it('returns resolve info for a linked project', () => {
      const linkedConfig = {
        repo: 'company/my-app-web',
        local_path: '../my-app-web',
        branch: 'develop',
        role: 'frontend',
        infrastructure_from: 'api',
      };
      const result = service.resolveLinkedProject('web', linkedConfig, '/fake/project');
      expect(result).toHaveProperty('resolvedPath');
      expect(result).toHaveProperty('source');
    });
  });

  describe('resolveInfrastructureFrom', () => {
    it('returns infrastructure from the referenced service config', () => {
      const mainConfig = {
        services: { api: { role: 'backend', stack: 'laravel' } },
        infrastructure: {
          database: { engine: 'postgresql', version: '16', port: 5432 },
          cache: { engine: 'redis', version: '7', port: 6379 },
        },
      };
      const infra = service.resolveInfrastructureFrom('api', mainConfig);
      expect(infra.database.engine).toBe('postgresql');
      expect(infra.cache.engine).toBe('redis');
    });

    it('returns null when target service not found', () => {
      const infra = service.resolveInfrastructureFrom('nonexistent', { services: {}, infrastructure: {} });
      expect(infra).toBeNull();
    });
  });

  describe('generateWorkspaceCompose', () => {
    it('generates a workspace docker-compose with all repos', () => {
      const projects = [
        {
          name: 'api',
          path: './my-app-api',
          config: {
            services: { api: { role: 'backend', stack: 'laravel', language: { name: 'php', version: '8.3' }, port: 8000, path: '.' } },
            infrastructure: { database: { engine: 'postgresql', version: '16', port: 5432 }, cache: { engine: 'redis', version: '7', port: 6379 } },
          },
        },
        {
          name: 'web',
          path: './my-app-web',
          config: {
            services: { web: { role: 'frontend', stack: 'react', language: { name: 'typescript', version: '20' }, port: 3000, path: '.' } },
          },
          infrastructure_from: 'api',
        },
      ];
      const compose = service.generateWorkspaceCompose(projects);
      expect(compose).toContain('api');
      expect(compose).toContain('web');
      expect(compose).toContain('database');
      expect(compose).toContain('cache');
    });
  });
});
