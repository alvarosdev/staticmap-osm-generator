import { YAML } from 'bun';
import type { Config } from "@/types/types.js";

const CONFIG_FILE = "config.yaml";

export const DEFAULT_CONFIG: Config = {
  port: 3000,
  cacheDir: "cache",
  tileSize: 256,
  osmBaseUrl: "https://tile.openstreetmap.org",
  marker: {
    radius: 8,
    fillColor: "#e53935",
    borderColor: "black",
    shadowColor: "rgba(255, 255, 255, 0.13)",
    crossColor: "white",
  },
  maxZoom: 20,
  minZoom: 0,
  imageMarkerShadow: {
    enabled: true,
    color: "rgba(0, 0, 0, 0.35)",
    blur: 6,
    offsetX: 0,
    offsetY: 2,
  },
  anchors: [
    { name: "center", x: 0.5, y: 0.5 },
    { name: "top-left", x: 0, y: 0 },
    { name: "top-center", x: 0.5, y: 0 },
    { name: "top-right", x: 1, y: 0 },
    { name: "bottom-left", x: 0, y: 1 },
    { name: "bottom-center", x: 0.5, y: 1 },
    { name: "bottom-right", x: 1, y: 1 },
    { name: "left-center", x: 0, y: 0.5 },
    { name: "right-center", x: 1, y: 0.5 },
    // alias
    { name: "bottom", x: 0.5, y: 1 },
  ],
  markers: [
    { name: "pin", file: "assets/markers/pin.png", anchor: "bottom-left" },
  ],
  defaultMarker: "pin",
  defaultAnchor: "center",
  cors: {
    enabled: true,
    allowedOrigins: "*",
    allowedMethods: "GET, OPTIONS",
    allowedHeaders: "Content-Type",
    maxAge: 86400,
  },
  attribution: {
    enabled: true,
    text: "© OpenStreetMap",
    backgroundColor: "#000000",
    textColor: "#FFFFFF",
    opacity: 0.5,
  },
};

export let CONFIG: Config = DEFAULT_CONFIG;

function deepFreeze<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  const propNames = Object.getOwnPropertyNames(obj);
  for (const name of propNames) {
    const value = (obj as any)[name];
    deepFreeze(value);
  }
  return Object.freeze(obj);
}

function deepMerge<T>(base: T, override: Partial<T>): T {
  // Simple deep merge: objects are merged, arrays are replaced by override if provided
  if (override == null) return base as T;
  const result: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const key of Object.keys(override as any)) {
    const oVal: any = (override as any)[key];
    const bVal: any = (result as any)[key];
    if (oVal === undefined || oVal === null) continue;
    if (Array.isArray(oVal)) {
      result[key] = oVal.slice();
    } else if (typeof oVal === 'object' && typeof bVal === 'object' && !Array.isArray(bVal)) {
      result[key] = deepMerge(bVal, oVal);
    } else {
      result[key] = oVal;
    }
  }
  return result as T;
}

function applyEnv(over: Config): Config {
  const cfg = { ...over };
  cfg.port = parseInt(Bun.env.PORT || cfg.port.toString(), 10);
  cfg.cacheDir = Bun.env.CACHE_DIR || cfg.cacheDir;
  if (cfg.cors) {
    cfg.cors = { ...cfg.cors };
    const corsEnabled = Bun.env.CORS_ENABLED;
    if (typeof corsEnabled === 'string') {
      cfg.cors.enabled = !(corsEnabled.toLowerCase() === 'false' || corsEnabled === '0');
    }
    cfg.cors.allowedOrigins = Bun.env.CORS_ALLOWED_ORIGINS || cfg.cors.allowedOrigins;
    cfg.cors.allowedMethods = Bun.env.CORS_ALLOWED_METHODS || cfg.cors.allowedMethods;
    cfg.cors.allowedHeaders = Bun.env.CORS_ALLOWED_HEADERS || cfg.cors.allowedHeaders;
    cfg.cors.maxAge = parseInt(Bun.env.CORS_MAX_AGE || cfg.cors.maxAge.toString(), 10);
  }
  return cfg;
}

function normalizeConfig(cfg: Config): Config {
  const normalized: Config = { ...cfg } as Config;
  const anchorNames = new Set(normalized.anchors.map(a => a.name));
  if (!normalized.defaultAnchor || !anchorNames.has(normalized.defaultAnchor)) {
    normalized.defaultAnchor = DEFAULT_CONFIG.defaultAnchor ?? 'center';
  }

  const markerNames = new Set(normalized.markers.map(m => m.name));
  if (!normalized.defaultMarker || !markerNames.has(normalized.defaultMarker)) {
    const fallback = DEFAULT_CONFIG.defaultMarker || 'pin';
    normalized.defaultMarker = normalized.markers[0]?.name || fallback;
  }

  // Normalize attribution
  if (!normalized.attribution) {
    normalized.attribution = { ...DEFAULT_CONFIG.attribution } as any;
  } else {
    const a = { ...DEFAULT_CONFIG.attribution, ...normalized.attribution } as any;
    // clamp opacity
    const op = typeof a.opacity === 'number' ? a.opacity : DEFAULT_CONFIG.attribution!.opacity;
    a.opacity = Math.max(0, Math.min(1, op));
    // default enabled true unless explicitly false
    a.enabled = a.enabled === false ? false : true;
    normalized.attribution = a;
  }

  return normalized;
}

export async function loadConfig(): Promise<void> {
  try {
    const file = Bun.file(CONFIG_FILE);
    const text = await file.text();
    let parsed: Partial<Config> = {};
    try {
      parsed = (YAML.parse(text) as Partial<Config>) || {};
    } catch (parseErr) {
      console.error(`Invalid YAML in ${CONFIG_FILE}, using defaults:`, parseErr);
      parsed = {};
    }
    const merged = deepMerge(DEFAULT_CONFIG, parsed);
    CONFIG = applyEnv(normalizeConfig(merged));
    deepFreeze(CONFIG);
  } catch (error) {
    console.error(`Failed to load ${CONFIG_FILE}, using defaults:`, error);
    CONFIG = applyEnv(normalizeConfig(DEFAULT_CONFIG));
    deepFreeze(CONFIG);
  }
}

// Freeze DEFAULT_CONFIG to avoid accidental mutation at runtime
deepFreeze(DEFAULT_CONFIG);
