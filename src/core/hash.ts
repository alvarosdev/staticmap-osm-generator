/**
 * Generates a SHA-256 hash from parameters including output scale.
 * Uses Bun.CryptoHasher for optimal performance (synchronous, no allocations).
 */
export function generateHash(
	zoom: number,
	lat: number,
	lon: number,
	markerName?: string,
	anchorName?: string,
	scale: number = 1
): string {
	const marker = markerName || '';
	const anchor = anchorName || '';
	const input = `${zoom}|${lat}|${lon}|${marker}|${anchor}|s${scale}`;
	const hasher = new Bun.CryptoHasher('sha256');
	hasher.update(input);
	return hasher.digest('hex');
}
