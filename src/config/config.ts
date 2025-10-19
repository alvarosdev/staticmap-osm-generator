import { YAML } from 'bun';
import type { Config } from "@/types/types.js";

export let CONFIG: Config = {
  port: 3000,
  assetsDir: "assets",
  tileSize: 256,
  osmBaseUrl: "https://tile.openstreetmap.org",
  marker: {
    radius: 8,
    fillColor: "#e53935",
    borderColor: "black",
    shadowColor: "rgba(255,255,255,0.9)",
    crossColor: "white",
  },
  maxZoom: 20,
  minZoom: 0,
  cors: {
    enabled: true,
    allowedOrigins: "*",
    allowedMethods: "GET, OPTIONS",
    allowedHeaders: "Content-Type",
    maxAge: 86400,
  },
};

export async function loadConfig(): Promise<void> {
  try {
    const configText = await Bun.file("config.yaml").text();
    const config: Config = YAML.parse(configText) as Config;
    
    // Override with env vars if present
    config.port = parseInt(Bun.env.PORT || config.port.toString(), 10);
    config.assetsDir = Bun.env.ASSETS_DIR || config.assetsDir;
    
    // CORS configuration from env vars
    if (config.cors) {
      config.cors.enabled = Bun.env.CORS_ENABLED === "false" ? false : config.cors.enabled;
      config.cors.allowedOrigins = Bun.env.CORS_ALLOWED_ORIGINS || config.cors.allowedOrigins;
      config.cors.allowedMethods = Bun.env.CORS_ALLOWED_METHODS || config.cors.allowedMethods;
      config.cors.allowedHeaders = Bun.env.CORS_ALLOWED_HEADERS || config.cors.allowedHeaders;
      config.cors.maxAge = parseInt(Bun.env.CORS_MAX_AGE || config.cors.maxAge.toString(), 10);
    }
    
    CONFIG = config;
  } catch (error) {
    console.error("Failed to load config.yaml:", error);
    // Fallback to defaults, with env overrides
    CONFIG = {
      port: parseInt(Bun.env.PORT || "3000", 10),
      assetsDir: Bun.env.ASSETS_DIR || "assets",
      tileSize: 256,
      osmBaseUrl: "https://tile.openstreetmap.org",
      marker: {
        radius: 8,
        fillColor: "#e53935",
        borderColor: "black",
        shadowColor: "rgba(255,255,255,0.9)",
        crossColor: "white",
      },
      maxZoom: 20,
      minZoom: 0,
      cors: {
        enabled: Bun.env.CORS_ENABLED !== "false",
        allowedOrigins: Bun.env.CORS_ALLOWED_ORIGINS || "*",
        allowedMethods: Bun.env.CORS_ALLOWED_METHODS || "GET, OPTIONS",
        allowedHeaders: Bun.env.CORS_ALLOWED_HEADERS || "Content-Type",
        maxAge: parseInt(Bun.env.CORS_MAX_AGE || "86400", 10),
      },
    };
  }
}
