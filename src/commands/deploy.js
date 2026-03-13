// Phase 5: Deploy commands
import { DeployService } from '../services/deploy.service.js';
import { logger } from '../utils/logger.js';
import chalk from 'chalk';

export async function deployCommand(environment, options = {}) {
  try {
    const deploy = new DeployService();

    // Run pre-deploy checks
    const checks = await deploy.preDeployChecks(environment);

    // Display check results
    for (const check of checks) {
      const icon = check.passed ? chalk.green('✔') : chalk.red('✘');
      const label = check.name.replace(/_/g, ' ');
      console.log(`${icon} ${label}${check.message ? ': ' + check.message : ''}`);
    }

    // If any check failed and not forced, abort
    const anyFailed = checks.some((c) => !c.passed);
    if (anyFailed && !options.force) {
      logger.error('Pre-deploy checks failed. Use --force to override.');
      return;
    }

    // Dry run — no actual deploy
    if (options.dryRun) {
      logger.info('Dry run — no changes made');
      return;
    }

    // Execute deploy
    const result = await deploy.deploy(environment, {
      dryRun: options.dryRun,
      force: options.force,
    });

    if (result.success) {
      logger.success(`Deployed to ${chalk.bold(environment)} in ${result.duration}s`);
    } else {
      logger.error(`Deploy to ${chalk.bold(environment)} failed`);
    }
  } catch (err) {
    logger.error(`Deploy failed: ${err.message}`);
  }
}

export async function deployStatusCommand() {
  try {
    const deploy = new DeployService();
    const statuses = await deploy.getEnvironmentStatus();

    const header = [
      chalk.bold('Environment'),
      chalk.bold('Branch'),
      chalk.bold('Last Deploy'),
      chalk.bold('Status'),
    ].join('  |  ');

    console.log(header);
    console.log('-'.repeat(70));

    for (const env of statuses) {
      const statusColor =
        env.status === 'success'
          ? chalk.green(env.status)
          : env.status === 'failed'
          ? chalk.red(env.status)
          : chalk.yellow(env.status);

      const lastDeploy = env.lastDeploy
        ? new Date(env.lastDeploy).toLocaleString()
        : 'never';

      const row = [
        chalk.cyan(env.environment),
        env.branch || '-',
        lastDeploy,
        statusColor,
      ].join('  |  ');

      console.log(row);
    }
  } catch (err) {
    logger.error(`Failed to get deploy status: ${err.message}`);
  }
}

export async function deployRollbackCommand(environment) {
  try {
    const deploy = new DeployService();
    const history = deploy.getDeployHistory(environment);

    if (!history || history.length === 0) {
      logger.error(`No deploy history found for environment: ${environment}`);
      return;
    }

    // Find successful deploys
    const successfulDeploys = history.filter((h) => h.status === 'success');

    if (successfulDeploys.length < 1) {
      logger.error(`No successful deploys found for environment: ${environment}`);
      return;
    }

    // Rollback target is the second-to-last successful deploy
    const targetDeploy = successfulDeploys[1] || successfulDeploys[0];
    const targetCommit = targetDeploy.commitHash || null;

    const result = await deploy.rollback(environment, targetCommit);

    if (result.success) {
      logger.success(
        `Rolled back ${chalk.bold(environment)} to commit ${chalk.dim(targetCommit || 'previous')}`
      );
    } else {
      logger.error(`Rollback failed for ${chalk.bold(environment)}`);
    }
  } catch (err) {
    logger.error(`Rollback failed: ${err.message}`);
  }
}

export async function deployLogCommand(environment) {
  try {
    const deploy = new DeployService();
    const history = deploy.getDeployHistory(environment);

    if (!history || history.length === 0) {
      console.log('No deploy history');
      return;
    }

    for (const entry of history) {
      const statusIcon = entry.status === 'success'
        ? chalk.green('✔')
        : entry.status === 'rolled_back'
        ? chalk.yellow('↩')
        : chalk.red('✘');

      const shortHash = entry.commitHash ? entry.commitHash.slice(0, 7) : 'unknown';
      const timestamp = entry.timestamp
        ? new Date(entry.timestamp).toLocaleString()
        : 'unknown';

      console.log(
        `${statusIcon} [${entry.id}] ${timestamp} — ${shortHash} — ${entry.jiraId || '-'} — ${entry.deployedBy || '-'}`
      );
    }
  } catch (err) {
    logger.error(`Failed to get deploy log: ${err.message}`);
  }
}
