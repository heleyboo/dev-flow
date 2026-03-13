#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';

const program = new Command();

program
  .name('devflow')
  .description('CLI tool to automate multi-stack developer workflow')
  .version('1.0.0');

// ─── Phase 1: Init & Doctor ──────────────────
program
  .command('init')
  .description('Setup DevFlow for current project')
  .option('--workspace', 'Generate workspace docker-compose for multi-repo')
  .action(async (options) => {
    const { initCommand } = await import('../src/commands/init.js');
    await initCommand(options);
  });

program
  .command('doctor')
  .description('Check DevFlow setup and connections')
  .option('--fix', 'Show suggested fix commands')
  .action(async (options) => {
    const { doctorCommand } = await import('../src/commands/doctor.js');
    await doctorCommand(options);
  });

// ─── Phase 1: Jira ──────────────────────────
const task = program
  .command('task')
  .description('Jira task operations');

task
  .command('get <jiraId>')
  .description('Fetch and display task details')
  .option('--json', 'Output raw JSON')
  .option('--with-comments', 'Include comments')
  .option('--with-history', 'Include status history')
  .action(async (jiraId, options) => {
    const { taskGetCommand } = await import('../src/commands/task.js');
    await taskGetCommand(jiraId, options);
  });

task
  .command('list')
  .description('List assigned tasks')
  .option('--status <status>', 'Filter by status')
  .option('--sprint <name>', 'Filter by sprint')
  .action(async (options) => {
    const { taskListCommand } = await import('../src/commands/task.js');
    await taskListCommand(options);
  });

// ─── Phase 2: Figma ─────────────────────────
program
  .command('figma <urlOrJiraId>')
  .description('Extract specs from Figma')
  .option('--node <nodeId>', 'Target specific frame/component')
  .option('--depth <n>', 'Traverse depth', '3')
  .option('--format <fmt>', 'Output format: md|json|yaml', 'md')
  .option('--save', 'Save to .devflow/figma-specs/')
  .option('--tokens', 'Extract only design tokens')
  .action(async (urlOrJiraId, options) => {
    const { figmaCommand } = await import('../src/commands/figma.js');
    await figmaCommand(urlOrJiraId, options);
  });

// ─── Phase 3: Prompt ────────────────────────
program
  .command('prompt <jiraId>')
  .description('Generate prompt from Jira task')
  .option('--template <name>', 'Force template')
  .option('--no-figma', 'Skip Figma extraction')
  .option('--no-code-context', 'Skip codebase scanning')
  .option('--frontend', 'Generate frontend prompt')
  .option('--fullstack', 'Generate both BE + FE prompts')
  .option('--include <files>', 'Include specific files')
  .option('--open', 'Open in editor')
  .option('--lang <lang>', 'Prompt language: vi|en', 'vi')
  .action(async (jiraId, options) => {
    const { promptCommand } = await import('../src/commands/prompt.js');
    await promptCommand(jiraId, options);
  });

// ─── Phase 4: Git ───────────────────────────
program
  .command('start <jiraId>')
  .description('Start working on task (create branch)')
  .option('--base <branch>', 'Override base branch')
  .option('--no-transition', 'Skip Jira status update')
  .option('--prefix <type>', 'Override prefix')
  .action(async (jiraId, options) => {
    const { startCommand } = await import('../src/commands/ship.js');
    await startCommand(jiraId, options);
  });

program
  .command('commit [message]')
  .description('Smart commit with auto-generated message')
  .option('-a, --all', 'Stage all changes')
  .option('--amend', 'Amend previous commit')
  .option('--type <type>', 'Force commit type')
  .action(async (message, options) => {
    const { commitCommand } = await import('../src/commands/ship.js');
    await commitCommand(message, options);
  });

program
  .command('ship [jiraId]')
  .description('Push and create Pull Request')
  .option('--draft', 'Create as draft PR')
  .option('--no-test', 'Skip tests')
  .option('--reviewer <users>', 'Assign reviewers')
  .option('--target <branch>', 'Override target branch')
  .action(async (jiraId, options) => {
    const { shipCommand } = await import('../src/commands/ship.js');
    await shipCommand(jiraId, options);
  });

// ─── Phase 5: Deploy ────────────────────────
const deploy = program
  .command('deploy')
  .description('Deploy operations');

deploy
  .command('run [environment]')
  .description('Deploy to environment')
  .option('--dry-run', 'Show what would happen')
  .option('--rollback', 'Rollback to previous')
  .option('--force', 'Force deploy')
  .action(async (environment, options) => {
    const { deployCommand } = await import('../src/commands/deploy.js');
    await deployCommand(environment || 'staging', options);
  });

deploy
  .command('status')
  .description('Show environment status')
  .action(async () => {
    const { deployStatusCommand } = await import('../src/commands/deploy.js');
    await deployStatusCommand();
  });

deploy
  .command('rollback [environment]')
  .description('Rollback to previous version')
  .action(async (environment) => {
    const { deployRollbackCommand } = await import('../src/commands/deploy.js');
    await deployRollbackCommand(environment || 'staging');
  });

deploy
  .command('log [environment]')
  .description('Show deploy history')
  .action(async (environment) => {
    const { deployLogCommand } = await import('../src/commands/deploy.js');
    await deployLogCommand(environment || 'staging');
  });

// ─── Phase 6: Testing ───────────────────────
program
  .command('test:api [jiraId]')
  .description('Generate/run API tests')
  .option('--format <fmt>', 'Output format: http|postman|jest|all', 'all')
  .option('--run', 'Run tests immediately')
  .option('--only <category>', 'Only specific category')
  .action(async (jiraId, options) => {
    const { testApiCommand } = await import('../src/commands/test-api.js');
    await testApiCommand(jiraId, options);
  });

program
  .command('test:e2e [jiraId]')
  .description('Generate/run E2E tests')
  .option('--framework <fw>', 'playwright|cypress')
  .option('--run', 'Run immediately')
  .option('--headed', 'Run in headed mode')
  .option('--mobile', 'Include mobile tests')
  .action(async (jiraId, options) => {
    const { testE2eCommand } = await import('../src/commands/test-e2e.js');
    await testE2eCommand(jiraId, options);
  });

// ─── Phase 7: Web Dashboard ─────────────────
program
  .command('web')
  .description('Start web dashboard')
  .option('--port <n>', 'Custom port', '3456')
  .option('--host <ip>', 'Bind host', 'localhost')
  .option('--open', 'Auto-open browser')
  .action(async (options) => {
    const { webCommand } = await import('../src/commands/web.js');
    await webCommand(options);
  });

program.parse();
