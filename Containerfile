# Stage 1: Build React frontend
FROM docker.io/library/node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend
FROM docker.io/library/python:3.12-slim
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=frontend-builder /app/frontend/dist ./static

EXPOSE 8000

VOLUME ["/app/data"]

ENV PYTHONUNBUFFERED=1
ENV DATA_DIR=/app/data

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
