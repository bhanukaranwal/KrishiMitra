"""
Crop Yield Prediction Model Training Pipeline
Advanced ML model for predicting crop yields using satellite data, weather, and farm inputs
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, GridSearchCV, TimeSeriesSplit
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import xgboost as xgb
import lightgbm as lgb
from tensorflow import keras
from tensorflow.keras import layers
import optuna
import joblib
import mlflow
import mlflow.sklearn
import mlflow.tensorflow
from typing import Dict, List, Tuple, Any
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CropYieldPredictor:
    """Advanced crop yield prediction model with multiple algorithms and hyperparameter optimization."""
    
    def __init__(self, model_path: str = "models/crop_yield"):
        self.model_path = Path(model_path)
        self.model_path.mkdir(parents=True, exist_ok=True)
        
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        self.models = {}
        self.best_model = None
        self.feature_importance = None
        
    def prepare_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """Advanced feature engineering for crop yield prediction."""
        
        # Create a copy to avoid modifying original data
        df = data.copy()
        
        # Temporal features
        df['planting_month'] = pd.to_datetime(df['planting_date']).dt.month
        df['planting_season'] = df['planting_month'].map({
            12: 'winter', 1: 'winter', 2: 'winter',
            3: 'spring', 4: 'spring', 5: 'spring',
            6: 'summer', 7: 'summer', 8: 'summer',
            9: 'autumn', 10: 'autumn', 11: 'autumn'
        })
        
        # Growing degree days calculation
        df['gdd'] = np.maximum(0, (df['avg_temperature'] - df['base_temperature']))
        df['cumulative_gdd'] = df.groupby('farm_id')['gdd'].cumsum()
        
        # Precipitation features
        df['rainfall_lag_7'] = df.groupby('farm_id')['rainfall'].rolling(7).sum().reset_index(0, drop=True)
        df['rainfall_lag_30'] = df.groupby('farm_id')['rainfall'].rolling(30).sum().reset_index(0, drop=True)
        df['rainfall_variance'] = df.groupby('farm_id')['rainfall'].rolling(30).var().reset_index(0, drop=True)
        
        # Drought stress indicator
        df['drought_stress'] = (df['rainfall_lag_30'] < df['rainfall_lag_30'].quantile(0.2)).astype(int)
        
        # Vegetation indices interactions
        df['ndvi_evi_ratio'] = df['ndvi'] / (df['evi'] + 1e-6)
        df['ndvi_trend'] = df.groupby('farm_id')['ndvi'].pct_change(periods=7)
        df['vegetation_health_index'] = (df['ndvi'] + df['evi'] + df['savi']) / 3
        
        # Soil health composite score
        soil_features = ['soil_organic_carbon', 'soil_ph', 'soil_nitrogen', 'soil_phosphorus', 'soil_potassium']
        df['soil_health_score'] = df[soil_features].fillna(0).sum(axis=1) / len(soil_features)
        
        # Weather stress indicators
        df['heat_stress'] = (df['max_temperature'] > 35).astype(int)
        df['cold_stress'] = (df['min_temperature'] < 10).astype(int)
        df['humidity_stress'] = ((df['humidity'] < 30) | (df['humidity'] > 90)).astype(int)
        
        # Input efficiency ratios
        df['fertilizer_efficiency'] = df['yield'] / (df['fertilizer_nitrogen'] + df['fertilizer_phosphorus'] + df['fertilizer_potassium'] + 1)
        df['water_use_efficiency'] = df['yield'] / (df['irrigation_amount'] + df['rainfall_lag_30'] + 1)
        
        # Regional and variety adjustments
        df = pd.get_dummies(df, columns=['crop_variety', 'soil_type', 'irrigation_method'], prefix_sep='_')
        
        # Historical yield features
        df['yield_lag_1'] = df.groupby('farm_id')['yield'].shift(1)
        df['yield_lag_2'] = df.groupby('farm_id')['yield'].shift(2)
        df['yield_trend'] = df.groupby('farm_id')['yield'].rolling(3).mean().reset_index(0, drop=True)
        
        # Market and economic indicators
        df['price_yield_ratio'] = df['market_price'] / (df['yield'] + 1e-6)
        df['profit_margin'] = (df['market_price'] * df['yield']) - df['total_cost']
        
        return df
    
    def create_neural_network(self, input_dim: int) -> keras.Model:
        """Create advanced neural network for yield prediction."""
        
        model = keras.Sequential([
            layers.Dense(512, activation='relu', input_shape=(input_dim,)),
            layers.BatchNormalization(),
            layers.Dropout(0.3),
            
            layers.Dense(256, activation='relu'),
            layers.BatchNormalization(),
            layers.Dropout(0.2),
            
            layers.Dense(128, activation='relu'),
            layers.BatchNormalization(),
            layers.Dropout(0.1),
            
            layers.Dense(64, activation='relu'),
            layers.Dense(32, activation='relu'),
            layers.Dense(1, activation='linear')
        ])
        
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss='mse',
            metrics=['mae']
        )
        
        return model
    
    def optimize_hyperparameters(self, X_train: np.ndarray, y_train: np.ndarray, 
                                model_type: str) -> Dict[str, Any]:
        """Hyperparameter optimization using Optuna."""
        
        def objective(trial):
            if model_type == 'xgboost':
                params = {
                    'n_estimators': trial.suggest_int('n_estimators', 100, 1000),
                    'max_depth': trial.suggest_int('max_depth', 3, 12),
                    'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3),
                    'subsample': trial.suggest_float('subsample', 0.6, 1.0),
                    'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
                    'reg_alpha': trial.suggest_float('reg_alpha', 0, 10),
                    'reg_lambda': trial.suggest_float('reg_lambda', 0, 10),
                }
                model = xgb.XGBRegressor(**params, random_state=42)
                
            elif model_type == 'lightgbm':
                params = {
                    'n_estimators': trial.suggest_int('n_estimators', 100, 1000),
                    'max_depth': trial.suggest_int('max_depth', 3, 12),
                    'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3),
                    'num_leaves': trial.suggest_int('num_leaves', 10, 300),
                    'subsample': trial.suggest_float('subsample', 0.6, 1.0),
                    'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
                    'reg_alpha': trial.suggest_float('reg_alpha', 0, 10),
                    'reg_lambda': trial.suggest_float('reg_lambda', 0, 10),
                }
                model = lgb.LGBMRegressor(**params, random_state=42, verbose=-1)
                
            elif model_type == 'random_forest':
                params = {
                    'n_estimators': trial.suggest_int('n_estimators', 100, 500),
                    'max_depth': trial.suggest_int('max_depth', 5, 20),
                    'min_samples_split': trial.suggest_int('min_samples_split', 2, 20),
                    'min_samples_leaf': trial.suggest_int('min_samples_leaf', 1, 10),
                    'max_features': trial.suggest_categorical('max_features', ['sqrt', 'log2', None]),
                }
                model = RandomForestRegressor(**params, random_state=42)
            
            # Time series cross-validation
            tscv = TimeSeriesSplit(n_splits=5)
            scores = []
            
            for train_idx, val_idx in tscv.split(X_train):
                X_fold_train, X_fold_val = X_train[train_idx], X_train[val_idx]
                y_fold_train, y_fold_val = y_train[train_idx], y_train[val_idx]
                
                model.fit(X_fold_train, y_fold_train)
                y_pred = model.predict(X_fold_val)
                rmse = np.sqrt(mean_squared_error(y_fold_val, y_pred))
                scores.append(rmse)
            
            return np.mean(scores)
        
        study = optuna.create_study(direction='minimize')
        study.optimize(objective, n_trials=100)
        
        return study.best_params
    
    def train_models(self, data: pd.DataFrame, target_column: str = 'yield'):
        """Train multiple models and select the best one."""
        
        logger.info("Starting model training pipeline...")
        
        # Prepare features
        df = self.prepare_features(data)
        
        # Separate features and target
        feature_columns = [col for col in df.columns if col not in [
            target_column, 'farm_id', 'crop_id', 'season_id', 'planting_date', 'harvest_date'
        ]]
        
        X = df[feature_columns].fillna(0)
        y = df[target_column].fillna(0)
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        
        # Split data with time-based split for realistic evaluation
        split_date = df['planting_date'].quantile(0.8)
        train_mask = pd.to_datetime(df['planting_date']) < split_date
        
        X_train, X_test = X_scaled[train_mask], X_scaled[~train_mask]
        y_train, y_test = y[train_mask], y[~train_mask]
        
        logger.info(f"Training set size: {X_train.shape[0]}, Test set size: {X_test.shape[0]}")
        
        # Start MLflow run
        with mlflow.start_run():
            mlflow.log_param("n_features", X_train.shape[1])
            mlflow.log_param("train_samples", X_train.shape[0])
            mlflow.log_param("test_samples", X_test.shape[0])
            
            model_results = {}
            
            # Train XGBoost
            logger.info("Training XGBoost model...")
            xgb_params = self.optimize_hyperparameters(X_train, y_train, 'xgboost')
            xgb_model = xgb.XGBRegressor(**xgb_params, random_state=42)
            xgb_model.fit(X_train, y_train)
            xgb_pred = xgb_model.predict(X_test)
            xgb_rmse = np.sqrt(mean_squared_error(y_test, xgb_pred))
            xgb_r2 = r2_score(y_test, xgb_pred)
            
            model_results['xgboost'] = {
                'model': xgb_model,
                'rmse': xgb_rmse,
                'r2': xgb_r2,
                'predictions': xgb_pred
            }
            
            mlflow.log_metric("xgb_rmse", xgb_rmse)
            mlflow.log_metric("xgb_r2", xgb_r2)
            
            # Train LightGBM
            logger.info("Training LightGBM model...")
            lgb_params = self.optimize_hyperparameters(X_train, y_train, 'lightgbm')
            lgb_model = lgb.LGBMRegressor(**lgb_params, random_state=42, verbose=-1)
            lgb_model.fit(X_train, y_train)
            lgb_pred = lgb_model.predict(X_test)
            lgb_rmse = np.sqrt(mean_squared_error(y_test, lgb_pred))
            lgb_r2 = r2_score(y_test, lgb_pred)
            
            model_results['lightgbm'] = {
                'model': lgb_model,
                'rmse': lgb_rmse,
                'r2': lgb_r2,
                'predictions': lgb_pred
            }
            
            mlflow.log_metric("lgb_rmse", lgb_rmse)
            mlflow.log_metric("lgb_r2", lgb_r2)
            
            # Train Random Forest
            logger.info("Training Random Forest model...")
            rf_params = self.optimize_hyperparameters(X_train, y_train, 'random_forest')
            rf_model = RandomForestRegressor(**rf_params, random_state=42)
            rf_model.fit(X_train, y_train)
            rf_pred = rf_model.predict(X_test)
            rf_rmse = np.sqrt(mean_squared_error(y_test, rf_pred))
            rf_r2 = r2_score(y_test, rf_pred)
            
            model_results['random_forest'] = {
                'model': rf_model,
                'rmse': rf_rmse,
                'r2': rf_r2,
                'predictions': rf_pred
            }
            
            mlflow.log_metric("rf_rmse", rf_rmse)
            mlflow.log_metric("rf_r2", rf_r2)
            
            # Train Neural Network
            logger.info("Training Neural Network model...")
            nn_model = self.create_neural_network(X_train.shape[1])
            
            early_stopping = keras.callbacks.EarlyStopping(
                monitor='val_loss', patience=50, restore_best_weights=True
            )
            
            reduce_lr = keras.callbacks.ReduceLROnPlateau(
                monitor='val_loss', factor=0.5, patience=25, min_lr=1e-6
            )
            
            history = nn_model.fit(
                X_train, y_train,
                validation_split=0.2,
                epochs=200,
                batch_size=32,
                callbacks=[early_stopping, reduce_lr],
                verbose=0
            )
            
            nn_pred = nn_model.predict(X_test).flatten()
            nn_rmse = np.sqrt(mean_squared_error(y_test, nn_pred))
            nn_r2 = r2_score(y_test, nn_pred)
            
            model_results['neural_network'] = {
                'model': nn_model,
                'rmse': nn_rmse,
                'r2': nn_r2,
                'predictions': nn_pred
            }
            
            mlflow.log_metric("nn_rmse", nn_rmse)
            mlflow.log_metric("nn_r2", nn_r2)
            
            # Ensemble model (weighted average based on performance)
            weights = {}
            total_weight = 0
            for name, result in model_results.items():
                # Weight inversely proportional to RMSE
                weight = 1 / result['rmse']
                weights[name] = weight
                total_weight += weight
            
            # Normalize weights
            for name in weights:
                weights[name] /= total_weight
            
            # Create ensemble prediction
            ensemble_pred = np.zeros_like(y_test)
            for name, result in model_results.items():
                ensemble_pred += weights[name] * result['predictions']
            
            ensemble_rmse = np.sqrt(mean_squared_error(y_test, ensemble_pred))
            ensemble_r2 = r2_score(y_test, ensemble_pred)
            
            model_results['ensemble'] = {
                'weights': weights,
                'rmse': ensemble_rmse,
                'r2': ensemble_r2,
                'predictions': ensemble_pred
            }
            
            mlflow.log_metric("ensemble_rmse", ensemble_rmse)
            mlflow.log_metric("ensemble_r2", ensemble_r2)
            
            # Select best model based on RMSE
            best_model_name = min(model_results.keys(), key=lambda k: model_results[k]['rmse'])
            self.best_model = model_results[best_model_name]
            self.models = model_results
            
            logger.info(f"Best model: {best_model_name} (RMSE: {self.best_model['rmse']:.4f}, R²: {self.best_model['r2']:.4f})")
            
            mlflow.log_param("best_model", best_model_name)
            mlflow.log_metric("best_rmse", self.best_model['rmse'])
            mlflow.log_metric("best_r2", self.best_model['r2'])
            
            # Save models
            self.save_models(feature_columns)
            
        return model_results
    
    def save_models(self, feature_columns: List[str]):
        """Save trained models and preprocessing objects."""
        
        # Save scaler
        joblib.dump(self.scaler, self.model_path / 'scaler.pkl')
        
        # Save feature columns
        joblib.dump(feature_columns, self.model_path / 'feature_columns.pkl')
        
        # Save individual models
        for name, result in self.models.items():
            if name != 'neural_network':
                joblib.dump(result['model'], self.model_path / f'{name}_model.pkl')
            else:
                result['model'].save(self.model_path / f'{name}_model.h5')
        
        # Save ensemble weights
        if 'ensemble' in self.models:
            joblib.dump(self.models['ensemble']['weights'], self.model_path / 'ensemble_weights.pkl')
        
        logger.info(f"Models saved to {self.model_path}")
    
    def load_models(self):
        """Load trained models and preprocessing objects."""
        
        try:
            self.scaler = joblib.load(self.model_path / 'scaler.pkl')
            feature_columns = joblib.load(self.model_path / 'feature_columns.pkl')
            
            # Load individual models
            model_files = {
                'xgboost': self.model_path / 'xgboost_model.pkl',
                'lightgbm': self.model_path / 'lightgbm_model.pkl',
                'random_forest': self.model_path / 'random_forest_model.pkl',
                'neural_network': self.model_path / 'neural_network_model.h5',
            }
            
            self.models = {}
            for name, path in model_files.items():
                if path.exists():
                    if name == 'neural_network':
                        self.models[name] = keras.models.load_model(path)
                    else:
                        self.models[name] = joblib.load(path)
            
            # Load ensemble weights
            weights_path = self.model_path / 'ensemble_weights.pkl'
            if weights_path.exists():
                self.ensemble_weights = joblib.load(weights_path)
            
            logger.info("Models loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error loading models: {e}")
            return False
    
    def predict(self, data: pd.DataFrame, use_ensemble: bool = True) -> np.ndarray:
        """Make predictions using the trained model(s)."""
        
        if not self.models:
            raise ValueError("No trained models available. Please train or load models first.")
        
        # Prepare features
        df = self.prepare_features(data)
        feature_columns = joblib.load(self.model_path / 'feature_columns.pkl')
        
        X = df[feature_columns].fillna(0)
        X_scaled = self.scaler.transform(X)
        
        if use_ensemble and hasattr(self, 'ensemble_weights'):
            # Ensemble prediction
            predictions = np.zeros(X_scaled.shape[0])
            
            for name, weight in self.ensemble_weights.items():
                if name in self.models:
                    if name == 'neural_network':
                        pred = self.models[name].predict(X_scaled).flatten()
                    else:
                        pred = self.models[name].predict(X_scaled)
                    predictions += weight * pred
            
            return predictions
        else:
            # Use best single model
            if hasattr(self, 'best_model') and self.best_model:
                if 'neural_network' in str(type(self.best_model['model'])):
                    return self.best_model['model'].predict(X_scaled).flatten()
                else:
                    return self.best_model['model'].predict(X_scaled)
            else:
                # Use first available model
                model_name, model = next(iter(self.models.items()))
                if model_name == 'neural_network':
                    return model.predict(X_scaled).flatten()
                else:
                    return model.predict(X_scaled)

def main():
    """Main training function."""
    
    # Load training data
    data = pd.read_csv('data/training/crop_yield_data.csv')
    
    # Initialize predictor
    predictor = CropYieldPredictor()
    
    # Train models
    results = predictor.train_models(data)
    
    # Print results
    print("\nModel Performance Summary:")
    print("-" * 50)
    for name, result in results.items():
        print(f"{name:15}: RMSE={result['rmse']:.4f}, R²={result['r2']:.4f}")

if __name__ == "__main__":
    main()
