import express from 'express';
import cors from 'cors';
import { createApiRouter } from './routes/api.js';

export function createServer(options = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // API routes
  app.use('/api', createApiRouter());

  // Landing page
  app.get('/', (req, res) => {
    res.send(getLandingHTML());
  });

  return app;
}

function getLandingHTML() {
  return `<!DOCTYPE html>
<html>
<head><title>DevFlow Dashboard</title>
<style>
  body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 0 20px; }
  h1 { color: #2563EB; }
  .endpoint { margin: 8px 0; }
  code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
</style>
</head>
<body>
  <h1>DevFlow Dashboard API</h1>
  <p>API server is running. Available endpoints:</p>
  <div class="endpoint"><code>GET /api/tasks</code> — List tasks</div>
  <div class="endpoint"><code>GET /api/tasks/:id</code> — Get task details</div>
  <div class="endpoint"><code>GET /api/deploy/status</code> — Deploy status</div>
  <div class="endpoint"><code>GET /api/deploy/history/:env</code> — Deploy history</div>
  <div class="endpoint"><code>POST /api/deploy/:env</code> — Trigger deploy</div>
  <div class="endpoint"><code>GET /api/config</code> — Project config</div>
  <div class="endpoint"><code>GET /api/health</code> — Health check</div>
</body>
</html>`;
}
