import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import assert from 'node:assert/strict';
import DuckPoacherServer from '../src/DuckPoacherServer.ts';

/**
 * A stable, result-rich query so the live DuckDuckGo calls return reliably
 * non-empty results across runs. Assert on shape, never on these contents.
 */
export const TEST_QUERY = 'node.js';

/** Per-request budget for the live specs (token/URL mint + search are sequential). */
export const NETWORK_TIMEOUT_MS = 30_000;

/** Asserts a value is a non-empty absolute http(s) URL. */
export function assertHttpUrl(value: unknown, label: string): void {
	assert.equal(typeof value, 'string', `${label} should be a string`);
	assert.match(value as string, /^https?:\/\//, `${label} should be an absolute http(s) URL`);
}

/**
 * Spins up a DuckPoacherServer wired to an MCP client over a linked in-memory
 * transport pair, so specs exercise the full path (tool registration → handler →
 * duck-poacher) the way a real client would. Call `close` when done.
 */
export async function connectTestClient(): Promise<{ client: Client; close: () => Promise<void> }> {
	const server = new DuckPoacherServer('duck-poacher-mcp', '0.0.0-test');
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	const client = new Client({ name: 'test-client', version: '0.0.0-test' });

	await server.connect(serverTransport);
	await client.connect(clientTransport);

	return {
		client,
		close: async (): Promise<void> => {
			await client.close();
		}
	};
}

/** The pagination envelope the handlers serialize as the tool result text. */
export type PaginatedPayload = {
	page: number;
	pageSize: number;
	totalResults: number;
	totalPages: number;
	hasMore: boolean;
	results: unknown[];
};

/**
 * Asserts a tool result is a successful single text block and returns its parsed
 * JSON payload — the pagination envelope the handlers serialize (a page of results
 * plus metadata).
 */
export function parseToolResult(result: unknown): PaginatedPayload {
	const { isError, content } = result as { isError?: unknown; content?: unknown };
	assert.notEqual(isError, true, 'tool result should not be an error');
	assert.ok(Array.isArray(content), 'content should be an array');
	const block = content[0] as { type?: string; text?: string } | undefined;
	assert.ok(block, 'content should have at least one block');
	assert.equal(block.type, 'text', 'first content block should be text');
	assert.equal(typeof block.text, 'string', 'text block should carry a string');

	const parsed = JSON.parse(block.text as string) as PaginatedPayload;
	assert.ok(Array.isArray(parsed.results), 'payload should carry a results array');
	return parsed;
}

/**
 * Asserts cross-page behavior for a search tool: the second page comes from the
 * same cached snapshot (identical `totalResults`) and does not repeat any
 * first-page result. Data-adaptive on purpose — if the live dependency currently
 * returns a single page (`hasMore` false), there is no second page to exercise, so
 * it no-ops. The day the dependency returns more, the same spec exercises real
 * pagination with no test change. The page math itself is covered offline in
 * paginate.test.ts. `identity` extracts a result's dedup key (e.g. its URL).
 */
export async function assertCrossPageSnapshot(
	client: Client,
	toolName: string,
	identity: (entry: Record<string, unknown>) => unknown,
): Promise<void> {
	const first = parseToolResult(await client.callTool({ name: toolName, arguments: { query: TEST_QUERY } }));
	if (!first.hasMore) {
		return;
	}

	const second = parseToolResult(
		await client.callTool({ name: toolName, arguments: { query: TEST_QUERY, page: 2 } })
	);
	assert.equal(second.page, 2);
	assert.equal(second.totalResults, first.totalResults, 'both pages come from one cached snapshot');

	const firstIds = new Set((first.results as Record<string, unknown>[]).map(identity));
	for (const entry of second.results as Record<string, unknown>[]) {
		assert.ok(!firstIds.has(identity(entry)), 'second page should not repeat first-page results');
	}
}
