import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  env: z.enum(['development', 'staging', 'production']).default('development'),
  server: z.object({
    host: z.string().default('0.0.0.0'),
    port: z.number().default(8000),
    baseUrl: z.string().default('http://localhost:8000'),
    staticPath: z.string().default('./public'),
  }),
  database: z.object({
    postgres: z.object({
      host: z.string().default('localhost'),
      port: z.number().default(5432),
      database: z.string().default('krishimitra'),
      user: z.string().default('krishimitra'),
      password: z.string(),
    }),
    mongodb: z.object({
      uri: z.string(),
      database: z.string().default('krishimitra'),
    }),
    redis: z.object({
      url: z.string().default('redis://localhost:6379/0'),
      password: z.string().optional(),
    }),
    influxdb: z.object({
      url: z.string().default('http://localhost:8086'),
      token: z.string(),
      org: z.string().default('krishimitra'),
      bucket: z.string().default('iot-data'),
    }),
  }),
  jwt: z.object({
    secret: z.string().min(32),
    refreshSecret: z.string().min(32),
    expiresIn: z.string().default('24h'),
    refreshExpiresIn: z.string().default('30d'),
  }),
  security: z.object({
    bcryptRounds: z.number().default(12),
    rateLimitMax: z.number().default(100),
    rateLimitWindow: z.number().default(900000), // 15 minutes
  }),
  external: z.object({
    mapbox: z.object({
      accessToken: z.string(),
    }),
    googleEarthEngine: z.object({
      serviceAccount: z.string(),
      privateKey: z.string(),
    }),
    openWeather: z.object({
      apiKey: z.string(),
    }),
  }),
  messaging: z.object({
    kafka: z.object({
      brokers: z.array(z.string()),
      clientId: z.string().default('krishimitra-platform'),
    }),
    nats: z.object({
      url: z.string().default('nats://localhost:4222'),
    }),
  }),
  storage: z.object({
    aws: z.object({
      accessKeyId: z.string(),
      secretAccessKey: z.string(),
      region: z.string().default('us-east-1'),
      bucket: z.string(),
    }),
  }),
});

const rawConfig = {
  env: process.env.NODE_ENV,
  server: {
    host: process.env.HOST,
    port: parseInt(process.env.PORT || '8000'),
    baseUrl: process.env.BASE_URL,
    staticPath: process.env.STATIC_PATH,
  },
  database: {
    postgres: {
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
    },
    mongodb: {
      uri: process.env.MONGODB_URI,
      database: process.env.MONGODB_DATABASE,
    },
    redis: {
      url: process.env.REDIS_URL,
      password: process.env.REDIS_PASSWORD,
    },
    influxdb: {
      url: process.env.INFLUXDB_URL,
      token: process.env.INFLUXDB_TOKEN,
      org: process.env.INFLUXDB_ORG,
      bucket: process.env.INFLUXDB_BUCKET,
    },
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  },
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'),
  },
  external: {
    mapbox: {
      accessToken: process.env.MAPBOX_ACCESS_TOKEN,
    },
    googleEarthEngine: {
      serviceAccount: process.env.GEE_SERVICE_ACCOUNT,
      privateKey: process.env.GEE_PRIVATE_KEY,
    },
    openWeather: {
      apiKey: process.env.OPENWEATHER_API_KEY,
    },
  },
  messaging: {
    kafka: {
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      clientId: process.env.KAFKA_CLIENT_ID,
    },
    nats: {
      url: process.env.NATS_URL,
    },
  },
  storage: {
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
      bucket: process.env.AWS_S3_BUCKET,
    },
  },
};

export const config = configSchema.parse(rawConfig);
export type Config = z.infer<typeof configSchema>;
