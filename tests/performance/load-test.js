import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const httpReqFailed = new Rate('http_req_failed');
const httpReqDuration = new Trend('http_req_duration');
const apiCalls = new Counter('api_calls');

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(99)<1500'], // 99% of requests must complete below 1.5s
    http_req_failed: ['rate<0.01'],    // Error rate must be below 1%
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'https://api.krishimitra.com';

export function setup() {
  // Setup test data
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, {
    email: 'loadtest@krishimitra.com',
    password: 'LoadTest123!'
  });
  
  return {
    authToken: loginRes.json('token'),
    userId: loginRes.json('user.id')
  };
}

export default function(data) {
  const headers = {
    'Authorization': `Bearer ${data.authToken}`,
    'Content-Type': 'application/json',
  };

  group('API Load Test', () => {
    // Test farm listing
    group('Farm Management', () => {
      const farmsRes = http.get(`${BASE_URL}/api/v1/farms`, { headers });
      check(farmsRes, {
        'farms list status is 200': (r) => r.status === 200,
        'farms response time < 500ms': (r) => r.timings.duration < 500,
      });
      apiCalls.add(1);
    });

    // Test IoT data retrieval
    group('IoT Data', () => {
      const iotRes = http.get(`${BASE_URL}/api/v1/iot/devices`, { headers });
      check(iotRes, {
        'iot devices status is 200': (r) => r.status === 200,
        'iot response time < 1000ms': (r) => r.timings.duration < 1000,
      });
      apiCalls.add(1);
    });

    // Test ML predictions
    group('ML Predictions', () => {
      const predictionPayload = {
        farmId: 'test-farm-id',
        cropType: 'rice',
        features: {
          temperature: 28.5,
          humidity: 65,
          soilMoisture: 45
        }
      };
      
      const predRes = http.post(`${BASE_URL}/api/v1/ml/predict/yield`, 
        JSON.stringify(predictionPayload), { headers });
      
      check(predRes, {
        'prediction status is 200': (r) => r.status === 200,
        'prediction response time < 2000ms': (r) => r.timings.duration < 2000,
      });
      apiCalls.add(1);
    });

    // Test analytics
    group('Analytics', () => {
      const analyticsRes = http.get(`${BASE_URL}/api/v1/analytics/dashboard`, { headers });
      check(analyticsRes, {
        'analytics status is 200': (r) => r.status === 200,
        'analytics response time < 1500ms': (r) => r.timings.duration < 1500,
      });
      apiCalls.add(1);
    });
  });

  sleep(1);
}

export function teardown(data) {
  // Cleanup if needed
  console.log('Load test completed');
}
