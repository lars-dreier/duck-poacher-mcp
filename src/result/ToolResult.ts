import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { TextContent } from './TextContent.ts';

/**
 * The outcome of an MCP tool call: text content plus an optional error flag.
 */
export default class ToolResult {
	public constructor(
		public readonly content: TextContent[],
		public readonly isError?: boolean,
	) {}

	public static text(text: string): ToolResult {
		return new ToolResult([{ type: 'text', text }]);
	}

	/**
	 * MCP convention: a failing tool reports the error in its result, not by throwing.
	 */
	public static error(message: string): ToolResult {
		return new ToolResult([{ type: 'text', text: message }], true);
	}

	public toCallResult(): CallToolResult {
		return { content: this.content, isError: this.isError };
	}
}
