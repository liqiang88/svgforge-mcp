import { SfClient, toSvgMarkup } from '../dist/client.js'
import { loadConfig } from '../dist/config.js'
import { formatIcon } from '../dist/format.js'
import { sanitizeSvg } from '../dist/sanitize.js'

const cfg = loadConfig()
const c = new SfClient(cfg)

const search = await c.searchIcons('home', 'akar-icons', 3)
console.log('search', JSON.stringify(search, null, 2))

const icon = await c.getIcon('akar-icons', 'home')
const svg = toSvgMarkup(icon)
console.log('svg_len', svg.length)
console.log('react_head', formatIcon(svg, 'react', 'akar-icons:home').slice(0, 160))

const sets = await c.listIconSets()
console.log('sets_count', sets.list?.length)

const bad = sanitizeSvg(
  '<svg onload="alert(1)"><script>x</script><path d="M0 0"/></svg>',
)
console.log('sanitize', bad)

console.log('ok')
