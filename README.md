# staticmap-osm-generator

> ⚠️ **Proof of concept** – Not intended for production use.

HTTP server that generates cached PNG map tiles from OpenStreetMap with custom markers.

## Background

This project was created as a proof of concept to display earthquake coordinates in a user-friendly visual format. Instead of showing raw latitude/longitude data, it generates map images with markers indicating the exact location of seismic events, making the information more accessible and intuitive for end users.

## Features

- 🗺️ Single-endpoint API for map generation
- 💾 Content-based caching system
- ⚙️ YAML and environment variable configuration
- 🎨 Customizable marker styling

## Quick Start

### Using Docker (Recommended)

Pull and run the pre-built image from GitHub Container Registry:

```bash
docker pull ghcr.io/alvarosdev/staticmap-osm-generator:latest

docker run -p 3000:3000 \
  -v $(pwd)/assets:/app/assets \
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

The server exposes a single endpoint for map generation:

### `GET /map`

Generates a 256×256 PNG map tile with a centered marker at the specified coordinates.

**Query Parameters:**
| Parameter | Type    | Range          | Description                    |
|-----------|---------|----------------|--------------------------------|
| `lat`     | number  | `-90` to `90`  | Latitude coordinate            |
| `lon`     | number  | `-180` to `180`| Longitude coordinate           |
| `zoom`    | integer | `0` to `20`    | Zoom level (higher = more detail) |

**Example Request:**
```bash
# Buenos Aires, Argentina at zoom level 12
curl "http://localhost:3000/map?lat=-34.6037&lon=-58.3816&zoom=12" -o map.png

# New York City, USA at zoom level 15
curl "http://localhost:3000/map?lat=40.7128&lon=-74.0060&zoom=15" -o nyc.png
```

**Responses:**
- `200 OK` – Returns PNG image (Content-Type: `image/png`)
- `400 Bad Request` – Invalid or missing parameters
- `500 Internal Server Error` – Server-side error

**How it works:**
1. Server validates input parameters
2. Checks if cached image exists for these coordinates
3. If not cached, fetches OSM tiles and generates the image
4. Draws a custom marker at the center point
5. Saves to cache and returns the PNG

## Caching System

The server implements an intelligent caching mechanism to improve performance and reduce load on OSM tile servers:

- **Cache Location**: Images are stored in the `assets/` directory
- **Cache Key**: Content hash generated from `zoom`, `lat`, and `lon` parameters
- **Cache Strategy**: 
  - First request: Fetches OSM tiles, generates image, saves to cache
  - Subsequent requests: Serves directly from cache (instant response)
- **Persistence**: When using Docker, mount a volume to persist cache between container restarts

**Docker volume mount example:**
```bash
docker run -p 3000:3000 -v $(pwd)/assets:/app/assets ghcr.io/alvarosdev/staticmap-osm-generator:latest
```

This ensures your cached maps persist even if you restart or recreate the container.

## Configuration

Edit `config.yaml` or use environment variables:

```yaml
port: 3000                                    # PORT
assetsDir: assets                             # ASSETS_DIR
osmBaseUrl: https://tile.openstreetmap.org
marker:
  radius: 8
  fillColor: "#e53935"
  borderColor: "black"
```

**Environment Variables:**
- `PORT` – Server port (default: `3000`)
- `ASSETS_DIR` – Cache directory path (default: `assets`)
- `NODE_ENV` – Environment mode (`development` or `production`)

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
  -v $(pwd)/assets:/app/assets \
  -e PORT=3000 \
  ghcr.io/alvarosdev/staticmap-osm-generator:latest
```

### Using Docker Compose

Create or use the included `docker-compose.yml`:

```yaml
version: '3.8'
services:
  staticmap:
    image: ghcr.io/alvarosdev/staticmap-osm-generator:latest
    ports:
      - "3000:3000"
    volumes:
      - ./assets:/app/assets
    environment:
      - NODE_ENV=production
```

Then run:
```bash
docker-compose up -d
```

### Building Your Own Image

```bash
docker build -t staticmap-osm-generator .
docker run -p 3000:3000 staticmap-osm-generator
```

## Requirements

- **Docker** (recommended) or [Bun](https://bun.sh) v1.3.0+
- Internet access to fetch OSM tiles

## License

MIT License – See [LICENSE](LICENSE) file.

**Note:** This project uses OpenStreetMap tiles. Please respect [OSM tile usage policies](https://operations.osmfoundation.org/policies/tiles/).
