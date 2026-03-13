import inquirer from 'inquirer';
import { writeFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import YAML from 'yaml';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';
import { loadPreset, listPresets, applyPresetOverrides } from '../presets/index.js';
import { getStackDefaults } from '../maps/stack-map.js';
import { getInfraDefaults } from '../maps/infra-map.js';
import { generateEnvVars } from '../maps/env-map.js';
import { DetectorService } from '../services/detector.service.js';
import { DockerService } from '../services/docker.service.js';
import { validateConfig, migrateV1toV2 } from '../schemas/config-schema.js';

const BACKEND_STACKS = ['laravel', 'symfony', 'django', 'fastapi', 'express', 'nestjs', 'spring-boot', 'dotnet'];
const FRONTEND_STACKS = ['react', 'vue', 'angular', 'nextjs', 'nuxtjs', 'svelte', 'none'];
const DB_ENGINES = ['postgresql', 'mysql', 'mariadb', 'mongodb', 'sqlite', 'none'];
const CACHE_ENGINES = ['redis', 'memcached', 'none'];
const QUEUE_ENGINES = ['rabbitmq', 'redis', 'sqs', 'kafka', 'none'];
const SEARCH_ENGINES = ['elasticsearch', 'meilisearch', 'typesense', 'none'];
const STORAGE_ENGINES = ['minio', 'localstack', 'none'];

export function buildConfigFromPreset({ presetName, projectName, projectDescription, overrides }) {
  const preset = loadPreset(presetName);
  if (!preset) throw new Error(`Unknown preset: ${presetName}`);

  const merged = overrides ? applyPresetOverrides(preset, overrides) : preset;
  return {
    version: 2,
    project: {
      name: projectName,
      description: projectDescription || '',
      preset: presetName,
      structure: 'monorepo',
    },
    services: merged.services,
    infrastructure: merged.infrastructure,
  };
}

export function buildConfigFromCustom({ projectName, projectDescription, backend, frontend, database, cache, queue, search, storage }) {
  const config = {
    version: 2,
    project: { name: projectName, description: projectDescription || '', preset: null, structure: 'monorepo' },
    services: {},
    infrastructure: {},
  };

  if (backend) {
    const defaults = getStackDefaults(backend.stack);
    config.services.api = {
      role: 'backend',
      stack: backend.stack,
      language: defaults?.language || { name: 'unknown' },
      path: '.',
      port: backend.port || 8000,
    };
  }

  if (frontend) {
    const defaults = getStackDefaults(frontend.stack);
    config.services.web = {
      role: 'frontend',
      stack: frontend.stack,
      language: defaults?.language || { name: 'typescript' },
      path: './frontend',
      port: frontend.port || 3000,
    };
  }

  for (const [category, selection] of Object.entries({ database, cache, queue, search, storage })) {
    if (selection && selection.engine && selection.engine !== 'none') {
      const infraDefaults = getInfraDefaults(selection.engine, selection.version);
      config.infrastructure[category] = {
        engine: selection.engine,
        version: selection.version || infraDefaults?.default_version,
        port: selection.port || infraDefaults?.port,
        ...(category === 'database' ? { name: `${projectName.replace(/-/g, '_')}_db` } : {}),
      };
    }
  }

  return config;
}

export function detectExistingProject(projectRoot) {
  const detector = new DetectorService();
  const fileMap = {};

  const rootFiles = ['composer.json', 'requirements.txt', 'pyproject.toml', 'package.json', 'pom.xml', 'build.gradle', 'go.mod', 'Cargo.toml'];
  for (const f of rootFiles) {
    const p = resolve(projectRoot, f);
    if (existsSync(p)) {
      fileMap[f] = readFileSync(p, 'utf-8');
    }
  }

  try {
    const dirs = readdirSync(projectRoot, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules' && d.name !== 'vendor');
    for (const dir of dirs) {
      for (const f of rootFiles) {
        const p = resolve(projectRoot, dir.name, f);
        if (existsSync(p)) {
          fileMap[`${dir.name}/${f}`] = readFileSync(p, 'utf-8');
        }
      }
    }
  } catch { /* ignore */ }

  try {
    const entries = readdirSync(projectRoot);
    for (const e of entries) {
      if (e.endsWith('.csproj') || e.endsWith('.sln')) {
        fileMap[e] = readFileSync(resolve(projectRoot, e), 'utf-8');
      }
    }
  } catch { /* ignore */ }

  const detection = detector.detectFromFiles(fileMap);

  let infrastructure = { database: null, cache: null, queue: null, search: null, storage: null };
  const composePath = resolve(projectRoot, 'docker-compose.yml');
  if (existsSync(composePath)) {
    infrastructure = detector.detectInfraFromDockerCompose(readFileSync(composePath, 'utf-8'));
  }

  return { ...detection, infrastructure };
}

export async function initCommand(options = {}) {
  logger.info('DevFlow Setup');
  console.log(chalk.dim('═'.repeat(50)));

  const projectRoot = process.cwd();

  const existingConfig = resolve(projectRoot, '.devflow.yml');
  if (existsSync(existingConfig)) {
    const raw = YAML.parse(readFileSync(existingConfig, 'utf-8'));
    if (!raw.version) {
      const { migrate } = await inquirer.prompt([{
        type: 'confirm', name: 'migrate',
        message: 'Found v1 .devflow.yml. Migrate to v2 multi-stack schema?', default: true,
      }]);
      if (migrate) {
        const v2 = migrateV1toV2(raw);
        writeFileSync(existingConfig + '.v1.bak', readFileSync(existingConfig, 'utf-8'));
        writeFileSync(existingConfig, YAML.stringify(v2));
        logger.success('Migrated to v2. Backup saved to .devflow.yml.v1.bak');
        return;
      }
    } else {
      logger.warn('.devflow.yml already exists. Use `devflow doctor` to check setup.');
      return;
    }
  }

  const isEmpty = readdirSync(projectRoot).filter(f => !f.startsWith('.')).length === 0;

  const { projectName, projectDescription } = await inquirer.prompt([
    { type: 'input', name: 'projectName', message: 'Project name:', default: projectRoot.split('/').pop() },
    { type: 'input', name: 'projectDescription', message: 'Description (optional):' },
  ]);

  let config;

  if (isEmpty) {
    const { mode } = await inquirer.prompt([{
      type: 'list', name: 'mode', message: 'Setup mode:',
      choices: [
        { name: 'Preset (quick start)', value: 'preset' },
        { name: 'Custom (pick each component)', value: 'custom' },
      ],
    }]);

    if (mode === 'preset') {
      const presets = listPresets();
      const { presetName } = await inquirer.prompt([{
        type: 'list', name: 'presetName', message: 'Select preset:', choices: presets,
      }]);
      config = buildConfigFromPreset({ presetName, projectName, projectDescription });
    } else {
      config = await runCustomFlow(projectName, projectDescription);
    }
  } else {
    logger.step('Scanning project directory...');
    const detected = detectExistingProject(projectRoot);

    if (detected.services.length > 0) {
      console.log(chalk.cyan('\nDetected:'));
      for (const svc of detected.services) {
        console.log(`  ${svc.role}: ${svc.stack} (${svc.path})`);
      }

      const { confirm } = await inquirer.prompt([{
        type: 'confirm', name: 'confirm', message: 'Use detected configuration?', default: true,
      }]);

      if (confirm) {
        config = {
          version: 2,
          project: { name: projectName, description: projectDescription, preset: null, structure: detected.structure },
          services: {},
          infrastructure: detected.infrastructure,
        };
        for (const svc of detected.services) {
          const name = svc.role === 'frontend' ? 'web' : 'api';
          config.services[name] = { ...svc };
        }
      }
    }

    if (!config) {
      config = await runCustomFlow(projectName, projectDescription);
    }
  }

  const result = validateConfig(config);
  if (!result.valid) {
    logger.error('Config validation failed:');
    for (const err of result.errors) {
      console.log(`  ${err.field}: ${err.message}`);
    }
    return;
  }

  config = result.config;

  writeFileSync(resolve(projectRoot, '.devflow.yml'), YAML.stringify(config));
  logger.success('Created .devflow.yml');

  const docker = new DockerService();
  const composeContent = docker.generateCompose(config);
  writeFileSync(resolve(projectRoot, 'docker-compose.yml'), composeContent);
  logger.success('Created docker-compose.yml');

  for (const [name, svc] of Object.entries(config.services)) {
    const svcPath = svc.path === '.' ? projectRoot : resolve(projectRoot, svc.path);
    mkdirSync(svcPath, { recursive: true });
    const dockerfile = docker.generateDockerfile(svc);
    if (dockerfile) {
      writeFileSync(resolve(svcPath, 'Dockerfile'), dockerfile);
      logger.success(`Created ${svc.path}/Dockerfile`);
    }
  }

  const backendService = Object.values(config.services).find(s => s.role === 'backend');
  if (backendService && config.infrastructure) {
    const envVars = generateEnvVars(backendService.stack, config.infrastructure);
    const envContent = Object.entries(envVars).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
    const envExample = Object.entries(envVars).map(([k]) => `${k}=`).join('\n') + '\n';
    writeFileSync(resolve(projectRoot, '.env'), envContent);
    writeFileSync(resolve(projectRoot, '.env.example'), envExample);
    logger.success('Created .env and .env.example');
  }

  // Update .gitignore
  const gitignorePath = resolve(projectRoot, '.gitignore');
  const gitignoreEntries = ['.env', '.devflow/cache/'];
  if (existsSync(gitignorePath)) {
    const existing = readFileSync(gitignorePath, 'utf-8');
    const toAdd = gitignoreEntries.filter(e => !existing.includes(e));
    if (toAdd.length > 0) {
      writeFileSync(gitignorePath, existing.trimEnd() + '\n' + toAdd.join('\n') + '\n');
      logger.success('Updated .gitignore');
    }
  } else {
    writeFileSync(gitignorePath, gitignoreEntries.join('\n') + '\n');
    logger.success('Created .gitignore');
  }

  mkdirSync(resolve(projectRoot, '.devflow/cache'), { recursive: true });
  mkdirSync(resolve(projectRoot, '.devflow/prompts'), { recursive: true });

  console.log('');
  logger.success('DevFlow initialized! Run `devflow doctor` to verify setup.');
}

async function runCustomFlow(projectName, projectDescription) {
  const { backendStack } = await inquirer.prompt([{
    type: 'list', name: 'backendStack', message: 'Backend stack:', choices: BACKEND_STACKS,
  }]);

  const { frontendStack } = await inquirer.prompt([{
    type: 'list', name: 'frontendStack', message: 'Frontend stack:', choices: FRONTEND_STACKS,
  }]);

  const { dbEngine } = await inquirer.prompt([{
    type: 'list', name: 'dbEngine', message: 'Database:', choices: DB_ENGINES,
  }]);

  const { cacheEngine } = await inquirer.prompt([{
    type: 'list', name: 'cacheEngine', message: 'Cache:', choices: CACHE_ENGINES,
  }]);

  const { queueEngine } = await inquirer.prompt([{
    type: 'list', name: 'queueEngine', message: 'Queue:', choices: QUEUE_ENGINES,
  }]);

  const { searchEngine } = await inquirer.prompt([{
    type: 'list', name: 'searchEngine', message: 'Search engine:', choices: SEARCH_ENGINES,
  }]);

  const { storageEngine } = await inquirer.prompt([{
    type: 'list', name: 'storageEngine', message: 'Object storage:', choices: STORAGE_ENGINES,
  }]);

  return buildConfigFromCustom({
    projectName,
    projectDescription,
    backend: { stack: backendStack, port: 8000 },
    frontend: frontendStack !== 'none' ? { stack: frontendStack, port: 3000 } : null,
    database: dbEngine !== 'none' ? { engine: dbEngine } : null,
    cache: cacheEngine !== 'none' ? { engine: cacheEngine } : null,
    queue: queueEngine !== 'none' ? { engine: queueEngine } : null,
    search: searchEngine !== 'none' ? { engine: searchEngine } : null,
    storage: storageEngine !== 'none' ? { engine: storageEngine } : null,
  });
}
