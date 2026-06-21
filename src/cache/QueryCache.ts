import { createHash } from 'node:crypto';
import CacheEntry from './CacheEntry.ts';

// In-memory cache of search results keyed by query, bounded by a TTL and a
// max-entry cap.
export default class QueryCache<T> {
	private readonly _entries = new Map<string, CacheEntry<T>>();

	public constructor(
		private readonly _ttlMs: number,
		private readonly _maxEntries: number,
		// Injectable so TTL expiry is testable without real timers.
		private readonly _now: () => number = () => Date.now(),
	) {}

	// Stale entries are dropped lazily here on read; there is no background sweep.
	public get(payload: unknown): T[] | undefined {
		const key = this.createKey(payload);
		const entry = this._entries.get(key);
		if (entry === undefined) {
			return undefined;
		}
		if (entry.isExpired(this._now(), this._ttlMs)) {
			this._entries.delete(key);
			return undefined;
		}
		return entry.results;
	}

	public set(payload: unknown, results: T[]): void {
		if (this._entries.size >= this._maxEntries) {
			// Map preserves insertion order, so the first key is the oldest entry.
			const oldest = this._entries.keys().next().value;
			if (oldest !== undefined) {
				this._entries.delete(oldest);
			}
		}
		this._entries.set(this.createKey(payload), new CacheEntry(results, this._now()));
	}

	private createKey(payload: unknown): string {
		// Sort keys so a filter set in a different order maps to the same entry.
		const keys = payload !== null && typeof payload === 'object' ? Object.keys(payload).sort() : undefined;
		return createHash('md5').update(JSON.stringify(payload, keys)).digest('hex');
	}
}
