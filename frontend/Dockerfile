# ==============================================================================
# OmniAI Frontend Production Dockerfile (Multi-Stage Nginx Build)
# ==============================================================================

# Stage 1: Build Static Assets
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Clean dependency installation
RUN npm ci

# Copy frontend source files
COPY . ./

# Build arguments for frontend configuration
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Compile production bundle
RUN npm run build

# Stage 2: High-Performance Nginx Static Server & Reverse Proxy
FROM nginx:1.25-alpine AS production

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built distribution files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Health check against Nginx healthz endpoint
HEALTHCHECK --interval=20s --timeout=5s --retries=3 \
    CMD wget -q --spider http://localhost:80/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]

