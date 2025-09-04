import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import multipart from '@fastify/multipart';
import compress from '@fastify/compress';
import staticFiles from '@fastify/static';
import auth from '@fastify/auth';
import oauth2 from '@fastify/oauth2';

import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { validationMiddleware } from './middleware/validation';
import { loggingMiddleware } from './middleware/logging';
import { metricsMiddleware } from './middleware/metrics';
import { tracingMiddleware } from './middleware/tracing';

// Import route handlers
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { farmRoutes } from './routes/farms';
import { carbonRoutes } from './routes/carbon';
import { satelliteRoutes } from './routes/satellite';
import { iotRoutes } from './routes/iot';
import { analyticsRoutes } from './routes/analytics';
import { paymentRoutes } from './routes/payments';
import { marketplaceRoutes } from './routes/marketplace';
import { verificationRoutes } from './routes/verification';
import { blockchainRoutes } from './routes/blockchain';
import { mlRoutes } from './routes/ml';
import { governmentRoutes } from './routes/government';
import { adminRoutes } from './routes/admin';
import { webhookRoutes } from './routes/webhooks';
import { healthRoutes } from './routes/health';

// Import GraphQL setup
import { createGraphQLServer } from './graphql';
import { createTRPCHandler } from './trpc';

export function buildServer(): FastifyInstance {
  const server = fastify({
    logger: logger as any,
    trustProxy: true,
    maxParamLength: 500,
    bodyLimit: 10 * 1024 * 1024, // 10MB
    requestTimeout: 60000, // 60 seconds
    keepAliveTimeout: 65000, // 65 seconds
    connectionTimeout: 60000, // 60 seconds
  });

  // Register global plugins
  server.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "ws:"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  });

  server.register(cors, {
    origin: config.cors.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Accept',
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-API-Key',
      'X-Tenant-ID',
    ],
  });

  server.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,
    skipOnError: true,
    keyGenerator: (request) => {
      return request.headers['x-forwarded-for'] || request.ip;
    },
    errorResponseBuilder: (request, context) => {
      return {
        code: 'RATE_LIMIT_EXCEEDED',
        error: 'Rate limit exceeded',
        message: `Only ${context.max} requests per ${Math.round(context.timeWindow / 1000)} seconds allowed.`,
        retryAfter: context.ttl,
      };
    },
  });

  server.register(jwt, {
    secret: config.jwt.secret,
    sign: {
      algorithm: 'HS256',
      expiresIn: config.jwt.expiresIn,
    },
    verify: {
      algorithms: ['HS256'],
    },
  });

  server.register(cookie, {
    secret: config.cookies.secret,
    parseOptions: {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  });

  server.register(websocket);

  server.register(swagger, {
    swagger: {
      info: {
        title: 'KrishiMitra API',
        description: 'Comprehensive Carbon Intelligence Platform API',
        version: '1.0.0',
        contact: {
          name: 'KrishiMitra Support',
          email: 'support@krishimitra.com',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      host: `${config.server.host}:${config.server.port}`,
      schemes: ['http', 'https'],
      consumes: ['application/json', 'multipart/form-data'],
      produces: ['application/json'],
      securityDefinitions: {
        Bearer: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
          description: 'Enter JWT Bearer token',
        },
        ApiKey: {
          type: 'apiKey',
          name: 'X-API-Key',
          in: 'header',
          description: 'Enter API Key',
        },
      },
      security: [{ Bearer: [] }, { ApiKey: [] }],
    },
    routePrefix: '/docs',
    exposeRoute: true,
  });

  server.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  server.register(multipart, {
    limits: {
      fieldNameSize: 100,
      fieldSize: 100,
      fields: 10,
      fileSize: 50 * 1024 * 1024, // 50MB
      files: 5,
      headerPairs: 2000,
    },
  });

  server.register(compress, {
    global: true,
    encodings: ['gzip', 'deflate'],
  });

  server.register(staticFiles, {
    root: config.server.staticPath,
    prefix: '/static/',
  });

  server.register(auth);

  // OAuth2 providers
  server.register(oauth2, {
    name: 'googleOAuth2',
    scope: ['profile', 'email'],
    credentials: {
      client: {
        id: config.oauth.google.clientId,
        secret: config.oauth.google.clientSecret,
      },
      auth: oauth2.GOOGLE_CONFIGURATION,
    },
    startRedirectPath: '/auth/google',
    callbackUri: `${config.server.baseUrl}/auth/google/callback`,
  });

  // Register global hooks
  server.addHook('preHandler', tracingMiddleware);
  server.addHook('preHandler', loggingMiddleware);
  server.addHook('preHandler', metricsMiddleware);
  server.addHook('preValidation', validationMiddleware);

  // Error handler
  server.setErrorHandler(errorHandler);

  // Health check routes (no auth required)
  server.register(healthRoutes, { prefix: '/api/v1/health' });

  // Authentication routes (no auth required)
  server.register(authRoutes, { prefix: '/api/v1/auth' });

  // Webhook routes (special auth)
  server.register(webhookRoutes, { prefix: '/api/v1/webhooks' });

  // Protected API routes
  server.register(async function protectedRoutes(fastify) {
    fastify.register(authMiddleware);

    // Core business routes
    fastify.register(userRoutes, { prefix: '/api/v1/users' });
    fastify.register(farmRoutes, { prefix: '/api/v1/farms' });
    fastify.register(carbonRoutes, { prefix: '/api/v1/carbon' });
    fastify.register(satelliteRoutes, { prefix: '/api/v1/satellite' });
    fastify.register(iotRoutes, { prefix: '/api/v1/iot' });
    fastify.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
    fastify.register(paymentRoutes, { prefix: '/api/v1/payments' });
    fastify.register(marketplaceRoutes, { prefix: '/api/v1/marketplace' });
    fastify.register(verificationRoutes, { prefix: '/api/v1/verification' });
    fastify.register(blockchainRoutes, { prefix: '/api/v1/blockchain' });
    fastify.register(mlRoutes, { prefix: '/api/v1/ml' });
    fastify.register(governmentRoutes, { prefix: '/api/v1/government' });
    fastify.register(adminRoutes, { prefix: '/api/v1/admin' });
  });

  // GraphQL endpoint
  server.register(createGraphQLServer, { prefix: '/graphql' });

  // tRPC endpoint
  server.register(createTRPCHandler, { prefix: '/trpc' });

  // WebSocket handlers
  server.register(async function websocketRoutes(fastify) {
    fastify.get('/ws/realtime', { websocket: true }, (connection, request) => {
      connection.socket.on('message', (message) => {
        // Handle real-time messages
        connection.socket.send(`Echo: ${message}`);
      });

      connection.socket.on('close', () => {
        // Handle connection close
      });
    });
  });

  // 404 handler
  server.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `Route ${request.method}:${request.url} not found`,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  });

  return server;
}
