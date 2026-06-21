import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import QueryCache from '../src/cache/QueryCache.ts';

const TTL_MS = 60 * 60 * 1000;

/** A QueryCache wired to a clock the test advances by hand, so TTL is deterministic. */
function cacheWithClock(maxEntries = 100): { cache: QueryCache<string>; advance: (ms: number) => void } {
	let now = 0;
	const cache = new QueryCache<string>(TTL_MS, maxEntries, () => now);
	return {
		cache,
		advance: (ms: number) => {
			now += ms;
		}
	};
}

describe('QueryCache', () => {
	describe('get', () => {
		it('returns undefined for a payload that was never cached', () => {
			// Given an empty cache
			const { cache } = cacheWithClock();

			// When an unknown payload is read
			// Then it is a miss
			assert.equal(cache.get({ query: 'node' }), undefined);
		});

		it('returns the stored results for a cached payload', () => {
			// Given a cached payload
			const { cache } = cacheWithClock();
			cache.set({ query: 'node' }, ['a', 'b']);

			// When the same payload is read
			// Then the stored array comes back
			assert.deepEqual(cache.get({ query: 'node' }), ['a', 'b']);
		});

		it('is unaffected by the key order of an object payload', () => {
			// Given a payload cached with one key order
			const { cache } = cacheWithClock();
			cache.set({ query: 'cats', size: 'Large' }, ['x']);

			// When the same payload is read with the keys in a different order
			// Then it still hits
			assert.deepEqual(cache.get({ size: 'Large', query: 'cats' }), ['x']);
		});
	});

	describe('TTL expiry', () => {
		it('drops an entry once it is older than the TTL', () => {
			// Given a cached payload
			const { cache, advance } = cacheWithClock();
			cache.set({ query: 'node' }, ['a']);

			// When time passes beyond the TTL
			advance(TTL_MS + 1);

			// Then the entry is a miss
			assert.equal(cache.get({ query: 'node' }), undefined);
		});

		it('keeps an entry that is exactly at the TTL boundary', () => {
			// Given a cached payload
			const { cache, advance } = cacheWithClock();
			cache.set({ query: 'node' }, ['a']);

			// When time passes to exactly the TTL
			advance(TTL_MS);

			// Then the entry is still a hit
			assert.deepEqual(cache.get({ query: 'node' }), ['a']);
		});
	});

	describe('separate payloads', () => {
		it('keeps entries that differ only in a filter value apart', () => {
			// Given two image queries that share a term but differ in a filter
			const { cache } = cacheWithClock();
			cache.set({ query: 'cats', size: 'Large' }, ['large']);
			cache.set({ query: 'cats', size: 'Small' }, ['small']);

			// When each is read back
			// Then they do not collide
			assert.deepEqual(cache.get({ query: 'cats', size: 'Large' }), ['large']);
			assert.deepEqual(cache.get({ query: 'cats', size: 'Small' }), ['small']);
		});
	});

	describe('max-entry cap', () => {
		it('evicts the oldest entry when the cap is exceeded', () => {
			// Given a cache at its two-entry cap
			const { cache } = cacheWithClock(2);
			cache.set({ query: 'first' }, ['1']);
			cache.set({ query: 'second' }, ['2']);

			// When a third distinct payload is cached
			cache.set({ query: 'third' }, ['3']);

			// Then the oldest is gone and the two newest remain
			assert.equal(cache.get({ query: 'first' }), undefined);
			assert.deepEqual(cache.get({ query: 'second' }), ['2']);
			assert.deepEqual(cache.get({ query: 'third' }), ['3']);
		});
	});
});
