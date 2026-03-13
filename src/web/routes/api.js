import { Router } from 'express';
import { loadConfig } from '../../utils/config.js';
import { JiraService } from '../../services/jira.service.js';
import { DeployService } from '../../services/deploy.service.js';
import { PromptService } from '../../services/prompt.service.js';

export function createApiRouter() {
  const router = Router();

  // GET /api/health
  router.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
  });

  // GET /api/config
  router.get('/config', (req, res) => {
    try {
      const config = loadConfig();
      res.json(config);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/tasks
  router.get('/tasks', async (req, res) => {
    try {
      const jira = new JiraService();
      const { status, sprint } = req.query;
      const tasks = await jira.listMyTasks({ status, sprint });
      res.json({ tasks });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/tasks/:id
  router.get('/tasks/:id', async (req, res) => {
    try {
      const jira = new JiraService();
      const task = await jira.getIssue(req.params.id);
      const { _raw, ...taskWithoutRaw } = task;
      res.json(taskWithoutRaw);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/tasks/:id/prompt
  router.post('/tasks/:id/prompt', async (req, res) => {
    try {
      const jira = new JiraService();
      const task = await jira.getIssue(req.params.id);
      const config = loadConfig();
      const promptService = new PromptService(config);
      const prompt = await promptService.generatePrompt(task);
      const { join } = await import('path');
      const file = join(process.cwd(), '.devflow', 'prompts', `${task.key}.md`);
      res.json({ prompt, file });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/deploy/status
  router.get('/deploy/status', async (req, res) => {
    try {
      const deploy = new DeployService();
      const environments = await deploy.getEnvironmentStatus();
      res.json({ environments });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/deploy/history/:env
  router.get('/deploy/history/:env', async (req, res) => {
    try {
      const deploy = new DeployService();
      const history = deploy.getDeployHistory(req.params.env);
      res.json({ history });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/deploy/:env
  router.post('/deploy/:env', async (req, res) => {
    try {
      const deploy = new DeployService();
      const result = await deploy.deploy(req.params.env, req.body);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
