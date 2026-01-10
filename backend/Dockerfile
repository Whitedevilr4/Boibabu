# Multi-stage build for BoiBabu Production

# Stage 1: Build frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --only=production
COPY frontend/ ./
RUN npm run build

# Stage 2: Setup backend
FROM node:18-alpine AS backend-setup
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/ ./

# Stage 3: Production image
FROM node:18-alpine AS production

# Install PM2 globally
RUN npm install -g pm2

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S boibabu -u 1001

# Copy backend files
COPY --from=backend-setup --chown=boibabu:nodejs /app/backend ./backend

# Copy frontend build
COPY --from=frontend-build --chown=boibabu:nodejs /app/frontend/build ./frontend/build

# Copy configuration files
COPY --chown=boibabu:nodejs ecosystem.config.js ./
COPY --chown=boibabu:nodejs package.json ./

# Create necessary directories
RUN mkdir -p logs uploads backend/uploads/books backend/uploads/users backend/uploads/hero-slides backend/uploads/publisher-ads
RUN chown -R boibabu:nodejs logs uploads backend/uploads

# Switch to non-root user
USER boibabu

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node backend/healthcheck.js || exit 1

# Start the application
CMD ["pm2-runtime", "start", "ecosystem.config.js", "--env", "production"]