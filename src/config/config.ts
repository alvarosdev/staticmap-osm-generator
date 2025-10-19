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
};

export async function loadConfig(): Promise<void> {
  try {
    const configText = await Bun.file("config.yaml").text();
    const config: Config = YAML.parse(configText) as Config;
    // Override with env vars if present
    config.port = parseInt(Bun.env.PORT || config.port.toString(), 10);
    config.assetsDir = Bun.env.ASSETS_DIR || config.assetsDir;
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
    };
  }
}
