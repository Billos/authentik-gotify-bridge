# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install all dependencies (including devDependencies for building)
RUN yarn install --frozen-lockfile

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Build the application
RUN yarn build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install only production dependencies
RUN yarn install --frozen-lockfile --production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Set environment to production
ENV NODE_ENV=production

# Run the application
CMD ["node", "dist/index.js"]
