import { FastifyInstance } from 'fastify';
import { buildServer } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { initializeDatabase } from './database';
import { initializeRedis } from './cache';
import { initializeMessageQueues } from './messaging';
import { initializeMonitoring } from './monitoring';
import { gracefulShutdown } from './utils/gracefulShutdown';

async function start(): Promise<void> {
  let server: FastifyInstance | null = null;

  try {
    // Initialize monitoring first
    await initializeMonitoring();
    logger.info('Monitoring initialized');

    // Initialize database connections
    await initializeDatabase();
    logger.info('Database connections initialized');

    // Initialize Redis cache
    await initializeRedis();
    logger.info('Redis cache initialized');

    // Initialize message queues
    await initializeMessageQueues();
    logger.info('Message queues initialized');

    // Build and start server
    server = buildServer();
    
    await server.listen({
      port: config.server.port,
      host: config.server.host,
    });

    logger.info(`🚀 KrishiMitra Backend Server running on http://${config.server.host}:${config.server.port}`);
    logger.info(`📚 API Documentation available at http://${config.server.host}:${config.server.port}/docs`);
    logger.info(`🔍 GraphQL Playground available at http://${config.server.host}:${config.server.port}/graphql`);
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }

  // Setup graceful shutdown
  gracefulShutdown(server, [
    'SIGTERM',
    'SIGINT',
    'SIGUSR2',
  ]);
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
start();
