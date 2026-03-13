// Phase 1: Jira task commands
// Spec: docs/02-JIRA-INTEGRATION.md

import chalk from 'chalk';
import { JiraService } from '../services/jira.service.js';
import { logger } from '../utils/logger.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status) {
  const lower = (status ?? '').toLowerCase();
  if (lower === 'done' || lower === 'closed') return chalk.green(status);
  if (lower.includes('progress')) return chalk.yellow(status);
  if (lower.includes('review')) return chalk.magenta(status);
  return chalk.blue(status);
}

// ── taskGetCommand ────────────────────────────────────────────────────────────

export async function taskGetCommand(jiraId, options = {}) {
  try {
    const jira = new JiraService();
    const task = await jira.getIssue(jiraId);

    // ── JSON output ──────────────────────────────────────────────────────────
    if (options.json) {
      // eslint-disable-next-line no-unused-vars
      const { _raw, ...taskWithoutRaw } = task;
      console.log(JSON.stringify(taskWithoutRaw, null, 2));
      return;
    }

    // ── Formatted output ─────────────────────────────────────────────────────

    // Header
    console.log('');
    console.log(chalk.bold.cyan(task.key) + '  ' + chalk.bold(task.summary));
    console.log(chalk.dim('─'.repeat(60)));

    // Core fields
    console.log(chalk.dim('Type:      ') + chalk.white(task.type));
    console.log(chalk.dim('Priority:  ') + chalk.white(task.priority));
    console.log(chalk.dim('Status:    ') + statusColor(task.status));
    if (task.assignee) {
      console.log(chalk.dim('Assignee:  ') + chalk.white(task.assignee));
    }
    if (task.sprint) {
      console.log(chalk.dim('Sprint:    ') + chalk.white(task.sprint));
    }
    if (task.storyPoints != null) {
      console.log(chalk.dim('Points:    ') + chalk.white(String(task.storyPoints)));
    }

    // Parent / Epic
    if (task.parent) {
      console.log('');
      console.log(chalk.dim('Parent:    ') + chalk.cyan(task.parent.key) + '  ' + task.parent.summary);
    }
    if (task.epic) {
      console.log(chalk.dim('Epic:      ') + chalk.cyan(task.epic.key) + (task.epic.summary ? '  ' + task.epic.summary : ''));
    }

    // Figma links
    if (task.figmaLinks && task.figmaLinks.length > 0) {
      console.log('');
      console.log(chalk.bold('Figma Links:'));
      for (const link of task.figmaLinks) {
        console.log('  ' + chalk.blue(link));
      }
    }

    // SRS references
    if (task.srsReferences && task.srsReferences.length > 0) {
      console.log('');
      console.log(chalk.bold('SRS References:'));
      for (const ref of task.srsReferences) {
        console.log('  ' + ref);
      }
    }

    // Subtasks
    if (task.subtasks && task.subtasks.length > 0) {
      console.log('');
      console.log(chalk.bold('Subtasks:'));
      for (const st of task.subtasks) {
        const isDone = (st.status ?? '').toLowerCase() === 'done';
        const icon = isDone ? '☑' : '☐';
        const keyStr = chalk.cyan(st.key);
        const statusStr = chalk.dim(`[${st.status}]`);
        console.log(`  ${icon} ${keyStr}  ${st.summary}  ${statusStr}`);
      }
    }

    // Acceptance criteria
    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      console.log('');
      console.log(chalk.bold('Acceptance Criteria:'));
      task.acceptanceCriteria.forEach((criterion, i) => {
        console.log(`  ${i + 1}. ${criterion}`);
      });
    }

    // Linked issues
    if (task.linkedIssues && task.linkedIssues.length > 0) {
      console.log('');
      console.log(chalk.bold('Linked Issues:'));
      for (const link of task.linkedIssues) {
        const keyStr = chalk.cyan(link.key);
        const statusStr = chalk.dim(`[${link.status}]`);
        console.log(`  ${link.type}  ${keyStr}  ${link.summary}  ${statusStr}`);
      }
    }

    // Comments
    if (options.withComments && task.comments && task.comments.length > 0) {
      console.log('');
      console.log(chalk.bold('Comments:'));
      for (const comment of task.comments) {
        console.log('');
        console.log(chalk.dim(`  ${comment.author}  ${comment.created}`));
        console.log('  ' + comment.body.trim().replace(/\n/g, '\n  '));
      }
    }

    console.log('');
  } catch (err) {
    logger.error(err.message);
    if (err.message && err.message.includes('401')) {
      logger.dim('Hint: Check that DEVFLOW_JIRA_TOKEN is set correctly.');
    } else if (err.message && err.message.includes('404')) {
      logger.dim('Hint: Check that the issue key is correct.');
    }
  }
}

// ── taskListCommand ───────────────────────────────────────────────────────────

export async function taskListCommand(options = {}) {
  try {
    const jira = new JiraService();
    const tasks = await jira.listMyTasks({
      status: options.status,
      sprint: options.sprint,
      priority: options.priority,
    });

    if (!tasks || tasks.length === 0) {
      logger.info('No tasks found.');
      return;
    }

    console.log('');
    for (const task of tasks) {
      const keyStr = chalk.cyan(task.key.padEnd(12));
      const statusStr = statusColor((task.status ?? '').padEnd(16));
      console.log(`  ${keyStr}  ${statusStr}  ${task.summary}`);
    }
    console.log('');
  } catch (err) {
    logger.error(err.message);
  }
}
