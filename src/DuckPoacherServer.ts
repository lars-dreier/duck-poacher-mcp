import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type DdgSearchOptions, DuckDuckGo, type ImageSearchResult, type WebSearchResult } from 'duck-poacher';
import { z } from 'zod';
import Page from './Page.ts';
import QueryCache from './QueryCache.ts';
import ToolResult from './ToolResult.ts';

const PAGE_DESCRIPTION = '1-based page number; 10 results per page.';

const WEB_SEARCH_OBJECT = z.object({
	query: z.string().min(1).describe('The search terms to look up on DuckDuckGo.'),
	page: z.number().int().min(1).optional().default(1).describe(PAGE_DESCRIPTION)
});

const IMAGE_SEARCH_OBJECT = z.object({
	query: z.string().min(1).describe('The search terms to look up on DuckDuckGo.'),
	page: z.number().int().min(1).optional().default(1).describe(PAGE_DESCRIPTION),
	time: z.enum(['Day', 'Week', 'Month']).optional().describe('Restrict results to the last day, week, or month.'),
	size: z.enum(['Small', 'Medium', 'Large', 'Wallpaper']).optional().describe('Filter by image size.'),
	color: z.enum(['color', 'Monochrome']).optional().describe('Filter by color or monochrome images.'),
	type: z.enum(['photo', 'clipart', 'gif', 'transparent', 'line']).optional().describe('Filter by image type.'),
	layout: z.enum(['Square', 'Tall', 'Wide']).optional().describe('Filter by image orientation.'),
	license: z.enum(['Any', 'Public']).optional().describe('Filter by license.'),
	safeSearch: z.boolean().optional().describe('Enable or disable safe search.')
});

const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;
const PAGE_SIZE = 10;

// MCP server exposing DuckDuckGo web and image search as cached, paginated tools.
export default class DuckPoacherServer {
	private readonly _ddg = new DuckDuckGo();
	private readonly _server: McpServer;
	private readonly _webCache = new QueryCache<WebSearchResult>(CACHE_TTL_MS, CACHE_MAX_ENTRIES);
	private readonly _imageCache = new QueryCache<ImageSearchResult>(CACHE_TTL_MS, CACHE_MAX_ENTRIES);

	public constructor(name: string, version: string) {
		this._server = new McpServer({ name, version });
		this.registerTools();
	}

	public async connect(transport: Parameters<McpServer['connect']>[0]): Promise<void> {
		await this._server.connect(transport);
	}

	private registerTools(): void {
		this._server.registerTool(
			'web_search',
			{
				title: 'DuckDuckGo web search',
				description:
					'Search the web via DuckDuckGo. Returns a page of results, each with a title, URL, and description, plus pagination metadata. Results are cached for an hour; request later pages of the same query with `page` to read more without re-searching.',
				inputSchema: WEB_SEARCH_OBJECT.shape
			},
			async ({ query, page }) =>
				(await this.serve(this._webCache, { query }, page, () => this._ddg.webSearch(query))).toCallResult()
		);

		this._server.registerTool(
			'image_search',
			{
				title: 'DuckDuckGo image search',
				description:
					'Search for images via DuckDuckGo. Returns a page of results, each with an image URL and a thumbnail URL, plus pagination metadata. Supports optional filters for time, size, color, type, layout, and license. Results are cached for an hour; request later pages of the same query and filters with `page` to read more without re-searching.',
				inputSchema: IMAGE_SEARCH_OBJECT.shape
			},
			async ({ query, page, ...filters }) =>
				(await this.serve(
					this._imageCache,
					{ query, ...filters },
					page,
					() => this._ddg.imageSearch(query, this.toImageOptions(filters))
				)).toCallResult()
		);
	}

	private toImageOptions(filters: Omit<z.infer<typeof IMAGE_SEARCH_OBJECT>, 'query' | 'page'>): DdgSearchOptions {
		const options: DdgSearchOptions = {};
		if (filters.time !== undefined) {
			options.time = filters.time;
		}
		if (filters.size !== undefined) {
			options.size = filters.size;
		}
		if (filters.color !== undefined) {
			options.color = filters.color;
		}
		if (filters.type !== undefined) {
			options.type = filters.type;
		}
		if (filters.layout !== undefined) {
			options.layout = filters.layout;
		}
		if (filters.license !== undefined) {
			options.license = filters.license;
		}
		if (filters.safeSearch !== undefined) {
			options.safeSearch = filters.safeSearch;
		}
		return options;
	}

	private async serve<T>(
		cache: QueryCache<T>,
		payload: unknown,
		page: number,
		search: () => Promise<T[]>,
	): Promise<ToolResult> {
		let results = cache.get(payload);
		if (results === undefined) {
			try {
				results = await search();
			}
			catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return ToolResult.error(`Search failed: ${message}`);
			}
			cache.set(payload, results);
		}
		return ToolResult.text(JSON.stringify(new Page(results, page, PAGE_SIZE), null, 2));
	}
}
