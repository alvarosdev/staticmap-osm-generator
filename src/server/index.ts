import { existsSync } from "node:fs";
import { CONFIG, loadConfig } from "@/config/config.js";
import { generateSingleTileMap } from "@/core/tile.js";
import { generateHash } from "@/core/hash.js";
import { logger } from "./logger.js";

/**
 * Handles the map generation or serving from cache.
 */
async function handleMapRequest(lat: number, lon: number, zoom: number): Promise<Response> {
  const hash = await generateHash(zoom, lat, lon);
  const filePath = `${CONFIG.assetsDir}/${hash}.png`;

  if (existsSync(filePath)) {
    logger.info({ hash, filePath }, 'Serving cached image');
    const file = Bun.file(filePath);
    return new Response(file, {
      headers: { "Content-Type": "image/png" },
    });
  } else {
    logger.info({ hash }, 'Generating new image');
    const pngBuffer = await generateSingleTileMap({ lat, lon, zoom }, CONFIG);
    await Bun.write(filePath, pngBuffer);
    const file = Bun.file(filePath);
    return new Response(file, {
      headers: { "Content-Type": "image/png" },
    });
  }
}

// Bun server
(async () => {
  await loadConfig();

  Bun.serve({
    port: CONFIG.port,
    async fetch(request) {
      const url = new URL(request.url);
      logger.info({ method: request.method, url: url.toString() }, 'Incoming request');
      if (url.pathname === "/map" && request.method === "GET") {
        const lat = parseFloat(url.searchParams.get("lat") || "");
        const lon = parseFloat(url.searchParams.get("lon") || "");
        const zoom = parseInt(url.searchParams.get("zoom") || "", 10);

        // Validation
        if (isNaN(lat) || lat < -90 || lat > 90) {
          logger.warn({ lat }, 'Invalid latitude');
          return new Response("Invalid latitude (must be between -90 and 90)", { status: 400 });
        }
        if (isNaN(lon) || lon < -180 || lon > 180) {
          logger.warn({ lon }, 'Invalid longitude');
          return new Response("Invalid longitude (must be between -180 and 180)", { status: 400 });
        }
        if (isNaN(zoom) || zoom < CONFIG.minZoom || zoom > CONFIG.maxZoom) {
          logger.warn({ zoom }, 'Invalid zoom');
          return new Response(`Invalid zoom (must be between ${CONFIG.minZoom} and ${CONFIG.maxZoom})`, { status: 400 });
        }

        try {
          return await handleMapRequest(lat, lon, zoom);
        } catch (error) {
          logger.error({ error: error instanceof Error ? error.message : String(error), lat, lon, zoom }, 'Error generating map');
          return new Response("Internal Server Error", { status: 500 });
        }
      }
      return new Response("Not Found", { status: 404 });
    },
  });

  console.log(`Server running on http://localhost:${CONFIG.port}`);
})();
