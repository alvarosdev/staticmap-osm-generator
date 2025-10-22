import type { Image } from 'canvas';

export interface LatLonToTileResult {
	xtile: number;
	ytile: number;
	xtileFloat: number;
	ytileFloat: number;
	xPx: number;
	yPx: number;
}

export interface TileInfo {
	image: Image; // Canvas Image
	drawX: number;
	drawY: number;
}

export interface GenerateTileParams {
	lat: number;
	lon: number;
	zoom: number;
	markerName?: string;
	anchorName?: string;
	outputScale?: number;
}

export interface MarkerConfig {
	radius: number;
	fillColor: string;
	borderColor: string;
	crossColor: string;
}

export interface AnchorDefinition {
	name: string; // e.g., "center", "bottom-center"
	// normalized anchor within the marker image: (0,0)=top-left, (1,1)=bottom-right
	x: number;
	y: number;
}

export interface MarkerImageDefinition {
	name: string; // human-friendly name, e.g., "blue_pin"
	file: string; // relative path, e.g., "markers/pin.png"
	anchor: string; // name of a defined anchor
	fit?: 'contain' | 'cover'; // optional resizing mode when rendering
}

export interface CacheConfig {
	maxSize: number;
	ttlMinutes: number;
}

export interface CorsConfig {
	enabled: boolean;
	allowedOrigins: string;
	allowedMethods: string;
	allowedHeaders: string;
	maxAge: number;
}

export interface AttributionConfig {
	enabled?: boolean;
	text: string;
	backgroundColor: string;
	textColor: string;
	opacity: number;
}

export interface Config {
	port: number;
	cacheDir: string;
	tileSize: number;
	osmBaseUrl: string;
	marker: MarkerConfig;
	maxZoom: number;
	minZoom: number;
	// Custom marker images and anchors
	anchors: AnchorDefinition[];
	markers: MarkerImageDefinition[];
	defaultMarker: string; // name of default marker image; if not set, fallback to circle
	defaultAnchor: string; // name of default anchor to use when not specified
	cache?: CacheConfig;
	cors?: CorsConfig;
	attribution?: AttributionConfig;
}
