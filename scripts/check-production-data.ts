import productionData, { validateProductionData } from '../lib/production-data'

const problems = validateProductionData(productionData)

if (problems.length > 0) {
  console.error('Production seed data is not ready:')
  for (const problem of problems) console.error(`- ${problem}`)
  process.exit(1)
}

console.log('Production seed data looks ready.')
