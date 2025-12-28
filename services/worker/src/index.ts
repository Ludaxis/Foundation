import { logger } from './lib/logger.js';

async function main() {
  logger.info('Starting Foundation Dev Worker Service...');

  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

  logger.info({ redisHost, redisPort }, 'Connecting to Redis...');

  // The worker setup will be populated by fd generate
  // For now, we just log that we're ready
  logger.info('Worker service ready');
  logger.info('Run `fd generate` to generate job handlers from spec');

  // Keep the process running
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down...');
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error(error, 'Failed to start worker');
  process.exit(1);
});
