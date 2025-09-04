// Re-export all models for easy importing
export { User, UserProfile } from './User';
export { Farm, FarmPlot } from './Farm';
export { CropCycle, CropData } from './Crop';
export { IoTDevice, SensorData } from './IoT';
export { CarbonProject, CarbonCredit } from './Carbon';
export { WeatherData, SatelliteData } from './Environmental';
export { MLModel, Prediction } from './MachineLearning';
export { Alert, Notification } from './Alerts';
export { Transaction, Payment } from './Financial';
export { Verification, MonitoringReport } from './Verification';

// Common types and interfaces
export interface BaseModel {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeometryPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeometryPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export type Geometry = GeometryPoint | GeometryPolygon;

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  timestamp: string;
}
