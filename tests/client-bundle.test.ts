import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { test } from 'node:test'

const ROOT = process.cwd()
const SCAN_DIRS = ['app', 'components', 'hooks', 'lib']
const DATA_IMPORT = /from\s+['"]@\/lib\/data['"]/

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      files.push(...walk(full))
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full)
    }
  }
  return files
}

test('client modules never import the seed dataset', () => {
  const offenders: string[] = []

  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      const source = readFileSync(file, 'utf8')
      if (!/['"]use client['"]/.test(source)) continue
      if (DATA_IMPORT.test(source)) offenders.push(relative(ROOT, file))
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `These client modules import the seed dataset: ${offenders.join(', ')}`
  )
})

test('the setting store uses the client-safe defaults module', () => {
  const source = readFileSync(
    join(ROOT, 'hooks', 'use-setting-store.ts'),
    'utf8'
  )

  assert.match(source, /@\/lib\/default-settings/)
  assert.doesNotMatch(source, /@\/lib\/data/)
})
