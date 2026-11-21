import type { SfConfig } from './config.js'

type ApiEnvelope<T> = { code: number; msg: string; data: T }

export class SfApiError extends Error {
  readonly status: number
  readonly code: number

  constructor(message: string, status: number, code: number) {
    super(message)
    this.name = 'SfApiError'
    this.status = status
    this.code = code
  }
}

export class SfClient {
  constructor(private readonly cfg: SfConfig) {}

  private headers(auth: boolean): Record<string, string> {
    const h: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'svgforge-mcp/0.1.0',
      'X-SVGForge-Client': 'mcp',
    }
    if (auth) {
      if (!this.cfg.apiKey) {
        throw new SfApiError(
          'Missing SVGForge_API_KEY. Create a token at Dashboard → API tokens (https://svgforge.dev/app), then set env SVGForge_API_KEY=sf_xxx.',
          401,
          401,
        )
      }
      h.Authorization = `Bearer ${this.cfg.apiKey}`
    }
    return h
  }

  private async request<T>(path: string, opts: { auth?: boolean; method?: string; body?: unknown } = {}): Promise<T> {
    const auth = opts.auth === true
    const url = `${this.cfg.apiBase}${path}`
    let res: Response
    try {
      res = await fetch(url, {
        method: opts.method || 'GET',
        headers: {
          ...this.headers(auth),
          ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new SfApiError(`Network error calling ${url}: ${msg}`, 0, 0)
    }

    let json: ApiEnvelope<T>
    try {
      json = (await res.json()) as ApiEnvelope<T>
    } catch {
      throw new SfApiError(`Invalid JSON from ${path} (HTTP ${res.status})`, res.status, res.status)
    }

    if (!res.ok || json.code !== 0) {
      const msg = json.msg || `HTTP ${res.status}`
      throw new SfApiError(msg, res.status, typeof json.code === 'number' ? json.code : res.status)
    }
    return json.data
  }

  searchIcons(q: string, prefix?: string, limit = 20) {
    const params = new URLSearchParams({
      q,
      limit: String(Math.max(1, Math.min(50, limit))),
    })
    if (prefix) params.set('prefix', prefix)
    // Public search — no token required
    return this.request<{ list: Array<{ name: string; prefix: string }> }>(
      `/api/v1/icons/search?${params.toString()}`,
    )
  }

  getIcon(prefix: string, icon: string) {
    return this.request<{
      name?: string
      prefix?: string
      body: string
      width?: number
      height?: number
      left?: number
      top?: number
    }>(`/api/v1/icons/${encodeURIComponent(prefix)}/${encodeURIComponent(icon)}`)
  }

  listIconSets() {
    return this.request<{
      list: Array<{
        prefix: string
        name: string
        total: number
        category?: string | null
        license?: string | null
      }>
    }>('/api/v1/icon-sets')
  }

  getMyCollections() {
    return this.request<{ list: Array<{ id: number; name: string; icon_count: number }> }>(
      '/api/v1/plugin/collections',
      { auth: true },
    )
  }

  getCustomIcons() {
    return this.request<{ list: Array<Record<string, unknown>> }>('/api/v1/plugin/custom-icons', {
      auth: true,
    })
  }

  addToCollection(collectionId: number, iconKey: string) {
    return this.request<Record<string, unknown>>('/api/v1/plugin/collections/items', {
      auth: true,
      method: 'POST',
      body: { collection_id: collectionId, icon_key: iconKey },
    })
  }
}

export function toSvgMarkup(icon: {
  body: string
  width?: number
  height?: number
  left?: number
  top?: number
}): string {
  const w = icon.width && icon.width > 0 ? icon.width : 16
  const h = icon.height && icon.height > 0 ? icon.height : 16
  const left = icon.left ?? 0
  const top = icon.top ?? 0
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${left} ${top} ${w} ${h}">${icon.body}</svg>`
}
