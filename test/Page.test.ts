import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Page from '../src/Page.ts';

const PAGE_SIZE = 10;
const range = (count: number): number[] => Array.from({ length: count }, (_, index) => index);

describe('Page', () => {
	describe('a full first page', () => {
		it('carries the first slice with totals and hasMore set', () => {
			// Given more results than fit on one page
			const page = new Page(range(25), 1, PAGE_SIZE);

			// Then it carries the first slice and reports more pages follow
			assert.deepEqual(page.results, range(10));
			assert.equal(page.page, 1);
			assert.equal(page.pageSize, PAGE_SIZE);
			assert.equal(page.totalResults, 25);
			assert.equal(page.totalPages, 3);
			assert.equal(page.hasMore, true);
		});
	});

	describe('the last partial page', () => {
		it('carries the remaining results and clears hasMore', () => {
			// Given 25 results split into pages of 10
			const page = new Page(range(25), 3, PAGE_SIZE);

			// Then it carries the trailing 5 results and no more follow
			assert.deepEqual(page.results, [20, 21, 22, 23, 24]);
			assert.equal(page.hasMore, false);
		});
	});

	describe('a page past the end', () => {
		it('is an empty slice rather than an error', () => {
			// Given results that fill a single page
			const page = new Page(range(5), 4, PAGE_SIZE);

			// Then the slice is empty and nothing more follows
			assert.deepEqual(page.results, []);
			assert.equal(page.totalPages, 1);
			assert.equal(page.hasMore, false);
		});
	});

	describe('an exact page multiple', () => {
		it('computes totalPages without an empty trailing page', () => {
			// Given exactly two pages' worth of results
			const page = new Page(range(20), 2, PAGE_SIZE);

			// Then there are two pages and the second is the last
			assert.equal(page.totalPages, 2);
			assert.equal(page.hasMore, false);
			assert.equal(page.results.length, 10);
		});
	});

	describe('an empty result set', () => {
		it('is a single empty page', () => {
			// Given no results
			const page = new Page([], 1, PAGE_SIZE);

			// Then there is a single empty page
			assert.deepEqual(page.results, []);
			assert.equal(page.totalResults, 0);
			assert.equal(page.totalPages, 1);
			assert.equal(page.hasMore, false);
		});
	});
});
