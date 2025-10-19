FROM oven/bun:1.3.1

LABEL maintainer="staticmap-osm-generator" \
      version="1.0" \
      description="A minimal HTTP server for generating OSM map tiles with markers"

WORKDIR /app

# Install dependencies
COPY bun.lock package.json ./
RUN bun install --production --frozen-lockfile

# Copy configuration, source, and assets
COPY tsconfig.json config.yaml ./
COPY src ./src
COPY assets ./assets

# Create assets directory if not exists
RUN mkdir -p /app/assets

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV ASSETS_DIR=/app/assets

EXPOSE 3000

CMD ["bun", "run", "start"]
