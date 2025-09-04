"""
Satellite Data Processing Pipeline
Advanced processing for satellite imagery and vegetation indices
"""

import numpy as np
import pandas as pd
import rasterio
from rasterio.mask import mask
from rasterio.warp import calculate_default_transform, reproject, Resampling
from rasterio.enums import Resampling as ResamplingEnum
import geopandas as gpd
from shapely.geometry import shape
import cv2
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
import tensorflow as tf
from typing import Dict, List, Tuple, Optional, Any
import logging
from datetime import datetime, timedelta
from pathlib import Path
import asyncio
import aiofiles
import boto3
from google.cloud import storage as gcs
import ee

logger = logging.getLogger(__name__)

class SatelliteDataProcessor:
    """Advanced satellite data processing with multiple data sources and analysis techniques."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.gee_initialized = False
        self.aws_client = None
        self.gcs_client = None
        
        # Initialize cloud clients
        self._initialize_cloud_clients()
        
        # Initialize Google Earth Engine
        if config.get('google_earth_engine', {}).get('enabled', False):
            self._initialize_gee()
    
    def _initialize_cloud_clients(self):
        """Initialize cloud storage clients."""
        try:
            # AWS S3 client
            if self.config.get('aws', {}).get('enabled', False):
                self.aws_client = boto3.client(
                    's3',
                    aws_access_key_id=self.config['aws']['access_key'],
                    aws_secret_access_key=self.config['aws']['secret_key'],
                    region_name=self.config['aws']['region']
                )
            
            # Google Cloud Storage client
            if self.config.get('gcs', {}).get('enabled', False):
                self.gcs_client = gcs.Client.from_service_account_json(
                    self.config['gcs']['credentials_path']
                )
                
            logger.info("Cloud clients initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize cloud clients: {e}")
    
    def _initialize_gee(self):
        """Initialize Google Earth Engine."""
        try:
            ee.Initialize(
                credentials=ee.ServiceAccountCredentials(
                    self.config['google_earth_engine']['service_account'],
                    self.config['google_earth_engine']['private_key']
                )
            )
            self.gee_initialized = True
            logger.info("Google Earth Engine initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Google Earth Engine: {e}")
    
    async def process_satellite_image(self, image_path: str, farm_boundary: Dict[str, Any]) -> Dict[str, Any]:
        """Process satellite image for vegetation analysis."""
        try:
            # Load image
            with rasterio.open(image_path) as src:
                # Clip to farm boundary
                boundary_geom = shape(farm_boundary)
                out_image, out_transform = mask(src, [boundary_geom], crop=True)
                out_meta = src.meta.copy()
                
                # Update metadata
                out_meta.update({
                    'driver': 'GTiff',
                    'height': out_image.shape[1],
                    'width': out_image.shape[2],
                    'transform': out_transform
                })
            
            # Calculate vegetation indices
            indices = self._calculate_vegetation_indices(out_image)
            
            # Perform change detection if historical data available
            change_analysis = await self._perform_change_detection(image_path, farm_boundary)
            
            # Crop health analysis
            health_analysis = self._analyze_crop_health(out_image, indices)
            
            # Generate zones for precision agriculture
            management_zones = self._generate_management_zones(out_image, indices)
            
            return {
                'vegetation_indices': indices,
                'change_analysis': change_analysis,
                'health_analysis': health_analysis,
                'management_zones': management_zones,
                'processing_timestamp': datetime.utcnow().isoformat(),
                'image_metadata': out_meta
            }
            
        except Exception as e:
            logger.error(f"Error processing satellite image: {e}")
            raise
    
    def _calculate_vegetation_indices(self, image: np.ndarray) -> Dict[str, np.ndarray]:
        """Calculate various vegetation indices."""
        # Assuming image has bands: [B, G, R, NIR, SWIR1, SWIR2]
        if image.shape[0] < 4:
            raise ValueError("Image must have at least 4 bands (B, G, R, NIR)")
        
        blue = image[0].astype(np.float32)
        green = image[1].astype(np.float32)
        red = image[2].astype(np.float32)
        nir = image[3].astype(np.float32)
        
        # Handle additional bands if available
        swir1 = image[4].astype(np.float32) if image.shape[0] > 4 else None
        swir2 = image[5].astype(np.float32) if image.shape[0] > 5 else None
        
        indices = {}
        
        # NDVI (Normalized Difference Vegetation Index)
        indices['ndvi'] = np.where(
            (nir + red) != 0,
            (nir - red) / (nir + red),
            0
        )
        
        # EVI (Enhanced Vegetation Index)
        indices['evi'] = np.where(
            (nir + 6 * red - 7.5 * blue + 1) != 0,
            2.5 * ((nir - red) / (nir + 6 * red - 7.5 * blue + 1)),
            0
        )
        
        # SAVI (Soil-Adjusted Vegetation Index)
        L = 0.5  # Soil brightness correction factor
        indices['savi'] = np.where(
            (nir + red + L) != 0,
            ((nir - red) / (nir + red + L)) * (1 + L),
            0
        )
        
        # GNDVI (Green Normalized Difference Vegetation Index)
        indices['gndvi'] = np.where(
            (nir + green) != 0,
            (nir - green) / (nir + green),
            0
        )
        
        # NDWI (Normalized Difference Water Index)
        indices['ndwi'] = np.where(
            (green + nir) != 0,
            (green - nir) / (green + nir),
            0
        )
        
        # OSAVI (Optimized Soil-Adjusted Vegetation Index)
        indices['osavi'] = np.where(
            (nir + red + 0.16) != 0,
            (nir - red) / (nir + red + 0.16),
            0
        )
        
        # MCARI (Modified Chlorophyll Absorption Ratio Index)
        indices['mcari'] = np.where(
            red != 0,
            ((red - green) - 0.2 * (red - green)) * (red / green),
            0
        )
        
        if swir1 is not None:
            # NDMI (Normalized Difference Moisture Index)
            indices['ndmi'] = np.where(
                (nir + swir1) != 0,
                (nir - swir1) / (nir + swir1),
                0
            )
            
            # NBR (Normalized Burn Ratio)
            indices['nbr'] = np.where(
                (nir + swir1) != 0,
                (nir - swir1) / (nir + swir1),
                0
            )
        
        if swir2 is not None:
            # SWIR ratio
            indices['swir_ratio'] = np.where(
                swir2 != 0,
                swir1 / swir2,
                0
            )
        
        # Clip values to reasonable ranges
        for key, index in indices.items():
            indices[key] = np.clip(index, -1, 1)
        
        return indices
    
    async def _perform_change_detection(self, current_image_path: str, farm_boundary: Dict[str, Any]) -> Dict[str, Any]:
        """Perform change detection analysis."""
        try:
            # Find historical images for the same location
            historical_images = await self._find_historical_images(current_image_path, farm_boundary)
            
            if not historical_images:
                return {'status': 'no_historical_data'}
            
            changes = []
            
            for hist_image_path in historical_images[-3:]:  # Compare with last 3 images
                change_result = await self._compare_images(current_image_path, hist_image_path, farm_boundary)
                if change_result:
                    changes.append(change_result)
            
            # Analyze trend
            trend_analysis = self._analyze_vegetation_trend(changes)
            
            return {
                'changes': changes,
                'trend_analysis': trend_analysis,
                'status': 'completed'
            }
            
        except Exception as e:
            logger.error(f"Error in change detection: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def _compare_images(self, current_path: str, historical_path: str, boundary: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Compare two satellite images for change detection."""
        try:
            # Process both images
            current_result = await self.process_satellite_image(current_path, boundary)
            historical_result = await self.process_satellite_image(historical_path, boundary)
            
            # Calculate differences in vegetation indices
            current_indices = current_result['vegetation_indices']
            historical_indices = historical_result['vegetation_indices']
            
            differences = {}
            for key in current_indices.keys():
                if key in historical_indices:
                    diff = current_indices[key] - historical_indices[key]
                    differences[f'{key}_change'] = {
                        'mean_change': float(np.mean(diff)),
                        'std_change': float(np.std(diff)),
                        'max_change': float(np.max(diff)),
                        'min_change': float(np.min(diff))
                    }
            
            return {
                'comparison_date': datetime.utcnow().isoformat(),
                'historical_image': historical_path,
                'differences': differences
            }
            
        except Exception as e:
            logger.error(f"Error comparing images: {e}")
            return None
    
    def _analyze_crop_health(self, image: np.ndarray, indices: Dict[str, np.ndarray]) -> Dict[str, Any]:
        """Analyze crop health based on vegetation indices and spectral analysis."""
        # Extract NDVI for health analysis
        ndvi = indices['ndvi']
        evi = indices['evi']
        savi = indices['savi']
        
        # Calculate health metrics
        health_metrics = {
            'overall_health_score': float(np.mean(ndvi) * 100),  # 0-100 scale
            'vegetation_coverage': float(np.sum(ndvi > 0.3) / ndvi.size * 100),
            'stressed_areas': float(np.sum(ndvi < 0.2) / ndvi.size * 100),
            'healthy_areas': float(np.sum(ndvi > 0.6) / ndvi.size * 100),
        }
        
        # Classify health zones
        health_zones = np.zeros_like(ndvi, dtype=np.uint8)
        health_zones[ndvi < 0.2] = 1  # Stressed
        health_zones[(ndvi >= 0.2) & (ndvi < 0.4)] = 2  # Moderate
        health_zones[(ndvi >= 0.4) & (ndvi < 0.6)] = 3  # Good
        health_zones[ndvi >= 0.6] = 4  # Excellent
        
        # Calculate zone statistics
        zone_stats = {}
        for zone_id, zone_name in [(1, 'stressed'), (2, 'moderate'), (3, 'good'), (4, 'excellent')]:
            zone_pixels = np.sum(health_zones == zone_id)
            zone_stats[zone_name] = {
                'pixel_count': int(zone_pixels),
                'percentage': float(zone_pixels / health_zones.size * 100)
            }
        
        # Detect potential issues
        issues = []
        if health_metrics['stressed_areas'] > 20:
            issues.append('high_stress_areas')
        if health_metrics['vegetation_coverage'] < 70:
            issues.append('low_vegetation_coverage')
        if np.std(ndvi) > 0.3:
            issues.append('high_variability')
        
        return {
            'health_metrics': health_metrics,
            'zone_statistics': zone_stats,
            'potential_issues': issues,
            'recommendations': self._generate_health_recommendations(health_metrics, issues)
        }
    
    def _generate_management_zones(self, image: np.ndarray, indices: Dict[str, np.ndarray]) -> Dict[str, Any]:
        """Generate precision agriculture management zones."""
        # Combine multiple indices for clustering
        features = []
        for key, index in indices.items():
            if key in ['ndvi', 'evi', 'savi', 'gndvi']:
                features.append(index.flatten())
        
        feature_matrix = np.column_stack(features)
        
        # Remove invalid values
        valid_mask = ~np.any(np.isnan(feature_matrix) | np.isinf(feature_matrix), axis=1)
        valid_features = feature_matrix[valid_mask]
        
        if len(valid_features) < 10:
            return {'status': 'insufficient_data'}
        
        # Normalize features
        scaler = StandardScaler()
        normalized_features = scaler.fit_transform(valid_features)
        
        # Perform K-means clustering
        n_zones = min(5, max(2, len(valid_features) // 100))  # Adaptive number of zones
        kmeans = KMeans(n_clusters=n_zones, random_state=42)
        zone_labels = kmeans.fit_predict(normalized_features)
        
        # Map back to image dimensions
        full_labels = np.full(feature_matrix.shape[0], -1, dtype=int)
        full_labels[valid_mask] = zone_labels
        zone_map = full_labels.reshape(indices['ndvi'].shape)
        
        # Calculate zone characteristics
        zone_characteristics = {}
        for zone_id in range(n_zones):
            zone_mask = zone_map == zone_id
            zone_chars = {}
            
            for key, index in indices.items():
                zone_values = index[zone_mask]
                if len(zone_values) > 0:
                    zone_chars[key] = {
                        'mean': float(np.mean(zone_values)),
                        'std': float(np.std(zone_values)),
                        'min': float(np.min(zone_values)),
                        'max': float(np.max(zone_values))
                    }
            
            zone_characteristics[f'zone_{zone_id}'] = {
                'pixel_count': int(np.sum(zone_mask)),
                'percentage': float(np.sum(zone_mask) / zone_map.size * 100),
                'characteristics': zone_chars,
                'management_recommendations': self._get_zone_recommendations(zone_chars)
            }
        
        return {
            'zone_map': zone_map.tolist(),
            'n_zones': n_zones,
            'zone_characteristics': zone_characteristics,
            'status': 'completed'
        }
    
    def _generate_health_recommendations(self, metrics: Dict[str, float], issues: List[str]) -> List[str]:
        """Generate health-based recommendations."""
        recommendations = []
        
        if 'high_stress_areas' in issues:
            recommendations.extend([
                'Investigate irrigation system in stressed areas',
                'Check for pest or disease presence',
                'Consider soil testing in affected zones'
            ])
        
        if 'low_vegetation_coverage' in issues:
            recommendations.extend([
                'Review planting density',
                'Check seed germination rates',
                'Assess soil preparation quality'
            ])
        
        if metrics['overall_health_score'] < 50:
            recommendations.extend([
                'Implement immediate intervention measures',
                'Increase monitoring frequency',
                'Consider emergency nutrient application'
            ])
        
        return recommendations
    
    def _get_zone_recommendations(self, characteristics: Dict[str, Dict[str, float]]) -> List[str]:
        """Generate management recommendations for each zone."""
        recommendations = []
        
        if 'ndvi' in characteristics:
            ndvi_mean = characteristics['ndvi']['mean']
            
            if ndvi_mean > 0.6:
                recommendations.append('Zone performing well, maintain current practices')
            elif ndvi_mean > 0.4:
                recommendations.append('Consider moderate fertilizer application')
            else:
                recommendations.extend([
                    'Requires immediate attention',
                    'Investigate water and nutrient availability',
                    'Consider replanting if necessary'
                ])
        
        return recommendations
    
    async def _find_historical_images(self, current_image_path: str, boundary: Dict[str, Any]) -> List[str]:
        """Find historical satellite images for the same location."""
        # This would typically query a satellite image database or API
        # For now, return empty list - implement based on your data source
        return []
    
    def _analyze_vegetation_trend(self, changes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze vegetation trends over time."""
        if not changes:
            return {'status': 'no_data'}
        
        # Extract NDVI changes over time
        ndvi_changes = []
        for change in changes:
            if 'ndvi_change' in change.get('differences', {}):
                ndvi_changes.append(change['differences']['ndvi_change']['mean_change'])
        
        if not ndvi_changes:
            return {'status': 'insufficient_data'}
        
        # Calculate trend
        trend_slope = np.polyfit(range(len(ndvi_changes)), ndvi_changes, 1)[0]
        
        trend_direction = 'stable'
        if trend_slope > 0.05:
            trend_direction = 'improving'
        elif trend_slope < -0.05:
            trend_direction = 'declining'
        
        return {
            'trend_direction': trend_direction,
            'trend_slope': float(trend_slope),
            'average_change': float(np.mean(ndvi_changes)),
            'change_variability': float(np.std(ndvi_changes)),
            'status': 'completed'
        }

    async def process_gee_data(self, farm_boundary: Dict[str, Any], start_date: str, end_date: str) -> Dict[str, Any]:
        """Process satellite data from Google Earth Engine."""
        if not self.gee_initialized:
            return {'status': 'gee_not_available'}
        
        try:
            # Convert boundary to Earth Engine geometry
            boundary_geom = ee.Geometry.Polygon(farm_boundary['coordinates'])
            
            # Get Sentinel-2 collection
            collection = ee.ImageCollection('COPERNICUS/S2_SR') \
                .filterBounds(boundary_geom) \
                .filterDate(start_date, end_date) \
                .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
            
            # Get the least cloudy image
            image = collection.sort('CLOUDY_PIXEL_PERCENTAGE').first()
            
            # Calculate vegetation indices
            ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
            evi = image.expression(
                '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
                    'NIR': image.select('B8'),
                    'RED': image.select('B4'),
                    'BLUE': image.select('B2')
                }
            ).rename('EVI')
            
            # Combine indices
            indices_image = image.addBands([ndvi, evi])
            
            # Get image statistics
            stats = indices_image.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=boundary_geom,
                scale=10,
                maxPixels=1e9
            )
            
            return {
                'platform': 'Google Earth Engine',
                'satellite': 'Sentinel-2',
                'statistics': stats.getInfo(),
                'image_date': image.get('system:time_start').getInfo(),
                'cloud_coverage': image.get('CLOUDY_PIXEL_PERCENTAGE').getInfo(),
                'status': 'completed'
            }
            
        except Exception as e:
            logger.error(f"Error processing GEE data: {e}")
            return {'status': 'error', 'message': str(e)}
