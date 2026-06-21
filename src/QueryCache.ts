import { createHash } from 'node:crypto';

// A snapshot of one query's full result array plus when it was cached, so reads
// can lazily drop stale entries without a background sweep.
type CacheEntry<T> = {
	results: T[];
	createdAt: number;
};

// In-memory, per-query result cache for the long-lived stdio server. Memory is
// bounded two ways: a per-key TTL check on read evicts stale entries, and a hard
// max-entry cap evicts the oldest on write. Both reads and writes are O(1), so
// there is no full-cache sweep. `_now` is injectable so TTL expiry is testable
// without timers.
export default class QueryCache<T> {
	private readonly _entries = new Map<string, CacheEntry<T>>();

	public constructor(
		private readonly _ttlMs: number,
		private readonly _maxEntries: number,
		private readonly _now: () => number = () => Date.now(),
	) {}

	public get(payload: unknown): T[] | undefined {
		const key = this.createKey(payload);
		const entry = this._entries.get(key);
		if (entry === undefined) {
			return undefined;
		}
		if (this._now() - entry.createdAt > this._ttlMs) {
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
		this._entries.set(this.createKey(payload), { results, createdAt: this._now() });
	}

	private createKey(payload: unknown): string {
		// Sort keys so a filter set in a different order maps to the same entry.
		const keys = payload !== null && typeof payload === 'object' ? Object.keys(payload).sort() : undefined;
		return createHash('md5').update(JSON.stringify(payload, keys)).digest('hex');
	}
}
