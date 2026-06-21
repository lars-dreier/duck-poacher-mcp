import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import CacheEntry from '../src/CacheEntry.ts';

const TTL_MS = 60 * 60 * 1000;

describe('CacheEntry', () => {
	describe('isExpired', () => {
		it('is not expired before the TTL has elapsed', () => {
			// Given an entry stored at time 0
			const entry = new CacheEntry(['a'], 0);

			// When checked partway through its lifetime
			// Then it is still fresh
			assert.equal(entry.isExpired(TTL_MS - 1, TTL_MS), false);
		});

		it('is not expired exactly at the TTL boundary', () => {
			// Given an entry stored at time 0
			const entry = new CacheEntry(['a'], 0);

			// When checked at exactly the TTL
			// Then it is still fresh
			assert.equal(entry.isExpired(TTL_MS, TTL_MS), false);
		});

		it('is expired once past the TTL', () => {
			// Given an entry stored at time 0
			const entry = new CacheEntry(['a'], 0);

			// When checked just past the TTL
			// Then it is expired
			assert.equal(entry.isExpired(TTL_MS + 1, TTL_MS), true);
		});
	});
});
