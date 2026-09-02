import { readFileSync } from 'node:fs'

const files = {
  'en-US': new URL('../messages/en-US.json', import.meta.url),
  ar: new URL('../messages/ar.json', import.meta.url),
  fr: new URL('../messages/fr.json', import.meta.url),
}

const read = (path) => JSON.parse(readFileSync(path, 'utf8'))

const en = read(files['en-US'])
const others = { ar: read(files.ar), fr: read(files.fr) }
const enKeys = Object.keys(en)
const issues = []

for (const [lang, obj] of Object.entries(others)) {
  for (const k of enKeys) {
    if (!(k in obj)) issues.push(`MISSING in ${lang}: "${k}"`)
  }
  for (const k of Object.keys(obj)) {
    if (!(k in en)) issues.push(`EXTRA in ${lang}: "${k}"`)
  }
  for (const k of Object.keys(obj)) {
    if (String(obj[k]).trim() === '') issues.push(`EMPTY in ${lang}: "${k}"`)
  }
}

if (issues.length > 0) {
  console.error('i18n inconsistencies found:')
  for (const i of issues) console.error('  ' + i)
  process.exit(1)
}
console.log(`OK — en-US, ar, fr have ${enKeys.length} identical keys`)
