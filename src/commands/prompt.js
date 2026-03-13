// Phase 3: Prompt generation command
// Spec: docs/04-PROMPT-GENERATION.md

import chalk from 'chalk';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

import { PromptService, selectTemplate } from '../services/prompt.service.js';
import { JiraService } from '../services/jira.service.js';
import { logger } from '../utils/logger.js';

// ── promptCommand ─────────────────────────────────────────────────────────────

export async function promptCommand(jiraId, options = {}) {
  try {
    // 1. Fetch task from Jira
    logger.step('Fetching from Jira...');
    const jiraService = new JiraService();
    const task = await jiraService.getIssue(jiraId);

    // 2. Build prompt options from CLI options
    logger.step('Generating prompt...');
    const promptOptions = {
      template: options.template,
      noFigma: options.figma === false,
      noCodeContext: options.codeContext === false,
      frontend: options.frontend,
      fullstack: options.fullstack,
      include: options.include?.split(','),
      lang: options.lang || 'vi',
    };

    // 3. Generate prompt
    const promptService = new PromptService();
    const prompt = await promptService.generatePrompt(task, promptOptions);

    // 4. Save prompt to .devflow/prompts/{jiraId}.md
    const promptsDir = resolve('.devflow/prompts');
    mkdirSync(promptsDir, { recursive: true });
    const filePath = resolve(promptsDir, `${jiraId}.md`);
    writeFileSync(filePath, prompt, 'utf-8');

    // 5. Display preview (first 20 lines)
    const lines = prompt.split('\n');
    const preview = lines.slice(0, 20).join('\n');
    console.log('');
    console.log(chalk.bold.cyan('── Prompt Preview ──────────────────────────────────'));
    console.log(preview);
    if (lines.length > 20) {
      console.log(chalk.dim(`... (${lines.length - 20} more lines)`));
    }
    console.log('');

    // 6. Try to copy to clipboard
    try {
      const clipboardy = await import('clipboardy');
      await clipboardy.default.write(prompt);
      logger.info('Prompt copied to clipboard.');
    } catch {
      // Clipboard may not work in all environments — non-fatal
    }

    // 7. Log success with file path
    logger.success(`Prompt saved to ${filePath}`);

    // 8. If options.open: use open package to open the file
    if (options.open) {
      try {
        const open = await import('open');
        await open.default(filePath);
      } catch {
        // open may fail in headless environments — non-fatal
      }
    }
  } catch (err) {
    logger.error(err.message);
    if (err.message && (err.message.includes('401') || err.message.includes('Unauthorized'))) {
      logger.dim('Hint: Check that DEVFLOW_JIRA_TOKEN is set correctly.');
    }
  }
}
