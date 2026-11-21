#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { loadConfig } from './config.js'
import { registerTools } from './tools.js'

async function main() {
  const cfg = loadConfig()

  if (!cfg.apiKey) {
    console.error(
      '[svgforge-mcp] SVGForge_API_KEY not set — public tools (search_icons, get_icon, list_icon_sets, sanitize_svg, svg_to_data_uri) still work; private tools need a token from https://svgforge.dev/app',
    )
  } else {
    console.error(`[svgforge-mcp] API base: ${cfg.apiBase} (auth enabled)`)
  }
  if (cfg.allowWrite) {
    console.error('[svgforge-mcp] Write tools enabled (SVGForge_MCP_ALLOW_WRITE=1)')
  }

  const server = new McpServer({
    name: 'svgforge',
    version: '0.1.0',
  })

  registerTools(server, cfg)

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[svgforge-mcp] listening on stdio')
}

main().catch((err) => {
  console.error('[svgforge-mcp] fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})
