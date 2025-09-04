"""
KrishiMitra ML Services - Main Application
AI-powered Carbon Intelligence Platform for Agriculture
"""

import asyncio
import logging
import signal
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import uvicorn
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlAlchemyIntegration

from src.config import settings
from src.database import database_manager
from src.cache import cache_manager
from src.models import ModelManager
from src.monitoring import setup_monitoring, metrics
from src.auth import verify_token
from src.middleware import (
    request_id_middleware,
    logging_middleware,
    rate_limit_middleware,
    security_headers_middleware
)

# Import route modules
from src.routes import (
    satellite_analysis,
    crop_prediction,
    carbon_estimation,
    weather_forecasting,
    pest_disease_detection,
    soil_analysis,
    yield_optimization,
    market_analysis,
    risk_assessment,
    recommendation_engine,
    anomaly_detection,
    time_series_forecasting,
    computer_vision,
    nlp_processing,
    reinforcement_learning,
    federated_learning,
    automl,
    model_serving,
    health
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('logs/krishimitra-ml.log')
    ]
)
logger = logging.getLogger(__name__)

# Initialize Sentry for error tracking
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[
            FastApiIntegration(auto_enabling=True),
            SqlAlchemyIntegration(),
        ],
        traces_sample_rate=1.0 if settings.ENVIRONMENT == "development" else 0.1,
        environment=settings.ENVIRONMENT,
        attach_stacktrace=True,
        send_default_pii=False,
    )

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager for startup and shutdown events."""
    
    # Startup
    logger.info("🚀 Starting KrishiMitra ML Services...")
    
    try:
        # Initialize database connections
        await database_manager.initialize()
        logger.info("✅ Database connections initialized")
        
        # Initialize cache
        await cache_manager.initialize()
        logger.info("✅ Cache system initialized")
        
        # Initialize ML models
        model_manager = ModelManager()
        await model_manager.load_all_models()
        app.state.model_manager = model_manager
        logger.info("✅ ML models loaded")
        
        # Setup monitoring
        setup_monitoring()
        logger.info("✅ Monitoring initialized")
        
        logger.info("🎉 KrishiMitra ML Services started successfully!")
        
    except Exception as e:
        logger.error(f"❌ Failed to start application: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down KrishiMitra ML Services...")
    
    try:
        # Cleanup model manager
        if hasattr(app.state, 'model_manager'):
            await app.state.model_manager.cleanup()
            logger.info("✅ ML models cleaned up")
        
        # Close database connections
        await database_manager.close()
        logger.info("✅ Database connections closed")
        
        # Close cache connections
        await cache_manager.close()
        logger.info("✅ Cache connections closed")
        
        logger.info("✨ Shutdown completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Error during shutdown: {e}")

# Create FastAPI application
app = FastAPI(
    title="KrishiMitra ML Services",
    description="AI-powered Carbon Intelligence Platform for Agriculture",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
    swagger_ui_parameters={
        "defaultModelsExpandDepth": -1,
        "docExpansion": "none",
        "displayRequestDuration": True,
    }
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(request_id_middleware)
app.add_middleware(logging_middleware)
app.add_middleware(rate_limit_middleware)
app.add_middleware(security_headers_middleware)

# Setup Prometheus metrics
if settings.ENABLE_METRICS:
    instrumentator = Instrumentator()
    instrumentator.instrument(app).expose(app)

# Security
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and return user information."""
    try:
        user = await verify_token(credentials.credentials)
        return user
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for unhandled errors."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred",
            "request_id": getattr(request.state, "request_id", None),
            "timestamp": metrics.get_current_timestamp(),
        }
    )

# Health check endpoints (no authentication required)
app.include_router(health.router, prefix="/health", tags=["Health"])

# Authenticated routes
app.include_router(
    satellite_analysis.router,
    prefix="/api/v1/satellite",
    tags=["Satellite Analysis"],
    dependencies=[Depends(get_current_user)]
)

app.include_router(
    crop_prediction.router,
    prefix="/api/v1/crop",
    tags=["Crop Prediction"],
    dependencies=[Depends(get_current_user)]
)

app.include_router(
    carbon_estimation.router,
    prefix="/api/v1/carbon",
    tags=["Carbon Estimation"],
    dependencies=[Depends(get_current_user)]
)

app.include_router(
    weather_forecasting.router,
    prefix="/api/v1/weather",
    tags=["Weather Forecasting"],
    dependencies=[Depends(get_current_user)]
)

app.include_router(
    pest_disease_detection.router,
    prefix="/api/v1/pest-disease",
    tags=["Pest & Disease Detection"],
    dependencies=[Depends(get_current_user)]
)

app.include_router(
    soil_analysis.router,
    prefix="/api/v1/soil",
    tags=["Soil Analysis"],
    dependencies=[Depends(get_current_user)]
)

app.include_router(
    yield_optimization.router,
    prefix="/api/v1/yield",
    tags=["Yield Optimization"],
    dependencies=[Depends(get_current_user)]
)

app.include_router(
    market_analysis.router,
    prefix="/api/v1/market",
    tags=["Market Analysis"],
    dependencies=[Depends(get_current_user)]
)

app.include_router(
    risk_assessment.router,
    prefix="/api/v1/risk",
    tags=["Risk Assessment"],
    dependencies=[Depends(get_current_user)]
)

app.include_router(
    recommendation_engine.router,
    prefix="/api/v1/recommendations",
    tags=["Recommendation Engine"],
    dependencies=[Depends(get_current_user)]
)

app.include_router(
    anomaly_detection.router,
    prefix="/api/v1/anomaly",
    tags=["Anomaly Detection"],
    dependencies=[Depends(get_current_user)]
)

app.include_router(
    time_series_forecasting.router,
    prefix="/api/v1/timeseries",
    tags=["Time Series Forecasting"],
    dependencies=[Depends(get_current_user)]
)

app.include_router(
    computer_vision.router,
    prefix="/api/v1/vision",
    tags=["Computer Vision"],
    dependencies=[Depends(get_current_user)]
)

app.include_router(
    nlp_processing.router,
    prefix="/api/v1/nlp",
    tags=["Natural Language Processing"],
    dependencies=[Depends(get_current_user)]
)

app.include_router(
    reinforcement_learning.router,
    prefix="/api/v1/rl",
    tags=["Reinforcement Learning"],
    dependencies=[Depends(get_current_user)]
)

app.include_router(
    federated_learning.router,
    prefix="/api/v1/federated",
    tags=["Federated Learning"],
    dependencies=[Depends(get_current_user)]
)

app.include_router(
    automl.router,
    prefix="/api/v1/automl",
    tags=["AutoML"],
    dependencies=[Depends(get_current_user)]
)

app.include_router(
    model_serving.router,
    prefix="/api/v1/models",
    tags=["Model Serving"],
    dependencies=[Depends(get_current_user)]
)

@app.get("/")
async def root():
    """Root endpoint with service information."""
    return {
        "service": "KrishiMitra ML Services",
        "version": "1.0.0",
        "description": "AI-powered Carbon Intelligence Platform for Agriculture",
        "status": "operational",
        "timestamp": metrics.get_current_timestamp(),
        "features": [
            "Satellite Analysis",
            "Crop Prediction",
            "Carbon Estimation",
            "Weather Forecasting",
            "Pest & Disease Detection",
            "Soil Analysis",
            "Yield Optimization",
            "Market Analysis",
            "Risk Assessment",
            "Recommendation Engine",
            "Anomaly Detection",
            "Time Series Forecasting",
            "Computer Vision",
            "Natural Language Processing",
            "Reinforcement Learning",
            "Federated Learning",
            "AutoML",
            "Model Serving"
        ]
    }

def handle_shutdown_signal(signum, frame):
    """Handle shutdown signals gracefully."""
    logger.info(f"Received signal {signum}, initiating graceful shutdown...")
    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGTERM, handle_shutdown_signal)
signal.signal(signal.SIGINT, handle_shutdown_signal)

if __name__ == "__main__":
    # Run the application
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.ENVIRONMENT == "development",
        workers=settings.WORKERS if settings.ENVIRONMENT == "production" else 1,
        access_log=True,
        log_level="info",
        loop="uvloop",
        http="httptools",
    )
