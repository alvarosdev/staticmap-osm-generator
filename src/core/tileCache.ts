/**
 * In-memory LRU cache for OSM tiles
 */

interface CacheEntry {
  buffer: Buffer;
  timestamp: number;
}

export class TileCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize: number = 1000, ttlMinutes: number = 60) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000;
  }

  /**
   * Generate cache key for a tile
   */
  private getCacheKey(zoom: number, x: number, y: number): string {
    return `${zoom}/${x}/${y}`;
  }

  /**
   * Get tile from cache if available and not expired
   */
  get(zoom: number, x: number, y: number): Buffer | null {
    const key = this.getCacheKey(zoom, x, y);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.buffer;
  }

  /**
   * Store tile in cache with LRU eviction
   */
  set(zoom: number, x: number, y: number, buffer: Buffer): void {
    const key = this.getCacheKey(zoom, x, y);

    // If cache is full, remove oldest entry (first in Map)
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    // Delete and re-add to move to end (most recent)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    this.cache.set(key, {
      buffer,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all cached tiles
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

// Global cache instance (will be initialized with config)
let _tileCache: TileCache | null = null;

export function initTileCache(maxSize: number = 1000, ttlMinutes: number = 60): void {
  _tileCache = new TileCache(maxSize, ttlMinutes);
}

export function getTileCache(): TileCache {
  if (!_tileCache) {
    // Fallback to default if not initialized
    _tileCache = new TileCache();
  }
  return _tileCache;
}
