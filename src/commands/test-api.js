// Phase 6: API test generation
// Spec: docs/10-API-TESTING.md

import chalk from 'chalk';
import { readdirSync, existsSync } from 'fs';
import { resolve } from 'path';

import { ApiTestService } from '../services/api-test.service.js';
import { JiraService } from '../services/jira.service.js';
import { logger } from '../utils/logger.js';

// ── testApiCommand ─────────────────────────────────────────────────────────────

export async function testApiCommand(jiraId, options = {}) {
  try {
    // 1. If no jiraId, check for existing tests in .devflow/tests/
    if (!jiraId) {
      const testsDir = resolve('.devflow/tests');
      if (existsSync(testsDir)) {
        const files = readdirSync(testsDir);
        if (files.length > 0) {
          console.log(chalk.bold.cyan('── Existing test files ──────────────────────────────'));
          files.forEach((f) => console.log(`  ${f}`));
          console.log('');
          logger.info('Provide a Jira ID to generate new tests.');
          return;
        }
      }
      logger.error('No Jira ID provided and no existing tests found.');
      return;
    }

    // 2. Fetch Jira task
    logger.step('Fetching from Jira...');
    const jiraService = new JiraService();
    const task = await jiraService.getIssue(jiraId);

    // 3. Create ApiTestService, call generate(task, options)
    logger.step('Generating API tests...');
    const apiTestService = new ApiTestService();
    const result = await apiTestService.generate(task, { format: options.format });

    // 4. Display summary: endpoints found, test cases count by category
    console.log('');
    console.log(chalk.bold.cyan('── API Test Generation Summary ──────────────────────'));
    console.log(`  Task:       ${task.key} — ${task.summary}`);
    console.log(`  Endpoints:  ${result.endpoints.length} found`);

    if (result.endpoints.length > 0) {
      result.endpoints.forEach((ep) => {
        console.log(`    ${chalk.bold(ep.method.padEnd(7))} ${ep.path}`);
      });
    }

    console.log('');
    console.log(`  Test cases: ${result.testCases.length} total`);

    // Count by category
    const categories = {};
    for (const tc of result.testCases) {
      categories[tc.category] = (categories[tc.category] ?? 0) + 1;
    }
    for (const [cat, count] of Object.entries(categories)) {
      console.log(`    ${cat.padEnd(20)} ${count}`);
    }

    // 5. List output files
    console.log('');
    console.log(chalk.bold.cyan('── Output Files ─────────────────────────────────────'));
    for (const file of result.files) {
      console.log(`  ${file}`);
    }
    console.log('');

    // 6. If options.run: run the tests
    if (options.run) {
      const vitestFile = result.files.find((f) => f.endsWith('.test.js'));
      if (vitestFile) {
        logger.step(`Running tests: ${vitestFile}`);
        const runResult = await apiTestService.runTests(vitestFile);
        console.log('');
        console.log(chalk.bold.cyan('── Test Results ─────────────────────────────────────'));
        console.log(`  Passed: ${chalk.green(runResult.passed)}`);
        console.log(`  Failed: ${chalk.red(runResult.failed)}`);
        console.log(`  Total:  ${runResult.total}`);
        console.log('');
        if (runResult.output) {
          console.log(runResult.output.slice(0, 500));
        }
      } else {
        logger.warn('No Vitest file generated. Use --format all or --format vitest to run tests.');
      }
    }

    logger.success(`API tests generated for ${jiraId}`);
  } catch (err) {
    logger.error(err.message);
    if (err.message && (err.message.includes('401') || err.message.includes('Unauthorized'))) {
      logger.dim('Hint: Check that DEVFLOW_JIRA_TOKEN is set correctly.');
    }
  }
}
