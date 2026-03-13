const DB_DEFAULTS = { user: 'devflow', password: 'devflow_secret' };
const DB_SERVICE_NAME = 'database';
const CACHE_SERVICE_NAME = 'cache';
const QUEUE_SERVICE_NAME = 'queue';

function buildDatabaseUrl(engine, name, port) {
  const { user, password } = DB_DEFAULTS;
  const protocols = { postgresql: 'postgresql', mysql: 'mysql', mariadb: 'mysql', mongodb: 'mongodb' };
  const proto = protocols[engine] || engine;
  return `${proto}://${user}:${password}@${DB_SERVICE_NAME}:${port}/${name}`;
}

function buildJdbcUrl(engine, name, port) {
  const jdbcDrivers = { postgresql: 'postgresql', mysql: 'mysql', mariadb: 'mariadb' };
  const driver = jdbcDrivers[engine] || engine;
  return `jdbc:${driver}://${DB_SERVICE_NAME}:${port}/${name}`;
}

const STACK_ENV_GENERATORS = {
  laravel: (infra) => {
    const env = {};
    if (infra.database) {
      env.DB_CONNECTION = infra.database.engine === 'mongodb' ? 'mongodb' : (infra.database.engine === 'mysql' || infra.database.engine === 'mariadb') ? 'mysql' : 'pgsql';
      env.DB_HOST = DB_SERVICE_NAME;
      env.DB_PORT = String(infra.database.port);
      env.DB_DATABASE = infra.database.name;
      env.DB_USERNAME = DB_DEFAULTS.user;
      env.DB_PASSWORD = DB_DEFAULTS.password;
    }
    if (infra.cache) {
      env.REDIS_HOST = CACHE_SERVICE_NAME;
      env.REDIS_PORT = String(infra.cache.port);
    }
    if (infra.queue) {
      env.QUEUE_CONNECTION = infra.queue.engine === 'redis' ? 'redis' : infra.queue.engine;
    }
    return env;
  },

  django: (infra) => {
    const env = {};
    if (infra.database) {
      env.DATABASE_URL = buildDatabaseUrl(infra.database.engine, infra.database.name, infra.database.port);
    }
    if (infra.cache) {
      env.REDIS_URL = `redis://${CACHE_SERVICE_NAME}:${infra.cache.port}/0`;
    }
    if (infra.queue) {
      env.CELERY_BROKER_URL = infra.queue.engine === 'rabbitmq'
        ? `amqp://${DB_DEFAULTS.user}:${DB_DEFAULTS.password}@${QUEUE_SERVICE_NAME}:${infra.queue.port}/`
        : `redis://${QUEUE_SERVICE_NAME}:${infra.queue.port}/1`;
    }
    return env;
  },

  fastapi: (infra) => STACK_ENV_GENERATORS.django(infra),

  'spring-boot': (infra) => {
    const env = {};
    if (infra.database) {
      env.SPRING_DATASOURCE_URL = buildJdbcUrl(infra.database.engine, infra.database.name, infra.database.port);
      env.SPRING_DATASOURCE_USERNAME = DB_DEFAULTS.user;
      env.SPRING_DATASOURCE_PASSWORD = DB_DEFAULTS.password;
    }
    if (infra.cache) {
      env.SPRING_REDIS_HOST = CACHE_SERVICE_NAME;
      env.SPRING_REDIS_PORT = String(infra.cache.port);
    }
    if (infra.queue) {
      env.SPRING_RABBITMQ_HOST = QUEUE_SERVICE_NAME;
      env.SPRING_RABBITMQ_PORT = String(infra.queue.port);
      env.SPRING_RABBITMQ_USERNAME = DB_DEFAULTS.user;
      env.SPRING_RABBITMQ_PASSWORD = DB_DEFAULTS.password;
    }
    return env;
  },

  express: (infra) => {
    const env = {};
    if (infra.database) {
      env.DB_HOST = DB_SERVICE_NAME;
      env.DB_PORT = String(infra.database.port);
      env.DB_NAME = infra.database.name;
      env.DB_USER = DB_DEFAULTS.user;
      env.DB_PASSWORD = DB_DEFAULTS.password;
    }
    if (infra.cache) {
      env.REDIS_URL = `redis://${CACHE_SERVICE_NAME}:${infra.cache.port}/0`;
    }
    if (infra.queue) {
      env.AMQP_URL = `amqp://${DB_DEFAULTS.user}:${DB_DEFAULTS.password}@${QUEUE_SERVICE_NAME}:${infra.queue.port}/`;
    }
    return env;
  },
};

STACK_ENV_GENERATORS.symfony = STACK_ENV_GENERATORS.laravel;
STACK_ENV_GENERATORS.nestjs = STACK_ENV_GENERATORS.express;
STACK_ENV_GENERATORS.dotnet = STACK_ENV_GENERATORS.express;

export function generateEnvVars(stack, infra) {
  const generator = STACK_ENV_GENERATORS[stack] || STACK_ENV_GENERATORS.express;
  const env = generator(infra);

  if (infra.database && !env.DATABASE_URL) {
    env.DATABASE_URL = buildDatabaseUrl(infra.database.engine, infra.database.name, infra.database.port);
  }

  return env;
}
