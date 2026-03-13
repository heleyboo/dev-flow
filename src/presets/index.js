import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import { getStackDefaults } from '../maps/stack-map.js';
import { getInfraDefaults } from '../maps/infra-map.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function listPresets() {
  return readdirSync(__dirname)
    .filter(f => f.endsWith('.yml'))
    .map(f => f.replace('.yml', ''));
}

export function loadPreset(name) {
  const filePath = resolve(__dirname, `${name}.yml`);
  try {
    const content = readFileSync(filePath, 'utf-8');
    return YAML.parse(content);
  } catch {
    return null;
  }
}

export function applyPresetOverrides(preset, overrides) {
  const merged = structuredClone(preset);

  if (overrides.services) {
    for (const [name, svcOverrides] of Object.entries(overrides.services)) {
      if (!merged.services[name]) {
        merged.services[name] = svcOverrides;
        continue;
      }
      if (svcOverrides.stack && svcOverrides.stack !== merged.services[name].stack) {
        const stackDefaults = getStackDefaults(svcOverrides.stack);
        if (stackDefaults) {
          merged.services[name] = {
            ...merged.services[name],
            stack: svcOverrides.stack,
            language: stackDefaults.language,
            build_command: stackDefaults.build_command,
            dev_command: stackDefaults.dev_command,
            test_command: stackDefaults.test_command,
            lint_command: stackDefaults.lint_command,
            entry_point: stackDefaults.entry_point,
          };
        }
      }
      Object.assign(merged.services[name], svcOverrides);
    }
  }

  if (overrides.infrastructure) {
    if (!merged.infrastructure) merged.infrastructure = {};
    for (const [key, val] of Object.entries(overrides.infrastructure)) {
      if (val && typeof val === 'object' && val.engine) {
        const infraDefaults = getInfraDefaults(val.engine, val.version);
        if (infraDefaults) {
          merged.infrastructure[key] = {
            engine: val.engine,
            version: val.version || infraDefaults.default_version,
            port: val.port || infraDefaults.port,
            ...val,
          };
        } else {
          merged.infrastructure[key] = val;
        }
      } else {
        merged.infrastructure[key] = val;
      }
    }
  }

  return merged;
}
