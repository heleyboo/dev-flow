import { describe, it, expect, beforeEach } from 'vitest';
import { DockerService } from '../../src/services/docker.service.js';
import YAML from 'yaml';

describe('DockerService', () => {
  const config = {
    version: 2,
    project: { name: 'test-app' },
    services: {
      api: {
        role: 'backend', stack: 'laravel',
        language: { name: 'php', version: '8.3' },
        path: '.', port: 8000,
        entry_point: 'public/index.php',
      },
      web: {
        role: 'frontend', stack: 'react',
        language: { name: 'typescript', version: '20' },
        path: './frontend', port: 3000,
      },
    },
    infrastructure: {
      database: { engine: 'postgresql', version: '16', port: 5432, name: 'test_app_db' },
      cache: { engine: 'redis', version: '7', port: 6379 },
    },
  };

  let docker;

  beforeEach(() => {
    docker = new DockerService();
  });

  describe('generateCompose', () => {
    it('generates valid YAML with all services', () => {
      const output = docker.generateCompose(config);
      const parsed = YAML.parse(output);
      expect(parsed.services).toBeDefined();
      expect(parsed.services.api).toBeDefined();
      expect(parsed.services.web).toBeDefined();
      expect(parsed.services.database).toBeDefined();
      expect(parsed.services.cache).toBeDefined();
    });

    it('includes health checks for infrastructure', () => {
      const output = docker.generateCompose(config);
      const parsed = YAML.parse(output);
      expect(parsed.services.database.healthcheck).toBeDefined();
      expect(parsed.services.cache.healthcheck).toBeDefined();
    });

    it('sets depends_on with service_healthy condition', () => {
      const output = docker.generateCompose(config);
      const parsed = YAML.parse(output);
      expect(parsed.services.api.depends_on.database.condition).toBe('service_healthy');
    });

    it('uses named volumes', () => {
      const output = docker.generateCompose(config);
      const parsed = YAML.parse(output);
      expect(parsed.volumes).toBeDefined();
    });

    it('maps ports correctly', () => {
      const output = docker.generateCompose(config);
      const parsed = YAML.parse(output);
      expect(parsed.services.api.ports).toContainEqual('8000:8000');
      expect(parsed.services.web.ports).toContainEqual('3000:3000');
    });
  });

  describe('generateDockerfile', () => {
    it('generates Dockerfile for PHP service', () => {
      const df = docker.generateDockerfile(config.services.api);
      expect(df).toContain('FROM php:8.3-fpm-alpine');
      expect(df).toContain('EXPOSE 8000');
    });

    it('generates Dockerfile for Node service', () => {
      const df = docker.generateDockerfile(config.services.web);
      expect(df).toContain('FROM node:20-alpine');
      expect(df).toContain('EXPOSE 3000');
    });
  });
});
