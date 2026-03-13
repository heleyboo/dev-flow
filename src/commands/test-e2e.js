// Phase 6: E2E test generation
// Spec: docs/11-E2E-TESTING.md

import chalk from 'chalk';

import { E2eTestService } from '../services/e2e-test.service.js';
import { JiraService } from '../services/jira.service.js';
import { FigmaService } from '../services/figma.service.js';
import { logger } from '../utils/logger.js';

// ── testE2eCommand ─────────────────────────────────────────────────────────────

export async function testE2eCommand(jiraId, options = {}) {
  try {
    if (!jiraId) {
      logger.error('No Jira ID provided.');
      return;
    }

    // 1. Fetch Jira task
    logger.step('Fetching from Jira...');
    const jiraService = new JiraService();
    const task = await jiraService.getIssue(jiraId);

    // 2. Fetch Figma specs if task has figma links
    let figmaSpecs = [];
    if (task.figmaLinks && task.figmaLinks.length > 0) {
      try {
        logger.step('Fetching Figma specs...');
        const figmaService = new FigmaService();
        for (const link of task.figmaLinks) {
          const spec = await figmaService.extractSpecs(link);
          if (spec) figmaSpecs.push(spec);
        }
      } catch (figmaErr) {
        logger.warn(`Could not fetch Figma specs: ${figmaErr.message}`);
      }
    }

    // 3. Create E2eTestService, call generate
    logger.step('Generating E2E tests...');
    const e2eService = new E2eTestService();
    const result = await e2eService.generate(task, figmaSpecs, options);

    // 4. Display summary
    console.log('');
    console.log(chalk.bold.cyan('── E2E Test Generation Summary ──────────────────────'));
    console.log(`  Task:       ${task.key} — ${task.summary}`);
    console.log(`  Scenarios:  ${result.scenarios.length}`);
    console.log('');
    console.log(chalk.bold.cyan('── Output Files ─────────────────────────────────────'));
    for (const file of result.files) {
      console.log(`  ${file}`);
    }
    console.log('');

    // 5. If options.run: run tests
    if (options.run) {
      const testFile = result.files.find((f) => f.endsWith('.spec.ts') || f.endsWith('.cy.ts'));
      if (testFile) {
        logger.step(`Running tests: ${testFile}`);
        const runResult = await e2eService.runTests({ file: testFile, headed: options.headed });
        console.log('');
        console.log(chalk.bold.cyan('── Test Results ─────────────────────────────────────'));
        console.log(`  Exit code: ${runResult.exitCode === 0 ? chalk.green('0 (passed)') : chalk.red(runResult.exitCode)}`);
        if (runResult.output) {
          console.log(runResult.output.slice(0, 500));
        }
        console.log('');
      } else {
        logger.warn('No test file generated to run.');
      }
    }

    logger.success(`E2E tests generated for ${jiraId}`);
  } catch (err) {
    logger.error(err.message);
    if (err.message && (err.message.includes('401') || err.message.includes('Unauthorized'))) {
      logger.dim('Hint: Check that DEVFLOW_JIRA_TOKEN is set correctly.');
    }
  }
}
