FROM node:20-alpine

# Install git, openssh (for deploy feature), and build tools
RUN apk add --no-cache git openssh-client python3 make g++

# Create non-root user
RUN addgroup -g 1000 devflow && \
    adduser -u 1000 -G devflow -s /bin/sh -D devflow

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

RUN npm install

# Copy rest of the project
COPY . .

# Make CLI executable
RUN chmod +x bin/devflow.js 2>/dev/null || true

# Link CLI globally inside container
RUN npm link 2>/dev/null || true

USER devflow

EXPOSE 3456 5173 9229
