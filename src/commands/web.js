import { createServer } from '../web/server.js';
import { logger } from '../utils/logger.js';
import chalk from 'chalk';

export async function webCommand(options) {
  const port = parseInt(options.port) || 3456;
  const host = options.host || 'localhost';

  const app = createServer();

  app.listen(port, host, () => {
    logger.success(`DevFlow Dashboard running at ${chalk.cyan(`http://${host}:${port}`)}`);
    logger.dim('Press Ctrl+C to stop');
  });

  if (options.open) {
    try {
      const open = await import('open');
      await open.default(`http://${host}:${port}`);
    } catch { /* ignore */ }
  }
}
