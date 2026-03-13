import { describe, it, expect } from 'vitest';
import { INFRA_MAP, getInfraDefaults } from '../../src/maps/infra-map.js';

describe('INFRA_MAP', () => {
  it('has entries for all supported engines', () => {
    const engines = [
      'postgresql', 'mysql', 'mariadb', 'mongodb',
      'redis', 'memcached',
      'rabbitmq', 'kafka',
      'elasticsearch', 'meilisearch', 'typesense',
      'minio',
    ];
    for (const engine of engines) {
      expect(INFRA_MAP[engine]).toBeDefined();
      expect(INFRA_MAP[engine].image).toBeDefined();
      expect(INFRA_MAP[engine].port).toBeTypeOf('number');
      expect(INFRA_MAP[engine].healthcheck).toBeDefined();
    }
  });

  it('kafka has zookeeper companion', () => {
    expect(INFRA_MAP.kafka.companions).toBeDefined();
    expect(INFRA_MAP.kafka.companions.zookeeper).toBeDefined();
    expect(INFRA_MAP.kafka.companions.zookeeper.port).toBe(2181);
  });

  it('elasticsearch has extra_env and host_requirements', () => {
    expect(INFRA_MAP.elasticsearch.extra_env).toBeDefined();
    expect(INFRA_MAP.elasticsearch.host_requirements).toBeDefined();
  });
});

describe('getInfraDefaults', () => {
  it('interpolates version into image', () => {
    const defaults = getInfraDefaults('postgresql', '16');
    expect(defaults.image).toBe('postgres:16-alpine');
  });

  it('uses default version when none specified', () => {
    const defaults = getInfraDefaults('redis');
    expect(defaults.image).toContain('redis:');
    expect(defaults.image).toContain('-alpine');
  });

  it('returns null for unknown engine', () => {
    expect(getInfraDefaults('oracle')).toBeNull();
  });

  it('includes companions with interpolated versions for kafka', () => {
    const defaults = getInfraDefaults('kafka', '7.5');
    expect(defaults.companions.zookeeper.image).toBe('confluentinc/cp-zookeeper:7.5');
  });
});
