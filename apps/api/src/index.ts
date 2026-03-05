import 'dotenv/config';
import express, { type Express } from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import workflowsRouter from './routes/workflows.js';
import executionsRouter from './routes/executions.js';
import credentialsRouter from './routes/credentials.js';
import { registerAll } from './services/registry.js';

// Register node handlers and LLM adapters
registerAll();

const app: Express = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/auth', authRouter);
app.use('/workflows', workflowsRouter);
app.use('/executions', executionsRouter);
app.use('/credentials', credentialsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
);

const PORT = parseInt(process.env.PORT ?? '3001', 10);
app.listen(PORT, () => {
  console.log(`[api] Listening on http://localhost:${PORT}`);
});

export default app;
