# staticmap-osm-generator

## Disclaimer
- This repository is a proof of concept.
- It should not be used in production environments.

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.0. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

# Overview
A minimal HTTP server built with Bun that generates or serves cached PNG map tiles from OpenStreetMap. Given a latitude, longitude, and zoom, the server stitches the necessary OSM tiles into a single 256×256 image and draws a visible marker at the center.

# Features
- **/map endpoint** serving a single PNG image per request.
- **Caching** to the local `assets/` directory using a content hash of `zoom, lat, lon`.
- **Configurable** via `config.yaml` and environment variables.
- **Pretty logging** in development with `pino` and `pino-pretty`.

# Requirements
- **Bun** v1.3.0 or newer
- Internet access to fetch OSM tiles (default `https://tile.openstreetmap.org`)

# Installation
Install dependencies with Bun:

```bash
bun install
```

# Running
Development (watches files, pretty logs):

```bash
bun run dev
```

Production:

```bash
bun run start
```

By default the server listens on `http://localhost:3000` (configurable).

# API
## GET `/map`
Returns a `image/png` with a single map tile centered at the requested coordinates.

Query parameters:
- `lat` number. Range: `-90` to `90`.
- `lon` number. Range: `-180` to `180`.
- `zoom` integer. Range: `minZoom`–`maxZoom` from config (defaults `0–20`).

Example:

```bash
curl "http://localhost:3000/map?lat=-34.6037&lon=-58.3816&zoom=12" --output map.png
```

- On success: `200 OK` with PNG body.
- On invalid input: `400 Bad Request` with a message.
- On unexpected errors: `500 Internal Server Error`.

# Configuration
Configuration is loaded from `config.yaml` at startup. Environment variables can override some fields.

Default fields (`src/config/config.ts`):
- `port` (default `3000`)
- `assetsDir` (default `assets`)
- `tileSize` (default `256`)
- `osmBaseUrl` (default `https://tile.openstreetmap.org`)
- `marker` styling (radius, colors)
- `minZoom`/`maxZoom` (default `0/20`)

Example `config.yaml`:

```yaml
port: 3000
assetsDir: assets
tileSize: 256
osmBaseUrl: https://tile.openstreetmap.org
marker:
  radius: 8
  fillColor: "#e53935"
  borderColor: "black"
  shadowColor: "rgba(255,255,255,0.9)"
  crossColor: "white"
maxZoom: 20
minZoom: 0
```

Env var overrides:
- `PORT`
- `ASSETS_DIR`

# Caching
Generated images are stored in `assets/` using a content hash derived from `zoom,lat,lon` (`src/core/hash.ts`). If a file already exists, it is served directly.

# Logging
Logging is handled by `pino` (`src/server/logger.ts`).
- In development (`NODE_ENV=development`): pretty logs via `pino-pretty`.
- In production: structured logs at `error` level.

# Build
Build the server entry (`src/server/index.ts`) to `dist/`:

```bash
bun run build
```

# Project Structure
- `src/server/index.ts` Bun server and routing (`/map`).
- `src/core/tile.ts` Tile math, image fetching, drawing, and marker rendering.
- `src/config/config.ts` Load config from YAML and env; export `CONFIG`.
- `src/server/logger.ts` Logger configuration.
- `assets/` Cache directory for generated PNGs.

# License
This project uses OpenStreetMap tiles. Respect OSM tile usage policies and attribution requirements. Choose and add a license file as appropriate for your project.
