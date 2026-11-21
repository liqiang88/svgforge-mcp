/**
 * Lightweight SVG sanitizer for MCP (no heavy DOM deps).
 * Strips script/foreignObject, event handlers, javascript: URLs, and external entity hints.
 */
export function sanitizeSvg(input: string): { cleaned: string; removed: string[] } {
  const removed: string[] = []
  let svg = input

  const stripTag = (tag: string) => {
    const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>|<${tag}\\b[^>]*\\/?>`, 'gi')
    if (re.test(svg)) {
      removed.push(tag)
      svg = svg.replace(re, '')
    }
  }

  for (const tag of ['script', 'foreignObject', 'iframe', 'object', 'embed', 'link', 'meta', 'style']) {
    stripTag(tag)
  }

  // Event handler attributes
  const beforeHandlers = svg
  svg = svg.replace(/\s+on[a-z]+\s*=\s*(['"]).*?\1/gi, '')
  svg = svg.replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, '')
  if (svg !== beforeHandlers) removed.push('event-handlers')

  // javascript: / data:text/html in href/xlink:href/src
  const beforeJs = svg
  svg = svg.replace(
    /\s(href|xlink:href|src)\s*=\s*(['"])\s*(javascript:|data:\s*text\/html)[\s\S]*?\2/gi,
    '',
  )
  if (svg !== beforeJs) removed.push('dangerous-urls')

  // XML external entity / DOCTYPE
  if (/<!DOCTYPE/i.test(svg) || /<!ENTITY/i.test(svg)) {
    removed.push('doctype-entity')
    svg = svg.replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    svg = svg.replace(/<!ENTITY[\s\S]*?>/gi, '')
  }

  // Processing instructions
  if (/<\?/.test(svg)) {
    removed.push('processing-instruction')
    svg = svg.replace(/<\?[\s\S]*?\?>/g, '')
  }

  return { cleaned: svg.trim(), removed: [...new Set(removed)] }
}
