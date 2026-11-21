import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { SfApiError, SfClient, toSvgMarkup } from './client.js'
import type { SfConfig } from './config.js'
import { formatIcon, svgToDataUri, type IconFormat } from './format.js'
import { sanitizeSvg } from './sanitize.js'

function textResult(payload: unknown, isError = false) {
  const text =
    typeof payload === 'string'
      ? payload
      : '```json\n' + JSON.stringify(payload, null, 2) + '\n```'
  return {
    content: [{ type: 'text' as const, text }],
    ...(isError ? { isError: true } : {}),
  }
}

function errResult(err: unknown) {
  if (err instanceof SfApiError) {
    return textResult(
      {
        error: err.message,
        status: err.status,
        code: err.code,
        hint:
          err.status === 401
            ? 'Set SVGForge_API_KEY to a valid sf_… token from https://svgforge.dev/app'
            : err.status === 403
              ? 'This endpoint requires a Pro plan.'
              : undefined,
      },
      true,
    )
  }
  const message = err instanceof Error ? err.message : String(err)
  return textResult({ error: message }, true)
}

function parseIconKey(name: string): { prefix: string; icon: string; key: string } {
  const trimmed = name.trim()
  if (!trimmed.includes(':')) {
    throw new Error('Icon name must be prefix:icon (e.g. lucide:home)')
  }
  const [prefix, icon] = trimmed.split(':', 2)
  if (!prefix || !icon) throw new Error('Invalid icon name')
  return { prefix: prefix.toLowerCase(), icon, key: `${prefix.toLowerCase()}:${icon}` }
}

export function registerTools(server: McpServer, cfg: SfConfig) {
  const client = new SfClient(cfg)

  server.registerTool(
    'search_icons',
    {
      description:
        'Search SVGForge / Iconify icons by keyword. Returns icon keys (prefix:name) and brief meta. Prefer a prefix (e.g. lucide) for faster results.',
      inputSchema: {
        q: z.string().min(1).describe('Search keyword, e.g. home, arrow, user'),
        prefix: z
          .string()
          .optional()
          .describe('Optional icon set prefix filter, e.g. lucide, tabler, mdi'),
        limit: z.number().int().min(1).max(50).optional().describe('Max results (default 20, max 50)'),
      },
    },
    async ({ q, prefix, limit }) => {
      try {
        const data = await client.searchIcons(q, prefix, limit ?? 20)
        const list = (data.list || []).map((item) => ({
          icon_key: `${item.prefix}:${item.name}`,
          prefix: item.prefix,
          name: item.name,
        }))
        return textResult({
          count: list.length,
          icons: list,
          tip: 'Use get_icon with icon_key to fetch SVG or framework code.',
        })
      } catch (err) {
        return errResult(err)
      }
    },
  )

  server.registerTool(
    'get_icon',
    {
      description:
        'Fetch a single icon as raw SVG or auto-generated React / Vue / Svelte / Data URI code.',
      inputSchema: {
        name: z.string().describe('Icon key as prefix:icon, e.g. lucide:home'),
        format: z
          .enum(['svg', 'react', 'vue', 'svelte', 'data-uri'])
          .optional()
          .describe('Output format (default svg)'),
      },
    },
    async ({ name, format }) => {
      try {
        const { prefix, icon, key } = parseIconKey(name)
        const data = await client.getIcon(prefix, icon)
        const svg = toSvgMarkup(data)
        const fmt = (format || 'svg') as IconFormat
        const code = formatIcon(svg, fmt, key)
        return textResult({
          icon_key: key,
          format: fmt,
          width: data.width ?? 16,
          height: data.height ?? 16,
          code,
        })
      } catch (err) {
        return errResult(err)
      }
    },
  )

  server.registerTool(
    'list_icon_sets',
    {
      description: 'List available SVGForge icon packs (Lucide, Tabler, etc.).',
      inputSchema: {
        q: z.string().optional().describe('Optional filter on prefix or name'),
        limit: z.number().int().min(1).max(200).optional().describe('Max sets to return (default 50)'),
      },
    },
    async ({ q, limit }) => {
      try {
        const data = await client.listIconSets()
        const needle = (q || '').trim().toLowerCase()
        let list = data.list || []
        if (needle) {
          list = list.filter(
            (s) =>
              s.prefix.toLowerCase().includes(needle) ||
              String(s.name || '')
                .toLowerCase()
                .includes(needle),
          )
        }
        const max = limit ?? 50
        list = list.slice(0, max)
        return textResult({
          count: list.length,
          sets: list.map((s) => ({
            prefix: s.prefix,
            name: s.name,
            total: s.total,
            category: s.category ?? null,
            license: s.license ?? null,
          })),
        })
      } catch (err) {
        return errResult(err)
      }
    },
  )

  server.registerTool(
    'get_my_collections',
    {
      description:
        'List collections for the authenticated SVGForge user. Requires SVGForge_API_KEY.',
      inputSchema: {},
    },
    async () => {
      try {
        const data = await client.getMyCollections()
        return textResult({
          count: data.list?.length ?? 0,
          collections: data.list ?? [],
        })
      } catch (err) {
        return errResult(err)
      }
    },
  )

  server.registerTool(
    'get_custom_icons',
    {
      description:
        'List private custom icons for the authenticated Pro user. Requires SVGForge_API_KEY and Pro plan.',
      inputSchema: {},
    },
    async () => {
      try {
        const data = await client.getCustomIcons()
        return textResult({
          count: data.list?.length ?? 0,
          icons: data.list ?? [],
        })
      } catch (err) {
        return errResult(err)
      }
    },
  )

  server.registerTool(
    'sanitize_svg',
    {
      description:
        'Sanitize raw SVG: strip script tags, event handlers, dangerous URLs, and DOCTYPE/ENTITY payloads.',
      inputSchema: {
        svg: z.string().min(1).describe('Raw SVG markup'),
      },
    },
    async ({ svg }) => {
      try {
        const { cleaned, removed } = sanitizeSvg(svg)
        return textResult({ cleaned, removed })
      } catch (err) {
        return errResult(err)
      }
    },
  )

  server.registerTool(
    'svg_to_data_uri',
    {
      description: 'Convert raw SVG into a Data URI for CSS background-image or HTML img src.',
      inputSchema: {
        svg: z.string().min(1).describe('Raw SVG markup'),
        encoding: z
          .enum(['uri', 'base64'])
          .optional()
          .describe('Encoding (default uri / percent-encoded)'),
      },
    },
    async ({ svg, encoding }) => {
      try {
        const dataUri = svgToDataUri(svg, encoding || 'uri')
        const q = '"'
        return textResult({
          data_uri: dataUri,
          css: `background-image: url(${q}${dataUri}${q});`,
          img: `<img src=${q}${dataUri}${q} alt="" />`,
        })
      } catch (err) {
        return errResult(err)
      }
    },
  )

  if (cfg.allowWrite) {
    server.registerTool(
      'add_to_collection',
      {
        description:
          'Add an icon to a user collection. Requires SVGForge_API_KEY and SVGForge_MCP_ALLOW_WRITE=1.',
        inputSchema: {
          collection_id: z.number().int().positive().describe('Collection id from get_my_collections'),
          icon_key: z.string().describe('Icon key prefix:name, e.g. lucide:home'),
        },
      },
      async ({ collection_id, icon_key }) => {
        try {
          parseIconKey(icon_key)
          const data = await client.addToCollection(collection_id, icon_key)
          return textResult({ ok: true, result: data })
        } catch (err) {
          return errResult(err)
        }
      },
    )
  }
}
