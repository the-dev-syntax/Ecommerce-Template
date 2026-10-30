import { loadEnvConfig } from '@next/env'
import { cwd } from 'process'

import { connectToDatabase } from '../lib/db'
import User from '../lib/db/models/user.model'

loadEnvConfig(cwd())

async function main() {
  await connectToDatabase(process.env.MONGODB_URI)

  // The application normalizes emails on write, but legacy/OAuth documents may
  // still contain case variants. Creating a unique collation index would fail
  // on those, so report them before touching the index.
  const duplicates = await User.aggregate<{
    _id: string
    count: number
    emails: string[]
  }>([
    {
      $group: {
        _id: { $toLower: { $trim: { input: '$email' } } },
        count: { $sum: 1 },
        emails: { $push: '$email' },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ])

  if (duplicates.length > 0) {
    console.error('Cannot create the case-insensitive email index:')
    for (const duplicate of duplicates) {
      console.error(`- ${duplicate._id}: ${duplicate.emails.join(', ')}`)
    }
    console.error('Resolve these accounts manually, then run this script again.')
    process.exitCode = 1
    return
  }

  await User.collection.createIndex(
    { email: 1 },
    {
      unique: true,
      collation: { locale: 'en', strength: 2 },
      name: 'email_ci_unique',
    }
  )

  console.log('Created the case-insensitive unique email index.')
}

main().catch((error) => {
  console.error(
    'Email index migration failed:',
    error instanceof Error ? error.message : 'Unknown error'
  )
  process.exitCode = 1
})
