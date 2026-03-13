import { existsSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';
import { loadConfig, resetConfig } from '../utils/config.js';
import { validateConfig } from '../schemas/config-schema.js';

export function runChecks(projectRoot) {
  const results = [];

  // Reset config cache so we read fresh
  resetConfig();

  // Config checks
  const configPath = resolve(projectRoot, '.devflow.yml');
  if (!existsSync(configPath)) {
    results.push({ category: 'config', name: '.devflow.yml exists', status: 'fail', message: 'Not found. Run `devflow init`.' });
    return results;
  }
  results.push({ category: 'config', name: '.devflow.yml exists', status: 'pass' });

  const raw = loadConfig(projectRoot);
  if (!raw) {
    results.push({ category: 'config', name: 'Config parseable', status: 'fail', message: 'Failed to parse YAML.' });
    return results;
  }
  results.push({ category: 'config', name: 'Config parseable', status: 'pass' });

  if (!raw.version) {
    results.push({ category: 'config', name: 'Schema version', status: 'warn', message: 'v1 schema detected. Run `devflow init` to migrate.' });
  } else {
    const validation = validateConfig(raw);
    if (validation.valid) {
      results.push({ category: 'config', name: 'Schema valid', status: 'pass' });
    } else {
      for (const err of validation.errors) {
        results.push({ category: 'config', name: `Schema: ${err.field}`, status: 'fail', message: err.message });
      }
    }
  }

  // Docker checks
  try {
    execSync('docker --version', { stdio: 'pipe' });
    results.push({ category: 'docker', name: 'Docker installed', status: 'pass' });
  } catch {
    results.push({ category: 'docker', name: 'Docker installed', status: 'fail', message: 'Docker not found.' });
  }

  try {
    execSync('docker compose version', { stdio: 'pipe' });
    results.push({ category: 'docker', name: 'Docker Compose installed', status: 'pass' });
  } catch {
    results.push({ category: 'docker', name: 'Docker Compose installed', status: 'fail', message: 'Docker Compose not found.' });
  }

  // Service path checks
  if (raw.services) {
    for (const [name, svc] of Object.entries(raw.services)) {
      const svcPath = svc.path === '.' ? projectRoot : resolve(projectRoot, svc.path);
      if (existsSync(svcPath)) {
        results.push({ category: 'services', name: `${name}: path exists`, status: 'pass' });
      } else {
        results.push({ category: 'services', name: `${name}: path exists`, status: 'fail', message: `Path not found: ${svc.path}` });
      }
    }
  }

  // Port checks
  if (raw.services) {
    for (const [name, svc] of Object.entries(raw.services)) {
      if (svc.port) {
        try {
          execSync(`ss -tlnp 2>/dev/null | grep :${svc.port}`, { stdio: 'pipe' });
          results.push({ category: 'services', name: `${name}: port ${svc.port}`, status: 'warn', message: 'Port already in use.' });
        } catch {
          results.push({ category: 'services', name: `${name}: port ${svc.port}`, status: 'pass' });
        }
      }
    }
  }

  // Infrastructure checks
  if (raw.infrastructure) {
    for (const [category, infra] of Object.entries(raw.infrastructure)) {
      if (!infra || !infra.engine || infra.engine === 'none') continue;
      try {
        execSync(`docker compose ps --status running ${category} 2>/dev/null | grep ${category}`, { stdio: 'pipe' });
        results.push({ category: 'infrastructure', name: `${category}: container running`, status: 'pass' });
      } catch {
        results.push({ category: 'infrastructure', name: `${category}: container running`, status: 'warn', message: 'Container not running. Run `docker compose up -d`.' });
      }
    }
  }

  // Jira config checks
  if (raw.jira) {
    if (raw.jira.host) {
      results.push({ category: 'jira', name: 'Jira host configured', status: 'pass' });
    } else {
      results.push({ category: 'jira', name: 'Jira host configured', status: 'fail', message: 'jira.host not set in .devflow.yml' });
    }
    if (raw.jira.email) {
      results.push({ category: 'jira', name: 'Jira email configured', status: 'pass' });
    } else {
      results.push({ category: 'jira', name: 'Jira email configured', status: 'fail', message: 'jira.email not set in .devflow.yml' });
    }
    if (process.env.DEVFLOW_JIRA_TOKEN) {
      results.push({ category: 'jira', name: 'DEVFLOW_JIRA_TOKEN set', status: 'pass' });
    } else {
      results.push({ category: 'jira', name: 'DEVFLOW_JIRA_TOKEN set', status: 'warn', message: 'Set DEVFLOW_JIRA_TOKEN env var for Jira integration' });
    }
  }

  // Linked project checks
  if (raw.linked_projects) {
    for (const [name, linked] of Object.entries(raw.linked_projects)) {
      const localPath = resolve(projectRoot, linked.local_path);
      if (existsSync(localPath)) {
        results.push({ category: 'linked', name: `${name}: local path`, status: 'pass' });
        if (existsSync(resolve(localPath, '.devflow.yml'))) {
          results.push({ category: 'linked', name: `${name}: has config`, status: 'pass' });
        } else {
          results.push({ category: 'linked', name: `${name}: has config`, status: 'warn', message: 'No .devflow.yml in linked project.' });
        }
      } else {
        results.push({ category: 'linked', name: `${name}: local path`, status: 'fail', message: `Not found: ${linked.local_path}` });
      }

      if (linked.infrastructure_from) {
        if (raw.services?.[linked.infrastructure_from]) {
          results.push({ category: 'linked', name: `${name}: infrastructure_from target`, status: 'pass' });
        } else {
          results.push({ category: 'linked', name: `${name}: infrastructure_from target`, status: 'fail', message: `Target "${linked.infrastructure_from}" not found in services.` });
        }
      }
    }
  }

  return results;
}

export function generateFixSuggestions(results) {
  const fixes = [];
  for (const r of results) {
    if (r.status !== 'fail') continue;
    if (r.name.includes('.devflow.yml exists')) {
      fixes.push({ check: r.name, command: 'devflow init' });
    } else if (r.name.includes('Docker installed')) {
      fixes.push({ check: r.name, command: 'Install Docker: https://docs.docker.com/get-docker/' });
    } else if (r.name.includes('Docker Compose')) {
      fixes.push({ check: r.name, command: 'Install Docker Compose: https://docs.docker.com/compose/install/' });
    } else if (r.name.includes('path exists')) {
      fixes.push({ check: r.name, command: `mkdir -p ${r.message?.split(': ')[1] || 'path'}` });
    } else if (r.name.includes('container running')) {
      fixes.push({ check: r.name, command: 'docker compose up -d' });
    } else if (r.name.includes('DEVFLOW_JIRA_TOKEN')) {
      fixes.push({ check: r.name, command: 'export DEVFLOW_JIRA_TOKEN=your_jira_api_token' });
    } else if (r.name.includes('Jira host')) {
      fixes.push({ check: r.name, command: 'Add jira.host to .devflow.yml' });
    } else if (r.name.includes('Jira email')) {
      fixes.push({ check: r.name, command: 'Add jira.email to .devflow.yml' });
    }
  }
  return fixes;
}

export async function doctorCommand(options = {}) {
  logger.info('DevFlow Health Check');
  console.log(chalk.dim('═'.repeat(50)));

  const results = runChecks(process.cwd());

  const icons = { pass: chalk.green('PASS'), fail: chalk.red('FAIL'), warn: chalk.yellow('WARN') };

  let lastCategory = '';
  for (const r of results) {
    if (r.category !== lastCategory) {
      console.log(chalk.bold(`\n${r.category.toUpperCase()}`));
      lastCategory = r.category;
    }
    const msg = r.message ? chalk.dim(` — ${r.message}`) : '';
    console.log(`  ${icons[r.status]} ${r.name}${msg}`);
  }

  if (options.fix) {
    const fixes = generateFixSuggestions(results);
    if (fixes.length > 0) {
      console.log(chalk.bold('\nSuggested fixes:'));
      for (const fix of fixes) {
        console.log(`  ${chalk.cyan(fix.check)}: ${chalk.yellow(fix.command)}`);
      }
    }
  }

  const failed = results.filter(r => r.status === 'fail').length;
  const warned = results.filter(r => r.status === 'warn').length;
  console.log('');
  if (failed > 0) {
    logger.error(`${failed} check(s) failed, ${warned} warning(s).`);
  } else if (warned > 0) {
    logger.warn(`All checks passed with ${warned} warning(s).`);
  } else {
    logger.success('All checks passed!');
  }
}
