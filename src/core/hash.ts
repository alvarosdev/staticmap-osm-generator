/**
 * Generates a SHA-256 hash from zoom, lat, and lon.
 */
export async function generateHash(zoom: number, lat: number, lon: number): Promise<string> {
  const input = `${zoom}${lat}${lon}`;
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
