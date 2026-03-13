import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import YAML from 'yaml';
import { validateConfig, migrateV1toV2 } from '../schemas/config-schema.js';

const CONFIG_FILE = '.devflow.yml';

let cachedConfig = null;

export function loadConfig(projectRoot = process.cwd()) {
  if (cachedConfig) return cachedConfig;

  const configPath = resolve(projectRoot, CONFIG_FILE);

  if (!existsSync(configPath)) {
    return null;
  }

  const content = readFileSync(configPath, 'utf-8');
  cachedConfig = YAML.parse(content);
  return cachedConfig;
}

export function resetConfig() {
  cachedConfig = null;
}

export function getConfigPath(projectRoot = process.cwd()) {
  return resolve(projectRoot, CONFIG_FILE);
}

export function loadAndValidateConfig(projectRoot = process.cwd()) {
  const raw = loadConfig(projectRoot);
  if (!raw) return null;

  if (!raw.version) {
    const migrated = migrateV1toV2(raw);
    return validateConfig(migrated);
  }

  return validateConfig(raw);
}
