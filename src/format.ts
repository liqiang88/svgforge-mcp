export type IconFormat = 'svg' | 'react' | 'vue' | 'svelte' | 'data-uri'

function toPascal(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]+/g, ' ').trim()
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (!parts.length) return 'Icon'
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('')
    .replace(/^[0-9]/, 'Icon$&')
}

function toJsxAttrs(svg: string): string {
  return svg
    .replace(/\sclass=/g, ' className=')
    .replace(/\s([a-z]+)-([a-z]+)=/gi, (_, a: string, b: string) => ` ${a}${b.charAt(0).toUpperCase()}${b.slice(1)}=`)
}

export function formatIcon(svg: string, format: IconFormat, iconKey: string): string {
  const short = iconKey.includes(':') ? iconKey.split(':')[1]! : iconKey
  const name = toPascal(short)

  switch (format) {
    case 'svg':
      return svg
    case 'react': {
      const jsx = toJsxAttrs(svg).replace('<svg', '<svg {...props}')
      return `import type { SVGProps } from 'react'\n\nexport default function ${name}(props: SVGProps<SVGSVGElement>) {\n  return (\n    ${jsx}\n  )\n}\n`
    }
    case 'vue':
      return `<script setup lang="ts">\ndefineOptions({ name: '${name}', inheritAttrs: false })\n</script>\n\n<template>\n  ${svg.replace('<svg', '<svg v-bind="$attrs"')}\n</template>\n`
    case 'svelte':
      return `<script lang="ts">\n  interface Props { class?: string }\n  let { ...rest }: Props = $props()\n</script>\n\n${svg.replace('<svg', '<svg {...rest}')}\n`
    case 'data-uri':
      return svgToDataUri(svg)
    default:
      return svg
  }
}

export function svgToDataUri(svg: string, encoding: 'uri' | 'base64' = 'uri'): string {
  if (encoding === 'base64') {
    const b64 = Buffer.from(svg, 'utf8').toString('base64')
    return `data:image/svg+xml;base64,${b64}`
  }
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
