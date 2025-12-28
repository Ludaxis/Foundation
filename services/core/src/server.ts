import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { createDb } from './lib/db.js';
import { logger } from './lib/logger.js';
import { createRouter } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(pinoHttp({ logger }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
async function bootstrap() {
  try {
    // Initialize database
    const db = await createDb();
    logger.info('Database connected');

    // Create and mount API router
    const apiRouter = createRouter(db);
    app.use('/api', apiRouter);

    // Error handler
    app.use(errorHandler);

    // Start server
    app.listen(port, () => {
      logger.info({ port }, `Server running on http://localhost:${port}`);
    });
  } catch (error) {
    logger.error(error, 'Failed to start server');
    process.exit(1);
  }
}

bootstrap();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down...');
  process.exit(0);
});
