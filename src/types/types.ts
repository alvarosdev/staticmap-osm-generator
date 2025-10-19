export interface LatLonToTileResult {
  xtile: number;
  ytile: number;
  xtileFloat: number;
  ytileFloat: number;
  xPx: number;
  yPx: number;
}

export interface TileInfo {
  image: any; // Canvas Image
  drawX: number;
  drawY: number;
}

export interface GenerateTileParams {
  lat: number;
  lon: number;
  zoom: number;
}

export interface MarkerConfig {
  radius: number;
  fillColor: string;
  borderColor: string;
  shadowColor: string;
  crossColor: string;
}

export interface Config {
  port: number;
  assetsDir: string;
  tileSize: number;
  osmBaseUrl: string;
  marker: MarkerConfig;
  maxZoom: number;
  minZoom: number;
}
