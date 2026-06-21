import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type DdgSearchOptions, DuckDuckGo } from 'duck-poacher';
import { z } from 'zod';

// A scraped DuckDuckGo call can fail for reasons the model should see (token
// could not be read, upstream HTTP error). MCP convention is to report those as
// a tool result with isError set, not by throwing out of the handler.
type ToolResult = {
	content: { type: 'text'; text: string }[];
	isError?: boolean;
};

const WEB_SEARCH_OBJECT = z.object({
	query: z.string().min(1).describe('The search terms to look up on DuckDuckGo.')
});

const IMAGE_SEARCH_OBJECT = z.object({
	query: z.string().min(1).describe('The search terms to look up on DuckDuckGo.'),
	time: z.enum(['Day', 'Week', 'Month']).optional().describe('Restrict results to the last day, week, or month.'),
	size: z.enum(['Small', 'Medium', 'Large', 'Wallpaper']).optional().describe('Filter by image size.'),
	color: z.enum(['color', 'Monochrome']).optional().describe('Filter by color or monochrome images.'),
	type: z.enum(['photo', 'clipart', 'gif', 'transparent', 'line']).optional().describe('Filter by image type.'),
	layout: z.enum(['Square', 'Tall', 'Wide']).optional().describe('Filter by image orientation.'),
	license: z.enum(['Any', 'Public']).optional().describe('Filter by license.'),
	safeSearch: z.boolean().optional().describe('Enable or disable safe search.')
});

type ImageSearchArgs = z.infer<typeof IMAGE_SEARCH_OBJECT>;

export default class DuckPoacherServer {
	private readonly _ddg = new DuckDuckGo();
	private readonly _server: McpServer;

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
					'Search the web via DuckDuckGo. Returns a list of results, each with a title, URL, and description.',
				inputSchema: WEB_SEARCH_OBJECT.shape
			},
			async ({ query }) => this.run(() => this._ddg.webSearch(query))
		);

		this._server.registerTool(
			'image_search',
			{
				title: 'DuckDuckGo image search',
				description:
					'Search for images via DuckDuckGo. Returns a list of results, each with an image URL and a thumbnail URL. Supports optional filters for time, size, color, type, layout, and license.',
				inputSchema: IMAGE_SEARCH_OBJECT.shape
			},
			async ({ query, ...filters }) => this.run(() => this._ddg.imageSearch(query, this.toImageOptions(filters)))
		);
	}

	private toImageOptions(filters: Omit<ImageSearchArgs, 'query'>): DdgSearchOptions {
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

	private async run(search: () => Promise<unknown>): Promise<ToolResult> {
		try {
			const results = await search();
			return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
		}
		catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return { content: [{ type: 'text', text: `Search failed: ${message}` }], isError: true };
		}
	}
}
