# Multi-stage Dockerfile for Tweedpump SCADA Web Application
FROM node:20-alpine AS build

WORKDIR /app

# Copy package descriptors and install dependencies
COPY package*.json ./
RUN npm ci

# Copy application source files
COPY . .

# Build production bundle
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package descriptors and production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built production bundle and server code
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/cert.pem ./cert.pem
COPY --from=build /app/key.pem ./key.pem

EXPOSE 3000

ENV PORT=3000
CMD ["node", "server.js"]
