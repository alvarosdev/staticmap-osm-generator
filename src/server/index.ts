import { CONFIG, loadConfig } from "@/config/config.js";
import { generateSingleTileMap } from "@/core/tile.js";
import { generateHash } from "@/core/hash.js";
import { getCacheStats } from "@/core/tileFetcher.js";
import { initTileCache } from "@/core/tileCache.js";
import { logger } from "./logger.js";
import { getSecurityHeaders, validateNumber, validateInteger } from "./security.js";

/**
 * Handles the map generation or serving from cache.
 * Uses Bun.file().exists() instead of Node.js fs.existsSync for better performance.
 */
async function handleMapRequest(lat: number, lon: number, zoom: number): Promise<Response> {
  const hash = generateHash(zoom, lat, lon);
  const filePath = `${CONFIG.assetsDir}/${hash}.png`;
  const file = Bun.file(filePath);

  if (await file.exists()) {
    logger.info({ hash, filePath }, 'Serving cached image');
    return new Response(file, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
        ...getSecurityHeaders(CONFIG.cors!),
      },
    });
  } else {
    logger.info({ hash }, 'Generating new image');
    const pngBuffer = await generateSingleTileMap({ lat, lon, zoom }, CONFIG);
    await Bun.write(filePath, pngBuffer);
    return new Response(Bun.file(filePath), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
        ...getSecurityHeaders(CONFIG.cors!),
      },
    });
  }
}

// Bun server
(async () => {
  await loadConfig();
  
  // Initialize tile cache with config
  const cacheConfig = CONFIG.cache || { maxSize: 1000, ttlMinutes: 60 };
  initTileCache(cacheConfig.maxSize, cacheConfig.ttlMinutes);
  logger.info({ cacheConfig }, 'Tile cache initialized');

  const server = Bun.serve({
    port: CONFIG.port,
    // Static routes for zero-allocation responses
    routes: {
      "/health": new Response("OK", {
        status: 200,
        headers: getSecurityHeaders(CONFIG.cors!),
      }),
    },
    async fetch(request, server) {
      const url = new URL(request.url);
      
      // Handle CORS preflight
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: getSecurityHeaders(CONFIG.cors!),
        });
      }

      logger.info({ method: request.method, url: url.toString() }, 'Incoming request');
      
      if (url.pathname === "/map" && request.method === "GET") {
        // Validate input parameters
        const latValidation = validateNumber(url.searchParams.get("lat"), -90, 90, "latitude");
        if (!latValidation.valid) {
          logger.warn({ error: latValidation.error }, 'Invalid latitude');
          return new Response(latValidation.error, {
            status: 400,
            headers: { "Content-Type": "text/plain", ...getSecurityHeaders(CONFIG.cors!) },
          });
        }

        const lonValidation = validateNumber(url.searchParams.get("lon"), -180, 180, "longitude");
        if (!lonValidation.valid) {
          logger.warn({ error: lonValidation.error }, 'Invalid longitude');
          return new Response(lonValidation.error, {
            status: 400,
            headers: { "Content-Type": "text/plain", ...getSecurityHeaders(CONFIG.cors!) },
          });
        }

        const zoomValidation = validateInteger(
          url.searchParams.get("zoom"),
          CONFIG.minZoom,
          CONFIG.maxZoom,
          "zoom"
        );
        if (!zoomValidation.valid) {
          logger.warn({ error: zoomValidation.error }, 'Invalid zoom');
          return new Response(zoomValidation.error, {
            status: 400,
            headers: { "Content-Type": "text/plain", ...getSecurityHeaders(CONFIG.cors!) },
          });
        }

        const lat = latValidation.value!;
        const lon = lonValidation.value!;
        const zoom = zoomValidation.value!;

        try {
          return await handleMapRequest(lat, lon, zoom);
        } catch (error) {
          logger.error({ error: error instanceof Error ? error.message : String(error), lat, lon, zoom }, 'Error generating map');
          return new Response("Internal Server Error", {
            status: 500,
            headers: { "Content-Type": "text/plain", ...getSecurityHeaders(CONFIG.cors!) },
          });
        }
      }

      // Cache stats endpoint
      if (url.pathname === "/stats" && request.method === "GET") {
        const stats = getCacheStats();
        return new Response(JSON.stringify(stats, null, 2), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            ...getSecurityHeaders(CONFIG.cors!),
          },
        });
      }

      return new Response("Not Found", {
        status: 404,
        headers: { "Content-Type": "text/plain", ...getSecurityHeaders(CONFIG.cors!) },
      });
    },
  });

  console.log(`Server running on http://localhost:${CONFIG.port}`);
})();
