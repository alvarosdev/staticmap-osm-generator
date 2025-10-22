# staticmap-osm-generator

> ⚠️ **Proof of concept** – Not intended for production use.

HTTP server that generates cached WebP map tiles from OpenStreetMap with custom markers.

## Background

This project was created as a proof of concept to display earthquake coordinates in a user-friendly visual format. Instead of showing raw latitude/longitude data, it generates map images with markers indicating the exact location of seismic events, making the information more accessible and intuitive for end users.

## Features

- 🗺️ Simple REST API for map generation
- 💾 Dual-layer caching system (disk + memory)
- 🚀 Optimized OSM tile fetching with automatic retries
- 🔒 Configurable CORS and security headers
- ⚙️ YAML and environment variable configuration
- 🎨 Customizable marker styling
- 📊 Built-in health check and monitoring endpoints
- ⚡ Built with Bun for maximum performance

## Quick Start

### Using Docker (Recommended)

Pull and run the pre-built image from GitHub Container Registry:

```bash
docker pull ghcr.io/alvarosdev/staticmap-osm-generator:latest

docker run -p 3000:3000 \
  -v $(pwd)/cache:/app/cache \
  ghcr.io/alvarosdev/staticmap-osm-generator:latest
```

Or using docker-compose:

```bash
docker-compose up
```

### Local Development

```bash
# Install dependencies
bun install

# Development mode (with hot reload)
bun run dev

# Production mode
bun run start
```

Server runs on `http://localhost:3000` by default.

## API Endpoints

### `GET /map`

Generates a 256×256 WebP map tile with a centered marker at the specified coordinates.

**Query Parameters:**
| Parameter | Type    | Range          | Description                    |
|-----------|---------|----------------|--------------------------------|
| `lat`     | number  | `-90` to `90`  | Latitude coordinate            |
| `lon`     | number  | `-180` to `180`| Longitude coordinate           |
| `zoom`    | integer | `0` to `20`    | Zoom level (higher = more detail) |
| `marker`  | string  | defined in config | Optional marker image name |
| `anchor`  | string  | defined in config | Optional anchor name (defaults from marker or config) |
| `scale`   | integer | `1` to `4`      | Output scale multiplier (e.g., 2 → 512×512) |

**Example Request:**
```bash
# Buenos Aires, Argentina at zoom level 12
curl "http://localhost:3000/map?lat=-34.6037&lon=-58.3816&zoom=12" -o map.webp

# New York City, USA at zoom level 15
curl "http://localhost:3000/map?lat=40.7128&lon=-74.0060&zoom=15" -o nyc.webp
```

**Responses:**
- `200 OK` – Returns WebP image (Content-Type: `image/webp`)
- `400 Bad Request` – Invalid or missing parameters
- `500 Internal Server Error` – Server-side error

**How it works:**
1. Validates input parameters (latitude, longitude, zoom)
2. Checks disk cache for existing image
3. If not cached, fetches 4 OSM tiles in parallel (with memory cache)
4. Composes tiles and draws custom marker at center
5. Saves to disk cache and returns WebP with appropriate headers
6. Cache key includes `scale`, avoiding collisions across resolutions

### `GET /health`

Health check endpoint for monitoring and load balancers.

**Response:**
- `200 OK` – Server is healthy

### `GET /cache/stats`

Returns cache statistics for monitoring performance.

**Response:**
```json
{
  "size": 450,
  "maxSize": 1000
}
```

- `size`: Current number of tiles in memory cache
- `maxSize`: Maximum cache capacity

## Caching System

The server implements a **dual-layer caching system** for optimal performance:

### 1. Disk Cache (Generated Maps)
- **Location**: `cache/` directory
- **Purpose**: Stores final generated map images
- **Key**: Content hash from `zoom`, `lat`, `lon`
- **Persistence**: Survives server restarts
- **Strategy**: Check first, serve instantly if exists

### 2. Memory Cache (OSM Tiles)
- **Purpose**: Caches individual OSM tiles in RAM
- **Type**: LRU (Least Recently Used) eviction
- **Configuration**: 
  ```yaml
  cache:
    maxSize: 1000      # Max tiles in memory
    ttlMinutes: 60     # Time to live
  ```
- Helps reduce repeated requests to OSM servers
- Automatic expiration and eviction of old tiles

**Docker volume mount example:**
```bash
docker run -p 3000:3000 -v $(pwd)/cache:/app/cache ghcr.io/alvarosdev/staticmap-osm-generator:latest
```

This ensures your disk cache persists between container restarts.

## Security & Performance

### Security Features
- **CORS configurable** - Control allowed origins, methods, and headers via config
- **Security headers** - X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, etc.
- **Input validation** - Robust validation and sanitization of all parameters
- **Cache headers** - Proper caching directives for optimal CDN/browser caching

> **Note:** Rate limiting should be handled at the infrastructure level (e.g., Cloudflare, nginx)

### Performance Optimizations

**OSM Tile Fetching:**
- In-memory LRU cache for OSM tiles with configurable size and TTL
- Rate limiting (2 concurrent requests, 2 req/sec) to respect OSM policies
- Automatic retries with exponential backoff (3 attempts: 1s → 2s → 4s)
- Request timeouts (10s) and proper User-Agent identification
- Parallel fetching of the 4 tiles needed per map

**Bun Native APIs:**
- `Bun.CryptoHasher` for fast synchronous hashing (~5x faster than Web Crypto)
- Static routes for zero-allocation responses on `/health` endpoint
- `Bun.file()` for optimized file I/O with automatic streaming
- `Bun.write()` for fast file writing operations
- Native gzip compression (automatic in Bun)

## Configuration

Edit `config.yaml` or use environment variables:

```yaml
port: 3000
cacheDir: cache
tileSize: 256
osmBaseUrl: https://tile.openstreetmap.org
marker:
  radius: 8
  fillColor: "#e53935"
  borderColor: "black"
  crossColor: "white"
maxZoom: 20
minZoom: 0

# Optional attribution bar at the bottom of the image
attribution:
  enabled: true
  text: "© OpenStreetMap"
  backgroundColor: "#000000"
  textColor: "#FFFFFF"
  opacity: 0.5

# Tile cache configuration
cache:
  maxSize: 1000      # Maximum tiles in memory
  ttlMinutes: 60     # Time to live in minutes

# CORS configuration
cors:
  enabled: true                    # Enable/disable CORS
  allowedOrigins: "*"              # Allowed origins (* for all)
  allowedMethods: "GET, OPTIONS"   # Allowed HTTP methods
  allowedHeaders: "Content-Type"   # Allowed headers
  maxAge: 86400                    # Preflight cache duration (24 hours)
```

**Environment Variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `CACHE_DIR` | Cache directory path | `cache` |
| `NODE_ENV` | Environment mode | `production` |
| `CORS_ENABLED` | Enable CORS | `true` |
| `CORS_ALLOWED_ORIGINS` | Allowed origins | `*` |
| `CORS_ALLOWED_METHODS` | Allowed HTTP methods | `GET, OPTIONS` |
| `CORS_ALLOWED_HEADERS` | Allowed headers | `Content-Type` |
| `CORS_MAX_AGE` | Preflight cache duration (seconds) | `86400` |

### CORS Configuration Examples

**Public API (default):**
```yaml
cors:
  enabled: true
  allowedOrigins: "*"
  allowedMethods: "GET, OPTIONS"
  allowedHeaders: "Content-Type"
  maxAge: 86400
```

**Specific domain:**
```yaml
cors:
  enabled: true
  allowedOrigins: "https://example.com"
  allowedMethods: "GET, OPTIONS"
  allowedHeaders: "Content-Type"
  maxAge: 86400
```

**Multiple domains (via environment variable):**
```bash
CORS_ALLOWED_ORIGINS="https://example.com, https://app.example.com"
```

**Disable CORS (behind Cloudflare/nginx):**
```yaml
cors:
  enabled: false
```

Or via environment variable:
```bash
CORS_ENABLED=false
```

## Docker Deployment

### Using Pre-built Image

The easiest way to run this project is using the official Docker image:

```bash
# Pull the latest image
docker pull ghcr.io/alvarosdev/staticmap-osm-generator:latest

# Run with cache persistence
docker run -d \
  --name staticmap-server \
  -p 3000:3000 \
  -v $(pwd)/cache:/app/cache \
  -e PORT=3000 \
  ghcr.io/alvarosdev/staticmap-osm-generator:latest
```

### Using Docker Compose

Use the published image from GitHub Container Registry:

```yaml
version: "3.9"
services:
  staticmap:
    image: ghcr.io/alvarosdev/staticmap-osm-generator:latest
    container_name: staticmap-osm-generator
    environment:
      - NODE_ENV=production
      - PORT=3000
      - CACHE_DIR=/app/cache
      # CORS configuration (optional)
      - CORS_ENABLED=true
      - CORS_ALLOWED_ORIGINS=*
      - CORS_ALLOWED_METHODS=GET, OPTIONS
      - CORS_ALLOWED_HEADERS=Content-Type
      - CORS_MAX_AGE=86400
    ports:
      - "3000:3000"
    volumes:
      - ./cache:/app/cache
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped
```

Run with:
```bash
docker compose up -d
```

### Building Your Own Image

```bash
docker build -t staticmap-osm-generator .
docker run -p 3000:3000 staticmap-osm-generator

Note: Docker build includes a Biome linter check stage and will fail if lint errors are found.
```

## Production Deployment

### Recommended Setup

```
[Client] → [CDN/Reverse Proxy] → [Load Balancer] → [Docker Container]
           ↓                      ↓
           Rate Limiting          SSL/TLS Termination
           DDoS Protection        Health Checks
           Caching                Load Balancing
```

When deploying behind a reverse proxy or CDN:

1. **Disable CORS** in the application (handled by proxy):
   ```bash
   CORS_ENABLED=false
   ```

2. **Configure rate limiting** at the proxy level (not in the app)

3. **Enable caching** at the CDN/proxy level:
   - Cache `/map` responses based on query parameters
   - Don't cache `/stats` or `/health`

## Requirements

- **Docker** (recommended) or [Bun](https://bun.sh) v1.3.0+
- **sharp** for WebP conversion (installed automatically when using Docker).

> If running locally without Docker, install dependencies with `bun install` to fetch `sharp` prebuilt binaries. On first install it may download platform-specific binaries.
- Internet access to fetch OSM tiles

## License

MIT License – See [LICENSE](LICENSE) file.

**Note:** This project uses OpenStreetMap tiles. Please respect [OSM tile usage policies](https://operations.osmfoundation.org/policies/tiles/).
