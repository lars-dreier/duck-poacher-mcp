import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { assertHttpUrl, connectTestClient, NETWORK_TIMEOUT_MS, parseToolResults, TEST_QUERY } from './TestHelper.ts';

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
		it('returns results with a title, absolute URL, and description', { timeout: NETWORK_TIMEOUT_MS }, async () => {
			// Given a result-rich query
			// When web_search is called
			const result = await client.callTool({ name: 'web_search', arguments: { query: TEST_QUERY } });

			// Then the payload is a non-empty array of shaped results
			const results = parseToolResults(result) as { title: unknown; url: unknown; description: unknown }[];
			assert.ok(results.length > 0, 'should return at least one result');
			for (const entry of results) {
				assert.equal(typeof entry.title, 'string');
				assert.equal(typeof entry.description, 'string');
				assertHttpUrl(entry.url, 'web result url');
			}
		});
	});

	describe('image_search', () => {
		it('returns results with absolute image and thumbnail URLs', { timeout: NETWORK_TIMEOUT_MS }, async () => {
			// Given a result-rich query with a filter applied
			// When image_search is called
			const result = await client.callTool({
				name: 'image_search',
				arguments: { query: TEST_QUERY, size: 'Large', safeSearch: true }
			});

			// Then the payload is a non-empty array of shaped results
			const results = parseToolResults(result) as { imageUrl: unknown; thumbnailUrl: unknown }[];
			assert.ok(results.length > 0, 'should return at least one result');
			for (const entry of results) {
				assertHttpUrl(entry.imageUrl, 'image url');
				assertHttpUrl(entry.thumbnailUrl, 'thumbnail url');
			}
		});
	});
});
