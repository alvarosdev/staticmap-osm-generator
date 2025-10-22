FROM oven/bun:1.3

LABEL maintainer="staticmap-osm-generator" \
      version="1.0" \
      description="A minimal HTTP server for generating OSM map tiles with markers"

WORKDIR /app

# Install dependencies
COPY bun.lock package.json ./
# Install with updated dependencies (sharp prebuilt binaries will be fetched)
RUN bun install --production

# Copy configuration and source
COPY tsconfig.json config.yaml ./
COPY src ./src

# Create cache directory if not exists
RUN mkdir -p /app/cache

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV CACHE_DIR=/app/cache

EXPOSE 3000

CMD ["bun", "run", "start"]
