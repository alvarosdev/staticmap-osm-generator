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
export async function generateSingleTileMap({ lat, lon, zoom, markerName, anchorName, outputScale }: GenerateTileParams, config: Config): Promise<Buffer> {
  const scale = Math.max(1, Math.min(4, Math.floor(outputScale ?? 1)));
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

  const canvas = createCanvas(tileSize * scale, tileSize * scale);
  const ctx = canvas.getContext("2d");
  // Normalize drawing coordinates to logical tile size
  ctx.scale(scale, scale);

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

  // Draw marker
  const centerX = tileSize / 2;
  const centerY = tileSize / 2;
  const TARGET_SIZE = 32; // logical size; will be scaled by ctx.scale

  // Try to draw image marker if configured
  let drewImageMarker = false;
  const markers = config.markers;
  const anchors = config.anchors;
  const selectedMarker = markerName ? markers.find(m => m.name === markerName) : undefined;
  const selectedAnchor = anchorName ? anchors.find(a => a.name === anchorName) : undefined;

  if (selectedMarker && selectedAnchor) {
    try {
      const img = await loadImage(selectedMarker.file);
      const dx = centerX - selectedAnchor.x * TARGET_SIZE;
      const dy = centerY - selectedAnchor.y * TARGET_SIZE;
      // Apply global shadow for image markers if enabled
      if (config.imageMarkerShadow?.enabled) {
        ctx.save();
        ctx.shadowColor = config.imageMarkerShadow.color;
        ctx.shadowBlur = config.imageMarkerShadow.blur;
        ctx.shadowOffsetX = config.imageMarkerShadow.offsetX;
        ctx.shadowOffsetY = config.imageMarkerShadow.offsetY;
        ctx.drawImage(img, 0, 0, img.width as number, img.height as number, dx, dy, TARGET_SIZE, TARGET_SIZE);
        ctx.restore();
      } else {
        ctx.drawImage(img, 0, 0, img.width as number, img.height as number, dx, dy, TARGET_SIZE, TARGET_SIZE);
      }
      drewImageMarker = true;
    } catch (e) {
      // Fallback to circle marker if image fails to load
      drewImageMarker = false;
    }
  }

  if (!drewImageMarker) {
    // Fallback: visible circle marker (existing style)
    const r = config.marker.radius;

    // Filled circle with optional global shadow (unified style)
    if (config.imageMarkerShadow?.enabled) {
      ctx.save();
      ctx.shadowColor = config.imageMarkerShadow.color;
      ctx.shadowBlur = config.imageMarkerShadow.blur;
      ctx.shadowOffsetX = config.imageMarkerShadow.offsetX;
      ctx.shadowOffsetY = config.imageMarkerShadow.offsetY;
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.fillStyle = config.marker.fillColor;
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.fillStyle = config.marker.fillColor;
      ctx.fill();
    }

    // Thin border without shadow
    ctx.beginPath();
    ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
    ctx.strokeStyle = config.marker.borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Small cross in the center (no shadow)
    ctx.lineWidth = 2;
    ctx.strokeStyle = config.marker.crossColor;
    ctx.beginPath();
    ctx.moveTo(centerX - r, centerY);
    ctx.lineTo(centerX + r, centerY);
    ctx.moveTo(centerX, centerY - r);
    ctx.lineTo(centerX, centerY + r);
    ctx.stroke();
  }

  // Draw attribution bar (optional)
  const attrib = config.attribution;
  if (attrib && attrib.enabled !== false && attrib.text) {
    const padX = 8;
    const padY = 6;
    const fontSize = 12;
    // TODO: Make this configurable
    ctx.font = `${fontSize}px "Cabin Condensed"`;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    const metrics = ctx.measureText(attrib.text);
    const textHeight = (metrics.actualBoundingBoxAscent || fontSize * 0.8) + (metrics.actualBoundingBoxDescent || fontSize * 0.2);
    const barHeight = Math.ceil(textHeight + padY * 2);
    const barY = tileSize - barHeight;

    // Background with opacity
    ctx.save();
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = Math.max(0, Math.min(1, attrib.opacity ?? 0.5));
    ctx.fillStyle = attrib.backgroundColor || "#000000";
    ctx.fillRect(0, barY, tileSize, barHeight);
    ctx.globalAlpha = prevAlpha;

    // Text
    ctx.fillStyle = attrib.textColor || "#FFFFFF";
    const textY = barY + padY + (metrics.actualBoundingBoxAscent || fontSize * 0.8);
    ctx.fillText(attrib.text, padX, textY);
    ctx.restore();
  }

  return canvas.toBuffer("image/png");
}
