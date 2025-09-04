import { Pool } from 'pg';
import { MongoClient } from 'mongodb';
import Redis from 'ioredis';
import { InfluxDB } from '@influxdata/influxdb-client';
import { config } from './index';

// PostgreSQL Connection
export const pgPool = new Pool({
  host: config.database.postgres.host,
  port: config.database.postgres.port,
  database: config.database.postgres.database,
  user: config.database.postgres.user,
  password: config.database.postgres.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// MongoDB Connection
export let mongoClient: MongoClient;
export let mongoDb: any;

export async function connectMongoDB(): Promise<void> {
  try {
    mongoClient = new MongoClient(config.database.mongodb.uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await mongoClient.connect();
    mongoDb = mongoClient.db(config.database.mongodb.database);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    throw error;
  }
}

// Redis Connection
export const redisClient = new Redis(config.database.redis.url, {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  lazyConnect: true,
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redisClient.on('error', (error) => {
  console.error('❌ Redis connection failed:', error);
});

// InfluxDB Connection
export const influxDB = new InfluxDB({
  url: config.database.influxdb.url,
  token: config.database.influxdb.token,
});

export const influxWriteApi = influxDB.getWriteApi(
  config.database.influxdb.org,
  config.database.influxdb.bucket
);

export const influxQueryApi = influxDB.getQueryApi(config.database.influxdb.org);

// Database Health Check
export async function checkDatabaseHealth(): Promise<{
  postgres: boolean;
  mongodb: boolean;
  redis: boolean;
  influxdb: boolean;
}> {
  const health = {
    postgres: false,
    mongodb: false,
    redis: false,
    influxdb: false,
  };

  try {
    await pgPool.query('SELECT 1');
    health.postgres = true;
  } catch (error) {
    console.error('PostgreSQL health check failed:', error);
  }

  try {
    await mongoClient.db('admin').command({ ismaster: 1 });
    health.mongodb = true;
  } catch (error) {
    console.error('MongoDB health check failed:', error);
  }

  try {
    await redisClient.ping();
    health.redis = true;
  } catch (error) {
    console.error('Redis health check failed:', error);
  }

  try {
    await influxQueryApi.queryRaw('buckets() |> limit(1)');
    health.influxdb = true;
  } catch (error) {
    console.error('InfluxDB health check failed:', error);
  }

  return health;
}
