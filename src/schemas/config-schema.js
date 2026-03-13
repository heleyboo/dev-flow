import { STACK_MAP, getStackDefaults } from '../maps/stack-map.js';
import { INFRA_MAP } from '../maps/infra-map.js';

const VALID_ROLES = ['backend', 'frontend', 'fullstack', 'worker', 'gateway'];
const VALID_STACKS = Object.keys(STACK_MAP);
const VALID_LANGUAGES = ['php', 'python', 'javascript', 'typescript', 'java', 'csharp', 'go', 'rust'];
const VALID_DB_ENGINES = ['postgresql', 'mysql', 'mariadb', 'mongodb', 'sqlite'];

export function validateConfig(config) {
  const errors = [];

  if (config.version !== 2) {
    errors.push({ field: 'version', message: 'version must be 2' });
  }

  if (!config.project?.name) {
    errors.push({ field: 'project.name', message: 'project.name is required' });
  }

  if (!config.services || Object.keys(config.services).length === 0) {
    errors.push({ field: 'services', message: 'at least one service is required' });
  } else {
    for (const [name, svc] of Object.entries(config.services)) {
      if (!svc.role || !VALID_ROLES.includes(svc.role)) {
        errors.push({ field: `services.${name}.role`, message: `invalid role: ${svc.role}` });
      }
      if (!svc.stack || !VALID_STACKS.includes(svc.stack)) {
        errors.push({ field: `services.${name}.stack`, message: `invalid stack: ${svc.stack}` });
      }
      if (!svc.language?.name || !VALID_LANGUAGES.includes(svc.language.name)) {
        errors.push({ field: `services.${name}.language.name`, message: `invalid language: ${svc.language?.name}` });
      }
    }
  }

  if (config.infrastructure) {
    const infra = config.infrastructure;
    if (infra.database && typeof infra.database === 'object') {
      if (!infra.database.engine) {
        errors.push({ field: 'infrastructure.database.engine', message: 'engine is required when database is defined' });
      } else if (!VALID_DB_ENGINES.includes(infra.database.engine)) {
        errors.push({ field: 'infrastructure.database.engine', message: `invalid engine: ${infra.database.engine}` });
      }
    }
  }

  const enriched = applyDefaults(structuredClone(config));
  return { valid: errors.length === 0, errors, config: enriched };
}

function applyDefaults(config) {
  if (config.project) {
    config.project.structure = config.project.structure || 'monorepo';
    config.project.description = config.project.description || '';
    config.project.preset = config.project.preset ?? null;
  }

  if (config.services) {
    for (const [name, svc] of Object.entries(config.services)) {
      const stackDefaults = getStackDefaults(svc.stack, svc.language?.version);
      svc.path = svc.path || '.';
      svc.repo = svc.repo ?? null;
      svc.framework_version = svc.framework_version || 'latest';
      if (stackDefaults) {
        svc.language = svc.language || {};
        svc.language.version = svc.language.version || stackDefaults.language.version;
        svc.build_command = svc.build_command || stackDefaults.build_command;
        svc.dev_command = svc.dev_command || stackDefaults.dev_command;
        svc.test_command = svc.test_command || stackDefaults.test_command;
        svc.lint_command = svc.lint_command || stackDefaults.lint_command;
        svc.entry_point = svc.entry_point || stackDefaults.entry_point;
      }
    }
  }

  return config;
}

export function migrateV1toV2(v1Config) {
  const v2 = {
    version: 2,
    project: {
      name: v1Config.project?.name || 'unnamed',
      description: v1Config.project?.description || '',
      preset: null,
      structure: 'monorepo',
    },
    services: {},
  };

  const stack = v1Config.project?.type || 'laravel';
  const langVersion = v1Config.project?.php_version || v1Config.project?.python_version || null;
  const stackDefaults = getStackDefaults(stack);

  v2.services.api = {
    role: 'backend',
    stack,
    language: {
      name: stackDefaults?.language?.name || 'php',
      ...(langVersion ? { version: langVersion } : {}),
    },
    path: '.',
  };

  if (v1Config.frontend?.framework) {
    v2.services.web = {
      role: 'frontend',
      stack: v1Config.frontend.framework,
      language: { name: 'typescript' },
      ...(v1Config.frontend.src_dir ? { src_dir: v1Config.frontend.src_dir } : {}),
      ...(v1Config.frontend.component_style ? { component_style: v1Config.frontend.component_style } : {}),
      ...(v1Config.frontend.testing ? { test_framework: v1Config.frontend.testing } : {}),
    };
  }

  for (const section of ['jira', 'figma', 'git', 'deploy', 'prompt', 'test']) {
    if (v1Config[section]) {
      v2[section] = v1Config[section];
    }
  }

  return v2;
}
