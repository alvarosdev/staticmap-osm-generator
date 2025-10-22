import { CONFIG, loadConfig } from "@/config/config.js";
import { generateSingleTileMap } from "@/core/tile.js";
import { generateHash } from "@/core/hash.js";
import { getCacheStats } from "@/core/tileFetcher.js";
import { initTileCache } from "@/core/tileCache.js";
import { logger } from "./logger.js";
import { getSecurityHeaders, validateNumber, validateInteger } from "./security.js";
import sharp from "sharp";

/**
 * Handles the map generation or serving from cache.
 * Uses Bun.file().exists() instead of Node.js fs.existsSync for better performance.
 */
async function handleMapRequest(lat: number, lon: number, zoom: number, markerName?: string, anchorName?: string, scale: number = 1): Promise<Response> {
  const hash = generateHash(zoom, lat, lon, markerName, anchorName, scale);
  const filePath = `${CONFIG.cacheDir}/${hash}.webp`;
  const file = Bun.file(filePath);

  if (await file.exists()) {
    logger.info({ hash, filePath }, 'Serving cached image');
    return new Response(file, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        ...getSecurityHeaders(CONFIG.cors!),
      },
    });
  } else {
    logger.info({ hash }, 'Generating new image');
    const pngBuffer = await generateSingleTileMap({ lat, lon, zoom, markerName, anchorName, outputScale: scale }, CONFIG);
    const webpBuffer = await sharp(pngBuffer).webp({ quality: 85 }).toBuffer();
    await Bun.write(filePath, webpBuffer);
    return new Response(Bun.file(filePath), {
      headers: {
        "Content-Type": "image/webp",
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
        // Optional scale param (1..4)
        const scaleValidation = validateInteger(url.searchParams.get("scale"), 1, 4, "scale");
        const scale = scaleValidation.valid && scaleValidation.value ? scaleValidation.value : 1;

        // Optional marker and anchor params
        const markerParam = url.searchParams.get("marker")?.trim();
        const anchorParam = url.searchParams.get("anchor")?.trim();

        // Resolve marker name: provided -> default -> undefined
        const availableMarkers = CONFIG.markers;
        const availableAnchors = CONFIG.anchors;
        const defaultMarker = CONFIG.defaultMarker;
        const defaultAnchor = CONFIG.defaultAnchor || 'center';

        const markerName = markerParam || defaultMarker;
        if (markerParam) {
          const markerExists = availableMarkers.some(m => m.name === markerParam);
          if (!markerExists) {
            logger.warn({ markerParam }, 'Invalid marker');
            return new Response(`marker must be one of: ${(availableMarkers.map(m => m.name).join(', ') || 'none configured')}` , {
              status: 400,
              headers: { "Content-Type": "text/plain", ...getSecurityHeaders(CONFIG.cors!) },
            });
          }
        }
        // Validate anchor: user-provided -> marker's default -> config default
        let anchorName = anchorParam;
        if (!anchorName) {
          const foundMarker = availableMarkers.find(m => m.name === markerName);
          anchorName = foundMarker?.anchor || defaultAnchor;
        }
        const anchorValid = availableAnchors.some(a => a.name === anchorName);
        if (!anchorValid) {
          logger.warn({ anchorName }, 'Invalid anchor');
          return new Response(`anchor must be one of: ${(availableAnchors.map(a => a.name).join(', ') || 'none configured')}` , {
            status: 400,
            headers: { "Content-Type": "text/plain", ...getSecurityHeaders(CONFIG.cors!) },
          });
        }

        try {
          return await handleMapRequest(lat, lon, zoom, markerName || undefined, anchorName || undefined, scale);
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
