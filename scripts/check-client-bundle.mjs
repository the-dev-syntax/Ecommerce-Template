import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const staticDir = join(process.cwd(), '.next', 'static')

if (!existsSync(staticDir)) {
  console.error('Missing .next/static. Run `npm run build` before this check.')
  process.exit(1)
}

const markers = [
  { name: 'bcrypt hash', pattern: /\$2[aby]\$\d\d\$/ },
  { name: 'seed email', pattern: /@example\.com/ },
  { name: 'seed password', pattern: /totalena#1And4/ },
]

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(full))
    else if (entry.name.endsWith('.js')) files.push(full)
  }
  return files
}

const files = walk(staticDir)
const hits = []

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  for (const marker of markers) {
    if (marker.pattern.test(source)) {
      hits.push(`${marker.name}: ${file}`)
    }
  }
}

if (hits.length > 0) {
  console.error('Seed data found in the client bundle:')
  for (const hit of hits) console.error(' -', hit)
  process.exit(1)
}

console.log(
  `Client bundle clean: ${files.length} JS chunks, no seed markers found.`
)
