import { logger } from '@/server/logger.js';
import { getTileCache } from './tileCache.js';

/**
 * Rate limiter for OSM tile requests
 */
class RateLimiter {
	private queue: Array<() => void> = [];
	private activeRequests = 0;
	private lastRequestTime = 0;
	private readonly maxConcurrent: number;
	private readonly minDelay: number; // milliseconds between requests

	constructor(maxConcurrent: number = 2, requestsPerSecond: number = 2) {
		this.maxConcurrent = maxConcurrent;
		this.minDelay = 1000 / requestsPerSecond;
	}

	async execute<T>(fn: () => Promise<T>): Promise<T> {
		// Wait for rate limit
		await this.waitForSlot();

		this.activeRequests++;
		try {
			return await fn();
		} finally {
			this.activeRequests--;
			this.processQueue();
		}
	}

	private async waitForSlot(): Promise<void> {
		// If we're at max concurrent requests, queue this request
		if (this.activeRequests >= this.maxConcurrent) {
			await new Promise<void>((resolve) => {
				this.queue.push(resolve);
			});
		}

		// Enforce minimum delay between requests
		const now = Date.now();
		const timeSinceLastRequest = now - this.lastRequestTime;
		if (timeSinceLastRequest < this.minDelay) {
			await new Promise((resolve) =>
				setTimeout(resolve, this.minDelay - timeSinceLastRequest)
			);
		}
		this.lastRequestTime = Date.now();
	}

	private processQueue(): void {
		if (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
			const resolve = this.queue.shift();
			if (resolve) resolve();
		}
	}
}

const rateLimiter = new RateLimiter(2, 2); // Max 2 concurrent, 2 req/sec

/**
 * Fetch a tile with retry logic and exponential backoff
 */
async function fetchWithRetry(
	url: string,
	maxRetries: number = 3,
	baseDelay: number = 1000
): Promise<Buffer> {
	let lastError: Error | null = null;

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

			const res = await fetch(url, {
				signal: controller.signal,
				headers: {
					'User-Agent':
						'staticmap-osm-generator/1.0 (+https://github.com/alvarosdev/staticmap-osm-generator)',
				},
			});

			clearTimeout(timeoutId);

			if (!res.ok) {
				// Don't retry on 4xx errors (client errors)
				if (res.status >= 400 && res.status < 500) {
					throw new Error(`HTTP ${res.status}: ${url}`);
				}
				throw new Error(`HTTP ${res.status}: ${url}`);
			}

			return Buffer.from(await res.arrayBuffer());
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			// Don't retry if it's an abort (timeout)
			if (lastError.name === 'AbortError') {
				logger.warn({ url, attempt }, 'Request timeout');
			} else {
				logger.warn(
					{ url, attempt, error: lastError.message },
					'Tile fetch failed'
				);
			}

			// Wait before retrying (exponential backoff)
			if (attempt < maxRetries - 1) {
				const delay = baseDelay * 2 ** attempt;
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
	}

	throw (
		lastError || new Error(`Failed to fetch tile after ${maxRetries} attempts`)
	);
}

/**
 * Fetch a tile with caching and rate limiting
 */
export async function fetchTile(
	zoom: number,
	x: number,
	y: number,
	osmBaseUrl: string
): Promise<Buffer> {
	// Check cache first
	const cached = getTileCache().get(zoom, x, y);
	if (cached) {
		logger.debug({ zoom, x, y }, 'Tile cache hit');
		return cached;
	}

	// Fetch with rate limiting
	const tileURL = `${osmBaseUrl}/${zoom}/${x}/${y}.png`;

	const buffer = await rateLimiter.execute(async () => {
		logger.debug({ zoom, x, y, url: tileURL }, 'Fetching tile from OSM');
		return await fetchWithRetry(tileURL);
	});

	// Store in cache
	getTileCache().set(zoom, x, y, buffer);

	return buffer;
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
	return getTileCache().getStats();
}
