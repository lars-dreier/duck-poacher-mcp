import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { paginate } from '../src/paginate.ts';

const PAGE_SIZE = 10;
const range = (count: number): number[] => Array.from({ length: count }, (_, index) => index);

describe('paginate', () => {
	describe('a full first page', () => {
		it('returns the first slice with totals and hasMore set', () => {
			// Given more results than fit on one page
			const results = range(25);

			// When the first page is requested
			const result = paginate(results, 1, PAGE_SIZE);

			// Then it carries the first slice and reports more pages follow
			assert.deepEqual(result.results, range(10));
			assert.equal(result.page, 1);
			assert.equal(result.pageSize, PAGE_SIZE);
			assert.equal(result.totalResults, 25);
			assert.equal(result.totalPages, 3);
			assert.equal(result.hasMore, true);
		});
	});

	describe('the last partial page', () => {
		it('returns the remaining results and clears hasMore', () => {
			// Given 25 results split into pages of 10
			const results = range(25);

			// When the last page is requested
			const result = paginate(results, 3, PAGE_SIZE);

			// Then it carries the trailing 5 results and no more follow
			assert.deepEqual(result.results, [20, 21, 22, 23, 24]);
			assert.equal(result.hasMore, false);
		});
	});

	describe('a page past the end', () => {
		it('returns an empty slice rather than erroring', () => {
			// Given results that fill a single page
			const results = range(5);

			// When a page beyond the last is requested
			const result = paginate(results, 4, PAGE_SIZE);

			// Then the slice is empty and nothing more follows
			assert.deepEqual(result.results, []);
			assert.equal(result.totalPages, 1);
			assert.equal(result.hasMore, false);
		});
	});

	describe('an exact page multiple', () => {
		it('computes totalPages without an empty trailing page', () => {
			// Given exactly two pages' worth of results
			const results = range(20);

			// When the last page is requested
			const result = paginate(results, 2, PAGE_SIZE);

			// Then there are two pages and the second is the last
			assert.equal(result.totalPages, 2);
			assert.equal(result.hasMore, false);
			assert.equal(result.results.length, 10);
		});
	});

	describe('an empty result set', () => {
		it('reports one page with no results', () => {
			// Given no results
			// When the first page is requested
			const result = paginate([], 1, PAGE_SIZE);

			// Then there is a single empty page
			assert.deepEqual(result.results, []);
			assert.equal(result.totalResults, 0);
			assert.equal(result.totalPages, 1);
			assert.equal(result.hasMore, false);
		});
	});
});
