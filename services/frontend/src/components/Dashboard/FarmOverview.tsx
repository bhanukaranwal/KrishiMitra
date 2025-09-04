'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  MapPinIcon, 
  ChartBarIcon, 
  CurrencyDollarIcon,
  CloudIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { Card } from '@/components/UI/Card';
import { LoadingSpinner } from '@/components/UI/LoadingSpinner';
import { FarmMap } from './FarmMap';
import { WeatherWidget } from './WeatherWidget';
import { AlertsWidget } from './AlertsWidget';
import { CarbonCreditsWidget } from './CarbonCreditsWidget';
import { api } from '@/lib/api';

interface Farm {
  id: string;
  name: string;
  area: number;
  location: {
    lat: number;
    lng: number;
  };
  crops: string[];
  status: string;
  alerts: number;
  carbonCredits: number;
}

interface FarmOverviewProps {
  userId: string;
}

export const FarmOverview: React.FC<FarmOverviewProps> = ({ userId }) => {
  const { data: farms, isLoading, error } = useQuery({
    queryKey: ['farms', userId],
    queryFn: () => api.get(`/farms?userId=${userId}`),
  });

  const { data: dashboardStats } = useQuery({
    queryKey: ['dashboard-stats', userId],
    queryFn: () => api.get(`/analytics/dashboard?userId=${userId}`),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          Failed to load farm data
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Please try again later.
        </p>
      </div>
    );
  }

  const totalArea = farms?.reduce((sum: number, farm: Farm) => sum + farm.area, 0) || 0;
  const totalAlerts = farms?.reduce((sum: number, farm: Farm) => sum + farm.alerts, 0) || 0;
  const totalCredits = farms?.reduce((sum: number, farm: Farm) => sum + farm.carbonCredits, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <MapPinIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Total Farms
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {farms?.length || 0}
                </dd>
              </dl>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ChartBarIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Total Area
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {totalArea.toFixed(1)} ha
                </dd>
              </dl>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CurrencyDollarIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Carbon Credits
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {totalCredits.toLocaleString()}
                </dd>
              </dl>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Active Alerts
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {totalAlerts}
                </dd>
              </dl>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Farm Map */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Farm Locations
            </h3>
            <FarmMap farms={farms} />
          </Card>
        </div>

        {/* Weather & Alerts */}
        <div className="space-y-6">
          <WeatherWidget />
          <AlertsWidget alerts={totalAlerts} />
          <CarbonCreditsWidget credits={totalCredits} />
        </div>
      </div>

      {/* Farm List */}
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Your Farms
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {farms?.map((farm: Farm) => (
            <div
              key={farm.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => window.location.href = `/farms/${farm.id}`}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {farm.name}
                </h4>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  farm.status === 'active' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                }`}>
                  {farm.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Area: {farm.area} hectares
              </p>
              <div className="flex flex-wrap gap-1">
                {farm.crops.map((crop, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                  >
                    {crop}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
