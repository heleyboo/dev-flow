// Phase 4: Git automation commands
import {
  GitService,
  generateBranchName,
  detectCommitType,
  generateCommitMessage,
  extractJiraIdFromBranch,
  generatePRDescription,
} from '../services/git.service.js';
import { JiraService } from '../services/jira.service.js';
import { loadConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import chalk from 'chalk';

export async function startCommand(jiraId, options) {
  try {
    const config = loadConfig() || {};
    const jira = new JiraService(config);
    const task = await jira.getIssue(jiraId);

    const branchName = generateBranchName(task, config.git || {});

    const git = new GitService(config);
    const baseBranch = options.base || config.git?.base_branch || 'develop';
    await git.createBranch(branchName, baseBranch);

    if (!options.noTransition) {
      try {
        await jira.transitionIssue(jiraId, 'In Progress');
      } catch (err) {
        logger.warn(`Could not transition Jira issue to "In Progress": ${err.message}`);
      }
    }

    logger.success(`Branch created: ${chalk.cyan(branchName)}`);
    logger.info(`Based on: ${chalk.dim(baseBranch)}`);
    logger.info(`Jira task: ${chalk.bold(jiraId)} — ${task.summary}`);
  } catch (err) {
    logger.error(`Failed to start task: ${err.message}`);
    logger.dim('Hint: make sure you have no uncommitted changes before starting a new task.');
  }
}

export async function commitCommand(message, options) {
  try {
    const git = new GitService();
    const currentBranch = await git.getCurrentBranch();
    const jiraId = extractJiraIdFromBranch(currentBranch);

    const stagedFiles = await git.getStagedFiles();

    if (!stagedFiles || stagedFiles.length === 0) {
      if (!options.all) {
        logger.error('No staged changes. Use -a to stage all or git add first.');
        return;
      }
      // options.all is set — git.commit will handle -A
    }

    const type = options.type || detectCommitType(stagedFiles);

    let finalMessage;
    if (message) {
      if (jiraId) {
        finalMessage = `[${jiraId}] ${type}: ${message}`;
      } else {
        finalMessage = `${type}: ${message}`;
      }
    } else {
      finalMessage = generateCommitMessage(stagedFiles, jiraId, type);
    }

    await git.commit(finalMessage, { all: options.all, amend: options.amend });

    logger.success(`Committed: ${chalk.cyan(finalMessage.split('\n')[0])}`);
  } catch (err) {
    logger.error(`Failed to commit: ${err.message}`);
  }
}

export async function shipCommand(jiraId, options) {
  try {
    const git = new GitService();
    const currentBranch = await git.getCurrentBranch();

    const resolvedJiraId = extractJiraIdFromBranch(currentBranch) || jiraId || null;

    const config = loadConfig() || {};

    // Run pre-ship checks if not skipped
    if (!options.noTest && config.git?.pre_ship) {
      const checkResult = await git.runPreShipChecks(config.git.pre_ship);
      if (!checkResult.passed) {
        logger.error('Pre-ship checks failed:');
        for (const result of checkResult.results) {
          if (!result.passed) {
            logger.error(`  ${result.name}: ${result.output}`);
          }
        }
        return;
      }
    }

    // Push the branch
    await git.push(currentBranch);
    logger.step(`Pushed branch: ${chalk.cyan(currentBranch)}`);

    // Fetch Jira task if we have an ID
    let task = null;
    let jira = null;
    if (resolvedJiraId) {
      try {
        jira = new JiraService(config);
        task = await jira.getIssue(resolvedJiraId);
      } catch (err) {
        logger.warn(`Could not fetch Jira task ${resolvedJiraId}: ${err.message}`);
      }
    }

    // Build PR title
    const prTitle = task
      ? `[${resolvedJiraId}] ${task.summary}`
      : currentBranch;

    // Get commit log for PR body
    const baseBranch = options.target || config.git?.base_branch || 'develop';
    const commits = await git.getCommitLog(baseBranch);

    // Generate PR description
    const prBody = task
      ? generatePRDescription(task, commits)
      : commits.map((c) => `- ${c.message}`).join('\n') || '## Description\n';

    // Create PR
    const pr = await git.createPR({
      title: prTitle,
      body: prBody,
      baseBranch,
      draft: options.draft || false,
      reviewers: options.reviewer ? options.reviewer.split(',') : undefined,
    });

    logger.success(`Pull Request created: ${chalk.cyan(pr.htmlUrl)}`);

    // Transition Jira and add comment
    if (resolvedJiraId && jira && !options.noTransition) {
      try {
        await jira.transitionIssue(resolvedJiraId, 'In Review');
      } catch (err) {
        logger.warn(`Could not transition Jira issue to "In Review": ${err.message}`);
      }

      try {
        await jira.addComment(resolvedJiraId, `PR created: ${pr.htmlUrl}`);
      } catch (err) {
        logger.warn(`Could not add PR comment to Jira: ${err.message}`);
      }
    }
  } catch (err) {
    logger.error(`Failed to ship: ${err.message}`);
    logger.dim(`You can create a PR manually at your repository's pull request page.`);
  }
}
