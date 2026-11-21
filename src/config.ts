export type SfConfig = {
  apiBase: string
  apiKey: string
  allowWrite: boolean
}

const DEFAULT_BASE = 'https://svgforge.dev'

export function loadConfig(): SfConfig {
  const apiBase = (process.env.SVGForge_API_BASE || process.env.SVGFORGE_API_BASE || DEFAULT_BASE)
    .trim()
    .replace(/\/$/, '')
  const apiKey = (process.env.SVGForge_API_KEY || process.env.SVGFORGE_API_KEY || '').trim()
  const allowWrite =
    process.env.SVGForge_MCP_ALLOW_WRITE === '1' ||
    process.env.SVGFORGE_MCP_ALLOW_WRITE === '1'

  return { apiBase, apiKey, allowWrite }
}
