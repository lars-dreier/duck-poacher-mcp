import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
	assertCrossPageSnapshot,
	assertHttpUrl,
	connectTestClient,
	NETWORK_TIMEOUT_MS,
	parseToolResult,
	TEST_QUERY
} from './TestHelper.ts';

const PAGE_SIZE = 10;

describe('DuckPoacherServer', () => {
	let client: Client;
	let close: () => Promise<void>;

	before(async () => {
		({ client, close } = await connectTestClient());
	});

	after(async () => {
		await close();
	});

	describe('tool registration', () => {
		it('exposes web_search and image_search', async () => {
			// Given a connected client
			// When it lists the server's tools
			const { tools } = await client.listTools();

			// Then both search tools are advertised
			const names = tools.map((tool) => tool.name);
			assert.ok(names.includes('web_search'), 'web_search should be registered');
			assert.ok(names.includes('image_search'), 'image_search should be registered');
		});
	});

	describe('web_search', () => {
		it('returns a first page of shaped results with pagination metadata', { timeout: NETWORK_TIMEOUT_MS }, async () => {
			// Given a result-rich query
			// When web_search is called without a page
			const result = await client.callTool({ name: 'web_search', arguments: { query: TEST_QUERY } });

			// Then the payload is the first page envelope of shaped results
			const payload = parseToolResult(result);
			assert.equal(payload.page, 1);
			assert.equal(payload.pageSize, PAGE_SIZE);
			assert.ok(payload.totalResults > 0, 'should return at least one result');
			assert.ok(payload.results.length > 0 && payload.results.length <= PAGE_SIZE, 'page holds up to PAGE_SIZE');
			assert.equal(typeof payload.totalPages, 'number');
			assert.equal(typeof payload.hasMore, 'boolean');
			for (const entry of payload.results as { title: unknown; url: unknown; description: unknown }[]) {
				assert.equal(typeof entry.title, 'string');
				assert.equal(typeof entry.description, 'string');
				assertHttpUrl(entry.url, 'web result url');
			}
		});

		it('paginates a multi-page result set from one cached snapshot', { timeout: NETWORK_TIMEOUT_MS }, async () => {
			// Given the same generic cache + paginate path as image_search
			// When the query spans more than one page (no-ops while the dependency caps at one)
			// Then page two shares the snapshot and does not repeat page-one results
			await assertCrossPageSnapshot(client, 'web_search', (entry) => entry.url);
		});
	});

	describe('image_search', () => {
		it('returns a first page with absolute image and thumbnail URLs', { timeout: NETWORK_TIMEOUT_MS }, async () => {
			// Given a result-rich query with a filter applied
			// When image_search is called
			const result = await client.callTool({
				name: 'image_search',
				arguments: { query: TEST_QUERY, size: 'Large', safeSearch: true }
			});

			// Then the payload is the first page envelope of shaped results
			const payload = parseToolResult(result);
			assert.equal(payload.page, 1);
			assert.ok(payload.totalResults > 0, 'should return at least one result');
			assert.ok(payload.results.length > 0 && payload.results.length <= PAGE_SIZE, 'page holds up to PAGE_SIZE');
			for (const entry of payload.results as { imageUrl: unknown; thumbnailUrl: unknown }[]) {
				assertHttpUrl(entry.imageUrl, 'image url');
				assertHttpUrl(entry.thumbnailUrl, 'thumbnail url');
			}
		});

		it('serves a second page from the same cached snapshot', { timeout: NETWORK_TIMEOUT_MS }, async () => {
			// Given an image query that spans many pages
			// When page two is requested
			// Then it shares the snapshot and does not repeat page-one results
			await assertCrossPageSnapshot(client, 'image_search', (entry) => entry.imageUrl);
		});
	});
});
