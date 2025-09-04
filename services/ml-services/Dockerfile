# Multi-stage build for Python ML services
FROM python:3.11-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    libgdal-dev \
    libproj-dev \
    libgeos-dev \
    libspatialindex-dev \
    libffi-dev \
    libssl-dev \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    libwebp-dev \
    libopencv-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install CUDA dependencies (optional, for GPU support)
# RUN curl -fsSL https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2004/x86_64/cuda-ubuntu2004.pin | tee /etc/apt/preferences.d/cuda-repository-pin-600
# RUN apt-key adv --fetch-keys https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2004/x86_64/3bf21e04.pub
# RUN add-apt-repository "deb https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2004/x86_64/ /"
# RUN apt-get update && apt-get install -y cuda-toolkit-11-8

# Install Python dependencies
FROM base AS deps
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Download NLTK data and spaCy models
RUN python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords'); nltk.download('wordnet')"
RUN python -m spacy download en_core_web_sm
RUN python -m spacy download en_core_web_lg

# Production stage
FROM deps AS runner
WORKDIR /app

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Create non-root user
RUN useradd --create-home --shell /bin/bash --user-group --uid 1000 mluser

# Copy application code
COPY --chown=mluser:mluser . .

# Create required directories
RUN mkdir -p /app/logs && chown mluser:mluser /app/logs
RUN mkdir -p /app/models && chown mluser:mluser /app/models
RUN mkdir -p /app/data && chown mluser:mluser /app/data
RUN mkdir -p /app/temp && chown mluser:mluser /app/temp

USER mluser

EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8001/health || exit 1

CMD ["python", "src/main.py"]
