import { describe, it, expect, beforeEach } from 'vitest';
import { DetectorService } from '../../src/services/detector.service.js';

describe('DetectorService', () => {
  let detector;

  beforeEach(() => {
    detector = new DetectorService();
  });

  describe('detectFromFiles', () => {
    it('detects Laravel from composer.json with laravel/framework', () => {
      const result = detector.detectFromFiles({
        'composer.json': '{"require":{"laravel/framework":"^11.0"}}',
      });
      expect(result.services).toHaveLength(1);
      expect(result.services[0].stack).toBe('laravel');
      expect(result.services[0].role).toBe('backend');
    });

    it('detects Django from requirements.txt with Django', () => {
      const result = detector.detectFromFiles({
        'requirements.txt': 'Django==5.0\npsycopg2==2.9',
      });
      expect(result.services[0].stack).toBe('django');
    });

    it('detects React from package.json with react dep', () => {
      const result = detector.detectFromFiles({
        'package.json': '{"dependencies":{"react":"^18.0"}}',
      });
      expect(result.services[0].stack).toBe('react');
      expect(result.services[0].role).toBe('frontend');
    });

    it('detects monorepo with backend + frontend subdirs', () => {
      const result = detector.detectFromFiles({
        'backend/composer.json': '{"require":{"laravel/framework":"^11.0"}}',
        'frontend/package.json': '{"dependencies":{"react":"^18.0"}}',
      });
      expect(result.services).toHaveLength(2);
      expect(result.structure).toBe('monorepo');
    });

    it('detects Spring Boot from pom.xml', () => {
      const result = detector.detectFromFiles({
        'pom.xml': '<dependency><groupId>org.springframework.boot</groupId></dependency>',
      });
      expect(result.services[0].stack).toBe('spring-boot');
    });

    it('detects .NET from .csproj', () => {
      const result = detector.detectFromFiles({
        'MyApp.csproj': '<PackageReference Include="Microsoft.AspNetCore" />',
      });
      expect(result.services[0].stack).toBe('dotnet');
    });

    it('detects Go with unsupported flag', () => {
      const result = detector.detectFromFiles({ 'go.mod': 'module example.com/app' });
      expect(result.services[0].stack).toBe('go');
      expect(result.services[0].unsupported).toBe(true);
    });

    it('detects Rust with unsupported flag', () => {
      const result = detector.detectFromFiles({ 'Cargo.toml': '[package]\nname = "app"' });
      expect(result.services[0].stack).toBe('rust');
      expect(result.services[0].unsupported).toBe(true);
    });
  });

  describe('detectInfraFromDockerCompose', () => {
    it('detects PostgreSQL and Redis from docker-compose', () => {
      const compose = `
services:
  db:
    image: postgres:16-alpine
  cache:
    image: redis:7-alpine
`;
      const infra = detector.detectInfraFromDockerCompose(compose);
      expect(infra.database.engine).toBe('postgresql');
      expect(infra.cache.engine).toBe('redis');
    });
  });
});
