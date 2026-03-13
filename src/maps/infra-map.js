export const INFRA_MAP = {
  postgresql: {
    image: 'postgres:{v}-alpine',
    port: 5432,
    default_version: '16',
    healthcheck: 'pg_isready -U {user} -d {db}',
    env: { POSTGRES_USER: '{user}', POSTGRES_PASSWORD: '{password}', POSTGRES_DB: '{db}' },
  },
  mysql: {
    image: 'mysql:{v}',
    port: 3306,
    default_version: '8.0',
    healthcheck: 'mysqladmin ping -h localhost',
    env: { MYSQL_ROOT_PASSWORD: '{password}', MYSQL_DATABASE: '{db}', MYSQL_USER: '{user}', MYSQL_PASSWORD: '{password}' },
  },
  mariadb: {
    image: 'mariadb:{v}',
    port: 3306,
    default_version: '11',
    healthcheck: 'healthcheck.sh --connect',
    env: { MARIADB_ROOT_PASSWORD: '{password}', MARIADB_DATABASE: '{db}', MARIADB_USER: '{user}', MARIADB_PASSWORD: '{password}' },
  },
  mongodb: {
    image: 'mongo:{v}',
    port: 27017,
    default_version: '7',
    healthcheck: "mongosh --eval 'db.runCommand(\"ping\")'",
    env: { MONGO_INITDB_ROOT_USERNAME: '{user}', MONGO_INITDB_ROOT_PASSWORD: '{password}' },
  },
  redis: {
    image: 'redis:{v}-alpine',
    port: 6379,
    default_version: '7',
    healthcheck: 'redis-cli ping',
    env: {},
  },
  memcached: {
    image: 'memcached:{v}-alpine',
    port: 11211,
    default_version: '1.6',
    healthcheck: 'echo stats | nc localhost 11211',
    env: {},
  },
  rabbitmq: {
    image: 'rabbitmq:{v}-management-alpine',
    port: 5672,
    default_version: '3',
    healthcheck: 'rabbitmq-diagnostics -q ping',
    env: { RABBITMQ_DEFAULT_USER: '{user}', RABBITMQ_DEFAULT_PASS: '{password}' },
    extra_ports: [15672],
  },
  kafka: {
    image: 'confluentinc/cp-kafka:{v}',
    port: 9092,
    default_version: '7.5',
    healthcheck: 'kafka-broker-api-versions --bootstrap-server localhost:9092',
    env: {},
    companions: {
      zookeeper: {
        image: 'confluentinc/cp-zookeeper:{v}',
        port: 2181,
        healthcheck: 'echo ruok | nc localhost 2181',
        env: { ZOOKEEPER_CLIENT_PORT: '2181' },
      },
    },
  },
  elasticsearch: {
    image: 'elasticsearch:{v}',
    port: 9200,
    default_version: '8.12.0',
    healthcheck: 'curl -f localhost:9200/_cluster/health',
    env: {},
    extra_env: { 'discovery.type': 'single-node', 'xpack.security.enabled': 'false' },
    host_requirements: ['vm.max_map_count=262144 (see docs)'],
  },
  meilisearch: {
    image: 'getmeili/meilisearch:{v}',
    port: 7700,
    default_version: 'v1.6',
    healthcheck: 'curl -f localhost:7700/health',
    env: { MEILI_MASTER_KEY: '{password}' },
  },
  typesense: {
    image: 'typesense/typesense:{v}',
    port: 8108,
    default_version: '0.25',
    healthcheck: 'curl -f localhost:8108/health',
    env: { TYPESENSE_API_KEY: '{password}' },
  },
  minio: {
    image: 'minio/minio:latest',
    port: 9000,
    default_version: 'latest',
    healthcheck: 'mc ready local',
    env: { MINIO_ROOT_USER: '{user}', MINIO_ROOT_PASSWORD: '{password}' },
    extra_ports: [9001],
  },
};

export function getInfraDefaults(engine, version) {
  const entry = INFRA_MAP[engine];
  if (!entry) return null;

  const v = version || entry.default_version;
  const result = {
    ...entry,
    image: entry.image.replace('{v}', v),
  };

  if (entry.companions) {
    result.companions = {};
    for (const [name, companion] of Object.entries(entry.companions)) {
      result.companions[name] = {
        ...companion,
        image: companion.image.replace('{v}', v),
      };
    }
  }

  return result;
}
