import { describe, it, expect } from 'vitest';
import { generateEnvVars } from '../../src/maps/env-map.js';

describe('generateEnvVars', () => {
  const infra = {
    database: { engine: 'postgresql', port: 5432, name: 'mydb' },
    cache: { engine: 'redis', port: 6379 },
    queue: { engine: 'rabbitmq', port: 5672 },
  };

  it('generates Laravel-style env vars', () => {
    const env = generateEnvVars('laravel', infra);
    expect(env.DB_HOST).toBe('database');
    expect(env.DB_DATABASE).toBe('mydb');
    expect(env.DB_USERNAME).toBeDefined();
    expect(env.DB_PASSWORD).toBeDefined();
    expect(env.REDIS_HOST).toBe('cache');
    expect(env.QUEUE_CONNECTION).toBe('rabbitmq');
  });

  it('generates Django-style env vars with DATABASE_URL', () => {
    const env = generateEnvVars('django', infra);
    expect(env.DATABASE_URL).toContain('postgresql://');
    expect(env.DATABASE_URL).toContain('mydb');
    expect(env.REDIS_URL).toContain('redis://');
    expect(env.CELERY_BROKER_URL).toContain('amqp://');
  });

  it('generates Spring Boot-style env vars', () => {
    const env = generateEnvVars('spring-boot', infra);
    expect(env.SPRING_DATASOURCE_URL).toContain('jdbc:postgresql://');
    expect(env.SPRING_REDIS_HOST).toBe('cache');
    expect(env.SPRING_RABBITMQ_HOST).toBe('queue');
  });

  it('generates both URL and individual vars', () => {
    const env = generateEnvVars('laravel', infra);
    expect(env.DATABASE_URL).toContain('postgresql://');
    expect(env.DB_HOST).toBe('database');
  });

  it('handles missing infrastructure gracefully', () => {
    const env = generateEnvVars('laravel', { database: null, cache: null, queue: null });
    expect(env.DB_HOST).toBeUndefined();
    expect(env.REDIS_HOST).toBeUndefined();
  });
});
