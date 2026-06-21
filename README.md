# duck-poacher-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes
DuckDuckGo web and image search to MCP clients (Claude Desktop, Claude Code, and
others). It wraps the [`duck-poacher`](https://github.com/lars-dreier/duck-poacher)
scraper.

## Tools

| Tool | Arguments | Returns |
|------|-----------|---------|
| `web_search` | `query` | JSON array of `{ title, url, description }` |
| `image_search` | `query`, optional `time` / `size` / `color` / `type` / `layout` / `license` / `safeSearch` | JSON array of `{ thumbnailUrl, imageUrl }` |

Both tools return their results as a JSON string. A failed
scrape (token/URL could not be read, upstream HTTP error) comes back as a tool
result with `isError: true` and the message.

## Use with an MCP client

Run the published binary over stdio. With Claude Code:

```sh
claude mcp add duck-poacher -- npx -y duck-poacher-mcp
```

Or configure it directly (e.g. Claude Desktop's `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "duck-poacher": {
      "command": "npx",
      "args": ["-y", "duck-poacher-mcp"]
    }
  }
}
```

### LM Studio

Edit LM Studio's `mcp.json` (Program tab → **Edit mcp.json**) and add the same entry:

```json
{
  "mcpServers": {
    "duck-poacher": {
      "command": "npx",
      "args": ["-y", "duck-poacher-mcp"]
    }
  }
}
```

## Develop

```sh
npm install
npm test          # live integration specs — hit DuckDuckGo, need network
npm run build     # bundle to dist/ (ESM), bin → dist/cli.mjs
```

Inspect the tools interactively with the MCP Inspector:

```sh
npm run build
npx @modelcontextprotocol/inspector node dist/cli.mjs
```

See [`.claude/documentation/`](.claude/documentation/index.md) for the code-style
and testing conventions this project follows.

## License

ISC © Lars Dreier
