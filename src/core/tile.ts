import { createCanvas, loadImage } from "canvas";
import type { LatLonToTileResult, TileInfo, GenerateTileParams, Config } from "@/types/types.js";
import { fetchTile } from "./tileFetcher.js";

/**
 * Converts latitude and longitude to tile coordinates and pixel offsets.
 */
export function latLonToTileXY(lat: number, lon: number, z: number, tileSize: number): LatLonToTileResult {
  const n = 2 ** z;
  const xtileFloat = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const ytileFloat =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

  const xtile = Math.floor(xtileFloat);
  const ytile = Math.floor(ytileFloat);

  // Pixel offset within the tile
  const xPx = (xtileFloat - xtile) * tileSize;
  const yPx = (ytileFloat - ytile) * tileSize;

  return { xtile, ytile, xtileFloat, ytileFloat, xPx, yPx };
}

/**
 * Generates a PNG buffer with a single OSM tile and a marker at the specified lat/lon.
 */
export async function generateSingleTileMap({ lat, lon, zoom }: GenerateTileParams, config: Config): Promise<Buffer> {
  const tileSize = config.tileSize;
  const { xtileFloat, ytileFloat } = latLonToTileXY(lat, lon, zoom, tileSize);
  const worldX = xtileFloat * tileSize;
  const worldY = ytileFloat * tileSize;
  const halfTile = tileSize / 2;
  const topLeftX = worldX - halfTile;
  const topLeftY = worldY - halfTile;
  const tileX0 = Math.floor(topLeftX / tileSize);
  const tileY0 = Math.floor(topLeftY / tileSize);
  const offsetX = topLeftX - tileX0 * tileSize;
  const offsetY = topLeftY - tileY0 * tileSize;
  const n = 2 ** zoom;

  const canvas = createCanvas(tileSize, tileSize);
  const ctx = canvas.getContext("2d");

  const tileFetches: Promise<TileInfo>[] = [];
  for (let row = 0; row <= 1; row++) {
    for (let col = 0; col <= 1; col++) {
      const tileX = tileX0 + col;
      const tileY = tileY0 + row;
      const wrappedX = ((tileX % n) + n) % n;
      const clampedY = Math.min(Math.max(tileY, 0), n - 1);
      const drawX = col * tileSize - offsetX;
      const drawY = row * tileSize - offsetY;

      tileFetches.push(
        (async (): Promise<TileInfo> => {
          const buf = await fetchTile(zoom, wrappedX, clampedY, config.osmBaseUrl);
          const image = await loadImage(buf);
          return { image, drawX, drawY };
        })()
      );
    }
  }

  const tiles = await Promise.all(tileFetches);
  for (const { image, drawX, drawY } of tiles) {
    ctx.drawImage(image, drawX, drawY);
  }

  // Draw visible marker (circle with border)
  const r = config.marker.radius;
  const centerX = tileSize / 2;
  const centerY = tileSize / 2;

  // Thick white shadow for visibility over any background
  ctx.beginPath();
  ctx.arc(centerX, centerY, r + 3, 0, Math.PI * 2);
  ctx.fillStyle = config.marker.shadowColor;
  ctx.fill();

  // Thin black border
  ctx.beginPath();
  ctx.arc(centerX, centerY, r + 3, 0, Math.PI * 2);
  ctx.strokeStyle = config.marker.borderColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Red point
  ctx.beginPath();
  ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
  ctx.fillStyle = config.marker.fillColor;
  ctx.fill();

  // Small cross in the center
  ctx.lineWidth = 2;
  ctx.strokeStyle = config.marker.crossColor;
  ctx.beginPath();
  ctx.moveTo(centerX - r, centerY);
  ctx.lineTo(centerX + r, centerY);
  ctx.moveTo(centerX, centerY - r);
  ctx.lineTo(centerX, centerY + r);
  ctx.stroke();

  return canvas.toBuffer("image/png");
}
