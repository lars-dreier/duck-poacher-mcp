/**
 * One query's cached results paired with the time they were stored.
 */
export default class CacheEntry<T> {
	public constructor(
		public readonly results: T[],
		public readonly createdAt: number,
	) {}

	public isExpired(now: number, ttlMs: number): boolean {
		return now - this.createdAt > ttlMs;
	}
}
