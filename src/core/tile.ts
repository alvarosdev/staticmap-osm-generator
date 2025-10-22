import type { Image } from 'canvas';
import { createCanvas, loadImage } from 'canvas';
import sharp from 'sharp';
import type {
	Config,
	GenerateTileParams,
	LatLonToTileResult,
	TileInfo,
} from '@/types/types.js';
import { fetchTile } from './tileFetcher.js';

// Simple in-memory cache for marker images (PNG/JPEG or rasterized SVG)
// Keyed by `${file}|${targetSize}` to allow size-specific rasterization reuse
const markerImageCache = new Map<string, Image>();

async function loadMarkerImage(
	file: string,
	targetSize: number
): Promise<Image> {
	const mtime = (await Bun.file(file)).lastModified ?? 0;
	const key = `${file}|${targetSize}|${mtime}`;
	const cached = markerImageCache.get(key);
	if (cached) return cached;

	const isSvg = file.toLowerCase().endsWith('.svg');
	let image: Image;
	if (isSvg) {
		// Density tuned to targetSize for crisp rasterization
		const density = Math.max(96, Math.round(288 * (targetSize / 32)));
		const svgBuf = await Bun.file(file).arrayBuffer();
		const raster = await sharp(Buffer.from(svgBuf), { density })
			.trim()
			.png()
			.toBuffer();
		image = await loadImage(raster);
	} else {
		image = await loadImage(file);
	}

	markerImageCache.set(key, image);
	return image;
}

export async function preloadMarkerImages(
	config: Config,
	targetSize: number = 32
): Promise<void> {
	const tasks = config.markers.map((m) =>
		loadMarkerImage(m.file, targetSize).catch(() => undefined)
	);
	await Promise.all(tasks);
}

export function latLonToTileXY(
	lat: number,
	lon: number,
	z: number,
	tileSize: number
): LatLonToTileResult {
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
export async function generateSingleTileMap(
	{ lat, lon, zoom, markerName, anchorName, outputScale }: GenerateTileParams,
	config: Config
): Promise<Buffer> {
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
	const ctx = canvas.getContext('2d');
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
					const buf = await fetchTile(
						zoom,
						wrappedX,
						clampedY,
						config.osmBaseUrl
					);
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
	const selectedMarker = markerName
		? markers.find((m) => m.name === markerName)
		: undefined;
	const selectedAnchor = anchorName
		? anchors.find((a) => a.name === anchorName)
		: undefined;

	if (selectedMarker && selectedAnchor) {
		try {
			const img = await loadMarkerImage(selectedMarker.file, TARGET_SIZE);
			// Fit marker into TARGET_SIZE while preserving aspect ratio
			const iw = img.width || 1;
			const ih = img.height || 1;
			const fitMode = selectedMarker.fit === 'cover' ? 'cover' : 'contain';
			const scaleToFit =
				fitMode === 'cover'
					? Math.max(TARGET_SIZE / iw, TARGET_SIZE / ih)
					: Math.min(TARGET_SIZE / iw, TARGET_SIZE / ih);
			const drawW = Math.max(1, Math.round(iw * scaleToFit));
			const drawH = Math.max(1, Math.round(ih * scaleToFit));

			// Anchor-based positioning with the scaled size
			const dx = centerX - selectedAnchor.x * drawW;
			const dy = centerY - selectedAnchor.y * drawH;

			// Draw the image without any shadow
			ctx.drawImage(img, 0, 0, iw, ih, dx, dy, drawW, drawH);
			drewImageMarker = true;
		} catch {
			// Fallback to circle marker if image fails to load
			drewImageMarker = false;
		}
	}

	if (!drewImageMarker) {
		// Fallback: visible circle marker (existing style)
		const r = config.marker.radius;

		// Filled circle without shadow
		ctx.beginPath();
		ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
		ctx.fillStyle = config.marker.fillColor;
		ctx.fill();

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
		ctx.textBaseline = 'alphabetic';
		ctx.textAlign = 'left';
		const metrics = ctx.measureText(attrib.text);
		const textHeight =
			(metrics.actualBoundingBoxAscent || fontSize * 0.8) +
			(metrics.actualBoundingBoxDescent || fontSize * 0.2);
		const barHeight = Math.ceil(textHeight + padY * 2);
		const barY = tileSize - barHeight;

		// Background with opacity
		ctx.save();
		const prevAlpha = ctx.globalAlpha;
		ctx.globalAlpha = Math.max(0, Math.min(1, attrib.opacity ?? 0.5));
		ctx.fillStyle = attrib.backgroundColor || '#000000';
		ctx.fillRect(0, barY, tileSize, barHeight);
		ctx.globalAlpha = prevAlpha;

		// Text
		ctx.fillStyle = attrib.textColor || '#FFFFFF';
		const textY =
			barY + padY + (metrics.actualBoundingBoxAscent || fontSize * 0.8);
		ctx.fillText(attrib.text, padX, textY);
		ctx.restore();
	}

	return canvas.toBuffer('image/png');
}
