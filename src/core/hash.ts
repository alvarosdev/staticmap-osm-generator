/**
 * Generates a SHA-256 hash from zoom, lat, and lon.
 * Uses Bun.CryptoHasher for optimal performance (synchronous, no allocations).
 */
export function generateHash(zoom: number, lat: number, lon: number): string {
  const input = `${zoom}${lat}${lon}`;
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(input);
  return hasher.digest("hex");
}
