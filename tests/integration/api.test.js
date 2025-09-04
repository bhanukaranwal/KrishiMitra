const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000/api/v1';

describe('KrishiMitra API Integration Tests', () => {
  let authToken;
  let testUserId;
  let testFarmId;

  beforeAll(async () => {
    // Setup test user and authentication
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'test@krishimitra.com',
      password: 'TestPassword123!'
    });
    
    authToken = loginResponse.data.token;
    testUserId = loginResponse.data.user.id;
  });

  describe('Authentication', () => {
    test('should login successfully with valid credentials', async () => {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: 'test@krishimitra.com',
        password: 'TestPassword123!'
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('token');
      expect(response.data).toHaveProperty('user');
    });

    test('should reject invalid credentials', async () => {
      try {
        await axios.post(`${API_BASE_URL}/auth/login`, {
          email: 'test@krishimitra.com',
          password: 'wrongpassword'
        });
      } catch (error) {
        expect(error.response.status).toBe(401);
      }
    });

    test('should validate JWT token', async () => {
      const response = await axios.get(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(testUserId);
    });
  });

  describe('Farm Management', () => {
    test('should create a new farm', async () => {
      const farmData = {
        name: 'Test Farm',
        address: 'Test Village, Test District',
        coordinates: { lat: 28.6139, lng: 77.2090 },
        area: 2.5,
        soilType: 'LOAM'
      };

      const response = await axios.post(`${API_BASE_URL}/farms`, farmData, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.name).toBe(farmData.name);
      
      testFarmId = response.data.id;
    });

    test('should get farm details', async () => {
      const response = await axios.get(`${API_BASE_URL}/farms/${testFarmId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(testFarmId);
    });

    test('should update farm information', async () => {
      const updateData = {
        name: 'Updated Test Farm',
        area: 3.0
      };

      const response = await axios.put(`${API_BASE_URL}/farms/${testFarmId}`, updateData, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      expect(response.data.name).toBe(updateData.name);
      expect(response.data.area).toBe(updateData.area);
    });
  });

  describe('IoT Data', () => {
    test('should receive sensor data', async () => {
      const sensorData = {
        deviceId: 'test-sensor-001',
        temperature: 25.5,
        humidity: 65.2,
        soilMoisture: 45.8,
        timestamp: new Date().toISOString()
      };

      const response = await axios.post(`${API_BASE_URL}/iot/data`, sensorData, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
    });

    test('should get device data history', async () => {
      const response = await axios.get(`${API_BASE_URL}/iot/devices/test-sensor-001/data`, {
        headers: { Authorization: `Bearer ${authToken}` },
        params: {
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        }
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
    });
  });

  describe('ML Predictions', () => {
    test('should predict crop yield', async () => {
      const predictionRequest = {
        farmId: testFarmId,
        cropType: 'rice',
        season: 'KHARIF',
        area: 2.5,
        features: {
          soilType: 'LOAM',
          irrigationType: 'DRIP',
          previousYield: 4.2,
          rainfall: 1200,
          temperature: 28.5
        }
      };

      const response = await axios.post(`${API_BASE_URL}/ml/predict/yield`, predictionRequest, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('prediction');
      expect(response.data).toHaveProperty('confidence');
      expect(typeof response.data.prediction).toBe('number');
    });

    test('should detect crop diseases from image', async () => {
      // Mock image upload
      const formData = new FormData();
      formData.append('image', 'mock-image-data');
      formData.append('cropType', 'rice');

      const response = await axios.post(`${API_BASE_URL}/ml/detect/disease`, formData, {
        headers: { 
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('diseases');
      expect(Array.isArray(response.data.diseases)).toBe(true);
    });
  });

  describe('Carbon Credits', () => {
    test('should estimate carbon potential', async () => {
      const estimationRequest = {
        farmId: testFarmId,
        projectType: 'AGROFORESTRY',
        methodology: 'VM0042',
        area: 2.5,
        currentLandUse: 'AGRICULTURE',
        proposedActivities: ['tree-planting', 'soil-management']
      };

      const response = await axios.post(`${API_BASE_URL}/carbon/estimate`, estimationRequest, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('estimatedCredits');
      expect(response.data).toHaveProperty('methodology');
      expect(typeof response.data.estimatedCredits).toBe('number');
    });

    test('should create carbon project', async () => {
      const projectData = {
        name: 'Test Agroforestry Project',
        farmId: testFarmId,
        methodology: 'VM0042',
        projectType: 'AGROFORESTRY',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
        estimatedCredits: 100.5
      };

      const response = await axios.post(`${API_BASE_URL}/carbon/projects`, projectData, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.name).toBe(projectData.name);
    });
  });

  describe('Satellite Analysis', () => {
    test('should analyze satellite imagery', async () => {
      const analysisRequest = {
        farmId: testFarmId,
        coordinates: {
          type: 'Polygon',
          coordinates: [[
            [77.2090, 28.6139],
            [77.2100, 28.6139],
            [77.2100, 28.6149],
            [77.2090, 28.6149],
            [77.2090, 28.6139]
          ]]
        },
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      };

      const response = await axios.post(`${API_BASE_URL}/satellite/analyze`, analysisRequest, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('ndvi');
      expect(response.data).toHaveProperty('acquisitionDate');
    });
  });

  describe('Analytics', () => {
    test('should get farm analytics', async () => {
      const response = await axios.get(`${API_BASE_URL}/analytics/farms/${testFarmId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
        params: {
          period: '30d',
          metrics: 'yield,weather,soil'
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('metrics');
    });

    test('should get dashboard data', async () => {
      const response = await axios.get(`${API_BASE_URL}/analytics/dashboard`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('farms');
      expect(response.data).toHaveProperty('alerts');
      expect(response.data).toHaveProperty('weather');
    });
  });

  afterAll(async () => {
    // Cleanup test data
    if (testFarmId) {
      await axios.delete(`${API_BASE_URL}/farms/${testFarmId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
    }
  });
});
