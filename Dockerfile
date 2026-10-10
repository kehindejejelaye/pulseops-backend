FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Copy package manifests first for optimal layer caching
COPY package*.json ./

# Install production dependencies directly within the image
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source code
COPY src/ ./src/

# Change ownership to built-in non-root node user (Trivy compliance)
RUN chown -R node:node /app

# Switch to non-root user
USER node

EXPOSE 5000

# Container health probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/healthz || exit 1

CMD ["node", "src/index.js"]
