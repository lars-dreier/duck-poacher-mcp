#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import DuckPoacherServer from './DuckPoacherServer.ts';

// Keep in sync with package.json. Reported to MCP clients on initialize.
const SERVER_NAME = 'duck-poacher-mcp';
const SERVER_VERSION = '0.1.0';

async function main(): Promise<void> {
	const server = new DuckPoacherServer(SERVER_NAME, SERVER_VERSION);
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch((error: unknown) => {
	// stdout is the JSON-RPC channel; diagnostics must go to stderr.
	console.error(error);
	process.exit(1);
});
